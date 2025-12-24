"""
开发：Excellent（11964948@qq.com）
功能：训练广场扩展模型
作用：包含标签、积分、成就、排行榜、专题等功能的数据模型
创建时间：2025-12-24
最后修改：2025-12-24
"""

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.scenario import Scenario
    from app.models.user import User


class ScenarioTag(Base):
    """场景标签表"""

    __tablename__ = "scenario_tags"

    name: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)

    # 标签分类: industry(行业), skill(技能), difficulty(难度), other(其他)
    category: Mapped[str] = mapped_column(String(20), default="other", nullable=False)

    # 使用次数
    usage_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # 是否热门
    is_hot: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class ScenarioTagRelation(Base):
    """场景-标签关联表"""

    __tablename__ = "scenario_tag_relations"

    scenario_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("scenarios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tag_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("scenario_tags.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # 关系
    scenario: Mapped["Scenario"] = relationship("Scenario")
    tag: Mapped["ScenarioTag"] = relationship("ScenarioTag")

    __table_args__ = (
        Index("ix_scenario_tag_unique", "scenario_id", "tag_id", unique=True),
    )


class CommentLike(Base):
    """评论点赞表"""

    __tablename__ = "comment_likes"

    comment_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("scenario_comments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    __table_args__ = (
        Index("ix_comment_like_unique", "comment_id", "user_id", unique=True),
    )


class PlazaUserPoints(Base):
    """广场用户积分表 - 与激励系统的积分分开"""

    __tablename__ = "plaza_user_points"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    # 总积分（历史累计）
    total_points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # 可用积分
    available_points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # 等级
    level: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # 经验值
    exp: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # 连续签到天数
    streak_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # 上次签到日期 (YYYY-MM-DD格式)
    last_checkin_date: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # 关系
    user: Mapped["User"] = relationship("User")


class PlazaPointRecord(Base):
    """广场积分记录表"""

    __tablename__ = "plaza_point_records"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # 积分变化（正数为获得，负数为消耗）
    points: Mapped[int] = mapped_column(Integer, nullable=False)

    # 类型: earn(获得), spend(消耗)
    type: Mapped[str] = mapped_column(String(20), nullable=False)

    # 来源: checkin, training, publish, trained, liked, comment, achievement, spend
    source: Mapped[str] = mapped_column(String(30), nullable=False, index=True)

    # 描述
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # 关联ID（如场景ID、成就ID等）
    reference_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    # 关系
    user: Mapped["User"] = relationship("User")


class PlazaAchievement(Base):
    """广场成就定义表"""

    __tablename__ = "plaza_achievements"

    # 成就名称
    name: Mapped[str] = mapped_column(String(50), nullable=False)

    # 成就描述
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # 图标
    icon: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # 分类: training(训练), creation(创作), social(社交)
    category: Mapped[str] = mapped_column(String(30), nullable=False, index=True)

    # 达成条件 (JSON格式)
    # 例如: {"type": "training_count", "value": 100}
    condition: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    # 奖励积分
    reward_points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # 稀有度: common, rare, epic, legendary
    rarity: Mapped[str] = mapped_column(String(20), default="common", nullable=False)

    # 排序
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # 是否启用
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class PlazaUserAchievement(Base):
    """广场用户成就表"""

    __tablename__ = "plaza_user_achievements"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    achievement_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("plaza_achievements.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # 解锁进度 (0-100)
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # 是否已解锁
    is_unlocked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # 关系
    user: Mapped["User"] = relationship("User")
    achievement: Mapped["PlazaAchievement"] = relationship("PlazaAchievement")

    __table_args__ = (
        Index("ix_plaza_user_achievement_unique", "user_id", "achievement_id", unique=True),
    )


class Collection(Base):
    """专题/合集表"""

    __tablename__ = "collections"

    # 创建者ID（NULL表示官方专题）
    user_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # 标题
    title: Mapped[str] = mapped_column(String(100), nullable=False)

    # 描述
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # 封面图
    cover_image: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # 是否官方专题
    is_official: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)

    # 是否公开
    is_public: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # 场景数量
    scenario_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # 排序（官方专题用）
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # 关系
    user: Mapped["User | None"] = relationship("User")


class CollectionScenario(Base):
    """专题-场景关联表"""

    __tablename__ = "collection_scenarios"

    collection_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("collections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scenario_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("scenarios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # 排序
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # 关系
    collection: Mapped["Collection"] = relationship("Collection")
    scenario: Mapped["Scenario"] = relationship("Scenario")

    __table_args__ = (
        Index("ix_collection_scenario_unique", "collection_id", "scenario_id", unique=True),
    )


class SearchHistory(Base):
    """搜索历史表"""

    __tablename__ = "search_histories"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # 搜索关键词
    keyword: Mapped[str] = mapped_column(String(100), nullable=False)

    # 关系
    user: Mapped["User"] = relationship("User")


class HotSearch(Base):
    """热门搜索表"""

    __tablename__ = "hot_searches"

    # 搜索关键词
    keyword: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)

    # 搜索次数
    search_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # 是否人工置顶
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # 排序
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
