"""Agent编排器 - 协调多Agent协作"""

from typing import Any, AsyncGenerator

import structlog

from app.agents.base import AgentContext, AgentResult
from app.agents.coach import CoachAgent
from app.agents.director import DirectorAgent
from app.agents.evaluator import EvaluatorAgent
from app.agents.memory import MemoryAgent
from app.agents.npc import NPCAgent
from app.agents.safety import SafetyAgent

logger = structlog.get_logger()


class AgentOrchestrator:
    """Agent编排器

    负责协调多Agent协作，管理Session状态机
    """

    def __init__(self):
        self.director = DirectorAgent()
        self.npc = NPCAgent()
        self.evaluator = EvaluatorAgent()
        self.coach = CoachAgent()
        self.safety = SafetyAgent()
        self.memory = MemoryAgent()

    async def initialize_session(self, context: AgentContext) -> None:
        """初始化会话，加载所有Agent状态"""
        logger.info("Initializing session", session_id=context.session_id)
        
        # 初始化各Agent
        await self.director.initialize(context)
        await self.npc.initialize(context)
        await self.evaluator.initialize(context)
        await self.coach.initialize(context)
        await self.safety.initialize(context)
        await self.memory.initialize(context)
        
        # 加载场景配置
        await self.director.load_scenario(
            context.scenario_id,
            context.mode,
            context.seed,
        )

    async def process_turn(
        self,
        context: AgentContext,
        user_message: str,
    ) -> AsyncGenerator[dict[str, Any], None]:
        """处理一轮对话

        使用SSE流式返回结果:
        - NPC回应
        - 实时评分（可选）
        - Coach提示（Train模式）
        """
        logger.info(
            "Processing turn",
            session_id=context.session_id,
            turn=context.turn_number,
        )

        # 1. Safety检测（并行）
        safety_result = await self.safety.process(context, user_message)
        if safety_result.data.get("risk_level") == "high":
            yield {
                "type": "safety_alert",
                "data": safety_result.data,
            }
            return

        # 2. Director决策
        director_result = await self.director.process(context, user_message)
        
        # 3. NPC生成回应（流式）
        npc_content = ""
        async for chunk in self.npc.process_stream(
            context,
            user_message,
            director_data=director_result.data,
        ):
            if chunk.delta_content:
                npc_content += chunk.delta_content
                yield {
                    "type": "npc_delta",
                    "content": chunk.delta_content,
                }
        
        # 发送完整的NPC回应
        yield {
            "type": "npc_response",
            "content": npc_content,
        }
        
        # 更新历史记录
        context.history.append({
            "turn": context.turn_number,
            "user_message": user_message,
            "npc_response": npc_content,
        })

        # 4. Evaluator评估
        evaluator_result = await self.evaluator.process(context, user_message)
        
        yield {
            "type": "partial_score",
            "data": evaluator_result.data,
        }

        # 5. Coach提示（Train模式）
        if context.mode == "train":
            coach_result = await self.coach.process(
                context,
                user_message,
                evaluator_data=evaluator_result.data,
            )
            if coach_result.content:
                yield {
                    "type": "coach_hint",
                    "content": coach_result.content,
                }

        # 6. 检查是否结束
        if director_result.data.get("should_end"):
            final_report = await self.evaluator.generate_final_report(context)
            yield {
                "type": "session_end",
                "report": final_report,
            }

        yield {"type": "done"}

    async def process_turn_simple(
        self,
        context: AgentContext,
        user_message: str,
    ) -> dict[str, Any]:
        """处理一轮对话（非流式版本）"""
        results = {
            "npc_response": "",
            "partial_score": {},
            "coach_hint": None,
            "should_end": False,
            "final_report": None,
        }
        
        async for event in self.process_turn(context, user_message):
            event_type = event.get("type")
            if event_type == "npc_response":
                results["npc_response"] = event.get("content", "")
            elif event_type == "partial_score":
                results["partial_score"] = event.get("data", {})
            elif event_type == "coach_hint":
                results["coach_hint"] = event.get("content")
            elif event_type == "session_end":
                results["should_end"] = True
                results["final_report"] = event.get("report")
        
        return results

    async def end_session(self, context: AgentContext) -> dict[str, Any]:
        """结束会话，生成最终报告"""
        logger.info("Ending session", session_id=context.session_id)
        
        # 生成最终报告
        final_report = await self.evaluator.generate_final_report(context)
        
        # 存储记忆
        await self.memory.process(
            context,
            action="store",
            data={
                "session_id": context.session_id,
                "report": final_report,
            },
        )
        
        # 清理资源
        await self._cleanup_all()
        
        return final_report

    async def pause_session(self, context: AgentContext) -> dict[str, Any]:
        """暂停会话（Train模式）"""
        if context.mode != "train":
            return {"error": "Only available in train mode"}
        
        return await self.coach.pause_review(context)

    async def _cleanup_all(self) -> None:
        """清理所有Agent资源"""
        await self.director.cleanup()
        await self.npc.cleanup()
        await self.evaluator.cleanup()
        await self.coach.cleanup()
        await self.safety.cleanup()
        await self.memory.cleanup()

    def get_session_state(self) -> dict[str, Any]:
        """获取当前会话状态"""
        return {
            "director": self.director.get_state(),
            "npc": self.npc.get_state(),
            "evaluator": self.evaluator.get_state(),
            "coach": self.coach.get_state(),
            "safety": self.safety.get_state(),
            "memory": self.memory.get_state(),
        }
