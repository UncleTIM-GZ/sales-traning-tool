"""仪表盘数据服务

提供实时数据聚合和缓存功能
"""

from datetime import datetime, timedelta
from typing import Any
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import (
    User, Session, Report, Scenario, Course, Post,
    DashboardMetric
)


class DashboardService:
    """仪表盘数据服务"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_realtime_stats(self) -> dict[str, Any]:
        """获取实时统计数据
        
        Returns:
            包含核心指标的字典
        """
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        week_ago = datetime.now() - timedelta(days=7)
        
        # 并行查询所有指标
        total_users = await self.db.scalar(select(func.count(User.id)))
        active_users = await self.db.scalar(
            select(func.count(User.id)).where(User.is_active == True)
        )
        new_users_today = await self.db.scalar(
            select(func.count(User.id)).where(User.created_at >= today_start)
        )
        
        total_sessions = await self.db.scalar(select(func.count(Session.id)))
        sessions_today = await self.db.scalar(
            select(func.count(Session.id)).where(Session.created_at >= today_start)
        )
        
        avg_score = await self.db.scalar(select(func.avg(Report.total_score)))
        
        total_scenarios = await self.db.scalar(select(func.count(Scenario.id)))
        total_courses = await self.db.scalar(select(func.count(Course.id)))
        total_posts = await self.db.scalar(select(func.count(Post.id)))
        
        return {
            "total_users": total_users or 0,
            "active_users": active_users or 0,
            "new_users_today": new_users_today or 0,
            "total_sessions": total_sessions or 0,
            "sessions_today": sessions_today or 0,
            "avg_score": round(float(avg_score or 0), 1),
            "total_scenarios": total_scenarios or 0,
            "total_courses": total_courses or 0,
            "total_posts": total_posts or 0,
        }
    
    async def get_growth_trend(self, days: int = 30) -> list[dict[str, Any]]:
        """获取增长趋势数据
        
        Args:
            days: 查询天数
            
        Returns:
            每日数据点列表
        """
        end_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        start_date = end_date - timedelta(days=days)
        
        # 查询每日新增用户
        daily_users_query = (
            select(
                func.date(User.created_at).label('date'),
                func.count(User.id).label('count')
            )
            .where(User.created_at >= start_date)
            .group_by(func.date(User.created_at))
            .order_by(func.date(User.created_at))
        )
        
        result = await self.db.execute(daily_users_query)
        daily_data = result.all()
        
        # 查询每日会话数
        daily_sessions_query = (
            select(
                func.date(Session.created_at).label('date'),
                func.count(Session.id).label('count')
            )
            .where(Session.created_at >= start_date)
            .group_by(func.date(Session.created_at))
            .order_by(func.date(Session.created_at))
        )
        
        sessions_result = await self.db.execute(daily_sessions_query)
        daily_sessions = {str(row.date): row.count for row in sessions_result.all()}
        
        # 组合数据
        trend_data = []
        for row in daily_data:
            date_str = str(row.date)
            trend_data.append({
                "date": date_str,
                "new_users": row.count,
                "sessions": daily_sessions.get(date_str, 0)
            })
        
        return trend_data
    
    async def get_user_distribution(self) -> dict[str, Any]:
        """获取用户分布数据
        
        Returns:
            用户分布统计
        """
        # 按赛道分布
        track_query = (
            select(
                User.track,
                func.count(User.id).label('count')
            )
            .group_by(User.track)
        )
        
        track_result = await self.db.execute(track_query)
        track_distribution = [
            {"name": row.track, "value": row.count}
            for row in track_result.all()
        ]
        
        # 按训练模式分布
        mode_query = (
            select(
                Session.mode,
                func.count(Session.id).label('count')
            )
            .group_by(Session.mode)
        )
        
        mode_result = await self.db.execute(mode_query)
        mode_distribution = [
            {"name": row.mode, "value": row.count}
            for row in mode_result.all()
        ]
        
        return {
            "track_distribution": track_distribution,
            "mode_distribution": mode_distribution
        }
