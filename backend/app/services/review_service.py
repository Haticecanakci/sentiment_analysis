"""Yorum listeleme, detay ve filtre-değerleri sorguları.

Tüm veri erişimi Prisma üzerinden yapılır (RULES.md §3); HTTP nesneleri
bu katmana girmez. Servis, Prisma model örnekleri döndürür; Pydantic'e
dönüştürme router/schemas katmanında yapılır.
"""

from prisma.models import Review

from app.core.exceptions import ReviewNotFoundError
from app.database import db

DEFAULT_PAGE_SIZE: int = 20
MAX_PAGE_SIZE: int = 100

# /reviews/filters yanıtındaki anahtar → Review model alanı eşlemesi.
_FILTER_FIELDS: dict[str, str] = {
    "countries": "country",
    "languages": "language",
    "traveler_types": "travelerType",
    "sentiment_labels": "sentimentLabel",
}


def _build_where(
    country: str | None,
    traveler_type: str | None,
    sentiment_label: str | None,
    language: str | None,
    search: str | None,
) -> dict:
    """Verilen filtrelerden Prisma where sözlüğü kurar (boşlar atlanır)."""
    where: dict = {}
    if country:
        where["country"] = country
    if traveler_type:
        where["travelerType"] = traveler_type
    if sentiment_label:
        where["sentimentLabel"] = sentiment_label
    if language:
        where["language"] = language
    if search:
        where["reviewText"] = {"contains": search, "mode": "insensitive"}
    return where


async def list_reviews(
    *,
    country: str | None = None,
    traveler_type: str | None = None,
    sentiment_label: str | None = None,
    language: str | None = None,
    search: str | None = None,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> tuple[list[Review], int]:
    """Filtreli/sayfalı yorum listesi ve toplam kayıt sayısını döndürür.

    Toplam sayı, sayfalama meta bilgisi (total_pages) için aynı where
    koşuluyla ayrıca sayılır.
    """
    page = max(page, 1)
    page_size = min(max(page_size, 1), MAX_PAGE_SIZE)
    where = _build_where(country, traveler_type, sentiment_label, language, search)

    total = await db.review.count(where=where)
    items = await db.review.find_many(
        where=where,
        order={"id": "desc"},
        skip=(page - 1) * page_size,
        take=page_size,
    )
    return items, total


async def get_review(review_id: int) -> Review:
    """Tek yorumu otel ve anahtar kelimeleriyle birlikte döndürür.

    Bulunamazsa ReviewNotFoundError fırlatır (router 404'e çevirir).
    """
    review = await db.review.find_unique(
        where={"id": review_id},
        include={"hotel": True, "keywords": {"include": {"keyword": True}}},
    )
    if review is None:
        raise ReviewNotFoundError(review_id)
    return review


async def _distinct_values(field: str) -> list[str]:
    """Bir alanın null olmayan benzersiz değerlerini alfabetik döndürür."""
    rows = await db.review.find_many(
        where={field: {"not": None}},
        distinct=[field],
        order={field: "asc"},
    )
    return [getattr(row, field) for row in rows]


async def get_filter_options() -> dict[str, list[str]]:
    """Filtre dropdown'ları için veride mevcut distinct değerleri döndürür.

    Sabit enum listeleri yerine DB'deki distinct değerler tercih edildi:
    dropdown'lar yalnızca gerçekten veri olan seçenekleri gösterir
    (PROJECT.md §7 gerekçesi).
    """
    return {
        key: await _distinct_values(field)
        for key, field in _FILTER_FIELDS.items()
    }
