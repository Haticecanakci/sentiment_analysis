"""Uygulama ayarları — tüm değerler ortam değişkenlerinden okunur (RULES.md §5)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Ortam değişkenlerinden yüklenen uygulama ayarları."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str
    gemini_api_key: str
    gemini_model: str = "gemini-2.0-flash"
    gemini_max_concurrency: int = 5


@lru_cache
def get_settings() -> Settings:
    """Ayarların tek örneğini döndürür (süreç başına bir kez yüklenir)."""
    return Settings()
