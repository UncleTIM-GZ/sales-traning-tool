from typing import Any, Literal
from pydantic import BaseModel, Field

# ... existing code ...

class CreatorInfo(BaseModel):
    nickname: str
    avatar: str | None = None
    level: str | None = None
    is_verified: bool = False

class ScenarioListItem(BaseModel):
    """场景列表项"""
    id: str
    name: str
    track: Literal["sales", "social"]
    mode: Literal["train", "exam", "replay"]
    difficulty: int
    description: str | None = None
    config: dict[str, Any] = {}
    status: Literal["draft", "published", "archived"]
    is_custom: bool = False
    created_by: str | None = None
    creator: CreatorInfo | None = None  # Added field
