"""
开发：Excellent（11964948@qq.com）
功能：微信登录 API
作用：实现微信扫码登录和公众号网页授权登录（配置从数据库读取）
创建时间：2024-12-24
最后修改：2025-12-24
"""

import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DatabaseSession
from app.config import settings
from app.core.security import create_access_token
from app.models.user import User, Profile
from app.models.security import AccountBinding
from app.schemas.user import TokenWithUser, UserResponse
from app.services.wechat_service import WechatService, get_wechat_service


router = APIRouter()


# ===== 请求/响应模型 =====

class WechatLoginUrlResponse(BaseModel):
    """微信登录 URL 响应"""
    authorize_url: str
    state: str


class WechatCallbackRequest(BaseModel):
    """微信回调请求"""
    code: str
    state: str


class WechatBindRequest(BaseModel):
    """微信绑定请求"""
    code: str
    state: str


# ===== 状态存储 (生产环境应使用 Redis) =====
# 存储 state -> 用途 的映射，防止 CSRF
_state_store: dict[str, dict] = {}


def _save_state(state: str, data: dict, ttl: int = 300):
    """保存 state（生产环境应使用 Redis）"""
    import time
    _state_store[state] = {
        "data": data,
        "expires_at": time.time() + ttl,
    }


def _get_state(state: str) -> Optional[dict]:
    """获取并删除 state"""
    import time
    if state not in _state_store:
        return None
    
    record = _state_store.pop(state)
    if record["expires_at"] < time.time():
        return None
    
    return record["data"]


# ===== API 端点 =====

@router.get("/login-url", response_model=WechatLoginUrlResponse)
async def get_wechat_login_url(
    redirect_url: Optional[str] = Query(None, description="登录成功后的跳转地址"),
    use_mp: bool = Query(False, description="是否使用公众号授权（微信内使用）"),
    db: DatabaseSession = None,
):
    """
    获取微信登录授权 URL
    
    - **redirect_url**: 登录成功后前端跳转地址
    - **use_mp**: 是否使用公众号授权（在微信浏览器内使用）
    
    返回授权 URL，前端跳转到该 URL 进行微信授权
    """
    wechat_service = get_wechat_service(db)
    state = wechat_service.generate_state()
    
    # 保存 state 和相关数据
    _save_state(state, {
        "purpose": "login",
        "redirect_url": redirect_url or "/dashboard",
        "use_mp": use_mp,
    })
    
    authorize_url = await wechat_service.get_authorize_url(
        state=state,
        use_mp=use_mp,
    )
    
    return WechatLoginUrlResponse(
        authorize_url=authorize_url,
        state=state,
    )


@router.get("/callback")
async def wechat_callback(
    code: str = Query(..., description="微信授权码"),
    state: str = Query(..., description="防 CSRF 状态码"),
    db: DatabaseSession = None,
):
    """
    微信授权回调
    
    微信授权成功后会重定向到此接口，携带 code 和 state 参数
    """
    # 验证 state
    state_data = _get_state(state)
    if not state_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的授权请求，请重新登录",
        )
    
    purpose = state_data.get("purpose")
    redirect_url = state_data.get("redirect_url", "/dashboard")
    use_mp = state_data.get("use_mp", False)
    
    wechat_service = get_wechat_service(db)
    
    try:
        # 获取访问令牌
        token_info = await wechat_service.get_access_token(code, use_mp=use_mp)
        
        # 获取用户信息
        user_info = await wechat_service.get_user_info(
            token_info.access_token,
            token_info.openid,
        )
        
        # 根据用途处理
        if purpose == "login":
            # 查找已绑定的用户
            result = await db.execute(
                select(AccountBinding).where(
                    and_(
                        AccountBinding.binding_type == "wechat",
                        AccountBinding.external_id == user_info.openid,
                    )
                )
            )
            binding = result.scalar_one_or_none()
            
            if binding:
                # 已绑定，直接登录
                user_result = await db.execute(
                    select(User).where(User.id == binding.user_id)
                )
                user = user_result.scalar_one_or_none()
                
                if not user or not user.is_active:
                    # 重定向到前端错误页
                    return RedirectResponse(
                        url=f"{redirect_url}?error=account_disabled",
                        status_code=status.HTTP_302_FOUND,
                    )
                
                # 生成 JWT Token
                access_token = create_access_token(subject=user.id)
                
                # 重定向到前端，携带 token
                return RedirectResponse(
                    url=f"{redirect_url}?token={access_token}&wechat_login=1",
                    status_code=status.HTTP_302_FOUND,
                )
            else:
                # 未绑定，自动注册新用户
                new_user = User(
                    phone=f"wx_{user_info.openid[:8]}",  # 临时手机号
                    hashed_password="",  # 空密码，只能微信登录
                    nickname=user_info.nickname or f"微信用户{user_info.openid[-4:]}",
                    avatar=user_info.headimgurl,
                    track="sales",
                )
                db.add(new_user)
                await db.flush()
                
                # 创建用户画像
                profile = Profile(user_id=new_user.id)
                db.add(profile)
                
                # 创建绑定记录
                new_binding = AccountBinding(
                    id=str(uuid.uuid4()),
                    user_id=new_user.id,
                    binding_type="wechat",
                    external_id=user_info.openid,
                    external_name=user_info.nickname,
                    external_avatar=user_info.headimgurl,
                    is_verified=True,
                )
                db.add(new_binding)
                await db.commit()
                
                # 生成 JWT Token
                access_token = create_access_token(subject=new_user.id)
                
                # 重定向到前端，携带 token 和新用户标记
                return RedirectResponse(
                    url=f"{redirect_url}?token={access_token}&wechat_login=1&new_user=1",
                    status_code=status.HTTP_302_FOUND,
                )
        
        elif purpose == "bind":
            # 绑定账号场景，返回用户信息供前端处理
            user_id = state_data.get("user_id")
            if not user_id:
                return RedirectResponse(
                    url=f"{redirect_url}?error=invalid_bind_request",
                    status_code=status.HTTP_302_FOUND,
                )
            
            # 检查是否已被其他账号绑定
            result = await db.execute(
                select(AccountBinding).where(
                    and_(
                        AccountBinding.binding_type == "wechat",
                        AccountBinding.external_id == user_info.openid,
                    )
                )
            )
            existing = result.scalar_one_or_none()
            
            if existing:
                return RedirectResponse(
                    url=f"{redirect_url}?error=wechat_already_bindded",
                    status_code=status.HTTP_302_FOUND,
                )
            
            # 创建绑定
            new_binding = AccountBinding(
                id=str(uuid.uuid4()),
                user_id=user_id,
                binding_type="wechat",
                external_id=user_info.openid,
                external_name=user_info.nickname,
                external_avatar=user_info.headimgurl,
                is_verified=True,
            )
            db.add(new_binding)
            await db.commit()
            
            return RedirectResponse(
                url=f"{redirect_url}?bind_success=1",
                status_code=status.HTTP_302_FOUND,
            )
        
        else:
            return RedirectResponse(
                url=f"{redirect_url}?error=unknown_purpose",
                status_code=status.HTTP_302_FOUND,
            )
            
    except Exception as e:
        # 授权失败，重定向到前端错误页
        error_msg = str(e) if settings.is_development else "wechat_auth_failed"
        return RedirectResponse(
            url=f"{redirect_url}?error={error_msg}",
            status_code=status.HTTP_302_FOUND,
        )


@router.post("/login", response_model=TokenWithUser)
async def wechat_login_by_code(
    request: WechatCallbackRequest,
    db: DatabaseSession,
):
    """
    通过微信授权码登录（前端直接调用）
    
    适用于前端自行处理微信授权流程的场景
    """
    # 验证 state
    state_data = _get_state(request.state)
    if not state_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的授权请求，请重新登录",
        )
    
    use_mp = state_data.get("use_mp", False)
    wechat_service = get_wechat_service(db)
    
    # 获取访问令牌
    token_info = await wechat_service.get_access_token(request.code, use_mp=use_mp)
    
    # 获取用户信息
    user_info = await wechat_service.get_user_info(
        token_info.access_token,
        token_info.openid,
    )
    
    # 查找已绑定的用户
    result = await db.execute(
        select(AccountBinding).where(
            and_(
                AccountBinding.binding_type == "wechat",
                AccountBinding.external_id == user_info.openid,
            )
        )
    )
    binding = result.scalar_one_or_none()
    
    if binding:
        # 已绑定，直接登录
        user_result = await db.execute(
            select(User).where(User.id == binding.user_id)
        )
        user = user_result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="用户不存在",
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="账户已被禁用",
            )
    else:
        # 未绑定，自动注册新用户
        user = User(
            phone=f"wx_{user_info.openid[:8]}",
            hashed_password="",
            nickname=user_info.nickname or f"微信用户{user_info.openid[-4:]}",
            avatar=user_info.headimgurl,
            track="sales",
        )
        db.add(user)
        await db.flush()
        
        # 创建用户画像
        profile = Profile(user_id=user.id)
        db.add(profile)
        
        # 创建绑定记录
        new_binding = AccountBinding(
            id=str(uuid.uuid4()),
            user_id=user.id,
            binding_type="wechat",
            external_id=user_info.openid,
            external_name=user_info.nickname,
            external_avatar=user_info.headimgurl,
            is_verified=True,
        )
        db.add(new_binding)
        await db.commit()
    
    # 生成 JWT Token
    access_token = create_access_token(subject=user.id)
    
    return TokenWithUser(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.get("/bind-url", response_model=WechatLoginUrlResponse)
async def get_wechat_bind_url(
    user_id: str = Query(..., description="当前用户ID"),
    redirect_url: Optional[str] = Query(None, description="绑定成功后的跳转地址"),
    use_mp: bool = Query(False, description="是否使用公众号授权"),
    db: DatabaseSession = None,
):
    """
    获取微信绑定授权 URL
    
    用于已登录用户绑定微信账号
    """
    wechat_service = get_wechat_service(db)
    state = wechat_service.generate_state()
    
    # 保存 state 和相关数据
    _save_state(state, {
        "purpose": "bind",
        "user_id": user_id,
        "redirect_url": redirect_url or "/settings?tab=bindAccount",
        "use_mp": use_mp,
    })
    
    authorize_url = await wechat_service.get_authorize_url(
        state=state,
        use_mp=use_mp,
    )
    
    return WechatLoginUrlResponse(
        authorize_url=authorize_url,
        state=state,
    )


@router.get("/config")
async def get_wechat_config(
    db: DatabaseSession = None,
):
    """
    获取微信登录配置状态
    
    返回微信登录是否已配置（从数据库读取）
    """
    from app.services.system_config_service import SystemConfigService
    config_service = SystemConfigService(db)
    
    config = await config_service.get_wechat_login_config()
    wechat_enabled = await config_service.is_wechat_login_enabled()
    
    return {
        "wechat_enabled": wechat_enabled,
        "wechat_mp_enabled": config.get("mp_enabled", False) and bool(config.get("mp_app_id")),
    }
