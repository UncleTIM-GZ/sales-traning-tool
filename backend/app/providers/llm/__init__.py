"""LLM Provider模块

使用阿里云百炼 (DashScope / Model Studio) 作为大模型服务。

支持的模型:
- qwen-max: 效果最佳，适合复杂任务
- qwen-plus: 能力均衡，推荐使用
- qwen-turbo: 高速低成本
- qwen-long: 超长上下文 (最高1M tokens)

文档: https://help.aliyun.com/zh/model-studio/
"""

from app.providers.llm.base import (
    BaseLLMProvider,
    ChatMessage,
    ChatResponse,
    FunctionCall,
    StreamChunk,
    ToolCall,
    ToolDefinition,
    UsageInfo,
)
from app.providers.llm.dashscope import DashScopeLLMProvider
from app.providers.llm.factory import get_llm_provider, get_default_provider

__all__ = [
    # Base classes
    "BaseLLMProvider",
    "ChatMessage",
    "ChatResponse",
    "FunctionCall",
    "StreamChunk",
    "ToolCall",
    "ToolDefinition",
    "UsageInfo",
    # DashScope Provider
    "DashScopeLLMProvider",
    # Factory functions
    "get_llm_provider",
    "get_default_provider",
]
