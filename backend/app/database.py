"""Prisma client singleton'ı ve bağlantı yaşam döngüsü (RULES.md §3).

Tek bir `Prisma` örneği uygulama boyunca paylaşılır; bağlantı FastAPI
lifespan'i içinde `connect_db` / `disconnect_db` ile açılıp kapanır.
"""

import logging

from prisma import Prisma

logger = logging.getLogger(__name__)

db = Prisma()


async def connect_db() -> None:
    """Prisma bağlantısını açar (lifespan başlangıcında çağrılır)."""
    if not db.is_connected():
        await db.connect()
        logger.info("Prisma veritabani baglantisi acildi.")


async def disconnect_db() -> None:
    """Prisma bağlantısını kapatır (lifespan bitişinde çağrılır)."""
    if db.is_connected():
        await db.disconnect()
        logger.info("Prisma veritabani baglantisi kapatildi.")
