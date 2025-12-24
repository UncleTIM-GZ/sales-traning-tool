"""
开发：Excellent（11964948@qq.com）
功能：优惠券系统Pydantic模型
作用：定义优惠券相关的请求/响应模型
创建时间：2025-12-24
最后修改：2025-12-24
"""

from datetime import datetime

from pydantic import BaseModel, Field


# ========== 优惠券 ==========

class CouponBase(BaseModel):
    """优惠券基础模型"""
    code: str
    name: str
    description: str | None = None
    type: str = Field(..., description="类型: fixed, percentage")
    value: int = Field(..., description="固定金额(分)或百分比(1-100)")
    max_discount: int | None = Field(None, description="百分比类型的最大折扣金额")
    min_order_amount: int = Field(0, description="最低订单金额")
    applicable_products: list[str] | None = None
    valid_from: datetime
    valid_until: datetime


class CouponResponse(CouponBase):
    """优惠券响应"""
    id: str
    usage_limit: int = -1
    used_count: int = 0
    per_user_limit: int = 1
    is_active: bool = True
    is_valid: bool = True
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CouponListResponse(BaseModel):
    """优惠券列表响应"""
    coupons: list[CouponResponse]
    total: int


# ========== 用户优惠券 ==========

class UserCouponResponse(BaseModel):
    """用户优惠券响应"""
    id: str
    user_id: str
    coupon_id: str
    coupon: CouponResponse | None = None
    status: str = Field(..., description="状态: available, used, expired")
    used_order_id: str | None = None
    received_at: datetime
    used_at: datetime | None = None
    is_available: bool = True

    class Config:
        from_attributes = True


class UserCouponListResponse(BaseModel):
    """用户优惠券列表响应"""
    coupons: list[UserCouponResponse]
    total: int


# ========== 优惠券操作 ==========

class CouponClaimRequest(BaseModel):
    """领取优惠券请求"""
    coupon_code: str


class CouponClaimResponse(BaseModel):
    """领取优惠券响应"""
    success: bool
    user_coupon: UserCouponResponse | None = None
    message: str | None = None


class CouponValidateRequest(BaseModel):
    """验证优惠券请求"""
    coupon_code: str
    order_amount: int = Field(..., gt=0, description="订单金额（分）")
    product_type: str = Field(..., description="商品类型")


class CouponValidateResponse(BaseModel):
    """验证优惠券响应"""
    is_valid: bool
    coupon: CouponResponse | None = None
    discount_amount: int = 0
    message: str | None = None


# ========== 管理后台 ==========

class CouponCreateRequest(BaseModel):
    """创建优惠券请求"""
    code: str | None = Field(None, description="优惠券码，不填则自动生成")
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    type: str = Field(..., description="类型: fixed, percentage")
    value: int = Field(..., gt=0)
    max_discount: int | None = None
    min_order_amount: int = Field(0, ge=0)
    applicable_products: list[str] | None = None
    valid_from: datetime
    valid_until: datetime
    usage_limit: int = Field(-1, description="-1表示无限")
    per_user_limit: int = Field(1, ge=1)
    user_ids: list[str] | None = Field(None, description="指定用户ID列表")


class CouponUpdateRequest(BaseModel):
    """更新优惠券请求"""
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None
    valid_until: datetime | None = None
    usage_limit: int | None = None
