"""Dashboard agregasyonları — Prisma group_by ile (PROJECT.md §8).

Tüm metrikler tek yanıtta döner (/dashboard tek endpoint kararı, PROJECT.md
§7). Ülke metrikleri Review.country (dilden türetilen ISO kodu) üzerinden
hesaplanır. Saf SQL kullanılmaz; group_by ile ifade edilemeyen bir sorgu
olmadığından query_raw'a gerek kalmamıştır (RULES.md §3).
"""

import asyncio

from app.core.constants import TravelerType
from app.database import db

TOP_COUNTRIES_LIMIT: int = 10


async def _grouped_counts(
    field: str, extra_where: dict | None = None
) -> list[dict]:
    """Bir alanın null olmayan değerlerine göre gruplu sayım döndürür.

    Sonuç, çoktan aza sıralı [{"value": ..., "count": ...}] listesidir.
    Grup sayısı küçük olduğundan (en fazla distinct değer kadar) sıralama
    Python tarafında yapılır; bu, Prisma client sürümleri arasında aggregate
    sıralama davranış farklarına bağımlılığı da ortadan kaldırır.
    """
    where: dict = {field: {"not": None}}
    if extra_where:
        where.update(extra_where)
    groups = await db.review.group_by([field], count=True, where=where)
    items = [
        {"value": group[field], "count": group["_count"]["_all"]}
        for group in groups
    ]
    items.sort(key=lambda item: item["count"], reverse=True)
    return items


async def get_dashboard() -> dict:
    """Dashboard'daki tüm agregasyonları tek sözlükte toplar.

    Sorgular bağımsız olduğundan asyncio.gather ile eşzamanlı yürütülür.
    """
    (
        total_reviews,
        countries,
        family_countries,
        languages,
        sentiments,
        traveler_types,
    ) = await asyncio.gather(
        db.review.count(),
        _grouped_counts("country"),
        _grouped_counts(
            "country", extra_where={"travelerType": TravelerType.FAMILY.value}
        ),
        _grouped_counts("language"),
        _grouped_counts("sentimentLabel"),
        _grouped_counts("travelerType"),
    )

    return {
        "total_reviews": total_reviews,
        # En çok yorum yapan ilk 10 ülke (COUNT, azalan, LIMIT 10).
        "top_countries": countries[:TOP_COUNTRIES_LIMIT],
        # En fazla Family müşterisi gönderen ülke (yoksa null).
        "top_family_country": family_countries[0] if family_countries else None,
        # En sık kullanılan dil (yoksa null).
        "most_common_language": languages[0] if languages else None,
        "sentiment_distribution": sentiments,
        "traveler_type_distribution": traveler_types,
    }
