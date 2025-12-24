"""API V1 路由"""

from fastapi import APIRouter

from app.api.v1 import (
    admin,
    admin_plaza,
    auth,
    community,
    coupons,
    courses,
    dashboard,
    friends,
    incentive,
    notifications,
    orders,
    payment,
    plaza,
    points,
    realtime,
    redeem_codes,
    reports,
    scenarios,
    security,
    sessions,
    settings,
    social,
    training,
    upload,
    users,
    vip,
    wechat_auth,
)

api_router = APIRouter()

# 认证路由
api_router.include_router(auth.router, prefix="/auth", tags=["认证"])

# 微信登录路由
api_router.include_router(wechat_auth.router, prefix="/auth/wechat", tags=["微信登录"])

# 用户路由
api_router.include_router(users.router, prefix="/users", tags=["用户"])

# 场景路由
api_router.include_router(scenarios.router, prefix="/scenarios", tags=["场景"])

# 会话路由
api_router.include_router(sessions.router, prefix="/sessions", tags=["会话"])

# 训练计划路由
api_router.include_router(training.router, prefix="/training", tags=["训练计划"])

# 报告路由
api_router.include_router(reports.router, prefix="/reports", tags=["报告"])

# 仪表盘路由
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["仪表盘"])

# 课程路由
api_router.include_router(courses.router, prefix="/courses", tags=["课程"])

# 社区路由
api_router.include_router(community.router, prefix="/community", tags=["社区"])

# 设置路由
api_router.include_router(settings.router, prefix="/settings", tags=["设置"])

# 实时语音路由 (WebSocket)
api_router.include_router(realtime.router, prefix="/ws", tags=["实时语音"])

# 管理后台路由
api_router.include_router(admin.router, prefix="/admin", tags=["管理后台"])

# 管理后台 - 仪表盘（单独路由以便细粒度控制）
from app.api.v1.admin_modules import dashboard as admin_dashboard
api_router.include_router(admin_dashboard.router, prefix="/admin/dashboard", tags=["管理后台-仪表盘"])


# 文件上传路由
api_router.include_router(upload.router, prefix="/upload", tags=["文件上传"])

# 社交路由
api_router.include_router(social.router, prefix="/social", tags=["社交分享"])

# 激励系统路由
api_router.include_router(incentive.router, prefix="/incentive", tags=["激励系统"])

# 通知路由
api_router.include_router(notifications.router, prefix="/notifications", tags=["通知"])

# 广场路由 (场景社交 + 积分、成就、排行榜等扩展功能)
api_router.include_router(plaza.router, prefix="/plaza", tags=["场景广场"])

# 好友路由
api_router.include_router(friends.router, prefix="/friends", tags=["好友"])

# 安全设置路由
api_router.include_router(security.router, prefix="/security", tags=["安全设置"])

# 广场后台管理路由
api_router.include_router(admin_plaza.router, prefix="/admin/plaza-manage", tags=["广场后台管理"])

# VIP会员路由
api_router.include_router(vip.router, prefix="/vip", tags=["VIP会员"])

# 订单路由 (router already has prefix="/orders")
api_router.include_router(orders.router, tags=["订单"])

# 积分路由 (router already has prefix="/points")
api_router.include_router(points.router, tags=["积分"])

# 优惠券路由 (router already has prefix="/coupons")
api_router.include_router(coupons.router, tags=["优惠券"])

# 支付路由
api_router.include_router(payment.router, prefix="/payment", tags=["支付"])

# 兑换码路由
api_router.include_router(redeem_codes.router, tags=["兑换码"])
