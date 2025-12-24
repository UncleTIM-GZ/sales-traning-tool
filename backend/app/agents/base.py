"""Agent基类定义"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, AsyncGenerator

from app.providers.llm.base import (
    BaseLLMProvider,
    ChatMessage,
    ChatResponse,
    StreamChunk,
    ToolDefinition,
)
from app.providers.llm.factory import get_default_provider


class AgentType(str, Enum):
    """Agent类型"""
    DIRECTOR = "director"
    NPC = "npc"
    EVALUATOR = "evaluator"
    COACH = "coach"
    SAFETY = "safety"
    MEMORY = "memory"


@dataclass
class AgentContext:
    """Agent上下文"""
    session_id: str
    user_id: str
    scenario_id: str
    mode: str  # train/exam/replay
    seed: int | None = None
    turn_number: int = 0
    history: list[dict[str, Any]] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentResult:
    """Agent执行结果"""
    success: bool
    content: str | None = None
    data: dict[str, Any] = field(default_factory=dict)
    error: str | None = None


class BaseAgent(ABC):
    """Agent基类

    所有Agent必须继承此类并实现process方法
    """

    def __init__(self, agent_type: AgentType, llm_provider: BaseLLMProvider | None = None):
        self.agent_type = agent_type
        self._state: dict[str, Any] = {}
        self._llm: BaseLLMProvider | None = llm_provider

    @property
    def llm(self) -> BaseLLMProvider:
        """获取LLM Provider（惰性初始化）"""
        if self._llm is None:
            self._llm = get_default_provider()
        return self._llm

    async def chat(
        self,
        messages: list[ChatMessage],
        temperature: float = 0.7,
        max_tokens: int | None = None,
        tools: list[ToolDefinition] | None = None,
        **kwargs: Any,
    ) -> ChatResponse:
        """便捷方法：发送聊天请求"""
        return await self.llm.chat(
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            tools=tools,
            **kwargs,
        )

    async def chat_stream(
        self,
        messages: list[ChatMessage],
        temperature: float = 0.7,
        max_tokens: int | None = None,
        **kwargs: Any,
    ) -> AsyncGenerator[StreamChunk, None]:
        """便捷方法：发送流式聊天请求"""
        async for chunk in self.llm.chat_stream(
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs,
        ):
            yield chunk

    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        **kwargs: Any,
    ) -> str:
        """便捷方法：简单文本生成"""
        messages = []
        if system_prompt:
            messages.append(ChatMessage(role="system", content=system_prompt))
        messages.append(ChatMessage(role="user", content=prompt))
        
        response = await self.chat(messages, **kwargs)
        return response.content or ""

    @abstractmethod
    async def process(
        self,
        context: AgentContext,
        message: str | None = None,
        **kwargs: Any,
    ) -> AgentResult:
        """处理输入，返回结果

        Args:
            context: Agent上下文
            message: 用户消息（可选）
            **kwargs: 额外参数

        Returns:
            AgentResult: 处理结果
        """
        pass

    async def initialize(self, context: AgentContext) -> None:
        """初始化Agent状态"""
        self._state = {
            "session_id": context.session_id,
            "initialized": True,
        }

    async def cleanup(self) -> None:
        """清理Agent资源"""
        self._state = {}

    def get_state(self) -> dict[str, Any]:
        """获取当前状态"""
        return self._state.copy()

    def update_state(self, **kwargs: Any) -> None:
        """更新状态"""
        self._state.update(kwargs)
