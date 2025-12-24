"""会话相关Schema"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


# ===== Session =====
class SessionCreate(BaseModel):
    """创建会话"""
    scenario_id: UUID
    mode: Literal["train", "exam", "replay"]
    seed: int | None = Field(None, description="随机种子(Exam模式必须)")


class SessionResponse(BaseModel):
    """会话响应"""
    id: str
    user_id: str
    scenario_id: str
    mode: Literal["train", "exam", "replay"]
    seed: int | None = None
    status: Literal["pending", "active", "completed", "aborted"]
    started_at: datetime | None = None
    ended_at: datetime | None = None


class SessionListItem(BaseModel):
    """会话列表项"""
    id: str
    scenario_id: str
    mode: Literal["train", "exam", "replay"]
    status: Literal["pending", "active", "completed", "aborted"]
    started_at: datetime | None = None
    ended_at: datetime | None = None


class SessionListResponse(BaseModel):
    """会话列表响应"""
    items: list[SessionListItem]
    total: int
    page: int
    size: int


# ===== Message =====
class MessageRequest(BaseModel):
    """发送消息"""
    content: str = Field(..., min_length=1, max_length=2000)


# ===== History =====
class TurnItem(BaseModel):
    """对话轮次"""
    turn_number: int
    role: Literal["user", "npc", "coach"]
    content: str
    created_at: datetime


class SessionHistoryResponse(BaseModel):
    """会话历史响应"""
    session_id: str
    turns: list[TurnItem]
