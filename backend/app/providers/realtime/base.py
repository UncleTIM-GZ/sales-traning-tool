"""实时语音对话 Provider 基础类

定义实时语音对话的核心接口和数据结构。
支持全双工语音对话、VAD检测、打断能力。
"""

import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Literal


class RealtimeEventType(str, Enum):
    """实时事件类型"""
    
    # === 连接事件 ===
    CONNECTED = "connected"              # 连接成功
    DISCONNECTED = "disconnected"        # 连接断开
    ERROR = "error"                       # 错误
    
    # === 会话事件 ===
    SESSION_CREATED = "session.created"           # 会话创建
    SESSION_UPDATED = "session.updated"           # 会话配置更新
    
    # === 输入事件 ===
    INPUT_AUDIO_BUFFER_COMMITTED = "input_audio_buffer.committed"     # 音频已提交
    INPUT_AUDIO_BUFFER_CLEARED = "input_audio_buffer.cleared"         # 音频已清除
    INPUT_AUDIO_BUFFER_SPEECH_STARTED = "input_audio_buffer.speech_started"   # 检测到说话开始
    INPUT_AUDIO_BUFFER_SPEECH_STOPPED = "input_audio_buffer.speech_stopped"   # 检测到说话结束
    
    # === 响应事件 ===
    RESPONSE_CREATED = "response.created"         # 响应开始
    RESPONSE_DONE = "response.done"               # 响应完成
    RESPONSE_CANCELLED = "response.cancelled"     # 响应被取消(打断)
    
    # === 文本事件 ===
    RESPONSE_TEXT_DELTA = "response.text.delta"           # 文本增量
    RESPONSE_TEXT_DONE = "response.text.done"             # 文本完成
    RESPONSE_AUDIO_TRANSCRIPT_DELTA = "response.audio_transcript.delta"   # 语音转录增量
    RESPONSE_AUDIO_TRANSCRIPT_DONE = "response.audio_transcript.done"     # 语音转录完成
    
    # === 音频事件 ===
    RESPONSE_AUDIO_DELTA = "response.audio.delta"         # 音频数据增量
    RESPONSE_AUDIO_DONE = "response.audio.done"           # 音频完成
    
    # === 用户输入转录 ===
    CONVERSATION_ITEM_INPUT_AUDIO_TRANSCRIPTION_COMPLETED = "conversation.item.input_audio_transcription.completed"


class VoiceType(str, Enum):
    """音色类型 (Qwen-Omni-Realtime支持的音色)"""
    
    # 女声
    CHERRY = "Cherry"         # 温柔女声
    SERENA = "Serena"         # 成熟女声
    ETHAN = "Ethan"           # 男声
    CHELSIE = "Chelsie"       # 活泼女声
    
    # 中文音色
    AITING = "aiting"         # 艾婷
    AITONG = "aitong"         # 艾彤
    AIYA = "aiya"             # 艾雅
    AIYUE = "aiyue"           # 艾悦
    AIXIA = "aixia"           # 艾夏
    AIYU = "aiyu"             # 艾雨
    
    # 更多音色参考文档


@dataclass
class TurnDetectionConfig:
    """VAD（语音活动检测）配置
    
    官方文档: https://help.aliyun.com/zh/model-studio/realtime
    """
    
    type: Literal["server_vad"] = "server_vad"  # VAD类型，固定为server_vad
    threshold: float = 0.5              # VAD检测阈值 (0-1)，嘈杂环境调高，安静环境调低
    silence_duration_ms: int = 800      # 静音多久后触发回复（毫秒）


@dataclass 
class SessionConfig:
    """会话配置
    
    官方文档: https://help.aliyun.com/zh/model-studio/realtime
    """
    
    # 输出模态
    modalities: list[Literal["text", "audio"]] = field(default_factory=lambda: ["text", "audio"])
    
    # 音色 (支持49种音色)
    voice: str = "Cherry"
    
    # 音频格式
    input_audio_format: Literal["pcm16"] = "pcm16"
    output_audio_format: Literal["pcm24"] = "pcm24"
    
    # 系统指令（角色设定）
    instructions: str = ""
    
    # VAD配置
    turn_detection: TurnDetectionConfig | None = None
    
    # 温度
    temperature: float = 0.8
    
    def to_dict(self) -> dict[str, Any]:
        """转换为API请求格式（符合官方文档）"""
        result: dict[str, Any] = {
            "modalities": self.modalities,
            "voice": self.voice,
            "input_audio_format": self.input_audio_format,
            "output_audio_format": self.output_audio_format,
        }
        
        if self.instructions:
            result["instructions"] = self.instructions
            
        if self.turn_detection:
            # 官方文档只支持这三个参数
            result["turn_detection"] = {
                "type": self.turn_detection.type,
                "threshold": self.turn_detection.threshold,
                "silence_duration_ms": self.turn_detection.silence_duration_ms,
            }
        else:
            result["turn_detection"] = None
            
        return result


@dataclass
class RealtimeConfig:
    """实时对话Provider配置"""
    
    api_key: str
    model: str = "qwen3-omni-flash-realtime"
    base_url: str = "wss://dashscope.aliyuncs.com/api-ws/v1/realtime"
    session: SessionConfig = field(default_factory=SessionConfig)


@dataclass
class RealtimeEvent:
    """实时事件"""
    
    type: RealtimeEventType | str
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    data: dict[str, Any] = field(default_factory=dict)
    
    # 便捷属性
    @property
    def delta(self) -> str | None:
        """获取增量内容（文本或转录）"""
        return self.data.get("delta")
    
    @property
    def audio_data(self) -> bytes | None:
        """获取音频数据（已解码）"""
        import base64
        delta = self.data.get("delta")
        if delta and isinstance(delta, str):
            try:
                return base64.b64decode(delta)
            except Exception:
                pass
        return None
    
    @property
    def transcript(self) -> str | None:
        """获取完整转录文本"""
        return self.data.get("transcript")
    
    @property
    def error_message(self) -> str | None:
        """获取错误信息"""
        error = self.data.get("error", {})
        if isinstance(error, dict):
            return error.get("message")
        return str(error) if error else None


class RealtimeCallback(ABC):
    """实时对话回调接口"""
    
    def on_connected(self) -> None:
        """连接成功"""
        pass
    
    def on_disconnected(self, code: int, reason: str) -> None:
        """连接断开"""
        pass
    
    def on_error(self, error: str) -> None:
        """发生错误"""
        pass
    
    def on_session_created(self, session: dict) -> None:
        """会话创建"""
        pass
    
    def on_session_updated(self, session: dict) -> None:
        """会话更新"""
        pass
    
    def on_speech_started(self) -> None:
        """检测到用户开始说话"""
        pass
    
    def on_speech_stopped(self) -> None:
        """检测到用户停止说话"""
        pass
    
    def on_user_transcript(self, transcript: str, is_final: bool = False) -> None:
        """用户语音转录"""
        pass
    
    def on_response_started(self, response_id: str) -> None:
        """AI开始回复"""
        pass
    
    def on_response_text_delta(self, delta: str) -> None:
        """AI回复文本增量"""
        pass
    
    def on_response_text_done(self, text: str) -> None:
        """AI回复文本完成"""
        pass
    
    def on_response_audio_delta(self, audio_data: bytes) -> None:
        """AI回复音频增量"""
        pass
    
    def on_response_audio_done(self) -> None:
        """AI回复音频完成"""
        pass
    
    def on_response_done(self, response: dict) -> None:
        """AI回复完成"""
        pass
    
    def on_response_cancelled(self) -> None:
        """AI回复被打断"""
        pass
    
    def on_event(self, event: RealtimeEvent) -> None:
        """原始事件（所有事件都会触发）"""
        pass


class BaseRealtimeProvider(ABC):
    """实时语音对话 Provider 基类
    
    提供全双工实时语音对话能力:
    - VAD自动检测用户说话
    - 实时语音识别和合成
    - 支持随时打断
    - 流式音频输入输出
    """
    
    def __init__(self, config: RealtimeConfig, callback: RealtimeCallback | None = None):
        self.config = config
        self.callback = callback
        self._connected = False
        self._session_id: str | None = None
    
    @property
    def is_connected(self) -> bool:
        """是否已连接"""
        return self._connected
    
    @property
    def session_id(self) -> str | None:
        """当前会话ID"""
        return self._session_id
    
    # === 连接管理 ===
    
    @abstractmethod
    async def connect(self) -> None:
        """建立WebSocket连接"""
        pass
    
    @abstractmethod
    async def disconnect(self) -> None:
        """断开连接"""
        pass
    
    # === 会话管理 ===
    
    @abstractmethod
    async def update_session(self, config: SessionConfig) -> None:
        """更新会话配置（可用于动态切换角色）"""
        pass
    
    # === 音频输入 ===
    
    @abstractmethod
    async def send_audio(self, audio_data: bytes) -> None:
        """发送音频数据
        
        Args:
            audio_data: PCM16格式的音频数据
        """
        pass
    
    @abstractmethod
    async def commit_audio(self) -> None:
        """提交音频缓冲区（手动模式使用）"""
        pass
    
    @abstractmethod
    async def clear_audio(self) -> None:
        """清空音频缓冲区"""
        pass
    
    # === 响应控制 ===
    
    @abstractmethod
    async def create_response(self) -> None:
        """手动触发AI响应（手动模式使用）"""
        pass
    
    @abstractmethod
    async def cancel_response(self) -> None:
        """取消/打断当前响应"""
        pass
    
    # === 便捷方法 ===
    
    def set_callback(self, callback: RealtimeCallback) -> None:
        """设置回调"""
        self.callback = callback
    
    async def update_instructions(self, instructions: str) -> None:
        """更新系统指令（角色设定）"""
        new_config = SessionConfig(
            modalities=self.config.session.modalities,
            voice=self.config.session.voice,
            instructions=instructions,
            turn_detection=self.config.session.turn_detection,
        )
        await self.update_session(new_config)
    
    async def switch_voice(self, voice: str) -> None:
        """切换音色"""
        new_config = SessionConfig(
            modalities=self.config.session.modalities,
            voice=voice,
            instructions=self.config.session.instructions,
            turn_detection=self.config.session.turn_detection,
        )
        await self.update_session(new_config)
