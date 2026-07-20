"""Ortak sabitler ve enum'lar — tek yerde tanımlanır, kopyalanmaz (RULES.md §1).

Bu değerler hem Pydantic şemalarında hem de Gemini yapısal çıktı şemasında
kullanılır; Gemini'ye enum listeleri buradan dayatılır (PROJECT.md §6).
"""

from enum import StrEnum


class TravelerType(StrEnum):
    """Seyahat tipi kategorileri. Belirsiz durumda UNKNOWN kullanılır."""

    BUSINESS = "Business"
    FAMILY = "Family"
    COUPLE = "Couple"
    SOLO = "Solo"
    FRIENDS = "Friends"
    LUXURY = "Luxury"
    BUDGET = "Budget"
    UNKNOWN = "Unknown"


class SentimentLabel(StrEnum):
    """Duygu analizi etiketleri (PROJECT.md §6)."""

    POZITIF = "Pozitif"
    NEGATIF = "Negatif"
    NOTR = "Nötr"


class SortOrder(StrEnum):
    """Yorum listesi sıralama seçenekleri (`GET /reviews` `sort` parametresi)."""

    DATE_DESC = "date_desc"  # yeniden eskiye
    DATE_ASC = "date_asc"  # eskiden yeniye


class ChatAction(StrEnum):
    """Sohbet yanıtının frontend'e söylediği eylem türü.

    Gemini'ye tanımlanan `import_csv` fonksiyonu çağrılırsa IMPORT_CSV
    döner; frontend bunu görünce mevcut CSVImportModal'ı açar (gemini_service.py).
    """

    CHAT = "chat"
    IMPORT_CSV = "import_csv"


class DateRange(StrEnum):
    """Göreli tarih filtresi seçenekleri (`GET /reviews` `date_range` parametresi)."""

    LAST_WEEK = "1w"
    LAST_MONTH = "1m"
    LAST_3_MONTHS = "3m"
    LAST_6_MONTHS = "6m"
    LAST_YEAR = "1y"


# Göreli aralıkların gün karşılıkları; ay/yıl sabit gün sayısıyla
# yaklaşıklanır (30/365), takvim ayı hesabı yapılmaz.
DATE_RANGE_DAYS: dict[DateRange, int] = {
    DateRange.LAST_WEEK: 7,
    DateRange.LAST_MONTH: 30,
    DateRange.LAST_3_MONTHS: 90,
    DateRange.LAST_6_MONTHS: 180,
    DateRange.LAST_YEAR: 365,
}


# Gemini şemasına ve doğrulamalara verilecek düz değer listeleri.
TRAVELER_TYPE_VALUES: list[str] = [t.value for t in TravelerType]
SENTIMENT_LABEL_VALUES: list[str] = [s.value for s in SentimentLabel]
DATE_RANGE_VALUES: list[str] = [d.value for d in DateRange]
SORT_ORDER_VALUES: list[str] = [s.value for s in SortOrder]

# Dil tespit edilemediğinde kullanılacak değer (RULES.md §9).
UNKNOWN_LANGUAGE: str = "unknown"

# Dil "unknown" veya eşleme dışıysa country_from_language None döner; ülke
# şemada NOT NULL olduğundan bu tek başına satırı engellemez, yalnızca bu
# sabit yer tutucuyla kaydedilir (Gemini zenginleştirmesiyle ilgisizdir).
UNKNOWN_COUNTRY: str = "UNKNOWN"

# langdetect dil kodu → ISO 3166-1 alpha-2 ülke kodu eşlemesi.
# langdetect'in çıktı kümesi kapalıdır (55 dil); tamamı burada eşlenir.
# Çok ülkeli dillerde dilin ana ülkesi seçilmiştir (heuristik bir
# varsayımdır, README'de belgelenir). Eşleme dışı/unknown dil → country null.
LANGUAGE_TO_COUNTRY: dict[str, str] = {
    "af": "ZA", "ar": "SA", "bg": "BG", "bn": "BD", "ca": "ES",
    "cs": "CZ", "cy": "GB", "da": "DK", "de": "DE", "el": "GR",
    "en": "GB", "es": "ES", "et": "EE", "fa": "IR", "fi": "FI",
    "fr": "FR", "gu": "IN", "he": "IL", "hi": "IN", "hr": "HR",
    "hu": "HU", "id": "ID", "it": "IT", "ja": "JP", "kn": "IN",
    "ko": "KR", "lt": "LT", "lv": "LV", "mk": "MK", "ml": "IN",
    "mr": "IN", "ne": "NP", "nl": "NL", "no": "NO", "pa": "IN",
    "pl": "PL", "pt": "PT", "ro": "RO", "ru": "RU", "sk": "SK",
    "sl": "SI", "so": "SO", "sq": "AL", "sv": "SE", "sw": "TZ",
    "ta": "IN", "te": "IN", "th": "TH", "tl": "PH", "tr": "TR",
    "uk": "UA", "ur": "PK", "vi": "VN", "zh-cn": "CN", "zh-tw": "TW",
}

# CSV'de beklenen zorunlu sütunlar (csv_service doğrulaması için).
# Kaynak dosya formatı: review_id, kategori, altkategori_full, sentiment, text
# — kategori/altkategori_full/sentiment sütunları bilinçli olarak yok sayılır
# (sentiment Gemini'den üretilir, kategoriler şema kapsamı dışında).
CSV_REQUIRED_COLUMNS: list[str] = [
    "review_id",
    "text",
]
