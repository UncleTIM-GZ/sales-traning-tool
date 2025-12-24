"""
开发：Excellent（11964948@qq.com）
功能：安全设置 API
作用：登录历史、两步验证、账号绑定、注销账号
创建时间：2024-12-23
最后修改：2024-12-23
"""

import json
import secrets
import uuid
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, delete, desc, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.security import verify_password
from app.models import User, LoginHistory, TwoFactorAuth, AccountBinding


router = APIRouter()


# ===== Schemas =====

class LoginHistoryItem(BaseModel):
    id: str
    ip_address: Optional[str]
    device_type: Optional[str]
    device_name: Optional[str]
    browser: Optional[str]
    os: Optional[str]
    location: Optional[str]
    login_type: str
    is_success: bool
    created_at: str

    class Config:
        from_attributes = True


class LoginHistoryResponse(BaseModel):
    items: List[LoginHistoryItem]
    total: int


class TwoFactorStatusResponse(BaseModel):
    is_enabled: bool
    method: Optional[str]
    phone: Optional[str]  # 脱敏后的手机号


class EnableTwoFactorRequest(BaseModel):
    method: str = "sms"  # sms, email, totp
    verification_code: str  # 验证码确认


class DisableTwoFactorRequest(BaseModel):
    password: str  # 需要密码确认


class BindingItem(BaseModel):
    id: str
    binding_type: str
    external_name: Optional[str]
    is_verified: bool
    created_at: str

    class Config:
        from_attributes = True


class BindingsResponse(BaseModel):
    bindings: List[BindingItem]


class BindEmailRequest(BaseModel):
    email: EmailStr
    verification_code: str


class UnbindRequest(BaseModel):
    binding_type: str
    password: str  # 需要密码确认


class DeleteAccountRequest(BaseModel):
    password: str
    confirmation: str  # 必须输入 "确认注销"


# ===== 登录历史 =====

@router.get("/login-history", response_model=LoginHistoryResponse)
async def get_login_history(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取登录历史记录"""
    query = (
        select(LoginHistory)
        .where(LoginHistory.user_id == current_user.id)
        .order_by(desc(LoginHistory.created_at))
        .limit(limit)
    )
    result = await db.execute(query)
    items = result.scalars().all()
    
    # 获取总数
    count_query = (
        select(LoginHistory)
        .where(LoginHistory.user_id == current_user.id)
    )
    count_result = await db.execute(count_query)
    total = len(count_result.scalars().all())
    
    return LoginHistoryResponse(
        items=[
            LoginHistoryItem(
                id=item.id,
                ip_address=item.ip_address,
                device_type=item.device_type,
                device_name=item.device_name,
                browser=item.browser,
                os=item.os,
                location=item.location,
                login_type=item.login_type,
                is_success=item.is_success,
                created_at=item.created_at.isoformat() if item.created_at else "",
            )
            for item in items
        ],
        total=total,
    )


async def record_login(
    db: AsyncSession,
    user_id: str,
    request: Request,
    login_type: str = "password",
    is_success: bool = True,
    fail_reason: str | None = None,
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
        location=None,  # 可以后续集成 IP 地理位置服务
        login_type=login_type,
        is_success=is_success,
        fail_reason=fail_reason,
    )
    db.add(history)
    await db.commit()


# ===== 两步验证 =====

@router.get("/two-factor", response_model=TwoFactorStatusResponse)
async def get_two_factor_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取两步验证状态"""
    result = await db.execute(
        select(TwoFactorAuth).where(TwoFactorAuth.user_id == current_user.id)
    )
    tfa = result.scalar_one_or_none()
    
    phone_masked = None
    if current_user.phone:
        phone_masked = current_user.phone[:3] + "****" + current_user.phone[-4:]
    
    if tfa:
        return TwoFactorStatusResponse(
            is_enabled=tfa.is_enabled,
            method=tfa.method if tfa.is_enabled else None,
            phone=phone_masked,
        )
    
    return TwoFactorStatusResponse(
        is_enabled=False,
        method=None,
        phone=phone_masked,
    )


@router.post("/two-factor/enable")
async def enable_two_factor(
    data: EnableTwoFactorRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """开启两步验证"""
    if data.method not in ["sms", "email", "totp"]:
        raise HTTPException(status_code=400, detail="无效的验证方式")
    
    # 验证码校验（实际应该调用短信服务验证）
    # 这里简化处理，生产环境需要真正验证
    if len(data.verification_code) != 6:
        raise HTTPException(status_code=400, detail="验证码格式错误")
    
    result = await db.execute(
        select(TwoFactorAuth).where(TwoFactorAuth.user_id == current_user.id)
    )
    tfa = result.scalar_one_or_none()
    
    # 生成备用验证码
    backup_codes = [secrets.token_hex(4).upper() for _ in range(8)]
    
    if tfa:
        tfa.is_enabled = True
        tfa.method = data.method
        tfa.backup_codes = json.dumps(backup_codes)
    else:
        tfa = TwoFactorAuth(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            is_enabled=True,
            method=data.method,
            backup_codes=json.dumps(backup_codes),
        )
        db.add(tfa)
    
    await db.commit()
    
    return {
        "message": "两步验证已开启",
        "backup_codes": backup_codes,  # 只在开启时返回一次
    }


@router.post("/two-factor/disable")
async def disable_two_factor(
    data: DisableTwoFactorRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """关闭两步验证"""
    # 验证密码
    if not verify_password(data.password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="密码错误")
    
    result = await db.execute(
        select(TwoFactorAuth).where(TwoFactorAuth.user_id == current_user.id)
    )
    tfa = result.scalar_one_or_none()
    
    if tfa:
        tfa.is_enabled = False
        await db.commit()
    
    return {"message": "两步验证已关闭"}


# ===== 账号绑定 =====

@router.get("/bindings", response_model=BindingsResponse)
async def get_bindings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取账号绑定列表"""
    result = await db.execute(
        select(AccountBinding).where(AccountBinding.user_id == current_user.id)
    )
    bindings = result.scalars().all()
    
    return BindingsResponse(
        bindings=[
            BindingItem(
                id=b.id,
                binding_type=b.binding_type,
                external_name=b.external_name,
                is_verified=b.is_verified,
                created_at=b.created_at.isoformat() if b.created_at else "",
            )
            for b in bindings
        ]
    )


@router.post("/bindings/email")
async def bind_email(
    data: BindEmailRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """绑定邮箱"""
    # 检查是否已绑定
    result = await db.execute(
        select(AccountBinding).where(
            and_(
                AccountBinding.user_id == current_user.id,
                AccountBinding.binding_type == "email",
            )
        )
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(status_code=400, detail="已绑定邮箱")
    
    # 验证码校验（简化处理）
    if len(data.verification_code) != 6:
        raise HTTPException(status_code=400, detail="验证码格式错误")
    
    binding = AccountBinding(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        binding_type="email",
        external_id=data.email,
        external_name=data.email,
        is_verified=True,
    )
    db.add(binding)
    await db.commit()
    
    return {"message": "邮箱绑定成功"}


@router.post("/bindings/wechat")
async def bind_wechat(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """绑定微信 - 返回授权URL"""
    # 检查是否已绑定
    result = await db.execute(
        select(AccountBinding).where(
            and_(
                AccountBinding.user_id == current_user.id,
                AccountBinding.binding_type == "wechat",
            )
        )
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(status_code=400, detail="已绑定微信")
    
    # 生成授权URL（实际需要微信开放平台配置）
    # 这里返回模拟数据
    return {
        "message": "请使用微信扫描二维码完成绑定",
        "auth_url": "https://open.weixin.qq.com/connect/oauth2/authorize?...",
        "qrcode_url": None,  # 二维码URL
    }


@router.post("/bindings/wechat/callback")
async def wechat_callback(
    code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """微信绑定回调"""
    # 使用code获取access_token，然后获取用户信息
    # 这里是模拟实现
    binding = AccountBinding(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        binding_type="wechat",
        external_id="wx_" + secrets.token_hex(8),
        external_name="微信用户",
        is_verified=True,
    )
    db.add(binding)
    await db.commit()
    
    return {"message": "微信绑定成功"}


@router.delete("/bindings/{binding_type}")
async def unbind_account(
    binding_type: str,
    data: UnbindRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """解绑账号"""
    if binding_type not in ["wechat", "enterprise_wechat", "email"]:
        raise HTTPException(status_code=400, detail="无效的绑定类型")
    
    # 验证密码
    if not verify_password(data.password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="密码错误")
    
    result = await db.execute(
        select(AccountBinding).where(
            and_(
                AccountBinding.user_id == current_user.id,
                AccountBinding.binding_type == binding_type,
            )
        )
    )
    binding = result.scalar_one_or_none()
    
    if not binding:
        raise HTTPException(status_code=404, detail="未找到该绑定")
    
    await db.delete(binding)
    await db.commit()
    
    return {"message": "解绑成功"}


# ===== 注销账号 =====

@router.post("/delete-account")
async def delete_account(
    data: DeleteAccountRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """注销账号"""
    # 验证密码
    if not verify_password(data.password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="密码错误")
    
    # 验证确认文字
    if data.confirmation != "确认注销":
        raise HTTPException(status_code=400, detail="请输入'确认注销'以确认操作")
    
    # 标记账户为非活跃（软删除）
    current_user.is_active = False
    current_user.phone = f"deleted_{current_user.id[:8]}_{current_user.phone}"
    await db.commit()
    
    return {"message": "账号已注销"}
