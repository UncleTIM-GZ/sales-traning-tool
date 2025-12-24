"""
开发：Excellent（11964948@qq.com）
功能：优惠券数据库模型
作用：定义优惠券、用户优惠券等数据结构
创建时间：2024-12-24
最后修改：2024-12-24
"""

import random
import string
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class CouponType(str, Enum):
    """优惠券类型"""
    FIXED = "fixed"          # 固定金额
    PERCENTAGE = "percentage"  # 百分比折扣


class CouponStatus(str, Enum):
    """优惠券状态"""
    ACTIVE = "active"
    DISABLED = "disabled"


class UserCouponStatus(str, Enum):
    """用户优惠券状态"""
    AVAILABLE = "available"
    USED = "used"
    EXPIRED = "expired"


def generate_coupon_code(length: int = 8) -> str:
    """生成优惠券码"""
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=length))


class Coupon(Base):
    """优惠券"""
    __tablename__ = "coupons"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    code: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, default=generate_coupon_code
    )
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)

    type: Mapped[str] = mapped_column(String(20))  # fixed, percentage
    value: Mapped[int] = mapped_column(Integer)
    # fixed: 金额(分), percentage: 百分比(1-100)
    max_discount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # percentage类型的最大折扣金额

    min_order_amount: Mapped[int] = mapped_column(Integer, default=0)  # 最低订单金额

    # 适用范围
    applicable_products: Mapped[list | None] = mapped_column(JSON, nullable=True)
    # 适用商品类型列表，如 ["membership", "scenario"]

    # 有效期
    valid_from: Mapped[datetime] = mapped_column(DateTime)
    valid_until: Mapped[datetime] = mapped_column(DateTime)

    # 使用限制
    usage_limit: Mapped[int] = mapped_column(Integer, default=-1)  # -1表示无限
    used_count: Mapped[int] = mapped_column(Integer, default=0)
    per_user_limit: Mapped[int] = mapped_column(Integer, default=1)  # 每用户限用次数

    # 指定用户 (NULL表示所有用户可用)
    user_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), onupdate=func.now()
    )

    # 关系
    user_coupons: Mapped[list["UserCoupon"]] = relationship(
        "UserCoupon", back_populates="coupon"
    )

    @property
    def is_valid(self) -> bool:
        """检查优惠券是否有效"""
        now = datetime.utcnow()
        if not self.is_active:
            return False
        if now < self.valid_from or now > self.valid_until:
            return False
        if self.usage_limit != -1 and self.used_count >= self.usage_limit:
            return False
        return True

    def calculate_discount(self, order_amount: int) -> int:
        """计算折扣金额"""
        if order_amount < self.min_order_amount:
            return 0

        if self.type == CouponType.FIXED.value:
            return min(self.value, order_amount)
        elif self.type == CouponType.PERCENTAGE.value:
            discount = int(order_amount * self.value / 100)
            if self.max_discount:
                discount = min(discount, self.max_discount)
            return min(discount, order_amount)
        return 0

    def is_applicable_to(self, product_type: str) -> bool:
        """检查是否适用于指定商品类型"""
        if not self.applicable_products:
            return True
        return product_type in self.applicable_products

    def is_user_eligible(self, user_id: str) -> bool:
        """检查用户是否有资格使用"""
        if not self.user_ids:
            return True
        return user_id in self.user_ids


class UserCoupon(Base):
    """用户领取的优惠券"""
    __tablename__ = "user_coupons"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True
    )
    coupon_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("coupons.id"), index=True
    )

    status: Mapped[str] = mapped_column(
        String(20), default=UserCouponStatus.AVAILABLE.value
    )
    used_order_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    received_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # 关系
    user: Mapped["User"] = relationship("User", back_populates="user_coupons")
    coupon: Mapped["Coupon"] = relationship("Coupon", back_populates="user_coupons")

    @property
    def is_available(self) -> bool:
        """检查用户优惠券是否可用"""
        if self.status != UserCouponStatus.AVAILABLE.value:
            return False
        return self.coupon.is_valid
