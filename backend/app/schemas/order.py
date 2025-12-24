"""
开发：Excellent（11964948@qq.com）
功能：订单系统Pydantic模型
作用：定义订单、退款相关的请求/响应模型
创建时间：2025-12-24
最后修改：2025-12-24
"""

from datetime import datetime

from pydantic import BaseModel, Field


# ========== 订单 ==========

class OrderBase(BaseModel):
    """订单基础模型"""
    product_type: str
    product_id: str
    product_name: str
    product_desc: str | None = None
    original_amount: int
    discount_amount: int = 0
    points_discount: int = 0
    final_amount: int


class OrderCreateRequest(BaseModel):
    """创建订单请求"""
    product_type: str = Field(..., description="商品类型: membership, points_package, scenario")
    product_id: str = Field(..., description="商品ID")
    coupon_code: str | None = Field(None, description="优惠券码")
    points_to_use: int = Field(0, ge=0, description="使用积分数量")


class OrderResponse(OrderBase):
    """订单响应"""
    id: str
    order_no: str
    user_id: str
    coupon_id: str | None = None
    coupon_code: str | None = None
    points_used: int = 0
    payment_method: str | None = None
    payment_channel: str | None = None
    transaction_id: str | None = None
    status: str
    created_at: datetime
    paid_at: datetime | None = None
    cancelled_at: datetime | None = None
    expires_at: datetime
    is_expired: bool = False
    can_pay: bool = False
    can_refund: bool = False

    class Config:
        from_attributes = True


class OrderListResponse(BaseModel):
    """订单列表响应"""
    orders: list[OrderResponse]
    total: int
    page: int
    page_size: int


class OrderPayRequest(BaseModel):
    """订单支付请求"""
    payment_method: str = Field(..., description="支付方式: wechat, alipay")
    payment_channel: str = Field(..., description="支付渠道")


class OrderCancelRequest(BaseModel):
    """取消订单请求"""
    reason: str | None = Field(None, description="取消原因")


# ========== 退款 ==========

class RefundCreateRequest(BaseModel):
    """创建退款请求"""
    order_id: str
    reason: str = Field(..., min_length=1, max_length=500)


class RefundResponse(BaseModel):
    """退款响应"""
    id: str
    refund_no: str
    order_id: str
    user_id: str
    amount: int
    reason: str
    status: str
    refund_id: str | None = None
    error_msg: str | None = None
    created_at: datetime
    processed_at: datetime | None = None

    class Config:
        from_attributes = True


class RefundListResponse(BaseModel):
    """退款列表响应"""
    refunds: list[RefundResponse]
    total: int
