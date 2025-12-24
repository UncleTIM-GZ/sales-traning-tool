"""LLM Provider基础类定义"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, AsyncGenerator, Literal


class MessageRole(str, Enum):
    """消息角色"""
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


@dataclass
class FunctionCall:
    """函数调用"""
    name: str
    arguments: str  # JSON字符串


@dataclass
class ToolCall:
    """工具调用"""
    id: str
    type: str = "function"
    function: FunctionCall | None = None


@dataclass
class ChatMessage:
    """聊天消息"""
    role: Literal["system", "user", "assistant", "tool"]
    content: str | None = None
    name: str | None = None  # 用于function/tool消息
    tool_calls: list[ToolCall] | None = None
    tool_call_id: str | None = None  # 用于tool响应

    def to_dict(self) -> dict[str, Any]:
        """转换为字典"""
        result: dict[str, Any] = {"role": self.role}
        
        if self.content is not None:
            result["content"] = self.content
        if self.name is not None:
            result["name"] = self.name
        if self.tool_calls:
            result["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": tc.type,
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    } if tc.function else None
                }
                for tc in self.tool_calls
            ]
        if self.tool_call_id is not None:
            result["tool_call_id"] = self.tool_call_id
            
        return result


@dataclass
class ToolDefinition:
    """工具定义"""
    name: str
    description: str
    parameters: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        """转换为OpenAI格式的工具定义"""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            }
        }


@dataclass
class UsageInfo:
    """Token使用信息"""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


@dataclass
class ChatResponse:
    """聊天响应"""
    content: str | None = None
    tool_calls: list[ToolCall] | None = None
    finish_reason: str | None = None
    usage: UsageInfo | None = None
    model: str | None = None
    
    # 流式响应增量
    delta_content: str | None = None
    is_stream: bool = False


@dataclass
class StreamChunk:
    """流式响应块"""
    delta_content: str | None = None
    tool_calls: list[ToolCall] | None = None
    finish_reason: str | None = None
    usage: UsageInfo | None = None


class BaseLLMProvider(ABC):
    """LLM Provider基类
    
    所有LLM提供商必须实现此接口
    """

    def __init__(
        self,
        api_key: str,
        base_url: str | None = None,
        model: str = "qwen-plus",
        timeout: float = 60.0,
    ):
        self.api_key = api_key
        self.base_url = base_url
        self.default_model = model
        self.timeout = timeout

    @abstractmethod
    async def chat(
        self,
        messages: list[ChatMessage],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        tools: list[ToolDefinition] | None = None,
        tool_choice: str | dict | None = None,
        seed: int | None = None,
        **kwargs: Any,
    ) -> ChatResponse:
        """发送聊天请求（非流式）
        
        Args:
            messages: 消息列表
            model: 模型名称，不指定则使用默认模型
            temperature: 温度参数 (0-2)
            max_tokens: 最大输出token数
            tools: 工具定义列表（用于Function Calling）
            tool_choice: 工具选择策略
            seed: 随机种子（用于可复现输出）
            **kwargs: 其他参数
            
        Returns:
            ChatResponse: 聊天响应
        """
        pass

    @abstractmethod
    async def chat_stream(
        self,
        messages: list[ChatMessage],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        tools: list[ToolDefinition] | None = None,
        tool_choice: str | dict | None = None,
        seed: int | None = None,
        **kwargs: Any,
    ) -> AsyncGenerator[StreamChunk, None]:
        """发送聊天请求（流式）
        
        Args:
            与chat方法相同
            
        Yields:
            StreamChunk: 流式响应块
        """
        pass

    def _prepare_messages(self, messages: list[ChatMessage]) -> list[dict[str, Any]]:
        """准备消息格式"""
        return [msg.to_dict() for msg in messages]

    def _prepare_tools(self, tools: list[ToolDefinition] | None) -> list[dict] | None:
        """准备工具定义格式"""
        if tools is None:
            return None
        return [tool.to_dict() for tool in tools]
