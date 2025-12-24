"""场景社交模型

包含场景点赞、评论、收藏、分享等社交功能相关的数据模型。
"""

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.scenario import Scenario
    from app.models.user import User
    from app.models.community import Post


class ScenarioLike(Base):
    """场景点赞表"""

    __tablename__ = "scenario_likes"

    scenario_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("scenarios.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    # 关系
    scenario: Mapped["Scenario"] = relationship("Scenario")
    user: Mapped["User"] = relationship("User")


class ScenarioComment(Base):
    """场景评论表"""

    __tablename__ = "scenario_comments"

    scenario_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("scenarios.id", ondelete="CASCADE"),
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
        ForeignKey("scenario_comments.id", ondelete="CASCADE"),
        nullable=True,
    )
    
    # 点赞数
    likes_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # 是否删除
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # 关系
    scenario: Mapped["Scenario"] = relationship("Scenario")
    user: Mapped["User"] = relationship("User")
    parent: Mapped["ScenarioComment | None"] = relationship(
        "ScenarioComment", remote_side="ScenarioComment.id"
    )


class ScenarioCollection(Base):
    """场景收藏表"""

    __tablename__ = "scenario_collections"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    scenario_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("scenarios.id", ondelete="CASCADE"),
        nullable=False,
    )
    
    # 收藏夹分类
    folder: Mapped[str] = mapped_column(String(50), default="默认收藏夹", nullable=False)

    # 关系
    user: Mapped["User"] = relationship("User")
    scenario: Mapped["Scenario"] = relationship("Scenario")


class ScenarioShare(Base):
    """场景分享记录表"""

    __tablename__ = "scenario_shares"

    scenario_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("scenarios.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    
    # 分享类型: post=发到动态, wechat=微信, poster=海报
    share_type: Mapped[str] = mapped_column(String(20), nullable=False)
    
    # 关联的动态ID（如果分享到动态）
    post_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("posts.id", ondelete="SET NULL"),
        nullable=True,
    )

    # 关系
    scenario: Mapped["Scenario"] = relationship("Scenario")
    user: Mapped["User"] = relationship("User")
    post: Mapped["Post | None"] = relationship("Post")


class Creator(Base):
    """创作者信息表"""

    __tablename__ = "creators"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    
    # 统计数据
    scenario_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_trains: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_likes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    followers_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    following_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # 认证状态
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # 等级
    creator_level: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    
    # 简介
    bio: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # 关系
    user: Mapped["User"] = relationship("User")


class CreatorFollow(Base):
    """创作者关注表"""

    __tablename__ = "creator_follows"

    follower_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    creator_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("creators.id", ondelete="CASCADE"),
        nullable=False,
    )

    # 关系
    follower: Mapped["User"] = relationship("User", foreign_keys=[follower_id])
    creator: Mapped["Creator"] = relationship("Creator")


class ScenarioReport(Base):
    """场景举报表"""

    __tablename__ = "scenario_reports"

    scenario_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("scenarios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reporter_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    
    # 举报原因: inappropriate, spam, copyright, other
    reason: Mapped[str] = mapped_column(String(50), nullable=False)
    
    # 详细描述
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # 状态: pending, handled, dismissed
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    
    # 处理结果: removed, warned, dismissed
    result: Mapped[str | None] = mapped_column(String(20), nullable=True)
    
    # 处理备注
    handle_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # 处理人
    handled_by: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # 关系
    scenario: Mapped["Scenario"] = relationship("Scenario")
    reporter: Mapped["User"] = relationship("User", foreign_keys=[reporter_id])
