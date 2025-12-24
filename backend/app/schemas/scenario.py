"""场景相关Schema"""

from typing import Any, Literal

from pydantic import BaseModel, Field


# ===== Scenario =====
class ScenarioBase(BaseModel):
    """场景基础信息"""
    name: str = Field(..., min_length=1, max_length=100)
    track: Literal["sales", "social"]
    mode: Literal["train", "exam", "replay"]
    difficulty: int = Field(..., ge=1, le=5)
    description: str | None = None


class ScenarioCreate(ScenarioBase):
    """创建场景"""
    config: dict[str, Any] = {}
    rubric_version: str = Field(default="1.0", description="评分标准版本")


class UserScenarioCreate(BaseModel):
    """用户创建自定义场景"""
    name: str = Field(..., min_length=1, max_length=100)
    track: Literal["sales", "social"]
    difficulty: int = Field(default=3, ge=1, le=5)
    description: str | None = None
    channel: str = Field(default="电话")
    tags: list[str] = []
    visibility: Literal["private", "public"] = "private"
    
    # AI角色设定
    ai_name: str = Field(..., min_length=1, max_length=50)
    ai_identity: str = Field(..., min_length=1, max_length=200)
    ai_personality: str | None = None
    ai_attitude: Literal["friendly", "neutral", "skeptical", "tough"] = "neutral"
    ai_pain_points: list[str] = []
    ai_objectives: list[str] = []
    
    # 场景背景
    background: str = Field(..., min_length=1)
    user_role: str | None = None
    objective: str = Field(..., min_length=1)
    success_criteria: list[str] = []


class ScenarioUpdate(BaseModel):
    """更新场景"""
    name: str | None = Field(None, min_length=1, max_length=100)
    difficulty: int | None = Field(None, ge=1, le=5)
    description: str | None = None
    config: dict[str, Any] | None = None
    status: Literal["draft", "published", "archived"] | None = None


class ScenarioResponse(BaseModel):
    """场景响应"""
    id: str
    name: str
    track: Literal["sales", "social"]
    mode: Literal["train", "exam", "replay"]
    difficulty: int
    description: str | None = None
    config: dict[str, Any] = {}
    rubric_version: str | None = None
    status: Literal["draft", "published", "archived"]


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
    creator: dict[str, Any] | None = None


class ScenarioListResponse(BaseModel):
    """场景列表响应"""
    items: list[ScenarioListItem]
    total: int
    page: int
    size: int


# ===== Scenario Pack =====
class ScenarioPackItem(BaseModel):
    """场景包列表项"""
    id: str
    name: str
    track: Literal["sales", "social"]
    difficulty_range: list[int]
    scenario_count: int
    status: Literal["draft", "published", "archived"]


class ScenarioPackListResponse(BaseModel):
    """场景包列表响应"""
    items: list[ScenarioPackItem]
    total: int
