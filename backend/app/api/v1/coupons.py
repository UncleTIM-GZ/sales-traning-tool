"""
开发：Excellent（11964948@qq.com）
功能：优惠券API路由
作用：提供优惠券列表、领取、验证接口
创建时间：2025-12-24
最后修改：2025-12-24
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.coupon import (
    CouponResponse,
    CouponListResponse,
    UserCouponResponse,
    UserCouponListResponse,
    CouponClaimRequest,
    CouponClaimResponse,
    CouponValidateRequest,
    CouponValidateResponse,
)
from app.services.coupon_service import CouponService

router = APIRouter(prefix="/coupons", tags=["优惠券"])


@router.get("", response_model=CouponListResponse)
async def get_available_coupons(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """获取可领取的优惠券列表"""
    coupon_service = CouponService(db)
    coupons, total = await coupon_service.get_active_coupons(page, page_size)
    
    return CouponListResponse(
        coupons=[CouponResponse.model_validate(c) for c in coupons],
        total=total,
    )


@router.get("/my", response_model=UserCouponListResponse)
async def get_my_coupons(
    status: str | None = Query(None, description="状态: available, used, expired"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取我的优惠券列表"""
    coupon_service = CouponService(db)
    user_coupons, total = await coupon_service.get_user_coupons(
        current_user.id, status, page, page_size
    )
    
    return UserCouponListResponse(
        coupons=[UserCouponResponse.model_validate(uc) for uc in user_coupons],
        total=total,
    )


@router.get("/available")
async def get_available_for_order(
    product_type: str = Query(..., description="商品类型"),
    order_amount: int = Query(0, ge=0, description="订单金额（分）"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取订单可用的优惠券"""
    coupon_service = CouponService(db)
    user_coupons = await coupon_service.get_user_available_coupons(
        current_user.id, product_type, order_amount
    )
    
    return {
        "coupons": [
            {
                "user_coupon_id": uc.id,
                "coupon": CouponResponse.model_validate(uc.coupon),
                "discount": uc.coupon.calculate_discount(order_amount) if order_amount > 0 else 0,
            }
            for uc in user_coupons
        ]
    }


@router.post("/claim", response_model=CouponClaimResponse)
async def claim_coupon(
    request: CouponClaimRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """领取优惠券"""
    coupon_service = CouponService(db)
    user_coupon, error = await coupon_service.claim_coupon(
        current_user.id, request.coupon_code
    )
    
    if error:
        return CouponClaimResponse(
            success=False,
            message=error,
        )
    
    return CouponClaimResponse(
        success=True,
        user_coupon=UserCouponResponse.model_validate(user_coupon),
    )


@router.post("/validate", response_model=CouponValidateResponse)
async def validate_coupon(
    request: CouponValidateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """验证优惠券"""
    coupon_service = CouponService(db)
    coupon, discount, error = await coupon_service.validate_coupon(
        current_user.id,
        request.coupon_code,
        request.order_amount,
        request.product_type,
    )
    
    if error:
        return CouponValidateResponse(
            is_valid=False,
            message=error,
        )
    
    return CouponValidateResponse(
        is_valid=True,
        coupon=CouponResponse.model_validate(coupon) if coupon else None,
        discount_amount=discount,
    )
