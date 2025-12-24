"""应用配置管理"""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """应用配置"""

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),  # 先查找当前目录，再查找父目录（后者作为后备）
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # 忽略未定义的额外环境变量
    )

    # 应用配置
    app_name: str = "Agentic Simulation Platform"
    app_env: Literal["development", "staging", "production"] = "development"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"

    # 服务器配置
    host: str = "0.0.0.0"
    port: int = 8111
    
    # CORS 配置 - 生产环境设置允许的域名
    cors_origins: str = "*"  # 逗号分隔，如: https://sales.syhub.net,https://admin.syhub.net

    # 数据库配置
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:8108/asp_db"

    # Redis配置
    redis_url: str = "redis://localhost:8109/0"

    # JWT配置
    jwt_secret: str = "your-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440  # 24小时

    # ===== LLM配置 (阿里云百炼) =====
    # 阿里云百炼 (Model Studio) - 通义千问大模型
    # 获取API Key: https://bailian.console.aliyun.com/#/api-key
    # 文档: https://help.aliyun.com/zh/model-studio/
    dashscope_api_key: str = ""
    dashscope_model: str = "qwen3-max"  # qwen3-max, qwen-plus, qwen-turbo, qwen-long
    dashscope_base_url: str | None = None  # 默认自动根据region选择
    dashscope_region: Literal["beijing", "singapore", "finance"] = "beijing"
    dashscope_enable_thinking: bool = False  # 是否启用思考模式(仅qwen-plus支持)

    # ===== 实时语音对话配置 =====
    # 阿里云百炼 Qwen-Omni-Realtime 配置
    # 文档: https://help.aliyun.com/zh/model-studio/realtime
    realtime_model: str = "qwen3-omni-flash-realtime"  # 实时语音对话模型
    realtime_voice: str = "Cherry"  # 默认音色
    realtime_base_url: str = "wss://dashscope.aliyuncs.com/api-ws/v1/realtime"
    
    # VAD配置
    realtime_vad_threshold: float = 0.5  # VAD检测阈值 (0-1)
    realtime_silence_duration_ms: int = 800  # 静音多久后触发回复

    # ===== 语音配置(传统ASR/TTS) =====
    # 豆包语音配置(可选)
    doubao_api_key: str = ""

    # 阿里云ASR配置(可选)
    aliyun_asr_key: str = ""
    aliyun_asr_secret: str = ""

    # Celery配置
    celery_broker_url: str = "redis://localhost:8109/1"
    celery_result_backend: str = "redis://localhost:8109/2"

    # ===== 微信开放平台配置 =====
    # 微信开放平台: https://open.weixin.qq.com/
    # 网站应用需要在开放平台创建应用并获取 AppID 和 AppSecret
    wechat_app_id: str = ""  # 微信开放平台 AppID
    wechat_app_secret: str = ""  # 微信开放平台 AppSecret
    wechat_redirect_uri: str = ""  # 授权回调地址，如: https://yourdomain.com/api/v1/auth/wechat/callback
    
    # 微信公众号配置 (用于公众号内网页授权)
    wechat_mp_app_id: str = ""  # 公众号 AppID
    wechat_mp_app_secret: str = ""  # 公众号 AppSecret

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    """获取配置单例"""
    return Settings()


settings = get_settings()
