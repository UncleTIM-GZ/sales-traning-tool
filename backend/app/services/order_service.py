"""
开发：Excellent（11964948@qq.com）
功能：订单服务
作用：管理订单创建、状态更新、自动取消
创建时间：2025-12-24
最后修改：2025-12-24
"""

import uuid
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.order import (
    Order,
    Refund,
    OrderStatus,
    PaymentMethod,
    ProductType,
    RefundStatus,
    generate_order_no,
    generate_refund_no,
)
from app.models.membership import MembershipLevel


# 订单超时时间（分钟）
ORDER_EXPIRE_MINUTES = 30


class OrderService:
    """订单服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ========== 订单查询 ==========

    async def get_order_by_id(self, order_id: str) -> Order | None:
        """根据ID获取订单"""
        result = await self.db.execute(
            select(Order).where(Order.id == order_id)
        )
        return result.scalar_one_or_none()

    async def get_order_by_no(self, order_no: str) -> Order | None:
        """根据订单号获取订单"""
        result = await self.db.execute(
            select(Order).where(Order.order_no == order_no)
        )
        return result.scalar_one_or_none()

    async def get_user_orders(
        self,
        user_id: str,
        status: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Order], int]:
        """获取用户订单列表"""
        query = select(Order).where(Order.user_id == user_id)
        
        if status:
            query = query.where(Order.status == status)
        
        # 计算总数
        count_result = await self.db.execute(
            select(Order.id).where(Order.user_id == user_id)
        )
        total = len(count_result.all())
        
        # 分页查询
        query = query.order_by(Order.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        
        result = await self.db.execute(query)
        orders = list(result.scalars().all())
        
        return orders, total

    # ========== 订单创建 ==========

    async def create_membership_order(
        self,
        user_id: str,
        level: MembershipLevel,
        duration_months: int,
        original_amount: int,
        discount_amount: int = 0,
        points_discount: int = 0,
        coupon_id: str | None = None,
        coupon_code: str | None = None,
        points_used: int = 0,
        points_lock_id: str | None = None,
    ) -> Order:
        """创建会员订阅订单"""
        duration_text = {
            1: "1个月",
            3: "3个月",
            6: "6个月",
            12: "12个月",
        }.get(duration_months, f"{duration_months}个月")

        final_amount = max(0, original_amount - discount_amount - points_discount)

        order = Order(
            id=str(uuid.uuid4()),
            order_no=generate_order_no(),
            user_id=user_id,
            product_type=ProductType.MEMBERSHIP.value,
            product_id=level.id,
            product_name=f"{level.display_name} - {duration_text}",
            product_desc=level.description,
            original_amount=original_amount,
            discount_amount=discount_amount,
            points_discount=points_discount,
            final_amount=final_amount,
            coupon_id=coupon_id,
            coupon_code=coupon_code,
            points_used=points_used,
            points_lock_id=points_lock_id,
            status=OrderStatus.PENDING.value,
            expires_at=datetime.utcnow() + timedelta(minutes=ORDER_EXPIRE_MINUTES),
        )
        self.db.add(order)
        await self.db.commit()
        await self.db.refresh(order)
        return order

    async def create_order(
        self,
        user_id: str,
        product_type: str,
        product_id: str,
        product_name: str,
        original_amount: int,
        product_desc: str | None = None,
        discount_amount: int = 0,
        points_discount: int = 0,
        coupon_id: str | None = None,
        coupon_code: str | None = None,
        points_used: int = 0,
        points_lock_id: str | None = None,
    ) -> Order:
        """创建通用订单"""
        final_amount = max(0, original_amount - discount_amount - points_discount)

        order = Order(
            id=str(uuid.uuid4()),
            order_no=generate_order_no(),
            user_id=user_id,
            product_type=product_type,
            product_id=product_id,
            product_name=product_name,
            product_desc=product_desc,
            original_amount=original_amount,
            discount_amount=discount_amount,
            points_discount=points_discount,
            final_amount=final_amount,
            coupon_id=coupon_id,
            coupon_code=coupon_code,
            points_used=points_used,
            points_lock_id=points_lock_id,
            status=OrderStatus.PENDING.value,
            expires_at=datetime.utcnow() + timedelta(minutes=ORDER_EXPIRE_MINUTES),
        )
        self.db.add(order)
        await self.db.commit()
        await self.db.refresh(order)
        return order

    # ========== 订单状态更新 ==========

    async def update_order_paying(
        self,
        order_id: str,
        payment_method: str,
        payment_channel: str,
    ) -> Order | None:
        """更新订单为支付中"""
        order = await self.get_order_by_id(order_id)
        if not order or not order.can_pay:
            return None

        order.status = OrderStatus.PAYING.value
        order.payment_method = payment_method
        order.payment_channel = payment_channel
        await self.db.commit()
        await self.db.refresh(order)
        return order

    async def update_order_paid(
        self,
        order_id: str,
        transaction_id: str,
    ) -> Order | None:
        """更新订单为已支付"""
        order = await self.get_order_by_id(order_id)
        if not order:
            return None
        
        # 幂等性检查
        if order.status == OrderStatus.PAID.value:
            return order

        if order.status not in [OrderStatus.PENDING.value, OrderStatus.PAYING.value]:
            return None

        order.status = OrderStatus.PAID.value
        order.transaction_id = transaction_id
        order.paid_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(order)
        return order

    async def update_order_failed(
        self, order_id: str, reason: str | None = None
    ) -> Order | None:
        """更新订单为支付失败"""
        order = await self.get_order_by_id(order_id)
        if not order:
            return None

        order.status = OrderStatus.FAILED.value
        await self.db.commit()
        await self.db.refresh(order)
        return order

    async def cancel_order(
        self, order_id: str, user_id: str | None = None
    ) -> Order | None:
        """取消订单"""
        order = await self.get_order_by_id(order_id)
        if not order:
            return None

        # 验证用户权限
        if user_id and order.user_id != user_id:
            return None

        # 只有待支付的订单可以取消
        if order.status != OrderStatus.PENDING.value:
            return None

        order.status = OrderStatus.CANCELLED.value
        order.cancelled_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(order)
        return order

    async def auto_cancel_expired_orders(self) -> int:
        """自动取消过期订单（定时任务调用）"""
        now = datetime.utcnow()
        result = await self.db.execute(
            select(Order).where(
                and_(
                    Order.status == OrderStatus.PENDING.value,
                    Order.expires_at <= now,
                )
            )
        )
        expired_orders = result.scalars().all()

        count = 0
        for order in expired_orders:
            order.status = OrderStatus.CANCELLED.value
            order.cancelled_at = now
            count += 1

        if count > 0:
            await self.db.commit()

        return count

    # ========== 退款 ==========

    async def create_refund(
        self,
        order_id: str,
        user_id: str,
        reason: str,
    ) -> Refund | None:
        """创建退款申请"""
        order = await self.get_order_by_id(order_id)
        if not order or not order.can_refund:
            return None

        if order.user_id != user_id:
            return None

        refund = Refund(
            id=str(uuid.uuid4()),
            refund_no=generate_refund_no(),
            order_id=order_id,
            user_id=user_id,
            amount=order.final_amount,
            reason=reason,
            status=RefundStatus.PENDING.value,
        )
        self.db.add(refund)

        # 更新订单状态
        order.status = OrderStatus.REFUNDING.value

        await self.db.commit()
        await self.db.refresh(refund)
        return refund

    async def update_refund_success(
        self, refund_id: str, third_party_refund_id: str
    ) -> Refund | None:
        """更新退款成功"""
        result = await self.db.execute(
            select(Refund).where(Refund.id == refund_id)
        )
        refund = result.scalar_one_or_none()
        if not refund:
            return None

        refund.status = RefundStatus.SUCCESS.value
        refund.refund_id = third_party_refund_id
        refund.processed_at = datetime.utcnow()

        # 更新订单状态
        order = await self.get_order_by_id(refund.order_id)
        if order:
            order.status = OrderStatus.REFUNDED.value

        await self.db.commit()
        await self.db.refresh(refund)
        return refund

    async def update_refund_failed(
        self, refund_id: str, error_msg: str
    ) -> Refund | None:
        """更新退款失败"""
        result = await self.db.execute(
            select(Refund).where(Refund.id == refund_id)
        )
        refund = result.scalar_one_or_none()
        if not refund:
            return None

        refund.status = RefundStatus.FAILED.value
        refund.error_msg = error_msg
        refund.processed_at = datetime.utcnow()

        # 恢复订单状态
        order = await self.get_order_by_id(refund.order_id)
        if order:
            order.status = OrderStatus.PAID.value

        await self.db.commit()
        await self.db.refresh(refund)
        return refund

    async def get_order_refunds(self, order_id: str) -> list[Refund]:
        """获取订单的退款记录"""
        result = await self.db.execute(
            select(Refund)
            .where(Refund.order_id == order_id)
            .order_by(Refund.created_at.desc())
        )
        return list(result.scalars().all())

    # ========== 统计 ==========

    async def get_order_stats(
        self, user_id: str | None = None
    ) -> dict[str, Any]:
        """获取订单统计"""
        query = select(Order)
        if user_id:
            query = query.where(Order.user_id == user_id)

        result = await self.db.execute(query)
        orders = result.scalars().all()

        stats = {
            "total": len(orders),
            "pending": 0,
            "paid": 0,
            "cancelled": 0,
            "refunded": 0,
            "total_amount": 0,
        }

        for order in orders:
            if order.status == OrderStatus.PENDING.value:
                stats["pending"] += 1
            elif order.status == OrderStatus.PAID.value:
                stats["paid"] += 1
                stats["total_amount"] += order.final_amount
            elif order.status == OrderStatus.CANCELLED.value:
                stats["cancelled"] += 1
            elif order.status == OrderStatus.REFUNDED.value:
                stats["refunded"] += 1

        return stats
