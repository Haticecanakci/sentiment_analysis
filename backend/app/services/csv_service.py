"""CSV import pipeline orkestrasyonu (PROJECT.md §5).

Kaynak CSV formatı: review_id, kategori, altkategori_full, sentiment, text
ve isteğe bağlı date (YYYY-MM-DD, Review.reviewDate'e yazılır).
Aynı review_id birden çok satırda (kategori başına) tekrar ettiğinden satırlar
review_id ile TEKİLLEŞTİRİLİR; kategori ve CSV'deki sentiment sütunu yok
sayılır (duygu etiketi yorumun bütününden Gemini ile üretilir).

CSV'de otel bilgisi bulunmadığından tüm yorumlar tek bir varsayılan otel
kaydına bağlanır (alanları null olan ilk Hotel satırı; yoksa oluşturulur).

Akış: parse + tekilleştirme → varsayılan otel → dil tespiti + Gemini
zenginleştirme (asyncio.Semaphore ile sınırlı eşzamanlılık) → sıralı DB
yazımı. Yavaş/maliyetli adım Gemini olduğundan yalnızca analiz aşaması
eşzamanlı yürütülür; DB yazımı hızlıdır ve keyword upsert'lerinde yarış
koşulunu önlemek için sıralı yapılır. Tek bir satırın hatası import'u
durdurmaz (RULES.md §6).
"""

import asyncio
import csv
import io
import logging
from dataclasses import dataclass
from datetime import datetime, timezone

from app.config import get_settings
from app.core.constants import CSV_REQUIRED_COLUMNS
from app.core.exceptions import CsvValidationError
from app.database import db
from app.services import gemini_service
from app.services.enrichment_service import EnrichmentResult, enrich_review
from app.services.language_service import country_from_language, detect_language

logger = logging.getLogger(__name__)


@dataclass
class ParsedRow:
    """CSV'den doğrulanarak okunmuş, tekilleştirilmiş tek yorum."""

    review_id: str
    review_text: str
    review_date: datetime | None = None


def _parse_review_date(raw: str | None, line_no: int) -> datetime | None:
    """İsteğe bağlı date hücresini (YYYY-MM-DD) UTC datetime'a çevirir.

    Boş/eksik değer sessizce None döner (kolon isteğe bağlı); biçimi bozuk
    değer satırı düşürmez, uyarı loglanıp None döner (RULES.md §6).
    """
    value = (raw or "").strip()
    if not value:
        return None
    try:
        parsed = datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        logger.warning(
            "Satir %d: 'date' degeri cozumlenemedi (%r), null birakildi.",
            line_no,
            value,
        )
        return None
    return parsed.replace(tzinfo=timezone.utc)


@dataclass
class ImportSummary:
    """Import sonunda router'a dönen özet sayaçları."""

    total_rows: int = 0
    imported: int = 0
    skipped: int = 0
    duplicates: int = 0
    enrichment_failed: int = 0


def parse_csv(content: bytes) -> tuple[list[ParsedRow], int, int]:
    """CSV'yi çözümler; (benzersiz satırlar, atlanan, tekrar sayısı) döner.

    Dosya düzeyi hatalarda (bozuk encoding, eksik başlık/sütun)
    CsvValidationError fırlatır; satır düzeyi eksikliklerde satırı atlayıp
    loglar. Aynı review_id'nin ilk görülen satırı esas alınır.
    """
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise CsvValidationError("CSV dosyasi UTF-8 olarak okunamadi.") from exc

    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise CsvValidationError("CSV bos veya baslik satiri icermiyor.")
    missing = [c for c in CSV_REQUIRED_COLUMNS if c not in reader.fieldnames]
    if missing:
        raise CsvValidationError(
            f"CSV'de zorunlu sutunlar eksik: {', '.join(missing)}"
        )

    rows: list[ParsedRow] = []
    seen_ids: set[str] = set()
    skipped = 0
    duplicates = 0
    # start=2: 1. satır başlık; log mesajları dosyadaki gerçek satırı göstersin.
    for line_no, raw in enumerate(reader, start=2):
        review_id = (raw.get("review_id") or "").strip()
        review_text = (raw.get("text") or "").strip()
        if not review_id or not review_text:
            logger.warning("Satir %d atlandi: review_id/text bos.", line_no)
            skipped += 1
            continue
        if review_id in seen_ids:
            duplicates += 1
            continue
        seen_ids.add(review_id)
        rows.append(
            ParsedRow(
                review_id=review_id,
                review_text=review_text,
                review_date=_parse_review_date(raw.get("date"), line_no),
            )
        )
    return rows, skipped, duplicates


async def _get_default_hotel_id() -> int:
    """Tüm yorumların bağlanacağı varsayılan otelin id'sini döndürür.

    CSV otel bilgisi içermediğinden alanları null tek bir Hotel satırı
    kullanılır: en düşük id'li kayıt (taze veritabanında id=1); hiç yoksa
    boş bir kayıt oluşturulur.
    """
    hotel = await db.hotel.find_first(order={"id": "asc"})
    if hotel is None:
        hotel = await db.hotel.create(data={})
    return hotel.id


async def _analyze_row(
    row: ParsedRow, semaphore: asyncio.Semaphore
) -> tuple[str, str | None, EnrichmentResult]:
    """Tek yorum için dil tespiti + ülke türetme + Gemini zenginleştirme.

    langdetect senkron olduğundan event loop'u kilitlememesi için
    asyncio.to_thread ile çalıştırılır (RULES.md §4). Ülke, tespit edilen
    dilden ISO 3166-1 alpha-2 kodu olarak türetilir.
    """
    async with semaphore:
        language = await asyncio.to_thread(detect_language, row.review_text)
        country = country_from_language(language)
        enrichment = await enrich_review(row.review_text)
        return language, country, enrichment


async def _save_review(
    row: ParsedRow,
    hotel_id: int,
    language: str | None,
    country: str | None,
    enrichment: EnrichmentResult,
) -> None:
    """Review satırını ve keyword ilişkilerini yazar."""
    review = await db.review.create(
        data={
            "hotelId": hotel_id,
            "reviewText": row.review_text,
            "language": language,
            "country": country,
            "travelerType": enrichment.traveler_type,
            "sentimentLabel": enrichment.sentiment_label,
            "summary": enrichment.summary,
            "reviewDate": row.review_date,
        }
    )
    for word in enrichment.keywords:
        keyword = await db.keyword.upsert(
            where={"word": word},
            data={"create": {"word": word}, "update": {}},
        )
        await db.reviewkeyword.create(
            data={"reviewId": review.id, "keywordId": keyword.id}
        )


async def import_csv(content: bytes) -> ImportSummary:
    """CSV import'unun ana giriş noktası; pipeline'ı uçtan uca yürütür."""
    rows, skipped, duplicates = parse_csv(content)
    summary = ImportSummary(
        total_rows=len(rows) + skipped + duplicates,
        skipped=skipped,
        duplicates=duplicates,
    )
    if not rows:
        return summary

    hotel_id = await _get_default_hotel_id()

    # Token sayaçları import başına tutulur: başta sıfırla, analiz bitince
    # input/output/toplam token özetini terminale yaz.
    gemini_service.reset_usage_totals()
    semaphore = asyncio.Semaphore(get_settings().gemini_max_concurrency)
    results = await asyncio.gather(
        *(_analyze_row(row, semaphore) for row in rows), return_exceptions=True
    )
    gemini_service.log_usage_totals()

    for row, result in zip(rows, results):
        if isinstance(result, BaseException):
            # Beklenmeyen analiz hatası: yorum yine kaydedilir, alanlar null.
            logger.error("Satir analizi basarisiz (%s): %s", row.review_id, result)
            language, country, enrichment = None, None, EnrichmentResult()
        else:
            language, country, enrichment = result

        try:
            await _save_review(row, hotel_id, language, country, enrichment)
        except Exception:
            logger.exception("Yorum kaydedilemedi, atlandi: %s", row.review_id)
            summary.skipped += 1
            continue

        summary.imported += 1
        # sentiment_label başarılı zenginleştirmede her zaman dolu gelir;
        # None ise Gemini adımı bu yorum için başarısız olmuş demektir.
        if enrichment.sentiment_label is None:
            summary.enrichment_failed += 1

    return summary
