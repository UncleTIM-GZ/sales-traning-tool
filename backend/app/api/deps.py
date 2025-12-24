"""API依赖注入"""

from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import UnauthorizedException
from app.core.security import decode_access_token
from app.db.session import get_db_session
from app.models import User


# 数据库会话依赖
async def get_db() -> AsyncSession:
    """获取数据库会话"""
    async for session in get_db_session():
        yield session


DatabaseSession = Annotated[AsyncSession, Depends(get_db)]


# 当前用户依赖
async def get_current_user_id(
    authorization: Annotated[str | None, Header()] = None,
) -> str:
    """获取当前用户ID"""
    if not authorization:
        raise UnauthorizedException()

    # 解析Bearer token
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise UnauthorizedException()

    # 解码token
    payload = decode_access_token(token)
    if not payload:
        raise UnauthorizedException()

    user_id = payload.get("sub")
    if not user_id:
        raise UnauthorizedException()

    return user_id


CurrentUserId = Annotated[str, Depends(get_current_user_id)]


# 可选的用户ID依赖
async def get_optional_user_id(
    authorization: Annotated[str | None, Header()] = None,
) -> str | None:
    """获取可选的当前用户ID"""
    if not authorization:
        return None

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None

    payload = decode_access_token(token)
    if not payload:
        return None

    return payload.get("sub")


OptionalUserId = Annotated[str | None, Depends(get_optional_user_id)]


# 当前用户对象依赖
async def get_current_user(
    user_id: CurrentUserId,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """获取当前用户对象"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise UnauthorizedException()
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


# 可选的用户对象依赖
async def get_optional_user(
    authorization: Annotated[str | None, Header()] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> User | None:
    """获取可选的当前用户对象"""
    if not authorization:
        return None

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None

    payload = decode_access_token(token)
    if not payload:
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


OptionalUser = Annotated[User | None, Depends(get_optional_user)]


# 管理员用户依赖
async def get_current_admin(
    user_id: CurrentUserId,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """获取当前管理员用户"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise UnauthorizedException()
    if user.role != "admin":
        raise UnauthorizedException(detail="需要管理员权限")
    return user


CurrentAdmin = Annotated[User, Depends(get_current_admin)]
