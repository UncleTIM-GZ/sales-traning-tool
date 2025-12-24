"""
开发：Excellent（11964948@qq.com）
功能：积分系统Pydantic模型
作用：定义积分账户、交易记录相关的请求/响应模型
创建时间：2025-12-24
最后修改：2025-12-24
"""

from datetime import datetime

from pydantic import BaseModel, Field


# ========== 积分账户 ==========

class PointsAccountResponse(BaseModel):
    """积分账户响应"""
    id: str
    user_id: str
    balance: int = Field(..., description="可用积分")
    locked: int = Field(0, description="锁定积分")
    available_balance: int = Field(..., description="实际可用积分")
    total_earned: int = Field(0, description="累计获取")
    total_spent: int = Field(0, description="累计消费")
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ========== 积分交易 ==========

class PointsTransactionResponse(BaseModel):
    """积分交易记录响应"""
    id: str
    user_id: str
    type: str = Field(..., description="交易类型: earn, spend, lock, unlock")
    amount: int = Field(..., description="交易金额（正数增加，负数减少）")
    balance_after: int = Field(..., description="交易后余额")
    source: str = Field(..., description="来源/用途")
    reference_id: str | None = None
    description: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class PointsTransactionListResponse(BaseModel):
    """积分交易列表响应"""
    transactions: list[PointsTransactionResponse]
    total: int
    page: int
    page_size: int


# ========== 积分操作 ==========

class PointsEarnRequest(BaseModel):
    """积分获取请求（内部使用）"""
    source: str = Field(..., description="来源类型")
    amount: int = Field(..., gt=0, description="获取数量")
    reference_id: str | None = None
    description: str | None = None


class PointsSpendRequest(BaseModel):
    """积分消费请求"""
    purpose: str = Field(..., description="用途类型")
    amount: int = Field(..., gt=0, description="消费数量")
    reference_id: str | None = None
    description: str | None = None


class PointsLockRequest(BaseModel):
    """积分锁定请求"""
    order_id: str
    amount: int = Field(..., gt=0)


class PointsUnlockRequest(BaseModel):
    """积分解锁请求"""
    lock_id: str
    confirm: bool = Field(False, description="True=确认消费，False=释放回账户")


# ========== 积分规则 ==========

class PointsRulesResponse(BaseModel):
    """积分规则响应"""
    earn_rules: dict[str, int] = Field(..., description="获取规则")
    spend_rules: dict[str, int] = Field(..., description="消费规则")
    daily_limit: int = Field(..., description="每日获取上限")
    points_to_yuan: int = Field(..., description="积分兑换比例（多少积分=1元）")
    max_discount_rate: float = Field(..., description="最大抵扣比例")


# ========== 积分兑换 ==========

class PointsRedeemRequest(BaseModel):
    """积分兑换请求"""
    item_type: str = Field(..., description="兑换类型: coupon, scenario")
    item_id: str = Field(..., description="兑换物品ID")


class PointsRedeemResponse(BaseModel):
    """积分兑换响应"""
    success: bool
    points_spent: int
    item_type: str
    item_id: str
    message: str | None = None


# ========== 每日积分统计 ==========

class DailyPointsStatsResponse(BaseModel):
    """每日积分统计响应"""
    date: str
    earned_today: int = Field(0, description="今日已获取")
    daily_limit: int = Field(..., description="每日上限")
    remaining: int = Field(..., description="今日剩余可获取")


# ========== 会话积分消耗 ==========

class SessionAvailabilityRequest(BaseModel):
    """会话可用性检查请求"""
    session_type: str = Field("text", description="会话类型: text, voice")
    scenario_type: str = Field("basic", description="场景类型: basic, advanced, custom")


class SessionAvailabilityResponse(BaseModel):
    """会话可用性检查响应"""
    can_start: bool = Field(..., description="是否可以开始会话")
    is_free: bool = Field(..., description="是否为免费会话")
    points_required: int = Field(0, description="需要消耗的积分")
    free_remaining: int = Field(..., description="剩余免费次数，-1表示无限")
    current_balance: int = Field(..., description="当前积分余额")
    reason: str | None = Field(None, description="不可开始的原因")


class SessionPointsConsumeRequest(BaseModel):
    """会话积分消耗请求"""
    session_id: str = Field(..., description="会话ID")
    session_type: str = Field("text", description="会话类型: text, voice")
    scenario_type: str = Field("basic", description="场景类型: basic, advanced, custom")
    was_free: bool = Field(False, description="是否为免费会话")
    points_cost: int = Field(0, description="消耗积分数")


class SessionPointsConsumeResponse(BaseModel):
    """会话积分消耗响应"""
    success: bool
    points_consumed: int = Field(0, description="实际消耗积分")
    was_free: bool = Field(False, description="是否为免费会话")
    balance_after: int = Field(..., description="消耗后余额")
    message: str | None = None


class DailySessionStatusResponse(BaseModel):
    """每日会话状态响应"""
    total_free: int = Field(..., description="每日免费总次数，-1表示无限")
    used: int = Field(0, description="今日已使用次数")
    remaining: int = Field(..., description="剩余免费次数，-1表示无限")
    is_unlimited: bool = Field(False, description="是否无限制")


# ========== 积分消耗配置 ==========

class PointsConsumptionConfigResponse(BaseModel):
    """积分消耗配置响应"""
    points_per_text_session: int = Field(10, description="文字对话每次消耗")
    points_per_voice_session: int = Field(20, description="语音对话每次消耗")
    free_sessions_by_level: dict[str, int] = Field(
        default_factory=dict, description="每日免费次数（按会员等级）"
    )
    vip_discount_rates: dict[str, int] = Field(
        default_factory=dict, description="VIP折扣率（百分比）"
    )
    scenario_multipliers: dict[str, float] = Field(
        default_factory=dict, description="场景类型倍率"
    )
