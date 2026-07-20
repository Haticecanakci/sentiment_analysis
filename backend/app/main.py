"""FastAPI uygulaması: lifespan, router kayıtları ve /health (PROJECT.md §9).

Prisma bağlantısı lifespan içinde açılıp kapanır (RULES.md §3-4).
"""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.database import connect_db, db, disconnect_db
from app.routers import dashboard, reviews
from app.schemas.health import HealthResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Uygulama ömrü boyunca tek Prisma bağlantısı: başta aç, sonda kapat."""
    await connect_db()
    yield
    await disconnect_db()


app = FastAPI(
    title="Otel Yorumlari Dil ve Duygu Analizi API",
    description="Otel yorumlarini dil/duygu/seyahat tipi/anahtar kelime "
    "acisindan analiz eden backend (PROJECT.md).",
    version="1.0.0",
    lifespan=lifespan,
)


# Frontend (Vite/Express dev server) farklı origin'den çalıştığından tarayıcı
# fetch çağrıları CORS izni olmadan engellenir. Sadece yerel geliştirme
# origin'lerine izin verilir (RULES.md kapsamında backend/frontend ayrı
# süreçlerdir; kimlik doğrulama olmadığından geniş metod/header izni güvenlidir).
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(reviews.router)
app.include_router(dashboard.router)


@app.get("/health", response_model=HealthResponse, tags=["health"])
async def health() -> HealthResponse:
    """Sağlık kontrolü: uygulama ve DB bağlantısı ayakta mı?

    Saf SQL yerine hafif bir Prisma sorgusu (hotels üzerinde count)
    bağlantı doğrulaması olarak kullanılır (RULES.md §3).
    """
    try:
        await db.hotel.count()
    except Exception as exc:
        logger.exception("Saglik kontrolu: veritabanina erisilemedi.")
        raise HTTPException(
            status_code=503, detail="Veritabani baglantisi basarisiz."
        ) from exc
    return HealthResponse(status="ok", database="connected")
