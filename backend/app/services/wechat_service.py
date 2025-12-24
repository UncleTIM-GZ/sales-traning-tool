"""
开发：Excellent（11964948@qq.com）
功能：微信登录服务
作用：实现微信开放平台 OAuth2.0 授权登录（配置从数据库读取）
创建时间：2024-12-24
最后修改：2025-12-24
"""

import hashlib
import time
import uuid
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlencode

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestException


@dataclass
class WechatUserInfo:
    """微信用户信息"""
    openid: str
    unionid: Optional[str]
    nickname: str
    sex: int  # 1=男, 2=女, 0=未知
    province: Optional[str]
    city: Optional[str]
    country: Optional[str]
    headimgurl: Optional[str]
    privilege: list[str]


@dataclass
class WechatAccessToken:
    """微信访问令牌"""
    access_token: str
    expires_in: int
    refresh_token: str
    openid: str
    scope: str
    unionid: Optional[str] = None


class WechatService:
    """
    微信登录服务
    
    支持两种登录方式：
    1. 网站应用扫码登录 (PC端)
    2. 公众号网页授权登录 (移动端微信内)
    
    配置从数据库读取，通过 SystemConfigService 管理
    """
    
    # 微信开放平台 API 地址
    AUTHORIZE_URL = "https://open.weixin.qq.com/connect/qrconnect"
    MP_AUTHORIZE_URL = "https://open.weixin.qq.com/connect/oauth2/authorize"
    ACCESS_TOKEN_URL = "https://api.weixin.qq.com/sns/oauth2/access_token"
    REFRESH_TOKEN_URL = "https://api.weixin.qq.com/sns/oauth2/refresh_token"
    USERINFO_URL = "https://api.weixin.qq.com/sns/userinfo"
    CHECK_TOKEN_URL = "https://api.weixin.qq.com/sns/auth"
    
    def __init__(self, db: AsyncSession):
        """初始化服务，需要数据库会话来读取配置"""
        self.db = db
        self._config: dict | None = None
    
    async def _load_config(self) -> dict:
        """从数据库加载微信登录配置"""
        if self._config is None:
            from app.services.system_config_service import SystemConfigService
            config_service = SystemConfigService(self.db)
            self._config = await config_service.get_wechat_login_config()
        return self._config
    
    async def _check_config(self, use_mp: bool = False):
        """检查配置是否完整"""
        config = await self._load_config()
        
        if not config.get("enabled"):
            raise BadRequestException("微信登录功能未启用")
        
        if use_mp:
            if not config.get("mp_enabled"):
                raise BadRequestException("微信公众号登录未启用")
            if not config.get("mp_app_id") or not config.get("mp_app_secret"):
                raise BadRequestException("微信公众号配置未完成")
        else:
            if not config.get("app_id") or not config.get("app_secret"):
                raise BadRequestException("微信开放平台配置未完成")
    
    def generate_state(self) -> str:
        """
        生成防 CSRF 的 state 参数
        
        Returns:
            随机生成的 state 字符串
        """
        raw = f"{uuid.uuid4()}{time.time()}"
        return hashlib.md5(raw.encode()).hexdigest()
    
    async def get_authorize_url(
        self,
        state: str,
        scope: str = "snsapi_login",
        use_mp: bool = False,
    ) -> str:
        """
        获取微信授权登录 URL
        
        Args:
            state: 防 CSRF 的随机字符串
            scope: 授权范围
                - snsapi_login: 网站应用扫码登录
                - snsapi_base: 静默授权，只获取 openid
                - snsapi_userinfo: 获取用户信息
            use_mp: 是否使用公众号授权（移动端微信内使用）
            
        Returns:
            授权登录 URL
        """
        await self._check_config(use_mp)
        config = await self._load_config()
        
        if use_mp:
            # 公众号网页授权
            params = {
                "appid": config.get("mp_app_id"),
                "redirect_uri": config.get("redirect_uri", ""),
                "response_type": "code",
                "scope": scope if scope in ["snsapi_base", "snsapi_userinfo"] else "snsapi_userinfo",
                "state": state,
            }
            return f"{self.MP_AUTHORIZE_URL}?{urlencode(params)}#wechat_redirect"
        else:
            # 网站应用扫码登录
            params = {
                "appid": config.get("app_id"),
                "redirect_uri": config.get("redirect_uri", ""),
                "response_type": "code",
                "scope": "snsapi_login",
                "state": state,
            }
            return f"{self.AUTHORIZE_URL}?{urlencode(params)}#wechat_redirect"
    
    async def get_access_token(
        self,
        code: str,
        use_mp: bool = False,
    ) -> WechatAccessToken:
        """
        通过授权码获取访问令牌
        
        Args:
            code: 微信授权码
            use_mp: 是否使用公众号配置
            
        Returns:
            WechatAccessToken 对象
        """
        await self._check_config(use_mp)
        config = await self._load_config()
        
        if use_mp:
            app_id = config.get("mp_app_id")
            app_secret = config.get("mp_app_secret")
        else:
            app_id = config.get("app_id")
            app_secret = config.get("app_secret")
        
        params = {
            "appid": app_id,
            "secret": app_secret,
            "code": code,
            "grant_type": "authorization_code",
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(self.ACCESS_TOKEN_URL, params=params)
            data = response.json()
        
        if "errcode" in data:
            raise BadRequestException(f"微信授权失败: {data.get('errmsg', '未知错误')}")
        
        return WechatAccessToken(
            access_token=data["access_token"],
            expires_in=data["expires_in"],
            refresh_token=data["refresh_token"],
            openid=data["openid"],
            scope=data["scope"],
            unionid=data.get("unionid"),
        )
    
    async def refresh_access_token(
        self,
        refresh_token: str,
        use_mp: bool = False,
    ) -> WechatAccessToken:
        """
        刷新访问令牌
        
        Args:
            refresh_token: 刷新令牌
            use_mp: 是否使用公众号配置
            
        Returns:
            新的 WechatAccessToken 对象
        """
        await self._check_config(use_mp)
        config = await self._load_config()
        
        app_id = config.get("mp_app_id") if use_mp else config.get("app_id")
        
        params = {
            "appid": app_id,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(self.REFRESH_TOKEN_URL, params=params)
            data = response.json()
        
        if "errcode" in data:
            raise BadRequestException(f"刷新令牌失败: {data.get('errmsg', '未知错误')}")
        
        return WechatAccessToken(
            access_token=data["access_token"],
            expires_in=data["expires_in"],
            refresh_token=data["refresh_token"],
            openid=data["openid"],
            scope=data["scope"],
            unionid=data.get("unionid"),
        )
    
    async def get_user_info(
        self,
        access_token: str,
        openid: str,
    ) -> WechatUserInfo:
        """
        获取微信用户信息
        
        Args:
            access_token: 访问令牌
            openid: 用户 OpenID
            
        Returns:
            WechatUserInfo 对象
        """
        params = {
            "access_token": access_token,
            "openid": openid,
            "lang": "zh_CN",
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(self.USERINFO_URL, params=params)
            data = response.json()
        
        if "errcode" in data:
            raise BadRequestException(f"获取用户信息失败: {data.get('errmsg', '未知错误')}")
        
        return WechatUserInfo(
            openid=data["openid"],
            unionid=data.get("unionid"),
            nickname=data.get("nickname", ""),
            sex=data.get("sex", 0),
            province=data.get("province"),
            city=data.get("city"),
            country=data.get("country"),
            headimgurl=data.get("headimgurl"),
            privilege=data.get("privilege", []),
        )
    
    async def check_access_token(
        self,
        access_token: str,
        openid: str,
    ) -> bool:
        """
        检查访问令牌是否有效
        
        Args:
            access_token: 访问令牌
            openid: 用户 OpenID
            
        Returns:
            True 表示有效，False 表示无效
        """
        params = {
            "access_token": access_token,
            "openid": openid,
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(self.CHECK_TOKEN_URL, params=params)
            data = response.json()
        
        return data.get("errcode", -1) == 0


def get_wechat_service(db: AsyncSession) -> WechatService:
    """获取微信服务实例（依赖注入用）"""
    return WechatService(db)
