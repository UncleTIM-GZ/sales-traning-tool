"""积分和成就API"""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import CurrentUserId, DatabaseSession
from app.services.incentive_service import IncentiveService


router = APIRouter()


# ===== Schemas =====
class PointsResponse(BaseModel):
    """用户积分响应"""
    points: int
    level: int
    experience: int
    next_level_experience: int | None = None
    level_progress: float = 0  # 0-1


class TransactionItem(BaseModel):
    """积分交易记录"""
    id: str
    amount: int
    type: str
    description: str | None
    balance_after: int
    created_at: datetime


class TransactionsResponse(BaseModel):
    """积分交易列表响应"""
    items: list[TransactionItem]


class AchievementItem(BaseModel):
    """成就项"""
    id: str
    name: str
    description: str
    icon: str
    category: str
    rarity: str
    points_reward: int
    condition: dict[str, Any]
    is_unlocked: bool = False
    earned_at: datetime | None = None


class AchievementsResponse(BaseModel):
    """成就列表响应"""
    items: list[AchievementItem]
    unlocked_count: int
    total_count: int


class IncentiveSummary(BaseModel):
    """激励摘要（Dashboard用）"""
    points: int
    level: int
    level_name: str
    streak_days: int
    recent_achievements: list[AchievementItem] = []
    next_achievement: AchievementItem | None = None


# 等级名称
LEVEL_NAMES = {
    1: "新手学员",
    2: "入门选手",
    3: "进阶学者",
    4: "能力新星",
    5: "实战高手",
    6: "精英人才",
    7: "卓越专家",
    8: "行业翘楚",
    9: "王者之师",
    10: "传奇大师",
}


@router.get("/points", response_model=PointsResponse)
async def get_points(
    user_id: CurrentUserId,
    db: DatabaseSession,
):
    """获取用户积分"""
    service = IncentiveService(db)
    points_record = await service.get_user_points(user_id)
    
    # 计算升级进度
    current_level = points_record.level
    current_exp = points_record.experience
    current_level_exp = service.LEVEL_EXPERIENCE.get(current_level, 0)
    next_level_exp = service.LEVEL_EXPERIENCE.get(current_level + 1)
    
    level_progress = 0
    if next_level_exp:
        level_range = next_level_exp - current_level_exp
        progress_in_level = current_exp - current_level_exp
        level_progress = progress_in_level / level_range if level_range > 0 else 0
    
    return PointsResponse(
        points=points_record.points,
        level=points_record.level,
        experience=points_record.experience,
        next_level_experience=next_level_exp,
        level_progress=min(level_progress, 1.0),
    )


@router.get("/transactions", response_model=TransactionsResponse)
async def get_transactions(
    user_id: CurrentUserId,
    db: DatabaseSession,
    limit: int = 20,
):
    """获取积分交易记录"""
    service = IncentiveService(db)
    transactions = await service.get_transactions(user_id, limit)
    
    return TransactionsResponse(
        items=[
            TransactionItem(
                id=t.id,
                amount=t.amount,
                type=t.type,
                description=t.description,
                balance_after=t.balance_after,
                created_at=t.created_at,
            )
            for t in transactions
        ]
    )


@router.get("/achievements", response_model=AchievementsResponse)
async def get_achievements(
    user_id: CurrentUserId,
    db: DatabaseSession,
):
    """获取成就列表"""
    service = IncentiveService(db)
    
    all_achievements = await service.get_all_achievements()
    user_achievements = await service.get_user_achievements(user_id)
    
    # 构建已解锁成就的映射
    unlocked_map = {ua.achievement_id: ua for ua in user_achievements}
    
    items = []
    for a in all_achievements:
        ua = unlocked_map.get(a.id)
        items.append(AchievementItem(
            id=a.id,
            name=a.name,
            description=a.description,
            icon=a.icon,
            category=a.category,
            rarity=a.rarity,
            points_reward=a.points_reward,
            condition=a.condition,
            is_unlocked=ua is not None,
            earned_at=ua.earned_at if ua else None,
        ))
    
    return AchievementsResponse(
        items=items,
        unlocked_count=len(user_achievements),
        total_count=len(all_achievements),
    )


@router.get("/summary", response_model=IncentiveSummary)
async def get_incentive_summary(
    user_id: CurrentUserId,
    db: DatabaseSession,
):
    """获取激励摘要"""
    service = IncentiveService(db)
    
    points_record = await service.get_user_points(user_id)
    stats = await service._get_user_stats(user_id)
    
    all_achievements = await service.get_all_achievements()
    user_achievements = await service.get_user_achievements(user_id)
    unlocked_ids = {ua.achievement_id for ua in user_achievements}
    
    # 最近解锁的成就
    recent_achievements = []
    for ua in user_achievements[:3]:
        for a in all_achievements:
            if a.id == ua.achievement_id:
                recent_achievements.append(AchievementItem(
                    id=a.id,
                    name=a.name,
                    description=a.description,
                    icon=a.icon,
                    category=a.category,
                    rarity=a.rarity,
                    points_reward=a.points_reward,
                    condition=a.condition,
                    is_unlocked=True,
                    earned_at=ua.earned_at,
                ))
                break
    
    # 下一个即将解锁的成就
    next_achievement = None
    for a in all_achievements:
        if a.id not in unlocked_ids:
            next_achievement = AchievementItem(
                id=a.id,
                name=a.name,
                description=a.description,
                icon=a.icon,
                category=a.category,
                rarity=a.rarity,
                points_reward=a.points_reward,
                condition=a.condition,
                is_unlocked=False,
            )
            break
    
    return IncentiveSummary(
        points=points_record.points,
        level=points_record.level,
        level_name=LEVEL_NAMES.get(points_record.level, "学员"),
        streak_days=stats["streak_days"],
        recent_achievements=recent_achievements,
        next_achievement=next_achievement,
    )


@router.post("/achievements/{achievement_id}/view")
async def mark_achievement_viewed(
    user_id: CurrentUserId,
    db: DatabaseSession,
    achievement_id: str,
):
    """标记成就已查看"""
    service = IncentiveService(db)
    await service.mark_achievement_viewed(user_id, achievement_id)
    return {"status": "ok"}


@router.post("/check-achievements")
async def check_and_unlock_achievements(
    user_id: CurrentUserId,
    db: DatabaseSession,
):
    """手动检查并解锁成就"""
    service = IncentiveService(db)
    newly_unlocked = await service.check_achievements(user_id)
    
    return {
        "newly_unlocked_count": len(newly_unlocked),
        "achievement_ids": [ua.achievement_id for ua in newly_unlocked],
    }
