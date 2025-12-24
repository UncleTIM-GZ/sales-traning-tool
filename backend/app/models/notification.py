"""通知模型"""

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class Notification(Base):
    """通知表"""

    __tablename__ = "notifications"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    
    # 通知类型: achievement_unlock, task_reminder, session_complete, 
    #          course_progress, community_like, community_comment, system_announcement
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    
    # 通知内容
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)  # emoji or icon name
    
    # 关联数据（可选）
    action_type: Mapped[str | None] = mapped_column(String(50), nullable=True)  # link, modal, etc.
    action_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    action_data: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    
    # 状态
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # 优先级: low, normal, high, urgent
    priority: Mapped[str] = mapped_column(String(20), default="normal", nullable=False)


class NotificationPreference(Base):
    """通知偏好设置表"""

    __tablename__ = "notification_preferences"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    
    # 通知开关
    achievement_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    task_reminder_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    session_complete_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    community_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    system_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # 每日提醒时间 (HH:MM 格式)
    daily_reminder_time: Mapped[str | None] = mapped_column(String(10), nullable=True)
    daily_reminder_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
