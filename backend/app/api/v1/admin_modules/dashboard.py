"""仪表盘相关API

提供管理后台实时数据看板功能
"""

from typing import Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models import User
from app.services.dashboard_service import DashboardService
from pydantic import BaseModel


router = APIRouter()


# ===== Schemas =====

class RealtimeStatsResponse(BaseModel):
    """实时统计响应"""
    total_users: int
    active_users: int
    new_users_today: int
    total_sessions: int
    sessions_today: int
    avg_score: float
    total_scenarios: int
    total_courses: int
    total_posts: int


class GrowthTrendPoint(BaseModel):
    """增长趋势数据点"""
    date: str
    new_users: int
    sessions: int


class DistributionData(BaseModel):
    """分布数据"""
    name: str
    value: int


class UserDistributionResponse(BaseModel):
    """用户分布响应"""
    track_distribution: list[DistributionData]
    mode_distribution: list[DistributionData]


# ===== Helper =====

def require_admin(user: User):
    """检查管理员权限"""
    if user.role != "admin":
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理员权限"
        )


# ===== APIs =====

@router.get("/realtime", response_model=RealtimeStatsResponse)
async def get_realtime_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取实时统计数据
    
    返回核心业务指标的实时统计
    """
    require_admin(current_user)
    
    service = DashboardService(db)
    stats = await service.get_realtime_stats()
    
    return RealtimeStatsResponse(**stats)


@router.get("/growth-trend", response_model=list[GrowthTrendPoint])
async def get_growth_trend(
    days: int = Query(30, ge=7, le=90, description="查询天数"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取增长趋势数据
    
    返回指定天数内的用户增长和会话趋势
    """
    require_admin(current_user)
    
    service = DashboardService(db)
    trend = await service.get_growth_trend(days)
    
    return [GrowthTrendPoint(**point) for point in trend]


@router.get("/user-distribution", response_model=UserDistributionResponse)
async def get_user_distribution(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取用户分布数据
    
    返回用户按赛道、训练模式等维度的分布统计
    """
    require_admin(current_user)
    
    service = DashboardService(db)
    distribution = await service.get_user_distribution()
    
    return UserDistributionResponse(**distribution)
