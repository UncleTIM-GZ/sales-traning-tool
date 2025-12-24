"""阿里云百炼 (DashScope) LLM Provider

使用阿里云百炼官方SDK (v1.25+) 最新最佳实践接入通义千问大模型。

支持的模型:
- qwen-max / qwen3-max: 效果最佳，适合复杂任务
- qwen-plus / qwen3-plus: 能力均衡，推荐使用
- qwen-turbo / qwen3-turbo: 高速低成本
- qwen-long: 超长上下文 (最高1M tokens)

官方文档: https://help.aliyun.com/zh/model-studio/
SDK文档: https://github.com/dashscope/dashscope-sdk-python
"""

import json
from http import HTTPStatus
from typing import Any, AsyncGenerator

import dashscope
from dashscope import AioGeneration, Generation
from dashscope.api_entities.dashscope_response import Role
import structlog

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

logger = structlog.get_logger()


class DashScopeLLMProvider(BaseLLMProvider):
    """阿里云百炼 LLM Provider
    
    使用官方 dashscope SDK (v1.25+) 的 AioGeneration 异步API。
    
    支持的模型:
    - qwen-max / qwen3-max: 效果最佳，适合复杂任务
    - qwen-plus / qwen3-plus: 能力均衡，推荐使用  
    - qwen-turbo / qwen3-turbo: 高速低成本
    - qwen-long: 超长上下文 (最高1M tokens)
    
    特性:
    - 原生异步支持 (AioGeneration)
    - 流式输出 (incremental_output)
    - Function Calling (工具调用)
    - 思考模式 (enable_thinking)
    - 多轮对话
    """

    DEFAULT_MODEL = "qwen3-max"

    def __init__(
        self,
        api_key: str,
        base_url: str | None = None,
        model: str = DEFAULT_MODEL,
        region: str = "beijing",
        timeout: float = 120.0,
        enable_thinking: bool = False,
    ):
        """初始化百炼Provider
        
        Args:
            api_key: 百炼API Key (格式: sk-xxx)
            base_url: API地址 (可选，SDK自动处理)
            model: 默认模型
            region: 地域 (beijing/singapore/finance)
            timeout: 请求超时时间
            enable_thinking: 是否启用思考模式 (仅qwen-plus支持)
        """
        super().__init__(api_key, base_url, model, timeout)
        self.enable_thinking = enable_thinking
        self.region = region
        
        # 设置SDK全局API Key
        dashscope.api_key = api_key
        
        logger.info(
            "DashScope Provider initialized (SDK v1.25+)",
            model=model,
            region=region,
            enable_thinking=enable_thinking,
        )

    async def close(self) -> None:
        """关闭Provider (SDK自动管理连接)"""
        pass

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
        """发送聊天请求（非流式）- 使用 AioGeneration 异步API
        
        Args:
            messages: 消息列表
            model: 模型名称
            temperature: 温度参数 (0-2)
            max_tokens: 最大生成token数
            tools: 工具定义列表
            tool_choice: 工具选择策略
            seed: 随机种子
            
        Returns:
            ChatResponse: 聊天响应
        """
        model = model or self.default_model
        
        # 准备请求参数
        request_params = self._build_request_params(
            messages=messages,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            tools=tools,
            tool_choice=tool_choice,
            seed=seed,
            stream=False,
            **kwargs,
        )
        
        logger.debug(
            "DashScope async chat request",
            model=model,
            message_count=len(messages),
        )
        
        # 使用官方异步API
        response = await AioGeneration.call(**request_params)
        
        if response.status_code != HTTPStatus.OK:
            logger.error(
                "DashScope API error",
                status_code=response.status_code,
                code=response.code,
                message=response.message,
                request_id=response.request_id,
            )
            raise Exception(f"DashScope API Error [{response.code}]: {response.message}")
        
        return self._parse_response(response)

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
        """发送聊天请求（流式）- 使用 AioGeneration 异步流式API
        
        Args:
            messages: 消息列表
            model: 模型名称
            temperature: 温度参数 (0-2)
            max_tokens: 最大生成token数
            tools: 工具定义列表
            tool_choice: 工具选择策略
            seed: 随机种子
            
        Yields:
            StreamChunk: 流式响应块
        """
        model = model or self.default_model
        
        # 准备请求参数
        request_params = self._build_request_params(
            messages=messages,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            tools=tools,
            tool_choice=tool_choice,
            seed=seed,
            stream=True,
            incremental_output=True,  # 增量输出
            **kwargs,
        )
        
        logger.debug(
            "DashScope async stream request",
            model=model,
            message_count=len(messages),
        )
        
        # 使用官方异步流式API
        async for response in await AioGeneration.call(**request_params):
            if response.status_code != HTTPStatus.OK:
                logger.error(
                    "DashScope stream API error",
                    status_code=response.status_code,
                    code=response.code,
                    message=response.message,
                )
                raise Exception(f"DashScope API Error [{response.code}]: {response.message}")
            
            chunk = self._parse_stream_chunk(response)
            if chunk:
                yield chunk

    def _build_request_params(
        self,
        messages: list[ChatMessage],
        model: str,
        temperature: float,
        max_tokens: int | None,
        tools: list[ToolDefinition] | None,
        tool_choice: str | dict | None,
        seed: int | None,
        stream: bool,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """构建请求参数"""
        params: dict[str, Any] = {
            "model": model,
            "messages": self._prepare_messages(messages),
            "temperature": temperature,
            "result_format": "message",  # 使用消息格式
            "stream": stream,
        }
        
        if max_tokens is not None:
            params["max_tokens"] = max_tokens
            
        if tools:
            params["tools"] = self._prepare_tools(tools)
            
        if tool_choice is not None:
            params["tool_choice"] = tool_choice
            
        if seed is not None:
            params["seed"] = seed
            
        # 思考模式（仅qwen-plus支持）
        if self.enable_thinking and "plus" in model.lower():
            params["enable_thinking"] = True
        
        # 增量输出（流式模式）
        if kwargs.get("incremental_output"):
            params["incremental_output"] = True
            
        return params

    def _prepare_messages(self, messages: list[ChatMessage]) -> list[dict]:
        """准备消息格式 - 使用官方 Role 枚举"""
        prepared = []
        for msg in messages:
            # 使用官方Role枚举
            role = msg.role
            if role == "system":
                role = Role.SYSTEM
            elif role == "user":
                role = Role.USER
            elif role == "assistant":
                role = Role.ASSISTANT
            elif role == "tool":
                role = Role.TOOL
            
            message = {
                "role": role,
                "content": msg.content or "",
            }
            
            # 添加name字段
            if msg.name:
                message["name"] = msg.name
                
            # 添加tool_calls
            if msg.tool_calls:
                message["tool_calls"] = [
                    {
                        "id": tc.id,
                        "type": tc.type,
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        } if tc.function else None,
                    }
                    for tc in msg.tool_calls
                ]
                
            # 添加tool_call_id (用于工具响应)
            if msg.tool_call_id:
                message["tool_call_id"] = msg.tool_call_id
                
            prepared.append(message)
            
        return prepared

    def _prepare_tools(self, tools: list[ToolDefinition]) -> list[dict]:
        """准备工具定义"""
        return [
            {
                "type": tool.type,
                "function": {
                    "name": tool.function.name,
                    "description": tool.function.description,
                    "parameters": tool.function.parameters,
                } if tool.function else None,
            }
            for tool in tools
        ]

    def _parse_response(self, response) -> ChatResponse:
        """解析非流式响应"""
        output = response.output
        
        # 检查响应格式
        if hasattr(output, 'choices') and output.choices:
            message = output.choices[0].message
            finish_reason = output.choices[0].finish_reason
        else:
            # 旧格式兼容
            message = output
            finish_reason = output.finish_reason if hasattr(output, 'finish_reason') else None
        
        # 解析内容
        content = None
        if hasattr(message, 'content'):
            content = message.content
        elif hasattr(output, 'text'):
            content = output.text
        
        # 解析工具调用
        tool_calls = None
        try:
            if hasattr(message, 'tool_calls') and message.tool_calls:
                tool_calls = [
                    ToolCall(
                        id=tc.get("id", "") if isinstance(tc, dict) else getattr(tc, 'id', ''),
                        type=tc.get("type", "function") if isinstance(tc, dict) else getattr(tc, 'type', 'function'),
                        function=FunctionCall(
                            name=tc.get("function", {}).get("name", "") if isinstance(tc, dict) else getattr(tc.function, 'name', ''),
                            arguments=tc.get("function", {}).get("arguments", "{}") if isinstance(tc, dict) else getattr(tc.function, 'arguments', '{}'),
                        ),
                    )
                    for tc in message.tool_calls
                ]
        except Exception:
            # 忽略工具调用解析错误
            pass
        
        # 解析使用信息
        usage = None
        if response.usage:
            usage = UsageInfo(
                prompt_tokens=response.usage.input_tokens,
                completion_tokens=response.usage.output_tokens,
                total_tokens=response.usage.input_tokens + response.usage.output_tokens,
            )
        
        return ChatResponse(
            content=content,
            tool_calls=tool_calls,
            finish_reason=finish_reason,
            usage=usage,
            model=response.model if hasattr(response, 'model') else None,
        )

    def _parse_stream_chunk(self, response) -> StreamChunk | None:
        """解析流式响应块"""
        output = response.output
        
        if not output:
            # 可能是最后一个包含usage的chunk
            if response.usage:
                return StreamChunk(
                    usage=UsageInfo(
                        prompt_tokens=response.usage.input_tokens,
                        completion_tokens=response.usage.output_tokens,
                        total_tokens=response.usage.input_tokens + response.usage.output_tokens,
                    )
                )
            return None
        
        # 检查响应格式
        if hasattr(output, 'choices') and output.choices:
            choice = output.choices[0]
            message = choice.message if hasattr(choice, 'message') else None
            finish_reason = choice.finish_reason if hasattr(choice, 'finish_reason') else None
            content = message.content if message and hasattr(message, 'content') else None
        else:
            # 旧格式兼容
            content = output.text if hasattr(output, 'text') else None
            finish_reason = output.finish_reason if hasattr(output, 'finish_reason') else None
            message = None
        
        # 解析增量工具调用
        tool_calls = None
        try:
            if message and hasattr(message, 'tool_calls') and message.tool_calls:
                tool_calls = [
                    ToolCall(
                        id=tc.get("id", "") if isinstance(tc, dict) else getattr(tc, 'id', ''),
                        type=tc.get("type", "function") if isinstance(tc, dict) else getattr(tc, 'type', 'function'),
                        function=FunctionCall(
                            name=tc.get("function", {}).get("name", "") if isinstance(tc, dict) else getattr(tc.function, 'name', ''),
                            arguments=tc.get("function", {}).get("arguments", "") if isinstance(tc, dict) else getattr(tc.function, 'arguments', ''),
                        ),
                    )
                    for tc in message.tool_calls
                ]
        except Exception:
            # 忽略工具调用解析错误
            pass
        
        return StreamChunk(
            delta_content=content,
            tool_calls=tool_calls,
            finish_reason=finish_reason,
        )

    # =========== 便捷方法 ===========

    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        **kwargs: Any,
    ) -> str:
        """简化的文本生成方法
        
        Args:
            prompt: 用户提示
            system_prompt: 系统提示
            **kwargs: 传递给chat的其他参数
            
        Returns:
            生成的文本
        """
        messages = []
        if system_prompt:
            messages.append(ChatMessage(role="system", content=system_prompt))
        messages.append(ChatMessage(role="user", content=prompt))
        
        response = await self.chat(messages, **kwargs)
        return response.content or ""

    async def generate_stream(
        self,
        prompt: str,
        system_prompt: str | None = None,
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        """简化的流式文本生成方法
        
        Args:
            prompt: 用户提示
            system_prompt: 系统提示
            **kwargs: 传递给chat_stream的其他参数
            
        Yields:
            生成的文本片段
        """
        messages = []
        if system_prompt:
            messages.append(ChatMessage(role="system", content=system_prompt))
        messages.append(ChatMessage(role="user", content=prompt))
        
        async for chunk in self.chat_stream(messages, **kwargs):
            if chunk.delta_content:
                yield chunk.delta_content
