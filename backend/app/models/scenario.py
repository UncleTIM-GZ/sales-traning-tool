"""场景模型"""

from datetime import datetime
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.user import User

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ScenarioPack(Base):
    """场景包表"""

    __tablename__ = "scenario_packs"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    track: Mapped[str] = mapped_column(
        Enum("sales", "social", name="track_enum", create_type=False),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    difficulty_range: Mapped[list[int]] = mapped_column(JSONB, default=[1, 5], nullable=False)
    tags: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    version: Mapped[str] = mapped_column(String(20), default="1.0.0", nullable=False)
    status: Mapped[str] = mapped_column(
        Enum("draft", "published", "archived", name="scenario_status_enum"),
        default="draft",
        nullable=False,
    )
    audience: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)

    # 关系
    scenarios: Mapped[list["Scenario"]] = relationship("Scenario", back_populates="pack")


class Scenario(Base):
    """场景表"""

    __tablename__ = "scenarios"

    pack_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("scenario_packs.id", ondelete="SET NULL"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    track: Mapped[str] = mapped_column(
        Enum("sales", "social", name="track_enum", create_type=False),
        nullable=False,
    )
    mode: Mapped[str] = mapped_column(
        Enum("train", "exam", "replay", name="mode_enum"),
        nullable=False,
    )
    difficulty: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    config: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    rubric_version: Mapped[str] = mapped_column(String(50), nullable=False)
    version: Mapped[str] = mapped_column(String(20), default="1.0.0", nullable=False)
    status: Mapped[str] = mapped_column(
        Enum("draft", "published", "archived", name="scenario_status_enum", create_type=False),
        default="draft",
        nullable=False,
    )
    
    # 用户自定义场景的创建者
    created_by: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
    )
    
    # === 社交功能字段 ===
    
    # 可见性: private=仅自己, public=广场可见, circle=精英圈层
    visibility: Mapped[str] = mapped_column(
        Enum("private", "public", "circle", "pending", name="visibility_enum", create_type=False),
        default="private",
        nullable=False,
    )
    
    # 封面图
    cover_image: Mapped[str | None] = mapped_column(String(500), nullable=True)
    
    # 来源场景（Fork功能）
    forked_from: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("scenarios.id", ondelete="SET NULL"),
        nullable=True,
    )
    
    # 社交统计
    train_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    likes_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    comments_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    fork_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    collections_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    avg_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    
    # 推荐状态
    is_official: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    hot_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    
    # 发布时间
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # 关系
    pack: Mapped["ScenarioPack | None"] = relationship("ScenarioPack", back_populates="scenarios")
    creator: Mapped["User | None"] = relationship("User", foreign_keys=[created_by])
    source_scenario: Mapped["Scenario | None"] = relationship("Scenario", remote_side="Scenario.id", foreign_keys=[forked_from])


class Rubric(Base):
    """评分标准表"""

    __tablename__ = "rubrics"

    version: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    track: Mapped[str] = mapped_column(
        Enum("sales", "social", name="track_enum", create_type=False),
        nullable=False,
    )
    dimensions: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    status: Mapped[str] = mapped_column(
        Enum("active", "deprecated", name="rubric_status_enum"),
        default="active",
        nullable=False,
    )
