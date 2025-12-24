"""用户模型"""

from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.session import Session
    from app.models.training_plan import TrainingPlan
    from app.models.incentive import UserPoints
    from app.models.membership import Subscription
    from app.models.order import Order
    from app.models.points import PointsAccount
    from app.models.coupon import UserCoupon


class User(Base):
    """用户表"""

    __tablename__ = "users"

    # 手机号作为主要登录凭证
    phone: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    nickname: Mapped[str] = mapped_column(String(50), nullable=False)
    avatar: Mapped[str | None] = mapped_column(String(500), nullable=True)
    
    # 用户轨道和角色
    track: Mapped[str] = mapped_column(
        Enum("sales", "social", name="track_enum"),
        default="sales",
        nullable=False,
    )
    role: Mapped[str] = mapped_column(
        Enum("user", "admin", name="role_enum"),
        default="user",
        nullable=False,
    )
    level: Mapped[str] = mapped_column(String(50), default="新手学员", nullable=False)
    
    # 组织（可选）
    org_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # 关系
    profile: Mapped["Profile"] = relationship("Profile", back_populates="user", uselist=False)
    sessions: Mapped[list["Session"]] = relationship("Session", back_populates="user")
    training_plans: Mapped[list["TrainingPlan"]] = relationship(
        "TrainingPlan", back_populates="user"
    )
    points_record: Mapped["UserPoints | None"] = relationship(
        "UserPoints", back_populates="user", uselist=False
    )
    
    # VIP会员系统关系
    subscriptions: Mapped[list["Subscription"]] = relationship(
        "Subscription", back_populates="user"
    )
    orders: Mapped[list["Order"]] = relationship("Order", back_populates="user")
    points_account: Mapped["PointsAccount | None"] = relationship(
        "PointsAccount", back_populates="user", uselist=False
    )
    user_coupons: Mapped[list["UserCoupon"]] = relationship(
        "UserCoupon", back_populates="user"
    )


class Profile(Base):
    """用户画像表"""

    __tablename__ = "profiles"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    baseline_score: Mapped[float | None] = mapped_column(nullable=True)
    weak_dimensions: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    preferences: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Onboarding 引导数据
    goal: Mapped[str | None] = mapped_column(String(50), nullable=True)  # 目标: telesales/field_sales/negotiation 或 daily_social/workplace/public_speaking
    experience_level: Mapped[str | None] = mapped_column(String(20), nullable=True)  # 经验等级: beginner/intermediate/advanced
    daily_commitment_min: Mapped[int] = mapped_column(default=30, nullable=False)  # 每日投入时间(分钟)
    
    # 基线测评数据
    baseline_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    baseline_questionnaire: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)  # 问卷答案

    # 关系
    user: Mapped["User"] = relationship("User", back_populates="profile")


class VerificationCode(Base):
    """验证码表（用于忘记密码等）"""

    __tablename__ = "verification_codes"

    phone: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(10), nullable=False)
    purpose: Mapped[str] = mapped_column(
        Enum("register", "reset_password", "login", name="code_purpose_enum"),
        nullable=False,
    )
    is_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    expires_at: Mapped[str] = mapped_column(String(50), nullable=False)  # ISO格式时间
