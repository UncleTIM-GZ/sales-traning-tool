"""
开发：Excellent（11964948@qq.com）
功能：VIP会员系统Pydantic模型
作用：定义会员等级、订阅相关的请求/响应模型
创建时间：2025-12-24
最后修改：2025-12-24
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ========== 会员等级 ==========

class MembershipLevelBase(BaseModel):
    """会员等级基础模型"""
    name: str
    display_name: str
    description: str | None = None
    price_monthly: int = 0
    price_quarterly: int = 0
    price_half_yearly: int = 0
    price_yearly: int = 0
    privileges: dict[str, Any] = Field(default_factory=dict)
    sort_order: int = 0
    is_active: bool = True


class MembershipLevelResponse(MembershipLevelBase):
    """会员等级响应"""
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MembershipLevelListResponse(BaseModel):
    """会员等级列表响应"""
    levels: list[MembershipLevelResponse]


# ========== 订阅 ==========

class SubscriptionBase(BaseModel):
    """订阅基础模型"""
    level_id: str
    status: str
    started_at: datetime
    expires_at: datetime


class SubscriptionResponse(SubscriptionBase):
    """订阅响应"""
    id: str
    user_id: str
    order_id: str | None = None
    level: MembershipLevelResponse | None = None
    days_remaining: int = 0
    is_active: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SubscriptionCreateRequest(BaseModel):
    """创建订阅请求（购买会员）"""
    level_name: str = Field(..., description="会员等级名称: free, pro, enterprise")
    duration_months: int = Field(..., ge=1, le=12, description="订阅时长（月）: 1, 3, 6, 12")
    payment_method: str = Field(..., description="支付方式: wechat, alipay")
    payment_channel: str = Field(..., description="支付渠道")
    coupon_code: str | None = Field(None, description="优惠券码")
    points_to_use: int = Field(0, ge=0, description="使用积分数量")


class SubscriptionExtendRequest(BaseModel):
    """续费订阅请求"""
    duration_months: int = Field(..., ge=1, le=12, description="续费时长（月）")
    payment_method: str
    payment_channel: str
    coupon_code: str | None = None
    points_to_use: int = 0


# ========== 用户会员状态 ==========

class UserVIPStatusResponse(BaseModel):
    """用户VIP状态响应"""
    user_id: str
    current_level: MembershipLevelResponse | None = None
    subscription: SubscriptionResponse | None = None
    is_vip: bool = False
    days_remaining: int = 0
    privileges: dict[str, Any] = Field(default_factory=dict)


class VIPPrivilegeCheckResponse(BaseModel):
    """权益检查响应"""
    has_privilege: bool
    privilege_name: str
    privilege_value: Any = None
    message: str | None = None


# ========== 价格计算 ==========

class PriceCalculateRequest(BaseModel):
    """价格计算请求"""
    level_name: str
    duration_months: int
    coupon_code: str | None = None
    points_to_use: int = 0


class PriceCalculateResponse(BaseModel):
    """价格计算响应"""
    original_price: int = Field(..., description="原价（分）")
    coupon_discount: int = Field(0, description="优惠券折扣（分）")
    points_discount: int = Field(0, description="积分抵扣（分）")
    final_price: int = Field(..., description="最终价格（分）")
    points_to_use: int = Field(0, description="使用积分数量")
    coupon_code: str | None = None
    coupon_name: str | None = None
