"""Coach Agent - Train模式实时辅导"""

import json
from typing import Any

from app.agents.base import AgentContext, AgentResult, AgentType, BaseAgent
from app.providers.llm.base import ChatMessage


# 教练系统提示
COACH_SYSTEM_PROMPT = """你是一个专业的销售教练，正在实时辅导一位销售人员进行练习。

## 你的角色
- 不是直接给出答案，而是引导思考
- 提供简短、可操作的提示
- 关注当前最重要的改进点
- 语气鼓励、建设性

## 提示风格
- 简短精炼，一句话即可
- 具体可行，告诉该怎么做
- 时机合适，不要打断正常节奏
- 积极正向，用“可以尝试...”而不是“不要...”

## 提示时机
- 当某个维度得分较低时
- 当销售错过重要机会时
- 当客户给出明确信号未被利用时
"""


class CoachAgent(BaseAgent):
    """教练Agent

    职责:
    - 关键点提示（"可以问一个追问"）
    - 话术建议（"试试从需求而非价格切入"）
    - 暂停复盘（用户主动或系统触发）
    - 改写建议（"这句话可以这样说..."）

    约束:
    - 仅在Train模式激活
    - Exam模式完全静默
    - 记录提示使用次数（用于报告）
    """

    def __init__(self):
        super().__init__(AgentType.COACH)
        self.hints_given: int = 0
        self.is_active: bool = False

    async def process(
        self,
        context: AgentContext,
        message: str | None = None,
        **kwargs: Any,
    ) -> AgentResult:
        """生成教练提示"""
        # Exam模式静默
        if context.mode == "exam":
            return AgentResult(success=True, content=None)

        self.is_active = True
        
        # 获取评估结果
        evaluator_data = kwargs.get("evaluator_data", {})
        partial_score = evaluator_data.get("partial_score", {})
        
        # 根据评分生成提示
        hint = await self._generate_hint(context, partial_score)
        
        if hint:
            self.hints_given += 1
        
        return AgentResult(
            success=True,
            content=hint,
            data={
                "hints_given": self.hints_given,
                "is_active": self.is_active,
            },
        )

    async def _generate_hint(
        self,
        context: AgentContext,
        partial_score: dict[str, Any],
    ) -> str | None:
        """使用LLM生成智能提示"""
        scores = partial_score.get("scores", {})
        issues = partial_score.get("issues", [])
        
        # 查找得分最低的维度
        if not scores:
            return None
            
        min_dim = min(scores.items(), key=lambda x: x[1])
        min_score = min_dim[1]
        
        # 如果最低分大于6，不需要提示
        if min_score > 6:
            return None
        
        # 构建提示生成提示
        history_text = self._format_recent_history(context)
        
        hint_prompt = f"""基于当前销售对话，生成一条简短的实时辅导提示。

## 最近对话
{history_text}

## 当前问题
- 最低得分维度: {min_dim[0]} ({min_score}分)
- 问题: {', '.join(issues) if issues else '无具体问题'}

请生成一条简短的提示（20字内），格式为: "提示：XXX"
"""
        
        try:
            hint = await self.generate(
                prompt=hint_prompt,
                system_prompt=COACH_SYSTEM_PROMPT,
                temperature=0.7,
                max_tokens=50,
            )
            
            # 确保提示格式正确
            if hint and not hint.startswith("提示"):
                hint = f"提示：{hint}"
            
            return hint.strip() if hint else None
            
        except Exception:
            # 回退到基于规则的提示
            return self._get_rule_based_hint(min_dim[0], min_score)

    def _get_rule_based_hint(self, dimension: str, score: int) -> str | None:
        """基于规则的提示（回退方案）"""
        hints = {
            "discovery": "提示：可以尝试问一个追问，深入了解对方的具体需求",
            "objection_handling": "提示：遇到异议时，可以先认同对方的观点",
            "value_presentation": "提示：尝试用具体案例说明价值",
            "opening": "提示：开场可以更直接说明来意",
            "closing": "提示：可以尝试提出下一步行动建议",
            "communication": "提示：注意语速和语气，保持自信",
        }
        return hints.get(dimension)

    def _format_recent_history(self, context: AgentContext) -> str:
        """格式化最近对话"""
        if not context.history:
            return "(无历史对话)"
        
        lines = []
        for turn in context.history[-3:]:  # 最近3轮
            if turn.get("user_message"):
                lines.append(f"销售: {turn['user_message']}")
            if turn.get("npc_response"):
                lines.append(f"客户: {turn['npc_response']}")
        
        return "\n".join(lines) if lines else "(无历史对话)"

    async def generate_rewrite(
        self,
        original: str,
        context: AgentContext,
    ) -> str:
        """使用LLM生成话术改写建议"""
        history_text = self._format_recent_history(context)
        
        rewrite_prompt = f"""请将以下销售话术改写得更有效。

## 对话背景
{history_text}

## 原话术
{original}

## 要求
1. 保持核心意思
2. 更加专业和有说服力
3. 简洁自然

请直接返回改写后的话术，不需要解释。
"""
        
        try:
            rewrite = await self.generate(
                prompt=rewrite_prompt,
                system_prompt="你是一个销售话术专家，擅长将普通的话术改写得更加专业和有效。",
                temperature=0.7,
                max_tokens=200,
            )
            return rewrite.strip() if rewrite else f"建议改为：{original}（这里可以更加具体...）"
        except Exception:
            return f"建议改为：{original}（这里可以更加具体...）"

    async def pause_review(
        self,
        context: AgentContext,
    ) -> dict[str, Any]:
        """使用LLM生成暂停复盘"""
        history_text = self._format_recent_history(context)
        
        review_prompt = f"""请对当前销售对话进行简要复盘。

## 对话历史
{history_text}

## 当前轮次: {context.turn_number}

请提供:
1. 当前进展总结 (一句话)
2. 2-3条具体建议

请以JSON格式返回，包含 summary 和 suggestions 字段。
"""
        
        try:
            response = await self.generate(
                prompt=review_prompt,
                system_prompt=COACH_SYSTEM_PROMPT,
                temperature=0.5,
            )
            
            result = json.loads(response)
            return {
                "current_turn": context.turn_number,
                "summary": result.get("summary", "目前对话进展正常"),
                "suggestions": result.get("suggestions", []),
            }
        except Exception:
            return {
                "current_turn": context.turn_number,
                "summary": "目前对话进展良好，可以继续深入。",
                "suggestions": [
                    "注意倾听客户的具体需求",
                    "适时提出下一步行动建议",
                ],
            }

    def reset(self) -> None:
        """重置状态"""
        self.hints_given = 0
        self.is_active = False
        self._state = {}
