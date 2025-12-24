"""
开发：Excellent（11964948@qq.com）
功能：系统配置服务
作用：管理支付配置、登录配置等系统级配置
创建时间：2025-12-24
最后修改：2025-12-24
"""

import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.system_config import SystemConfig


# 配置键常量
CONFIG_KEY_WECHAT_PAY = "wechat_pay_config"
CONFIG_KEY_ALIPAY = "alipay_config"
CONFIG_KEY_WECHAT_LOGIN = "wechat_login_config"
CONFIG_KEY_POINTS_CONSUMPTION = "points_consumption_config"


# 默认积分消耗配置
DEFAULT_POINTS_CONSUMPTION_CONFIG = {
    # 基础消耗
    "points_per_text_session": 10,      # 文字对话每次消耗
    "points_per_voice_session": 20,     # 语音对话每次消耗
    
    # 每日免费次数 (按会员等级)
    "free_sessions_by_level": {
        "free": 3,
        "pro": 10,
        "enterprise": -1  # -1 表示无限
    },
    
    # VIP折扣率 (百分比，20表示8折)
    "vip_discount_rates": {
        "free": 0,
        "pro": 20,        # 8折
        "enterprise": 50  # 5折
    },
    
    # 场景类型倍率
    "scenario_multipliers": {
        "basic": 1.0,
        "advanced": 1.5,
        "custom": 2.0
    }
}


class SystemConfigService:
    """系统配置服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_config(self, key: str) -> dict[str, Any] | None:
        """获取配置"""
        result = await self.db.execute(
            select(SystemConfig).where(SystemConfig.key == key)
        )
        config = result.scalar_one_or_none()
        return config.value if config else None

    async def set_config(
        self, key: str, value: dict[str, Any], description: str | None = None
    ) -> SystemConfig:
        """设置配置"""
        result = await self.db.execute(
            select(SystemConfig).where(SystemConfig.key == key)
        )
        config = result.scalar_one_or_none()

        if config:
            config.value = value
            if description:
                config.description = description
        else:
            import uuid
            config = SystemConfig(
                id=str(uuid.uuid4()),
                key=key,
                value=value,
                description=description,
            )
            self.db.add(config)

        await self.db.commit()
        await self.db.refresh(config)
        return config

    async def update_config(
        self, key: str, updates: dict[str, Any]
    ) -> dict[str, Any] | None:
        """部分更新配置"""
        current = await self.get_config(key)
        if current is None:
            current = {}
        current.update(updates)
        await self.set_config(key, current)
        return current

    # ========== 微信支付配置 ==========

    async def get_wechat_pay_config(self) -> dict[str, Any]:
        """获取微信支付配置"""
        config = await self.get_config(CONFIG_KEY_WECHAT_PAY)
        return config or {
            "enabled": False,
            "mch_id": "",
            "api_key": "",
            "api_v3_key": "",
            "serial_no": "",
            "private_key": "",
            "notify_url": "",
        }

    async def set_wechat_pay_config(self, config: dict[str, Any]) -> dict[str, Any]:
        """设置微信支付配置"""
        # 如果传入空字符串的敏感字段，保留原值
        current = await self.get_wechat_pay_config()
        sensitive_fields = ["api_key", "api_v3_key", "private_key"]
        for field in sensitive_fields:
            if field in config and config[field] == "":
                config[field] = current.get(field, "")

        await self.set_config(
            CONFIG_KEY_WECHAT_PAY, config, "微信支付配置"
        )
        return config

    async def get_wechat_pay_config_safe(self) -> dict[str, Any]:
        """获取微信支付配置（隐藏敏感信息）"""
        config = await self.get_wechat_pay_config()
        return {
            "enabled": config.get("enabled", False),
            "mch_id": config.get("mch_id", ""),
            "api_key_set": bool(config.get("api_key")),
            "api_v3_key_set": bool(config.get("api_v3_key")),
            "serial_no": config.get("serial_no", ""),
            "private_key_set": bool(config.get("private_key")),
            "notify_url": config.get("notify_url", ""),
        }

    # ========== 支付宝配置 ==========

    async def get_alipay_config(self) -> dict[str, Any]:
        """获取支付宝配置"""
        config = await self.get_config(CONFIG_KEY_ALIPAY)
        return config or {
            "enabled": False,
            "app_id": "",
            "private_key": "",
            "alipay_public_key": "",
            "notify_url": "",
            "return_url": "",
        }

    async def set_alipay_config(self, config: dict[str, Any]) -> dict[str, Any]:
        """设置支付宝配置"""
        current = await self.get_alipay_config()
        sensitive_fields = ["private_key", "alipay_public_key"]
        for field in sensitive_fields:
            if field in config and config[field] == "":
                config[field] = current.get(field, "")

        await self.set_config(CONFIG_KEY_ALIPAY, config, "支付宝配置")
        return config

    async def get_alipay_config_safe(self) -> dict[str, Any]:
        """获取支付宝配置（隐藏敏感信息）"""
        config = await self.get_alipay_config()
        return {
            "enabled": config.get("enabled", False),
            "app_id": config.get("app_id", ""),
            "private_key_set": bool(config.get("private_key")),
            "alipay_public_key_set": bool(config.get("alipay_public_key")),
            "notify_url": config.get("notify_url", ""),
            "return_url": config.get("return_url", ""),
        }

    # ========== 微信登录配置 ==========

    async def get_wechat_login_config(self) -> dict[str, Any]:
        """获取微信登录配置"""
        config = await self.get_config(CONFIG_KEY_WECHAT_LOGIN)
        return config or {
            "enabled": False,
            "app_id": "",
            "app_secret": "",
            "redirect_uri": "",
            "mp_enabled": False,
            "mp_app_id": "",
            "mp_app_secret": "",
        }

    async def set_wechat_login_config(self, config: dict[str, Any]) -> dict[str, Any]:
        """设置微信登录配置"""
        current = await self.get_wechat_login_config()
        sensitive_fields = ["app_secret", "mp_app_secret"]
        for field in sensitive_fields:
            if field in config and config[field] == "":
                config[field] = current.get(field, "")

        await self.set_config(
            CONFIG_KEY_WECHAT_LOGIN, config, "微信登录配置"
        )
        return config

    async def get_wechat_login_config_safe(self) -> dict[str, Any]:
        """获取微信登录配置（隐藏敏感信息）"""
        config = await self.get_wechat_login_config()
        return {
            "enabled": config.get("enabled", False),
            "app_id": config.get("app_id", ""),
            "app_secret_set": bool(config.get("app_secret")),
            "redirect_uri": config.get("redirect_uri", ""),
            "mp_enabled": config.get("mp_enabled", False),
            "mp_app_id": config.get("mp_app_id", ""),
            "mp_app_secret_set": bool(config.get("mp_app_secret")),
        }

    # ========== 支付可用性检查 ==========

    async def is_wechat_pay_enabled(self) -> bool:
        """检查微信支付是否可用"""
        config = await self.get_wechat_pay_config()
        return (
            config.get("enabled", False)
            and config.get("mch_id")
            and config.get("api_v3_key")
            and config.get("private_key")
        )

    async def is_alipay_enabled(self) -> bool:
        """检查支付宝是否可用"""
        config = await self.get_alipay_config()
        return (
            config.get("enabled", False)
            and config.get("app_id")
            and config.get("private_key")
            and config.get("alipay_public_key")
        )

    async def is_wechat_login_enabled(self) -> bool:
        """检查微信登录是否可用"""
        config = await self.get_wechat_login_config()
        return (
            config.get("enabled", False)
            and config.get("app_id")
            and config.get("app_secret")
        )

    async def get_available_payment_methods(self) -> list[str]:
        """获取可用的支付方式"""
        methods = []
        if await self.is_wechat_pay_enabled():
            methods.append("wechat")
        if await self.is_alipay_enabled():
            methods.append("alipay")
        return methods

    # ========== 积分消耗配置 ==========

    async def get_points_consumption_config(self) -> dict[str, Any]:
        """获取积分消耗配置"""
        config = await self.get_config(CONFIG_KEY_POINTS_CONSUMPTION)
        if config:
            # 合并默认配置，确保所有字段都存在
            merged = DEFAULT_POINTS_CONSUMPTION_CONFIG.copy()
            merged.update(config)
            return merged
        return DEFAULT_POINTS_CONSUMPTION_CONFIG.copy()

    async def set_points_consumption_config(
        self, config: dict[str, Any]
    ) -> dict[str, Any]:
        """设置积分消耗配置"""
        # 合并现有配置
        current = await self.get_points_consumption_config()
        current.update(config)
        await self.set_config(
            CONFIG_KEY_POINTS_CONSUMPTION, current, "积分消耗配置"
        )
        return current

    async def get_session_points_cost(
        self,
        session_type: str,
        scenario_type: str,
        membership_level: str,
    ) -> int:
        """计算会话积分消耗
        
        Args:
            session_type: "text" 或 "voice"
            scenario_type: "basic", "advanced", "custom"
            membership_level: "free", "pro", "enterprise"
            
        Returns:
            实际消耗积分数
        """
        config = await self.get_points_consumption_config()
        
        # 基础消耗
        if session_type == "voice":
            base_points = config.get("points_per_voice_session", 20)
        else:
            base_points = config.get("points_per_text_session", 10)
        
        # 场景倍率
        multipliers = config.get("scenario_multipliers", {})
        multiplier = multipliers.get(scenario_type, 1.0)
        
        # VIP折扣
        discount_rates = config.get("vip_discount_rates", {})
        discount_rate = discount_rates.get(membership_level, 0)
        
        # 计算最终消耗
        points = int(base_points * multiplier * (100 - discount_rate) / 100)
        return max(0, points)

    async def get_daily_free_sessions(self, membership_level: str) -> int:
        """获取每日免费会话次数
        
        Args:
            membership_level: "free", "pro", "enterprise"
            
        Returns:
            免费次数，-1表示无限
        """
        config = await self.get_points_consumption_config()
        free_sessions = config.get("free_sessions_by_level", {})
        return free_sessions.get(membership_level, 3)
