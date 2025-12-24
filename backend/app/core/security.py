"""
开发：Excellent（11964948@qq.com）
功能：安全相关工具
作用：JWT Token 管理、密码加密验证
创建时间：2024-12-23
最后修改：2024-12-24
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from jose import JWTError, jwt

from app.config import settings


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    return bcrypt.checkpw(
        plain_password.encode('utf-8'), 
        hashed_password.encode('utf-8')
    )


def get_password_hash(password: str) -> str:
    """获取密码哈希"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def create_access_token(
    subject: str | Any,
    expires_delta: timedelta | None = None,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """
    创建访问Token
    
    Token 包含：
    - sub: 用户ID
    - exp: 过期时间
    - iat: 签发时间
    - jti: Token唯一标识（用于黑名单）
    """
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.jwt_expire_minutes)

    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "iat": now,
        "jti": str(uuid.uuid4()),  # JWT ID，用于黑名单
    }
    if extra_claims:
        to_encode.update(extra_claims)

    encoded_jwt = jwt.encode(
        to_encode,
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    return encoded_jwt


def decode_access_token(token: str) -> dict[str, Any] | None:
    """解码访问Token"""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        return payload
    except JWTError:
        return None


def get_token_expiry(token: str) -> float | None:
    """获取 Token 过期时间戳"""
    payload = decode_access_token(token)
    if payload and "exp" in payload:
        return payload["exp"]
    return None


def get_token_jti(token: str) -> str | None:
    """获取 Token 的 JTI（唯一标识）"""
    payload = decode_access_token(token)
    if payload and "jti" in payload:
        return payload["jti"]
    return None


def get_token_iat(token: str) -> float | None:
    """获取 Token 签发时间"""
    payload = decode_access_token(token)
    if payload and "iat" in payload:
        return payload["iat"]
    return None
