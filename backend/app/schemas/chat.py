"""Dashboard'daki sohbet widget'i için istek/yanıt şemaları (RULES.md §7).

CSV içe aktarma bu şemaların kapsamı dışındadır: frontend'de ayrı bir
"CSV İçe Aktar" eylemi olarak doğrudan mevcut /reviews/import akışını
tetikler (bkz. ChatWidget.tsx). Burada yalnızca serbest metin sohbeti vardır.
"""

from typing import Literal

from pydantic import BaseModel, Field

from app.core.constants import ChatAction


class ChatMessageIn(BaseModel):
    """Sohbet geçmişindeki tek tur; frontend state'inden gelir, DB'de tutulmaz."""

    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    """Kullanıcının yeni mesajı + bağlam için son birkaç tur geçmiş."""

    message: str = Field(min_length=1, max_length=4000)
    history: list[ChatMessageIn] = Field(default_factory=list, max_length=20)


class ChatResponse(BaseModel):
    """Gemini'nin ürettiği yanıt + frontend'in alması gereken eylem.

    `action=import_csv`, Gemini'nin `import_csv` fonksiyonunu çağırdığı
    (kullanıcının CSV içe aktarma niyeti belirttiği) anlamına gelir;
    frontend bunu görünce mevcut CSVImportModal'ı açar.
    """

    reply: str
    action: ChatAction = ChatAction.CHAT
