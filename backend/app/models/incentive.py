"""积分和成就模型"""

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class UserPoints(Base):
    """用户积分表"""

    __tablename__ = "user_points"


    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    level: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    
    # 经验值（用于升级）
    experience: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # 关系
    user: Mapped["User"] = relationship("User", back_populates="points_record")


class PointTransaction(Base):
    """积分交易记录"""

    __tablename__ = "point_transactions"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)  # 正数增加，负数减少
    type: Mapped[str] = mapped_column(String(50), nullable=False)  # session_complete, exam_complete, streak_bonus, etc.
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    reference_id: Mapped[str | None] = mapped_column(String(36), nullable=True)  # 关联的会话/报告ID
    balance_after: Mapped[int] = mapped_column(Integer, nullable=False)  # 交易后余额


class Achievement(Base):
    """成就定义表"""

    __tablename__ = "achievements"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    icon: Mapped[str] = mapped_column(String(50), nullable=False)  # emoji or icon name
    category: Mapped[str] = mapped_column(String(50), nullable=False)  # streak, score, session, social
    
    # 解锁条件（JSONB格式）
    # 示例: {"type": "streak_days", "value": 7}
    #       {"type": "score_above", "value": 90}
    #       {"type": "sessions_count", "value": 10}
    condition: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    
    # 奖励积分
    points_reward: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # 稀有度: common, rare, epic, legendary
    rarity: Mapped[str] = mapped_column(String(20), default="common", nullable=False)
    
    # 排序
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class UserAchievement(Base):
    """用户成就记录表"""

    __tablename__ = "user_achievements"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    achievement_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("achievements.id", ondelete="CASCADE"),
        nullable=False,
    )
    earned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )
    
    # 是否已查看
    is_viewed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # 关系
    achievement: Mapped["Achievement"] = relationship("Achievement")
