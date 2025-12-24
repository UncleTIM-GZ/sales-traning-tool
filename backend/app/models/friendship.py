"""好友关系模型

包含好友请求、好友关系等社交功能相关的数据模型。
"""

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class Friendship(Base):
    """好友关系表"""

    __tablename__ = "friendships"

    # 用户A (发起者)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    # 用户B (接受者)
    friend_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    
    # 状态: pending=待确认, accepted=已接受, blocked=已屏蔽
    status: Mapped[str] = mapped_column(
        Enum("pending", "accepted", "blocked", name="friendship_status_enum", create_type=False),
        default="pending",
        nullable=False,
    )
    
    # 备注名
    remark: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # 关系
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    friend: Mapped["User"] = relationship("User", foreign_keys=[friend_id])


class FriendRequest(Base):
    """好友请求表"""

    __tablename__ = "friend_requests"

    # 发送者
    sender_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    # 接收者
    receiver_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    
    # 请求消息
    message: Mapped[str | None] = mapped_column(String(200), nullable=True)
    
    # 状态: pending=待处理, accepted=已接受, rejected=已拒绝
    status: Mapped[str] = mapped_column(
        Enum("pending", "accepted", "rejected", name="friend_request_status_enum", create_type=False),
        default="pending",
        nullable=False,
    )

    # 关系
    sender: Mapped["User"] = relationship("User", foreign_keys=[sender_id])
    receiver: Mapped["User"] = relationship("User", foreign_keys=[receiver_id])
