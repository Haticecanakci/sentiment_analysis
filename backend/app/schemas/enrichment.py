"""Gemini zenginleştirme çıktı şeması ve prompt'u (RULES.md §8, PROJECT.md §6).

`gemini_service.py` bu modeli `response_schema` olarak Gemini'ye verir ve
`PROMPT_PREFIX`'i istek metnine ekler; tanım burada, tek yerde tutulur ki
`enrichment_service` ile paylaşılan `KeywordItem` tekrar edilmesin.
"""

from pydantic import BaseModel

from app.core.constants import SentimentLabel, TravelerType


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
PROMPT_PREFIX = (
    "Asagidaki otel yorumunu analiz et ve istenen alanlari uret:\n"
    "- traveler_type: seyahat tipini sec; yorumdan net anlasilmiyorsa 'Unknown'.\n"
    "- sentiment_label: Pozitif, Negatif veya Notr.\n"
    "- summary: yorumun hangi dilde olursa olsun türkçe dilinde 1-2 cumlelik kisa ozet.\n"
    "- keywords: yorum hangi dilde olursa olsun türkçe dilinde en fazla 5 anahtar kelime , 5 kelime olamk zorunda değil\n"
    "\nYorum:\n"
)
