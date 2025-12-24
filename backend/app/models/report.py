"""报告模型"""

from typing import TYPE_CHECKING, Any

from sqlalchemy import Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.session import Session


class Report(Base):
    """
    评分报告表
    
    商业化关键字段:
    - evidence_sentences: 证据句列表，引用对话中的具体话术
    - rewrite_suggestions: 改写建议列表，提供话术优化建议
    - training_prescription: 训练处方，包含推荐场景和练习建议
    - conversation_scores: 带评分的对话记录
    """

    __tablename__ = "reports"

    session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rubric_version: Mapped[str] = mapped_column(String(50), nullable=False)
    total_score: Mapped[float] = mapped_column(Float, nullable=False)
    
    # 维度评分
    dimensions: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    
    # 亮点和问题
    highlights: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    issues: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    
    # 话术替换建议（旧字段，保持兼容）
    replacements: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    
    # === 商业化新增字段 ===
    
    # 证据句列表 - 引用对话中的具体话术
    # 格式: [{"turn_id": 3, "speaker": "user", "original_text": "...", "issue": "自我否定", 
    #        "dimension": "confidence", "impact": -2, "better_version": "..."}]
    evidence_sentences: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, default=list, nullable=False
    )
    
    # 改写建议列表 - 具体话术优化建议
    # 格式: [{"turn_id": 2, "original": "原话术", "improved": "改进版本", 
    #        "reason": "改进原因", "dimension": "objection_handling"}]
    rewrite_suggestions: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, default=list, nullable=False
    )
    
    # 训练处方 - 基于报告的个性化训练建议
    # 格式: {"weak_dimensions": [...], "recommended_scenarios": [...], 
    #       "practice_tips": [...], "real_world_task": "..."}
    training_prescription: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB, nullable=True
    )
    
    # 带评分的对话记录 - 每轮对话的评分
    # 格式: [{"turn_id": 1, "speaker": "npc", "content": "...", "score": 8, "feedback": "..."}]
    conversation_scores: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, default=list, nullable=False
    )
    
    # 对比数据 - 与之前测评的对比
    # 格式: {"previous_report_id": "...", "score_change": 5, "dimension_changes": {...}}
    comparison_data: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB, nullable=True
    )
    
    # 下一步行动建议
    next_actions: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    
    # 元数据
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSONB, default=dict, nullable=False
    )

    # 关系
    session: Mapped["Session"] = relationship("Session", back_populates="report")
