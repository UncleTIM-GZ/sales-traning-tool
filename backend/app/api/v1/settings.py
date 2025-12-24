"""用户设置 API"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.security import get_password_hash, verify_password
from app.models import User, UserSettings

router = APIRouter()


# ===== Schemas =====

class NotificationSettings(BaseModel):
    training: bool = True
    report: bool = True
    community: bool = False
    marketing: bool = False


class PrivacySettings(BaseModel):
    show_profile: bool = True
    show_rank: bool = True
    show_activity: bool = False


class UserSettingsResponse(BaseModel):
    bio: Optional[str]
    notifications: NotificationSettings
    privacy: PrivacySettings

    class Config:
        from_attributes = True


class UpdateSettingsRequest(BaseModel):
    bio: Optional[str] = None
    notifications: Optional[NotificationSettings] = None
    privacy: Optional[PrivacySettings] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ChangeTrackRequest(BaseModel):
    track: str  # "sales" or "social"


class UpdateProfileRequest(BaseModel):
    nickname: Optional[str] = None
    avatar: Optional[str] = None
    bio: Optional[str] = None


# ===== 获取设置 =====

@router.get("", response_model=UserSettingsResponse)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取用户设置"""
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == current_user.id)
    )
    settings = result.scalar_one_or_none()
    
    if not settings:
        # 创建默认设置
        import uuid
        settings = UserSettings(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            bio=None,
            notifications={
                "training": True,
                "report": True,
                "community": False,
                "marketing": False,
            },
            privacy={
                "show_profile": True,
                "show_rank": True,
                "show_activity": False,
            },
        )
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    
    return UserSettingsResponse(
        bio=settings.bio,
        notifications=NotificationSettings(**settings.notifications),
        privacy=PrivacySettings(**settings.privacy),
    )


# ===== 更新设置 =====

@router.put("", response_model=UserSettingsResponse)
async def update_settings(
    data: UpdateSettingsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新用户设置"""
    import uuid
    
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == current_user.id)
    )
    settings = result.scalar_one_or_none()
    
    if not settings:
        settings = UserSettings(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            bio=None,
            notifications={
                "training": True,
                "report": True,
                "community": False,
                "marketing": False,
            },
            privacy={
                "show_profile": True,
                "show_rank": True,
                "show_activity": False,
            },
        )
        db.add(settings)
    
    # 更新字段
    if data.bio is not None:
        settings.bio = data.bio
    if data.notifications is not None:
        settings.notifications = data.notifications.model_dump()
    if data.privacy is not None:
        settings.privacy = data.privacy.model_dump()
    
    await db.commit()
    await db.refresh(settings)
    
    return UserSettingsResponse(
        bio=settings.bio,
        notifications=NotificationSettings(**settings.notifications),
        privacy=PrivacySettings(**settings.privacy),
    )


# ===== 修改密码 =====

@router.put("/password")
async def change_password(
    data: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """修改密码"""
    # 验证当前密码
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="当前密码错误")
    
    # 验证新密码
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="新密码至少6位")
    
    if data.new_password == data.current_password:
        raise HTTPException(status_code=400, detail="新密码不能与当前密码相同")
    
    # 更新密码
    current_user.hashed_password = get_password_hash(data.new_password)
    await db.commit()
    
    return {"message": "密码修改成功"}


# ===== 切换赛道 =====

@router.put("/track")
async def change_track(
    data: ChangeTrackRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """切换赛道"""
    if data.track not in ["sales", "social"]:
        raise HTTPException(status_code=400, detail="无效的赛道")
    
    if current_user.track == data.track:
        raise HTTPException(status_code=400, detail="已在该赛道")
    
    current_user.track = data.track
    await db.commit()
    
    return {"message": "切换成功", "track": data.track}


# ===== 更新个人资料 =====

@router.put("/profile")
async def update_profile(
    data: UpdateProfileRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新个人资料"""
    import uuid
    
    # 更新用户表
    if data.nickname is not None:
        if len(data.nickname.strip()) < 2:
            raise HTTPException(status_code=400, detail="昵称至少2个字符")
        current_user.nickname = data.nickname.strip()
    
    if data.avatar is not None:
        current_user.avatar = data.avatar
    
    # 更新设置表中的bio
    if data.bio is not None:
        result = await db.execute(
            select(UserSettings).where(UserSettings.user_id == current_user.id)
        )
        settings = result.scalar_one_or_none()
        
        if not settings:
            settings = UserSettings(
                id=str(uuid.uuid4()),
                user_id=current_user.id,
                bio=data.bio,
                notifications={
                    "training": True,
                    "report": True,
                    "community": False,
                    "marketing": False,
                },
                privacy={
                    "show_profile": True,
                    "show_rank": True,
                    "show_activity": False,
                },
            )
            db.add(settings)
        else:
            settings.bio = data.bio
    
    await db.commit()
    
    return {
        "message": "更新成功",
        "nickname": current_user.nickname,
        "avatar": current_user.avatar,
    }
