"""
开发：Excellent（11964948@qq.com）
功能：兑换码用户端API
作用：提供用户兑换码兑换功能
创建时间：2024-12-24
最后修改：2024-12-24
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.redeem_code import RedeemRequest, RedeemResponse
from app.services.redeem_code_service import (
    RedeemCodeService,
    CodeNotFoundError,
    CodeExpiredError,
    CodeExhaustedError,
    CodeInactiveError,
    CodeNotYetValidError,
    AlreadyRedeemedError,
)

router = APIRouter(prefix="/redeem-codes")


@router.post("/redeem", response_model=RedeemResponse)
async def redeem_code(
    request: RedeemRequest,
    req: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    兑换码兑换
    
    - **code**: 兑换码
    
    成功返回奖励信息，失败返回错误信息
    """
    service = RedeemCodeService(db)
    
    # 获取客户端IP
    ip_address = req.client.host if req.client else None
    
    try:
        result = await service.redeem(
            code=request.code,
            user_id=current_user.id,
            ip_address=ip_address,
        )
        return RedeemResponse(**result)
    
    except CodeNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="兑换码不存在",
        )
    except CodeExpiredError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="兑换码已过期",
        )
    except CodeExhaustedError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="兑换码已被使用完",
        )
    except CodeInactiveError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="兑换码已禁用",
        )
    except CodeNotYetValidError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="兑换码尚未生效",
        )
    except AlreadyRedeemedError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="您已兑换过此码",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"兑换失败: {str(e)}",
        )
