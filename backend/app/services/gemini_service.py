"""Gemini istemcisi ve çağrı mantığı (RULES.md §8).

Gemini API'ye yalnızca bu modül erişir. İki kullanım şekli var:

- **Zenginleştirme** (`enrich_review_text`): çıktı şeması (traveler_type,
  sentiment_label, summary, keywords) tek yerde, aşağıdaki
  `GeminiEnrichment` modelinde tanımlanır ve `response_schema` (JSON modu)
  ile zorlanır: amaç dış bir fonksiyon çalıştırmak değil yapısal veri geri
  almak olduğundan function calling yerine bu mekanizma seçildi (PROJECT.md §6).
- **Sohbet** (`chat_reply`): dashboard'daki asistan widget'i için şema
  zorlaması olmayan serbest metin yanıtı üretir. Tek istisna: `import_csv`
  adında bir fonksiyon Gemini'ye tanımlanır (function calling); kullanıcı
  CSV/yorum içe aktarma niyeti belirtirse model bu fonksiyonu çağırır, biz
  de bunu `ChatAction.IMPORT_CSV` olarak frontend'e bildiririz — frontend
  mevcut CSVImportModal'ı açar (gerçek dosya yükleme yine UI'da kalır).

İkisi de istek numaralandırma/loglama/hata mekanizmasını `_generate`
yardımcı fonksiyonu üzerinden paylaşır.
"""

import itertools
import logging
import time
from dataclasses import dataclass

from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from app.config import get_settings
from app.core.constants import ChatAction
from app.core.exceptions import ChatError, EnrichmentError
from app.schemas.enrichment import PROMPT_PREFIX, GeminiEnrichment

logger = logging.getLogger(__name__)

# Sohbet widget'i için sistem talimatı: import_csv function-call ne zaman
# tetiklenir onu tarif eder; asil dosya secimi yine UI'da kalir.
_CHAT_SYSTEM_INSTRUCTION = (
    "Sen otel yorumlari dil ve duygu analizi panelinde calisan bir "
    "asistansin. Panel ve veriler hakkindaki sorulara kisa, net ve turkce "
    "cevaplar ver. Kullanici CSV dosyasi yuklemek, yorumlari ice aktarmak "
    "veya toplu veri eklemek istedigini belirtirse import_csv fonksiyonunu "
    "cagir; dosya secimi ayrica arayuzde yapilir, sen bunu tetiklemezsin."
)

# Gemini'ye tanımlanan tek fonksiyon: parametre almaz, yalnızca kullanıcının
# CSV içe aktarma niyetini yakalamak için kullanılır (bkz. chat_reply).
_IMPORT_CSV_FUNCTION = types.FunctionDeclaration(
    name="import_csv",
    description=(
        "Kullanici CSV dosyasi yuklemek, yorumlari ice aktarmak veya toplu "
        "veri eklemek istedigini belirttiginde cagrilir."
    ),
    parameters=types.Schema(type=types.Type.OBJECT, properties={}),
)
_CHAT_TOOLS = [types.Tool(function_declarations=[_IMPORT_CSV_FUNCTION])]

# import_csv cagrildiginda kullaniciya gosterilen sabit yanit; Gemini'nin
# fonksiyon cagrisiyla ayni turde metin uretmemesi ihtimaline karsi
# tutarli bir mesaj burada, kod tarafinda uretilir.
_IMPORT_CSV_REPLY = "CSV ice aktarma penceresini aciyorum; dosyani oradan yukleyebilirsin."

_client: genai.Client | None = None

# Terminal loglarında eşzamanlı istekleri ayırt etmek için artan istek numarası.
_request_counter = itertools.count(1)


@dataclass
class _UsageTotals:
    """Bir import boyunca biriken Gemini istek ve token sayaçları."""

    requests: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0


_usage_totals = _UsageTotals()


def reset_usage_totals() -> None:
    """Token sayaçlarını sıfırlar; csv_service her import başında çağırır."""
    global _usage_totals
    _usage_totals = _UsageTotals()


def log_usage_totals() -> None:
    """Biriken token toplamlarını terminale yazar (import sonunda çağrılır)."""
    logger.info(
        "Gemini TOPLAM: %d basarili istek — token: input=%d, output=%d, toplam=%d",
        _usage_totals.requests,
        _usage_totals.input_tokens,
        _usage_totals.output_tokens,
        _usage_totals.total_tokens,
    )


def _get_client() -> genai.Client:
    """Gemini client singleton'ı — API anahtarı env'den okunur."""
    global _client
    if _client is None:
        _client = genai.Client(api_key=get_settings().gemini_api_key)
    return _client


async def _generate(
    label: str,
    contents: str | list[types.Content],
    config: types.GenerateContentConfig,
) -> types.GenerateContentResponse:
    """Ortak Gemini çağrısı: istek numaralandırma, süre/hata/token loglaması.

    `enrich_review_text` ve `chat_reply` bu sarmalayıcıyı paylaşır; ikisi de
    başarıda HTTP 200 + süre + token, hatada HTTP kodu/hata adı + açıklama
    ile aynı formatta loglanır (RULES.md §6). Hata durumunda loglanıp
    olduğu gibi yeniden fırlatılır; hangi özel hata sınıfına
    (`EnrichmentError`/`ChatError`) çevrileceğine çağıran karar verir.
    """
    settings = get_settings()
    request_no = next(_request_counter)
    logger.info(
        "Gemini istek #%d gonderiliyor (model=%s, %s)",
        request_no,
        settings.gemini_model,
        label,
    )
    started = time.perf_counter()
    try:
        response = await _get_client().aio.models.generate_content(
            model=settings.gemini_model, contents=contents, config=config
        )
    except genai_errors.APIError as exc:  # API hataları: HTTP kodu + açıklama
        logger.error(
            "Gemini istek #%d BASARISIZ: HTTP %s %s (%.2fs) — %s",
            request_no,
            exc.code,
            exc.status,
            time.perf_counter() - started,
            exc.message,
        )
        raise
    except Exception as exc:  # API dışı hatalar (ağ kopması, timeout vb.)
        logger.error(
            "Gemini istek #%d BASARISIZ: %s (%.2fs) — %s",
            request_no,
            type(exc).__name__,
            time.perf_counter() - started,
            exc,
        )
        raise

    usage = response.usage_metadata
    input_tokens = (usage.prompt_token_count or 0) if usage else 0
    output_tokens = (usage.candidates_token_count or 0) if usage else 0
    total_tokens = (usage.total_token_count or 0) if usage else 0
    _usage_totals.requests += 1
    _usage_totals.input_tokens += input_tokens
    _usage_totals.output_tokens += output_tokens
    _usage_totals.total_tokens += total_tokens
    logger.info(
        "Gemini istek #%d TAMAM: HTTP 200 (%.2fs) — token: input=%d, "
        "output=%d, toplam=%d",
        request_no,
        time.perf_counter() - started,
        input_tokens,
        output_tokens,
        total_tokens,
    )
    return response


async def enrich_review_text(review_text: str) -> GeminiEnrichment:
    """Tek yorum için tek Gemini çağrısıyla tüm zenginleştirme alanlarını üretir.

    Başarısızlıkta (ağ/timeout/geçersiz çıktı) `EnrichmentError` fırlatır;
    alanları null bırakmak çağıran katmanın sorumluluğudur.
    """
    try:
        response = await _generate(
            label=f"metin='{review_text[:40].replace(chr(10), ' ')}...'",
            contents=PROMPT_PREFIX + review_text,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=GeminiEnrichment,
                temperature=0.0,
            ),
        )
    except Exception as exc:
        raise EnrichmentError(f"Gemini cagrisi basarisiz: {exc}") from exc

    parsed = response.parsed
    if not isinstance(parsed, GeminiEnrichment):
        logger.error("Gemini yaniti HTTP 200 dondu ama cikti semaya uymuyor.")
        raise EnrichmentError("Gemini bos veya semaya uymayan cikti dondurdu.")
    return parsed


async def chat_reply(message: str, history: list[tuple[str, str]]) -> tuple[str, ChatAction]:
    """Dashboard sohbet widget'i için yanıt üretir; metin veya `import_csv` eylemi döner.

    Zenginleştirmeden farklı olarak `response_schema` zorlanmaz; Gemini'ye
    yalnızca `import_csv` fonksiyonu tanımlanır (`_CHAT_TOOLS`). `history`,
    önceki turleri (role, content) çiftleri olarak taşır; role
    'user'/'assistant' değerlerini alır ve burada Gemini'nin beklediği
    'user'/'model' rollerine çevrilir. Başarısızlıkta/boş yanıtta
    `ChatError` fırlatır.
    """
    contents = [
        types.Content(
            role="model" if role == "assistant" else "user",
            parts=[types.Part(text=text)],
        )
        for role, text in history
    ]
    contents.append(types.Content(role="user", parts=[types.Part(text=message)]))

    try:
        response = await _generate(
            label=f"chat, mesaj='{message[:40].replace(chr(10), ' ')}...'",
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=_CHAT_SYSTEM_INSTRUCTION,
                temperature=0.4,
                tools=_CHAT_TOOLS,
            ),
        )
    except Exception as exc:
        raise ChatError(f"Gemini sohbet cagrisi basarisiz: {exc}") from exc

    calls = response.function_calls or []
    if any(call.name == "import_csv" for call in calls):
        return _IMPORT_CSV_REPLY, ChatAction.IMPORT_CSV

    reply = (response.text or "").strip()
    if not reply:
        logger.error("Gemini sohbet yaniti HTTP 200 dondu ama metin bos.")
        raise ChatError("Gemini bos yanit dondurdu.")
    return reply, ChatAction.CHAT
