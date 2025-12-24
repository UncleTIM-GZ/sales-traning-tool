"""LLM Provider工厂

使用阿里云百炼平台 (DashScope) 作为唯一的LLM服务。

文档: https://help.aliyun.com/zh/model-studio/
"""

from app.config import settings
from app.providers.llm.base import BaseLLMProvider
from app.providers.llm.dashscope import DashScopeLLMProvider


def get_llm_provider(**kwargs) -> BaseLLMProvider:
    """获取LLM Provider实例
    
    使用阿里云百炼 (DashScope) 作为LLM服务。
    
    Args:
        **kwargs: 传递给Provider构造函数的参数，可覆盖默认配置
        
    Returns:
        DashScopeLLMProvider实例
        
    Raises:
        ValueError: 未配置API Key
    """
    api_key = kwargs.get("api_key", settings.dashscope_api_key)
    
    if not api_key:
        raise ValueError(
            "阿里云百炼 API Key 未配置。\n"
            "请在 .env 文件中设置 DASHSCOPE_API_KEY。\n"
            "获取API Key: https://bailian.console.aliyun.com/#/api-key"
        )
    
    return DashScopeLLMProvider(
        api_key=api_key,
        base_url=kwargs.get("base_url", settings.dashscope_base_url),
        model=kwargs.get("model", settings.dashscope_model),
        region=kwargs.get("region", settings.dashscope_region),
        timeout=kwargs.get("timeout", 120.0),
        enable_thinking=kwargs.get("enable_thinking", settings.dashscope_enable_thinking),
    )


# 全局Provider实例（惰性初始化）
_default_provider: BaseLLMProvider | None = None


def get_default_provider() -> BaseLLMProvider:
    """获取默认的LLM Provider实例（单例）"""
    global _default_provider
    if _default_provider is None:
        _default_provider = get_llm_provider()
    return _default_provider


async def close_default_provider() -> None:
    """关闭默认Provider"""
    global _default_provider
    if _default_provider is not None:
        await _default_provider.close()
        _default_provider = None
