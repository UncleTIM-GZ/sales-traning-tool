"""
开发：Excellent（11964948@qq.com）
功能：订单API路由
作用：提供订单列表、详情、取消接口
创建时间：2025-12-24
最后修改：2025-12-24
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.order import (
    OrderResponse,
    OrderListResponse,
    OrderCancelRequest,
    RefundCreateRequest,
    RefundResponse,
)
from app.services.order_service import OrderService
from app.services.points_service import PointsService
from app.services.coupon_service import CouponService

router = APIRouter(prefix="/orders", tags=["订单"])


@router.get("", response_model=OrderListResponse)
async def get_orders(
    status: str | None = Query(None, description="订单状态筛选"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取订单列表"""
    order_service = OrderService(db)
    orders, total = await order_service.get_user_orders(
        current_user.id, status, page, page_size
    )
    return OrderListResponse(
        orders=[OrderResponse.model_validate(order) for order in orders],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取订单详情"""
    order_service = OrderService(db)
    order = await order_service.get_order_by_id(order_id)
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="订单不存在",
        )
    
    if order.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权访问此订单",
        )
    
    return OrderResponse.model_validate(order)


@router.post("/{order_id}/cancel")
async def cancel_order(
    order_id: str,
    request: OrderCancelRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """取消订单"""
    order_service = OrderService(db)
    points_service = PointsService(db)
    coupon_service = CouponService(db)

    order = await order_service.get_order_by_id(order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="订单不存在",
        )

    if order.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权操作此订单",
        )

    # 取消订单
    cancelled_order = await order_service.cancel_order(order_id, current_user.id)
    if not cancelled_order:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="订单无法取消",
        )

    # 释放锁定的积分
    if order.points_lock_id:
        await points_service.release_lock(order.points_lock_id)

    # 恢复优惠券
    if order.coupon_id:
        await coupon_service.restore_coupon(current_user.id, order_id)

    return {"message": "订单已取消"}


@router.post("/{order_id}/refund", response_model=RefundResponse)
async def request_refund(
    order_id: str,
    request: RefundCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """申请退款"""
    order_service = OrderService(db)

    order = await order_service.get_order_by_id(order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="订单不存在",
        )

    if order.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权操作此订单",
        )

    if not order.can_refund:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="订单不支持退款",
        )

    refund = await order_service.create_refund(
        order_id, current_user.id, request.reason
    )
    if not refund:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="创建退款失败",
        )

    return RefundResponse.model_validate(refund)


@router.get("/{order_id}/refunds")
async def get_order_refunds(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取订单退款记录"""
    order_service = OrderService(db)

    order = await order_service.get_order_by_id(order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="订单不存在",
        )

    if order.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权访问此订单",
        )

    refunds = await order_service.get_order_refunds(order_id)
    return {
        "refunds": [RefundResponse.model_validate(r) for r in refunds]
    }
