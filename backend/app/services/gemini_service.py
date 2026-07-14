"""Gemini istemcisi ve yapısal çıktı çağrısı (RULES.md §8).

Gemini API'ye yalnızca bu modül erişir. Çıktı şeması (traveler_type,
sentiment_label, summary, keywords) tek yerde, aşağıdaki
`GeminiEnrichment` modelinde tanımlanır ve `response_schema` (JSON modu)
ile zorlanır: amaç dış bir fonksiyon çalıştırmak değil yapısal veri geri
almak olduğundan function calling yerine bu mekanizma seçildi (PROJECT.md §6).
"""

import logging

from google import genai
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


def _get_client() -> genai.Client:
    """Gemini client singleton'ı — API anahtarı env'den okunur."""
    global _client
    if _client is None:
        _client = genai.Client(api_key=get_settings().gemini_api_key)
    return _client


async def enrich_review_text(review_text: str) -> GeminiEnrichment:
    """Tek yorum için tek Gemini çağrısıyla tüm zenginleştirme alanlarını üretir.

    Başarısızlıkta (ağ/timeout/geçersiz çıktı) `EnrichmentError` fırlatır;
    hatayı loglayıp alanları null bırakmak çağıran katmanın sorumluluğudur.
    """
    settings = get_settings()
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
    except Exception as exc:  # SDK'nın tüm ağ/kota/timeout hataları tek noktada
        raise EnrichmentError(f"Gemini cagrisi basarisiz: {exc}") from exc

    parsed = response.parsed
    if not isinstance(parsed, GeminiEnrichment):
        raise EnrichmentError("Gemini bos veya semaya uymayan cikti dondurdu.")
    return parsed
