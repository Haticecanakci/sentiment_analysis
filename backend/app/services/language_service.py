"""Dil tespiti — yalnızca langdetect, AI/LLM kullanılmaz (RULES.md §9).

langdetect varsayılan olarak deterministik değildir; aynı metin için farklı
sonuç dönebilir. Tekrarlanabilirlik için modül yüklenirken
`DetectorFactory.seed = 0` ayarlanır.
"""

import logging

from langdetect import DetectorFactory, LangDetectException, detect

from app.core.constants import LANGUAGE_TO_COUNTRY, UNKNOWN_LANGUAGE

logger = logging.getLogger(__name__)

DetectorFactory.seed = 0

# Bu uzunluğun altındaki metinlerde n-gram istatistikleri güvenilir sinyal
# veremez; hiç denemeden "unknown" işaretlenir.
MIN_TEXT_LENGTH: int = 3


def detect_language(text: str | None) -> str:
    """Metnin dilini ISO 639-1 kodu olarak döndürür (ör. "en", "tr").

    Boş, çok kısa veya tespit edilemeyen metinlerde hata fırlatmak yerine
    "unknown" döner; import pipeline'ı tek bir yorum yüzünden durmaz.
    """
    if text is None:
        return UNKNOWN_LANGUAGE

    cleaned = text.strip()
    if len(cleaned) < MIN_TEXT_LENGTH:
        return UNKNOWN_LANGUAGE

    try:
        return detect(cleaned)
    except LangDetectException as exc:
        logger.warning("Dil tespit edilemedi, 'unknown' isaretlendi: %s", exc)
        return UNKNOWN_LANGUAGE


def country_from_language(language: str | None) -> str | None:
    """Dil kodundan ISO 3166-1 alpha-2 ülke kodu türetir.

    Eşleme constants.py'deki sabit LANGUAGE_TO_COUNTRY sözlüğünden gelir;
    eşleme dışı veya "unknown" dilde null döner (heuristik varsayım,
    README'de belgelenir).
    """
    if language is None:
        return None
    return LANGUAGE_TO_COUNTRY.get(language)
