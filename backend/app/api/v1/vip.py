"""
开发：Excellent（11964948@qq.com）
功能：VIP会员API路由
作用：提供会员等级、订阅、权益查询接口
创建时间：2025-12-24
最后修改：2025-12-24
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.vip import (
    MembershipLevelListResponse,
    MembershipLevelResponse,
    SubscriptionResponse,
    UserVIPStatusResponse,
    VIPPrivilegeCheckResponse,
    PriceCalculateRequest,
    PriceCalculateResponse,
)
from app.services.vip_service import VIPService
from app.services.coupon_service import CouponService
from app.services.points_service import PointsService

router = APIRouter()


@router.get("/levels", response_model=MembershipLevelListResponse)
async def get_membership_levels(
    db: AsyncSession = Depends(get_db),
):
    """获取会员等级列表"""
    vip_service = VIPService(db)
    levels = await vip_service.get_all_levels()
    return MembershipLevelListResponse(
        levels=[MembershipLevelResponse.model_validate(level) for level in levels]
    )


@router.get("/status", response_model=UserVIPStatusResponse)
async def get_vip_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取当前用户VIP状态"""
    vip_service = VIPService(db)
    vip_status = await vip_service.get_user_vip_status(current_user.id)
    return vip_status


@router.get("/subscription", response_model=SubscriptionResponse | None)
async def get_current_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取当前订阅信息"""
    vip_service = VIPService(db)
    subscription = await vip_service.get_user_active_subscription(current_user.id)
    if not subscription:
        return None
    return SubscriptionResponse.model_validate(subscription)


@router.get("/subscriptions")
async def get_subscription_history(
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取订阅历史"""
    vip_service = VIPService(db)
    subscriptions = await vip_service.get_user_subscriptions(current_user.id, limit)
    return {
        "subscriptions": [
            SubscriptionResponse.model_validate(sub) for sub in subscriptions
        ]
    }


@router.get("/privilege/{privilege_name}", response_model=VIPPrivilegeCheckResponse)
async def check_privilege(
    privilege_name: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """检查用户是否拥有某项权益"""
    vip_service = VIPService(db)
    has_privilege, value = await vip_service.check_privilege(
        current_user.id, privilege_name
    )
    return VIPPrivilegeCheckResponse(
        has_privilege=has_privilege,
        privilege_name=privilege_name,
        privilege_value=value,
    )


@router.post("/calculate-price", response_model=PriceCalculateResponse)
async def calculate_price(
    request: PriceCalculateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """计算订阅价格"""
    vip_service = VIPService(db)
    coupon_service = CouponService(db)
    points_service = PointsService(db)

    # 获取等级
    level = await vip_service.get_level_by_name(request.level_name)
    if not level:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的会员等级",
        )

    original_price = level.get_price(request.duration_months)
    coupon_discount = 0
    coupon_name = None

    # 验证优惠券
    if request.coupon_code:
        coupon, discount, error = await coupon_service.validate_coupon(
            current_user.id,
            request.coupon_code,
            original_price,
            "membership",
        )
        if coupon:
            coupon_discount = discount
            coupon_name = coupon.name

    # 计算积分抵扣
    points_to_use = 0
    points_discount = 0
    if request.points_to_use > 0:
        actual_points, actual_discount = points_service.calculate_points_discount(
            request.points_to_use, original_price - coupon_discount
        )
        points_to_use = actual_points
        points_discount = actual_discount

    final_price = max(0, original_price - coupon_discount - points_discount)

    return PriceCalculateResponse(
        original_price=original_price,
        coupon_discount=coupon_discount,
        points_discount=points_discount,
        final_price=final_price,
        points_to_use=points_to_use,
        coupon_code=request.coupon_code if coupon_discount > 0 else None,
        coupon_name=coupon_name,
    )
