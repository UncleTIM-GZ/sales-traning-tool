"""
开发：Excellent（11964948@qq.com）
功能：会员系统数据库模型
作用：定义会员等级、用户订阅等数据结构
创建时间：2024-12-24
最后修改：2024-12-24
"""

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.order import Order


class MembershipLevelName(str, Enum):
    """会员等级名称"""
    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class SubscriptionStatus(str, Enum):
    """订阅状态"""
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class MembershipLevel(Base):
    """会员等级配置"""
    __tablename__ = "membership_levels"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # 价格配置 (单位: 分)
    price_monthly: Mapped[int] = mapped_column(Integer, default=0)
    price_quarterly: Mapped[int] = mapped_column(Integer, default=0)
    price_half_yearly: Mapped[int] = mapped_column(Integer, default=0)
    price_yearly: Mapped[int] = mapped_column(Integer, default=0)

    # 权益配置 (JSON)
    privileges: Mapped[dict] = mapped_column(JSON, default=dict)
    # privileges 字段结构:
    # {
    #   "daily_training_limit": 3,        # 每日训练次数限制 (-1表示无限)
    #   "voice_training_enabled": false,  # 是否启用语音训练
    #   "advanced_scenarios_enabled": false,  # 是否启用高级场景
    #   "custom_scenarios_limit": 0,      # 自定义场景数量限制
    #   "report_export_enabled": false,   # 是否可导出报告
    #   "priority_support": false,        # 是否优先客服
    #   "ai_coach_enabled": false,        # 是否启用AI教练
    # }

    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), onupdate=func.now()
    )

    # 关系
    subscriptions: Mapped[list["Subscription"]] = relationship(
        "Subscription", back_populates="level"
    )

    def get_price(self, duration_months: int) -> int:
        """获取指定时长的价格"""
        price_map = {
            1: self.price_monthly,
            3: self.price_quarterly,
            6: self.price_half_yearly,
            12: self.price_yearly,
        }
        return price_map.get(duration_months, self.price_monthly * duration_months)

    def get_privilege(self, key: str, default=None):
        """获取指定权益值"""
        return self.privileges.get(key, default)


class Subscription(Base):
    """用户订阅记录"""
    __tablename__ = "subscriptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True
    )
    level_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("membership_levels.id")
    )

    status: Mapped[str] = mapped_column(
        String(20), default=SubscriptionStatus.ACTIVE.value, index=True
    )
    started_at: Mapped[datetime] = mapped_column(DateTime)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)

    # 来源订单
    order_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("orders.id"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), onupdate=func.now()
    )

    # 关系
    user: Mapped["User"] = relationship("User", back_populates="subscriptions")
    level: Mapped["MembershipLevel"] = relationship(
        "MembershipLevel", back_populates="subscriptions"
    )
    order: Mapped["Order | None"] = relationship("Order", back_populates="subscription")

    @property
    def is_active(self) -> bool:
        """检查订阅是否有效"""
        return (
            self.status == SubscriptionStatus.ACTIVE.value
            and self.expires_at > datetime.utcnow()
        )

    @property
    def days_remaining(self) -> int:
        """剩余天数"""
        if not self.is_active:
            return 0
        delta = self.expires_at - datetime.utcnow()
        return max(0, delta.days)


# 默认会员等级配置
DEFAULT_MEMBERSHIP_LEVELS = [
    {
        "name": MembershipLevelName.FREE.value,
        "display_name": "免费版",
        "description": "基础功能，适合体验用户",
        "price_monthly": 0,
        "price_quarterly": 0,
        "price_half_yearly": 0,
        "price_yearly": 0,
        "privileges": {
            "daily_training_limit": 3,
            "voice_training_enabled": False,
            "advanced_scenarios_enabled": False,
            "custom_scenarios_limit": 1,
            "report_export_enabled": False,
            "priority_support": False,
            "ai_coach_enabled": False,
        },
        "sort_order": 0,
    },
    {
        "name": MembershipLevelName.PRO.value,
        "display_name": "专业版",
        "description": "解锁全部功能，适合个人用户",
        "price_monthly": 2900,  # 29元/月
        "price_quarterly": 7900,  # 79元/季 (约26.3元/月)
        "price_half_yearly": 14900,  # 149元/半年 (约24.8元/月)
        "price_yearly": 24900,  # 249元/年 (约20.8元/月)
        "privileges": {
            "daily_training_limit": -1,  # 无限
            "voice_training_enabled": True,
            "advanced_scenarios_enabled": True,
            "custom_scenarios_limit": 10,
            "report_export_enabled": True,
            "priority_support": False,
            "ai_coach_enabled": True,
        },
        "sort_order": 1,
    },
    {
        "name": MembershipLevelName.ENTERPRISE.value,
        "display_name": "企业版",
        "description": "团队协作功能，适合企业用户",
        "price_monthly": 9900,  # 99元/月
        "price_quarterly": 26900,  # 269元/季
        "price_half_yearly": 49900,  # 499元/半年
        "price_yearly": 89900,  # 899元/年
        "privileges": {
            "daily_training_limit": -1,
            "voice_training_enabled": True,
            "advanced_scenarios_enabled": True,
            "custom_scenarios_limit": -1,  # 无限
            "report_export_enabled": True,
            "priority_support": True,
            "ai_coach_enabled": True,
            "team_management": True,
            "custom_branding": True,
            "api_access": True,
        },
        "sort_order": 2,
    },
]
