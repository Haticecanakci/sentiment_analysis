"""Gemini istemcisi ve yapısal çıktı çağrısı (RULES.md §8).

Gemini API'ye yalnızca bu modül erişir. Çıktı şeması (traveler_type,
sentiment_label, summary, keywords) tek yerde, aşağıdaki
`GeminiEnrichment` modelinde tanımlanır ve `response_schema` (JSON modu)
ile zorlanır: amaç dış bir fonksiyon çalıştırmak değil yapısal veri geri
almak olduğundan function calling yerine bu mekanizma seçildi (PROJECT.md §6).
"""

import itertools
import logging
import time
from dataclasses import dataclass

from google import genai
from google.genai import errors as genai_errors
from google.genai import types


from pydantic import BaseModel

from app.config import get_settings
from app.core.constants import SentimentLabel, TravelerType
from app.core.exceptions import EnrichmentError

logger = logging.getLogger(__name__)


class KeywordItem(BaseModel):
    """Tek anahtar kelime: kelime."""

    word: str



class GeminiEnrichment(BaseModel):
    """Gemini'den istenen yapısal çıktı şeması.

    Enum alanları constants.py'deki StrEnum'lardan gelir; Pydantic modeli
    response_schema olarak verildiğinde enum değerleri Gemini'ye dayatılır.
    """

    traveler_type: TravelerType
    sentiment_label: SentimentLabel
    summary: str
    keywords: list[KeywordItem]


# Kısa ve direktif prompt (RULES.md §8); şema zorlaması response_schema'da.
_PROMPT_PREFIX = (
    "Asagidaki otel yorumunu analiz et ve istenen alanlari uret:\n"
    "- traveler_type: seyahat tipini sec; yorumdan net anlasilmiyorsa 'Unknown'.\n"
    "- sentiment_label: Pozitif, Negatif veya Notr.\n"
    "- summary: yorumun dilinde 1-2 cumlelik kisa ozet.\n"
    "- keywords: en fazla 5 anahtar kelime\n"
    "\nYorum:\n"
)

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


async def enrich_review_text(review_text: str) -> GeminiEnrichment:
    """Tek yorum için tek Gemini çağrısıyla tüm zenginleştirme alanlarını üretir.

    Her istek numaralandırılıp terminale loglanır: başarıda HTTP 200 + süre +
    token sayısı, hatada HTTP kodu/hata adı + açıklaması (RULES.md §6).
    Başarısızlıkta (ağ/timeout/geçersiz çıktı) `EnrichmentError` fırlatır;
    alanları null bırakmak çağıran katmanın sorumluluğudur.
    """
    settings = get_settings()
    request_no = next(_request_counter)
    logger.info(
        "Gemini istek #%d gonderiliyor (model=%s, metin='%.40s...')",
        request_no,
        settings.gemini_model,
        review_text.replace("\n", " "),
    )
    started = time.perf_counter()
    try:
        response = await _get_client().aio.models.generate_content(
            model=settings.gemini_model,
            contents=_PROMPT_PREFIX + review_text,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=GeminiEnrichment,
                temperature=0.0,
            ),
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
        raise EnrichmentError(f"Gemini cagrisi basarisiz: {exc}") from exc
    except Exception as exc:  # API dışı hatalar (ağ kopması, timeout vb.)
        logger.error(
            "Gemini istek #%d BASARISIZ: %s (%.2fs) — %s",
            request_no,
            type(exc).__name__,
            time.perf_counter() - started,
            exc,
        )
        raise EnrichmentError(f"Gemini cagrisi basarisiz: {exc}") from exc

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

    parsed = response.parsed
    if not isinstance(parsed, GeminiEnrichment):
        logger.error(
            "Gemini istek #%d: HTTP 200 dondu ama cikti semaya uymuyor.",
            request_no,
        )
        raise EnrichmentError("Gemini bos veya semaya uymayan cikti dondurdu.")
    return parsed
