"""
开发：Excellent（11964948@qq.com）
功能：订单数据库模型
作用：定义订单、退款等数据结构
创建时间：2024-12-24
最后修改：2024-12-24
"""

import random
import string
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.membership import Subscription


class OrderStatus(str, Enum):
    """订单状态"""
    PENDING = "pending"      # 待支付
    PAYING = "paying"        # 支付中
    PAID = "paid"            # 已支付
    FAILED = "failed"        # 支付失败
    CANCELLED = "cancelled"  # 已取消
    REFUNDING = "refunding"  # 退款中
    REFUNDED = "refunded"    # 已退款


class PaymentMethod(str, Enum):
    """支付方式"""
    WECHAT = "wechat"
    ALIPAY = "alipay"


class PaymentChannel(str, Enum):
    """支付渠道"""
    # 微信
    WECHAT_NATIVE = "wechat_native"  # PC扫码
    WECHAT_JSAPI = "wechat_jsapi"    # 微信内
    WECHAT_H5 = "wechat_h5"          # 手机浏览器
    # 支付宝
    ALIPAY_PC = "alipay_pc"          # PC网页
    ALIPAY_WAP = "alipay_wap"        # 手机网页


class ProductType(str, Enum):
    """商品类型"""
    MEMBERSHIP = "membership"        # 会员订阅
    POINTS_PACKAGE = "points_package"  # 积分包
    SCENARIO = "scenario"            # 付费场景


class RefundStatus(str, Enum):
    """退款状态"""
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"


def generate_order_no() -> str:
    """生成订单号: yyyyMMddHHmmss + 6位随机数"""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    random_suffix = "".join(random.choices(string.digits, k=6))
    return f"{timestamp}{random_suffix}"


def generate_refund_no() -> str:
    """生成退款单号: R + yyyyMMddHHmmss + 6位随机数"""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    random_suffix = "".join(random.choices(string.digits, k=6))
    return f"R{timestamp}{random_suffix}"


class Order(Base):
    """订单"""
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    order_no: Mapped[str] = mapped_column(
        String(30), unique=True, index=True, default=generate_order_no
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True
    )

    # 商品信息
    product_type: Mapped[str] = mapped_column(String(20))
    product_id: Mapped[str] = mapped_column(String(36))
    product_name: Mapped[str] = mapped_column(String(200))
    product_desc: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # 金额 (单位: 分)
    original_amount: Mapped[int] = mapped_column(Integer)  # 原价
    discount_amount: Mapped[int] = mapped_column(Integer, default=0)  # 优惠金额
    points_discount: Mapped[int] = mapped_column(Integer, default=0)  # 积分抵扣金额
    final_amount: Mapped[int] = mapped_column(Integer)  # 实付金额

    # 优惠券
    coupon_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    coupon_code: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # 积分抵扣
    points_used: Mapped[int] = mapped_column(Integer, default=0)
    points_lock_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    # 支付信息
    payment_method: Mapped[str | None] = mapped_column(String(20), nullable=True)
    payment_channel: Mapped[str | None] = mapped_column(String(20), nullable=True)
    transaction_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # 状态
    status: Mapped[str] = mapped_column(
        String(20), default=OrderStatus.PENDING.value, index=True
    )

    # 时间
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)  # 支付超时时间

    # 关系
    user: Mapped["User"] = relationship("User", back_populates="orders")
    refunds: Mapped[list["Refund"]] = relationship("Refund", back_populates="order")
    subscription: Mapped["Subscription | None"] = relationship(
        "Subscription", back_populates="order", uselist=False
    )

    @property
    def is_expired(self) -> bool:
        """检查订单是否已过期"""
        return (
            self.status == OrderStatus.PENDING.value
            and datetime.utcnow() > self.expires_at
        )

    @property
    def can_pay(self) -> bool:
        """检查订单是否可支付"""
        return (
            self.status == OrderStatus.PENDING.value
            and datetime.utcnow() <= self.expires_at
        )

    @property
    def can_refund(self) -> bool:
        """检查订单是否可退款"""
        if self.status != OrderStatus.PAID.value:
            return False
        if not self.paid_at:
            return False
        # 7天内可退款
        days_since_paid = (datetime.utcnow() - self.paid_at).days
        return days_since_paid <= 7


class Refund(Base):
    """退款记录"""
    __tablename__ = "refunds"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    refund_no: Mapped[str] = mapped_column(
        String(30), unique=True, index=True, default=generate_refund_no
    )
    order_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("orders.id"), index=True
    )
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))

    amount: Mapped[int] = mapped_column(Integer)  # 退款金额 (分)
    reason: Mapped[str] = mapped_column(String(500))

    status: Mapped[str] = mapped_column(
        String(20), default=RefundStatus.PENDING.value
    )

    # 第三方退款信息
    refund_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_msg: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    processed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # 关系
    order: Mapped["Order"] = relationship("Order", back_populates="refunds")
