"""Özel hata sınıfları (RULES.md §6).

Router katmanı bu hataları yakalayıp uygun HTTP kodlarına çevirir:
CsvValidationError → 400, ReviewNotFoundError → 404, diğerleri → 500.
"""


class AppError(Exception):
    """Uygulamaya özgü tüm hataların temel sınıfı."""

    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


class CsvValidationError(AppError):
    """CSV dosyası okunamadı veya zorunlu sütunlar eksik (HTTP 400)."""


class ReviewNotFoundError(AppError):
    """İstenen yorum veritabanında bulunamadı (HTTP 404)."""

    def __init__(self, review_id: int) -> None:
        self.review_id = review_id
        super().__init__(f"Yorum bulunamadi: id={review_id}")


class EnrichmentError(AppError):
    """Gemini zenginleştirme çağrısı başarısız oldu.

    Import pipeline'ında yakalanır ve loglanır; yorum yine kaydedilir,
    zenginleştirme alanları null kalır (import çökmez, RULES.md §6).
    """
