"""/health yanıt modeli (RULES.md §7)."""

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Sağlık kontrolü yanıtı."""

    status: str
    database: str
