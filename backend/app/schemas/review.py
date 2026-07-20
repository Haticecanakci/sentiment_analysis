"""/reviews endpoint'lerinin Pydantic yanıt modelleri (RULES.md §7).

Prisma model alanları camelCase, API yanıtları snake_case olduğundan
dönüşüm `from_model` sınıf metodlarında tek yerde, açıkça yapılır.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from pydantic import BaseModel

if TYPE_CHECKING:
    from prisma.models import Review


class HotelOut(BaseModel):
    """Yorum detayındaki otel bilgisi (alanlar şemada nullable)."""

    id: int
    name: str | None
    country: str | None
    city: str | None


class ReviewListItem(BaseModel):
    """Liste görünümündeki tek yorum."""

    id: int
    review_text: str
    language: str | None
    country: str | None
    traveler_type: str | None
    sentiment_label: str | None
    summary: str | None
    review_date: datetime | None
    created_at: datetime

    @classmethod
    def from_model(cls, review: Review) -> ReviewListItem:
        return cls(
            id=review.id,
            review_text=review.reviewText,
            language=review.language,
            country=review.country,
            traveler_type=review.travelerType,
            sentiment_label=review.sentimentLabel,
            summary=review.summary,
            review_date=review.reviewDate,
            created_at=review.createdAt,
        )


class ReviewDetail(ReviewListItem):
    """Tek yorum detayı: liste alanları + otel + anahtar kelimeler."""

    hotel: HotelOut | None = None
    keywords: list[str] = []

    @classmethod
    def from_model(cls, review: Review) -> ReviewDetail:
        base = ReviewListItem.from_model(review)
        hotel = None
        if review.hotel is not None:
            hotel = HotelOut(
                id=review.hotel.id,
                name=review.hotel.name,
                country=review.hotel.country,
                city=review.hotel.city,
            )
        keywords = [
            link.keyword.word
            for link in (review.keywords or [])
            if link.keyword is not None
        ]
        return cls(**base.model_dump(), hotel=hotel, keywords=keywords)


class ReviewListResponse(BaseModel):
    """Sayfalı yorum listesi yanıtı."""

    items: list[ReviewListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class FilterOptionsResponse(BaseModel):
    """Filtre dropdown'ları için distinct değerler.

    date_ranges ve sort_orders veriden değil sabit seçenek listelerinden
    gelir (DateRange: 1w, 1m, 3m, 6m, 1y — SortOrder: date_desc, date_asc).
    """

    countries: list[str]
    languages: list[str]
    traveler_types: list[str]
    sentiment_labels: list[str]
    date_ranges: list[str]
    sort_orders: list[str]
