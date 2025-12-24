"""
开发：Excellent（11964948@qq.com）
功能：兑换码服务
作用：管理兑换码创建、验证、兑换
创建时间：2024-12-24
最后修改：2024-12-24
"""

import uuid
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select, and_, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.redeem_code import RedeemCode, RedeemLog, RewardType, generate_redeem_code
from app.models.membership import MembershipLevel, MembershipLevelName, Subscription, SubscriptionStatus
from app.services.points_service import PointsService
from app.models.points import PointsSource


class RedeemCodeError(Exception):
    """兑换码错误基类"""
    pass


class CodeNotFoundError(RedeemCodeError):
    """兑换码不存在"""
    pass


class CodeExpiredError(RedeemCodeError):
    """兑换码已过期"""
    pass


class CodeExhaustedError(RedeemCodeError):
    """兑换码已用完"""
    pass


class CodeInactiveError(RedeemCodeError):
    """兑换码已禁用"""
    pass


class CodeNotYetValidError(RedeemCodeError):
    """兑换码尚未生效"""
    pass


class AlreadyRedeemedError(RedeemCodeError):
    """用户已兑换过此码"""
    pass


class RedeemCodeService:
    """兑换码服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ========== 兑换码查询 ==========

    async def get_by_id(self, code_id: str) -> RedeemCode | None:
        """根据ID获取兑换码"""
        result = await self.db.execute(
            select(RedeemCode).where(RedeemCode.id == code_id)
        )
        return result.scalar_one_or_none()

    async def get_by_code(self, code: str) -> RedeemCode | None:
        """根据兑换码获取"""
        result = await self.db.execute(
            select(RedeemCode).where(RedeemCode.code == code.upper().strip())
        )
        return result.scalar_one_or_none()

    async def list_codes(
        self,
        page: int = 1,
        page_size: int = 20,
        reward_type: str | None = None,
        is_active: bool | None = None,
        batch_id: str | None = None,
        search: str | None = None,
    ) -> tuple[list[RedeemCode], int]:
        """获取兑换码列表"""
        query = select(RedeemCode)
        count_query = select(func.count(RedeemCode.id))

        # 筛选条件
        conditions = []
        if reward_type:
            conditions.append(RedeemCode.reward_type == reward_type)
        if is_active is not None:
            conditions.append(RedeemCode.is_active == is_active)
        if batch_id:
            conditions.append(RedeemCode.batch_id == batch_id)
        if search:
            conditions.append(
                or_(
                    RedeemCode.code.ilike(f"%{search}%"),
                    RedeemCode.description.ilike(f"%{search}%"),
                )
            )

        if conditions:
            query = query.where(and_(*conditions))
            count_query = count_query.where(and_(*conditions))

        # 计算总数
        count_result = await self.db.execute(count_query)
        total = count_result.scalar() or 0

        # 分页查询
        query = query.order_by(RedeemCode.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)

        result = await self.db.execute(query)
        codes = list(result.scalars().all())

        return codes, total

    # ========== 兑换码创建 ==========

    async def create_code(
        self,
        reward_type: str,
        reward_value: int,
        valid_until: datetime,
        code: str | None = None,
        vip_level: str | None = None,
        usage_limit: int = 1,
        per_user_limit: int = 1,
        valid_from: datetime | None = None,
        description: str | None = None,
        created_by: str | None = None,
    ) -> RedeemCode:
        """创建兑换码"""
        # 生成或验证兑换码
        if code:
            code = code.upper().strip()
            # 检查是否已存在
            existing = await self.get_by_code(code)
            if existing:
                raise ValueError(f"兑换码 {code} 已存在")
        else:
            # 自动生成唯一兑换码
            for _ in range(10):  # 最多尝试10次
                code = generate_redeem_code()
                existing = await self.get_by_code(code)
                if not existing:
                    break
            else:
                raise ValueError("无法生成唯一兑换码，请重试")

        redeem_code = RedeemCode(
            id=str(uuid.uuid4()),
            code=code,
            reward_type=reward_type,
            reward_value=reward_value,
            vip_level=vip_level,
            usage_limit=usage_limit,
            per_user_limit=per_user_limit,
            valid_from=valid_from or datetime.utcnow(),
            valid_until=valid_until,
            description=description,
            created_by=created_by,
        )
        self.db.add(redeem_code)
        await self.db.commit()
        await self.db.refresh(redeem_code)
        return redeem_code

    async def batch_create_codes(
        self,
        count: int,
        reward_type: str,
        reward_value: int,
        valid_until: datetime,
        prefix: str | None = None,
        vip_level: str | None = None,
        usage_limit: int = 1,
        per_user_limit: int = 1,
        valid_from: datetime | None = None,
        description: str | None = None,
        created_by: str | None = None,
    ) -> tuple[str, list[str]]:
        """批量创建兑换码"""
        batch_id = str(uuid.uuid4())
        codes = []
        generated_codes = set()

        for _ in range(count):
            # 生成唯一兑换码
            for _ in range(10):
                code = generate_redeem_code()
                if prefix:
                    code = f"{prefix.upper()}{code}"
                if code not in generated_codes:
                    existing = await self.get_by_code(code)
                    if not existing:
                        generated_codes.add(code)
                        break
            else:
                continue  # 跳过无法生成的

            redeem_code = RedeemCode(
                id=str(uuid.uuid4()),
                code=code,
                reward_type=reward_type,
                reward_value=reward_value,
                vip_level=vip_level,
                usage_limit=usage_limit,
                per_user_limit=per_user_limit,
                valid_from=valid_from or datetime.utcnow(),
                valid_until=valid_until,
                description=description,
                batch_id=batch_id,
                created_by=created_by,
            )
            self.db.add(redeem_code)
            codes.append(code)

        await self.db.commit()
        return batch_id, codes

    # ========== 兑换码更新 ==========

    async def update_code(
        self,
        code_id: str,
        **kwargs,
    ) -> RedeemCode | None:
        """更新兑换码"""
        redeem_code = await self.get_by_id(code_id)
        if not redeem_code:
            return None

        for key, value in kwargs.items():
            if value is not None and hasattr(redeem_code, key):
                setattr(redeem_code, key, value)

        await self.db.commit()
        await self.db.refresh(redeem_code)
        return redeem_code

    async def disable_code(self, code_id: str) -> RedeemCode | None:
        """禁用兑换码"""
        return await self.update_code(code_id, is_active=False)

    async def enable_code(self, code_id: str) -> RedeemCode | None:
        """启用兑换码"""
        return await self.update_code(code_id, is_active=True)

    async def delete_code(self, code_id: str) -> bool:
        """删除兑换码"""
        redeem_code = await self.get_by_id(code_id)
        if not redeem_code:
            return False

        await self.db.delete(redeem_code)
        await self.db.commit()
        return True

    # ========== 兑换逻辑 ==========

    async def validate_code(self, code: str, user_id: str) -> RedeemCode:
        """验证兑换码是否可用"""
        redeem_code = await self.get_by_code(code)
        
        if not redeem_code:
            raise CodeNotFoundError("兑换码不存在")

        if not redeem_code.is_active:
            raise CodeInactiveError("兑换码已禁用")

        now = datetime.utcnow()
        if now < redeem_code.valid_from:
            raise CodeNotYetValidError("兑换码尚未生效")

        if now > redeem_code.valid_until:
            raise CodeExpiredError("兑换码已过期")

        if redeem_code.is_exhausted:
            raise CodeExhaustedError("兑换码已被使用完")

        # 检查用户是否已兑换过
        user_redeem_count = await self._get_user_redeem_count(redeem_code.id, user_id)
        if user_redeem_count >= redeem_code.per_user_limit:
            raise AlreadyRedeemedError("您已兑换过此码")

        return redeem_code

    async def _get_user_redeem_count(self, code_id: str, user_id: str) -> int:
        """获取用户对某兑换码的兑换次数"""
        result = await self.db.execute(
            select(func.count(RedeemLog.id)).where(
                and_(
                    RedeemLog.code_id == code_id,
                    RedeemLog.user_id == user_id,
                )
            )
        )
        return result.scalar() or 0

    async def redeem(
        self,
        code: str,
        user_id: str,
        ip_address: str | None = None,
    ) -> dict[str, Any]:
        """兑换码兑换"""
        # 验证兑换码
        redeem_code = await self.validate_code(code, user_id)

        # 执行兑换
        result = {
            "success": True,
            "reward_type": redeem_code.reward_type,
            "reward_value": redeem_code.reward_value,
            "message": "",
            "vip_extended_to": None,
            "points_added": None,
            "new_points_balance": None,
        }

        if redeem_code.reward_type == RewardType.VIP_DAYS.value:
            # 兑换VIP天数
            vip_extended_to = await self._redeem_vip_days(
                user_id=user_id,
                days=redeem_code.reward_value,
                vip_level=redeem_code.vip_level,
            )
            result["vip_extended_to"] = vip_extended_to
            result["message"] = f"成功兑换 {redeem_code.reward_value} 天VIP会员"

        elif redeem_code.reward_type == RewardType.POINTS.value:
            # 兑换积分
            new_balance = await self._redeem_points(
                user_id=user_id,
                points=redeem_code.reward_value,
                code_id=redeem_code.id,
            )
            result["points_added"] = redeem_code.reward_value
            result["new_points_balance"] = new_balance
            result["message"] = f"成功兑换 {redeem_code.reward_value} 积分"

        # 更新兑换码使用次数
        redeem_code.used_count += 1

        # 记录兑换日志
        redeem_log = RedeemLog(
            id=str(uuid.uuid4()),
            code_id=redeem_code.id,
            user_id=user_id,
            reward_type=redeem_code.reward_type,
            reward_value=redeem_code.reward_value,
            vip_extended_to=result.get("vip_extended_to"),
            points_added=result.get("points_added"),
            ip_address=ip_address,
        )
        self.db.add(redeem_log)

        await self.db.commit()
        return result

    async def _redeem_vip_days(
        self,
        user_id: str,
        days: int,
        vip_level: str | None = None,
    ) -> datetime:
        """兑换VIP天数"""
        # 获取VIP等级
        if vip_level:
            level_result = await self.db.execute(
                select(MembershipLevel).where(MembershipLevel.name == vip_level)
            )
            level = level_result.scalar_one_or_none()
        else:
            # 默认使用 pro 等级
            level_result = await self.db.execute(
                select(MembershipLevel).where(
                    MembershipLevel.name == MembershipLevelName.PRO.value
                )
            )
            level = level_result.scalar_one_or_none()

        if not level:
            raise ValueError("VIP等级不存在")

        # 检查用户是否有现有订阅
        now = datetime.utcnow()
        existing_result = await self.db.execute(
            select(Subscription)
            .where(
                and_(
                    Subscription.user_id == user_id,
                    Subscription.status == SubscriptionStatus.ACTIVE.value,
                    Subscription.expires_at > now,
                )
            )
            .order_by(Subscription.expires_at.desc())
        )
        existing = existing_result.scalar_one_or_none()

        if existing:
            # 续费：在现有到期时间基础上延长
            new_expires_at = existing.expires_at + timedelta(days=days)
            existing.expires_at = new_expires_at
            # 如果新等级更高，更新等级
            if level.sort_order > 0:  # 非免费等级
                existing.level_id = level.id
        else:
            # 新建订阅
            new_expires_at = now + timedelta(days=days)
            subscription = Subscription(
                id=str(uuid.uuid4()),
                user_id=user_id,
                level_id=level.id,
                status=SubscriptionStatus.ACTIVE.value,
                started_at=now,
                expires_at=new_expires_at,
            )
            self.db.add(subscription)

        return new_expires_at

    async def _redeem_points(
        self,
        user_id: str,
        points: int,
        code_id: str,
    ) -> int:
        """兑换积分"""
        points_service = PointsService(self.db)
        transaction = await points_service.earn_points(
            user_id=user_id,
            source=PointsSource.ADMIN_ADJUST.value,  # 使用管理员调整来源
            amount=points,
            reference_id=code_id,
            description="兑换码兑换积分",
            check_daily_limit=False,  # 兑换码不受每日上限限制
        )
        
        if transaction:
            return transaction.balance_after
        
        # 如果没有交易记录，获取当前余额
        return await points_service.get_balance(user_id)

    # ========== 兑换记录 ==========

    async def get_redeem_logs(
        self,
        page: int = 1,
        page_size: int = 20,
        code_id: str | None = None,
        user_id: str | None = None,
    ) -> tuple[list[RedeemLog], int]:
        """获取兑换记录"""
        query = select(RedeemLog).options(selectinload(RedeemLog.redeem_code))
        count_query = select(func.count(RedeemLog.id))

        conditions = []
        if code_id:
            conditions.append(RedeemLog.code_id == code_id)
        if user_id:
            conditions.append(RedeemLog.user_id == user_id)

        if conditions:
            query = query.where(and_(*conditions))
            count_query = count_query.where(and_(*conditions))

        # 计算总数
        count_result = await self.db.execute(count_query)
        total = count_result.scalar() or 0

        # 分页查询
        query = query.order_by(RedeemLog.redeemed_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)

        result = await self.db.execute(query)
        logs = list(result.scalars().all())

        return logs, total

    # ========== 统计 ==========

    async def get_statistics(self) -> dict[str, Any]:
        """获取兑换码统计"""
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        # 总数
        total_result = await self.db.execute(select(func.count(RedeemCode.id)))
        total_codes = total_result.scalar() or 0

        # 活跃数
        active_result = await self.db.execute(
            select(func.count(RedeemCode.id)).where(
                and_(
                    RedeemCode.is_active == True,
                    RedeemCode.valid_until > now,
                )
            )
        )
        active_codes = active_result.scalar() or 0

        # 过期数
        expired_result = await self.db.execute(
            select(func.count(RedeemCode.id)).where(RedeemCode.valid_until <= now)
        )
        expired_codes = expired_result.scalar() or 0

        # 用完数
        exhausted_result = await self.db.execute(
            select(func.count(RedeemCode.id)).where(
                and_(
                    RedeemCode.usage_limit != -1,
                    RedeemCode.used_count >= RedeemCode.usage_limit,
                )
            )
        )
        exhausted_codes = exhausted_result.scalar() or 0

        # 总兑换次数
        total_redeemed_result = await self.db.execute(
            select(func.count(RedeemLog.id))
        )
        total_redeems = total_redeemed_result.scalar() or 0

        # 今日兑换次数
        today_redeems_result = await self.db.execute(
            select(func.count(RedeemLog.id)).where(
                RedeemLog.redeemed_at >= today_start
            )
        )
        today_redeems = today_redeems_result.scalar() or 0

        # VIP天数统计
        vip_days_result = await self.db.execute(
            select(func.sum(RedeemLog.reward_value)).where(
                RedeemLog.reward_type == RewardType.VIP_DAYS.value
            )
        )
        total_vip_days_given = vip_days_result.scalar() or 0

        # 积分统计
        points_result = await self.db.execute(
            select(func.sum(RedeemLog.reward_value)).where(
                RedeemLog.reward_type == RewardType.POINTS.value
            )
        )
        total_points_given = points_result.scalar() or 0

        # 按奖励类型统计
        by_reward_type = []
        for reward_type in [RewardType.POINTS.value, RewardType.VIP_DAYS.value]:
            count_result = await self.db.execute(
                select(func.count(RedeemCode.id)).where(
                    RedeemCode.reward_type == reward_type
                )
            )
            count = count_result.scalar() or 0
            value_result = await self.db.execute(
                select(func.sum(RedeemCode.reward_value)).where(
                    RedeemCode.reward_type == reward_type
                )
            )
            total_value = value_result.scalar() or 0
            by_reward_type.append({
                "reward_type": reward_type,
                "count": count,
                "total_value": total_value,
            })

        return {
            "total_codes": total_codes,
            "active_codes": active_codes,
            "expired_codes": expired_codes,
            "exhausted_codes": exhausted_codes,
            "total_redeems": total_redeems,
            "today_redeems": today_redeems,
            "total_vip_days_given": total_vip_days_given,
            "total_points_given": total_points_given,
            "by_reward_type": by_reward_type,
        }

    # ========== 导出 ==========

    async def export_codes(
        self,
        batch_id: str | None = None,
        reward_type: str | None = None,
        is_active: bool | None = None,
        include_used: bool = True,
    ) -> list[dict[str, Any]]:
        """导出兑换码"""
        query = select(RedeemCode)

        conditions = []
        if batch_id:
            conditions.append(RedeemCode.batch_id == batch_id)
        if reward_type:
            conditions.append(RedeemCode.reward_type == reward_type)
        if is_active is not None:
            conditions.append(RedeemCode.is_active == is_active)
        if not include_used:
            conditions.append(
                or_(
                    RedeemCode.usage_limit == -1,
                    RedeemCode.used_count < RedeemCode.usage_limit,
                )
            )

        if conditions:
            query = query.where(and_(*conditions))

        query = query.order_by(RedeemCode.created_at.desc())
        result = await self.db.execute(query)
        codes = result.scalars().all()

        return [
            {
                "code": code.code,
                "reward_type": code.reward_type,
                "reward_value": code.reward_value,
                "vip_level": code.vip_level,
                "usage_limit": code.usage_limit,
                "used_count": code.used_count,
                "valid_from": code.valid_from.isoformat(),
                "valid_until": code.valid_until.isoformat(),
                "is_active": code.is_active,
                "description": code.description,
            }
            for code in codes
        ]
