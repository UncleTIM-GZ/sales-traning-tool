"""Evaluator Agent - 量化评分与证据提取"""

import json
from typing import Any

from app.agents.base import AgentContext, AgentResult, AgentType, BaseAgent
from app.providers.llm.base import ChatMessage, ToolDefinition


# 证据句提取工具定义
EXTRACT_EVIDENCE_TOOL = ToolDefinition(
    name="extract_evidence",
    description="从对话中提取证据句，包括亮点话术和问题话术",
    parameters={
        "type": "object",
        "properties": {
            "evidence_sentences": {
                "type": "array",
                "description": "证据句列表",
                "items": {
                    "type": "object",
                    "properties": {
                        "turn_id": {"type": "integer", "description": "对话轮次"},
                        "speaker": {"type": "string", "enum": ["user", "npc"]},
                        "original_text": {"type": "string", "description": "原始话术"},
                        "is_highlight": {"type": "boolean", "description": "是否为亮点"},
                        "issue": {"type": "string", "description": "问题描述（如果是问题话术）"},
                        "dimension": {"type": "string", "description": "相关维度"},
                        "impact": {"type": "integer", "description": "影响程度 (-3到+3)"},
                        "better_version": {"type": "string", "description": "改进版本（如果是问题话术）"},
                    },
                    "required": ["turn_id", "speaker", "original_text", "is_highlight"],
                },
            },
            "rewrite_suggestions": {
                "type": "array",
                "description": "话术改写建议",
                "items": {
                    "type": "object",
                    "properties": {
                        "turn_id": {"type": "integer"},
                        "original": {"type": "string", "description": "原话术"},
                        "improved": {"type": "string", "description": "改进后的话术"},
                        "reason": {"type": "string", "description": "改进原因"},
                        "dimension": {"type": "string", "description": "相关维度"},
                    },
                    "required": ["turn_id", "original", "improved", "reason"],
                },
            },
            "training_prescription": {
                "type": "object",
                "description": "训练处方",
                "properties": {
                    "weak_dimensions": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "需要提升的维度",
                    },
                    "recommended_scenarios": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "scenario_type": {"type": "string"},
                                "reason": {"type": "string"},
                                "priority": {"type": "integer"},
                            },
                        },
                        "description": "推荐的训练场景",
                    },
                    "practice_tips": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "练习建议",
                    },
                    "real_world_task": {
                        "type": "string",
                        "description": "现实任务建议",
                    },
                },
            },
        },
        "required": ["evidence_sentences", "rewrite_suggestions", "training_prescription"],
    },
)


# 评分维度定义
EVALUATION_DIMENSIONS = {
    "opening": {
        "name": "开场破冰",
        "description": "评估开场的专业度、自信度和吸引力",
        "weight": 0.15,
    },
    "discovery": {
        "name": "需求挖掘",
        "description": "评估提问质量、倾听和理解客户需求的能力",
        "weight": 0.25,
    },
    "value_presentation": {
        "name": "价值呈现",
        "description": "评估产品/服务价值的呈现和链接客户需求的能力",
        "weight": 0.20,
    },
    "objection_handling": {
        "name": "异议处理",
        "description": "评估处理客户异议和担忧的能力",
        "weight": 0.20,
    },
    "closing": {
        "name": "促成进展",
        "description": "评估推进下一步和达成共识的能力",
        "weight": 0.10,
    },
    "communication": {
        "name": "沟通技巧",
        "description": "评估语言表达、情感管理和沟通效率",
        "weight": 0.10,
    },
}

# 评估系统提示
EVALUATOR_SYSTEM_PROMPT = """你是一个专业的销售对话评估专家。你的任务是评估销售人员的对话表现。

## 评分维度
1. 开场破冰 (opening): 评估开场的专业度、自信度和吸引力
2. 需求挖掘 (discovery): 评估提问质量、倾听和理解客户需求的能力
3. 价值呈现 (value_presentation): 评估产品/服务价值的呈现和链接客户需求的能力
4. 异议处理 (objection_handling): 评估处理客户异议和担忧的能力
5. 促成进展 (closing): 评估推进下一步和达成共识的能力
6. 沟通技巧 (communication): 评估语言表达、情感管理和沟通效率

## 评分标准
- 1-3分: 表现较差，存在明显问题
- 4-5分: 表现一般，有改进空间
- 6-7分: 表现良好，符合基本要求
- 8-9分: 表现优秀，超出预期
- 10分: 表现卓越，可作为标杆

## 评估要求
- 客观公正，基于具体证据
- 指出亮点和问题
- 提供具体改进建议
"""

# 评估工具定义
EVALUATE_TURN_TOOL = ToolDefinition(
    name="evaluate_turn",
    description="评估单轮对话表现，返回各维度分数和评价",
    parameters={
        "type": "object",
        "properties": {
            "scores": {
                "type": "object",
                "description": "各维度得分 (1-10)",
                "properties": {
                    "opening": {"type": "integer", "minimum": 1, "maximum": 10},
                    "discovery": {"type": "integer", "minimum": 1, "maximum": 10},
                    "value_presentation": {"type": "integer", "minimum": 1, "maximum": 10},
                    "objection_handling": {"type": "integer", "minimum": 1, "maximum": 10},
                    "closing": {"type": "integer", "minimum": 1, "maximum": 10},
                    "communication": {"type": "integer", "minimum": 1, "maximum": 10},
                },
            },
            "highlights": {
                "type": "array",
                "items": {"type": "string"},
                "description": "这轮对话的亮点",
            },
            "issues": {
                "type": "array",
                "items": {"type": "string"},
                "description": "这轮对话的问题",
            },
            "suggestions": {
                "type": "array",
                "items": {"type": "string"},
                "description": "具体改进建议",
            },
        },
        "required": ["scores"],
    },
)


class EvaluatorAgent(BaseAgent):
    """评估Agent

    职责:
    - 按Rubric实时打分（维度分+总分）
    - 提取证据句（turn_id + 具体话术）
    - 识别亮点（best practices）
    - 标注问题（致命错误/改进点）
    - 生成结构化报告
    """

    def __init__(self):
        super().__init__(AgentType.EVALUATOR)
        self.rubric: dict[str, Any] = {}
        self.partial_scores: list[dict[str, Any]] = []
        self.evidence: list[dict[str, Any]] = []

    async def process(
        self,
        context: AgentContext,
        message: str | None = None,
        **kwargs: Any,
    ) -> AgentResult:
        """执行评估"""
        # TODO: 实现完整的评估逻辑
        
        # 实时评分
        partial_score = await self._evaluate_turn(context, message)
        self.partial_scores.append(partial_score)
        
        return AgentResult(
            success=True,
            data={
                "partial_score": partial_score,
                "turn_number": context.turn_number,
            },
        )

    async def _evaluate_turn(
        self,
        context: AgentContext,
        user_message: str | None,
    ) -> dict[str, Any]:
        """使用LLM评估单轮对话"""
        # 构建评估提示
        history_text = self._format_history(context)
        
        evaluation_prompt = f"""请评估以下销售对话的第 {context.turn_number} 轮。

## 对话历史
{history_text}

## 当前轮次 (第 {context.turn_number} 轮)
销售: {user_message or "(无)"}

请使用 evaluate_turn 工具返回评估结果。
"""
        
        messages = [
            ChatMessage(role="system", content=EVALUATOR_SYSTEM_PROMPT),
            ChatMessage(role="user", content=evaluation_prompt),
        ]
        
        try:
            response = await self.chat(
                messages=messages,
                temperature=0.3,  # 使用较低温度保证一致性
                tools=[EVALUATE_TURN_TOOL],
                tool_choice={"type": "function", "function": {"name": "evaluate_turn"}},
            )
            
            # 解析工具调用结果
            if response.tool_calls:
                tool_call = response.tool_calls[0]
                if tool_call.function:
                    result = json.loads(tool_call.function.arguments)
                    return {
                        "turn": context.turn_number,
                        "scores": result.get("scores", {}),
                        "highlights": result.get("highlights", []),
                        "issues": result.get("issues", []),
                        "suggestions": result.get("suggestions", []),
                    }
            
            # 如果没有工具调用，返回默认分数
            return self._get_default_scores(context.turn_number)
            
        except Exception as e:
            # 评估失败时返回默认分数
            return self._get_default_scores(context.turn_number)

    def _get_default_scores(self, turn_number: int) -> dict[str, Any]:
        """获取默认分数"""
        return {
            "turn": turn_number,
            "scores": {
                "opening": 6,
                "discovery": 6,
                "value_presentation": 6,
                "objection_handling": 6,
                "closing": 6,
                "communication": 6,
            },
            "highlights": [],
            "issues": [],
            "suggestions": [],
        }

    def _format_history(self, context: AgentContext) -> str:
        """格式化对话历史"""
        if not context.history:
            return "(无历史对话)"
        
        lines = []
        for i, turn in enumerate(context.history[-5:]):  # 最近5轮
            if turn.get("user_message"):
                lines.append(f"第{i+1}轮 - 销售: {turn['user_message']}")
            if turn.get("npc_response"):
                lines.append(f"第{i+1}轮 - 客户: {turn['npc_response']}")
        
        return "\n".join(lines) if lines else "(无历史对话)"

    async def generate_final_report(
        self,
        context: AgentContext,
    ) -> dict[str, Any]:
        """使用LLM生成最终评分报告，包含证据句、改写建议和训练处方"""
        # 计算综合分数
        total_score = self._calculate_total_score()
        dimension_scores = self._aggregate_dimension_scores()
        
        # 格式化完整对话历史（用于证据提取）
        full_history = self._format_full_history(context)
        
        # 使用LLM提取证据句和生成改写建议
        evidence_data = await self._extract_evidence_with_llm(context, full_history, dimension_scores)
        
        # 生成对话评分记录
        conversation_scores = self._generate_conversation_scores(context)
        
        # 基于partial_scores生成亮点和问题
        highlights = evidence_data.get("highlights", self._extract_highlights())
        issues = evidence_data.get("issues", self._extract_issues())
        
        return {
            "rubric_version": self.rubric.get("version", "sales_mvp_v1"),
            "total_score": total_score,
            "dimensions": dimension_scores,
            "highlights": highlights,
            "issues": issues,
            "replacements": self._generate_replacements(),
            "next_actions": self._generate_next_actions(),
            # 商业化新增字段
            "evidence_sentences": evidence_data.get("evidence_sentences", []),
            "rewrite_suggestions": evidence_data.get("rewrite_suggestions", []),
            "training_prescription": evidence_data.get("training_prescription", {}),
            "conversation_scores": conversation_scores,
        }
    
    async def _extract_evidence_with_llm(
        self,
        context: AgentContext,
        full_history: str,
        dimension_scores: list[dict],
    ) -> dict[str, Any]:
        """使用LLM从对话中提取证据句和生成改写建议"""
        # 识别薄弱维度
        weak_dims = [d["name"] for d in dimension_scores if d.get("score", 100) < 70]
        weak_dims_text = "、".join(weak_dims) if weak_dims else "暂无明显薄弱项"
        
        extraction_prompt = f"""请分析以下销售对话，提取证据句并生成改写建议。

## 对话记录
{full_history}

## 当前评估
- 薄弱维度: {weak_dims_text}
- 总轮次: {context.turn_number}

## 任务
1. **证据句提取**: 找出对话中具体的好话术(亮点)和问题话术，需要指明是哪一轮
2. **改写建议**: 对问题话术提供具体的改进版本，要符合实际销售场景
3. **训练处方**: 基于薄弱点推荐训练场景和练习方法

请使用 extract_evidence 工具返回结构化结果。
"""
        
        try:
            messages = [
                ChatMessage(
                    role="system",
                    content="你是一个资深销售培训专家，擅长从对话中精准识别话术问题并提供可落地的改进建议。"
                ),
                ChatMessage(role="user", content=extraction_prompt),
            ]
            
            response = await self.chat(
                messages=messages,
                temperature=0.4,
                tools=[EXTRACT_EVIDENCE_TOOL],
                tool_choice={"type": "function", "function": {"name": "extract_evidence"}},
            )
            
            if response.tool_calls:
                tool_call = response.tool_calls[0]
                if tool_call.function:
                    result = json.loads(tool_call.function.arguments)
                    
                    # 处理证据句，分离亮点和问题
                    evidence = result.get("evidence_sentences", [])
                    highlights = []
                    issues = []
                    
                    for e in evidence:
                        if e.get("is_highlight"):
                            highlights.append({
                                "turn_id": e.get("turn_id"),
                                "content": e.get("original_text", ""),
                                "dimension": e.get("dimension", "general"),
                            })
                        else:
                            issues.append({
                                "turn_id": e.get("turn_id"),
                                "content": e.get("issue", e.get("original_text", "")),
                                "original_text": e.get("original_text", ""),
                                "dimension": e.get("dimension", "general"),
                                "severity": "high" if abs(e.get("impact", 0)) >= 2 else "medium",
                                "better_version": e.get("better_version", ""),
                            })
                    
                    return {
                        "evidence_sentences": evidence,
                        "rewrite_suggestions": result.get("rewrite_suggestions", []),
                        "training_prescription": result.get("training_prescription", {}),
                        "highlights": highlights,
                        "issues": issues,
                    }
                    
        except Exception as e:
            # 如果LLM调用失败，返回基于partial_scores的结果
            pass
        
        # 回退到基于partial_scores的提取
        return {
            "evidence_sentences": [],
            "rewrite_suggestions": [],
            "training_prescription": self._generate_default_prescription(),
            "highlights": self._extract_highlights(),
            "issues": self._extract_issues(),
        }
    
    def _format_full_history(self, context: AgentContext) -> str:
        """格式化完整对话历史（用于证据提取）"""
        if not context.history:
            return "(无对话记录)"
        
        lines = []
        for i, turn in enumerate(context.history, 1):
            if turn.get("user_message"):
                lines.append(f"【第{i}轮-销售】{turn['user_message']}")
            if turn.get("npc_response"):
                lines.append(f"【第{i}轮-客户】{turn['npc_response']}")
        
        return "\n".join(lines) if lines else "(无对话记录)"
    
    def _generate_conversation_scores(self, context: AgentContext) -> list[dict[str, Any]]:
        """生成带评分的对话记录"""
        conversation_scores = []
        
        for i, turn in enumerate(context.history or [], 1):
            # 查找对应轮次的评分
            turn_score = None
            turn_feedback = ""
            
            for ps in self.partial_scores:
                if ps.get("turn") == i:
                    scores = ps.get("scores", {})
                    if scores:
                        # 计算该轮平均分
                        avg = sum(scores.values()) / len(scores)
                        turn_score = round(avg, 1)
                    # 获取反馈
                    highlights = ps.get("highlights", [])
                    issues = ps.get("issues", [])
                    if highlights:
                        turn_feedback = highlights[0] if isinstance(highlights[0], str) else highlights[0].get("content", "")
                    elif issues:
                        turn_feedback = issues[0] if isinstance(issues[0], str) else issues[0].get("content", "")
                    break
            
            # 添加销售发言
            if turn.get("user_message"):
                conversation_scores.append({
                    "turn_id": i,
                    "speaker": "user",
                    "content": turn["user_message"],
                    "score": turn_score,
                    "feedback": turn_feedback,
                })
            
            # 添加客户回复
            if turn.get("npc_response"):
                conversation_scores.append({
                    "turn_id": i,
                    "speaker": "npc",
                    "content": turn["npc_response"],
                    "score": None,  # 客户发言不评分
                    "feedback": "",
                })
        
        return conversation_scores
    
    def _generate_default_prescription(self) -> dict[str, Any]:
        """生成默认训练处方"""
        dimensions = self._aggregate_dimension_scores()
        weak_dims = [d["name"] for d in dimensions if d.get("score", 100) < 70]
        
        # 根据薄弱维度推荐场景
        scenario_recommendations = []
        if "需求挖掘" in weak_dims:
            scenario_recommendations.append({
                "scenario_type": "需求挖掘训练",
                "reason": "提升发现客户真实需求的能力",
                "priority": 1,
            })
        if "异议处理" in weak_dims:
            scenario_recommendations.append({
                "scenario_type": "异议处理训练",
                "reason": "提升化解客户顾虑的能力",
                "priority": 1,
            })
        if "价值呈现" in weak_dims:
            scenario_recommendations.append({
                "scenario_type": "价值陈述训练",
                "reason": "提升产品价值传递能力",
                "priority": 2,
            })
        
        # 如果没有薄弱项，推荐进阶训练
        if not scenario_recommendations:
            scenario_recommendations = [
                {"scenario_type": "大客户拜访", "reason": "挑战更高难度场景", "priority": 1},
                {"scenario_type": "复杂异议处理", "reason": "应对多重顾虑", "priority": 2},
            ]
        
        return {
            "weak_dimensions": weak_dims,
            "recommended_scenarios": scenario_recommendations[:3],
            "practice_tips": [
                "每次练习后回顾录音，对比话术差异",
                "准备3-5个备选话术应对常见异议",
                "练习时注意语速和停顿的控制",
            ],
            "real_world_task": self._generate_real_world_task(
                [{"name": d} for d in weak_dims]
            ),
        }

    def _calculate_total_score(self) -> float:
        """计算总分"""
        if not self.partial_scores:
            return 0.0
        # 简化计算：取平均
        total = 0.0
        count = 0
        for score in self.partial_scores:
            for dim_score in score.get("scores", {}).values():
                total += dim_score
                count += 1
        return round(total / count * 10, 1) if count > 0 else 0.0

    def _aggregate_dimension_scores(self) -> list[dict[str, Any]]:
        """聚合维度得分"""
        if not self.partial_scores:
            return []
        
        # 按维度聚合所有轮次的分数
        dimension_totals: dict[str, list[int]] = {}
        
        for score in self.partial_scores:
            scores = score.get("scores", {})
            for dim_key, dim_score in scores.items():
                if dim_key not in dimension_totals:
                    dimension_totals[dim_key] = []
                dimension_totals[dim_key].append(dim_score)
        
        # 计算每个维度的平均分
        result = []
        for dim_key, scores in dimension_totals.items():
            if dim_key in EVALUATION_DIMENSIONS:
                dim_info = EVALUATION_DIMENSIONS[dim_key]
                avg_score = sum(scores) / len(scores) if scores else 0
                # 转换为100分制
                score_100 = round(avg_score * 10, 1)
                result.append({
                    "name": dim_info["name"],
                    "key": dim_key,
                    "score": score_100,
                    "weight": dim_info["weight"],
                    "description": dim_info["description"],
                })
        
        # 按权重排序
        result.sort(key=lambda x: x.get("weight", 0), reverse=True)
        return result

    def _extract_highlights(self) -> list[dict[str, Any]]:
        """从partial_scores中提取亮点"""
        highlights = []
        for score in self.partial_scores:
            turn = score.get("turn", 0)
            for highlight in score.get("highlights", []):
                if isinstance(highlight, str):
                    highlights.append({
                        "turn_id": turn,
                        "content": highlight,
                        "dimension": "general",
                    })
                elif isinstance(highlight, dict):
                    highlights.append(highlight)
        return highlights

    def _extract_issues(self) -> list[dict[str, Any]]:
        """从partial_scores中提取问题"""
        issues = []
        for score in self.partial_scores:
            turn = score.get("turn", 0)
            for issue in score.get("issues", []):
                if isinstance(issue, str):
                    issues.append({
                        "turn_id": turn,
                        "content": issue,
                        "dimension": "general",
                        "severity": "medium",
                    })
                elif isinstance(issue, dict):
                    issues.append(issue)
        return issues

    def _generate_replacements(self) -> list[dict[str, Any]]:
        """从partial_scores中生成改写建议"""
        replacements = []
        for score in self.partial_scores:
            turn = score.get("turn", 0)
            for suggestion in score.get("suggestions", []):
                if isinstance(suggestion, str):
                    replacements.append({
                        "turn_id": turn,
                        "suggestion": suggestion,
                    })
                elif isinstance(suggestion, dict):
                    replacements.append(suggestion)
        return replacements

    def _generate_next_actions(self) -> dict[str, Any]:
        """生成下一步建议"""
        # 分析薄弱维度
        dimensions = self._aggregate_dimension_scores()
        weak_dims = [d for d in dimensions if d.get("score", 100) < 70]
        weak_dims.sort(key=lambda x: x.get("score", 0))
        
        # 根据薄弱维度推荐场景
        scenario_mapping = {
            "opening": ["电话陌拜", "初次拜访"],
            "discovery": ["需求挖掘", "客户调研"],
            "value_presentation": ["产品演示", "方案讲解"],
            "objection_handling": ["异议处理", "价格谈判"],
            "closing": ["促成成交", "签约"],
            "communication": ["关系维护", "客情管理"],
        }
        
        recommended_scenarios = []
        for dim in weak_dims[:2]:  # 取最弱的2个维度
            dim_key = dim.get("key", "")
            if dim_key in scenario_mapping:
                for scenario in scenario_mapping[dim_key]:
                    recommended_scenarios.append({
                        "name": scenario,
                        "reason": f"提升{dim.get('name', '')}能力",
                        "priority": 1,
                    })
        
        return {
            "recommended_scenarios": recommended_scenarios[:3],
            "real_world_task": self._generate_real_world_task(weak_dims),
        }
    
    def _generate_real_world_task(self, weak_dims: list[dict]) -> str:
        """生成现实任务建议"""
        if not weak_dims:
            return "继续保持当前的销售节奏，尝试更复杂的客户场景"
        
        dim_name = weak_dims[0].get("name", "沟通")
        tasks = {
            "开场破冰": "在下次客户拜访中，尝试用一个故事或问题开场，而不是直接介绍产品",
            "需求挖掘": "在与客户沟通时，尝试连续问3个'为什么'来深入了解客户真实需求",
            "价值呈现": "准备3个客户案例，练习用客户语言而非产品语言来描述价值",
            "异议处理": "收集客户最常见的3个异议，为每个准备LSCPA话术",
            "促成进展": "在每次拜访结束前，明确约定下一步行动和时间",
            "沟通技巧": "在下次通话中，尝试让客户多说话，你的发言控制在30%以内",
        }
        return tasks.get(dim_name, "挑选一个你最不擅长的场景，进行3次刻意练习")

    def set_rubric(self, rubric: dict[str, Any]) -> None:
        """设置评分标准"""
        self.rubric = rubric
        self.update_state(rubric_version=rubric.get("version"))
