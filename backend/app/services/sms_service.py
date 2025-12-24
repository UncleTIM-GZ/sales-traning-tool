"""阿里云短信服务

集成阿里云短信 SDK，支持发送验证码短信。

文档: https://help.aliyun.com/document_detail/419273.html
SDK: alibabacloud-dysmsapi20170525

使用前需要:
1. 在阿里云控制台开通短信服务
2. 创建签名和模板
3. 获取 AccessKey ID 和 AccessKey Secret
"""

import random
import string
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SystemConfig, VerificationCode


class SmsService:
    """短信服务"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._config: dict[str, Any] | None = None
        self._client = None

    async def _get_config(self) -> dict[str, Any] | None:
        """获取短信配置"""
        if self._config is not None:
            return self._config

        result = await self.db.execute(
            select(SystemConfig).where(SystemConfig.key == "sms_config")
        )
        config = result.scalar_one_or_none()
        self._config = config.value if config else None
        return self._config

    async def is_enabled(self) -> bool:
        """检查短信服务是否启用"""
        config = await self._get_config()
        return bool(config and config.get("enabled"))

    async def _get_client(self):
        """获取阿里云短信客户端"""
        if self._client is not None:
            return self._client

        config = await self._get_config()
        if not config or not config.get("enabled"):
            raise ValueError("短信服务未启用或未配置")

        try:
            from alibabacloud_dysmsapi20170525 import Client
            from alibabacloud_dysmsapi20170525.models import SendSmsRequest
            from alibabacloud_tea_openapi.models import Config

            aliyun_config = Config(
                access_key_id=config.get("access_key_id"),
                access_key_secret=config.get("access_key_secret"),
                endpoint="dysmsapi.aliyuncs.com",
            )
            self._client = Client(aliyun_config)
            return self._client
        except ImportError:
            raise ImportError(
                "请安装阿里云短信SDK: pip install alibabacloud_dysmsapi20170525"
            )

    def generate_code(self, length: int = 6) -> str:
        """生成验证码"""
        return "".join(random.choices(string.digits, k=length))

    async def send_verification_code(
        self,
        phone: str,
        purpose: str = "login",
        code_length: int = 6,
        expire_minutes: int = 5,
    ) -> dict[str, Any]:
        """发送验证码

        Args:
            phone: 手机号
            purpose: 用途 (login/register/reset_password)
            code_length: 验证码长度
            expire_minutes: 过期时间（分钟）

        Returns:
            {success: bool, message: str, code?: str (仅开发模式)}
        """
        config = await self._get_config()
        if not config or not config.get("enabled"):
            # 开发模式：返回模拟验证码
            code = self.generate_code(code_length)
            expires_at = datetime.now() + timedelta(minutes=expire_minutes)

            # 保存验证码到数据库
            verification = VerificationCode(
                phone=phone,
                code=code,
                purpose=purpose,
                is_used=False,
                expires_at=expires_at.isoformat(),
            )
            self.db.add(verification)
            await self.db.commit()

            return {
                "success": True,
                "message": "验证码已发送（开发模式）",
                "code": code,  # 开发模式返回验证码
            }

        try:
            client = await self._get_client()
            code = self.generate_code(code_length)
            expires_at = datetime.now() + timedelta(minutes=expire_minutes)

            # 发送短信
            from alibabacloud_dysmsapi20170525.models import SendSmsRequest
            import json

            request = SendSmsRequest(
                phone_numbers=phone,
                sign_name=config.get("sign_name"),
                template_code=config.get("template_code"),
                template_param=json.dumps({"code": code}),
            )

            response = client.send_sms(request)

            if response.body.code == "OK":
                # 保存验证码到数据库
                verification = VerificationCode(
                    phone=phone,
                    code=code,
                    purpose=purpose,
                    is_used=False,
                    expires_at=expires_at.isoformat(),
                )
                self.db.add(verification)
                await self.db.commit()

                return {"success": True, "message": "验证码已发送"}
            else:
                return {
                    "success": False,
                    "message": f"发送失败: {response.body.message}",
                }

        except Exception as e:
            return {"success": False, "message": f"发送异常: {str(e)}"}

    async def verify_code(
        self,
        phone: str,
        code: str,
        purpose: str = "login",
    ) -> dict[str, Any]:
        """验证验证码

        Args:
            phone: 手机号
            code: 验证码
            purpose: 用途

        Returns:
            {success: bool, message: str}
        """
        result = await self.db.execute(
            select(VerificationCode)
            .where(
                VerificationCode.phone == phone,
                VerificationCode.code == code,
                VerificationCode.purpose == purpose,
                VerificationCode.is_used == False,
            )
            .order_by(VerificationCode.created_at.desc())
            .limit(1)
        )
        verification = result.scalar_one_or_none()

        if not verification:
            return {"success": False, "message": "验证码错误或已失效"}

        # 检查是否过期
        expires_at = datetime.fromisoformat(verification.expires_at)
        if datetime.now() > expires_at:
            return {"success": False, "message": "验证码已过期"}

        # 标记为已使用
        verification.is_used = True
        await self.db.commit()

        return {"success": True, "message": "验证成功"}

    async def check_rate_limit(
        self,
        phone: str,
        purpose: str = "login",
        max_per_minute: int = 1,
        max_per_hour: int = 5,
    ) -> dict[str, Any]:
        """检查发送频率限制

        Returns:
            {allowed: bool, message?: str, wait_seconds?: int}
        """
        from sqlalchemy import func

        now = datetime.now()
        one_minute_ago = now - timedelta(minutes=1)
        one_hour_ago = now - timedelta(hours=1)

        # 检查每分钟限制
        result = await self.db.execute(
            select(func.count(VerificationCode.id)).where(
                VerificationCode.phone == phone,
                VerificationCode.purpose == purpose,
                VerificationCode.created_at >= one_minute_ago,
            )
        )
        count_minute = result.scalar() or 0

        if count_minute >= max_per_minute:
            return {
                "allowed": False,
                "message": "发送过于频繁，请稍后再试",
                "wait_seconds": 60,
            }

        # 检查每小时限制
        result = await self.db.execute(
            select(func.count(VerificationCode.id)).where(
                VerificationCode.phone == phone,
                VerificationCode.purpose == purpose,
                VerificationCode.created_at >= one_hour_ago,
            )
        )
        count_hour = result.scalar() or 0

        if count_hour >= max_per_hour:
            return {
                "allowed": False,
                "message": "今日发送次数已达上限",
                "wait_seconds": 3600,
            }

        return {"allowed": True}


async def get_sms_service(db: AsyncSession) -> SmsService:
    """获取短信服务实例"""
    return SmsService(db)
