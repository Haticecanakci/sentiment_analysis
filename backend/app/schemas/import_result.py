"""/reviews/import yanıt modeli (RULES.md §7).

Alan adları csv_service.ImportSummary dataclass'ı ile birebir aynıdır;
dönüşüm `model_validate(..., from_attributes=True)` ile yapılır.
"""

from pydantic import BaseModel, ConfigDict


class ImportResultResponse(BaseModel):
    """CSV import özeti."""

    model_config = ConfigDict(from_attributes=True)

    total_rows: int
    imported: int
    skipped: int
    duplicates: int
    enrichment_failed: int
