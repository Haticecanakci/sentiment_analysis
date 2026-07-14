# Genel Kurallar & Kodlama Standartları

> Bu dosya, kodu üreten yapay zekâ aracının **her zaman** uyması gereken kuralları içerir. PROJECT.md "ne" yapılacağını, bu dosya "nasıl" yapılacağını tanımlar.

---

## 1. Dosya ve Modül Kuralları (ZORUNLU)

- **Her dosya en fazla 250 satırdır.** Aşan dosya mantıksal olarak bölünür.
- **Tek Sorumluluk (SRP):** her modül tek bir işi yapar. CSV işleyen dosya dil tespiti yapmaz; router iş mantığı barındırmaz.
- İş mantığı **service** katmanında toplanır. Router'lar ince (thin) kalır: doğrulama + servis çağrısı + yanıt.
- Ortak sabitler (enum'lar, kategori listeleri) `core/constants.py` içinde tek yerde tutulur; kopyalanmaz.

---

## 2. Katmanlı Mimari

- Akış tek yönlüdür: `Router → Service → Prisma`. Router doğrudan Prisma çağırmaz; Service doğrudan HTTP nesnesi (Request/Response) tutmaz.
- Servisler birbirini çağırabilir (ör. `csv_service` → `language_service` + `enrichment_service`), ama döngüsel bağımlılık oluşturulmaz.

---

## 3. Prisma Kullanımı

- **Saf SQL yazılmaz.** Tüm veri erişimi Prisma üzerinden yapılır.
- Tek bir Prisma client örneği kullanılır (singleton, `database.py`).
- Bağlantı FastAPI **lifespan** içinde açılır/kapanır (`connect` / `disconnect`).
- `db.query_raw()` yalnızca Prisma'nın ifade edemediği agregasyonlar için, kod içinde **yorumla gerekçelendirilerek** kullanılır.
- Şema değişince `prisma generate` çalıştırılması gerektiği README'de belirtilir.

---

## 4. Async Kuralları

- Prisma Python asyncio arayüzü kullanılır. Tüm veri erişimi `async/await` ile yapılır.
- Router'lar `async def` olur.
- Bloklayan işlemler (uzun CSV işleme) event loop'u kilitlemez; toplu işlem ve `asyncio.Semaphore` ile eşzamanlılık sınırı uygulanır.

---

## 5. Konfigürasyon ve Gizli Bilgiler

- `DATABASE_URL` ve `GEMINI_API_KEY` gibi değerler **koda gömülmez**. `config.py` üzerinden ortam değişkeninden okunur.
- `.env.example` dosyası gerekli tüm değişkenleri örnek değerlerle içerir. Gerçek `.env` commit edilmez.

---

## 6. Hata Yönetimi

- Özel hata sınıfları `core/exceptions.py` içinde tanımlanır.
- Router seviyesinde uygun HTTP kodları döner (400 hatalı CSV, 404 bulunamayan yorum, 500 beklenmeyen).
- **Gemini veya dil tespiti hatası tek bir yorum yüzünden tüm import'u çökertmez.** Hata loglanır, ilgili alanlar `null` bırakılır, işlem devam eder.
- Sessiz `except: pass` yasak. Hatalar loglanır.

---

## 7. Tip ve Doğrulama

- Tüm fonksiyonlarda tip ipuçları (type hints) kullanılır.
- İstek/yanıt gövdeleri **Pydantic** modelleriyle tanımlanır (`schemas/`).
- Endpoint yanıtları serbest `dict` yerine tipli response modelleri döner.

---

## 8. Gemini Servis Kuralları

- Gemini istemcisi ve çağrı mantığı yalnızca `gemini_service.py` içinde yaşar; başka modül doğrudan API'ye erişmez.
- Çıktı şeması (traveler_type, sentiment_label, sentiment_score, summary, keywords) tek yerde tanımlanır ve yapısal çıktı (structured output / function calling) ile zorlanır.
- Prompt **kısa ve direktif** olur. Enum değerleri `constants.py`'den gelir.
- Belirsiz seyahat tipi → `Unknown`. Model boş/geçersiz çıktı verirse güvenli varsayılana düşülür.

---

## 9. Dil Tespiti Kuralları

- Yalnızca `langdetect` kullanılır; **bu adımda yapay zekâ / LLM kullanılmaz.**
- Tekrarlanabilirlik için `DetectorFactory.seed = 0` ayarlanır (langdetect varsayılan olarak deterministik değildir).
- Çok kısa/tespit edilemeyen metinlerde dil `"unknown"` olarak işaretlenir, hata fırlatılmaz.

---

## 10. İsimlendirme

- Python: `snake_case` (dosya, fonksiyon, değişken).
- Pydantic modelleri: `PascalCase`.
- Sabitler: `UPPER_SNAKE_CASE`.
- Veritabanı tablo adları snake_case ve çoğuldur; Prisma'da `@@map` ile eşlenir (PROJECT.md'deki şemada olduğu gibi).

---

## 11. Çalışma Biçimi (yapay zekâ aracı için)

- **Adım adım ilerle.** Hepsini tek seferde üretme: önce şema + config + database, sonra sırayla servisler ve router'lar.
- Her modülü üretirken hangi karar neden alındığını **kısaca açıkla** (belgedeki "teknik karar verme" beklentisi gereği).
- İstenmeyeni yapma: **frontend kodu üretme.**
- 250 satır sınırını her dosyada kontrol et; aşacaksa böl.
- Bir modül tamamlanınca sonrakine geç; büyük tek dosyalar üretme.
