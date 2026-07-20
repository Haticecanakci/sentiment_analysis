# Otel Yorumları Dil ve Duygu Analizi — Backend

Yüklenen otel yorumlarını analiz ederek her yorum için **dil**, **ülke (dilden
türetilmiş)**, **seyahat tipi**, **duygu etiketi**, **kısa özet** ve **anahtar
kelimeleri** çıkaran; sonuçları PostgreSQL'de saklayan ve admin dashboard'una
veri sağlayan backend API. Frontend kapsam dışıdır.

## Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| Dil / Framework | Python 3.11+, FastAPI, uvicorn |
| ORM | Prisma (`prisma-client-py`, asyncio) — saf SQL yok |
| Veritabanı | PostgreSQL |
| Dil tespiti | `langdetect` (deterministik, AI yok) |
| Zenginleştirme | Google Gemini — structured output (JSON modu) |
| CSV | Standart `csv` modülü |

## Mimari

Akış tek yönlüdür: `Router (HTTP) → Service (iş mantığı) → Prisma (veri)`.
Router'lar incedir; tüm iş mantığı `app/services/` altındadır. Ortak
enum/sabitler `app/core/constants.py`'de tek yerde tutulur. Her dosya
≤250 satırdır (RULES.md).

```
backend/
├── app/
│   ├── main.py            # FastAPI app, lifespan, /health
│   ├── config.py          # Ayarlar (env'den)
│   ├── database.py        # Prisma singleton + connect/disconnect
│   ├── routers/           # reviews.py, dashboard.py
│   ├── services/          # csv, language, gemini, enrichment, review, dashboard
│   ├── schemas/           # Pydantic yanıt modelleri
│   └── core/              # constants.py, exceptions.py
├── prisma/schema.prisma
├── requirements.txt
└── .env.example
```

## Kurulum

Gereksinimler: Python 3.11+, çalışan bir PostgreSQL, Gemini API anahtarı.

```bash
cd backend

# 1) Sanal ortam + bağımlılıklar
python -m venv .venv
.venv\Scripts\activate          # Windows  (Linux/macOS: source .venv/bin/activate)
pip install -r requirements.txt

# 2) Ortam değişkenleri
copy .env.example .env          # Linux/macOS: cp
# .env içinde DATABASE_URL ve GEMINI_API_KEY değerlerini doldurun

# 3) Veritabanı (PostgreSQL'de boş bir veritabanı oluşturun, örn. hotel_reviews)
prisma generate                 # Python client'ı üretir
prisma db push                  # Şemayı veritabanına uygular

# 4) Çalıştır
uvicorn app.main:app --reload
```

Doğrulama: `http://127.0.0.1:8000/health` → `{"status":"ok","database":"connected"}`.
Etkileşimli dokümantasyon: `http://127.0.0.1:8000/docs`.

> **Not:** `prisma/schema.prisma` her değiştiğinde `prisma generate`
> (ve şemayı DB'ye yansıtmak için `prisma db push`) yeniden çalıştırılmalıdır.

> **Windows notu:** Proje yolu Türkçe karakter içeriyorsa (örn. "Masaüstü"),
> `prisma generate` çalıştırmadan önce PowerShell'de `$env:PYTHONUTF8 = "1"`
> ayarlanmalıdır; aksi halde üretilen client dosyaları bozuk adlı bir klasöre
> yazılır ve uygulama "Client hasn't been generated yet" hatası verir.

## API Endpoint'leri

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/health` | Sağlık kontrolü (DB bağlantısı dahil) |
| POST | `/reviews/import` | CSV yükler, pipeline'ı çalıştırır, özet döner |
| GET | `/reviews` | Listeleme — filtre/arama/sayfalama |
| GET | `/reviews/{id}` | Tek yorum detayı (otel + anahtar kelimeler) |
| GET | `/reviews/filters` | Dropdown'lar için distinct değerler |
| GET | `/dashboard` | Tüm agregasyonlar tek yanıtta |

`GET /reviews` parametreleri: `country` (ISO kodu, örn. `DE`), `traveler_type`,
`sentiment_label`, `language`, `search`, `date_range`, `sort`, `page`,
`page_size` (en fazla 100).

`date_range` göreli tarih filtresidir; `review_date` alanına uygulanır ve tek
bir değer alır: `1w` (son 1 hafta), `1m` (son 1 ay), `3m` (son 3 ay), `6m`
(son 6 ay), `1y` (son 1 yıl). Ay/yıl sabit gün sayısıyla yaklaşıklanır
(30/365 gün); `review_date` değeri olmayan kayıtlar filtre uygulanınca elenir.

`sort` tarihe göre sıralamadır: `date_desc` (yeniden eskiye) veya `date_asc`
(eskiden yeniye); verilmezse en son eklenen kayıt üstte gelir. Sıralama ve
sayfalama DB'de yapılır (ORDER BY + LIMIT/OFFSET, `review_date` index'li);
aynı tarihli kayıtlarda `id` eşitlik bozucudur. `review_date` değeri olmayan
kayıtlar sıralamadan elenmez, listenin bir ucunda toplanır.

Örnek import:

```bash
curl -X POST http://127.0.0.1:8000/reviews/import \
  -F "file=@ilk_500_yorum.csv"
```

## CSV Formatı ve Import Davranışı

Beklenen sütunlar: `review_id, kategori, altkategori_full, sentiment, text, date`
(zorunlu olanlar: `review_id`, `text`).

- **Tekilleştirme:** Aynı `review_id` dosyada kategori başına tekrar ettiği
  için satırlar `review_id` ile tekilleştirilir (ilk satır esas alınır);
  her benzersiz yorum Gemini'ye bir kez gider.
- **Yok sayılan sütunlar:** `kategori`/`altkategori_full` şema kapsamı
  dışındadır. CSV'deki `sentiment` sütunu kategori (aspect) bazlı etiketlendiği
  ve aynı yorum için çelişkili değerler içerdiği için kullanılmaz; duygu
  etiketi yorumun bütününden Gemini ile üretilir.
- **Tarih:** İsteğe bağlı `date` sütunu (`YYYY-MM-DD`) `Review.review_date`
  alanına yazılır; `date_range` filtresi bu alan üzerinden çalışır. Sütun
  yoksa, hücre boşsa veya biçim bozuksa alan null kalır (bozuk biçim satırı
  düşürmez, uyarı loglanır).
- **Otel:** CSV otel bilgisi içermediğinden tüm yorumlar, alanları null olan
  tek bir varsayılan Hotel kaydına bağlanır (yoksa otomatik oluşturulur).
- **Hata izolasyonu:** Tek bir yorumdaki hata import'u çökertmez, ama iki
  farklı durum ayrı ele alınır:
  - **Dil/ülke tespit edilemedi:** `country` şemada NOT NULL olduğundan
    `"UNKNOWN"` yer tutucusuyla kaydedilir; bu Gemini'nin başarısıyla
    ilgisizdir, satırı engellemez.
  - **Gemini zenginleştirmesi başarısız** (`traveler_type`/`sentiment_label`/
    `summary` üretilemedi): satır DB'ye hiç yazılmaz, hata loglanır ve
    `enrichment_failed` sayacına eklenir; işlem diğer satırlarla devam eder.
- **Özet yanıtı:** `total_rows`, `imported`, `skipped`, `duplicates`,
  `enrichment_failed` sayaçları döner. `enrichment_failed`, zenginleştirmesi
  başarısız olduğu için DB'ye hiç yazılmayan yorum sayısıdır (`imported`'a
  dahil değildir).

## Teknik Seçimler ve Gerekçeleri

### Dil tespiti — `langdetect`
Google'ın dil tespit algoritmasının n-gram tabanlı portu; yorum uzunluğundaki
metinlerde 55 dilde yüksek doğruluk verir, offline/ücretsiz çalışır. Bu adımda
LLM kullanmak gereksiz maliyet ve belirlenimsizlik getirirdi. Kütüphane
varsayılan olarak deterministik olmadığından `DetectorFactory.seed = 0`
ayarlanır; çok kısa/tespit edilemeyen metinler hata yerine `"unknown"` alır.

### Ülke türetimi — sabit sözlük (kütüphane yok)
`Review.country`, tespit edilen dilden türetilir ve **ISO 3166-1 alpha-2**
kodu olarak saklanır. langdetect'in çıktı kümesi kapalı (55 kod) olduğundan
eşleme `constants.py`'de tek bir sözlükle eksiksiz tanımlanır. `langcodes`
gibi CLDR tabanlı bir kütüphane de dil→ülke tahmini yapabilirdi; ancak çok
ülkeli dillerdeki seçimleri (örn. en→US) kontrolümüz dışında kalır ve +2
bağımlılık getirir. Sözlükte seçimler görünür ve gerekçelendirilebilirdir.
**Varsayım:** dil→ülke eşlemesi sezgiseldir; çok ülkeli dillerde dilin ana
ülkesi seçilmiştir (en→GB, es→ES, ar→SA). Eşleme dışı/`unknown` dil → null.

### Gemini zenginleştirme — tek çağrı, JSON modu (structured output)
`traveler_type`, `sentiment_label`, `summary` ve `keywords` **tek** Gemini
çağrısında üretilir (yorum başına tek istek → maliyet ve gecikme düşer).
Amaç dış bir fonksiyon çalıştırmak değil yapısal veri geri almak olduğundan
function calling yerine `response_schema` (JSON modu) seçildi: şema Pydantic
modelinden zorlanır, yanıt garantili şemaya uyar, ara adım gerekmez.
Enum değerleri `constants.py`'den şemaya dayatılır; `temperature=0` ile
tekrarlanabilirlik artırılır.

### Seyahat tipi — LLM sınıflandırması + dayatılmış enum
Sinyal örtük ve çok dillidir ("eşimle ve çocuklarla" → Family); kural/anahtar
kelime tabanlı eşleme 50+ dilde kırılgandır. Enum şema ile dayatıldığından
model liste dışına çıkamaz; belirsiz durumda prompt açıkça `Unknown`'a
yönlendirir. Boş/geçersiz çıktıda güvenli varsayılan (null) kullanılır.

### Anahtar kelimeler — aynı Gemini çağrısında
TF-IDF/RAKE gibi istatistiksel yöntemler tek belge üzerinde ve çok dilli
veride zayıf kalır (TF-IDF anlamlı olmak için korpus ister, RAKE dil bazlı
stopword listesine muhtaçtır). Zaten yapılan zenginleştirme çağrısına keyword
alanı eklemek ek istek maliyeti getirmez. Kelimeler küçük harfe indirilip
tekilleştirilir (`keywords.word` sütunu unique'tir), yorum başına en fazla 5
anahtar kelime saklanır ve `review_keywords` ilişki tablosuyla bağlanır.

### Eşzamanlılık ve hata yönetimi
Import'ta yavaş/maliyetli adım Gemini'dir: analiz aşaması
`asyncio.Semaphore(GEMINI_MAX_CONCURRENCY)` ile sınırlı eşzamanlı yürütülür;
senkron langdetect `asyncio.to_thread` ile event loop dışında çalışır.
DB yazımı hızlı olduğundan ve keyword upsert'lerinde yarış koşulunu önlemek
için sıralıdır. Dashboard'daki bağımsız `group_by` sorguları `asyncio.gather`
ile paralel çalışır ve tek endpoint'ten döner (tek round-trip).

## PROJECT.md'den Bilinçli Sapmalar

- `Review.sentimentScore` ve `ReviewKeyword.score` alanları kaldırıldı
  (karar: proje sahibi); dashboard'daki "ortalama sentiment_score" metriği
  bu nedenle kapsam dışıdır.
- Gerçek CSV otel bilgisi içermediğinden `Hotel` alanları nullable yapıldı ve
  tüm yorumlar tek varsayılan otele bağlanır; ülke analizi `Hotel.country`
  yerine dilden türetilen `Review.country` üzerinden yapılır.
- CSV formatı belgedeki varsayımsal formata değil gerçek dosyaya
  (`review_id, kategori, altkategori_full, sentiment, text`) uyarlandı.
- `pandas` yerine standart `csv` modülü kullanıldı: satır bazlı okuma ve
  doğrulama için yeterli, ek bağımlılık ve NaN tip sürprizleri yok.
