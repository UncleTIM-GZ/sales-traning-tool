"""
开发：Excellent（11964948@qq.com）
功能：积分系统数据库模型
作用：定义积分账户、交易记录、锁定记录等数据结构
创建时间：2024-12-24
最后修改：2024-12-24
"""

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.order import Order


class PointsSource(str, Enum):
    """积分来源"""
    DAILY_LOGIN = "daily_login"           # 每日登录
    TRAINING_COMPLETE = "training_complete"  # 完成训练
    COURSE_COMPLETE = "course_complete"    # 完成课程
    SCENARIO_SHARE = "scenario_share"      # 分享场景
    SCENARIO_LIKE = "scenario_like"        # 场景被点赞
    INVITE_REGISTER = "invite_register"    # 邀请注册
    VIP_PURCHASE = "vip_purchase"          # VIP购买奖励
    ADMIN_ADJUST = "admin_adjust"          # 管理员调整
    POINTS_REDEEM = "points_redeem"        # 积分兑换


class PointsPurpose(str, Enum):
    """积分用途"""
    COUPON_REDEEM = "coupon_redeem"        # 兑换优惠券
    ORDER_DISCOUNT = "order_discount"      # 订单抵扣
    SCENARIO_UNLOCK = "scenario_unlock"    # 解锁场景
    ADMIN_ADJUST = "admin_adjust"          # 管理员调整


class PointsLockStatus(str, Enum):
    """积分锁定状态"""
    LOCKED = "locked"
    CONFIRMED = "confirmed"
    RELEASED = "released"


class PointsTransactionType(str, Enum):
    """积分交易类型"""
    EARN = "earn"
    SPEND = "spend"
    LOCK = "lock"
    UNLOCK = "unlock"


class PointsAccount(Base):
    """用户积分账户"""
    __tablename__ = "points_accounts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), unique=True, index=True
    )

    balance: Mapped[int] = mapped_column(Integer, default=0)  # 可用积分
    locked: Mapped[int] = mapped_column(Integer, default=0)   # 锁定积分
    total_earned: Mapped[int] = mapped_column(Integer, default=0)  # 累计获取
    total_spent: Mapped[int] = mapped_column(Integer, default=0)   # 累计消费

    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), onupdate=func.now()
    )

    # 关系
    user: Mapped["User"] = relationship("User", back_populates="points_account")
    transactions: Mapped[list["PointsTransaction"]] = relationship(
        "PointsTransaction", back_populates="account"
    )
    locks: Mapped[list["PointsLock"]] = relationship(
        "PointsLock", back_populates="account"
    )

    @property
    def available_balance(self) -> int:
        """可用余额（总余额 - 锁定）"""
        return max(0, self.balance - self.locked)


class PointsTransaction(Base):
    """积分交易记录"""
    __tablename__ = "points_transactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True
    )
    account_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("points_accounts.id"), index=True
    )

    type: Mapped[str] = mapped_column(String(10))  # earn, spend, lock, unlock
    amount: Mapped[int] = mapped_column(Integer)   # 正数表示增加，负数表示减少
    balance_after: Mapped[int] = mapped_column(Integer)  # 交易后余额

    # 来源/用途
    source: Mapped[str] = mapped_column(String(50))
    reference_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    description: Mapped[str | None] = mapped_column(String(200), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), index=True
    )

    # 关系
    account: Mapped["PointsAccount"] = relationship(
        "PointsAccount", back_populates="transactions"
    )


class PointsLock(Base):
    """积分锁定记录（用于订单支付）"""
    __tablename__ = "points_locks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True
    )
    account_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("points_accounts.id"), index=True
    )
    order_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("orders.id"), index=True
    )

    amount: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(
        String(20), default=PointsLockStatus.LOCKED.value
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # 关系
    account: Mapped["PointsAccount"] = relationship(
        "PointsAccount", back_populates="locks"
    )
    order: Mapped["Order"] = relationship("Order")


# 积分规则配置
POINTS_RULES = {
    # 获取规则
    "daily_login": 10,           # 每日登录
    "training_complete_min": 20,  # 完成训练最低
    "training_complete_max": 50,  # 完成训练最高
    "course_complete": 30,        # 完成课程
    "scenario_share": 50,         # 分享场景
    "scenario_like": 5,           # 场景被点赞
    "invite_register": 100,       # 邀请注册
    "vip_purchase_rate": 0.1,     # VIP购买奖励比例 (10%)

    # 限制规则
    "daily_earn_limit": 500,      # 每日获取上限

    # 消费规则
    "points_to_yuan": 100,        # 100积分 = 1元
    "max_discount_rate": 0.5,     # 最大抵扣比例 (50%)
}
