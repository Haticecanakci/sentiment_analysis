"""Yorum listeleme, detay ve filtre-değerleri sorguları.

Tüm veri erişimi Prisma üzerinden yapılır (RULES.md §3); HTTP nesneleri
bu katmana girmez. Servis, Prisma model örnekleri döndürür; Pydantic'e
dönüştürme router/schemas katmanında yapılır.
"""

from datetime import datetime, timedelta, timezone

from prisma.models import Review

from app.core.constants import (
    DATE_RANGE_DAYS,
    DATE_RANGE_VALUES,
    SORT_ORDER_VALUES,
    DateRange,
    SortOrder,
)
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
    date_range: DateRange | None,
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
    if date_range:
        cutoff = datetime.now(timezone.utc) - timedelta(
            days=DATE_RANGE_DAYS[date_range]
        )
        # gte koşulu reviewDate'i null olan kayıtları da otomatik eler.
        where["reviewDate"] = {"gte": cutoff}
    return where


async def list_reviews(
    *,
    country: str | None = None,
    traveler_type: str | None = None,
    sentiment_label: str | None = None,
    language: str | None = None,
    search: str | None = None,
    date_range: DateRange | None = None,
    sort: SortOrder | None = None,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> tuple[list[Review], int]:
    """Filtreli/sayfalı yorum listesi ve toplam kayıt sayısını döndürür.

    Sıralama ve sayfalama DB'de yapılır (ORDER BY + LIMIT/OFFSET); tüm
    kayıtları çekip bellekte sıralamak büyük veride ölçeklenmez. Toplam
    sayı, sayfalama meta bilgisi (total_pages) için aynı where koşuluyla
    ayrıca sayılır.
    """
    page = max(page, 1)
    page_size = min(max(page_size, 1), MAX_PAGE_SIZE)
    where = _build_where(
        country, traveler_type, sentiment_label, language, search, date_range
    )

    # Varsayılan: en son eklenen üstte. Tarih sıralamasında id eşitlik
    # bozucudur: aynı tarihli kayıtların sırası sayfalar arasında kararlı
    # kalır (aksi halde kayıt tekrarı/atlaması olabilir).
    if sort is None:
        order: list[dict] = [{"id": "desc"}]
    else:
        direction = "asc" if sort is SortOrder.DATE_ASC else "desc"
        order = [{"reviewDate": direction}, {"id": direction}]

    total = await db.review.count(where=where)
    items = await db.review.find_many(
        where=where,
        order=order,
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
    """Bir alanın benzersiz değerlerini alfabetik döndürür.

    Filtre alanları şemada NOT NULL olduğundan null eleme koşulu gerekmez;
    NOT NULL bir alana `{"not": None}` koşulu Prisma tarafından reddedilir.
    """
    rows = await db.review.find_many(
        distinct=[field],
        order={field: "asc"},
    )
    return [getattr(row, field) for row in rows]


async def get_filter_options() -> dict[str, list[str]]:
    """Filtre dropdown'ları için veride mevcut distinct değerleri döndürür.

    Sabit enum listeleri yerine DB'deki distinct değerler tercih edildi:
    dropdown'lar yalnızca gerçekten veri olan seçenekleri gösterir
    (PROJECT.md §7 gerekçesi). date_ranges ve sort_orders istisnadır:
    bunlar veriden değil sabit seçenek listelerinden gelir.
    """
    options: dict[str, list[str]] = {
        key: await _distinct_values(field)
        for key, field in _FILTER_FIELDS.items()
    }
    options["date_ranges"] = DATE_RANGE_VALUES
    options["sort_orders"] = SORT_ORDER_VALUES
    return options
