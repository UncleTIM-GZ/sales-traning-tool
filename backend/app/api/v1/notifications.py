"""通知API"""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app.api.deps import CurrentUserId, DatabaseSession
from app.services.notification_service import NotificationService


router = APIRouter()


# ===== Schemas =====
class NotificationItem(BaseModel):
    """通知项"""
    id: str
    type: str
    title: str
    content: str
    icon: str | None
    action_type: str | None
    action_url: str | None
    is_read: bool
    priority: str
    created_at: datetime


class NotificationsResponse(BaseModel):
    """通知列表响应"""
    items: list[NotificationItem]
    total: int
    unread_count: int


class UnreadCountResponse(BaseModel):
    """未读数响应"""
    count: int


class NotificationPreferenceResponse(BaseModel):
    """通知偏好响应"""
    achievement_enabled: bool = True
    task_reminder_enabled: bool = True
    session_complete_enabled: bool = True
    community_enabled: bool = True
    system_enabled: bool = True
    daily_reminder_enabled: bool = False
    daily_reminder_time: str | None = None


class NotificationPreferenceUpdate(BaseModel):
    """更新通知偏好"""
    achievement_enabled: bool | None = None
    task_reminder_enabled: bool | None = None
    session_complete_enabled: bool | None = None
    community_enabled: bool | None = None
    system_enabled: bool | None = None
    daily_reminder_enabled: bool | None = None
    daily_reminder_time: str | None = Field(None, pattern=r"^\d{2}:\d{2}$")


@router.get("", response_model=NotificationsResponse)
async def get_notifications(
    user_id: CurrentUserId,
    db: DatabaseSession,
    unread_only: bool = Query(False, description="只显示未读"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
):
    """获取通知列表"""
    service = NotificationService(db)
    
    notifications, total = await service.get_notifications(
        user_id=user_id,
        unread_only=unread_only,
        limit=size,
        offset=(page - 1) * size,
    )
    
    unread_count = await service.get_unread_count(user_id)
    
    return NotificationsResponse(
        items=[
            NotificationItem(
                id=n.id,
                type=n.type,
                title=n.title,
                content=n.content,
                icon=n.icon,
                action_type=n.action_type,
                action_url=n.action_url,
                is_read=n.is_read,
                priority=n.priority,
                created_at=n.created_at,
            )
            for n in notifications
        ],
        total=total,
        unread_count=unread_count,
    )


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    user_id: CurrentUserId,
    db: DatabaseSession,
):
    """获取未读通知数量"""
    service = NotificationService(db)
    count = await service.get_unread_count(user_id)
    return UnreadCountResponse(count=count)


@router.post("/{notification_id}/read")
async def mark_as_read(
    user_id: CurrentUserId,
    db: DatabaseSession,
    notification_id: str,
):
    """标记通知为已读"""
    service = NotificationService(db)
    success = await service.mark_as_read(notification_id, user_id)
    return {"success": success}


@router.post("/read-all")
async def mark_all_as_read(
    user_id: CurrentUserId,
    db: DatabaseSession,
):
    """标记所有通知为已读"""
    service = NotificationService(db)
    count = await service.mark_all_as_read(user_id)
    return {"marked_count": count}


@router.delete("/{notification_id}")
async def delete_notification(
    user_id: CurrentUserId,
    db: DatabaseSession,
    notification_id: str,
):
    """删除通知"""
    service = NotificationService(db)
    success = await service.delete_notification(notification_id, user_id)
    return {"success": success}


# ===== 偏好设置 =====

@router.get("/preferences", response_model=NotificationPreferenceResponse)
async def get_preferences(
    user_id: CurrentUserId,
    db: DatabaseSession,
):
    """获取通知偏好设置"""
    service = NotificationService(db)
    pref = await service.get_preferences(user_id)
    
    if not pref:
        return NotificationPreferenceResponse()
    
    return NotificationPreferenceResponse(
        achievement_enabled=pref.achievement_enabled,
        task_reminder_enabled=pref.task_reminder_enabled,
        session_complete_enabled=pref.session_complete_enabled,
        community_enabled=pref.community_enabled,
        system_enabled=pref.system_enabled,
        daily_reminder_enabled=pref.daily_reminder_enabled,
        daily_reminder_time=pref.daily_reminder_time,
    )


@router.put("/preferences", response_model=NotificationPreferenceResponse)
async def update_preferences(
    user_id: CurrentUserId,
    db: DatabaseSession,
    body: NotificationPreferenceUpdate,
):
    """更新通知偏好设置"""
    service = NotificationService(db)
    pref = await service.update_preferences(
        user_id=user_id,
        achievement_enabled=body.achievement_enabled,
        task_reminder_enabled=body.task_reminder_enabled,
        session_complete_enabled=body.session_complete_enabled,
        community_enabled=body.community_enabled,
        system_enabled=body.system_enabled,
        daily_reminder_enabled=body.daily_reminder_enabled,
        daily_reminder_time=body.daily_reminder_time,
    )
    
    return NotificationPreferenceResponse(
        achievement_enabled=pref.achievement_enabled,
        task_reminder_enabled=pref.task_reminder_enabled,
        session_complete_enabled=pref.session_complete_enabled,
        community_enabled=pref.community_enabled,
        system_enabled=pref.system_enabled,
        daily_reminder_enabled=pref.daily_reminder_enabled,
        daily_reminder_time=pref.daily_reminder_time,
    )
