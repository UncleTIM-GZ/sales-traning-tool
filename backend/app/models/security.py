"""
开发：Excellent（11964948@qq.com）
功能：安全相关模型
作用：登录历史、两步验证、账号绑定等安全功能
创建时间：2024-12-23
最后修改：2024-12-23
"""

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class LoginHistory(Base):
    """登录历史记录表"""

    __tablename__ = "login_history"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    
    # 登录信息
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)  # IPv6 max length
    device_type: Mapped[str | None] = mapped_column(String(50), nullable=True)  # mobile/desktop/tablet
    device_name: Mapped[str | None] = mapped_column(String(100), nullable=True)  # 设备名称
    browser: Mapped[str | None] = mapped_column(String(100), nullable=True)  # 浏览器
    os: Mapped[str | None] = mapped_column(String(100), nullable=True)  # 操作系统
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)  # 地理位置
    
    # 登录状态
    login_type: Mapped[str] = mapped_column(
        Enum("password", "sms", "wechat", "enterprise_wechat", name="login_type_enum", create_type=False),
        default="password",
        nullable=False,
    )
    is_success: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    fail_reason: Mapped[str | None] = mapped_column(String(200), nullable=True)
    
    # 关系
    user: Mapped["User"] = relationship("User")


class TwoFactorAuth(Base):
    """两步验证配置表"""

    __tablename__ = "two_factor_auth"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    
    # 两步验证状态
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    method: Mapped[str] = mapped_column(
        Enum("sms", "email", "totp", name="two_factor_method_enum", create_type=False),
        default="sms",
        nullable=False,
    )
    
    # TOTP 密钥 (如果使用 Google Authenticator 等)
    totp_secret: Mapped[str | None] = mapped_column(String(100), nullable=True)
    
    # 备用验证码 (JSON数组存储)
    backup_codes: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON格式
    
    # 关系
    user: Mapped["User"] = relationship("User")


class AccountBinding(Base):
    """账号绑定表"""

    __tablename__ = "account_bindings"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    
    # 绑定类型和状态
    binding_type: Mapped[str] = mapped_column(
        Enum("wechat", "enterprise_wechat", "email", name="binding_type_enum", create_type=False),
        nullable=False,
    )
    
    # 绑定账号信息
    external_id: Mapped[str | None] = mapped_column(String(200), nullable=True)  # 第三方平台ID
    external_name: Mapped[str | None] = mapped_column(String(100), nullable=True)  # 第三方平台昵称/邮箱
    external_avatar: Mapped[str | None] = mapped_column(String(500), nullable=True)
    
    # 绑定状态
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # 关系
    user: Mapped["User"] = relationship("User")
