"""
开发：Excellent（11964948@qq.com）
功能：认证路由
作用：用户注册、登录、登出、Token 管理
创建时间：2024-12-23
最后修改：2024-12-24
"""

from fastapi import APIRouter, status, Request, HTTPException
from pydantic import BaseModel

from app.api.deps import DatabaseSession, CurrentUserId
from app.schemas.user import (
    Token,
    TokenWithUser,
    UserCreate,
    UserLogin,
    UserResponse,
    SendCodeRequest,
    VerifyCodeRequest,
    ResetPasswordRequest,
)
from app.services.user_service import UserService
from app.core.rate_limiter import login_rate_limiter
from app.core.token_blacklist import token_blacklist
from app.core.security import get_token_jti, get_token_expiry

router = APIRouter()


class SmsLoginRequest(BaseModel):
    """短信登录请求"""
    phone: str
    code: str


@router.post("/register", response_model=TokenWithUser, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate, db: DatabaseSession):
    """
    用户注册

    - **phone**: 手机号（11位）
    - **password**: 密码（8-128位，需包含字母和数字）
    - **nickname**: 昵称（2-16字符）
    - **track**: 赛道（sales/social，默认sales）
    """
    service = UserService(db)
    return await service.register(user_in)


@router.post("/login", response_model=TokenWithUser)
async def login(user_in: UserLogin, request: Request, db: DatabaseSession):
    """
    用户密码登录

    - **phone**: 手机号
    - **password**: 密码
    
    安全限制：
    - 5次失败后锁定15分钟
    - 10次失败后锁定1小时
    - 20次失败后锁定24小时
    """
    # 获取客户端IP
    client_ip = request.client.host if request.client else None
    
    # 检查限流
    is_allowed, error_msg, remaining = await login_rate_limiter.check_rate_limit(
        user_in.phone, client_ip
    )
    if not is_allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=error_msg,
            headers={"Retry-After": str(remaining)} if remaining else None,
        )
    
    service = UserService(db)
    try:
        result = await service.login(user_in.phone, user_in.password, request)
        # 登录成功，重置限流计数
        await login_rate_limiter.record_success(user_in.phone, client_ip)
        return result
    except Exception as e:
        # 登录失败，记录失败次数
        failure_count, lockout_seconds = await login_rate_limiter.record_failure(
            user_in.phone, client_ip
        )
        remaining_attempts = await login_rate_limiter.get_remaining_attempts(user_in.phone)
        
        # 添加剩余尝试次数提示
        error_detail = str(e)
        if remaining_attempts > 0:
            error_detail = f"{error_detail}（剩余{remaining_attempts}次尝试机会）"
        elif lockout_seconds:
            minutes = lockout_seconds // 60
            error_detail = f"账户已被锁定，请{minutes}分钟后重试"
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_detail,
        )


@router.post("/login/sms", response_model=TokenWithUser)
async def login_with_sms(request_data: SmsLoginRequest, request: Request, db: DatabaseSession):
    """
    短信验证码登录

    - **phone**: 手机号
    - **code**: 6位验证码
    """
    service = UserService(db)
    return await service.login_with_sms(request_data.phone, request_data.code, request)


@router.get("/me", response_model=UserResponse)
async def get_current_user(user_id: CurrentUserId, db: DatabaseSession):
    """获取当前登录用户信息"""
    service = UserService(db)
    return await service.get_current_user(user_id)


@router.post("/send-code")
async def send_verification_code(request: SendCodeRequest, db: DatabaseSession):
    """
    发送验证码

    - **phone**: 手机号
    - **purpose**: 用途（register/reset_password/login）
    """
    service = UserService(db)
    code = await service.send_verification_code(request.phone, request.purpose)

    # 开发环境返回验证码，生产环境只返回成功状态
    return {
        "message": "验证码已发送",
        "code": code,  # TODO: 生产环境删除此行
    }


@router.post("/verify-code")
async def verify_code(request: VerifyCodeRequest, db: DatabaseSession):
    """
    验证验证码

    - **phone**: 手机号
    - **code**: 6位验证码
    """
    service = UserService(db)
    await service.verify_code(request.phone, request.code, "reset_password")
    return {"message": "验证成功", "verified": True}


@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest, db: DatabaseSession):
    """
    重置密码

    - **phone**: 手机号
    - **code**: 6位验证码
    - **new_password**: 新密码（8-128位，需包含字母和数字）
    """
    service = UserService(db)
    await service.reset_password(request.phone, request.code, request.new_password)
    return {"message": "密码重置成功"}


@router.post("/refresh", response_model=Token)
async def refresh_token(user_id: CurrentUserId, db: DatabaseSession):
    """刷新访问Token"""
    from app.core.security import create_access_token

    access_token = create_access_token(subject=user_id)
    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request):
    """
    用户登出
    
    将当前 Token 加入黑名单，使其立即失效
    """
    # 从请求头获取 Token
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]
        jti = get_token_jti(token)
        expiry = get_token_expiry(token)
        
        if jti and expiry:
            # 将 Token 加入黑名单
            await token_blacklist.add(
                token_jti=jti,
                user_id="",  # 登出时可能不需要用户ID
                expires_at=expiry,
                reason="logout",
            )
    
    return None
