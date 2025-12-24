"""训练计划模型"""

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Float
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class TrainingPlan(Base):
    """训练计划表"""

    __tablename__ = "training_plans"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    duration_days: Mapped[int] = mapped_column(Integer, nullable=False, default=7)
    
    # 计划配置（基于什么生成的）
    target_dimensions: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)  # 目标提升维度
    experience_level: Mapped[str | None] = mapped_column(String(20), nullable=True)  # 生成时的用户水平
    daily_time_min: Mapped[int] = mapped_column(Integer, default=30, nullable=False)  # 每日时间预算
    
    # 任务数据: [{day: 1, tasks: [{id, type, title, ...}]}]
    daily_tasks: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    
    # 进度追踪
    current_day: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    completed_tasks: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)  # 已完成任务ID列表
    
    status: Mapped[str] = mapped_column(
        Enum("active", "paused", "completed", name="plan_status_enum"),
        default="active",
        nullable=False,
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # 关系
    user: Mapped["User"] = relationship("User", back_populates="training_plans")


class PlanTask(Base):
    """训练任务表 - 存储任务完成详情"""

    __tablename__ = "plan_tasks"

    plan_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("training_plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    task_id: Mapped[str] = mapped_column(String(50), nullable=False)  # 任务ID (如 day1_task1)
    day: Mapped[int] = mapped_column(Integer, nullable=False)
    
    # 任务类型: learn(学习), practice(练习), review(复盘)
    task_type: Mapped[str] = mapped_column(
        Enum("learn", "practice", "review", name="task_type_enum"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    duration_min: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    
    # 关联内容
    content_type: Mapped[str | None] = mapped_column(String(50), nullable=True)  # course, scenario, article
    content_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    
    # 完成状态
    status: Mapped[str] = mapped_column(
        Enum("pending", "in_progress", "completed", "skipped", name="task_status_enum"),
        default="pending",
        nullable=False,
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # 完成结果（如练习场景的分数）
    result_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    result_data: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
