"""
开发：Excellent（11964948@qq.com）
功能：支付API路由
作用：提供创建支付、回调通知、退款接口
创建时间：2025-12-24
最后修改：2025-12-24
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.payment import (
    PaymentCreateRequest,
    PaymentCreateResponse,
    PaymentQueryResponse,
    RefundRequest,
    RefundResponse,
)
from app.services.payment_service import PaymentService
from app.services.order_service import OrderService

router = APIRouter()


@router.get("/methods")
async def get_payment_methods(
    db: AsyncSession = Depends(get_db),
):
    """获取可用的支付方式"""
    payment_service = PaymentService(db)
    methods = await payment_service.get_available_methods()
    return {"methods": methods}


@router.post("/create", response_model=PaymentCreateResponse)
async def create_payment(
    request: PaymentCreateRequest,
    req: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建支付"""
    payment_service = PaymentService(db)
    order_service = OrderService(db)

    # 验证订单归属
    order = await order_service.get_order_by_id(request.order_id)
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

    # 获取客户端IP
    client_ip = req.client.host if req.client else "127.0.0.1"

    result = await payment_service.create_payment(
        request.order_id,
        request.payment_method,
        request.payment_channel,
        client_ip,
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "创建支付失败"),
        )

    return PaymentCreateResponse(**result)


@router.get("/query/{order_id}", response_model=PaymentQueryResponse)
async def query_payment(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """查询支付状态"""
    payment_service = PaymentService(db)
    order_service = OrderService(db)

    # 验证订单归属
    order = await order_service.get_order_by_id(order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="订单不存在",
        )

    if order.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权查询此订单",
        )

    result = await payment_service.query_payment_status(order_id)
    return PaymentQueryResponse(**result)


@router.post("/notify/wechat")
async def wechat_notify(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """微信支付回调"""
    payment_service = PaymentService(db)

    body = await request.body()
    headers = dict(request.headers)

    success, message = await payment_service.handle_wechat_notify(body, headers)

    if success:
        # 支付成功后的业务处理
        # 这里需要根据订单类型处理不同的业务逻辑
        # 例如：会员订阅激活、积分发放等
        return Response(
            content='{"code": "SUCCESS", "message": "成功"}',
            media_type="application/json",
        )
    else:
        return Response(
            content=f'{{"code": "FAIL", "message": "{message}"}}',
            media_type="application/json",
            status_code=400,
        )


@router.post("/notify/alipay")
async def alipay_notify(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """支付宝回调"""
    payment_service = PaymentService(db)

    form_data = await request.form()
    params = dict(form_data)

    success, message = await payment_service.handle_alipay_notify(params)

    if success:
        return Response(content="success", media_type="text/plain")
    else:
        return Response(content="fail", media_type="text/plain")


@router.post("/refund", response_model=RefundResponse)
async def create_refund(
    request: RefundRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """申请退款"""
    payment_service = PaymentService(db)

    result = await payment_service.create_refund(
        request.order_id,
        current_user.id,
        request.reason,
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "退款申请失败"),
        )

    return RefundResponse(**result)
