"""社交API - 分享与邀请"""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.api.deps import CurrentUserId, DatabaseSession
from app.services.social_service import SocialService


router = APIRouter()


# ===== Schemas =====

class InviteCodeResponse(BaseModel):
    """邀请码响应"""
    code: str
    use_count: int
    share_url: str


class ReferralStatsResponse(BaseModel):
    """邀请统计响应"""
    invite_code: str
    total_invites: int
    completed_invites: int
    points_earned: int


class ReferralItem(BaseModel):
    """邀请记录项"""
    id: str
    referee_nickname: str | None = None
    status: str
    registered_at: datetime | None
    completed_at: datetime | None


class ReferralsResponse(BaseModel):
    """邀请列表响应"""
    items: list[ReferralItem]
    total: int


class ShareRequest(BaseModel):
    """分享请求"""
    share_type: str  # report, achievement, leaderboard, invite
    channel: str     # wechat, wechat_moments, copy_link, poster
    content_id: str | None = None


class ShareResponse(BaseModel):
    """分享响应"""
    success: bool
    share_url: str | None = None
    message: str = "分享成功"


class ValidateCodeRequest(BaseModel):
    """验证邀请码请求"""
    code: str


class ValidateCodeResponse(BaseModel):
    """验证邀请码响应"""
    valid: bool
    referrer_id: str | None = None


# ===== 邀请码 API =====

@router.get("/invite-code", response_model=InviteCodeResponse)
async def get_invite_code(
    user_id: CurrentUserId,
    db: DatabaseSession,
):
    """获取我的邀请码"""
    service = SocialService(db)
    invite_code = await service.get_or_create_invite_code(user_id)
    
    # 生成分享链接
    share_url = f"/register?invite={invite_code.code}"
    
    return InviteCodeResponse(
        code=invite_code.code,
        use_count=invite_code.use_count,
        share_url=share_url,
    )


@router.post("/validate-code", response_model=ValidateCodeResponse)
async def validate_invite_code(
    db: DatabaseSession,
    body: ValidateCodeRequest,
):
    """验证邀请码（注册时使用）"""
    service = SocialService(db)
    invite_code = await service.validate_invite_code(body.code)
    
    return ValidateCodeResponse(
        valid=invite_code is not None,
        referrer_id=invite_code.user_id if invite_code else None,
    )


# ===== 邀请统计 API =====

@router.get("/stats", response_model=ReferralStatsResponse)
async def get_referral_stats(
    user_id: CurrentUserId,
    db: DatabaseSession,
):
    """获取邀请统计"""
    service = SocialService(db)
    
    # 获取邀请码
    invite_code = await service.get_or_create_invite_code(user_id)
    
    # 获取统计
    stats = await service.get_referral_stats(user_id)
    
    return ReferralStatsResponse(
        invite_code=invite_code.code,
        total_invites=stats["total_invites"],
        completed_invites=stats["completed_invites"],
        points_earned=stats["points_earned"],
    )


@router.get("/referrals", response_model=ReferralsResponse)
async def get_referrals(
    user_id: CurrentUserId,
    db: DatabaseSession,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
):
    """获取邀请列表"""
    service = SocialService(db)
    referrals, total = await service.get_referral_list(
        user_id=user_id,
        limit=size,
        offset=(page - 1) * size,
    )
    
    return ReferralsResponse(
        items=[
            ReferralItem(
                id=r.id,
                referee_nickname=None,  # 需要关联查询用户表
                status=r.status,
                registered_at=r.registered_at,
                completed_at=r.completed_at,
            )
            for r in referrals
        ],
        total=total,
    )


# ===== 分享 API =====

@router.post("/share", response_model=ShareResponse)
async def record_share(
    user_id: CurrentUserId,
    db: DatabaseSession,
    body: ShareRequest,
):
    """记录分享行为"""
    service = SocialService(db)
    
    # 生成分享URL
    share_url = None
    if body.share_type == "report" and body.content_id:
        share_url = f"/report/{body.content_id}"
    elif body.share_type == "invite":
        invite_code = await service.get_or_create_invite_code(user_id)
        share_url = f"/register?invite={invite_code.code}"
    
    # 记录分享
    await service.record_share(
        user_id=user_id,
        share_type=body.share_type,
        channel=body.channel,
        content_id=body.content_id,
        share_url=share_url,
    )
    
    return ShareResponse(
        success=True,
        share_url=share_url,
        message="分享成功",
    )


@router.get("/share/stats")
async def get_share_stats(
    user_id: CurrentUserId,
    db: DatabaseSession,
):
    """获取分享统计"""
    service = SocialService(db)
    stats = await service.get_share_stats(user_id)
    return stats
