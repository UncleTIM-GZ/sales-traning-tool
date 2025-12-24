"""
开发：Excellent（11964948@qq.com）
功能：积分服务
作用：管理积分获取、消费、锁定、解锁
创建时间：2025-12-24
最后修改：2025-12-24
"""

import uuid
from datetime import datetime, date
from typing import Any

from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.points import (
    PointsAccount,
    PointsTransaction,
    PointsLock,
    PointsSource,
    PointsPurpose,
    PointsLockStatus,
    PointsTransactionType,
    POINTS_RULES,
)


class PointsService:
    """积分服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ========== 积分账户 ==========

    async def get_or_create_account(self, user_id: str) -> PointsAccount:
        """获取或创建用户积分账户"""
        result = await self.db.execute(
            select(PointsAccount).where(PointsAccount.user_id == user_id)
        )
        account = result.scalar_one_or_none()

        if not account:
            account = PointsAccount(
                id=str(uuid.uuid4()),
                user_id=user_id,
                balance=0,
                locked=0,
                total_earned=0,
                total_spent=0,
            )
            self.db.add(account)
            await self.db.commit()
            await self.db.refresh(account)

        return account

    async def get_account(self, user_id: str) -> PointsAccount | None:
        """获取用户积分账户"""
        result = await self.db.execute(
            select(PointsAccount).where(PointsAccount.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_balance(self, user_id: str) -> int:
        """获取用户可用积分余额"""
        account = await self.get_or_create_account(user_id)
        return account.available_balance

    # ========== 积分获取 ==========

    async def get_daily_earned(self, user_id: str) -> int:
        """获取用户今日已获取积分"""
        today_start = datetime.combine(date.today(), datetime.min.time())
        today_end = datetime.combine(date.today(), datetime.max.time())

        result = await self.db.execute(
            select(func.sum(PointsTransaction.amount)).where(
                and_(
                    PointsTransaction.user_id == user_id,
                    PointsTransaction.type == PointsTransactionType.EARN.value,
                    PointsTransaction.created_at >= today_start,
                    PointsTransaction.created_at <= today_end,
                )
            )
        )
        total = result.scalar()
        return total or 0

    async def can_earn_today(self, user_id: str, amount: int) -> bool:
        """检查今日是否还能获取积分"""
        daily_limit = POINTS_RULES["daily_earn_limit"]
        earned_today = await self.get_daily_earned(user_id)
        return earned_today + amount <= daily_limit

    async def earn_points(
        self,
        user_id: str,
        source: str,
        amount: int,
        reference_id: str | None = None,
        description: str | None = None,
        check_daily_limit: bool = True,
    ) -> PointsTransaction | None:
        """获取积分"""
        if amount <= 0:
            return None

        # 检查每日上限
        if check_daily_limit:
            daily_limit = POINTS_RULES["daily_earn_limit"]
            earned_today = await self.get_daily_earned(user_id)
            remaining = daily_limit - earned_today
            if remaining <= 0:
                return None
            # 限制获取数量
            amount = min(amount, remaining)

        account = await self.get_or_create_account(user_id)
        account.balance += amount
        account.total_earned += amount

        transaction = PointsTransaction(
            id=str(uuid.uuid4()),
            user_id=user_id,
            account_id=account.id,
            type=PointsTransactionType.EARN.value,
            amount=amount,
            balance_after=account.balance,
            source=source,
            reference_id=reference_id,
            description=description,
        )
        self.db.add(transaction)
        await self.db.commit()
        await self.db.refresh(transaction)
        return transaction

    async def earn_daily_login(self, user_id: str) -> PointsTransaction | None:
        """每日登录积分"""
        amount = POINTS_RULES["daily_login"]
        return await self.earn_points(
            user_id=user_id,
            source=PointsSource.DAILY_LOGIN.value,
            amount=amount,
            description="每日登录奖励",
        )

    async def earn_training_complete(
        self, user_id: str, score: float, session_id: str
    ) -> PointsTransaction | None:
        """完成训练积分"""
        min_points = POINTS_RULES["training_complete_min"]
        max_points = POINTS_RULES["training_complete_max"]
        # 根据得分计算积分
        amount = int(min_points + (max_points - min_points) * (score / 100))
        return await self.earn_points(
            user_id=user_id,
            source=PointsSource.TRAINING_COMPLETE.value,
            amount=amount,
            reference_id=session_id,
            description=f"完成训练，得分{score:.1f}",
        )

    async def earn_vip_purchase(
        self, user_id: str, order_amount: int, order_id: str
    ) -> PointsTransaction | None:
        """VIP购买奖励积分"""
        rate = POINTS_RULES["vip_purchase_rate"]
        amount = int(order_amount * rate / 100)  # order_amount是分，转换为积分
        if amount <= 0:
            return None
        return await self.earn_points(
            user_id=user_id,
            source=PointsSource.VIP_PURCHASE.value,
            amount=amount,
            reference_id=order_id,
            description="VIP购买奖励",
            check_daily_limit=False,  # VIP购买奖励不受每日上限限制
        )

    # ========== 积分消费 ==========

    async def spend_points(
        self,
        user_id: str,
        purpose: str,
        amount: int,
        reference_id: str | None = None,
        description: str | None = None,
    ) -> PointsTransaction | None:
        """消费积分"""
        if amount <= 0:
            return None

        account = await self.get_or_create_account(user_id)
        if account.available_balance < amount:
            return None

        account.balance -= amount
        account.total_spent += amount

        transaction = PointsTransaction(
            id=str(uuid.uuid4()),
            user_id=user_id,
            account_id=account.id,
            type=PointsTransactionType.SPEND.value,
            amount=-amount,
            balance_after=account.balance,
            source=purpose,
            reference_id=reference_id,
            description=description,
        )
        self.db.add(transaction)
        await self.db.commit()
        await self.db.refresh(transaction)
        return transaction

    # ========== 积分锁定（用于订单支付） ==========

    async def lock_points(
        self, user_id: str, order_id: str, amount: int
    ) -> PointsLock | None:
        """锁定积分"""
        if amount <= 0:
            return None

        account = await self.get_or_create_account(user_id)
        if account.available_balance < amount:
            return None

        account.locked += amount

        lock = PointsLock(
            id=str(uuid.uuid4()),
            user_id=user_id,
            account_id=account.id,
            order_id=order_id,
            amount=amount,
            status=PointsLockStatus.LOCKED.value,
        )
        self.db.add(lock)

        # 记录锁定交易
        transaction = PointsTransaction(
            id=str(uuid.uuid4()),
            user_id=user_id,
            account_id=account.id,
            type=PointsTransactionType.LOCK.value,
            amount=-amount,
            balance_after=account.available_balance,
            source="order_lock",
            reference_id=order_id,
            description="订单积分锁定",
        )
        self.db.add(transaction)

        await self.db.commit()
        await self.db.refresh(lock)
        return lock

    async def confirm_lock(self, lock_id: str) -> PointsLock | None:
        """确认锁定（支付成功后扣除积分）"""
        result = await self.db.execute(
            select(PointsLock).where(PointsLock.id == lock_id)
        )
        lock = result.scalar_one_or_none()
        if not lock or lock.status != PointsLockStatus.LOCKED.value:
            return None

        account = await self.get_account(lock.user_id)
        if not account:
            return None

        # 扣除积分
        account.balance -= lock.amount
        account.locked -= lock.amount
        account.total_spent += lock.amount

        lock.status = PointsLockStatus.CONFIRMED.value
        lock.resolved_at = datetime.utcnow()

        # 记录消费交易
        transaction = PointsTransaction(
            id=str(uuid.uuid4()),
            user_id=lock.user_id,
            account_id=account.id,
            type=PointsTransactionType.SPEND.value,
            amount=-lock.amount,
            balance_after=account.balance,
            source=PointsPurpose.ORDER_DISCOUNT.value,
            reference_id=lock.order_id,
            description="订单积分抵扣",
        )
        self.db.add(transaction)

        await self.db.commit()
        await self.db.refresh(lock)
        return lock

    async def release_lock(self, lock_id: str) -> PointsLock | None:
        """释放锁定（订单取消时返还积分）"""
        result = await self.db.execute(
            select(PointsLock).where(PointsLock.id == lock_id)
        )
        lock = result.scalar_one_or_none()
        if not lock or lock.status != PointsLockStatus.LOCKED.value:
            return None

        account = await self.get_account(lock.user_id)
        if not account:
            return None

        # 释放锁定
        account.locked -= lock.amount

        lock.status = PointsLockStatus.RELEASED.value
        lock.resolved_at = datetime.utcnow()

        # 记录解锁交易
        transaction = PointsTransaction(
            id=str(uuid.uuid4()),
            user_id=lock.user_id,
            account_id=account.id,
            type=PointsTransactionType.UNLOCK.value,
            amount=lock.amount,
            balance_after=account.available_balance,
            source="order_unlock",
            reference_id=lock.order_id,
            description="订单取消，积分释放",
        )
        self.db.add(transaction)

        await self.db.commit()
        await self.db.refresh(lock)
        return lock

    # ========== 积分抵扣计算 ==========

    def calculate_points_discount(
        self, points: int, order_amount: int
    ) -> tuple[int, int]:
        """计算积分抵扣金额
        
        Returns:
            (实际使用积分数, 抵扣金额(分))
        """
        if points <= 0 or order_amount <= 0:
            return 0, 0

        points_to_yuan = POINTS_RULES["points_to_yuan"]
        max_discount_rate = POINTS_RULES["max_discount_rate"]

        # 最大可抵扣金额
        max_discount = int(order_amount * max_discount_rate)
        
        # 积分可抵扣金额
        points_discount = (points // points_to_yuan) * 100  # 转换为分

        # 取较小值
        actual_discount = min(points_discount, max_discount)
        
        # 计算实际使用积分
        actual_points = (actual_discount // 100) * points_to_yuan

        return actual_points, actual_discount

    # ========== 交易记录 ==========

    async def get_transactions(
        self,
        user_id: str,
        transaction_type: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[PointsTransaction], int]:
        """获取积分交易记录"""
        query = select(PointsTransaction).where(
            PointsTransaction.user_id == user_id
        )

        if transaction_type:
            query = query.where(PointsTransaction.type == transaction_type)

        # 计算总数
        count_query = select(func.count(PointsTransaction.id)).where(
            PointsTransaction.user_id == user_id
        )
        if transaction_type:
            count_query = count_query.where(
                PointsTransaction.type == transaction_type
            )
        count_result = await self.db.execute(count_query)
        total = count_result.scalar() or 0

        # 分页查询
        query = query.order_by(PointsTransaction.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)

        result = await self.db.execute(query)
        transactions = list(result.scalars().all())

        return transactions, total

    # ========== 管理员操作 ==========

    async def admin_adjust_points(
        self,
        user_id: str,
        amount: int,
        reason: str,
        admin_id: str,
    ) -> PointsTransaction | None:
        """管理员调整积分"""
        account = await self.get_or_create_account(user_id)

        if amount > 0:
            account.balance += amount
            account.total_earned += amount
            trans_type = PointsTransactionType.EARN.value
        else:
            if account.balance < abs(amount):
                return None
            account.balance += amount  # amount是负数
            account.total_spent += abs(amount)
            trans_type = PointsTransactionType.SPEND.value

        transaction = PointsTransaction(
            id=str(uuid.uuid4()),
            user_id=user_id,
            account_id=account.id,
            type=trans_type,
            amount=amount,
            balance_after=account.balance,
            source=PointsSource.ADMIN_ADJUST.value,
            reference_id=admin_id,
            description=f"管理员调整: {reason}",
        )
        self.db.add(transaction)
        await self.db.commit()
        await self.db.refresh(transaction)
        return transaction

    # ========== 积分规则 ==========

    def get_points_rules(self) -> dict[str, Any]:
        """获取积分规则"""
        return {
            "earn_rules": {
                "daily_login": POINTS_RULES["daily_login"],
                "training_complete_min": POINTS_RULES["training_complete_min"],
                "training_complete_max": POINTS_RULES["training_complete_max"],
                "course_complete": POINTS_RULES["course_complete"],
                "scenario_share": POINTS_RULES["scenario_share"],
                "scenario_like": POINTS_RULES["scenario_like"],
                "invite_register": POINTS_RULES["invite_register"],
            },
            "spend_rules": {
                "points_to_yuan": POINTS_RULES["points_to_yuan"],
                "max_discount_rate": POINTS_RULES["max_discount_rate"],
            },
            "daily_limit": POINTS_RULES["daily_earn_limit"],
            "points_to_yuan": POINTS_RULES["points_to_yuan"],
            "max_discount_rate": POINTS_RULES["max_discount_rate"],
        }

    # ========== 会话积分消耗 ==========

    async def get_user_daily_sessions_used(self, user_id: str) -> int:
        """获取用户今日已使用的会话次数"""
        today_start = datetime.combine(date.today(), datetime.min.time())
        today_end = datetime.combine(date.today(), datetime.max.time())

        result = await self.db.execute(
            select(func.count(PointsTransaction.id)).where(
                and_(
                    PointsTransaction.user_id == user_id,
                    PointsTransaction.source == "session_consumption",
                    PointsTransaction.created_at >= today_start,
                    PointsTransaction.created_at <= today_end,
                )
            )
        )
        return result.scalar() or 0

    async def consume_session_points(
        self,
        user_id: str,
        session_id: str,
        points_cost: int,
        session_type: str,
        scenario_type: str,
        was_free: bool = False,
    ) -> PointsTransaction | None:
        """消耗会话积分
        
        Args:
            user_id: 用户ID
            session_id: 会话ID
            points_cost: 消耗积分数
            session_type: 会话类型 (text/voice)
            scenario_type: 场景类型
            was_free: 是否为免费会话
            
        Returns:
            积分交易记录，如果是免费会话则返回None
        """
        if was_free or points_cost <= 0:
            # 免费会话，只记录使用次数，不扣积分
            account = await self.get_or_create_account(user_id)
            transaction = PointsTransaction(
                id=str(uuid.uuid4()),
                user_id=user_id,
                account_id=account.id,
                type=PointsTransactionType.SPEND.value,
                amount=0,
                balance_after=account.balance,
                source="session_consumption",
                reference_id=session_id,
                description=f"免费{session_type}会话 ({scenario_type})",
            )
            self.db.add(transaction)
            await self.db.commit()
            await self.db.refresh(transaction)
            return transaction

        # 扣除积分
        account = await self.get_or_create_account(user_id)
        if account.available_balance < points_cost:
            return None

        account.balance -= points_cost
        account.total_spent += points_cost

        transaction = PointsTransaction(
            id=str(uuid.uuid4()),
            user_id=user_id,
            account_id=account.id,
            type=PointsTransactionType.SPEND.value,
            amount=-points_cost,
            balance_after=account.balance,
            source="session_consumption",
            reference_id=session_id,
            description=f"{session_type}会话消耗 ({scenario_type})",
        )
        self.db.add(transaction)
        await self.db.commit()
        await self.db.refresh(transaction)
        return transaction

    async def check_session_availability(
        self,
        user_id: str,
        points_cost: int,
        daily_free_limit: int,
    ) -> dict[str, Any]:
        """检查用户是否可以开始会话
        
        Args:
            user_id: 用户ID
            points_cost: 需要消耗的积分
            daily_free_limit: 每日免费次数限制 (-1表示无限)
            
        Returns:
            {
                "can_start": bool,
                "is_free": bool,
                "points_required": int,
                "free_remaining": int,
                "current_balance": int,
                "reason": str | None
            }
        """
        sessions_used = await self.get_user_daily_sessions_used(user_id)
        account = await self.get_or_create_account(user_id)
        current_balance = account.available_balance

        # 检查是否有免费次数
        if daily_free_limit == -1:
            # 无限免费
            return {
                "can_start": True,
                "is_free": True,
                "points_required": 0,
                "free_remaining": -1,
                "current_balance": current_balance,
                "reason": None,
            }

        free_remaining = max(0, daily_free_limit - sessions_used)
        
        if free_remaining > 0:
            # 还有免费次数
            return {
                "can_start": True,
                "is_free": True,
                "points_required": 0,
                "free_remaining": free_remaining,
                "current_balance": current_balance,
                "reason": None,
            }

        # 免费次数用完，检查积分
        if current_balance >= points_cost:
            return {
                "can_start": True,
                "is_free": False,
                "points_required": points_cost,
                "free_remaining": 0,
                "current_balance": current_balance,
                "reason": None,
            }

        # 积分不足
        return {
            "can_start": False,
            "is_free": False,
            "points_required": points_cost,
            "free_remaining": 0,
            "current_balance": current_balance,
            "reason": f"积分不足，需要{points_cost}积分，当前余额{current_balance}积分",
        }

    async def get_daily_session_status(
        self, user_id: str, daily_free_limit: int
    ) -> dict[str, Any]:
        """获取用户今日会话状态
        
        Args:
            user_id: 用户ID
            daily_free_limit: 每日免费次数限制 (-1表示无限)
            
        Returns:
            {
                "total_free": int,
                "used": int,
                "remaining": int,
                "is_unlimited": bool
            }
        """
        sessions_used = await self.get_user_daily_sessions_used(user_id)
        
        if daily_free_limit == -1:
            return {
                "total_free": -1,
                "used": sessions_used,
                "remaining": -1,
                "is_unlimited": True,
            }
        
        return {
            "total_free": daily_free_limit,
            "used": sessions_used,
            "remaining": max(0, daily_free_limit - sessions_used),
            "is_unlimited": False,
        }
