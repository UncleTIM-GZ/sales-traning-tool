"""
开发：Excellent（11964948@qq.com）
功能：优惠券服务
作用：管理优惠券创建、验证、使用、恢复
创建时间：2025-12-24
最后修改：2025-12-24
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.coupon import (
    Coupon,
    UserCoupon,
    CouponType,
    CouponStatus,
    UserCouponStatus,
    generate_coupon_code,
)


class CouponService:
    """优惠券服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ========== 优惠券查询 ==========

    async def get_coupon_by_id(self, coupon_id: str) -> Coupon | None:
        """根据ID获取优惠券"""
        result = await self.db.execute(
            select(Coupon).where(Coupon.id == coupon_id)
        )
        return result.scalar_one_or_none()

    async def get_coupon_by_code(self, code: str) -> Coupon | None:
        """根据优惠券码获取优惠券"""
        result = await self.db.execute(
            select(Coupon).where(Coupon.code == code)
        )
        return result.scalar_one_or_none()

    async def get_active_coupons(
        self, page: int = 1, page_size: int = 20
    ) -> tuple[list[Coupon], int]:
        """获取有效优惠券列表"""
        now = datetime.utcnow()
        query = select(Coupon).where(
            and_(
                Coupon.is_active == True,
                Coupon.valid_from <= now,
                Coupon.valid_until >= now,
            )
        )

        # 计算总数
        count_result = await self.db.execute(
            select(func.count(Coupon.id)).where(
                and_(
                    Coupon.is_active == True,
                    Coupon.valid_from <= now,
                    Coupon.valid_until >= now,
                )
            )
        )
        total = count_result.scalar() or 0

        # 分页
        query = query.order_by(Coupon.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)

        result = await self.db.execute(query)
        coupons = list(result.scalars().all())

        return coupons, total

    # ========== 用户优惠券 ==========

    async def get_user_coupons(
        self,
        user_id: str,
        status: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[UserCoupon], int]:
        """获取用户优惠券列表"""
        query = (
            select(UserCoupon)
            .options(selectinload(UserCoupon.coupon))
            .where(UserCoupon.user_id == user_id)
        )

        if status:
            query = query.where(UserCoupon.status == status)

        # 计算总数
        count_query = select(func.count(UserCoupon.id)).where(
            UserCoupon.user_id == user_id
        )
        if status:
            count_query = count_query.where(UserCoupon.status == status)
        count_result = await self.db.execute(count_query)
        total = count_result.scalar() or 0

        # 分页
        query = query.order_by(UserCoupon.received_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)

        result = await self.db.execute(query)
        user_coupons = list(result.scalars().all())

        return user_coupons, total

    async def get_user_available_coupons(
        self, user_id: str, product_type: str | None = None, order_amount: int = 0
    ) -> list[UserCoupon]:
        """获取用户可用优惠券"""
        now = datetime.utcnow()
        query = (
            select(UserCoupon)
            .options(selectinload(UserCoupon.coupon))
            .where(
                and_(
                    UserCoupon.user_id == user_id,
                    UserCoupon.status == UserCouponStatus.AVAILABLE.value,
                )
            )
        )

        result = await self.db.execute(query)
        user_coupons = result.scalars().all()

        # 过滤有效且适用的优惠券
        available = []
        for uc in user_coupons:
            coupon = uc.coupon
            if not coupon or not coupon.is_valid:
                continue
            if order_amount > 0 and order_amount < coupon.min_order_amount:
                continue
            if product_type and not coupon.is_applicable_to(product_type):
                continue
            available.append(uc)

        return available

    # ========== 优惠券领取 ==========

    async def claim_coupon(
        self, user_id: str, coupon_code: str
    ) -> tuple[UserCoupon | None, str]:
        """领取优惠券
        
        Returns:
            (UserCoupon | None, error_message)
        """
        coupon = await self.get_coupon_by_code(coupon_code)
        if not coupon:
            return None, "优惠券不存在"

        if not coupon.is_valid:
            return None, "优惠券已失效"

        if not coupon.is_user_eligible(user_id):
            return None, "您不符合领取条件"

        # 检查用户是否已领取
        result = await self.db.execute(
            select(func.count(UserCoupon.id)).where(
                and_(
                    UserCoupon.user_id == user_id,
                    UserCoupon.coupon_id == coupon.id,
                )
            )
        )
        claimed_count = result.scalar() or 0

        if claimed_count >= coupon.per_user_limit:
            return None, "已达到领取上限"

        # 检查总领取数量
        if coupon.usage_limit != -1 and coupon.used_count >= coupon.usage_limit:
            return None, "优惠券已被领完"

        # 创建用户优惠券
        user_coupon = UserCoupon(
            id=str(uuid.uuid4()),
            user_id=user_id,
            coupon_id=coupon.id,
            status=UserCouponStatus.AVAILABLE.value,
        )
        self.db.add(user_coupon)

        # 更新领取数量
        coupon.used_count += 1

        await self.db.commit()
        await self.db.refresh(user_coupon)

        return user_coupon, ""

    # ========== 优惠券验证 ==========

    async def validate_coupon(
        self,
        user_id: str,
        coupon_code: str,
        order_amount: int,
        product_type: str,
    ) -> tuple[Coupon | None, int, str]:
        """验证优惠券
        
        Returns:
            (Coupon | None, discount_amount, error_message)
        """
        coupon = await self.get_coupon_by_code(coupon_code)
        if not coupon:
            return None, 0, "优惠券不存在"

        if not coupon.is_valid:
            return None, 0, "优惠券已失效"

        if not coupon.is_user_eligible(user_id):
            return None, 0, "您不符合使用条件"

        if not coupon.is_applicable_to(product_type):
            return None, 0, "优惠券不适用于此商品"

        if order_amount < coupon.min_order_amount:
            return None, 0, f"订单金额需满{coupon.min_order_amount / 100}元"

        # 检查用户是否有可用的此优惠券
        result = await self.db.execute(
            select(UserCoupon).where(
                and_(
                    UserCoupon.user_id == user_id,
                    UserCoupon.coupon_id == coupon.id,
                    UserCoupon.status == UserCouponStatus.AVAILABLE.value,
                )
            )
        )
        user_coupon = result.scalar_one_or_none()

        if not user_coupon:
            return None, 0, "您没有此优惠券"

        discount = coupon.calculate_discount(order_amount)
        return coupon, discount, ""

    # ========== 优惠券使用 ==========

    async def use_coupon(
        self, user_id: str, coupon_id: str, order_id: str
    ) -> UserCoupon | None:
        """使用优惠券"""
        result = await self.db.execute(
            select(UserCoupon).where(
                and_(
                    UserCoupon.user_id == user_id,
                    UserCoupon.coupon_id == coupon_id,
                    UserCoupon.status == UserCouponStatus.AVAILABLE.value,
                )
            )
        )
        user_coupon = result.scalar_one_or_none()

        if not user_coupon:
            return None

        user_coupon.status = UserCouponStatus.USED.value
        user_coupon.used_order_id = order_id
        user_coupon.used_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(user_coupon)
        return user_coupon

    async def restore_coupon(self, user_id: str, order_id: str) -> UserCoupon | None:
        """恢复优惠券（订单取消时）"""
        result = await self.db.execute(
            select(UserCoupon).where(
                and_(
                    UserCoupon.user_id == user_id,
                    UserCoupon.used_order_id == order_id,
                    UserCoupon.status == UserCouponStatus.USED.value,
                )
            )
        )
        user_coupon = result.scalar_one_or_none()

        if not user_coupon:
            return None

        # 检查优惠券是否还在有效期内
        coupon = await self.get_coupon_by_id(user_coupon.coupon_id)
        if coupon and coupon.valid_until > datetime.utcnow():
            user_coupon.status = UserCouponStatus.AVAILABLE.value
            user_coupon.used_order_id = None
            user_coupon.used_at = None
        else:
            user_coupon.status = UserCouponStatus.EXPIRED.value

        await self.db.commit()
        await self.db.refresh(user_coupon)
        return user_coupon

    # ========== 管理员操作 ==========

    async def create_coupon(
        self,
        name: str,
        coupon_type: str,
        value: int,
        valid_from: datetime,
        valid_until: datetime,
        code: str | None = None,
        description: str | None = None,
        max_discount: int | None = None,
        min_order_amount: int = 0,
        applicable_products: list[str] | None = None,
        usage_limit: int = -1,
        per_user_limit: int = 1,
        user_ids: list[str] | None = None,
    ) -> Coupon:
        """创建优惠券"""
        coupon = Coupon(
            id=str(uuid.uuid4()),
            code=code or generate_coupon_code(),
            name=name,
            description=description,
            type=coupon_type,
            value=value,
            max_discount=max_discount,
            min_order_amount=min_order_amount,
            applicable_products=applicable_products,
            valid_from=valid_from,
            valid_until=valid_until,
            usage_limit=usage_limit,
            per_user_limit=per_user_limit,
            user_ids=user_ids,
            is_active=True,
        )
        self.db.add(coupon)
        await self.db.commit()
        await self.db.refresh(coupon)
        return coupon

    async def update_coupon(
        self, coupon_id: str, updates: dict[str, Any]
    ) -> Coupon | None:
        """更新优惠券"""
        coupon = await self.get_coupon_by_id(coupon_id)
        if not coupon:
            return None

        for key, value in updates.items():
            if hasattr(coupon, key) and value is not None:
                setattr(coupon, key, value)

        await self.db.commit()
        await self.db.refresh(coupon)
        return coupon

    async def get_all_coupons(
        self, page: int = 1, page_size: int = 20
    ) -> tuple[list[Coupon], int]:
        """获取所有优惠券（管理后台）"""
        count_result = await self.db.execute(select(func.count(Coupon.id)))
        total = count_result.scalar() or 0

        query = select(Coupon).order_by(Coupon.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)

        result = await self.db.execute(query)
        coupons = list(result.scalars().all())

        return coupons, total

    # ========== 过期处理 ==========

    async def expire_user_coupons(self) -> int:
        """过期用户优惠券（定时任务）"""
        now = datetime.utcnow()
        
        # 查找已过期但状态还是available的用户优惠券
        result = await self.db.execute(
            select(UserCoupon)
            .options(selectinload(UserCoupon.coupon))
            .where(UserCoupon.status == UserCouponStatus.AVAILABLE.value)
        )
        user_coupons = result.scalars().all()

        count = 0
        for uc in user_coupons:
            if uc.coupon and uc.coupon.valid_until < now:
                uc.status = UserCouponStatus.EXPIRED.value
                count += 1

        if count > 0:
            await self.db.commit()

        return count
