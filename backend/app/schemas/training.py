"""训练计划相关Schema"""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


# ===== Task =====
class TaskItem(BaseModel):
    """任务项"""
    id: str
    type: Literal["learn", "practice", "review"]
    title: str
    description: str | None = None
    duration_min: int = 10
    content_type: str | None = None  # course, scenario, article
    content_id: str | None = None
    status: Literal["pending", "in_progress", "completed", "skipped"] = "pending"
    result_score: float | None = None


class DayTasks(BaseModel):
    """每日任务"""
    day: int
    date: str | None = None  # 可选的具体日期
    tasks: list[TaskItem]
    is_today: bool = False
    is_completed: bool = False


# ===== Training Plan =====
class TrainingPlanCreate(BaseModel):
    """创建训练计划"""
    name: str = Field(..., min_length=1, max_length=100)
    duration_days: int = Field(7, ge=1, le=90, description="计划天数")
    auto_generate: bool = Field(False, description="是否基于基线自动生成")


class TrainingPlanGenerate(BaseModel):
    """自动生成训练计划请求"""
    duration_days: int = Field(7, ge=1, le=30, description="计划天数")
    target_dimensions: list[str] | None = Field(None, description="目标维度，为空则使用画像短板")
    daily_time_min: int | None = Field(None, ge=15, le=120, description="每日时间，为空则使用画像设置")


class TrainingPlanUpdate(BaseModel):
    """更新训练计划"""
    name: str | None = Field(None, min_length=1, max_length=100)
    status: Literal["active", "paused", "completed"] | None = None


class TrainingPlanResponse(BaseModel):
    """训练计划响应"""
    id: str
    user_id: str
    name: str
    description: str | None = None
    duration_days: int
    target_dimensions: list[str] = []
    experience_level: str | None = None
    daily_time_min: int = 30
    daily_tasks: list[DayTasks] = []
    current_day: int = 1
    completed_tasks: list[str] = []
    status: Literal["active", "paused", "completed"]
    progress: float = 0  # 0-1 计算得出
    started_at: datetime | None = None
    completed_at: datetime | None = None


class TrainingPlanListItem(BaseModel):
    """训练计划列表项"""
    id: str
    name: str
    description: str | None = None
    duration_days: int
    current_day: int = 1
    status: Literal["active", "paused", "completed"]
    progress: float = 0  # 0-1
    started_at: datetime | None = None


class TrainingPlanListResponse(BaseModel):
    """训练计划列表响应"""
    items: list[TrainingPlanListItem]
    total: int
    page: int
    size: int


# ===== Task Completion =====
class TaskCompleteRequest(BaseModel):
    """完成任务请求"""
    result_score: float | None = Field(None, ge=0, le=100, description="任务得分（如适用）")
    result_data: dict[str, Any] | None = Field(None, description="任务结果数据")


class TaskCompleteResponse(BaseModel):
    """完成任务响应"""
    task_id: str
    status: str
    completed_at: datetime
    plan_progress: float  # 更新后的计划进度


# ===== Progress =====
class CurrentPlanProgress(BaseModel):
    """当前计划进度"""
    id: str
    name: str
    day: int
    total_days: int
    today_completed: int
    today_total: int


class TrainingStats(BaseModel):
    """训练统计"""
    total_sessions: int
    total_duration_min: int
    avg_score: float
    score_trend: list[float] = []


class StreakInfo(BaseModel):
    """连续训练信息"""
    current: int
    longest: int


class ProgressResponse(BaseModel):
    """训练进度响应"""
    user_id: str
    current_plan: CurrentPlanProgress | None = None
    stats: TrainingStats
    streak: StreakInfo
