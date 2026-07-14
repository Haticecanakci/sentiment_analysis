# Otel Yorumları Dil ve Duygu Analizi Sistemi — Proje Genel Bakış

> Bu dosya, projeyi kodlayan yapay zekâ aracına (Cursor / Claude Code / Windsurf) **kalıcı bağlam** olarak verilmek üzere yazılmıştır. Kod üretilmeden önce bu dosya okunmalı ve mimariye buradaki kararlar yön vermelidir.

---

## 1. Amaç

Yüklenen otel yorumlarını analiz ederek her yorum için dil, seyahat tipi, duygu analizi, kısa özet ve anahtar kelimeleri çıkaran; sonuçları PostgreSQL'de saklayan ve bir admin dashboard'una veri sağlayan bir **backend API** geliştirmek.

**Bu aşamada yalnızca backend geliştirilecektir. Frontend kapsam dışıdır.**

---

## 2. Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| Dil | Python 3.11+ |
| Web framework | FastAPI |
| ORM | **Prisma** (`prisma-client-py`, asyncio arayüzü) — saf SQL kullanılmayacak |
| Veritabanı | PostgreSQL |
| Dil tespiti | `langdetect` (yapay zekâ **kullanılmayacak**, deterministik) |
| Zenginleştirme (3-4-5 + duygu) | Google **Gemini** — function calling / structured output |
| CSV | `pandas` veya standart `csv` modülü |
| Sunucu | `uvicorn` |

---

## 3. Genel Mimari

Katmanlı mimari. Sorumluluklar net ayrılır:

```
Router (HTTP)  →  Service (iş mantığı)  →  Prisma (veri erişimi)
```

- **Router**: yalnızca istek/yanıt, doğrulama ve servis çağrısı. İş mantığı içermez.
- **Service**: tüm iş mantığı. CSV işleme, dil tespiti, Gemini çağrıları, veritabanı sorguları.
- **Prisma**: tek bir client örneği (singleton), uygulama yaşam döngüsüne bağlı.

---

## 4. Veritabanı Şeması (Prisma)

DBML'den türetilmiş Prisma karşılığı. `prisma/schema.prisma` içine yazılacak:

```prisma
generator client {
  provider             = "prisma-client-py"
  interface            = "asyncio"
  recursive_type_depth = 5
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Hotel {
  id      Int      @id @default(autoincrement())
  name    String
  country String
  city    String
  reviews Review[]

  @@map("hotels")
}

model Review {
  id             Int             @id @default(autoincrement())
  hotelId        Int             @map("hotel_id")
  hotel          Hotel           @relation(fields: [hotelId], references: [id])
  reviewText     String          @map("review_text")
  language       String?
  travelerType   String?         @map("traveler_type")
  sentimentLabel String?         @map("sentiment_label")
  sentimentScore Float?          @map("sentiment_score")
  summary        String?
  reviewDate     DateTime?       @map("review_date") @db.Date
  createdAt      DateTime        @default(now()) @map("created_at")
  keywords       ReviewKeyword[]

  @@index([language])
  @@index([travelerType])
  @@index([sentimentLabel])
  @@map("reviews")
}

model Keyword {
  id      Int             @id @default(autoincrement())
  word    String          @unique
  reviews ReviewKeyword[]

  @@map("keywords")
}

model ReviewKeyword {
  reviewId  Int     @map("review_id")
  keywordId Int     @map("keyword_id")
  score     Float
  review    Review  @relation(fields: [reviewId], references: [id])
  keyword   Keyword @relation(fields: [keywordId], references: [id])

  @@id([reviewId, keywordId])
  @@map("review_keywords")
}
```

> `INDEX` beklentisi Prisma tarafında `@@index` ile karşılanır. Dashboard filtrelerine giren alanlara (language, traveler_type, sentiment_label) indeks konur.

---

## 5. Veri İşleme Hattı (Pipeline)

CSV import edildiğinde her satır için sırayla:

1. **Otel çözümleme** — `name + country + city` ile oteli bul/oluştur (upsert mantığı).
2. **Dil tespiti** — `langdetect` ile `language` alanı. (AI yok, deterministik.)
3. **Gemini zenginleştirme** — tek çağrıda: `traveler_type`, `sentiment_label`, `sentiment_score`, `summary`, `keywords`.
4. **Kayıt** — `reviews` satırı yazılır; anahtar kelimeler `keywords` tablosunda upsert edilir; `review_keywords` ilişkisi skorlarıyla eklenir.

**Verim notu:** Gemini çağrıları maliyetli olduğundan yorumlar mümkünse toplu (batch) işlenmeli veya sınırlı eşzamanlılıkla (`asyncio.Semaphore`) yürütülmelidir. Büyük CSV'lerde import uzun sürebilir; senkron blokla yapılmamalıdır.

---

## 6. Gemini Zenginleştirme Tasarımı (Adım 3, 4, 5 + Duygu)

Projede 3., 4. ve 5. adımlar (seyahat tipi, özet, anahtar kelime) **ve** başlıktaki "Duygu Analizi" tek bir Gemini çağrısında **structured output / function calling** ile çözülür. Amaç dış bir fonksiyonu çalıştırmak değil, **yapısal veri geri almak** olduğu için `response_schema` (JSON modu) tercih edilebilir; function calling da geçerli bir alternatiftir ve gerekçesi README'de açıklanmalıdır.

Beklenen yapısal çıktı şeması:

| Alan | Tip | Açıklama |
|------|-----|----------|
| `traveler_type` | enum | Business, Family, Couple, Solo, Friends, Luxury, Budget, Unknown |
| `sentiment_label` | enum | Pozitif, Negatif, Nötr |
| `sentiment_score` | float | Örn. -1.0 (çok negatif) → 1.0 (çok pozitif) |
| `summary` | string | Uzun yorumlar için kısa özet |
| `keywords` | array | Her biri `{ word: string, score: float }` |

**Kurallar:**
- Tüm enum değerleri sabit listede tanımlanır (`core/constants.py`), Gemini'ye de bu değerler dayatılır.
- Model belirsizse `traveler_type` = `Unknown`.
- Gemini hatası/timeout durumunda yorum yine kaydedilir; zenginleştirme alanları `null` kalır ve loglanır (import bir yorum yüzünden çökmez).
- Prompt kısa ve direktif olmalı; şema Gemini'nin yapısal çıktı mekanizmasıyla zorlanmalı.

---

## 7. API Endpoint'leri

Belgedeki endpoint'ler örnektir; aşağıdaki liste projenin ihtiyaç duyduğu **sonlandırılmış set**tir.

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/health` | Sağlık kontrolü (DB bağlantısı ayakta mı). Kurulum/deployment için |
| POST | `/reviews/import` | CSV yükler, pipeline'ı çalıştırır, import özeti döner |
| GET | `/reviews` | Yorumları listeler — **filtreleme, arama, sayfalama** |
| GET | `/reviews/{id}` | Tek yorum detayı (otel + anahtar kelimeler dahil) |
| GET | `/reviews/filters` | Filtre dropdown'ları için distinct değerler (ülkeler, diller, seyahat tipleri, sentiment) |
| GET | `/dashboard` | Dashboard için tüm agregasyonları tek yanıtta döner |

**`GET /reviews` query parametreleri:** `country`, `traveler_type`, `sentiment_label`, `language`, `search` (metin araması), `page`, `page_size`.

**Kararların gerekçesi (README'ye de yazılacak):**
- `GET /health` eklendi: her backend'de standart; kurulum dokümanında "ayağa kalktı mı" kontrolü için pratik.
- `GET /reviews/filters` eklendi: tek-sayfa admin'de filtre dropdown'larının (ülke, dil, seyahat tipi) dolması için distinct değerler gerekir; bunları her yorum listesinde tekrar hesaplamak yerine ayrı, hafif bir endpoint verir.
- `/dashboard` **tek** endpoint olarak tutuldu: tek-sayfa dashboard'da birden çok grafik aynı anda yüklendiği için tek yuvarlak-gidiş (round-trip) daha verimli.
- `/hotels` gibi endpoint'ler **eklenmedi**: oteller import sırasında içeride yönetiliyor, arayüz ülke bazlı çalışıyor; ayrı bir otel API'sine ihtiyaç yok.

---

## 8. Dashboard Sorguları (Prisma ile)

Belgede istenen SQL kavramları Prisma karşılıklarıyla sağlanır (JOIN → `include`/relation, GROUP BY/COUNT/AVG → `group_by`/`aggregate`, ORDER BY/LIMIT → `order`/`take`, INDEX → `@@index`):

- En çok yorum yapan ilk 10 ülke (ülkeye göre COUNT, azalan, LIMIT 10).
- En fazla `Family` müşterisi hangi ülkeden geliyor.
- En sık kullanılan dil.
- Duygu (sentiment) dağılımı.
- Seyahat tipi dağılımı.
- Ortalama sentiment_score (AVG).

> Prisma'nın `group_by`/`aggregate` ile ifade edilemeyen karmaşık agregasyonlarda `db.query_raw()` kullanılabilir; ancak bu istisna olmalı ve kodda yorumla gerekçelendirilmelidir.

---

## 9. Önerilen Klasör Yapısı

Her dosya tek sorumluluk taşır ve **250 satırı geçmez** (bkz. RULES.md).

```
backend/
├── app/
│   ├── main.py                    # FastAPI app, lifespan, router kayıtları
│   ├── config.py                  # Settings (env: DATABASE_URL, GEMINI_API_KEY)
│   ├── database.py                # Prisma client singleton + connect/disconnect
│   ├── routers/
│   │   ├── reviews.py             # /reviews, /reviews/import, /reviews/{id}, /reviews/filters
│   │   └── dashboard.py           # /dashboard   (/health main.py içinde)
│   ├── services/
│   │   ├── csv_service.py         # CSV parse + import orkestrasyonu
│   │   ├── language_service.py    # langdetect sarmalayıcı
│   │   ├── gemini_service.py      # Gemini client + yapısal çıktı çağrısı
│   │   ├── enrichment_service.py  # traveler/sentiment/summary/keyword birleştirme
│   │   ├── review_service.py      # yorum listeleme/detay sorguları
│   │   └── dashboard_service.py   # dashboard agregasyonları
│   ├── schemas/
│   │   ├── review.py              # Pydantic yanıt/istek modelleri
│   │   ├── dashboard.py
│   │   └── import_result.py
│   └── core/
│       ├── constants.py           # traveler tipi, sentiment enum'ları
│       └── exceptions.py          # özel hata sınıfları
├── prisma/
│   └── schema.prisma
├── requirements.txt
├── .env.example
└── README.md
```

---

## 10. Teslim Edilecekler

- Çalışan backend (FastAPI + Prisma + PostgreSQL)
- `README.md` — kurulum ve çalıştırma adımları
- Yapılan teknik seçimlerin (dil tespiti, traveler type, keyword yöntemi) **gerekçeleri** README'de açıklanır. Belgedeki "en önemli kural" gereği yöntem seçimleri araştırılmış ve gerekçelendirilmiş olmalıdır.
