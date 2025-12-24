"""用户设置模型"""

from typing import TYPE_CHECKING, Any

from sqlalchemy import ForeignKey, Text, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class UserSettings(Base):
    """用户设置表"""

    __tablename__ = "user_settings"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    
    # 个人简介
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # 通知设置
    notifications: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=lambda: {
            "training": True,
            "report": True,
            "community": False,
            "marketing": False,
        },
        nullable=False,
    )
    
    # 隐私设置
    privacy: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=lambda: {
            "show_profile": True,
            "show_rank": True,
            "show_activity": False,
        },
        nullable=False,
    )

    # 关系
    user: Mapped["User"] = relationship("User")
