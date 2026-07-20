"""Zenginleştirme birleştirme katmanı.

gemini_service'in ham çıktısını pipeline'ın kullanacağı normalize edilmiş
`EnrichmentResult`'a çevirir: anahtar kelimeleri normalize edip
tekilleştirir, Gemini hatasında tüm alanları null bırakıp loglar — tek bir
yorumun hatası import'u çökertmez (RULES.md §6, PROJECT.md §6).
"""

import logging
from dataclasses import dataclass, field

from app.core.exceptions import EnrichmentError
from app.schemas.enrichment import KeywordItem
from app.services import gemini_service

logger = logging.getLogger(__name__)

MAX_KEYWORDS: int = 5


@dataclass
class EnrichmentResult:
    """Pipeline'a dönen normalize edilmiş sonuç.

    Gemini hatasında alanlar None / boş liste kalır; Review satırı yine
    yazılır, zenginleştirme alanları null olur.
    """

    traveler_type: str | None = None
    sentiment_label: str | None = None
    summary: str | None = None
    keywords: list[str] = field(default_factory=list)



def _normalize_keywords(items: list[KeywordItem]) -> list[str]:
    """Kelimeleri küçük harfe indirir, sırayı koruyarak tekilleştirir."""
    # dict, ekleme sırasını koruduğu için sıralı küme olarak kullanılıyor.
    seen: dict[str, None] = {}
    for item in items:
        word = item.word.strip().lower()
        if word:
            seen.setdefault(word, None)
    return list(seen)[:MAX_KEYWORDS]


async def enrich_review(review_text: str) -> EnrichmentResult:
    """Tek yorum için zenginleştirme alanlarını üretir.

    Hata durumunda exception yaymaz: loglar ve tüm alanları null bırakan
    boş bir sonuç döner.
    """
    try:
        raw = await gemini_service.enrich_review_text(review_text)
    except EnrichmentError as exc:
        logger.error(
            "Zenginlestirme basarisiz, alanlar null birakildi: %s", exc.message
        )
        return EnrichmentResult()

    return EnrichmentResult(
        traveler_type=raw.traveler_type.value,
        sentiment_label=raw.sentiment_label.value,
        summary=raw.summary.strip() or None,
        keywords=_normalize_keywords(raw.keywords),
    )
