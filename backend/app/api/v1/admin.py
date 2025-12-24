"""管理后台 API"""

import secrets
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import delete, func, select, update, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_db
from app.models import (
    Achievement,
    Challenge,
    Course,
    InviteCode,
    Notification,
    Post,
    Report,
    Scenario,
    ScenarioReport,
    Session,
    SystemConfig,
    TrainingPlan,
    User,
    UserAchievement,
)

router = APIRouter()


# ============ Schemas ============


class SystemConfigUpdate(BaseModel):
    """系统配置更新"""

    value: dict[str, Any]
    description: str | None = None


class SmsConfigUpdate(BaseModel):
    """短信配置更新"""

    enabled: bool = False
    access_key_id: str = ""
    access_key_secret: str = ""
    sign_name: str = ""
    template_code: str = ""


class LoginConfigUpdate(BaseModel):
    """登录配置更新"""

    sms_login_enabled: bool = False
    password_login_enabled: bool = True


class DashboardStats(BaseModel):
    """仪表盘统计"""

    total_users: int = 0
    new_users_today: int = 0
    active_users: int = 0
    total_sessions: int = 0
    sessions_today: int = 0
    avg_score: float = 0
    total_scenarios: int = 0
    total_courses: int = 0
    total_posts: int = 0
    total_reports: int = 0


# ============ Helper Functions ============


def require_admin(user: User):
    """检查管理员权限"""
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理员权限",
        )


async def get_config(db: AsyncSession, key: str) -> dict[str, Any] | None:
    """获取配置"""
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == key))
    config = result.scalar_one_or_none()
    return config.value if config else None


async def set_config(
    db: AsyncSession, key: str, value: dict[str, Any], description: str | None = None
):
    """设置配置"""
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == key))
    config = result.scalar_one_or_none()

    if config:
        config.value = value
        if description is not None:
            config.description = description
    else:
        config = SystemConfig(key=key, value=value, description=description)
        db.add(config)

    await db.commit()
    return config


# ============ Dashboard API ============


@router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取仪表盘统计数据"""
    require_admin(current_user)

    from datetime import datetime, timedelta

    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    # 并行查询各项统计
    total_users = await db.scalar(select(func.count(User.id)))
    active_users = await db.scalar(
        select(func.count(User.id)).where(User.is_active == True)  # noqa: E712
    )
    new_users_today = await db.scalar(
        select(func.count(User.id)).where(User.created_at >= today_start)
    )
    total_sessions = await db.scalar(select(func.count(Session.id)))
    sessions_today = await db.scalar(
        select(func.count(Session.id)).where(Session.created_at >= today_start)
    )
    avg_score = await db.scalar(select(func.avg(Report.total_score)))
    total_scenarios = await db.scalar(select(func.count(Scenario.id)))
    total_courses = await db.scalar(select(func.count(Course.id)))
    total_posts = await db.scalar(select(func.count(Post.id)))
    total_reports = await db.scalar(select(func.count(Report.id)))

    return DashboardStats(
        total_users=total_users or 0,
        new_users_today=new_users_today or 0,
        active_users=active_users or 0,
        total_sessions=total_sessions or 0,
        sessions_today=sessions_today or 0,
        avg_score=round(float(avg_score or 0), 1),
        total_scenarios=total_scenarios or 0,
        total_courses=total_courses or 0,
        total_posts=total_posts or 0,
        total_reports=total_reports or 0,
    )


# ============ System Config API ============


@router.get("/config/{key}")
async def get_system_config(
    key: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取系统配置"""
    require_admin(current_user)

    config = await get_config(db, key)
    if config is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"配置 {key} 不存在",
        )

    return {"key": key, "value": config}


@router.put("/config/{key}")
async def update_system_config(
    key: str,
    data: SystemConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新系统配置"""
    require_admin(current_user)

    config = await set_config(db, key, data.value, data.description)
    return {"key": key, "value": config.value, "description": config.description}


@router.get("/config")
async def list_system_configs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """列出所有系统配置"""
    require_admin(current_user)

    result = await db.execute(select(SystemConfig))
    configs = result.scalars().all()

    return [
        {"key": c.key, "value": c.value, "description": c.description} for c in configs
    ]


# ============ SMS Config API ============


@router.get("/settings/sms")
async def get_sms_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取短信配置"""
    require_admin(current_user)

    config = await get_config(db, "sms_config")
    if config is None:
        # 返回默认配置
        config = {
            "enabled": False,
            "access_key_id": "",
            "access_key_secret": "",
            "sign_name": "",
            "template_code": "",
        }

    # 隐藏敏感信息的部分字符
    if config.get("access_key_secret"):
        secret = config["access_key_secret"]
        config["access_key_secret_masked"] = (
            secret[:4] + "*" * (len(secret) - 8) + secret[-4:]
            if len(secret) > 8
            else "****"
        )
        del config["access_key_secret"]

    return config


@router.put("/settings/sms")
async def update_sms_config(
    data: SmsConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新短信配置"""
    require_admin(current_user)

    # 如果没有提供新密钥，保留原有密钥
    existing = await get_config(db, "sms_config")
    secret = data.access_key_secret
    if not secret and existing:
        secret = existing.get("access_key_secret", "")

    config = {
        "enabled": data.enabled,
        "access_key_id": data.access_key_id,
        "access_key_secret": secret,
        "sign_name": data.sign_name,
        "template_code": data.template_code,
    }

    await set_config(db, "sms_config", config, "阿里云短信服务配置")

    # 同步更新登录配置
    login_config = await get_config(db, "login_config") or {
        "sms_login_enabled": False,
        "password_login_enabled": True,
    }
    login_config["sms_login_enabled"] = data.enabled
    await set_config(db, "login_config", login_config, "登录方式配置")

    return {"success": True, "message": "短信配置已更新"}


# ============ Login Config API ============


@router.get("/settings/login")
async def get_login_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取登录配置"""
    require_admin(current_user)

    config = await get_config(db, "login_config")
    if config is None:
        config = {
            "sms_login_enabled": False,
            "password_login_enabled": True,
        }

    return config


@router.put("/settings/login")
async def update_login_config(
    data: LoginConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新登录配置"""
    require_admin(current_user)

    # 至少启用一种登录方式
    if not data.sms_login_enabled and not data.password_login_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="至少需要启用一种登录方式",
        )

    # 如果启用短信登录，检查短信配置
    if data.sms_login_enabled:
        sms_config = await get_config(db, "sms_config")
        if not sms_config or not sms_config.get("enabled"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="启用短信登录前请先配置并启用短信服务",
            )

    config = {
        "sms_login_enabled": data.sms_login_enabled,
        "password_login_enabled": data.password_login_enabled,
    }

    await set_config(db, "login_config", config, "登录方式配置")

    return {"success": True, "message": "登录配置已更新"}


# ============ Public Config API (无需登录) ============


@router.get("/public/login-config")
async def get_public_login_config(
    db: AsyncSession = Depends(get_db),
):
    """获取公共登录配置（供登录页使用，无需认证）"""
    config = await get_config(db, "login_config")
    if config is None:
        config = {
            "sms_login_enabled": False,
            "password_login_enabled": True,
        }

    return config


# ============ Checkin Config API ============


class CheckinConfigUpdate(BaseModel):
    """签到配置更新"""
    base_points: int = 5
    streak_bonus: dict[str, int] = {}
    max_streak_bonus: int = 200
    enabled: bool = True


@router.get("/settings/checkin")
async def get_checkin_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取签到配置"""
    require_admin(current_user)

    config = await get_config(db, "checkin_config")
    if config is None:
        config = {
            "base_points": 5,
            "streak_bonus": {
                "3": 5,
                "7": 10,
                "14": 20,
                "30": 50,
                "60": 100,
                "90": 200,
            },
            "max_streak_bonus": 200,
            "enabled": True,
        }

    return config


@router.put("/settings/checkin")
async def update_checkin_config(
    data: CheckinConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新签到配置"""
    require_admin(current_user)

    if data.base_points < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="基础积分不能为负数",
        )

    config = {
        "base_points": data.base_points,
        "streak_bonus": data.streak_bonus,
        "max_streak_bonus": data.max_streak_bonus,
        "enabled": data.enabled,
    }

    await set_config(db, "checkin_config", config, "签到配置")

    return {"success": True, "message": "签到配置已更新", "config": config}


# ============ User Management API ============


@router.get("/users")
async def list_users(
    page: int = 1,
    page_size: int = 20,
    search: str = "",
    role: str = "",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取用户列表"""
    require_admin(current_user)

    query = select(User)

    # 搜索
    if search:
        query = query.where(
            User.phone.ilike(f"%{search}%") | User.nickname.ilike(f"%{search}%")
        )

    # 角色筛选
    if role:
        query = query.where(User.role == role)

    # 分页
    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar() or 0

    query = (
        query.order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    users = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [
            {
                "id": u.id,
                "phone": u.phone,
                "nickname": u.nickname,
                "avatar": u.avatar,
                "role": u.role,
                "track": u.track,
                "level": u.level,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ],
    }


@router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    role: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新用户角色"""
    require_admin(current_user)

    if role not in ["user", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的角色",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在",
        )

    user.role = role
    await db.commit()

    return {"success": True, "message": f"用户角色已更新为 {role}"}


@router.put("/users/{user_id}/status")
async def update_user_status(
    user_id: str,
    is_active: bool,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新用户状态"""
    require_admin(current_user)

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在",
        )

    # 不能禁用自己
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能禁用自己的账户",
        )

    user.is_active = is_active
    await db.commit()

    return {"success": True, "message": f"用户状态已更新为 {'启用' if is_active else '禁用'}"}


# ============ 统计分析 API ============


@router.get("/statistics/user-growth")
async def get_user_growth(
    days: int = 7,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """用户增长趋势"""
    require_admin(current_user)

    from datetime import datetime, timedelta

    # 计算日期范围
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    dates = [(today - timedelta(days=i)).date() for i in range(days - 1, -1, -1)]

    result = []
    total = 0

    for date in dates:
        start = datetime.combine(date, datetime.min.time())
        end = start + timedelta(days=1)

        # 统计当日新增用户
        new_users = await db.scalar(
            select(func.count(User.id)).where(
                User.created_at >= start, User.created_at < end
            )
        )

        # 统计截至当日的总用户数
        total_users = await db.scalar(
            select(func.count(User.id)).where(User.created_at < end)
        )

        result.append(
            {
                "date": date.strftime("%m-%d"),
                "new": new_users or 0,
                "total": total_users or 0,
            }
        )

    return result


@router.get("/statistics/session-trend")
async def get_session_trend(
    days: int = 7,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """训练完成趋势"""
    require_admin(current_user)

    from datetime import datetime, timedelta

    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    dates = [(today - timedelta(days=i)).date() for i in range(days - 1, -1, -1)]

    result = []

    for date in dates:
        start = datetime.combine(date, datetime.min.time())
        end = start + timedelta(days=1)

        # 统计当日训练次数
        sessions_count = await db.scalar(
            select(func.count(Session.id)).where(
                Session.created_at >= start, Session.created_at < end
            )
        )

        # 统计当日平均分
        avg_score = await db.scalar(
            select(func.avg(Report.total_score))
            .select_from(Session)
            .join(Report, Report.session_id == Session.id)
            .where(Session.created_at >= start, Session.created_at < end)
        )

        result.append(
            {
                "date": date.strftime("%m-%d"),
                "sessions": sessions_count or 0,
                "avgScore": round(float(avg_score or 0), 1),
            }
        )

    return result


@router.get("/statistics/scenario-distribution")
async def get_scenario_distribution(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """场景分布统计"""
    require_admin(current_user)

    # 统计每个场景的训练次数
    result = await db.execute(
        select(
            Scenario.name,
            func.count(Session.id).label("count"),
        )
        .join(Session, Session.scenario_id == Scenario.id)
        .group_by(Scenario.id, Scenario.name)
        .order_by(func.count(Session.id).desc())
        .limit(10)
    )

    scenarios = result.all()

    # 为不同类型分配颜色
    colors = [
        "#8B5CF6",  # violet
        "#6366F1",  # indigo
        "#EC4899",  # pink
        "#10B981",  # green
        "#F59E0B",  # amber
        "#3B82F6",  # blue
        "#EF4444",  # red
        "#8B5CF6",  # violet
        "#06B6D4",  # cyan
        "#84CC16",  # lime
    ]

    return [
        {"name": s.name, "value": s.count, "color": colors[i % len(colors)]}
        for i, s in enumerate(scenarios)
    ]


# ============ Report Management API ============


@router.get("/reports")
async def list_admin_reports(
    page: int = 1,
    page_size: int = 20,
    search: str = "",
    score_min: float | None = None,
    score_max: float | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取训练报告列表"""
    require_admin(current_user)

    query = select(Report).join(User, Report.user_id == User.id).join(
        Session, Report.session_id == Session.id
    )

    if search:
        query = query.where(
            or_(
                User.nickname.ilike(f"%{search}%"),
                User.phone.ilike(f"%{search}%"),
            )
        )

    if score_min is not None:
        query = query.where(Report.total_score >= score_min)
    if score_max is not None:
        query = query.where(Report.total_score <= score_max)

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar() or 0

    query = (
        query.order_by(Report.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    reports = result.scalars().all()

    items = []
    for r in reports:
        user_result = await db.execute(select(User).where(User.id == r.user_id))
        user = user_result.scalar_one_or_none()
        session_result = await db.execute(select(Session).where(Session.id == r.session_id))
        session = session_result.scalar_one_or_none()
        scenario_result = await db.execute(
            select(Scenario).where(Scenario.id == session.scenario_id)
        ) if session else None
        scenario = scenario_result.scalar_one_or_none() if scenario_result else None

        items.append({
            "id": r.id,
            "user": {
                "id": user.id if user else None,
                "nickname": user.nickname if user else "未知",
                "avatar": user.avatar if user else None,
            },
            "scenario": {
                "id": scenario.id if scenario else None,
                "name": scenario.name if scenario else "未知场景",
            },
            "total_score": r.total_score,
            "mode": session.mode if session else "train",
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return {"total": total, "page": page, "page_size": page_size, "items": items}


@router.get("/reports/stats")
async def get_reports_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取报告统计"""
    require_admin(current_user)

    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)

    total = await db.scalar(select(func.count(Report.id)))
    today_count = await db.scalar(
        select(func.count(Report.id)).where(Report.created_at >= today_start)
    )
    avg_score = await db.scalar(select(func.avg(Report.total_score)))
    high_score_count = await db.scalar(
        select(func.count(Report.id)).where(Report.total_score >= 80)
    )

    return {
        "total": total or 0,
        "today_count": today_count or 0,
        "avg_score": round(float(avg_score or 0), 1),
        "high_score_count": high_score_count or 0,
    }


# ============ Notification Management API ============


class NotificationCreate(BaseModel):
    title: str
    content: str
    type: str = "system_announcement"
    priority: str = "normal"
    target: str = "all"  # all, user_ids
    user_ids: list[str] | None = None


@router.get("/notifications")
async def list_admin_notifications(
    page: int = 1,
    page_size: int = 20,
    type: str = "",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取通知列表"""
    require_admin(current_user)

    query = select(Notification)

    if type:
        query = query.where(Notification.type == type)

    # 只查询系统公告类型的通知（管理后台发布的）
    query = query.where(Notification.type == "system_announcement")

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar() or 0

    query = (
        query.order_by(Notification.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    notifications = result.scalars().all()

    # 统计已读数
    items = []
    for n in notifications:
        read_count = await db.scalar(
            select(func.count(Notification.id)).where(
                Notification.title == n.title,
                Notification.type == "system_announcement",
                Notification.is_read == True  # noqa: E712
            )
        )
        total_sent = await db.scalar(
            select(func.count(Notification.id)).where(
                Notification.title == n.title,
                Notification.type == "system_announcement"
            )
        )
        items.append({
            "id": n.id,
            "title": n.title,
            "content": n.content,
            "type": n.type,
            "priority": n.priority,
            "is_read": n.is_read,
            "read_count": read_count or 0,
            "total_sent": total_sent or 0,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        })

    return {"total": total, "page": page, "page_size": page_size, "items": items}


@router.post("/notifications")
async def create_admin_notification(
    data: NotificationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """发布系统通知"""
    require_admin(current_user)

    if data.target == "all":
        # 给所有用户发送
        users_result = await db.execute(select(User.id).where(User.is_active == True))  # noqa: E712
        user_ids = [u for u in users_result.scalars().all()]
    else:
        user_ids = data.user_ids or []

    created_count = 0
    for user_id in user_ids:
        notification = Notification(
            user_id=user_id,
            type=data.type,
            title=data.title,
            content=data.content,
            priority=data.priority,
        )
        db.add(notification)
        created_count += 1

    await db.commit()

    return {"success": True, "message": f"已发送{created_count}条通知"}


@router.get("/notifications/stats")
async def get_notifications_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取通知统计"""
    require_admin(current_user)

    total = await db.scalar(select(func.count(Notification.id)))
    unread = await db.scalar(
        select(func.count(Notification.id)).where(Notification.is_read == False)  # noqa: E712
    )
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_count = await db.scalar(
        select(func.count(Notification.id)).where(Notification.created_at >= today_start)
    )

    return {
        "total": total or 0,
        "unread": unread or 0,
        "today_count": today_count or 0,
        "read_rate": round(((total - unread) / total * 100) if total else 0, 1),
    }


# ============ Invite Code Management API ============


class InviteCodeCreate(BaseModel):
    name: str
    code: str | None = None  # 不提供则自动生成
    channel: str = "official"
    reward_type: str = "points"
    reward_value: int = 100
    max_uses: int = 0
    expires_days: int | None = None


class InviteCodeUpdate(BaseModel):
    name: str | None = None
    reward_type: str | None = None
    reward_value: int | None = None
    max_uses: int | None = None
    is_active: bool | None = None


@router.get("/invites")
async def list_invite_codes(
    page: int = 1,
    page_size: int = 20,
    channel: str = "",
    status: str = "",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取邀请码列表"""
    require_admin(current_user)

    query = select(InviteCode)

    if channel:
        query = query.where(InviteCode.channel == channel)

    if status == "active":
        query = query.where(InviteCode.is_active == True)  # noqa: E712
    elif status == "inactive":
        query = query.where(InviteCode.is_active == False)  # noqa: E712

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar() or 0

    query = (
        query.order_by(InviteCode.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    codes = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [
            {
                "id": c.id,
                "name": c.name,
                "code": c.code,
                "channel": c.channel,
                "reward_type": c.reward_type,
                "reward_value": c.reward_value,
                "use_count": c.use_count,
                "max_uses": c.max_uses,
                "is_active": c.is_active,
                "expires_at": c.expires_at.isoformat() if c.expires_at else None,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in codes
        ],
    }


@router.post("/invites")
async def create_invite_code(
    data: InviteCodeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建邀请码"""
    require_admin(current_user)

    # 生成邀请码
    code = data.code or f"{data.channel.upper()[:3]}_{secrets.token_hex(4).upper()}"

    # 检查重复
    existing = await db.execute(select(InviteCode).where(InviteCode.code == code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="邀请码已存在")

    expires_at = None
    if data.expires_days:
        expires_at = datetime.utcnow() + timedelta(days=data.expires_days)

    invite = InviteCode(
        name=data.name,
        code=code,
        channel=data.channel,
        reward_type=data.reward_type,
        reward_value=data.reward_value,
        max_uses=data.max_uses,
        expires_at=expires_at,
    )
    db.add(invite)
    await db.commit()
    await db.refresh(invite)

    return {
        "id": invite.id,
        "code": invite.code,
        "message": "邀请码创建成功",
    }


@router.put("/invites/{invite_id}")
async def update_invite_code(
    invite_id: str,
    data: InviteCodeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新邀请码"""
    require_admin(current_user)

    result = await db.execute(select(InviteCode).where(InviteCode.id == invite_id))
    invite = result.scalar_one_or_none()

    if not invite:
        raise HTTPException(status_code=404, detail="邀请码不存在")

    if data.name is not None:
        invite.name = data.name
    if data.reward_type is not None:
        invite.reward_type = data.reward_type
    if data.reward_value is not None:
        invite.reward_value = data.reward_value
    if data.max_uses is not None:
        invite.max_uses = data.max_uses
    if data.is_active is not None:
        invite.is_active = data.is_active

    await db.commit()

    return {"success": True, "message": "邀请码已更新"}


@router.delete("/invites/{invite_id}")
async def delete_invite_code(
    invite_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除邀请码"""
    require_admin(current_user)

    await db.execute(delete(InviteCode).where(InviteCode.id == invite_id))
    await db.commit()

    return {"success": True, "message": "邀请码已删除"}


@router.get("/invites/stats")
async def get_invites_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取邀请统计"""
    require_admin(current_user)

    total = await db.scalar(select(func.count(InviteCode.id)))
    total_uses = await db.scalar(select(func.sum(InviteCode.use_count)))

    # 本月统计
    month_start = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_uses = await db.scalar(
        select(func.sum(InviteCode.use_count)).where(InviteCode.created_at >= month_start)
    )

    # 渠道统计
    channels_result = await db.execute(
        select(
            InviteCode.channel,
            func.count(InviteCode.id).label("count"),
            func.sum(InviteCode.use_count).label("uses"),
        )
        .group_by(InviteCode.channel)
    )
    channels = [
        {"channel": c.channel, "count": c.count, "uses": c.uses or 0}
        for c in channels_result.all()
    ]

    return {
        "total_codes": total or 0,
        "total_uses": total_uses or 0,
        "month_uses": month_uses or 0,
        "channels": channels,
    }


# ============ Plaza (Content Review) API ============


@router.get("/plaza/pending")
async def list_pending_scenarios(
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取待审核场景列表"""
    require_admin(current_user)

    query = select(Scenario).where(
        Scenario.visibility == "pending",
        Scenario.is_template == False,  # noqa: E712
    )

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar() or 0

    query = (
        query.order_by(Scenario.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    scenarios = result.scalars().all()

    items = []
    for s in scenarios:
        creator_result = await db.execute(select(User).where(User.id == s.creator_id)) if s.creator_id else None
        creator = creator_result.scalar_one_or_none() if creator_result else None
        items.append({
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "track": s.track,
            "difficulty": s.difficulty,
            "creator": {
                "id": creator.id if creator else None,
                "nickname": creator.nickname if creator else "官方",
            },
            "created_at": s.created_at.isoformat() if s.created_at else None,
        })

    return {"total": total, "page": page, "page_size": page_size, "items": items}


@router.get("/plaza/approved")
async def list_approved_scenarios(
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取已上架场景列表"""
    require_admin(current_user)

    query = select(Scenario).where(
        Scenario.visibility == "public",
        Scenario.is_template == False,  # noqa: E712
    )

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar() or 0

    query = (
        query.order_by(Scenario.popularity_score.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    scenarios = result.scalars().all()

    items = []
    for s in scenarios:
        creator_result = await db.execute(select(User).where(User.id == s.creator_id)) if s.creator_id else None
        creator = creator_result.scalar_one_or_none() if creator_result else None
        items.append({
            "id": s.id,
            "name": s.name,
            "track": s.track,
            "difficulty": s.difficulty,
            "is_featured": s.is_featured,
            "likes_count": s.likes_count,
            "trains_count": s.trains_count,
            "creator": {
                "id": creator.id if creator else None,
                "nickname": creator.nickname if creator else "官方",
            },
            "created_at": s.created_at.isoformat() if s.created_at else None,
        })

    return {"total": total, "page": page, "page_size": page_size, "items": items}


@router.post("/plaza/{scenario_id}/approve")
async def approve_scenario(
    scenario_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """审核通过场景"""
    require_admin(current_user)

    result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
    scenario = result.scalar_one_or_none()

    if not scenario:
        raise HTTPException(status_code=404, detail="场景不存在")

    scenario.visibility = "public"
    await db.commit()

    return {"success": True, "message": "场景已审核通过"}


@router.post("/plaza/{scenario_id}/reject")
async def reject_scenario(
    scenario_id: str,
    reason: str = "",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """审核拒绝场景"""
    require_admin(current_user)

    result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
    scenario = result.scalar_one_or_none()

    if not scenario:
        raise HTTPException(status_code=404, detail="场景不存在")

    scenario.visibility = "private"
    await db.commit()

    return {"success": True, "message": "场景已拒绝", "reason": reason}


@router.post("/plaza/{scenario_id}/feature")
async def toggle_feature_scenario(
    scenario_id: str,
    featured: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """设置/取消精选场景"""
    require_admin(current_user)

    result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
    scenario = result.scalar_one_or_none()

    if not scenario:
        raise HTTPException(status_code=404, detail="场景不存在")

    scenario.is_featured = featured
    await db.commit()

    return {"success": True, "message": "已更新精选状态"}


@router.get("/plaza/reports")
async def list_scenario_reports(
    page: int = 1,
    page_size: int = 20,
    status: str = "pending",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取场景举报列表"""
    require_admin(current_user)

    query = select(ScenarioReport)

    if status:
        query = query.where(ScenarioReport.status == status)

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar() or 0

    query = (
        query.order_by(ScenarioReport.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    reports = result.scalars().all()

    items = []
    for r in reports:
        scenario_result = await db.execute(select(Scenario).where(Scenario.id == r.scenario_id))
        scenario = scenario_result.scalar_one_or_none()
        reporter_result = await db.execute(select(User).where(User.id == r.reporter_id))
        reporter = reporter_result.scalar_one_or_none()

        items.append({
            "id": r.id,
            "scenario": {
                "id": scenario.id if scenario else None,
                "name": scenario.name if scenario else "已删除",
            },
            "reporter": {
                "id": reporter.id if reporter else None,
                "nickname": reporter.nickname if reporter else "未知",
            },
            "reason": r.reason,
            "description": r.description,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return {"total": total, "page": page, "page_size": page_size, "items": items}


@router.post("/plaza/reports/{report_id}/handle")
async def handle_scenario_report(
    report_id: str,
    action: str,  # remove, warn, dismiss
    note: str = "",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """处理场景举报"""
    require_admin(current_user)

    result = await db.execute(select(ScenarioReport).where(ScenarioReport.id == report_id))
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(status_code=404, detail="举报不存在")

    report.status = "handled"
    report.result = action
    report.handle_note = note
    report.handled_by = current_user.id

    if action == "remove":
        # 下架场景
        await db.execute(
            update(Scenario).where(Scenario.id == report.scenario_id).values(visibility="private")
        )

    await db.commit()

    return {"success": True, "message": "举报已处理"}


@router.get("/plaza/stats")
async def get_plaza_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取广场统计"""
    require_admin(current_user)

    pending = await db.scalar(
        select(func.count(Scenario.id)).where(
            Scenario.visibility == "pending",
            Scenario.is_template == False  # noqa: E712
        )
    )
    approved = await db.scalar(
        select(func.count(Scenario.id)).where(
            Scenario.visibility == "public",
            Scenario.is_template == False  # noqa: E712
        )
    )
    featured = await db.scalar(
        select(func.count(Scenario.id)).where(
            Scenario.is_featured == True,  # noqa: E712
            Scenario.is_template == False  # noqa: E712
        )
    )
    pending_reports = await db.scalar(
        select(func.count(ScenarioReport.id)).where(ScenarioReport.status == "pending")
    )

    return {
        "pending": pending or 0,
        "approved": approved or 0,
        "featured": featured or 0,
        "pending_reports": pending_reports or 0,
    }


# ============ Training Plan Management API ============


@router.get("/plans")
async def list_training_plans(
    page: int = 1,
    page_size: int = 20,
    status: str = "",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取训练计划列表"""
    require_admin(current_user)

    query = select(TrainingPlan)

    if status:
        query = query.where(TrainingPlan.status == status)

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar() or 0

    query = (
        query.order_by(TrainingPlan.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    plans = result.scalars().all()

    items = []
    for p in plans:
        user_result = await db.execute(select(User).where(User.id == p.user_id))
        user = user_result.scalar_one_or_none()

        # 计算完成率
        total_tasks = sum(len(d.get("tasks", [])) for d in p.daily_tasks) if p.daily_tasks else 0
        completed = len(p.completed_tasks) if p.completed_tasks else 0
        progress = round(completed / total_tasks * 100 if total_tasks else 0, 1)

        items.append({
            "id": p.id,
            "name": p.name,
            "duration_days": p.duration_days,
            "current_day": p.current_day,
            "status": p.status,
            "progress": progress,
            "user": {
                "id": user.id if user else None,
                "nickname": user.nickname if user else "未知",
            },
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })

    return {"total": total, "page": page, "page_size": page_size, "items": items}


@router.get("/plans/stats")
async def get_plans_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取训练计划统计"""
    require_admin(current_user)

    total = await db.scalar(select(func.count(TrainingPlan.id)))
    active = await db.scalar(
        select(func.count(TrainingPlan.id)).where(TrainingPlan.status == "active")
    )
    completed = await db.scalar(
        select(func.count(TrainingPlan.id)).where(TrainingPlan.status == "completed")
    )

    # 平均完成率
    plans_result = await db.execute(select(TrainingPlan).where(TrainingPlan.status == "completed"))
    plans = plans_result.scalars().all()

    avg_completion = 0
    if plans:
        total_rate = 0
        for p in plans:
            total_tasks = sum(len(d.get("tasks", [])) for d in p.daily_tasks) if p.daily_tasks else 0
            completed_tasks = len(p.completed_tasks) if p.completed_tasks else 0
            if total_tasks:
                total_rate += completed_tasks / total_tasks
        avg_completion = round(total_rate / len(plans) * 100, 1)

    return {
        "total": total or 0,
        "active": active or 0,
        "completed": completed or 0,
        "avg_completion": avg_completion,
    }


# ============ Achievement Management API ============


class AchievementCreate(BaseModel):
    name: str
    description: str
    icon: str
    category: str
    condition: dict
    points_reward: int = 0
    rarity: str = "common"
    sort_order: int = 0


class AchievementUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    icon: str | None = None
    category: str | None = None
    condition: dict | None = None
    points_reward: int | None = None
    rarity: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


@router.get("/achievements")
async def list_achievements(
    page: int = 1,
    page_size: int = 20,
    category: str = "",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取成就列表"""
    require_admin(current_user)

    query = select(Achievement)

    if category:
        query = query.where(Achievement.category == category)

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar() or 0

    query = (
        query.order_by(Achievement.sort_order.asc(), Achievement.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    achievements = result.scalars().all()

    items = []
    for a in achievements:
        # 统计获得该成就的用户数
        unlock_count = await db.scalar(
            select(func.count(UserAchievement.id)).where(UserAchievement.achievement_id == a.id)
        )
        items.append({
            "id": a.id,
            "name": a.name,
            "description": a.description,
            "icon": a.icon,
            "category": a.category,
            "condition": a.condition,
            "points_reward": a.points_reward,
            "rarity": a.rarity,
            "sort_order": a.sort_order,
            "is_active": a.is_active,
            "unlock_count": unlock_count or 0,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })

    return {"total": total, "page": page, "page_size": page_size, "items": items}


@router.post("/achievements")
async def create_achievement(
    data: AchievementCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建成就"""
    require_admin(current_user)

    achievement = Achievement(
        name=data.name,
        description=data.description,
        icon=data.icon,
        category=data.category,
        condition=data.condition,
        points_reward=data.points_reward,
        rarity=data.rarity,
        sort_order=data.sort_order,
    )
    db.add(achievement)
    await db.commit()
    await db.refresh(achievement)

    return {"id": achievement.id, "message": "成就创建成功"}


@router.put("/achievements/{achievement_id}")
async def update_achievement(
    achievement_id: str,
    data: AchievementUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新成就"""
    require_admin(current_user)

    result = await db.execute(select(Achievement).where(Achievement.id == achievement_id))
    achievement = result.scalar_one_or_none()

    if not achievement:
        raise HTTPException(status_code=404, detail="成就不存在")

    if data.name is not None:
        achievement.name = data.name
    if data.description is not None:
        achievement.description = data.description
    if data.icon is not None:
        achievement.icon = data.icon
    if data.category is not None:
        achievement.category = data.category
    if data.condition is not None:
        achievement.condition = data.condition
    if data.points_reward is not None:
        achievement.points_reward = data.points_reward
    if data.rarity is not None:
        achievement.rarity = data.rarity
    if data.sort_order is not None:
        achievement.sort_order = data.sort_order
    if data.is_active is not None:
        achievement.is_active = data.is_active

    await db.commit()

    return {"success": True, "message": "成就已更新"}


@router.delete("/achievements/{achievement_id}")
async def delete_achievement(
    achievement_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除成就"""
    require_admin(current_user)

    await db.execute(delete(Achievement).where(Achievement.id == achievement_id))
    await db.commit()

    return {"success": True, "message": "成就已删除"}


@router.get("/achievements/stats")
async def get_achievements_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取成就统计"""
    require_admin(current_user)

    total = await db.scalar(select(func.count(Achievement.id)))
    active = await db.scalar(
        select(func.count(Achievement.id)).where(Achievement.is_active == True)  # noqa: E712
    )
    total_unlocks = await db.scalar(select(func.count(UserAchievement.id)))

    # 类别统计
    categories_result = await db.execute(
        select(
            Achievement.category,
            func.count(Achievement.id).label("count"),
        )
        .group_by(Achievement.category)
    )
    categories = [
        {"category": c.category, "count": c.count}
        for c in categories_result.all()
    ]

    return {
        "total": total or 0,
        "active": active or 0,
        "total_unlocks": total_unlocks or 0,
        "categories": categories,
    }


# ============ Payment Config API (支付配置管理) ============


@router.get("/settings/wechat-pay")
async def get_wechat_pay_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取微信支付配置"""
    require_admin(current_user)

    from app.services.system_config_service import SystemConfigService
    config_service = SystemConfigService(db)
    config = await config_service.get_wechat_pay_config_safe()
    return config


@router.put("/settings/wechat-pay")
async def update_wechat_pay_config(
    data: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新微信支付配置"""
    require_admin(current_user)

    from app.services.system_config_service import SystemConfigService
    config_service = SystemConfigService(db)
    await config_service.set_wechat_pay_config(data)
    return {"success": True, "message": "微信支付配置已更新"}


@router.get("/settings/alipay")
async def get_alipay_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取支付宝配置"""
    require_admin(current_user)

    from app.services.system_config_service import SystemConfigService
    config_service = SystemConfigService(db)
    config = await config_service.get_alipay_config_safe()
    return config


@router.put("/settings/alipay")
async def update_alipay_config(
    data: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新支付宝配置"""
    require_admin(current_user)

    from app.services.system_config_service import SystemConfigService
    config_service = SystemConfigService(db)
    await config_service.set_alipay_config(data)
    return {"success": True, "message": "支付宝配置已更新"}


@router.get("/settings/wechat-login")
async def get_wechat_login_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取微信登录配置"""
    require_admin(current_user)

    from app.services.system_config_service import SystemConfigService
    config_service = SystemConfigService(db)
    config = await config_service.get_wechat_login_config_safe()
    return config


@router.put("/settings/wechat-login")
async def update_wechat_login_config(
    data: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新微信登录配置"""
    require_admin(current_user)

    from app.services.system_config_service import SystemConfigService
    config_service = SystemConfigService(db)
    await config_service.set_wechat_login_config(data)
    return {"success": True, "message": "微信登录配置已更新"}


@router.get("/settings/payment")
async def get_payment_config_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取支付配置汇总"""
    require_admin(current_user)

    from app.services.system_config_service import SystemConfigService
    config_service = SystemConfigService(db)

    wechat_pay = await config_service.get_wechat_pay_config_safe()
    alipay = await config_service.get_alipay_config_safe()
    wechat_login = await config_service.get_wechat_login_config_safe()
    available_methods = await config_service.get_available_payment_methods()

    return {
        "wechat_pay": wechat_pay,
        "alipay": alipay,
        "wechat_login": wechat_login,
        "available_payment_methods": available_methods,
    }


@router.get("/public/payment-methods")
async def get_public_payment_methods(
    db: AsyncSession = Depends(get_db),
):
    """获取可用支付方式（公开接口，供前端使用）"""
    from app.services.system_config_service import SystemConfigService
    config_service = SystemConfigService(db)
    methods = await config_service.get_available_payment_methods()
    wechat_login_enabled = await config_service.is_wechat_login_enabled()
    return {
        "payment_methods": methods,
        "wechat_login_enabled": wechat_login_enabled,
    }


# ============ Points Consumption Config API (积分消耗配置管理) ============


class PointsConsumptionConfigUpdate(BaseModel):
    """积分消耗配置更新"""
    points_per_text_session: int | None = None
    points_per_voice_session: int | None = None
    free_sessions_by_level: dict[str, int] | None = None
    vip_discount_rates: dict[str, int] | None = None
    scenario_multipliers: dict[str, float] | None = None


@router.get("/settings/points-consumption")
async def get_points_consumption_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取积分消耗配置"""
    require_admin(current_user)

    from app.services.system_config_service import SystemConfigService
    config_service = SystemConfigService(db)
    config = await config_service.get_points_consumption_config()
    return config


@router.put("/settings/points-consumption")
async def update_points_consumption_config(
    data: PointsConsumptionConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新积分消耗配置"""
    require_admin(current_user)

    from app.services.system_config_service import SystemConfigService
    config_service = SystemConfigService(db)
    
    # 只更新提供的字段
    updates = {}
    if data.points_per_text_session is not None:
        updates["points_per_text_session"] = data.points_per_text_session
    if data.points_per_voice_session is not None:
        updates["points_per_voice_session"] = data.points_per_voice_session
    if data.free_sessions_by_level is not None:
        updates["free_sessions_by_level"] = data.free_sessions_by_level
    if data.vip_discount_rates is not None:
        updates["vip_discount_rates"] = data.vip_discount_rates
    if data.scenario_multipliers is not None:
        updates["scenario_multipliers"] = data.scenario_multipliers
    
    if updates:
        await config_service.set_points_consumption_config(updates)
    
    return {"success": True, "message": "积分消耗配置已更新"}


@router.get("/settings/points-consumption/preview")
async def preview_points_consumption(
    session_type: str = "text",
    scenario_type: str = "basic",
    membership_level: str = "free",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """预览积分消耗计算结果"""
    require_admin(current_user)

    from app.services.system_config_service import SystemConfigService
    config_service = SystemConfigService(db)
    
    points_cost = await config_service.get_session_points_cost(
        session_type=session_type,
        scenario_type=scenario_type,
        membership_level=membership_level,
    )
    daily_free = await config_service.get_daily_free_sessions(membership_level)
    
    return {
        "session_type": session_type,
        "scenario_type": scenario_type,
        "membership_level": membership_level,
        "points_cost": points_cost,
        "daily_free_sessions": daily_free,
        "is_unlimited": daily_free == -1,
    }


# ============ Redeem Code Management API (兑换码管理) ============


@router.get("/redeem-codes")
async def list_redeem_codes(
    page: int = 1,
    page_size: int = 20,
    reward_type: str = "",
    is_active: bool | None = None,
    batch_id: str = "",
    search: str = "",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取兑换码列表"""
    require_admin(current_user)

    from app.services.redeem_code_service import RedeemCodeService
    from app.schemas.redeem_code import RedeemCodeResponse

    service = RedeemCodeService(db)
    codes, total = await service.list_codes(
        page=page,
        page_size=page_size,
        reward_type=reward_type or None,
        is_active=is_active,
        batch_id=batch_id or None,
        search=search or None,
    )

    items = []
    for code in codes:
        items.append({
            "id": code.id,
            "code": code.code,
            "reward_type": code.reward_type,
            "reward_value": code.reward_value,
            "vip_level": code.vip_level,
            "usage_limit": code.usage_limit,
            "used_count": code.used_count,
            "per_user_limit": code.per_user_limit,
            "valid_from": code.valid_from.isoformat() if code.valid_from else None,
            "valid_until": code.valid_until.isoformat() if code.valid_until else None,
            "is_active": code.is_active,
            "description": code.description,
            "batch_id": code.batch_id,
            "created_by": code.created_by,
            "created_at": code.created_at.isoformat() if code.created_at else None,
            "updated_at": code.updated_at.isoformat() if code.updated_at else None,
            "remaining_uses": code.remaining_uses,
            "is_valid": code.is_valid,
            "is_expired": code.is_expired,
            "is_exhausted": code.is_exhausted,
        })

    total_pages = (total + page_size - 1) // page_size

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.post("/redeem-codes")
async def create_redeem_code(
    data: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建兑换码"""
    require_admin(current_user)

    from app.services.redeem_code_service import RedeemCodeService
    from datetime import datetime

    service = RedeemCodeService(db)

    # 解析日期
    valid_from = None
    if data.get("valid_from"):
        valid_from = datetime.fromisoformat(data["valid_from"].replace("Z", "+00:00"))
    
    valid_until = datetime.fromisoformat(data["valid_until"].replace("Z", "+00:00"))

    try:
        code = await service.create_code(
            code=data.get("code"),
            reward_type=data["reward_type"],
            reward_value=data["reward_value"],
            vip_level=data.get("vip_level"),
            usage_limit=data.get("usage_limit", 1),
            per_user_limit=data.get("per_user_limit", 1),
            valid_from=valid_from,
            valid_until=valid_until,
            description=data.get("description"),
            created_by=current_user.id,
        )
        return {
            "id": code.id,
            "code": code.code,
            "message": "兑换码创建成功",
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/redeem-codes/batch")
async def batch_create_redeem_codes(
    data: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """批量创建兑换码"""
    require_admin(current_user)

    from app.services.redeem_code_service import RedeemCodeService
    from datetime import datetime

    service = RedeemCodeService(db)

    count = data.get("count", 10)
    if count < 1 or count > 1000:
        raise HTTPException(status_code=400, detail="批量生成数量必须在1-1000之间")

    # 解析日期
    valid_from = None
    if data.get("valid_from"):
        valid_from = datetime.fromisoformat(data["valid_from"].replace("Z", "+00:00"))
    
    valid_until = datetime.fromisoformat(data["valid_until"].replace("Z", "+00:00"))

    batch_id, codes = await service.batch_create_codes(
        count=count,
        prefix=data.get("prefix"),
        reward_type=data["reward_type"],
        reward_value=data["reward_value"],
        vip_level=data.get("vip_level"),
        usage_limit=data.get("usage_limit", 1),
        per_user_limit=data.get("per_user_limit", 1),
        valid_from=valid_from,
        valid_until=valid_until,
        description=data.get("description"),
        created_by=current_user.id,
    )

    return {
        "batch_id": batch_id,
        "count": len(codes),
        "codes": codes,
        "message": f"成功生成 {len(codes)} 个兑换码",
    }


@router.put("/redeem-codes/{code_id}")
async def update_redeem_code(
    code_id: str,
    data: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新兑换码"""
    require_admin(current_user)

    from app.services.redeem_code_service import RedeemCodeService
    from datetime import datetime

    service = RedeemCodeService(db)

    # 处理日期字段
    updates = {}
    for key in ["reward_type", "reward_value", "vip_level", "usage_limit", 
                "per_user_limit", "is_active", "description"]:
        if key in data and data[key] is not None:
            updates[key] = data[key]

    if "valid_from" in data and data["valid_from"]:
        updates["valid_from"] = datetime.fromisoformat(data["valid_from"].replace("Z", "+00:00"))
    if "valid_until" in data and data["valid_until"]:
        updates["valid_until"] = datetime.fromisoformat(data["valid_until"].replace("Z", "+00:00"))

    code = await service.update_code(code_id, **updates)
    if not code:
        raise HTTPException(status_code=404, detail="兑换码不存在")

    return {"success": True, "message": "兑换码已更新"}


@router.delete("/redeem-codes/{code_id}")
async def delete_redeem_code(
    code_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除兑换码"""
    require_admin(current_user)

    from app.services.redeem_code_service import RedeemCodeService

    service = RedeemCodeService(db)
    success = await service.delete_code(code_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="兑换码不存在")

    return {"success": True, "message": "兑换码已删除"}


@router.put("/redeem-codes/{code_id}/disable")
async def disable_redeem_code(
    code_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """禁用兑换码"""
    require_admin(current_user)

    from app.services.redeem_code_service import RedeemCodeService

    service = RedeemCodeService(db)
    code = await service.disable_code(code_id)
    
    if not code:
        raise HTTPException(status_code=404, detail="兑换码不存在")

    return {"success": True, "message": "兑换码已禁用"}


@router.put("/redeem-codes/{code_id}/enable")
async def enable_redeem_code(
    code_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """启用兑换码"""
    require_admin(current_user)

    from app.services.redeem_code_service import RedeemCodeService

    service = RedeemCodeService(db)
    code = await service.enable_code(code_id)
    
    if not code:
        raise HTTPException(status_code=404, detail="兑换码不存在")

    return {"success": True, "message": "兑换码已启用"}


@router.get("/redeem-codes/statistics")
async def get_redeem_code_statistics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取兑换码统计"""
    require_admin(current_user)

    from app.services.redeem_code_service import RedeemCodeService

    service = RedeemCodeService(db)
    stats = await service.get_statistics()
    return stats


@router.get("/redeem-codes/export")
async def export_redeem_codes(
    batch_id: str = "",
    reward_type: str = "",
    is_active: bool | None = None,
    include_used: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """导出兑换码"""
    require_admin(current_user)

    from app.services.redeem_code_service import RedeemCodeService

    service = RedeemCodeService(db)
    codes = await service.export_codes(
        batch_id=batch_id or None,
        reward_type=reward_type or None,
        is_active=is_active,
        include_used=include_used,
    )
    return {"codes": codes, "count": len(codes)}


@router.get("/redeem-codes/logs")
async def list_redeem_logs(
    page: int = 1,
    page_size: int = 20,
    code_id: str = "",
    user_id: str = "",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取兑换记录"""
    require_admin(current_user)

    from app.services.redeem_code_service import RedeemCodeService

    service = RedeemCodeService(db)
    logs, total = await service.get_redeem_logs(
        page=page,
        page_size=page_size,
        code_id=code_id or None,
        user_id=user_id or None,
    )

    items = []
    for log in logs:
        # 获取用户信息
        user_result = await db.execute(select(User).where(User.id == log.user_id))
        user = user_result.scalar_one_or_none()

        items.append({
            "id": log.id,
            "code_id": log.code_id,
            "code": log.redeem_code.code if log.redeem_code else None,
            "user_id": log.user_id,
            "user_nickname": user.nickname if user else None,
            "reward_type": log.reward_type,
            "reward_value": log.reward_value,
            "vip_extended_to": log.vip_extended_to.isoformat() if log.vip_extended_to else None,
            "points_added": log.points_added,
            "redeemed_at": log.redeemed_at.isoformat() if log.redeemed_at else None,
            "ip_address": log.ip_address,
        })

    total_pages = (total + page_size - 1) // page_size

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


# ============ Coupon Management API (优惠券管理) ============


class CouponCreate(BaseModel):
    """创建优惠券"""
    code: str | None = None
    name: str
    description: str | None = None
    type: str  # fixed, percentage
    value: int  # 固定金额(分)或折扣百分比
    max_discount: int | None = None  # 最大折扣金额(分)，仅百分比类型
    min_order_amount: int = 0  # 最低订单金额(分)
    applicable_products: list[str] | None = None  # 适用商品类型
    valid_from: datetime
    valid_until: datetime
    usage_limit: int = -1  # -1表示无限
    per_user_limit: int = 1
    user_ids: list[str] | None = None  # 指定用户


class CouponUpdate(BaseModel):
    """更新优惠券"""
    name: str | None = None
    description: str | None = None
    type: str | None = None
    value: int | None = None
    max_discount: int | None = None
    min_order_amount: int | None = None
    applicable_products: list[str] | None = None
    valid_from: datetime | None = None
    valid_until: datetime | None = None
    usage_limit: int | None = None
    per_user_limit: int | None = None
    user_ids: list[str] | None = None
    is_active: bool | None = None


@router.get("/coupons")
async def list_coupons(
    page: int = 1,
    page_size: int = 20,
    status: str = "",  # active, expired, disabled
    type: str = "",  # fixed, percentage
    search: str = "",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取优惠券列表"""
    require_admin(current_user)

    from app.services.coupon_service import CouponService
    from app.models.coupon import Coupon

    service = CouponService(db)
    
    # 构建查询
    query = select(Coupon)
    
    now = datetime.utcnow()
    if status == "active":
        query = query.where(
            Coupon.is_active == True,
            Coupon.valid_from <= now,
            Coupon.valid_until >= now,
        )
    elif status == "expired":
        query = query.where(Coupon.valid_until < now)
    elif status == "disabled":
        query = query.where(Coupon.is_active == False)
    
    if type:
        query = query.where(Coupon.type == type)
    
    if search:
        query = query.where(
            or_(
                Coupon.code.ilike(f"%{search}%"),
                Coupon.name.ilike(f"%{search}%"),
            )
        )
    
    # 计算总数
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0
    
    # 分页
    query = query.order_by(Coupon.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    
    result = await db.execute(query)
    coupons = result.scalars().all()
    
    items = []
    for c in coupons:
        # 计算状态
        coupon_status = "active"
        if not c.is_active:
            coupon_status = "disabled"
        elif c.valid_until < now:
            coupon_status = "expired"
        elif c.valid_from > now:
            coupon_status = "pending"
        
        items.append({
            "id": c.id,
            "code": c.code,
            "name": c.name,
            "description": c.description,
            "type": c.type,
            "value": c.value,
            "max_discount": c.max_discount,
            "min_order_amount": c.min_order_amount,
            "applicable_products": c.applicable_products,
            "valid_from": c.valid_from.isoformat() if c.valid_from else None,
            "valid_until": c.valid_until.isoformat() if c.valid_until else None,
            "usage_limit": c.usage_limit,
            "used_count": c.used_count,
            "per_user_limit": c.per_user_limit,
            "user_ids": c.user_ids,
            "is_active": c.is_active,
            "status": coupon_status,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })
    
    total_pages = (total + page_size - 1) // page_size
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.post("/coupons")
async def create_coupon(
    data: CouponCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建优惠券"""
    require_admin(current_user)

    from app.services.coupon_service import CouponService

    service = CouponService(db)
    
    try:
        coupon = await service.create_coupon(
            name=data.name,
            coupon_type=data.type,
            value=data.value,
            valid_from=data.valid_from,
            valid_until=data.valid_until,
            code=data.code,
            description=data.description,
            max_discount=data.max_discount,
            min_order_amount=data.min_order_amount,
            applicable_products=data.applicable_products,
            usage_limit=data.usage_limit,
            per_user_limit=data.per_user_limit,
            user_ids=data.user_ids,
        )
        return {
            "id": coupon.id,
            "code": coupon.code,
            "message": "优惠券创建成功",
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/coupons/{coupon_id}")
async def get_coupon(
    coupon_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取优惠券详情"""
    require_admin(current_user)

    from app.services.coupon_service import CouponService

    service = CouponService(db)
    coupon = await service.get_coupon_by_id(coupon_id)
    
    if not coupon:
        raise HTTPException(status_code=404, detail="优惠券不存在")
    
    now = datetime.utcnow()
    coupon_status = "active"
    if not coupon.is_active:
        coupon_status = "disabled"
    elif coupon.valid_until < now:
        coupon_status = "expired"
    elif coupon.valid_from > now:
        coupon_status = "pending"
    
    return {
        "id": coupon.id,
        "code": coupon.code,
        "name": coupon.name,
        "description": coupon.description,
        "type": coupon.type,
        "value": coupon.value,
        "max_discount": coupon.max_discount,
        "min_order_amount": coupon.min_order_amount,
        "applicable_products": coupon.applicable_products,
        "valid_from": coupon.valid_from.isoformat() if coupon.valid_from else None,
        "valid_until": coupon.valid_until.isoformat() if coupon.valid_until else None,
        "usage_limit": coupon.usage_limit,
        "used_count": coupon.used_count,
        "per_user_limit": coupon.per_user_limit,
        "user_ids": coupon.user_ids,
        "is_active": coupon.is_active,
        "status": coupon_status,
        "created_at": coupon.created_at.isoformat() if coupon.created_at else None,
    }


@router.put("/coupons/{coupon_id}")
async def update_coupon(
    coupon_id: str,
    data: CouponUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新优惠券"""
    require_admin(current_user)

    from app.services.coupon_service import CouponService

    service = CouponService(db)
    
    updates = {}
    for field in ["name", "description", "type", "value", "max_discount", 
                  "min_order_amount", "applicable_products", "valid_from",
                  "valid_until", "usage_limit", "per_user_limit", "user_ids", "is_active"]:
        value = getattr(data, field, None)
        if value is not None:
            updates[field] = value
    
    coupon = await service.update_coupon(coupon_id, updates)
    
    if not coupon:
        raise HTTPException(status_code=404, detail="优惠券不存在")
    
    return {"success": True, "message": "优惠券已更新"}


@router.delete("/coupons/{coupon_id}")
async def delete_coupon(
    coupon_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除优惠券"""
    require_admin(current_user)

    from app.models.coupon import Coupon

    result = await db.execute(select(Coupon).where(Coupon.id == coupon_id))
    coupon = result.scalar_one_or_none()
    
    if not coupon:
        raise HTTPException(status_code=404, detail="优惠券不存在")
    
    # 检查是否有用户已领取
    if coupon.used_count > 0:
        raise HTTPException(status_code=400, detail="优惠券已被领取，无法删除，请禁用")
    
    await db.delete(coupon)
    await db.commit()
    
    return {"success": True, "message": "优惠券已删除"}


@router.put("/coupons/{coupon_id}/disable")
async def disable_coupon(
    coupon_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """禁用优惠券"""
    require_admin(current_user)

    from app.services.coupon_service import CouponService

    service = CouponService(db)
    coupon = await service.update_coupon(coupon_id, {"is_active": False})
    
    if not coupon:
        raise HTTPException(status_code=404, detail="优惠券不存在")
    
    return {"success": True, "message": "优惠券已禁用"}


@router.put("/coupons/{coupon_id}/enable")
async def enable_coupon(
    coupon_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """启用优惠券"""
    require_admin(current_user)

    from app.services.coupon_service import CouponService

    service = CouponService(db)
    coupon = await service.update_coupon(coupon_id, {"is_active": True})
    
    if not coupon:
        raise HTTPException(status_code=404, detail="优惠券不存在")
    
    return {"success": True, "message": "优惠券已启用"}


@router.get("/coupons/statistics")
async def get_coupon_statistics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取优惠券统计"""
    require_admin(current_user)

    from app.models.coupon import Coupon, UserCoupon

    now = datetime.utcnow()
    
    # 总数
    total = await db.scalar(select(func.count(Coupon.id)))
    
    # 有效数量
    active = await db.scalar(
        select(func.count(Coupon.id)).where(
            Coupon.is_active == True,
            Coupon.valid_from <= now,
            Coupon.valid_until >= now,
        )
    )
    
    # 已过期
    expired = await db.scalar(
        select(func.count(Coupon.id)).where(Coupon.valid_until < now)
    )
    
    # 已禁用
    disabled = await db.scalar(
        select(func.count(Coupon.id)).where(Coupon.is_active == False)
    )
    
    # 总领取数
    total_claimed = await db.scalar(select(func.count(UserCoupon.id)))
    
    # 总使用数
    total_used = await db.scalar(
        select(func.count(UserCoupon.id)).where(UserCoupon.status == "used")
    )
    
    # 本月新增
    month_start = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_created = await db.scalar(
        select(func.count(Coupon.id)).where(Coupon.created_at >= month_start)
    )
    
    return {
        "total": total or 0,
        "active": active or 0,
        "expired": expired or 0,
        "disabled": disabled or 0,
        "total_claimed": total_claimed or 0,
        "total_used": total_used or 0,
        "month_created": month_created or 0,
        "usage_rate": round((total_used or 0) / (total_claimed or 1) * 100, 1),
    }


# ============ VIP Level Management API (VIP套餐管理) ============


class VipLevelUpdate(BaseModel):
    """更新VIP套餐"""
    display_name: str | None = None
    description: str | None = None
    monthly_price: int | None = None
    quarterly_price: int | None = None
    half_yearly_price: int | None = None
    yearly_price: int | None = None
    privileges: dict[str, Any] | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class VipLevelCreate(BaseModel):
    """创建VIP套餐"""
    name: str  # 唯一标识，如 basic, pro, enterprise
    display_name: str  # 显示名称
    description: str | None = None
    monthly_price: int = 0
    quarterly_price: int = 0
    half_yearly_price: int = 0
    yearly_price: int = 0
    privileges: dict[str, Any] = {}
    sort_order: int = 0


@router.get("/vip/levels")
async def list_vip_levels(
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取VIP套餐列表"""
    require_admin(current_user)

    from app.services.vip_service import VIPService
    from app.models.membership import MembershipLevel, Subscription, SubscriptionStatus

    service = VIPService(db)
    levels = await service.get_all_levels(active_only=not include_inactive)
    
    items = []
    for level in levels:
        # 统计订阅数
        active_subs = await db.scalar(
            select(func.count(Subscription.id)).where(
                Subscription.level_id == level.id,
                Subscription.status == SubscriptionStatus.ACTIVE.value,
            )
        )
        total_subs = await db.scalar(
            select(func.count(Subscription.id)).where(
                Subscription.level_id == level.id,
            )
        )
        
        items.append({
            "id": level.id,
            "name": level.name,
            "display_name": level.display_name,
            "description": level.description,
            "monthly_price": level.price_monthly,
            "quarterly_price": level.price_quarterly,
            "half_yearly_price": level.price_half_yearly,
            "yearly_price": level.price_yearly,
            "privileges": level.privileges,
            "is_active": level.is_active,
            "sort_order": level.sort_order,
            "active_subscriptions": active_subs or 0,
            "total_subscriptions": total_subs or 0,
            "created_at": level.created_at.isoformat() if level.created_at else None,
        })
    
    return {"items": items, "total": len(items)}


@router.post("/vip/levels")
async def create_vip_level(
    data: VipLevelCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建VIP套餐"""
    require_admin(current_user)

    from uuid import uuid4
    from app.models.membership import MembershipLevel

    # 检查名称是否已存在
    existing = await db.execute(
        select(MembershipLevel).where(MembershipLevel.name == data.name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="套餐标识已存在")

    # 创建新套餐
    level = MembershipLevel(
        id=str(uuid4()),
        name=data.name,
        display_name=data.display_name,
        description=data.description,
        price_monthly=data.monthly_price,
        price_quarterly=data.quarterly_price,
        price_half_yearly=data.half_yearly_price,
        price_yearly=data.yearly_price,
        privileges=data.privileges or {
            "daily_training_limit": 3,
            "voice_training_enabled": False,
            "advanced_scenarios_enabled": False,
            "custom_scenarios_limit": 0,
            "report_export_enabled": False,
            "priority_support": False,
            "ai_coach_enabled": False,
        },
        sort_order=data.sort_order,
        is_active=True,
    )
    db.add(level)
    await db.commit()
    await db.refresh(level)

    return {
        "success": True,
        "message": "VIP套餐创建成功",
        "id": level.id,
    }


@router.get("/vip/levels/{level_id}")
async def get_vip_level(
    level_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取VIP套餐详情"""
    require_admin(current_user)

    from app.services.vip_service import VIPService
    from app.models.membership import Subscription, SubscriptionStatus

    service = VIPService(db)
    level = await service.get_level_by_id(level_id)
    
    if not level:
        raise HTTPException(status_code=404, detail="VIP套餐不存在")
    
    # 统计订阅数
    active_subs = await db.scalar(
        select(func.count(Subscription.id)).where(
            Subscription.level_id == level.id,
            Subscription.status == SubscriptionStatus.ACTIVE.value,
        )
    )
    total_subs = await db.scalar(
        select(func.count(Subscription.id)).where(
            Subscription.level_id == level.id,
        )
    )
    
    return {
        "id": level.id,
        "name": level.name,
        "display_name": level.display_name,
        "description": level.description,
        "monthly_price": level.price_monthly,
        "quarterly_price": level.price_quarterly,
        "half_yearly_price": level.price_half_yearly,
        "yearly_price": level.price_yearly,
        "privileges": level.privileges,
        "is_active": level.is_active,
        "sort_order": level.sort_order,
        "active_subscriptions": active_subs or 0,
        "total_subscriptions": total_subs or 0,
        "created_at": level.created_at.isoformat() if level.created_at else None,
    }


@router.put("/vip/levels/{level_id}")
async def update_vip_level(
    level_id: str,
    data: VipLevelUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新VIP套餐"""
    require_admin(current_user)

    from app.models.membership import MembershipLevel

    result = await db.execute(
        select(MembershipLevel).where(MembershipLevel.id == level_id)
    )
    level = result.scalar_one_or_none()
    
    if not level:
        raise HTTPException(status_code=404, detail="VIP套餐不存在")
    
    # 更新字段
    if data.display_name is not None:
        level.display_name = data.display_name
    if data.description is not None:
        level.description = data.description
    if data.monthly_price is not None:
        level.price_monthly = data.monthly_price
    if data.quarterly_price is not None:
        level.price_quarterly = data.quarterly_price
    if data.half_yearly_price is not None:
        level.price_half_yearly = data.half_yearly_price
    if data.yearly_price is not None:
        level.price_yearly = data.yearly_price
    if data.privileges is not None:
        level.privileges = data.privileges
    if data.is_active is not None:
        level.is_active = data.is_active
    if data.sort_order is not None:
        level.sort_order = data.sort_order
    
    await db.commit()
    
    return {"success": True, "message": "VIP套餐已更新"}


@router.put("/vip/levels/{level_id}/disable")
async def disable_vip_level(
    level_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """禁用VIP套餐"""
    require_admin(current_user)

    from app.models.membership import MembershipLevel, MembershipLevelName

    result = await db.execute(
        select(MembershipLevel).where(MembershipLevel.id == level_id)
    )
    level = result.scalar_one_or_none()
    
    if not level:
        raise HTTPException(status_code=404, detail="VIP套餐不存在")
    
    # 不能禁用免费套餐
    if level.name == MembershipLevelName.FREE.value:
        raise HTTPException(status_code=400, detail="不能禁用免费套餐")
    
    level.is_active = False
    await db.commit()
    
    return {"success": True, "message": "VIP套餐已禁用"}


@router.put("/vip/levels/{level_id}/enable")
async def enable_vip_level(
    level_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """启用VIP套餐"""
    require_admin(current_user)

    from app.models.membership import MembershipLevel

    result = await db.execute(
        select(MembershipLevel).where(MembershipLevel.id == level_id)
    )
    level = result.scalar_one_or_none()
    
    if not level:
        raise HTTPException(status_code=404, detail="VIP套餐不存在")
    
    level.is_active = True
    await db.commit()
    
    return {"success": True, "message": "VIP套餐已启用"}


@router.delete("/vip/levels/{level_id}")
async def delete_vip_level(
    level_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除VIP套餐"""
    require_admin(current_user)

    from app.models.membership import MembershipLevel, Subscription

    result = await db.execute(
        select(MembershipLevel).where(MembershipLevel.id == level_id)
    )
    level = result.scalar_one_or_none()
    
    if not level:
        raise HTTPException(status_code=404, detail="VIP套餐不存在")
    
    # 不能删除免费套餐
    if level.name == "free":
        raise HTTPException(status_code=400, detail="不能删除免费套餐")
    
    # 检查是否有用户订阅
    active_subs = await db.scalar(
        select(func.count(Subscription.id)).where(
            Subscription.level_id == level_id,
            Subscription.status == "active",
        )
    )
    if active_subs and active_subs > 0:
        raise HTTPException(status_code=400, detail=f"该套餐还有 {active_subs} 个活跃订阅，无法删除")
    
    await db.delete(level)
    await db.commit()
    
    return {"success": True, "message": "VIP套餐已删除"}


@router.get("/vip/statistics")
async def get_vip_statistics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取VIP统计"""
    require_admin(current_user)

    from app.models.membership import MembershipLevel, Subscription, SubscriptionStatus, MembershipLevelName

    now = datetime.utcnow()
    
    # 总VIP用户数（排除免费用户）
    free_level = await db.execute(
        select(MembershipLevel).where(MembershipLevel.name == MembershipLevelName.FREE.value)
    )
    free_level = free_level.scalar_one_or_none()
    
    total_vip = await db.scalar(
        select(func.count(Subscription.id)).where(
            Subscription.status == SubscriptionStatus.ACTIVE.value,
            Subscription.expires_at > now,
            Subscription.level_id != free_level.id if free_level else True,
        )
    )
    
    # 本月新增VIP
    month_start = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_new_vip = await db.scalar(
        select(func.count(Subscription.id)).where(
            Subscription.created_at >= month_start,
            Subscription.level_id != free_level.id if free_level else True,
        )
    )
    
    # 即将到期（7天内）
    expiring_soon = await db.scalar(
        select(func.count(Subscription.id)).where(
            Subscription.status == SubscriptionStatus.ACTIVE.value,
            Subscription.expires_at > now,
            Subscription.expires_at <= now + timedelta(days=7),
        )
    )
    
    # 各等级分布
    levels_result = await db.execute(
        select(
            MembershipLevel.display_name,
            func.count(Subscription.id).label("count"),
        )
        .join(Subscription, Subscription.level_id == MembershipLevel.id)
        .where(
            Subscription.status == SubscriptionStatus.ACTIVE.value,
            Subscription.expires_at > now,
        )
        .group_by(MembershipLevel.id, MembershipLevel.display_name)
    )
    level_distribution = [
        {"level": r.display_name, "count": r.count}
        for r in levels_result.all()
    ]
    
    # 续费率（本月到期且续费的比例）
    month_expired = await db.scalar(
        select(func.count(Subscription.id)).where(
            Subscription.expires_at >= month_start,
            Subscription.expires_at < now,
        )
    )
    # 简化计算：假设续费用户是本月新增中的续费
    renewal_rate = 0.0
    if month_expired and month_expired > 0:
        renewal_rate = min(100.0, round((month_new_vip or 0) / month_expired * 100, 1))
    
    return {
        "total_vip": total_vip or 0,
        "month_new_vip": month_new_vip or 0,
        "expiring_soon": expiring_soon or 0,
        "renewal_rate": renewal_rate,
        "level_distribution": level_distribution,
    }


@router.post("/vip/users/{user_id}/extend")
async def extend_user_vip(
    user_id: str,
    days: int,
    reason: str = "admin_extend",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """延长用户VIP时间"""
    require_admin(current_user)

    from app.services.vip_service import VIPService

    service = VIPService(db)
    subscription = await service.extend_subscription(user_id, days, reason)
    
    if not subscription:
        raise HTTPException(status_code=404, detail="用户没有有效订阅")
    
    return {
        "success": True,
        "message": f"已延长 {days} 天",
        "new_expires_at": subscription.expires_at.isoformat(),
    }


@router.post("/vip/users/{user_id}/cancel")
async def cancel_user_vip(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """取消用户VIP"""
    require_admin(current_user)

    from app.services.vip_service import VIPService

    service = VIPService(db)
    subscription = await service.cancel_subscription(user_id)
    
    if not subscription:
        raise HTTPException(status_code=404, detail="用户没有有效订阅")
    
    return {"success": True, "message": "用户VIP已取消"}


# ============ Order Management API (订单管理) ============


@router.get("/orders")
async def list_orders(
    page: int = 1,
    page_size: int = 20,
    status: str = "",
    payment_method: str = "",
    product_type: str = "",
    user_id: str = "",
    search: str = "",
    start_date: str = "",
    end_date: str = "",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取订单列表"""
    require_admin(current_user)

    from app.models.order import Order

    query = select(Order)
    
    if status:
        query = query.where(Order.status == status)
    if payment_method:
        query = query.where(Order.payment_method == payment_method)
    if product_type:
        query = query.where(Order.product_type == product_type)
    if user_id:
        query = query.where(Order.user_id == user_id)
    if search:
        query = query.where(
            or_(
                Order.order_no.ilike(f"%{search}%"),
                Order.product_name.ilike(f"%{search}%"),
            )
        )
    if start_date:
        start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        query = query.where(Order.created_at >= start)
    if end_date:
        end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        query = query.where(Order.created_at <= end)
    
    # 计算总数
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0
    
    # 分页
    query = query.order_by(Order.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    
    result = await db.execute(query)
    orders = result.scalars().all()
    
    items = []
    for o in orders:
        # 获取用户信息
        user_result = await db.execute(select(User).where(User.id == o.user_id))
        user = user_result.scalar_one_or_none()
        
        items.append({
            "id": o.id,
            "order_no": o.order_no,
            "user_id": o.user_id,
            "user_nickname": user.nickname if user else None,
            "user_phone": user.phone if user else None,
            "product_type": o.product_type,
            "product_id": o.product_id,
            "product_name": o.product_name,
            "product_desc": o.product_desc,
            "original_amount": o.original_amount,
            "discount_amount": o.discount_amount,
            "points_discount": o.points_discount,
            "final_amount": o.final_amount,
            "coupon_id": o.coupon_id,
            "coupon_code": o.coupon_code,
            "points_used": o.points_used,
            "status": o.status,
            "payment_method": o.payment_method,
            "payment_channel": o.payment_channel,
            "transaction_id": o.transaction_id,
            "paid_at": o.paid_at.isoformat() if o.paid_at else None,
            "cancelled_at": o.cancelled_at.isoformat() if o.cancelled_at else None,
            "expires_at": o.expires_at.isoformat() if o.expires_at else None,
            "created_at": o.created_at.isoformat() if o.created_at else None,
        })
    
    total_pages = (total + page_size - 1) // page_size
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.get("/orders/{order_id}")
async def get_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取订单详情"""
    require_admin(current_user)

    from app.services.order_service import OrderService

    service = OrderService(db)
    order = await service.get_order_by_id(order_id)
    
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    
    # 获取用户信息
    user_result = await db.execute(select(User).where(User.id == order.user_id))
    user = user_result.scalar_one_or_none()
    
    # 获取退款记录
    refunds = await service.get_order_refunds(order_id)
    
    return {
        "id": order.id,
        "order_no": order.order_no,
        "user": {
            "id": user.id if user else None,
            "nickname": user.nickname if user else None,
            "phone": user.phone if user else None,
            "avatar": user.avatar if user else None,
        },
        "product_type": order.product_type,
        "product_id": order.product_id,
        "product_name": order.product_name,
        "product_desc": order.product_desc,
        "original_amount": order.original_amount,
        "discount_amount": order.discount_amount,
        "points_discount": order.points_discount,
        "final_amount": order.final_amount,
        "coupon_id": order.coupon_id,
        "coupon_code": order.coupon_code,
        "points_used": order.points_used,
        "status": order.status,
        "payment_method": order.payment_method,
        "payment_channel": order.payment_channel,
        "transaction_id": order.transaction_id,
        "paid_at": order.paid_at.isoformat() if order.paid_at else None,
        "cancelled_at": order.cancelled_at.isoformat() if order.cancelled_at else None,
        "expires_at": order.expires_at.isoformat() if order.expires_at else None,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "refunds": [
            {
                "id": r.id,
                "refund_no": r.refund_no,
                "amount": r.amount,
                "reason": r.reason,
                "status": r.status,
                "processed_at": r.processed_at.isoformat() if r.processed_at else None,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in refunds
        ],
    }


@router.put("/orders/{order_id}/mark-paid")
async def mark_order_paid(
    order_id: str,
    transaction_id: str = "",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """手动标记订单已支付"""
    require_admin(current_user)

    from app.services.order_service import OrderService
    from app.services.vip_service import VIPService
    from app.models.order import ProductType

    service = OrderService(db)
    order = await service.get_order_by_id(order_id)
    
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    
    if order.status not in ["pending", "paying"]:
        raise HTTPException(status_code=400, detail=f"订单状态为 {order.status}，无法标记已支付")
    
    # 更新订单状态
    tx_id = transaction_id or f"ADMIN_{current_user.id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    order = await service.update_order_paid(order_id, tx_id)
    
    if not order:
        raise HTTPException(status_code=400, detail="更新订单状态失败")
    
    # 如果是会员订单，创建订阅
    if order.product_type == ProductType.MEMBERSHIP.value:
        vip_service = VIPService(db)
        # 从产品名称解析时长
        duration_months = 1
        if "3个月" in order.product_name:
            duration_months = 3
        elif "6个月" in order.product_name:
            duration_months = 6
        elif "12个月" in order.product_name or "1年" in order.product_name:
            duration_months = 12
        
        await vip_service.create_subscription(
            user_id=order.user_id,
            level_id=order.product_id,
            duration_months=duration_months,
            order_id=order.id,
        )
    
    return {"success": True, "message": "订单已标记为已支付"}


@router.post("/orders/{order_id}/refund")
async def refund_order(
    order_id: str,
    reason: str = "admin_refund",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """退款订单"""
    require_admin(current_user)

    from app.services.order_service import OrderService
    from app.services.vip_service import VIPService
    from app.services.coupon_service import CouponService
    from app.services.points_service import PointsService
    from app.models.order import ProductType

    service = OrderService(db)
    order = await service.get_order_by_id(order_id)
    
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    
    if order.status != "paid":
        raise HTTPException(status_code=400, detail=f"订单状态为 {order.status}，无法退款")
    
    # 创建退款记录
    refund = await service.create_refund(order_id, order.user_id, reason)
    if not refund:
        raise HTTPException(status_code=400, detail="创建退款失败")
    
    # 直接标记退款成功（管理员操作）
    refund = await service.update_refund_success(
        refund.id, 
        f"ADMIN_REFUND_{current_user.id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    )
    
    # 如果是会员订单，取消订阅
    if order.product_type == ProductType.MEMBERSHIP.value:
        vip_service = VIPService(db)
        await vip_service.cancel_subscription(order.user_id)
    
    # 恢复优惠券
    if order.coupon_id:
        coupon_service = CouponService(db)
        await coupon_service.restore_coupon(order.user_id, order.id)
    
    # 恢复积分
    if order.points_used and order.points_used > 0:
        points_service = PointsService(db)
        await points_service.add_points(
            user_id=order.user_id,
            amount=order.points_used,
            source="refund",
            description=f"订单退款返还积分: {order.order_no}",
            reference_id=order.id,
        )
    
    return {"success": True, "message": "订单已退款"}


@router.put("/orders/{order_id}/cancel")
async def cancel_order_admin(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """取消订单（管理员）"""
    require_admin(current_user)

    from app.services.order_service import OrderService
    from app.services.coupon_service import CouponService
    from app.services.points_service import PointsService

    service = OrderService(db)
    order = await service.get_order_by_id(order_id)
    
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    
    if order.status != "pending":
        raise HTTPException(status_code=400, detail=f"订单状态为 {order.status}，无法取消")
    
    # 取消订单
    order.status = "cancelled"
    order.cancelled_at = datetime.utcnow()
    
    # 恢复优惠券
    if order.coupon_id:
        coupon_service = CouponService(db)
        await coupon_service.restore_coupon(order.user_id, order.id)
    
    # 解锁积分
    if order.points_lock_id:
        points_service = PointsService(db)
        await points_service.unlock_points(order.points_lock_id)
    
    await db.commit()
    
    return {"success": True, "message": "订单已取消"}


@router.get("/orders/statistics")
async def get_order_statistics(
    start_date: str = "",
    end_date: str = "",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取订单统计"""
    require_admin(current_user)

    from app.models.order import Order, OrderStatus

    query = select(Order)
    
    if start_date:
        start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        query = query.where(Order.created_at >= start)
    if end_date:
        end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        query = query.where(Order.created_at <= end)
    
    result = await db.execute(query)
    orders = result.scalars().all()
    
    # 统计
    stats = {
        "total": len(orders),
        "pending": 0,
        "paid": 0,
        "cancelled": 0,
        "refunded": 0,
        "total_amount": 0,
        "total_discount": 0,
        "total_points_discount": 0,
    }
    
    for order in orders:
        if order.status == OrderStatus.PENDING.value:
            stats["pending"] += 1
        elif order.status == OrderStatus.PAID.value:
            stats["paid"] += 1
            stats["total_amount"] += order.final_amount
            stats["total_discount"] += order.discount_amount
            stats["total_points_discount"] += order.points_discount
        elif order.status == OrderStatus.CANCELLED.value:
            stats["cancelled"] += 1
        elif order.status == OrderStatus.REFUNDED.value:
            stats["refunded"] += 1
    
    # 今日统计
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_orders = await db.scalar(
        select(func.count(Order.id)).where(Order.created_at >= today_start)
    )
    today_paid = await db.scalar(
        select(func.count(Order.id)).where(
            Order.created_at >= today_start,
            Order.status == OrderStatus.PAID.value,
        )
    )
    today_amount = await db.scalar(
        select(func.sum(Order.final_amount)).where(
            Order.created_at >= today_start,
            Order.status == OrderStatus.PAID.value,
        )
    )
    
    stats["today_orders"] = today_orders or 0
    stats["today_paid"] = today_paid or 0
    stats["today_amount"] = today_amount or 0
    
    # 支付成功率
    stats["success_rate"] = round(
        stats["paid"] / stats["total"] * 100 if stats["total"] > 0 else 0, 1
    )
    
    return stats


# ============ Community Post Management API (社区帖子管理) ============


@router.get("/posts")
async def list_admin_posts(
    page: int = 1,
    page_size: int = 20,
    status: str = "",  # all, pinned, featured, hidden
    search: str = "",
    user_id: str = "",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取帖子列表"""
    require_admin(current_user)

    from app.models.community import Post

    query = select(Post)
    
    # 状态筛选
    if status == "pinned":
        query = query.where(Post.is_pinned == True)  # noqa: E712
    elif status == "hidden":
        query = query.where(Post.is_deleted == True)  # noqa: E712
    elif status != "all":
        query = query.where(Post.is_deleted == False)  # noqa: E712
    
    # 搜索
    if search:
        query = query.where(Post.content.ilike(f"%{search}%"))
    
    # 用户筛选
    if user_id:
        query = query.where(Post.user_id == user_id)
    
    # 计算总数
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0
    
    # 分页
    query = query.order_by(Post.is_pinned.desc(), Post.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    
    result = await db.execute(query)
    posts = result.scalars().all()
    
    items = []
    for p in posts:
        # 获取用户信息
        user_result = await db.execute(select(User).where(User.id == p.user_id))
        user = user_result.scalar_one_or_none()
        
        items.append({
            "id": p.id,
            "content": p.content,
            "images": p.images,
            "likes_count": p.likes_count,
            "comments_count": p.comments_count,
            "is_pinned": p.is_pinned,
            "is_deleted": p.is_deleted,
            "user": {
                "id": user.id if user else None,
                "nickname": user.nickname if user else "未知用户",
                "avatar": user.avatar if user else None,
            },
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })
    
    total_pages = (total + page_size - 1) // page_size
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.get("/posts/{post_id}")
async def get_admin_post(
    post_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取帖子详情"""
    require_admin(current_user)

    from app.models.community import Post, PostComment

    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    
    if not post:
        raise HTTPException(status_code=404, detail="帖子不存在")
    
    # 获取用户信息
    user_result = await db.execute(select(User).where(User.id == post.user_id))
    user = user_result.scalar_one_or_none()
    
    # 获取评论
    comments_result = await db.execute(
        select(PostComment)
        .where(PostComment.post_id == post_id, PostComment.is_deleted == False)  # noqa: E712
        .order_by(PostComment.created_at.desc())
        .limit(50)
    )
    comments = comments_result.scalars().all()
    
    comment_items = []
    for c in comments:
        comment_user_result = await db.execute(select(User).where(User.id == c.user_id))
        comment_user = comment_user_result.scalar_one_or_none()
        comment_items.append({
            "id": c.id,
            "content": c.content,
            "user": {
                "id": comment_user.id if comment_user else None,
                "nickname": comment_user.nickname if comment_user else "未知用户",
                "avatar": comment_user.avatar if comment_user else None,
            },
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })
    
    return {
        "id": post.id,
        "content": post.content,
        "images": post.images,
        "likes_count": post.likes_count,
        "comments_count": post.comments_count,
        "is_pinned": post.is_pinned,
        "is_deleted": post.is_deleted,
        "user": {
            "id": user.id if user else None,
            "nickname": user.nickname if user else "未知用户",
            "avatar": user.avatar if user else None,
        },
        "comments": comment_items,
        "created_at": post.created_at.isoformat() if post.created_at else None,
    }


@router.put("/posts/{post_id}/pin")
async def pin_post(
    post_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """置顶帖子"""
    require_admin(current_user)

    from app.models.community import Post

    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    
    if not post:
        raise HTTPException(status_code=404, detail="帖子不存在")
    
    post.is_pinned = True
    await db.commit()
    
    return {"success": True, "message": "帖子已置顶"}


@router.put("/posts/{post_id}/unpin")
async def unpin_post(
    post_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """取消置顶"""
    require_admin(current_user)

    from app.models.community import Post

    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    
    if not post:
        raise HTTPException(status_code=404, detail="帖子不存在")
    
    post.is_pinned = False
    await db.commit()
    
    return {"success": True, "message": "已取消置顶"}


@router.put("/posts/{post_id}/hide")
async def hide_post(
    post_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """隐藏帖子"""
    require_admin(current_user)

    from app.models.community import Post

    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    
    if not post:
        raise HTTPException(status_code=404, detail="帖子不存在")
    
    post.is_deleted = True
    await db.commit()
    
    return {"success": True, "message": "帖子已隐藏"}


@router.put("/posts/{post_id}/show")
async def show_post(
    post_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """恢复帖子"""
    require_admin(current_user)

    from app.models.community import Post

    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    
    if not post:
        raise HTTPException(status_code=404, detail="帖子不存在")
    
    post.is_deleted = False
    await db.commit()
    
    return {"success": True, "message": "帖子已恢复"}


@router.delete("/posts/{post_id}")
async def delete_admin_post(
    post_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """永久删除帖子"""
    require_admin(current_user)

    from app.models.community import Post, PostComment, PostLike

    # 删除评论
    await db.execute(delete(PostComment).where(PostComment.post_id == post_id))
    # 删除点赞
    await db.execute(delete(PostLike).where(PostLike.post_id == post_id))
    # 删除帖子
    await db.execute(delete(Post).where(Post.id == post_id))
    
    await db.commit()
    
    return {"success": True, "message": "帖子已永久删除"}


@router.get("/posts/statistics")
async def get_posts_statistics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取帖子统计"""
    require_admin(current_user)

    from app.models.community import Post, PostComment

    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    # 总帖子数
    total = await db.scalar(
        select(func.count(Post.id)).where(Post.is_deleted == False)  # noqa: E712
    )
    
    # 今日新增
    today_count = await db.scalar(
        select(func.count(Post.id)).where(
            Post.created_at >= today_start,
            Post.is_deleted == False,  # noqa: E712
        )
    )
    
    # 置顶数
    pinned_count = await db.scalar(
        select(func.count(Post.id)).where(
            Post.is_pinned == True,  # noqa: E712
            Post.is_deleted == False,  # noqa: E712
        )
    )
    
    # 总评论数
    total_comments = await db.scalar(
        select(func.count(PostComment.id)).where(PostComment.is_deleted == False)  # noqa: E712
    )
    
    # 总点赞数
    total_likes = await db.scalar(
        select(func.sum(Post.likes_count)).where(Post.is_deleted == False)  # noqa: E712
    )
    
    return {
        "total": total or 0,
        "today_count": today_count or 0,
        "pinned_count": pinned_count or 0,
        "total_comments": total_comments or 0,
        "total_likes": total_likes or 0,
    }


# ============ Comment Management API (评论管理) ============


@router.get("/comments")
async def list_admin_comments(
    page: int = 1,
    page_size: int = 20,
    post_id: str = "",
    user_id: str = "",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取评论列表"""
    require_admin(current_user)

    from app.models.community import Post, PostComment

    query = select(PostComment).where(PostComment.is_deleted == False)  # noqa: E712
    
    if post_id:
        query = query.where(PostComment.post_id == post_id)
    if user_id:
        query = query.where(PostComment.user_id == user_id)
    
    # 计算总数
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0
    
    # 分页
    query = query.order_by(PostComment.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    
    result = await db.execute(query)
    comments = result.scalars().all()
    
    items = []
    for c in comments:
        # 获取用户信息
        user_result = await db.execute(select(User).where(User.id == c.user_id))
        user = user_result.scalar_one_or_none()
        
        # 获取帖子信息
        post_result = await db.execute(select(Post).where(Post.id == c.post_id))
        post = post_result.scalar_one_or_none()
        
        items.append({
            "id": c.id,
            "content": c.content,
            "post_id": c.post_id,
            "post_content": post.content[:50] + "..." if post and len(post.content) > 50 else (post.content if post else ""),
            "user": {
                "id": user.id if user else None,
                "nickname": user.nickname if user else "未知用户",
                "avatar": user.avatar if user else None,
            },
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })
    
    total_pages = (total + page_size - 1) // page_size
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.delete("/comments/{comment_id}")
async def delete_admin_comment(
    comment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除评论"""
    require_admin(current_user)

    from app.models.community import Post, PostComment

    result = await db.execute(select(PostComment).where(PostComment.id == comment_id))
    comment = result.scalar_one_or_none()
    
    if not comment:
        raise HTTPException(status_code=404, detail="评论不存在")
    
    # 更新帖子评论数
    post_result = await db.execute(select(Post).where(Post.id == comment.post_id))
    post = post_result.scalar_one_or_none()
    if post and post.comments_count > 0:
        post.comments_count -= 1
    
    # 软删除评论
    comment.is_deleted = True
    await db.commit()
    
    return {"success": True, "message": "评论已删除"}


# ============ 课程管理 API ============


class CourseCreate(BaseModel):
    """创建课程"""
    title: str
    description: str
    full_description: str | None = None
    category: str  # sales, social, advanced
    level: str = "beginner"  # beginner, intermediate, advanced
    duration_minutes: int = 0
    cover_image: str | None = None
    instructor_id: str | None = None
    price: float = 0
    is_pro: bool = False
    is_new: bool = False
    is_published: bool = False
    objectives: list[str] = []
    requirements: list[str] = []
    sort_order: int = 0


class CourseUpdate(BaseModel):
    """更新课程"""
    title: str | None = None
    description: str | None = None
    full_description: str | None = None
    category: str | None = None
    level: str | None = None
    duration_minutes: int | None = None
    cover_image: str | None = None
    instructor_id: str | None = None
    price: float | None = None
    is_pro: bool | None = None
    is_new: bool | None = None
    is_published: bool | None = None
    objectives: list[str] | None = None
    requirements: list[str] | None = None
    sort_order: int | None = None


class ChapterCreate(BaseModel):
    """创建章节"""
    title: str
    description: str | None = None
    order: int = 0


class ChapterUpdate(BaseModel):
    """更新章节"""
    title: str | None = None
    description: str | None = None
    order: int | None = None


class LessonCreate(BaseModel):
    """创建课时"""
    title: str
    type: str = "video"  # video, article, quiz, practice
    duration_minutes: int = 0
    content_url: str | None = None
    content_text: str | None = None
    quiz_data: dict[str, Any] | None = None
    order: int = 0
    is_free: bool = False


class LessonUpdate(BaseModel):
    """更新课时"""
    title: str | None = None
    type: str | None = None
    duration_minutes: int | None = None
    content_url: str | None = None
    content_text: str | None = None
    quiz_data: dict[str, Any] | None = None
    order: int | None = None
    is_free: bool | None = None


class InstructorCreate(BaseModel):
    """创建讲师"""
    name: str
    title: str | None = None
    avatar: str | None = None
    bio: str | None = None


class InstructorUpdate(BaseModel):
    """更新讲师"""
    name: str | None = None
    title: str | None = None
    avatar: str | None = None
    bio: str | None = None


@router.get("/courses")
async def list_admin_courses(
    page: int = 1,
    size: int = 20,
    category: str | None = None,
    level: str | None = None,
    is_published: bool | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取课程列表（管理员）"""
    require_admin(current_user)
    
    from app.models.course import Course, Instructor, Chapter
    from sqlalchemy.orm import selectinload
    
    query = select(Course).options(
        selectinload(Course.instructor),
        selectinload(Course.chapters),
    )
    
    if category:
        query = query.where(Course.category == category)
    if level:
        query = query.where(Course.level == level)
    if is_published is not None:
        query = query.where(Course.is_published == is_published)
    if search:
        query = query.where(
            or_(
                Course.title.ilike(f"%{search}%"),
                Course.description.ilike(f"%{search}%"),
            )
        )
    
    # 统计总数
    count_query = select(func.count(Course.id))
    if category:
        count_query = count_query.where(Course.category == category)
    if level:
        count_query = count_query.where(Course.level == level)
    if is_published is not None:
        count_query = count_query.where(Course.is_published == is_published)
    if search:
        count_query = count_query.where(
            or_(
                Course.title.ilike(f"%{search}%"),
                Course.description.ilike(f"%{search}%"),
            )
        )
    
    total = await db.scalar(count_query) or 0
    
    # 分页
    offset = (page - 1) * size
    query = query.order_by(Course.sort_order, Course.created_at.desc()).offset(offset).limit(size)
    
    result = await db.execute(query)
    courses = result.scalars().all()
    
    items = []
    for course in courses:
        items.append({
            "id": course.id,
            "title": course.title,
            "description": course.description,
            "category": course.category,
            "level": course.level,
            "duration_minutes": course.duration_minutes,
            "cover_image": course.cover_image,
            "is_pro": course.is_pro,
            "is_new": course.is_new,
            "is_published": course.is_published,
            "rating": float(course.rating),
            "enrolled_count": course.enrolled_count,
            "price": float(course.price),
            "sort_order": course.sort_order,
            "chapters_count": len(course.chapters),
            "instructor": {
                "id": course.instructor.id,
                "name": course.instructor.name,
                "title": course.instructor.title,
            } if course.instructor else None,
            "created_at": course.created_at.isoformat() if course.created_at else None,
        })
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
    }


@router.get("/courses/{course_id}")
async def get_admin_course(
    course_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取课程详情（管理员）"""
    require_admin(current_user)
    
    from app.models.course import Course, Chapter, Lesson
    from sqlalchemy.orm import selectinload
    
    result = await db.execute(
        select(Course)
        .options(
            selectinload(Course.instructor),
            selectinload(Course.chapters).selectinload(Chapter.lessons),
        )
        .where(Course.id == course_id)
    )
    course = result.scalar_one_or_none()
    
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在")
    
    chapters_data = []
    for chapter in sorted(course.chapters, key=lambda c: c.order):
        lessons_data = []
        for lesson in sorted(chapter.lessons, key=lambda l: l.order):
            lessons_data.append({
                "id": lesson.id,
                "title": lesson.title,
                "type": lesson.type,
                "duration_minutes": lesson.duration_minutes,
                "content_url": lesson.content_url,
                "content_text": lesson.content_text,
                "quiz_data": lesson.quiz_data,
                "order": lesson.order,
                "is_free": lesson.is_free,
            })
        chapters_data.append({
            "id": chapter.id,
            "title": chapter.title,
            "description": chapter.description,
            "order": chapter.order,
            "lessons": lessons_data,
        })
    
    return {
        "id": course.id,
        "title": course.title,
        "description": course.description,
        "full_description": course.full_description,
        "category": course.category,
        "level": course.level,
        "duration_minutes": course.duration_minutes,
        "cover_image": course.cover_image,
        "instructor_id": course.instructor_id,
        "price": float(course.price),
        "is_pro": course.is_pro,
        "is_new": course.is_new,
        "is_published": course.is_published,
        "rating": float(course.rating),
        "enrolled_count": course.enrolled_count,
        "objectives": course.objectives or [],
        "requirements": course.requirements or [],
        "sort_order": course.sort_order,
        "instructor": {
            "id": course.instructor.id,
            "name": course.instructor.name,
            "title": course.instructor.title,
            "avatar": course.instructor.avatar,
            "bio": course.instructor.bio,
        } if course.instructor else None,
        "chapters": chapters_data,
        "created_at": course.created_at.isoformat() if course.created_at else None,
        "updated_at": course.updated_at.isoformat() if course.updated_at else None,
    }


@router.post("/courses")
async def create_admin_course(
    data: CourseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建课程（管理员）"""
    require_admin(current_user)
    
    import uuid
    from app.models.course import Course
    
    course = Course(
        id=str(uuid.uuid4()),
        title=data.title,
        description=data.description,
        full_description=data.full_description,
        category=data.category,
        level=data.level,
        duration_minutes=data.duration_minutes,
        cover_image=data.cover_image,
        instructor_id=data.instructor_id,
        price=data.price,
        is_pro=data.is_pro,
        is_new=data.is_new,
        is_published=data.is_published,
        objectives=data.objectives,
        requirements=data.requirements,
        sort_order=data.sort_order,
    )
    db.add(course)
    await db.commit()
    await db.refresh(course)
    
    return {
        "id": course.id,
        "title": course.title,
        "message": "课程创建成功",
    }


@router.put("/courses/{course_id}")
async def update_admin_course(
    course_id: str,
    data: CourseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新课程（管理员）"""
    require_admin(current_user)
    
    from app.models.course import Course
    
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在")
    
    update_fields = data.model_dump(exclude_unset=True)
    for field, value in update_fields.items():
        setattr(course, field, value)
    
    await db.commit()
    
    return {"success": True, "message": "课程更新成功"}


@router.delete("/courses/{course_id}")
async def delete_admin_course(
    course_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除课程（管理员）"""
    require_admin(current_user)
    
    from app.models.course import Course, CourseEnrollment
    
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在")
    
    # 检查是否有报名记录
    enrollment_count = await db.scalar(
        select(func.count(CourseEnrollment.id)).where(CourseEnrollment.course_id == course_id)
    )
    if enrollment_count and enrollment_count > 0:
        raise HTTPException(status_code=400, detail=f"该课程有 {enrollment_count} 名学员报名，无法删除")
    
    await db.delete(course)
    await db.commit()
    
    return {"success": True, "message": "课程删除成功"}


@router.put("/courses/{course_id}/publish")
async def publish_admin_course(
    course_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """发布课程（管理员）"""
    require_admin(current_user)
    
    from app.models.course import Course
    
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在")
    
    course.is_published = True
    await db.commit()
    
    return {"success": True, "message": "课程已发布"}


@router.put("/courses/{course_id}/unpublish")
async def unpublish_admin_course(
    course_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """下架课程（管理员）"""
    require_admin(current_user)
    
    from app.models.course import Course
    
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在")
    
    course.is_published = False
    await db.commit()
    
    return {"success": True, "message": "课程已下架"}


# ============ 章节管理 API ============


@router.post("/courses/{course_id}/chapters")
async def create_admin_chapter(
    course_id: str,
    data: ChapterCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """添加章节（管理员）"""
    require_admin(current_user)
    
    import uuid
    from app.models.course import Course, Chapter
    
    # 检查课程是否存在
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在")
    
    # 获取最大排序号
    max_order = await db.scalar(
        select(func.max(Chapter.order)).where(Chapter.course_id == course_id)
    )
    order = data.order if data.order > 0 else (max_order or 0) + 1
    
    chapter = Chapter(
        id=str(uuid.uuid4()),
        course_id=course_id,
        title=data.title,
        description=data.description,
        order=order,
    )
    db.add(chapter)
    await db.commit()
    await db.refresh(chapter)
    
    return {
        "id": chapter.id,
        "title": chapter.title,
        "order": chapter.order,
        "message": "章节创建成功",
    }


@router.put("/chapters/{chapter_id}")
async def update_admin_chapter(
    chapter_id: str,
    data: ChapterUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新章节（管理员）"""
    require_admin(current_user)
    
    from app.models.course import Chapter
    
    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    
    if not chapter:
        raise HTTPException(status_code=404, detail="章节不存在")
    
    update_fields = data.model_dump(exclude_unset=True)
    for field, value in update_fields.items():
        setattr(chapter, field, value)
    
    await db.commit()
    
    return {"success": True, "message": "章节更新成功"}


@router.delete("/chapters/{chapter_id}")
async def delete_admin_chapter(
    chapter_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除章节（管理员）"""
    require_admin(current_user)
    
    from app.models.course import Chapter
    
    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    
    if not chapter:
        raise HTTPException(status_code=404, detail="章节不存在")
    
    await db.delete(chapter)
    await db.commit()
    
    return {"success": True, "message": "章节删除成功"}


@router.put("/courses/{course_id}/chapters/reorder")
async def reorder_admin_chapters(
    course_id: str,
    chapter_ids: list[str],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """重排章节顺序（管理员）"""
    require_admin(current_user)
    
    from app.models.course import Chapter
    
    for index, chapter_id in enumerate(chapter_ids):
        await db.execute(
            update(Chapter)
            .where(Chapter.id == chapter_id, Chapter.course_id == course_id)
            .values(order=index + 1)
        )
    
    await db.commit()
    
    return {"success": True, "message": "章节顺序已更新"}


# ============ 课时管理 API ============


@router.post("/chapters/{chapter_id}/lessons")
async def create_admin_lesson(
    chapter_id: str,
    data: LessonCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """添加课时（管理员）"""
    require_admin(current_user)
    
    import uuid
    from app.models.course import Chapter, Lesson
    
    # 检查章节是否存在
    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="章节不存在")
    
    # 获取最大排序号
    max_order = await db.scalar(
        select(func.max(Lesson.order)).where(Lesson.chapter_id == chapter_id)
    )
    order = data.order if data.order > 0 else (max_order or 0) + 1
    
    lesson = Lesson(
        id=str(uuid.uuid4()),
        chapter_id=chapter_id,
        title=data.title,
        type=data.type,
        duration_minutes=data.duration_minutes,
        content_url=data.content_url,
        content_text=data.content_text,
        quiz_data=data.quiz_data,
        order=order,
        is_free=data.is_free,
    )
    db.add(lesson)
    await db.commit()
    await db.refresh(lesson)
    
    return {
        "id": lesson.id,
        "title": lesson.title,
        "order": lesson.order,
        "message": "课时创建成功",
    }


@router.put("/lessons/{lesson_id}")
async def update_admin_lesson(
    lesson_id: str,
    data: LessonUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新课时（管理员）"""
    require_admin(current_user)
    
    from app.models.course import Lesson
    
    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = result.scalar_one_or_none()
    
    if not lesson:
        raise HTTPException(status_code=404, detail="课时不存在")
    
    update_fields = data.model_dump(exclude_unset=True)
    for field, value in update_fields.items():
        setattr(lesson, field, value)
    
    await db.commit()
    
    return {"success": True, "message": "课时更新成功"}


@router.delete("/lessons/{lesson_id}")
async def delete_admin_lesson(
    lesson_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除课时（管理员）"""
    require_admin(current_user)
    
    from app.models.course import Lesson
    
    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = result.scalar_one_or_none()
    
    if not lesson:
        raise HTTPException(status_code=404, detail="课时不存在")
    
    await db.delete(lesson)
    await db.commit()
    
    return {"success": True, "message": "课时删除成功"}


# ============ 讲师管理 API ============


@router.get("/instructors")
async def list_admin_instructors(
    page: int = 1,
    size: int = 20,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取讲师列表（管理员）"""
    require_admin(current_user)
    
    from app.models.course import Instructor, Course
    
    query = select(Instructor)
    
    if search:
        query = query.where(
            or_(
                Instructor.name.ilike(f"%{search}%"),
                Instructor.title.ilike(f"%{search}%"),
            )
        )
    
    # 统计总数
    count_query = select(func.count(Instructor.id))
    if search:
        count_query = count_query.where(
            or_(
                Instructor.name.ilike(f"%{search}%"),
                Instructor.title.ilike(f"%{search}%"),
            )
        )
    total = await db.scalar(count_query) or 0
    
    # 分页
    offset = (page - 1) * size
    query = query.order_by(Instructor.created_at.desc()).offset(offset).limit(size)
    
    result = await db.execute(query)
    instructors = result.scalars().all()
    
    items = []
    for instructor in instructors:
        # 获取讲师的课程数
        course_count = await db.scalar(
            select(func.count(Course.id)).where(Course.instructor_id == instructor.id)
        )
        items.append({
            "id": instructor.id,
            "name": instructor.name,
            "title": instructor.title,
            "avatar": instructor.avatar,
            "bio": instructor.bio,
            "course_count": course_count or 0,
            "created_at": instructor.created_at.isoformat() if instructor.created_at else None,
        })
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
    }


@router.post("/instructors")
async def create_admin_instructor(
    data: InstructorCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建讲师（管理员）"""
    require_admin(current_user)
    
    import uuid
    from app.models.course import Instructor
    
    instructor = Instructor(
        id=str(uuid.uuid4()),
        name=data.name,
        title=data.title,
        avatar=data.avatar,
        bio=data.bio,
    )
    db.add(instructor)
    await db.commit()
    await db.refresh(instructor)
    
    return {
        "id": instructor.id,
        "name": instructor.name,
        "message": "讲师创建成功",
    }


@router.put("/instructors/{instructor_id}")
async def update_admin_instructor(
    instructor_id: str,
    data: InstructorUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新讲师（管理员）"""
    require_admin(current_user)
    
    from app.models.course import Instructor
    
    result = await db.execute(select(Instructor).where(Instructor.id == instructor_id))
    instructor = result.scalar_one_or_none()
    
    if not instructor:
        raise HTTPException(status_code=404, detail="讲师不存在")
    
    update_fields = data.model_dump(exclude_unset=True)
    for field, value in update_fields.items():
        setattr(instructor, field, value)
    
    await db.commit()
    
    return {"success": True, "message": "讲师更新成功"}


@router.delete("/instructors/{instructor_id}")
async def delete_admin_instructor(
    instructor_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除讲师（管理员）"""
    require_admin(current_user)
    
    from app.models.course import Instructor, Course
    
    result = await db.execute(select(Instructor).where(Instructor.id == instructor_id))
    instructor = result.scalar_one_or_none()
    
    if not instructor:
        raise HTTPException(status_code=404, detail="讲师不存在")
    
    # 检查是否有关联课程
    course_count = await db.scalar(
        select(func.count(Course.id)).where(Course.instructor_id == instructor_id)
    )
    if course_count and course_count > 0:
        raise HTTPException(status_code=400, detail=f"该讲师有 {course_count} 门关联课程，无法删除")
    
    await db.delete(instructor)
    await db.commit()
    
    return {"success": True, "message": "讲师删除成功"}


@router.get("/courses/statistics")
async def get_courses_statistics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取课程统计（管理员）"""
    require_admin(current_user)
    
    from app.models.course import Course, CourseEnrollment, Instructor
    
    total_courses = await db.scalar(select(func.count(Course.id))) or 0
    published_courses = await db.scalar(
        select(func.count(Course.id)).where(Course.is_published == True)
    ) or 0
    total_enrollments = await db.scalar(select(func.count(CourseEnrollment.id))) or 0
    total_instructors = await db.scalar(select(func.count(Instructor.id))) or 0
    
    # 按分类统计
    category_stats = []
    for category in ["sales", "social", "advanced"]:
        count = await db.scalar(
            select(func.count(Course.id)).where(Course.category == category)
        ) or 0
        category_stats.append({"category": category, "count": count})
    
    # 按难度统计
    level_stats = []
    for level in ["beginner", "intermediate", "advanced"]:
        count = await db.scalar(
            select(func.count(Course.id)).where(Course.level == level)
        ) or 0
        level_stats.append({"level": level, "count": count})
    
    return {
        "total_courses": total_courses,
        "published_courses": published_courses,
        "draft_courses": total_courses - published_courses,
        "total_enrollments": total_enrollments,
        "total_instructors": total_instructors,
        "category_stats": category_stats,
        "level_stats": level_stats,
    }



# ============ 场景管理 API ============


class ScenarioAdminCreate(BaseModel):
    """创建场景（管理员）"""
    name: str
    track: str  # sales, social
    mode: str = "train"  # train, exam, replay
    difficulty: int = 3
    description: str | None = None
    config: dict[str, Any] = {}
    rubric_version: str = "1.0"
    status: str = "draft"  # draft, published, archived
    is_official: bool = True
    is_featured: bool = False
    cover_image: str | None = None


class ScenarioAdminUpdate(BaseModel):
    """更新场景（管理员）"""
    name: str | None = None
    track: str | None = None
    mode: str | None = None
    difficulty: int | None = None
    description: str | None = None
    config: dict[str, Any] | None = None
    rubric_version: str | None = None
    status: str | None = None
    is_official: bool | None = None
    is_featured: bool | None = None
    cover_image: str | None = None


@router.get("/scenarios")
async def list_admin_scenarios(
    page: int = 1,
    size: int = 20,
    track: str | None = None,
    status: str | None = None,
    difficulty: int | None = None,
    is_official: bool | None = None,
    is_featured: bool | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取场景列表（管理员）"""
    require_admin(current_user)
    
    query = select(Scenario)
    
    if track:
        query = query.where(Scenario.track == track)
    if status:
        query = query.where(Scenario.status == status)
    if difficulty:
        query = query.where(Scenario.difficulty == difficulty)
    if is_official is not None:
        query = query.where(Scenario.is_official == is_official)
    if is_featured is not None:
        query = query.where(Scenario.is_featured == is_featured)
    if search:
        query = query.where(
            or_(
                Scenario.name.ilike(f"%{search}%"),
                Scenario.description.ilike(f"%{search}%"),
            )
        )
    
    # 统计总数
    count_query = select(func.count(Scenario.id))
    if track:
        count_query = count_query.where(Scenario.track == track)
    if status:
        count_query = count_query.where(Scenario.status == status)
    if difficulty:
        count_query = count_query.where(Scenario.difficulty == difficulty)
    if is_official is not None:
        count_query = count_query.where(Scenario.is_official == is_official)
    if is_featured is not None:
        count_query = count_query.where(Scenario.is_featured == is_featured)
    if search:
        count_query = count_query.where(
            or_(
                Scenario.name.ilike(f"%{search}%"),
                Scenario.description.ilike(f"%{search}%"),
            )
        )
    
    total = await db.scalar(count_query) or 0
    
    # 分页
    offset = (page - 1) * size
    query = query.order_by(Scenario.created_at.desc()).offset(offset).limit(size)
    
    result = await db.execute(query)
    scenarios = result.scalars().all()
    
    items = []
    for scenario in scenarios:
        items.append({
            "id": scenario.id,
            "name": scenario.name,
            "track": scenario.track,
            "mode": scenario.mode,
            "difficulty": scenario.difficulty,
            "description": scenario.description,
            "status": scenario.status,
            "is_official": scenario.is_official,
            "is_featured": scenario.is_featured,
            "cover_image": scenario.cover_image,
            "train_count": scenario.train_count,
            "likes_count": scenario.likes_count,
            "avg_score": scenario.avg_score,
            "created_by": scenario.created_by,
            "visibility": scenario.visibility,
            "created_at": scenario.created_at.isoformat() if scenario.created_at else None,
            "published_at": scenario.published_at.isoformat() if scenario.published_at else None,
        })
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
    }


@router.get("/scenarios/{scenario_id}")
async def get_admin_scenario(
    scenario_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取场景详情（管理员）"""
    require_admin(current_user)
    
    result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
    scenario = result.scalar_one_or_none()
    
    if not scenario:
        raise HTTPException(status_code=404, detail="场景不存在")
    
    # 获取创建者信息
    creator = None
    if scenario.created_by:
        creator_result = await db.execute(select(User).where(User.id == scenario.created_by))
        creator_user = creator_result.scalar_one_or_none()
        if creator_user:
            creator = {
                "id": creator_user.id,
                "nickname": creator_user.nickname,
                "avatar": creator_user.avatar,
            }
    
    return {
        "id": scenario.id,
        "name": scenario.name,
        "track": scenario.track,
        "mode": scenario.mode,
        "difficulty": scenario.difficulty,
        "description": scenario.description,
        "config": scenario.config,
        "rubric_version": scenario.rubric_version,
        "status": scenario.status,
        "visibility": scenario.visibility,
        "is_official": scenario.is_official,
        "is_featured": scenario.is_featured,
        "cover_image": scenario.cover_image,
        "train_count": scenario.train_count,
        "likes_count": scenario.likes_count,
        "comments_count": scenario.comments_count,
        "fork_count": scenario.fork_count,
        "collections_count": scenario.collections_count,
        "avg_score": scenario.avg_score,
        "hot_score": scenario.hot_score,
        "created_by": scenario.created_by,
        "creator": creator,
        "forked_from": scenario.forked_from,
        "created_at": scenario.created_at.isoformat() if scenario.created_at else None,
        "updated_at": scenario.updated_at.isoformat() if scenario.updated_at else None,
        "published_at": scenario.published_at.isoformat() if scenario.published_at else None,
    }


@router.post("/scenarios")
async def create_admin_scenario(
    data: ScenarioAdminCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建场景（管理员）"""
    require_admin(current_user)
    
    import uuid
    
    scenario = Scenario(
        id=str(uuid.uuid4()),
        name=data.name,
        track=data.track,
        mode=data.mode,
        difficulty=data.difficulty,
        description=data.description,
        config=data.config,
        rubric_version=data.rubric_version,
        status=data.status,
        is_official=data.is_official,
        is_featured=data.is_featured,
        cover_image=data.cover_image,
        visibility="public" if data.status == "published" else "private",
        created_by=current_user.id,
    )
    
    if data.status == "published":
        scenario.published_at = datetime.utcnow()
    
    db.add(scenario)
    await db.commit()
    await db.refresh(scenario)
    
    return {
        "id": scenario.id,
        "name": scenario.name,
        "message": "场景创建成功",
    }


@router.put("/scenarios/{scenario_id}")
async def update_admin_scenario(
    scenario_id: str,
    data: ScenarioAdminUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新场景（管理员）"""
    require_admin(current_user)
    
    result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
    scenario = result.scalar_one_or_none()
    
    if not scenario:
        raise HTTPException(status_code=404, detail="场景不存在")
    
    update_fields = data.model_dump(exclude_unset=True)
    
    # 如果状态变为 published，设置发布时间
    if "status" in update_fields and update_fields["status"] == "published" and scenario.status != "published":
        scenario.published_at = datetime.utcnow()
        scenario.visibility = "public"
    
    for field, value in update_fields.items():
        setattr(scenario, field, value)
    
    await db.commit()
    
    return {"success": True, "message": "场景更新成功"}


@router.delete("/scenarios/{scenario_id}")
async def delete_admin_scenario(
    scenario_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除场景（管理员）"""
    require_admin(current_user)
    
    result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
    scenario = result.scalar_one_or_none()
    
    if not scenario:
        raise HTTPException(status_code=404, detail="场景不存在")
    
    # 检查是否有训练记录
    session_count = await db.scalar(
        select(func.count(Session.id)).where(Session.scenario_id == scenario_id)
    )
    if session_count and session_count > 0:
        raise HTTPException(status_code=400, detail=f"该场景有 {session_count} 条训练记录，无法删除")
    
    await db.delete(scenario)
    await db.commit()
    
    return {"success": True, "message": "场景删除成功"}


@router.put("/scenarios/{scenario_id}/publish")
async def publish_admin_scenario(
    scenario_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """发布场景（管理员）"""
    require_admin(current_user)
    
    result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
    scenario = result.scalar_one_or_none()
    
    if not scenario:
        raise HTTPException(status_code=404, detail="场景不存在")
    
    scenario.status = "published"
    scenario.visibility = "public"
    scenario.published_at = datetime.utcnow()
    await db.commit()
    
    return {"success": True, "message": "场景已发布"}


@router.put("/scenarios/{scenario_id}/archive")
async def archive_admin_scenario(
    scenario_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """归档场景（管理员）"""
    require_admin(current_user)
    
    result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
    scenario = result.scalar_one_or_none()
    
    if not scenario:
        raise HTTPException(status_code=404, detail="场景不存在")
    
    scenario.status = "archived"
    await db.commit()
    
    return {"success": True, "message": "场景已归档"}


@router.put("/scenarios/{scenario_id}/official")
async def toggle_official_scenario(
    scenario_id: str,
    is_official: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """标记/取消官方场景（管理员）"""
    require_admin(current_user)
    
    result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
    scenario = result.scalar_one_or_none()
    
    if not scenario:
        raise HTTPException(status_code=404, detail="场景不存在")
    
    scenario.is_official = is_official
    await db.commit()
    
    return {"success": True, "message": f"场景已{'标记为官方' if is_official else '取消官方标记'}"}


@router.put("/scenarios/{scenario_id}/featured")
async def toggle_featured_scenario(
    scenario_id: str,
    is_featured: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """标记/取消精选场景（管理员）"""
    require_admin(current_user)
    
    result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
    scenario = result.scalar_one_or_none()
    
    if not scenario:
        raise HTTPException(status_code=404, detail="场景不存在")
    
    scenario.is_featured = is_featured
    await db.commit()
    
    return {"success": True, "message": f"场景已{'标记为精选' if is_featured else '取消精选标记'}"}


@router.get("/scenarios/statistics")
async def get_scenarios_statistics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取场景统计（管理员）"""
    require_admin(current_user)
    
    total_scenarios = await db.scalar(select(func.count(Scenario.id))) or 0
    published_scenarios = await db.scalar(
        select(func.count(Scenario.id)).where(Scenario.status == "published")
    ) or 0
    official_scenarios = await db.scalar(
        select(func.count(Scenario.id)).where(Scenario.is_official == True)
    ) or 0
    featured_scenarios = await db.scalar(
        select(func.count(Scenario.id)).where(Scenario.is_featured == True)
    ) or 0
    user_created = await db.scalar(
        select(func.count(Scenario.id)).where(Scenario.created_by != None)
    ) or 0
    
    # 按赛道统计
    track_stats = []
    for track in ["sales", "social"]:
        count = await db.scalar(
            select(func.count(Scenario.id)).where(Scenario.track == track)
        ) or 0
        track_stats.append({"track": track, "count": count})
    
    # 按状态统计
    status_stats = []
    for status in ["draft", "published", "archived"]:
        count = await db.scalar(
            select(func.count(Scenario.id)).where(Scenario.status == status)
        ) or 0
        status_stats.append({"status": status, "count": count})
    
    # 按难度统计
    difficulty_stats = []
    for difficulty in range(1, 6):
        count = await db.scalar(
            select(func.count(Scenario.id)).where(Scenario.difficulty == difficulty)
        ) or 0
        difficulty_stats.append({"difficulty": difficulty, "count": count})
    
    # 总训练次数
    total_train_count = await db.scalar(select(func.sum(Scenario.train_count))) or 0
    
    return {
        "total_scenarios": total_scenarios,
        "published_scenarios": published_scenarios,
        "draft_scenarios": total_scenarios - published_scenarios,
        "official_scenarios": official_scenarios,
        "featured_scenarios": featured_scenarios,
        "user_created_scenarios": user_created,
        "total_train_count": total_train_count,
        "track_stats": track_stats,
        "status_stats": status_stats,
        "difficulty_stats": difficulty_stats,
    }



# ============ 用户管理增强 API ============


class UserUpdate(BaseModel):
    """更新用户信息"""
    nickname: str | None = None
    avatar: str | None = None
    track: str | None = None
    bio: str | None = None


class GrantVipRequest(BaseModel):
    """授予 VIP 请求"""
    level_id: str
    days: int = 30
    reason: str | None = None


@router.get("/users/{user_id}/detail")
async def get_user_detail(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取用户详情（管理员）"""
    require_admin(current_user)
    
    from app.models.membership import MembershipLevel, UserMembership
    from app.models.order import Order
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    # 获取会员信息
    membership_result = await db.execute(
        select(UserMembership)
        .options(selectinload(UserMembership.level))
        .where(UserMembership.user_id == user_id)
    )
    membership = membership_result.scalar_one_or_none()
    
    # 获取训练统计
    session_count = await db.scalar(
        select(func.count(Session.id)).where(Session.user_id == user_id)
    ) or 0
    
    avg_score = await db.scalar(
        select(func.avg(Report.total_score))
        .join(Session, Report.session_id == Session.id)
        .where(Session.user_id == user_id)
    )
    
    # 获取订单统计
    order_count = await db.scalar(
        select(func.count(Order.id)).where(Order.user_id == user_id)
    ) or 0
    
    total_spent = await db.scalar(
        select(func.sum(Order.amount))
        .where(Order.user_id == user_id, Order.status == "paid")
    ) or 0
    
    # 最近训练记录
    recent_sessions_result = await db.execute(
        select(Session)
        .where(Session.user_id == user_id)
        .order_by(Session.created_at.desc())
        .limit(5)
    )
    recent_sessions = recent_sessions_result.scalars().all()
    
    return {
        "id": user.id,
        "phone": user.phone,
        "nickname": user.nickname,
        "avatar": user.avatar,
        "role": user.role,
        "track": user.track,
        "level": user.level,
        "bio": user.bio,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        "membership": {
            "level_id": membership.level_id,
            "level_name": membership.level.name if membership.level else None,
            "expires_at": membership.expires_at.isoformat() if membership and membership.expires_at else None,
            "is_active": membership.is_active if membership else False,
        } if membership else None,
        "stats": {
            "session_count": session_count,
            "avg_score": round(avg_score, 1) if avg_score else 0,
            "order_count": order_count,
            "total_spent": float(total_spent),
        },
        "recent_sessions": [
            {
                "id": s.id,
                "scenario_id": s.scenario_id,
                "status": s.status,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in recent_sessions
        ],
    }


@router.put("/users/{user_id}/edit")
async def update_user_info(
    user_id: str,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新用户信息（管理员）"""
    require_admin(current_user)
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    update_fields = data.model_dump(exclude_unset=True)
    for field, value in update_fields.items():
        setattr(user, field, value)
    
    await db.commit()
    
    return {"success": True, "message": "用户信息已更新"}


@router.put("/users/{user_id}/ban")
async def ban_user(
    user_id: str,
    reason: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """封禁用户（管理员）"""
    require_admin(current_user)
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="不能封禁管理员账号")
    
    user.is_active = False
    await db.commit()
    
    return {"success": True, "message": "用户已封禁"}


@router.put("/users/{user_id}/unban")
async def unban_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """解封用户（管理员）"""
    require_admin(current_user)
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    user.is_active = True
    await db.commit()
    
    return {"success": True, "message": "用户已解封"}


@router.post("/users/{user_id}/grant-vip")
async def grant_user_vip(
    user_id: str,
    data: GrantVipRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """手动授予用户 VIP（管理员）"""
    require_admin(current_user)
    
    import uuid
    from app.models.membership import MembershipLevel, UserMembership
    
    # 检查用户
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    # 检查 VIP 等级
    level_result = await db.execute(
        select(MembershipLevel).where(MembershipLevel.id == data.level_id)
    )
    level = level_result.scalar_one_or_none()
    if not level:
        raise HTTPException(status_code=404, detail="VIP 等级不存在")
    
    # 查找现有会员记录
    membership_result = await db.execute(
        select(UserMembership).where(UserMembership.user_id == user_id)
    )
    membership = membership_result.scalar_one_or_none()
    
    expires_at = datetime.utcnow() + timedelta(days=data.days)
    
    if membership:
        # 更新现有会员
        if membership.expires_at and membership.expires_at > datetime.utcnow():
            # 如果还没过期，在现有基础上延长
            expires_at = membership.expires_at + timedelta(days=data.days)
        membership.level_id = data.level_id
        membership.expires_at = expires_at
        membership.is_active = True
    else:
        # 创建新会员记录
        membership = UserMembership(
            id=str(uuid.uuid4()),
            user_id=user_id,
            level_id=data.level_id,
            expires_at=expires_at,
            is_active=True,
        )
        db.add(membership)
    
    await db.commit()
    
    return {
        "success": True,
        "message": f"已授予用户 {level.name} 会员 {data.days} 天",
        "expires_at": expires_at.isoformat(),
    }


@router.get("/users/statistics")
async def get_users_statistics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取用户统计（管理员）"""
    require_admin(current_user)
    
    from app.models.membership import UserMembership
    
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)
    
    total_users = await db.scalar(select(func.count(User.id))) or 0
    active_users = await db.scalar(
        select(func.count(User.id)).where(User.is_active == True)
    ) or 0
    banned_users = await db.scalar(
        select(func.count(User.id)).where(User.is_active == False)
    ) or 0
    admin_users = await db.scalar(
        select(func.count(User.id)).where(User.role == "admin")
    ) or 0
    
    new_today = await db.scalar(
        select(func.count(User.id)).where(User.created_at >= today_start)
    ) or 0
    new_week = await db.scalar(
        select(func.count(User.id)).where(User.created_at >= week_start)
    ) or 0
    new_month = await db.scalar(
        select(func.count(User.id)).where(User.created_at >= month_start)
    ) or 0
    
    # VIP 用户数
    vip_users = await db.scalar(
        select(func.count(UserMembership.id))
        .where(UserMembership.is_active == True, UserMembership.expires_at > datetime.utcnow())
    ) or 0
    
    # 按赛道统计
    sales_users = await db.scalar(
        select(func.count(User.id)).where(User.track == "sales")
    ) or 0
    social_users = await db.scalar(
        select(func.count(User.id)).where(User.track == "social")
    ) or 0
    
    return {
        "total_users": total_users,
        "active_users": active_users,
        "banned_users": banned_users,
        "admin_users": admin_users,
        "vip_users": vip_users,
        "new_today": new_today,
        "new_week": new_week,
        "new_month": new_month,
        "track_stats": {
            "sales": sales_users,
            "social": social_users,
        },
    }
