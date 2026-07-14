"""/dashboard endpoint'inin Pydantic yanıt modelleri (RULES.md §7)."""

from pydantic import BaseModel


class CountItem(BaseModel):
    """Gruplu sayım sonucu: değer + kayıt sayısı."""

    value: str
    count: int


class DashboardResponse(BaseModel):
    """Tüm dashboard agregasyonlarını tek yanıtta toplar (PROJECT.md §7)."""

    total_reviews: int
    top_countries: list[CountItem]
    top_family_country: CountItem | None
    most_common_language: CountItem | None
    sentiment_distribution: list[CountItem]
    traveler_type_distribution: list[CountItem]
