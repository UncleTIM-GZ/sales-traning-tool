"""积分和成就服务"""

import uuid
from datetime import datetime, timedelta

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.incentive import UserPoints, PointTransaction, Achievement, UserAchievement
from app.models.session import Session
from app.models.report import Report


class IncentiveService:
    """积分和成就服务"""

    # 积分规则
    POINTS_RULES = {
        "session_complete": 10,      # 完成场景对练
        "exam_complete": 30,         # 完成Exam测评
        "streak_bonus": 5,           # 连续打卡奖励（每天）
        "score_improvement": 2,      # 分数提升×2
        "course_lesson": 15,         # 完成课程章节
        "first_referral": 100,       # 首次邀请好友
        "daily_task_complete": 5,    # 完成每日任务
        "plan_complete": 50,         # 完成训练计划
    }

    # 等级经验要求
    LEVEL_EXPERIENCE = {
        1: 0,
        2: 100,
        3: 300,
        4: 600,
        5: 1000,
        6: 1500,
        7: 2100,
        8: 2800,
        9: 3600,
        10: 4500,
    }

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_user_points(self, user_id: str) -> UserPoints:
        """获取用户积分，不存在则创建"""
        result = await self.db.execute(
            select(UserPoints).where(UserPoints.user_id == user_id)
        )
        points_record = result.scalar_one_or_none()
        
        if not points_record:
            points_record = UserPoints(
                id=str(uuid.uuid4()),
                user_id=user_id,
                points=0,
                level=1,
                experience=0,
            )
            self.db.add(points_record)
            await self.db.commit()
            await self.db.refresh(points_record)
        
        return points_record

    async def add_points(
        self,
        user_id: str,
        amount: int,
        transaction_type: str,
        description: str | None = None,
        reference_id: str | None = None,
    ) -> PointTransaction:
        """增加积分"""
        points_record = await self.get_user_points(user_id)
        
        # 更新积分
        points_record.points += amount
        points_record.experience += amount
        
        # 检查升级
        await self._check_level_up(points_record)
        
        # 记录交易
        transaction = PointTransaction(
            id=str(uuid.uuid4()),
            user_id=user_id,
            amount=amount,
            type=transaction_type,
            description=description,
            reference_id=reference_id,
            balance_after=points_record.points,
        )
        self.db.add(transaction)
        
        await self.db.commit()
        await self.db.refresh(transaction)
        
        return transaction

    async def _check_level_up(self, points_record: UserPoints):
        """检查是否升级"""
        for level in sorted(self.LEVEL_EXPERIENCE.keys(), reverse=True):
            if points_record.experience >= self.LEVEL_EXPERIENCE[level]:
                if points_record.level < level:
                    points_record.level = level
                break

    async def get_transactions(
        self,
        user_id: str,
        limit: int = 20,
    ) -> list[PointTransaction]:
        """获取积分交易记录"""
        result = await self.db.execute(
            select(PointTransaction)
            .where(PointTransaction.user_id == user_id)
            .order_by(PointTransaction.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def award_session_points(
        self,
        user_id: str,
        session_id: str,
        is_exam: bool = False,
        score: float | None = None,
        previous_score: float | None = None,
    ) -> int:
        """完成训练后奖励积分"""
        total_points = 0
        
        # 基础积分
        base_points = self.POINTS_RULES["exam_complete"] if is_exam else self.POINTS_RULES["session_complete"]
        await self.add_points(
            user_id=user_id,
            amount=base_points,
            transaction_type="exam_complete" if is_exam else "session_complete",
            description=f"完成{'考试' if is_exam else '训练'}对练",
            reference_id=session_id,
        )
        total_points += base_points
        
        # 分数提升奖励
        if score and previous_score and score > previous_score:
            improvement = int(score - previous_score)
            improvement_points = improvement * self.POINTS_RULES["score_improvement"]
            await self.add_points(
                user_id=user_id,
                amount=improvement_points,
                transaction_type="score_improvement",
                description=f"分数提升 {improvement} 分",
                reference_id=session_id,
            )
            total_points += improvement_points
        
        # 检查并奖励成就
        await self.check_achievements(user_id)
        
        return total_points

    # ===== 成就系统 =====

    async def get_all_achievements(self) -> list[Achievement]:
        """获取所有成就定义"""
        result = await self.db.execute(
            select(Achievement)
            .where(Achievement.is_active == True)
            .order_by(Achievement.sort_order)
        )
        return list(result.scalars().all())

    async def get_user_achievements(self, user_id: str) -> list[UserAchievement]:
        """获取用户已解锁的成就"""
        result = await self.db.execute(
            select(UserAchievement)
            .where(UserAchievement.user_id == user_id)
            .order_by(UserAchievement.earned_at.desc())
        )
        return list(result.scalars().all())

    async def check_achievements(self, user_id: str) -> list[UserAchievement]:
        """检查并解锁成就"""
        # 获取所有未解锁的成就
        unlocked_ids_result = await self.db.execute(
            select(UserAchievement.achievement_id)
            .where(UserAchievement.user_id == user_id)
        )
        unlocked_ids = set(r[0] for r in unlocked_ids_result.all())
        
        all_achievements = await self.get_all_achievements()
        locked_achievements = [a for a in all_achievements if a.id not in unlocked_ids]
        
        # 获取用户统计数据
        stats = await self._get_user_stats(user_id)
        
        newly_unlocked = []
        for achievement in locked_achievements:
            if await self._check_condition(achievement, stats):
                # 解锁成就
                user_achievement = UserAchievement(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    achievement_id=achievement.id,
                    earned_at=datetime.utcnow(),
                )
                self.db.add(user_achievement)
                newly_unlocked.append(user_achievement)
                
                # 奖励积分
                if achievement.points_reward > 0:
                    await self.add_points(
                        user_id=user_id,
                        amount=achievement.points_reward,
                        transaction_type="achievement_unlock",
                        description=f"解锁成就: {achievement.name}",
                        reference_id=achievement.id,
                    )
        
        if newly_unlocked:
            await self.db.commit()
        
        return newly_unlocked

    async def _get_user_stats(self, user_id: str) -> dict:
        """获取用户统计数据（用于成就检查）"""
        # 总会话数
        session_count_result = await self.db.execute(
            select(func.count(Session.id))
            .where(Session.user_id == user_id)
            .where(Session.status == "completed")
        )
        session_count = session_count_result.scalar() or 0
        
        # 最高分数
        max_score_result = await self.db.execute(
            select(func.max(Report.overall_score))
            .where(Report.user_id == user_id)
        )
        max_score = max_score_result.scalar() or 0
        
        # 连续打卡天数（简化计算）
        streak_days = await self._calculate_streak(user_id)
        
        # 积分
        points_record = await self.get_user_points(user_id)
        
        return {
            "session_count": session_count,
            "max_score": max_score,
            "streak_days": streak_days,
            "total_points": points_record.points,
            "level": points_record.level,
        }

    async def _calculate_streak(self, user_id: str) -> int:
        """计算连续打卡天数"""
        # 获取最近30天的训练日期
        result = await self.db.execute(
            select(func.date(Session.created_at))
            .where(Session.user_id == user_id)
            .where(Session.status == "completed")
            .where(Session.created_at >= datetime.utcnow() - timedelta(days=30))
            .distinct()
            .order_by(func.date(Session.created_at).desc())
        )
        dates = [r[0] for r in result.all()]
        
        if not dates:
            return 0
        
        # 计算连续天数
        streak = 0
        today = datetime.utcnow().date()
        
        for i, d in enumerate(dates):
            expected_date = today - timedelta(days=i)
            if d == expected_date:
                streak += 1
            else:
                break
        
        return streak

    async def _check_condition(self, achievement: Achievement, stats: dict) -> bool:
        """检查成就条件是否满足"""
        condition = achievement.condition
        condition_type = condition.get("type")
        value = condition.get("value", 0)
        
        if condition_type == "streak_days":
            return stats["streak_days"] >= value
        elif condition_type == "score_above":
            return stats["max_score"] >= value
        elif condition_type == "sessions_count":
            return stats["session_count"] >= value
        elif condition_type == "total_points":
            return stats["total_points"] >= value
        elif condition_type == "level":
            return stats["level"] >= value
        
        return False

    async def mark_achievement_viewed(self, user_id: str, achievement_id: str):
        """标记成就已查看"""
        result = await self.db.execute(
            select(UserAchievement)
            .where(UserAchievement.user_id == user_id)
            .where(UserAchievement.achievement_id == achievement_id)
        )
        user_achievement = result.scalar_one_or_none()
        
        if user_achievement:
            user_achievement.is_viewed = True
            await self.db.commit()
