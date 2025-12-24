"""导演Agent - 场景编排与节奏控制"""

from typing import Any

from app.agents.base import AgentContext, AgentResult, AgentType, BaseAgent


class DirectorAgent(BaseAgent):
    """导演Agent

    职责:
    - 加载场景配置（seed/persona/constraints）
    - 实时监控对话轮次与进度
    - 注入事件（inject_pool中的挑战/打断）
    - 动态调整NPC强度（Train模式）
    - 判断结束条件并触发评分
    """

    def __init__(self):
        super().__init__(AgentType.DIRECTOR)
        self.scenario_config: dict[str, Any] = {}
        self.inject_pool: list[dict[str, Any]] = []
        self.current_difficulty: int = 3

    async def process(
        self,
        context: AgentContext,
        message: str | None = None,
        **kwargs: Any,
    ) -> AgentResult:
        """处理Director逻辑"""
        # TODO: 实现完整的导演逻辑
        
        # 检查是否需要注入事件
        inject_event = self._check_inject_event(context.turn_number)
        
        # 检查是否达到结束条件
        should_end = self._check_end_condition(context)
        
        return AgentResult(
            success=True,
            data={
                "inject_event": inject_event,
                "should_end": should_end,
                "difficulty": self.current_difficulty,
            },
        )

    async def load_scenario(self, scenario_id: str, mode: str, seed: int | None = None) -> None:
        """加载场景配置"""
        # TODO: 从数据库加载场景配置
        self.scenario_config = {
            "id": scenario_id,
            "mode": mode,
            "seed": seed,
        }
        self.update_state(scenario_loaded=True)

    def _check_inject_event(self, turn_number: int) -> dict[str, Any] | None:
        """检查是否需要注入事件"""
        for event in self.inject_pool:
            if event.get("at_turn") == turn_number:
                return event
        return None

    def _check_end_condition(self, context: AgentContext) -> bool:
        """检查是否达到结束条件"""
        # 简单实现：超过10轮结束
        return context.turn_number >= 10

    def adjust_difficulty(self, delta: int) -> int:
        """调整难度"""
        self.current_difficulty = max(1, min(5, self.current_difficulty + delta))
        return self.current_difficulty
