"""社区模型"""

from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class Post(Base):
    """社区动态表"""

    __tablename__ = "posts"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    
    content: Mapped[str] = mapped_column(Text, nullable=False)
    images: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    
    # 统计
    likes_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    comments_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # 状态
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # 关系
    user: Mapped["User"] = relationship("User")
    likes: Mapped[list["PostLike"]] = relationship("PostLike", back_populates="post")
    comments: Mapped[list["PostComment"]] = relationship("PostComment", back_populates="post")


class PostLike(Base):
    """动态点赞表"""

    __tablename__ = "post_likes"

    post_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("posts.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    # 关系
    post: Mapped["Post"] = relationship("Post", back_populates="likes")
    user: Mapped["User"] = relationship("User")


class PostComment(Base):
    """动态评论表"""

    __tablename__ = "post_comments"

    post_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("posts.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    
    content: Mapped[str] = mapped_column(Text, nullable=False)
    
    # 回复的评论ID（null表示顶级评论）
    parent_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("post_comments.id", ondelete="CASCADE"),
        nullable=True,
    )
    
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # 关系
    post: Mapped["Post"] = relationship("Post", back_populates="comments")
    user: Mapped["User"] = relationship("User")
    parent: Mapped["PostComment | None"] = relationship("PostComment", remote_side="PostComment.id")


class Challenge(Base):
    """挑战赛表"""

    __tablename__ = "challenges"

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    
    # 时间
    start_time: Mapped[str] = mapped_column(String(50), nullable=False)  # ISO格式
    end_time: Mapped[str] = mapped_column(String(50), nullable=False)
    
    # 奖励
    reward: Mapped[str] = mapped_column(String(200), nullable=False)
    
    # 规则
    rules: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    
    # 统计
    participant_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # 状态
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # 关系
    participants: Mapped[list["ChallengeParticipant"]] = relationship(
        "ChallengeParticipant", back_populates="challenge"
    )


class ChallengeParticipant(Base):
    """挑战参与表"""

    __tablename__ = "challenge_participants"

    challenge_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("challenges.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    
    # 进度
    progress: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # 完成时间
    completed_at: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # 关系
    challenge: Mapped["Challenge"] = relationship("Challenge", back_populates="participants")
    user: Mapped["User"] = relationship("User")


class Leaderboard(Base):
    """排行榜表（定期更新）"""

    __tablename__ = "leaderboard"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    
    score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rank: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    period: Mapped[str] = mapped_column(
        Enum("weekly", "monthly", "all_time", name="leaderboard_period_enum"),
        default="weekly",
        nullable=False,
    )
    
    # 排名变化
    rank_change: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # 关系
    user: Mapped["User"] = relationship("User")
