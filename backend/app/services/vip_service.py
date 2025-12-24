"""
开发：Excellent（11964948@qq.com）
功能：VIP会员服务
作用：管理会员等级、订阅、权益校验
创建时间：2025-12-24
最后修改：2025-12-24
"""

import uuid
from datetime import datetime, timedelta
from typing import Any

import redis.asyncio as redis
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.membership import (
    MembershipLevel,
    MembershipLevelName,
    Subscription,
    SubscriptionStatus,
)
from app.models.user import User


# Redis 缓存键前缀
CACHE_PREFIX_USER_VIP = "user_vip:"
CACHE_TTL_USER_VIP = 300  # 5分钟


class VIPService:
    """VIP会员服务"""

    def __init__(self, db: AsyncSession, redis_client: redis.Redis | None = None):
        self.db = db
        self.redis = redis_client

    # ========== 会员等级 ==========

    async def get_all_levels(self, active_only: bool = True) -> list[MembershipLevel]:
        """获取所有会员等级"""
        query = select(MembershipLevel).order_by(MembershipLevel.sort_order)
        if active_only:
            query = query.where(MembershipLevel.is_active == True)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_level_by_name(self, name: str) -> MembershipLevel | None:
        """根据名称获取会员等级"""
        result = await self.db.execute(
            select(MembershipLevel).where(MembershipLevel.name == name)
        )
        return result.scalar_one_or_none()

    async def get_level_by_id(self, level_id: str) -> MembershipLevel | None:
        """根据ID获取会员等级"""
        result = await self.db.execute(
            select(MembershipLevel).where(MembershipLevel.id == level_id)
        )
        return result.scalar_one_or_none()

    async def get_free_level(self) -> MembershipLevel | None:
        """获取免费等级"""
        return await self.get_level_by_name(MembershipLevelName.FREE.value)

    # ========== 用户订阅 ==========

    async def get_user_active_subscription(
        self, user_id: str
    ) -> Subscription | None:
        """获取用户当前有效订阅"""
        now = datetime.utcnow()
        result = await self.db.execute(
            select(Subscription)
            .options(selectinload(Subscription.level))
            .where(
                and_(
                    Subscription.user_id == user_id,
                    Subscription.status == SubscriptionStatus.ACTIVE.value,
                    Subscription.expires_at > now,
                )
            )
            .order_by(Subscription.expires_at.desc())
        )
        return result.scalar_one_or_none()

    async def get_user_subscriptions(
        self, user_id: str, limit: int = 10
    ) -> list[Subscription]:
        """获取用户订阅历史"""
        result = await self.db.execute(
            select(Subscription)
            .options(selectinload(Subscription.level))
            .where(Subscription.user_id == user_id)
            .order_by(Subscription.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_user_current_level(self, user_id: str) -> MembershipLevel:
        """获取用户当前会员等级"""
        subscription = await self.get_user_active_subscription(user_id)
        if subscription and subscription.level:
            return subscription.level
        # 返回免费等级
        free_level = await self.get_free_level()
        if not free_level:
            raise ValueError("Free membership level not found")
        return free_level

    async def get_user_vip_status(self, user_id: str) -> dict[str, Any]:
        """获取用户VIP状态（带缓存）"""
        # 尝试从缓存获取
        if self.redis:
            cache_key = f"{CACHE_PREFIX_USER_VIP}{user_id}"
            cached = await self.redis.get(cache_key)
            if cached:
                import json
                return json.loads(cached)

        # 从数据库获取
        subscription = await self.get_user_active_subscription(user_id)
        level = await self.get_user_current_level(user_id)

        status = {
            "user_id": user_id,
            "is_vip": level.name != MembershipLevelName.FREE.value,
            "current_level": {
                "id": level.id,
                "name": level.name,
                "display_name": level.display_name,
                "privileges": level.privileges,
            },
            "subscription": None,
            "days_remaining": 0,
            "privileges": level.privileges,
        }

        if subscription:
            status["subscription"] = {
                "id": subscription.id,
                "level_id": subscription.level_id,
                "status": subscription.status,
                "started_at": subscription.started_at.isoformat(),
                "expires_at": subscription.expires_at.isoformat(),
                "days_remaining": subscription.days_remaining,
            }
            status["days_remaining"] = subscription.days_remaining

        # 写入缓存
        if self.redis:
            import json
            await self.redis.setex(
                cache_key, CACHE_TTL_USER_VIP, json.dumps(status)
            )

        return status

    async def invalidate_user_vip_cache(self, user_id: str) -> None:
        """清除用户VIP缓存"""
        if self.redis:
            cache_key = f"{CACHE_PREFIX_USER_VIP}{user_id}"
            await self.redis.delete(cache_key)

    # ========== 订阅管理 ==========

    async def create_subscription(
        self,
        user_id: str,
        level_id: str,
        duration_months: int,
        order_id: str | None = None,
    ) -> Subscription:
        """创建订阅"""
        # 检查是否有现有订阅
        existing = await self.get_user_active_subscription(user_id)
        
        now = datetime.utcnow()
        if existing:
            # 续费：在现有到期时间基础上延长
            started_at = existing.expires_at
        else:
            started_at = now

        expires_at = started_at + timedelta(days=duration_months * 30)

        subscription = Subscription(
            id=str(uuid.uuid4()),
            user_id=user_id,
            level_id=level_id,
            status=SubscriptionStatus.ACTIVE.value,
            started_at=started_at,
            expires_at=expires_at,
            order_id=order_id,
        )
        self.db.add(subscription)
        await self.db.commit()
        await self.db.refresh(subscription)

        # 清除缓存
        await self.invalidate_user_vip_cache(user_id)

        return subscription

    async def extend_subscription(
        self, user_id: str, days: int, reason: str = "admin_extend"
    ) -> Subscription | None:
        """延长订阅（管理员操作）"""
        subscription = await self.get_user_active_subscription(user_id)
        if not subscription:
            return None

        subscription.expires_at = subscription.expires_at + timedelta(days=days)
        await self.db.commit()
        await self.db.refresh(subscription)

        # 清除缓存
        await self.invalidate_user_vip_cache(user_id)

        return subscription

    async def cancel_subscription(self, user_id: str) -> Subscription | None:
        """取消订阅"""
        subscription = await self.get_user_active_subscription(user_id)
        if not subscription:
            return None

        subscription.status = SubscriptionStatus.CANCELLED.value
        await self.db.commit()
        await self.db.refresh(subscription)

        # 清除缓存
        await self.invalidate_user_vip_cache(user_id)

        return subscription

    async def expire_subscriptions(self) -> int:
        """过期订阅处理（定时任务调用）"""
        now = datetime.utcnow()
        result = await self.db.execute(
            select(Subscription).where(
                and_(
                    Subscription.status == SubscriptionStatus.ACTIVE.value,
                    Subscription.expires_at <= now,
                )
            )
        )
        expired = result.scalars().all()

        count = 0
        for sub in expired:
            sub.status = SubscriptionStatus.EXPIRED.value
            await self.invalidate_user_vip_cache(sub.user_id)
            count += 1

        if count > 0:
            await self.db.commit()

        return count

    # ========== 权益校验 ==========

    async def check_privilege(
        self, user_id: str, privilege_name: str
    ) -> tuple[bool, Any]:
        """检查用户是否拥有某项权益"""
        level = await self.get_user_current_level(user_id)
        value = level.get_privilege(privilege_name)
        
        if value is None:
            return False, None
        
        # 布尔类型权益
        if isinstance(value, bool):
            return value, value
        
        # 数值类型权益（-1表示无限）
        if isinstance(value, int):
            return value != 0, value
        
        return True, value

    async def check_daily_training_limit(self, user_id: str) -> tuple[bool, int]:
        """检查每日训练次数限制"""
        has_privilege, limit = await self.check_privilege(
            user_id, "daily_training_limit"
        )
        if limit == -1:
            return True, -1  # 无限
        return has_privilege, limit

    async def check_voice_training(self, user_id: str) -> bool:
        """检查是否可以使用语音训练"""
        has_privilege, _ = await self.check_privilege(
            user_id, "voice_training_enabled"
        )
        return has_privilege

    async def check_advanced_scenarios(self, user_id: str) -> bool:
        """检查是否可以使用高级场景"""
        has_privilege, _ = await self.check_privilege(
            user_id, "advanced_scenarios_enabled"
        )
        return has_privilege

    # ========== 价格计算 ==========

    async def calculate_price(
        self,
        level_name: str,
        duration_months: int,
        coupon_discount: int = 0,
        points_discount: int = 0,
    ) -> dict[str, int]:
        """计算订阅价格"""
        level = await self.get_level_by_name(level_name)
        if not level:
            raise ValueError(f"Invalid level: {level_name}")

        original_price = level.get_price(duration_months)
        final_price = max(0, original_price - coupon_discount - points_discount)

        return {
            "original_price": original_price,
            "coupon_discount": coupon_discount,
            "points_discount": points_discount,
            "final_price": final_price,
        }
