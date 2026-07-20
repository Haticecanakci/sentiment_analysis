"""/chat endpoint'i — dashboard'daki sohbet widget'i için Gemini yanıtı
(RULES.md §1-2). Gemini'ye tanımlanan `import_csv` fonksiyonu çağrılırsa
yanıt `action=import_csv` döner; frontend bunu görünce mevcut
CSVImportModal'ı açar (bkz. gemini_service.chat_reply).
"""

from fastapi import APIRouter, HTTPException

from app.core.exceptions import ChatError
from app.schemas.chat import ChatRequest, ChatResponse
from app.services import gemini_service

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def send_chat_message(payload: ChatRequest) -> ChatResponse:
    """Kullanıcının mesajını + son geçmişi Gemini'ye iletip yanıt/eylemi döndürür."""
    history = [(item.role, item.content) for item in payload.history]
    try:
        reply, action = await gemini_service.chat_reply(payload.message, history)
    except ChatError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc
    return ChatResponse(reply=reply, action=action)
