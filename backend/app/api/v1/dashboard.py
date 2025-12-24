"""仪表盘路由"""

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.deps import CurrentUserId, DatabaseSession
from app.services.report_service import DashboardService


router = APIRouter()


class ScoreTrend(BaseModel):
    """分数趋势"""
    date: str
    score: float


class AbilityDimension(BaseModel):
    """能力维度"""
    ability: str
    value: int
    fullMark: int = 100


class TrainingPlanItem(BaseModel):
    """训练计划项"""
    id: int
    title: str
    time: str
    type: str
    status: str


class DashboardStatsResponse(BaseModel):
    """仪表盘统计响应"""
    user_id: str
    current_score: float
    total_sessions: int
    week_duration_hours: float
    streak_days: int
    score_trend: list[ScoreTrend]
    ability_dimensions: list[AbilityDimension]
    rank_percentile: int


class TrainingPlanResponse(BaseModel):
    """训练计划响应"""
    items: list[TrainingPlanItem]


@router.get("/stats", response_model=DashboardStatsResponse)
async def get_dashboard_stats(
    user_id: CurrentUserId,
    db: DatabaseSession,
):
    """获取仪表盘统计数据"""
    service = DashboardService(db)
    return await service.get_user_stats(user_id)


@router.get("/training-plan", response_model=TrainingPlanResponse)
async def get_training_plan(
    user_id: CurrentUserId,
    db: DatabaseSession,
):
    """获取今日训练计划"""
    service = DashboardService(db)
    items = await service.get_training_plan(user_id)
    return {"items": items}
