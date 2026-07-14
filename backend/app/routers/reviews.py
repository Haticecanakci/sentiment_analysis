"""/reviews endpoint'leri — ince router: doğrulama + servis çağrısı + yanıt
(RULES.md §1-2). İş mantığı service katmanındadır; bilinen hatalar burada
uygun HTTP kodlarına çevrilir (RULES.md §6).
"""

from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from app.core.exceptions import CsvValidationError, ReviewNotFoundError
from app.schemas.import_result import ImportResultResponse
from app.schemas.review import (
    FilterOptionsResponse,
    ReviewDetail,
    ReviewListItem,
    ReviewListResponse,
)
from app.services import csv_service, review_service

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.post("/import", response_model=ImportResultResponse)
async def import_reviews(file: UploadFile = File(...)) -> ImportResultResponse:
    """CSV dosyasını yükler, import pipeline'ını çalıştırır, özet döner."""
    if file.filename and not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400, detail="Yalnizca .csv uzantili dosya kabul edilir."
        )
    content = await file.read()
    try:
        summary = await csv_service.import_csv(content)
    except CsvValidationError as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc
    return ImportResultResponse.model_validate(summary)


@router.get("", response_model=ReviewListResponse)
async def list_reviews(
    country: str | None = Query(default=None, description="ISO 3166-1 alpha-2"),
    traveler_type: str | None = None,
    sentiment_label: str | None = None,
    language: str | None = None,
    search: str | None = Query(default=None, description="Yorum metninde arama"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(
        default=review_service.DEFAULT_PAGE_SIZE,
        ge=1,
        le=review_service.MAX_PAGE_SIZE,
    ),
) -> ReviewListResponse:
    """Yorumları filtreleme, arama ve sayfalama ile listeler."""
    items, total = await review_service.list_reviews(
        country=country,
        traveler_type=traveler_type,
        sentiment_label=sentiment_label,
        language=language,
        search=search,
        page=page,
        page_size=page_size,
    )
    total_pages = (total + page_size - 1) // page_size
    return ReviewListResponse(
        items=[ReviewListItem.from_model(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


# NOT: /filters, /{review_id}'den ONCE tanimlanmali; aksi halde "filters"
# path parametresi olarak int'e cevrilmeye calisilir ve 422 doner.
@router.get("/filters", response_model=FilterOptionsResponse)
async def get_filter_options() -> FilterOptionsResponse:
    """Filtre dropdown'ları için distinct değerleri döndürür."""
    return FilterOptionsResponse(**await review_service.get_filter_options())


@router.get("/{review_id}", response_model=ReviewDetail)
async def get_review(review_id: int) -> ReviewDetail:
    """Tek yorumun detayını (otel + anahtar kelimeler) döndürür."""
    try:
        review = await review_service.get_review(review_id)
    except ReviewNotFoundError as exc:
        raise HTTPException(status_code=404, detail=exc.message) from exc
    return ReviewDetail.from_model(review)
