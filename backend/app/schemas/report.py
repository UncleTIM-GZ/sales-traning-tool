"""报告相关Schema"""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel


# ===== Report =====
class EvidenceItem(BaseModel):
    """证据项"""
    turn: int
    text: str


class DimensionScore(BaseModel):
    """维度得分"""
    name: str
    weight: float = 1.0
    score: float
    max_score: float = 10
    evidence: list[EvidenceItem] = []


class HighlightItem(BaseModel):
    """亮点项"""
    title: str
    why: str = ""
    example: str = ""


class IssueItem(BaseModel):
    """问题项"""
    title: str
    why: str = ""
    fix: str = ""


class ReplacementItem(BaseModel):
    """改写建议"""
    original: str
    better: str


# === 商业化新增 Schema ===

class EvidenceSentence(BaseModel):
    """证据句 - 引用对话中的具体话术"""
    turn_id: int
    speaker: str = "user"  # user or npc
    original_text: str
    issue: str = ""  # 问题描述
    dimension: str = ""  # 影响的维度
    impact: int = 0  # 影响分数（正负）
    better_version: str = ""  # 更好的版本


class RewriteSuggestion(BaseModel):
    """改写建议 - 具体话术优化建议"""
    turn_id: int
    original: str
    improved: str
    reason: str = ""
    dimension: str = ""


class RecommendedScenario(BaseModel):
    """推荐场景"""
    id: str = ""
    name: str
    priority: int = 1


class TrainingPrescription(BaseModel):
    """训练处方 - 基于报告的个性化训练建议"""
    weak_dimensions: list[str] = []
    recommended_scenarios: list[RecommendedScenario] = []
    practice_tips: list[str] = []
    real_world_task: str = ""


class ConversationScore(BaseModel):
    """带评分的对话记录"""
    turn_id: int
    speaker: str  # user or npc
    content: str
    score: float | None = None
    feedback: str = ""


class NextActions(BaseModel):
    """下一步建议"""
    recommended_scenarios: list[str] = []
    real_world_task: str | None = None


class ReportMetadata(BaseModel):
    """报告元数据"""
    tokens_used: int = 0
    latency_avg_ms: float = 0
    coach_hints_used: int = 0


class ReportResponse(BaseModel):
    """报告详情响应（完整版）"""
    id: str
    session_id: str
    user_id: str
    scenario_id: str | None = None
    scenario_name: str = ""
    mode: str = "train"
    rubric_version: str
    total_score: float
    # 基础评分
    dimensions: list[dict[str, Any]] = []
    highlights: list[dict[str, Any]] = []
    issues: list[dict[str, Any]] = []
    replacements: list[dict[str, Any]] = []
    # 商业化新增字段
    evidence_sentences: list[dict[str, Any]] = []
    rewrite_suggestions: list[dict[str, Any]] = []
    training_prescription: dict[str, Any] | None = None
    conversation_scores: list[dict[str, Any]] = []
    comparison_data: dict[str, Any] | None = None
    next_actions: dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None
    created_at: str | None = None


class ReportListItem(BaseModel):
    """报告列表项"""
    id: str
    session_id: str
    scenario_name: str
    total_score: float
    mode: Literal["train", "exam", "replay"]
    created_at: datetime


class ReportListResponse(BaseModel):
    """报告列表响应"""
    items: list[ReportListItem]
    total: int
    page: int
    size: int


# ===== Compare =====
class CompareDimension(BaseModel):
    """对比维度"""
    name: str
    score: float


class CompareReportItem(BaseModel):
    """对比报告项"""
    id: str
    total_score: float
    dimensions: list[CompareDimension]


class KeyImprovement(BaseModel):
    """关键改进"""
    dimension: str
    before_example: str
    after_example: str
    feedback: str


class ImprovementSummary(BaseModel):
    """改进总结"""
    score_delta: float
    improved_dimensions: list[str]
    key_improvements: list[KeyImprovement] = []


class CompareReportResponse(BaseModel):
    """报告对比响应"""
    before: CompareReportItem
    after: CompareReportItem
    improvement: ImprovementSummary
