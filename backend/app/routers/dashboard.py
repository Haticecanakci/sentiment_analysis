"""/dashboard endpoint'i — tüm agregasyonlar tek yanıtta (PROJECT.md §7).

İnce router: hesaplama dashboard_service'te, burada yalnızca çağrı ve
tipli yanıt vardır (RULES.md §1-2).
"""

from fastapi import APIRouter

from app.schemas.dashboard import DashboardResponse
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardResponse)
async def get_dashboard() -> DashboardResponse:
    """Dashboard grafiklerinin ihtiyaç duyduğu tüm metrikleri döndürür."""
    return DashboardResponse(**await dashboard_service.get_dashboard())
