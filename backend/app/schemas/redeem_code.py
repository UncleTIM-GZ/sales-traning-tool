"""
开发：Excellent（11964948@qq.com）
功能：兑换码系统Pydantic模型
作用：定义兑换码相关的请求/响应模型
创建时间：2024-12-24
最后修改：2024-12-24
"""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class RewardType(str, Enum):
    """奖励类型"""
    VIP_DAYS = "vip_days"
    POINTS = "points"


# ========== 用户端 ==========

class RedeemRequest(BaseModel):
    """兑换请求"""
    code: str = Field(..., min_length=1, max_length=50, description="兑换码")


class RedeemResponse(BaseModel):
    """兑换响应"""
    success: bool
    reward_type: str
    reward_value: int
    message: str
    # 额外信息
    vip_extended_to: datetime | None = None
    points_added: int | None = None
    new_points_balance: int | None = None


# ========== 管理端 ==========

class RedeemCodeBase(BaseModel):
    """兑换码基础模型"""
    code: str | None = Field(None, max_length=50, description="兑换码，不填则自动生成")
    reward_type: RewardType = Field(..., description="奖励类型: vip_days, points")
    reward_value: int = Field(..., gt=0, description="奖励值（VIP天数或积分数量）")
    vip_level: str | None = Field(None, description="指定VIP等级（仅vip_days类型有效）")
    usage_limit: int = Field(1, ge=-1, description="使用次数限制，-1为无限")
    per_user_limit: int = Field(1, ge=1, description="每用户使用次数限制")
    valid_from: datetime | None = Field(None, description="生效时间，不填则立即生效")
    valid_until: datetime = Field(..., description="过期时间")
    description: str | None = Field(None, max_length=500, description="备注")


class RedeemCodeCreate(RedeemCodeBase):
    """创建兑换码请求"""
    pass


class RedeemCodeUpdate(BaseModel):
    """更新兑换码请求"""
    reward_type: RewardType | None = None
    reward_value: int | None = Field(None, gt=0)
    vip_level: str | None = None
    usage_limit: int | None = Field(None, ge=-1)
    per_user_limit: int | None = Field(None, ge=1)
    valid_from: datetime | None = None
    valid_until: datetime | None = None
    is_active: bool | None = None
    description: str | None = None


class RedeemCodeResponse(BaseModel):
    """兑换码响应"""
    id: str
    code: str
    reward_type: str
    reward_value: int
    vip_level: str | None = None
    usage_limit: int
    used_count: int
    per_user_limit: int
    valid_from: datetime
    valid_until: datetime
    is_active: bool
    description: str | None = None
    batch_id: str | None = None
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime
    # 计算字段
    remaining_uses: int
    is_valid: bool
    is_expired: bool
    is_exhausted: bool

    class Config:
        from_attributes = True


class RedeemCodeListResponse(BaseModel):
    """兑换码列表响应"""
    items: list[RedeemCodeResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class RedeemCodeBatchCreate(BaseModel):
    """批量创建兑换码请求"""
    count: int = Field(..., ge=1, le=1000, description="生成数量，最多1000个")
    prefix: str | None = Field(None, max_length=10, description="兑换码前缀")
    reward_type: RewardType = Field(..., description="奖励类型")
    reward_value: int = Field(..., gt=0, description="奖励值")
    vip_level: str | None = Field(None, description="指定VIP等级")
    usage_limit: int = Field(1, ge=-1, description="每个码的使用次数限制")
    per_user_limit: int = Field(1, ge=1, description="每用户使用次数限制")
    valid_from: datetime | None = None
    valid_until: datetime = Field(..., description="过期时间")
    description: str | None = None


class RedeemCodeBatchResponse(BaseModel):
    """批量创建兑换码响应"""
    batch_id: str
    count: int
    codes: list[str]


# ========== 兑换记录 ==========

class RedeemLogResponse(BaseModel):
    """兑换记录响应"""
    id: str
    code_id: str
    code: str  # 兑换码
    user_id: str
    user_nickname: str | None = None
    reward_type: str
    reward_value: int
    vip_extended_to: datetime | None = None
    points_added: int | None = None
    redeemed_at: datetime
    ip_address: str | None = None

    class Config:
        from_attributes = True


class RedeemLogListResponse(BaseModel):
    """兑换记录列表响应"""
    items: list[RedeemLogResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ========== 统计 ==========

class RedeemCodeStatistics(BaseModel):
    """兑换码统计"""
    total_codes: int
    active_codes: int
    expired_codes: int
    exhausted_codes: int
    total_redeemed: int
    total_vip_days_given: int
    total_points_given: int


# ========== 导出 ==========

class RedeemCodeExportRequest(BaseModel):
    """导出兑换码请求"""
    batch_id: str | None = Field(None, description="按批次导出")
    reward_type: RewardType | None = Field(None, description="按奖励类型筛选")
    is_active: bool | None = Field(None, description="按状态筛选")
    include_used: bool = Field(True, description="是否包含已使用的码")
