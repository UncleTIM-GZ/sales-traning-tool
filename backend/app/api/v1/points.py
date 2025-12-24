"""
开发：Excellent（11964948@qq.com）
功能：积分API路由
作用：提供积分余额查询、明细、兑换接口
创建时间：2025-12-24
最后修改：2025-12-24
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.models.points import POINTS_RULES
from app.schemas.points import (
    PointsAccountResponse,
    PointsTransactionListResponse,
    PointsTransactionResponse,
    PointsRulesResponse,
    DailyPointsStatsResponse,
)
from app.services.points_service import PointsService

router = APIRouter(prefix="/points", tags=["积分"])


@router.get("/account", response_model=PointsAccountResponse)
async def get_points_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取积分账户信息"""
    points_service = PointsService(db)
    account = await points_service.get_or_create_account(current_user.id)
    
    return PointsAccountResponse(
        id=account.id,
        user_id=account.user_id,
        balance=account.balance,
        locked=account.locked,
        available_balance=account.available_balance,
        total_earned=account.total_earned,
        total_spent=account.total_spent,
        created_at=account.created_at,
        updated_at=account.updated_at,
    )


@router.get("/balance")
async def get_points_balance(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取可用积分余额"""
    points_service = PointsService(db)
    balance = await points_service.get_balance(current_user.id)
    return {"balance": balance}


@router.get("/transactions", response_model=PointsTransactionListResponse)
async def get_transactions(
    type: str | None = Query(None, description="交易类型: earn, spend"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取积分交易记录"""
    points_service = PointsService(db)
    transactions, total = await points_service.get_transactions(
        current_user.id, type, page, page_size
    )
    
    return PointsTransactionListResponse(
        transactions=[
            PointsTransactionResponse.model_validate(t) for t in transactions
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/daily-stats", response_model=DailyPointsStatsResponse)
async def get_daily_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取今日积分统计"""
    points_service = PointsService(db)
    earned_today = await points_service.get_daily_earned(current_user.id)
    daily_limit = POINTS_RULES["daily_earn_limit"]
    
    return DailyPointsStatsResponse(
        date=date.today().isoformat(),
        earned_today=earned_today,
        daily_limit=daily_limit,
        remaining=max(0, daily_limit - earned_today),
    )


@router.get("/rules", response_model=PointsRulesResponse)
async def get_points_rules(
    db: AsyncSession = Depends(get_db),
):
    """获取积分规则"""
    points_service = PointsService(db)
    rules = points_service.get_points_rules()
    return PointsRulesResponse(**rules)


@router.post("/daily-login")
async def claim_daily_login_points(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """领取每日登录积分"""
    points_service = PointsService(db)
    
    # 检查今日是否已领取
    # 这里简化处理，实际应该检查是否已领取过
    transaction = await points_service.earn_daily_login(current_user.id)
    
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="今日积分已达上限",
        )
    
    return {
        "message": "领取成功",
        "points": transaction.amount,
        "balance": transaction.balance_after,
    }
