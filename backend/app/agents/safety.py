"""安全Agent - SCC专属高风险内容检测"""

from typing import Any

from app.agents.base import AgentContext, AgentResult, AgentType, BaseAgent


class SafetyAgent(BaseAgent):
    """安全Agent (SCC专属)

    职责:
    - 检测自伤/极端绝望表达
    - 监控情绪分 + 回避率
    - 触发暂停 + 降阶
    - 弹出求助资源

    触发条件:
    - 自伤相关词汇
    - 长期极低情绪分（<3/10 连续3次）
    - 高回避率（>70% 任务放弃）
    """

    # 危险关键词列表（简化版）
    DANGER_KEYWORDS = [
        "自杀", "不想活", "结束生命", "跳楼", "割腕",
        "活着没意思", "死了算了", "没人在乎",
    ]

    # 求助资源
    HELP_RESOURCES = {
        "hotline": "全国心理援助热线：400-161-9995",
        "text": "或发送短信到：12320-5",
        "website": "https://www.lifeline.org.cn/",
    }

    def __init__(self):
        super().__init__(AgentType.SAFETY)
        self.emotion_scores: list[float] = []
        self.abort_count: int = 0
        self.total_tasks: int = 0

    async def process(
        self,
        context: AgentContext,
        message: str | None = None,
        **kwargs: Any,
    ) -> AgentResult:
        """检测安全风险"""
        # 只在SCC（社恐培养系统）模式下激活
        track = context.metadata.get("track", "sales")
        if track != "social":
            return AgentResult(success=True, data={"risk_level": "none"})

        risk_result = await self._assess_risk(message)
        
        return AgentResult(
            success=True,
            data=risk_result,
        )

    async def _assess_risk(self, message: str | None) -> dict[str, Any]:
        """评估风险等级"""
        if not message:
            return {"risk_level": "none", "action": None}

        # 检测危险关键词
        message_lower = message.lower()
        for keyword in self.DANGER_KEYWORDS:
            if keyword in message_lower:
                return {
                    "risk_level": "high",
                    "action": "pause_and_help",
                    "trigger": keyword,
                    "resources": self.HELP_RESOURCES,
                }

        # 检测情绪趋势
        if self._check_low_emotion_trend():
            return {
                "risk_level": "medium",
                "action": "suggest_break",
                "message": "检测到连续低情绪状态，建议休息一下",
            }

        # 检测高回避率
        if self._check_high_abort_rate():
            return {
                "risk_level": "medium",
                "action": "lower_difficulty",
                "message": "建议降低难度，循序渐进",
            }

        return {"risk_level": "none", "action": None}

    def _check_low_emotion_trend(self) -> bool:
        """检查是否连续低情绪"""
        if len(self.emotion_scores) < 3:
            return False
        return all(score < 3.0 for score in self.emotion_scores[-3:])

    def _check_high_abort_rate(self) -> bool:
        """检查是否高回避率"""
        if self.total_tasks < 5:
            return False
        abort_rate = self.abort_count / self.total_tasks
        return abort_rate > 0.7

    def record_emotion(self, score: float) -> None:
        """记录情绪分"""
        self.emotion_scores.append(score)
        # 只保留最近10次
        if len(self.emotion_scores) > 10:
            self.emotion_scores = self.emotion_scores[-10:]

    def record_task_result(self, completed: bool) -> None:
        """记录任务完成情况"""
        self.total_tasks += 1
        if not completed:
            self.abort_count += 1

    def get_help_resources(self) -> dict[str, str]:
        """获取求助资源"""
        return self.HELP_RESOURCES.copy()
