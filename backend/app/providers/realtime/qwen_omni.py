"""Qwen-Omni-Realtime Provider

阿里云百炼 Qwen-Omni-Realtime 实时语音对话实现。
支持全双工语音对话、VAD检测、随时打断。

文档: https://help.aliyun.com/zh/model-studio/realtime
"""

import asyncio
import base64
import json
import ssl
import uuid
from typing import Any

import structlog
import websockets
from websockets.client import WebSocketClientProtocol

from app.providers.realtime.base import (
    BaseRealtimeProvider,
    RealtimeCallback,
    RealtimeConfig,
    RealtimeEvent,
    RealtimeEventType,
    SessionConfig,
    TurnDetectionConfig,
)

logger = structlog.get_logger()


class QwenOmniRealtimeProvider(BaseRealtimeProvider):
    """Qwen-Omni-Realtime Provider
    
    使用阿里云百炼的Qwen-Omni-Realtime模型实现端到端实时语音对话。
    
    特性:
    - 端到端语音模型，无需分离ASR/LLM/TTS
    - VAD自动检测用户说话开始/结束
    - 全双工通信，支持随时打断
    - 支持49种音色、10种语言
    - 单次会话最长30分钟
    
    使用示例:
        config = RealtimeConfig(
            api_key="your-api-key",
            model="qwen3-omni-flash-realtime",
            session=SessionConfig(
                voice="Cherry",
                instructions="你是一个销售场景中的客户...",
                turn_detection=TurnDetectionConfig(
                    type="server_vad",
                    silence_duration_ms=800,
                ),
            ),
        )
        
        provider = QwenOmniRealtimeProvider(config, callback)
        await provider.connect()
        
        # 发送麦克风音频
        await provider.send_audio(audio_data)
    """
    
    def __init__(self, config: RealtimeConfig, callback: RealtimeCallback | None = None):
        super().__init__(config, callback)
        self._ws: WebSocketClientProtocol | None = None
        self._receive_task: asyncio.Task | None = None
        self._pending_responses: dict[str, dict] = {}
    
    async def connect(self) -> None:
        """建立WebSocket连接"""
        if self._connected:
            logger.warning("Already connected")
            return
        
        # 构建连接URL
        url = f"{self.config.base_url}?model={self.config.model}"
        
        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
        }
        
        logger.info(
            "Connecting to Qwen-Omni-Realtime",
            url=url,
            model=self.config.model,
        )
        
        try:
            # 创建SSL上下文（开发环境跳过证书验证）
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            
            self._ws = await websockets.connect(
                url,
                additional_headers=headers,  # websockets 15.x 使用 additional_headers
                ping_interval=20,      # 心跳间隔(秒)
                ping_timeout=10,       # 心跳超时(秒)
                close_timeout=5,       # 关闭超时(秒)
                ssl=ssl_context,
                max_size=10 * 1024 * 1024,  # 最大消息10MB
            )
            
            self._connected = True
            
            # 启动消息接收任务
            self._receive_task = asyncio.create_task(self._receive_loop())
            
            # 触发回调
            if self.callback:
                self.callback.on_connected()
            
            logger.info("Connected to Qwen-Omni-Realtime successfully")
            
            # 配置会话
            await self.update_session(self.config.session)
            
        except Exception as e:
            logger.error("Failed to connect", error=str(e))
            self._connected = False
            if self.callback:
                self.callback.on_error(f"Connection failed: {e}")
            raise
    
    async def disconnect(self) -> None:
        """断开连接"""
        if not self._connected:
            return
        
        self._connected = False
        
        # 取消接收任务
        if self._receive_task:
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass
            self._receive_task = None
        
        # 关闭WebSocket
        if self._ws:
            try:
                await self._ws.close()
            except Exception as e:
                logger.warning("Error closing websocket", error=str(e))
            self._ws = None
        
        # 触发回调
        if self.callback:
            self.callback.on_disconnected(1000, "Client disconnect")
        
        logger.info("Disconnected from Qwen-Omni-Realtime")
    
    async def update_session(self, config: SessionConfig) -> None:
        """更新会话配置"""
        if not self._connected or not self._ws:
            raise RuntimeError("Not connected")
        
        event = {
            "event_id": str(uuid.uuid4()),
            "type": "session.update",
            "session": config.to_dict(),
        }
        
        await self._send_event(event)
        
        # 更新本地配置
        self.config.session = config
        
        logger.debug("Session update sent", voice=config.voice)
    
    async def send_audio(self, audio_data: bytes) -> None:
        """发送音频数据
        
        Args:
            audio_data: PCM16格式音频，16kHz采样率，单声道
        """
        if not self._connected or not self._ws:
            raise RuntimeError("Not connected")
        
        # Base64编码
        audio_base64 = base64.b64encode(audio_data).decode("utf-8")
        
        event = {
            "event_id": str(uuid.uuid4()),
            "type": "input_audio_buffer.append",
            "audio": audio_base64,
        }
        
        await self._send_event(event)
    
    async def commit_audio(self) -> None:
        """提交音频缓冲区（手动模式使用）"""
        if not self._connected or not self._ws:
            raise RuntimeError("Not connected")
        
        event = {
            "event_id": str(uuid.uuid4()),
            "type": "input_audio_buffer.commit",
        }
        
        await self._send_event(event)
        logger.debug("Audio buffer committed")
    
    async def clear_audio(self) -> None:
        """清空音频缓冲区"""
        if not self._connected or not self._ws:
            raise RuntimeError("Not connected")
        
        event = {
            "event_id": str(uuid.uuid4()),
            "type": "input_audio_buffer.clear",
        }
        
        await self._send_event(event)
        logger.debug("Audio buffer cleared")
    
    async def create_response(self) -> None:
        """手动触发AI响应"""
        if not self._connected or not self._ws:
            raise RuntimeError("Not connected")
        
        event = {
            "event_id": str(uuid.uuid4()),
            "type": "response.create",
        }
        
        await self._send_event(event)
        logger.debug("Response creation requested")
    
    async def cancel_response(self) -> None:
        """取消/打断当前响应"""
        if not self._connected or not self._ws:
            raise RuntimeError("Not connected")
        
        event = {
            "event_id": str(uuid.uuid4()),
            "type": "response.cancel",
        }
        
        await self._send_event(event)
        logger.debug("Response cancelled")
    
    async def _send_event(self, event: dict) -> None:
        """发送事件到服务端"""
        if not self._ws:
            raise RuntimeError("WebSocket not connected")
        
        message = json.dumps(event, ensure_ascii=False)
        await self._ws.send(message)
    
    async def _receive_loop(self) -> None:
        """消息接收循环"""
        if not self._ws:
            return
        
        try:
            async for message in self._ws:
                if isinstance(message, bytes):
                    message = message.decode("utf-8")
                
                try:
                    data = json.loads(message)
                    await self._handle_event(data)
                except json.JSONDecodeError as e:
                    logger.warning("Failed to parse message", error=str(e))
                    
        except websockets.exceptions.ConnectionClosed as e:
            logger.info("WebSocket connection closed", code=e.code, reason=e.reason)
            self._connected = False
            if self.callback:
                self.callback.on_disconnected(e.code, e.reason or "Connection closed")
                
        except asyncio.CancelledError:
            logger.debug("Receive loop cancelled")
            raise
            
        except Exception as e:
            logger.error("Error in receive loop", error=str(e))
            if self.callback:
                self.callback.on_error(str(e))
    
    async def _handle_event(self, data: dict) -> None:
        """处理服务端事件"""
        event_type = data.get("type", "")
        event_id = data.get("event_id", "")
        
        # 调试日志
        if event_type not in ("response.audio.delta",):  # 音频增量太频繁不打印
            print(f"[QWEN] Received event: {event_type}")
        
        # 构建事件对象
        event = RealtimeEvent(
            type=event_type,
            event_id=event_id,
            data=data,
        )
        
        # 触发原始事件回调
        if self.callback:
            self.callback.on_event(event)
        
        # 根据事件类型触发特定回调
        if not self.callback:
            return
        
        if event_type == "session.created":
            self._session_id = data.get("session", {}).get("id")
            self.callback.on_session_created(data.get("session", {}))
            
        elif event_type == "session.updated":
            self.callback.on_session_updated(data.get("session", {}))
            
        elif event_type == "input_audio_buffer.speech_started":
            self.callback.on_speech_started()
            
        elif event_type == "input_audio_buffer.speech_stopped":
            self.callback.on_speech_stopped()
            
        elif event_type == "conversation.item.input_audio_transcription.completed":
            transcript = data.get("transcript", "")
            self.callback.on_user_transcript(transcript, is_final=True)
            
        elif event_type == "response.created":
            response = data.get("response", {})
            response_id = response.get("id", "")
            self._pending_responses[response_id] = {"text": "", "audio_chunks": []}
            self.callback.on_response_started(response_id)
            
        elif event_type == "response.text.delta":
            delta = data.get("delta", "")
            self.callback.on_response_text_delta(delta)
            
        elif event_type == "response.text.done":
            text = data.get("text", "")
            self.callback.on_response_text_done(text)
            
        elif event_type == "response.audio_transcript.delta":
            delta = data.get("delta", "")
            self.callback.on_response_text_delta(delta)
            
        elif event_type == "response.audio_transcript.done":
            transcript = data.get("transcript", "")
            self.callback.on_response_text_done(transcript)
            
        elif event_type == "response.audio.delta":
            audio_base64 = data.get("delta", "")
            if audio_base64:
                try:
                    audio_data = base64.b64decode(audio_base64)
                    self.callback.on_response_audio_delta(audio_data)
                except Exception as e:
                    logger.warning("Failed to decode audio", error=str(e))
                    
        elif event_type == "response.audio.done":
            self.callback.on_response_audio_done()
            
        elif event_type == "response.done":
            response = data.get("response", {})
            self.callback.on_response_done(response)
            # 清理
            response_id = response.get("id", "")
            self._pending_responses.pop(response_id, None)
            
        elif event_type == "response.cancelled":
            self.callback.on_response_cancelled()
            
        elif event_type == "error":
            error = data.get("error", {})
            error_msg = error.get("message", str(error))
            self.callback.on_error(error_msg)
            logger.error("Server error", error=error)


# === 便捷函数 ===

def create_sales_npc_config(
    api_key: str,
    npc_name: str = "张总",
    npc_identity: str = "某科技公司采购总监",
    persona_type: str = "tough",
    intensity: int = 7,
    voice: str = "Cherry",
    goals: list[str] | None = None,
) -> RealtimeConfig:
    """创建销售NPC的实时对话配置
    
    Args:
        api_key: 百炼API Key
        npc_name: NPC名称
        npc_identity: NPC身份
        persona_type: 角色类型 (tough/cold/friendly/skeptical)
        intensity: 难度强度 (1-10)
        voice: 音色
        goals: NPC目标列表
        
    Returns:
        RealtimeConfig: 配置对象
    """
    from app.agents.npc import DEFAULT_PERSONAS
    
    # 获取角色配置
    persona_config = DEFAULT_PERSONAS.get(persona_type, DEFAULT_PERSONAS["tough"])
    
    # 构建目标
    if goals is None:
        goals = ["筛选供应商", "压低价格", "了解产品详情"]
    goals_text = "\n".join([f"- {goal}" for goal in goals])
    
    # 构建系统指令
    instructions = f"""你是一个销售场景中的{persona_config['persona_type']}客户角色。

## 你的角色设定
- 姓名: {npc_name}
- 身份: {npc_identity}
- 性格特点: {persona_config['personality']}
- 沟通风格: {persona_config['communication_style']}
- 当前情绪: {persona_config['current_mood']}

## 你的目标
{goals_text}

## 对话约束
- 强度等级: {intensity}/10 (越高越难应对)
- 保持角色一致性，不要出戏
- 回应要自然，像真实对话
- 避免过于模板化的回答
- 说话简洁，每次只说一两句话
- 禁止使用侵犯性、歧视性或危险话题

请根据以上设定，以该角色的身份用语音回应销售人员。"""

    return RealtimeConfig(
        api_key=api_key,
        model="qwen3-omni-flash-realtime",
        session=SessionConfig(
            modalities=["text", "audio"],
            voice=voice,
            instructions=instructions,
            turn_detection=TurnDetectionConfig(
                type="server_vad",
                threshold=0.5,
                silence_duration_ms=800,
            ),
        ),
    )
