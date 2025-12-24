"""会话路由 - 实现完整的SSE流式对话

功能:
- 创建会话
- 发送消息 (SSE流式响应)
- 获取NPC开场白
- 暂停/恢复/结束会话
- 获取对话历史
- 积分消耗检查
"""

import json
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUserId, DatabaseSession
from app.schemas.session import (
    MessageRequest,
    SessionCreate,
    SessionHistoryResponse,
    SessionListResponse,
    SessionResponse,
    SessionListItem,
    TurnItem,
)
from app.schemas.points import (
    SessionAvailabilityRequest,
    SessionAvailabilityResponse,
    DailySessionStatusResponse,
)
from app.services.session_service import SessionService
from app.services.points_service import PointsService
from app.services.vip_service import VIPService
from app.services.system_config_service import SystemConfigService

router = APIRouter()


def _session_to_response(session) -> SessionResponse:
    """转换Session模型到响应Schema"""
    return SessionResponse(
        id=session.id,
        user_id=session.user_id,
        scenario_id=session.scenario_id,
        mode=session.mode,
        seed=session.seed,
        status=session.status,
        started_at=session.started_at,
        ended_at=session.ended_at,
    )


@router.post("", response_model=SessionResponse, status_code=201)
async def create_session(
    user_id: CurrentUserId,
    session_in: SessionCreate,
    db: DatabaseSession,
):
    """
    创建对话会话

    - **scenario_id**: 场景ID
    - **mode**: 模式(train/exam/replay)
    - **seed**: 随机种子(Exam模式必须)
    
    会自动检查积分/免费次数，如果积分不足会返回403错误
    """
    service = SessionService(db)
    points_service = PointsService(db)
    vip_service = VIPService(db)
    config_service = SystemConfigService(db)
    
    try:
        # 获取用户会员等级
        level = await vip_service.get_user_current_level(user_id)
        membership_level = level.name
        
        # 获取场景类型（默认basic）
        scenario_type = "basic"  # TODO: 从场景获取实际类型
        session_type = "text"  # 默认文字会话
        
        # 计算积分消耗
        points_cost = await config_service.get_session_points_cost(
            session_type=session_type,
            scenario_type=scenario_type,
            membership_level=membership_level,
        )
        
        # 获取每日免费次数
        daily_free_limit = await config_service.get_daily_free_sessions(membership_level)
        
        # 检查是否可以开始会话
        availability = await points_service.check_session_availability(
            user_id=user_id,
            points_cost=points_cost,
            daily_free_limit=daily_free_limit,
        )
        
        if not availability["can_start"]:
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "INSUFFICIENT_POINTS",
                    "message": availability["reason"],
                    "points_required": availability["points_required"],
                    "current_balance": availability["current_balance"],
                }
            )
        
        # 创建会话
        session = await service.create_session(
            user_id=user_id,
            scenario_id=str(session_in.scenario_id),
            mode=session_in.mode,
            seed=session_in.seed,
        )
        
        # 消耗积分（会话创建成功后）
        await points_service.consume_session_points(
            user_id=user_id,
            session_id=session.id,
            points_cost=points_cost if not availability["is_free"] else 0,
            session_type=session_type,
            scenario_type=scenario_type,
            was_free=availability["is_free"],
        )
        
        return _session_to_response(session)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=SessionListResponse)
async def list_sessions(
    user_id: CurrentUserId,
    db: DatabaseSession,
    status: Literal["pending", "active", "completed", "aborted"] | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
):
    """获取会话列表"""
    service = SessionService(db)
    sessions, total = await service.list_sessions(
        user_id=user_id,
        status=status,
        page=page,
        size=size,
    )
    
    return SessionListResponse(
        items=[
            SessionListItem(
                id=s.id,
                scenario_id=s.scenario_id,
                mode=s.mode,
                status=s.status,
                started_at=s.started_at,
                ended_at=s.ended_at,
            )
            for s in sessions
        ],
        total=total,
        page=page,
        size=size,
    )


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    user_id: CurrentUserId,
    session_id: UUID,
    db: DatabaseSession,
):
    """获取会话详情"""
    service = SessionService(db)
    session = await service.get_session(str(session_id), user_id)
    
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    
    return _session_to_response(session)


@router.post("/{session_id}/start")
async def start_session(
    user_id: CurrentUserId,
    session_id: UUID,
    db: DatabaseSession,
):
    """
    开始会话（获取NPC开场白）
    
    返回Server-Sent Events流，包含NPC的开场白
    """
    service = SessionService(db)

    async def generate_sse():
        try:
            async for event in service.get_npc_opening(str(session_id), user_id):
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        generate_sse(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/{session_id}/message")
async def send_message(
    user_id: CurrentUserId,
    session_id: UUID,
    message_in: MessageRequest,
    db: DatabaseSession,
):
    """
    发送消息（SSE流式响应）

    返回Server-Sent Events流，包含：
    - npc_response: NPC回应（流式）
    - coach_tip: Coach提示（Train模式）
    - finish: 完成标记
    - error: 错误信息
    - done: 结束
    """
    service = SessionService(db)

    async def generate_sse():
        try:
            async for event in service.send_message(
                session_id=str(session_id),
                user_id=user_id,
                content=message_in.content,
            ):
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        generate_sse(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/{session_id}/pause", status_code=204)
async def pause_session(
    user_id: CurrentUserId,
    session_id: UUID,
    db: DatabaseSession,
):
    """
    暂停会话（仅Train模式）

    暂停后可以查看复盘和提示
    """
    service = SessionService(db)
    session = await service.get_session(str(session_id), user_id)
    
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    if session.mode == "exam":
        raise HTTPException(status_code=400, detail="考试模式不允许暂停")
    
    return None


@router.post("/{session_id}/resume", status_code=204)
async def resume_session(
    user_id: CurrentUserId,
    session_id: UUID,
    db: DatabaseSession,
):
    """
    恢复会话（仅Train模式）

    继续之前暂停的会话
    """
    return None


@router.post("/{session_id}/request-hint")
async def request_coach_hint(
    user_id: CurrentUserId,
    session_id: UUID,
    db: DatabaseSession,
):
    """
    请求Coach提示（仅Train模式）
    
    主动请求教练给出建议
    """
    service = SessionService(db)
    session = await service.get_session(str(session_id), user_id)
    
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    if session.mode == "exam":
        raise HTTPException(status_code=400, detail="考试模式无教练提示")
    
    try:
        hint = await service.get_coach_hint(str(session_id), user_id)
        return {"hint": hint}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{session_id}/pause-review")
async def get_pause_review(
    user_id: CurrentUserId,
    session_id: UUID,
    db: DatabaseSession,
):
    """
    获取暂停复盘（仅Train模式）
    
    暂停时获取AI教练的复盘分析
    """
    service = SessionService(db)
    session = await service.get_session(str(session_id), user_id)
    
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    if session.mode == "exam":
        raise HTTPException(status_code=400, detail="考试模式无复盘功能")
    
    try:
        review = await service.get_pause_review(str(session_id), user_id)
        return review
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{session_id}/end", response_model=SessionResponse)
async def end_session(
    user_id: CurrentUserId,
    session_id: UUID,
    db: DatabaseSession,
):
    """
    结束会话

    结束后会生成评分报告
    """
    service = SessionService(db)
    
    try:
        session = await service.end_session(str(session_id), user_id)
        return _session_to_response(session)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{session_id}/history", response_model=SessionHistoryResponse)
async def get_session_history(
    user_id: CurrentUserId,
    session_id: UUID,
    db: DatabaseSession,
):
    """获取会话历史对话"""
    service = SessionService(db)
    
    # 验证会话存在
    session = await service.get_session(str(session_id), user_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    
    turns = await service.get_history(str(session_id), user_id)
    
    return SessionHistoryResponse(
        session_id=str(session_id),
        turns=[
            TurnItem(
                turn_number=t["turn_number"],
                role=t["role"],
                content=t["content"],
                created_at=t["created_at"],
            )
            for t in turns
        ],
    )



# ========== 积分消耗相关 API ==========


@router.post("/check-availability", response_model=SessionAvailabilityResponse)
async def check_session_availability(
    user_id: CurrentUserId,
    request: SessionAvailabilityRequest,
    db: DatabaseSession,
):
    """
    检查是否可以开始会话
    
    在创建会话前调用，检查用户是否有足够的免费次数或积分
    """
    points_service = PointsService(db)
    vip_service = VIPService(db)
    config_service = SystemConfigService(db)
    
    # 获取用户会员等级
    level = await vip_service.get_user_current_level(user_id)
    membership_level = level.name
    
    # 计算积分消耗
    points_cost = await config_service.get_session_points_cost(
        session_type=request.session_type,
        scenario_type=request.scenario_type,
        membership_level=membership_level,
    )
    
    # 获取每日免费次数
    daily_free_limit = await config_service.get_daily_free_sessions(membership_level)
    
    # 检查可用性
    availability = await points_service.check_session_availability(
        user_id=user_id,
        points_cost=points_cost,
        daily_free_limit=daily_free_limit,
    )
    
    return SessionAvailabilityResponse(**availability)


@router.get("/daily-status", response_model=DailySessionStatusResponse)
async def get_daily_session_status(
    user_id: CurrentUserId,
    db: DatabaseSession,
):
    """
    获取今日会话状态
    
    返回今日免费次数使用情况
    """
    points_service = PointsService(db)
    vip_service = VIPService(db)
    config_service = SystemConfigService(db)
    
    # 获取用户会员等级
    level = await vip_service.get_user_current_level(user_id)
    membership_level = level.name
    
    # 获取每日免费次数
    daily_free_limit = await config_service.get_daily_free_sessions(membership_level)
    
    # 获取状态
    status = await points_service.get_daily_session_status(
        user_id=user_id,
        daily_free_limit=daily_free_limit,
    )
    
    return DailySessionStatusResponse(**status)


@router.get("/points-cost")
async def get_session_points_cost(
    user_id: CurrentUserId,
    session_type: str = Query("text", description="会话类型: text, voice"),
    scenario_type: str = Query("basic", description="场景类型: basic, advanced, custom"),
    db: DatabaseSession = None,
):
    """
    获取会话积分消耗
    
    根据会话类型、场景类型和用户会员等级计算积分消耗
    """
    vip_service = VIPService(db)
    config_service = SystemConfigService(db)
    
    # 获取用户会员等级
    level = await vip_service.get_user_current_level(user_id)
    membership_level = level.name
    
    # 计算积分消耗
    points_cost = await config_service.get_session_points_cost(
        session_type=session_type,
        scenario_type=scenario_type,
        membership_level=membership_level,
    )
    
    # 获取每日免费次数
    daily_free_limit = await config_service.get_daily_free_sessions(membership_level)
    
    return {
        "session_type": session_type,
        "scenario_type": scenario_type,
        "membership_level": membership_level,
        "points_cost": points_cost,
        "daily_free_sessions": daily_free_limit,
        "is_unlimited": daily_free_limit == -1,
    }
