"""
开发：Excellent（11964948@qq.com）
功能：用户服务层
作用：用户注册、登录、验证码等业务逻辑
创建时间：2024-12-23
最后修改：2024-12-24
"""

import random
import string
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash, verify_password, create_access_token
from app.core.exceptions import BadRequestException, NotFoundException, UnauthorizedException
from app.models.user import User, Profile, VerificationCode
from app.models.security import LoginHistory
from app.schemas.user import UserCreate, UserResponse, TokenWithUser


class UserService:
    """用户服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_user_by_id(self, user_id: str) -> User | None:
        """根据ID获取用户"""
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_user_by_phone(self, phone: str) -> User | None:
        """根据手机号获取用户"""
        result = await self.db.execute(select(User).where(User.phone == phone))
        return result.scalar_one_or_none()

    async def create_user(self, user_in: UserCreate) -> User:
        """创建用户"""
        # 检查手机号是否已存在
        existing_user = await self.get_user_by_phone(user_in.phone)
        if existing_user:
            raise BadRequestException("该手机号已注册")

        # 创建用户
        user = User(
            phone=user_in.phone,
            hashed_password=get_password_hash(user_in.password),
            nickname=user_in.nickname,
            track=user_in.track,
        )
        self.db.add(user)
        await self.db.flush()

        # 创建用户画像
        profile = Profile(user_id=user.id)
        self.db.add(profile)

        return user

    async def authenticate(self, phone: str, password: str) -> User:
        """验证用户登录"""
        user = await self.get_user_by_phone(phone)
        if not user:
            raise UnauthorizedException("手机号或密码错误")

        if not verify_password(password, user.hashed_password):
            raise UnauthorizedException("手机号或密码错误")

        if not user.is_active:
            raise UnauthorizedException("账户已被禁用")

        return user

    async def register(self, user_in: UserCreate) -> TokenWithUser:
        """用户注册"""
        user = await self.create_user(user_in)

        # 生成token
        access_token = create_access_token(subject=user.id)

        return TokenWithUser(
            access_token=access_token,
            token_type="bearer",
            user=UserResponse.model_validate(user),
        )

    async def login(self, phone: str, password: str, request: Optional[Request] = None) -> TokenWithUser:
        """用户密码登录"""
        user = await self.authenticate(phone, password)

        # 记录登录历史
        if request:
            await self._record_login(user.id, request, "password", True)

        # 生成token
        access_token = create_access_token(subject=user.id)

        return TokenWithUser(
            access_token=access_token,
            token_type="bearer",
            user=UserResponse.model_validate(user),
        )

    async def login_with_sms(self, phone: str, code: str, request: Optional[Request] = None) -> TokenWithUser:
        """短信验证码登录"""
        # 验证验证码
        await self.verify_code(phone, code, "login")

        # 查找或创建用户
        user = await self.get_user_by_phone(phone)
        if not user:
            # 短信登录时自动注册
            user = User(
                phone=phone,
                hashed_password=get_password_hash(""),  # 空密码，必须短信登录
                nickname=f"用户{phone[-4:]}",
                track="sales",
            )
            self.db.add(user)
            await self.db.flush()

            # 创建用户画像
            profile = Profile(user_id=user.id)
            self.db.add(profile)
            await self.db.flush()

        if not user.is_active:
            raise UnauthorizedException("账户已被禁用")

        # 记录登录历史
        if request:
            await self._record_login(user.id, request, "sms", True)

        # 生成token
        access_token = create_access_token(subject=user.id)

        return TokenWithUser(
            access_token=access_token,
            token_type="bearer",
            user=UserResponse.model_validate(user),
        )

    async def _record_login(
        self,
        user_id: str,
        request: Request,
        login_type: str = "password",
        is_success: bool = True,
        fail_reason: Optional[str] = None,
    ):
        """记录登录历史"""
        # 解析 User-Agent
        user_agent = request.headers.get("user-agent", "")
        device_type = "desktop"
        if "Mobile" in user_agent:
            device_type = "mobile"
        elif "Tablet" in user_agent:
            device_type = "tablet"
        
        browser = None
        if "Chrome" in user_agent:
            browser = "Chrome"
        elif "Firefox" in user_agent:
            browser = "Firefox"
        elif "Safari" in user_agent:
            browser = "Safari"
        elif "Edge" in user_agent:
            browser = "Edge"
        
        os_name = None
        if "Windows" in user_agent:
            os_name = "Windows"
        elif "Mac" in user_agent:
            os_name = "macOS"
        elif "Linux" in user_agent:
            os_name = "Linux"
        elif "Android" in user_agent:
            os_name = "Android"
        elif "iOS" in user_agent or "iPhone" in user_agent:
            os_name = "iOS"
        
        # 获取客户端 IP
        ip_address = request.client.host if request.client else None
        
        history = LoginHistory(
            id=str(uuid.uuid4()),
            user_id=user_id,
            ip_address=ip_address,
            device_type=device_type,
            device_name=f"{os_name or 'Unknown'} {browser or 'Browser'}",
            browser=browser,
            os=os_name,
            location=None,
            login_type=login_type,
            is_success=is_success,
            fail_reason=fail_reason,
        )
        self.db.add(history)

    async def get_current_user(self, user_id: str) -> UserResponse:
        """获取当前用户信息"""
        user = await self.get_user_by_id(user_id)
        if not user:
            raise NotFoundException("用户不存在")

        return UserResponse.model_validate(user)

    async def get_user_profile(self, user_id: str) -> Profile:
        """获取用户画像"""
        result = await self.db.execute(
            select(Profile).where(Profile.user_id == user_id)
        )
        profile = result.scalar_one_or_none()

        if not profile:
            # 如果没有画像，创建一个
            profile = Profile(user_id=user_id)
            self.db.add(profile)
            await self.db.flush()

        return profile

    async def update_user_profile(self, user_id: str, preferences: dict | None) -> Profile:
        """更新用户画像"""
        profile = await self.get_user_profile(user_id)

        if preferences is not None:
            profile.preferences = preferences

        return profile

    async def update_password(self, phone: str, new_password: str) -> bool:
        """更新用户密码"""
        user = await self.get_user_by_phone(phone)
        if not user:
            raise NotFoundException("用户不存在")

        user.hashed_password = get_password_hash(new_password)
        return True

    # ===== 验证码相关 =====

    @staticmethod
    def generate_code(length: int = 6) -> str:
        """生成数字验证码"""
        return "".join(random.choices(string.digits, k=length))

    async def send_verification_code(self, phone: str, purpose: str) -> str:
        """发送验证码（返回验证码，实际应该通过短信发送）"""
        # 检查是否有未过期的验证码
        now = datetime.now(timezone.utc)
        result = await self.db.execute(
            select(VerificationCode)
            .where(
                VerificationCode.phone == phone,
                VerificationCode.purpose == purpose,
                VerificationCode.is_used == False,
            )
            .order_by(VerificationCode.created_at.desc())
        )
        existing = result.scalar_one_or_none()

        if existing:
            expires_at = datetime.fromisoformat(existing.expires_at.replace("Z", "+00:00"))
            # 如果距离上次发送不到60秒，拒绝发送
            time_since_created = now - existing.created_at.replace(tzinfo=timezone.utc)
            if time_since_created.total_seconds() < 60:
                raise BadRequestException("请等待60秒后再发送验证码")

        # 生成新验证码
        code = self.generate_code()
        expires_at = (now + timedelta(minutes=10)).isoformat()

        verification = VerificationCode(
            phone=phone,
            code=code,
            purpose=purpose,
            expires_at=expires_at,
        )
        self.db.add(verification)

        # TODO: 实际应该调用短信服务发送验证码
        # await sms_service.send(phone, f"您的验证码是：{code}，10分钟内有效")

        return code  # 开发环境返回验证码，生产环境不应返回

    async def verify_code(self, phone: str, code: str, purpose: str) -> bool:
        """验证验证码"""
        now = datetime.now(timezone.utc)

        result = await self.db.execute(
            select(VerificationCode)
            .where(
                VerificationCode.phone == phone,
                VerificationCode.code == code,
                VerificationCode.purpose == purpose,
                VerificationCode.is_used == False,
            )
            .order_by(VerificationCode.created_at.desc())
        )
        verification = result.scalar_one_or_none()

        if not verification:
            raise BadRequestException("验证码错误")

        # 检查是否过期
        expires_at = datetime.fromisoformat(verification.expires_at.replace("Z", "+00:00"))
        if now > expires_at:
            raise BadRequestException("验证码已过期")

        # 标记为已使用
        verification.is_used = True

        return True

    async def reset_password(self, phone: str, code: str, new_password: str) -> bool:
        """重置密码"""
        # 验证验证码
        await self.verify_code(phone, code, "reset_password")

        # 更新密码
        return await self.update_password(phone, new_password)
