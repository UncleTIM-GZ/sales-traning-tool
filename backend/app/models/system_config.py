"""系统配置模型"""

from typing import Any

from sqlalchemy import String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SystemConfig(Base):
    """系统配置表 - 存储系统级配置项
    
    常用配置键:
    - sms_config: 短信配置 {enabled, access_key_id, access_key_secret, sign_name, template_code}
    - login_config: 登录配置 {sms_login_enabled, password_login_enabled}
    - site_config: 站点配置 {site_name, logo_url, maintenance_mode}
    """

    __tablename__ = "system_configs"

    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    value: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
