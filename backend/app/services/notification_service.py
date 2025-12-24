"""通知服务"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification, NotificationPreference


class NotificationService:
    """通知服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_notification(
        self,
        user_id: str,
        notification_type: str,
        title: str,
        content: str,
        icon: str | None = None,
        action_type: str | None = None,
        action_url: str | None = None,
        action_data: dict | None = None,
        priority: str = "normal",
    ) -> Notification:
        """创建通知"""
        # 检查用户通知偏好
        pref = await self.get_preferences(user_id)
        if pref and not await self._should_send(pref, notification_type):
            return None  # 用户禁用了此类通知
        
        notification = Notification(
            id=str(uuid.uuid4()),
            user_id=user_id,
            type=notification_type,
            title=title,
            content=content,
            icon=icon,
            action_type=action_type,
            action_url=action_url,
            action_data=action_data,
            priority=priority,
            is_read=False,
        )
        
        self.db.add(notification)
        await self.db.commit()
        await self.db.refresh(notification)
        
        return notification

    async def _should_send(self, pref: NotificationPreference, notification_type: str) -> bool:
        """检查是否应该发送通知"""
        type_mapping = {
            "achievement_unlock": pref.achievement_enabled,
            "task_reminder": pref.task_reminder_enabled,
            "session_complete": pref.session_complete_enabled,
            "course_progress": pref.session_complete_enabled,
            "community_like": pref.community_enabled,
            "community_comment": pref.community_enabled,
            "system_announcement": pref.system_enabled,
        }
        return type_mapping.get(notification_type, True)

    async def get_notifications(
        self,
        user_id: str,
        unread_only: bool = False,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[Notification], int]:
        """获取通知列表"""
        # 构建查询
        query = select(Notification).where(Notification.user_id == user_id)
        count_query = select(func.count(Notification.id)).where(Notification.user_id == user_id)
        
        if unread_only:
            query = query.where(Notification.is_read == False)
            count_query = count_query.where(Notification.is_read == False)
        
        # 总数
        count_result = await self.db.execute(count_query)
        total = count_result.scalar() or 0
        
        # 列表
        query = query.order_by(Notification.created_at.desc()).offset(offset).limit(limit)
        result = await self.db.execute(query)
        notifications = list(result.scalars().all())
        
        return notifications, total

    async def get_unread_count(self, user_id: str) -> int:
        """获取未读通知数量"""
        result = await self.db.execute(
            select(func.count(Notification.id))
            .where(Notification.user_id == user_id)
            .where(Notification.is_read == False)
        )
        return result.scalar() or 0

    async def mark_as_read(self, notification_id: str, user_id: str) -> bool:
        """标记单个通知为已读"""
        result = await self.db.execute(
            select(Notification)
            .where(Notification.id == notification_id)
            .where(Notification.user_id == user_id)
        )
        notification = result.scalar_one_or_none()
        
        if notification:
            notification.is_read = True
            notification.read_at = datetime.utcnow()
            await self.db.commit()
            return True
        
        return False

    async def mark_all_as_read(self, user_id: str) -> int:
        """标记所有通知为已读"""
        result = await self.db.execute(
            update(Notification)
            .where(Notification.user_id == user_id)
            .where(Notification.is_read == False)
            .values(is_read=True, read_at=datetime.utcnow())
        )
        await self.db.commit()
        return result.rowcount

    async def delete_notification(self, notification_id: str, user_id: str) -> bool:
        """删除通知"""
        result = await self.db.execute(
            select(Notification)
            .where(Notification.id == notification_id)
            .where(Notification.user_id == user_id)
        )
        notification = result.scalar_one_or_none()
        
        if notification:
            await self.db.delete(notification)
            await self.db.commit()
            return True
        
        return False

    # ===== 偏好设置 =====
    
    async def get_preferences(self, user_id: str) -> NotificationPreference | None:
        """获取通知偏好设置"""
        result = await self.db.execute(
            select(NotificationPreference).where(NotificationPreference.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def update_preferences(
        self,
        user_id: str,
        achievement_enabled: bool | None = None,
        task_reminder_enabled: bool | None = None,
        session_complete_enabled: bool | None = None,
        community_enabled: bool | None = None,
        system_enabled: bool | None = None,
        daily_reminder_enabled: bool | None = None,
        daily_reminder_time: str | None = None,
    ) -> NotificationPreference:
        """更新通知偏好设置"""
        pref = await self.get_preferences(user_id)
        
        if not pref:
            pref = NotificationPreference(
                id=str(uuid.uuid4()),
                user_id=user_id,
            )
            self.db.add(pref)
        
        if achievement_enabled is not None:
            pref.achievement_enabled = achievement_enabled
        if task_reminder_enabled is not None:
            pref.task_reminder_enabled = task_reminder_enabled
        if session_complete_enabled is not None:
            pref.session_complete_enabled = session_complete_enabled
        if community_enabled is not None:
            pref.community_enabled = community_enabled
        if system_enabled is not None:
            pref.system_enabled = system_enabled
        if daily_reminder_enabled is not None:
            pref.daily_reminder_enabled = daily_reminder_enabled
        if daily_reminder_time is not None:
            pref.daily_reminder_time = daily_reminder_time
        
        await self.db.commit()
        await self.db.refresh(pref)
        
        return pref

    # ===== 便捷方法：创建特定类型通知 =====

    async def notify_achievement_unlock(
        self,
        user_id: str,
        achievement_name: str,
        achievement_icon: str,
        points_reward: int,
    ):
        """成就解锁通知"""
        return await self.create_notification(
            user_id=user_id,
            notification_type="achievement_unlock",
            title="🎉 成就解锁！",
            content=f"恭喜获得成就「{achievement_name}」，奖励 {points_reward} 积分！",
            icon=achievement_icon,
            action_type="link",
            action_url="/profile",
            priority="high",
        )

    async def notify_task_reminder(self, user_id: str, plan_name: str, tasks_count: int):
        """任务提醒通知"""
        return await self.create_notification(
            user_id=user_id,
            notification_type="task_reminder",
            title="📋 今日任务提醒",
            content=f"您的「{plan_name}」还有 {tasks_count} 个任务待完成，加油！",
            icon="📋",
            action_type="link",
            action_url="/plan",
        )

    async def notify_session_complete(
        self,
        user_id: str,
        scenario_name: str,
        score: float,
        report_id: str,
    ):
        """训练完成通知"""
        return await self.create_notification(
            user_id=user_id,
            notification_type="session_complete",
            title="✅ 训练完成",
            content=f"场景「{scenario_name}」训练完成，得分 {score:.0f} 分！",
            icon="✅",
            action_type="link",
            action_url=f"/report/{report_id}",
        )

    async def notify_system_announcement(
        self,
        user_id: str,
        title: str,
        content: str,
    ):
        """系统公告通知"""
        return await self.create_notification(
            user_id=user_id,
            notification_type="system_announcement",
            title=title,
            content=content,
            icon="📢",
            priority="high",
        )
