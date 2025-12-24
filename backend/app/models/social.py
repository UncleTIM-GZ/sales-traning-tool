"""社交模块模型 - 分享与邀请"""

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

if TYPE_CHECKING:
    pass


class Referral(Base):
    """邀请记录表"""

    __tablename__ = "referrals"

    # 邀请人
    referrer_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    
    # 被邀请人
    referee_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    
    # 邀请码
    invite_code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    
    # 状态: pending, registered, completed (首次对练后)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    
    # 奖励是否已发放
    referrer_reward_claimed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    referee_reward_claimed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # 完成时间
    registered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class InviteCode(Base):
    """邀请码表"""

    __tablename__ = "invite_codes"

    user_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,  # 系统生成的邀请码可以没有关联用户
        index=True,
    )
    
    # 邀请码名称
    name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    
    # 邀请码（唯一）
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    
    # 渠道类型: wechat, douyin, xiaohongshu, weibo, official, custom
    channel: Mapped[str] = mapped_column(String(50), default="official", nullable=False)
    
    # 奖励类型: points, vip_days, none
    reward_type: Mapped[str] = mapped_column(String(20), default="points", nullable=False)
    
    # 奖励值
    reward_value: Mapped[int] = mapped_column(default=100, nullable=False)
    
    # 使用次数
    use_count: Mapped[int] = mapped_column(default=0, nullable=False)
    
    # 最大使用次数（0表示无限）
    max_uses: Mapped[int] = mapped_column(default=0, nullable=False)
    
    # 过期时间
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # 是否激活
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class ShareRecord(Base):
    """分享记录表"""

    __tablename__ = "share_records"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    
    # 分享类型: report, achievement, leaderboard, invite
    share_type: Mapped[str] = mapped_column(String(50), nullable=False)
    
    # 关联内容ID（可选）
    content_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    
    # 分享渠道: wechat, wechat_moments, copy_link, poster
    channel: Mapped[str] = mapped_column(String(50), nullable=False)
    
    # 分享URL或海报URL
    share_url: Mapped[str | None] = mapped_column(Text, nullable=True)
