"""好友 API

提供好友功能：
- 发送好友请求
- 接受/拒绝请求
- 获取好友列表
- 删除好友
"""

from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, or_, select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.api.deps import get_current_user, get_db
from app.models import User
from app.models.friendship import Friendship, FriendRequest

router = APIRouter()


# ========== Schemas ==========

class UserBrief(BaseModel):
    id: str
    nickname: str
    avatar: str | None = None
    phone: str | None = None
    
    class Config:
        from_attributes = True


class FriendItem(BaseModel):
    id: str
    user: UserBrief
    remark: str | None = None
    created_at: str
    
    class Config:
        from_attributes = True


class FriendRequestItem(BaseModel):
    id: str
    sender: UserBrief
    receiver: UserBrief
    message: str | None = None
    status: str
    created_at: str
    
    class Config:
        from_attributes = True


class SendRequestPayload(BaseModel):
    friend_id: str
    message: str | None = None


class HandleRequestPayload(BaseModel):
    action: Literal["accept", "reject"]


# ========== API ==========

@router.get("/friends")
async def get_friends(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取好友列表"""
    query = select(Friendship).where(
        and_(
            or_(
                Friendship.user_id == current_user.id,
                Friendship.friend_id == current_user.id,
            ),
            Friendship.status == "accepted",
        )
    ).order_by(Friendship.created_at.desc())
    
    total_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = total_result.scalar() or 0
    
    query = query.offset((page - 1) * size).limit(size)
    query = query.options(
        joinedload(Friendship.user),
        joinedload(Friendship.friend),
    )
    
    result = await db.execute(query)
    friendships = result.unique().scalars().all()
    
    items = []
    for f in friendships:
        # 找到对方用户
        friend_user = f.friend if f.user_id == current_user.id else f.user
        items.append({
            "id": f.id,
            "user": {
                "id": friend_user.id,
                "nickname": friend_user.nickname,
                "avatar": friend_user.avatar,
                "phone": friend_user.phone[:3] + "****" + friend_user.phone[-4:] if friend_user.phone else None,
            },
            "remark": f.remark,
            "created_at": f.created_at.isoformat() if f.created_at else "",
        })
    
    return {"items": items, "total": total, "page": page, "size": size}


@router.get("/friends/requests")
async def get_friend_requests(
    type: Literal["received", "sent"] = "received",
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取好友请求列表"""
    if type == "received":
        query = select(FriendRequest).where(
            and_(
                FriendRequest.receiver_id == current_user.id,
                FriendRequest.status == "pending",
            )
        )
    else:
        query = select(FriendRequest).where(
            FriendRequest.sender_id == current_user.id,
        )
    
    query = query.order_by(FriendRequest.created_at.desc())
    
    total_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = total_result.scalar() or 0
    
    query = query.offset((page - 1) * size).limit(size)
    query = query.options(
        joinedload(FriendRequest.sender),
        joinedload(FriendRequest.receiver),
    )
    
    result = await db.execute(query)
    requests = result.unique().scalars().all()
    
    items = []
    for r in requests:
        items.append({
            "id": r.id,
            "sender": {
                "id": r.sender.id,
                "nickname": r.sender.nickname,
                "avatar": r.sender.avatar,
            },
            "receiver": {
                "id": r.receiver.id,
                "nickname": r.receiver.nickname,
                "avatar": r.receiver.avatar,
            },
            "message": r.message,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        })
    
    return {"items": items, "total": total, "page": page, "size": size}


@router.post("/friends/request")
async def send_friend_request(
    payload: SendRequestPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """发送好友请求"""
    if payload.friend_id == current_user.id:
        raise HTTPException(status_code=400, detail="不能添加自己为好友")
    
    # 检查目标用户是否存在
    friend = await db.get(User, payload.friend_id)
    if not friend:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    # 检查是否已经是好友
    existing_friendship = await db.execute(
        select(Friendship).where(
            and_(
                or_(
                    and_(
                        Friendship.user_id == current_user.id,
                        Friendship.friend_id == payload.friend_id,
                    ),
                    and_(
                        Friendship.user_id == payload.friend_id,
                        Friendship.friend_id == current_user.id,
                    ),
                ),
                Friendship.status == "accepted",
            )
        )
    )
    if existing_friendship.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="已经是好友")
    
    # 检查是否已有待处理的请求
    existing_request = await db.execute(
        select(FriendRequest).where(
            and_(
                FriendRequest.sender_id == current_user.id,
                FriendRequest.receiver_id == payload.friend_id,
                FriendRequest.status == "pending",
            )
        )
    )
    if existing_request.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="已发送过好友请求，请等待对方处理")
    
    # 检查对方是否已发送请求给我（直接互加）
    reverse_request = await db.execute(
        select(FriendRequest).where(
            and_(
                FriendRequest.sender_id == payload.friend_id,
                FriendRequest.receiver_id == current_user.id,
                FriendRequest.status == "pending",
            )
        )
    )
    reverse = reverse_request.scalar_one_or_none()
    if reverse:
        # 直接成为好友
        reverse.status = "accepted"
        friendship = Friendship(
            user_id=payload.friend_id,
            friend_id=current_user.id,
            status="accepted",
        )
        db.add(friendship)
        await db.commit()
        return {"success": True, "message": "对方也向你发送了请求，已直接成为好友"}
    
    # 创建请求
    request = FriendRequest(
        sender_id=current_user.id,
        receiver_id=payload.friend_id,
        message=payload.message,
        status="pending",
    )
    db.add(request)
    await db.commit()
    
    return {"success": True, "message": "好友请求已发送"}


@router.post("/friends/requests/{request_id}")
async def handle_friend_request(
    request_id: str,
    payload: HandleRequestPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """处理好友请求"""
    result = await db.execute(
        select(FriendRequest).where(
            and_(
                FriendRequest.id == request_id,
                FriendRequest.receiver_id == current_user.id,
                FriendRequest.status == "pending",
            )
        )
    )
    request = result.scalar_one_or_none()
    
    if not request:
        raise HTTPException(status_code=404, detail="请求不存在或已处理")
    
    if payload.action == "accept":
        request.status = "accepted"
        # 创建双向好友关系
        friendship = Friendship(
            user_id=request.sender_id,
            friend_id=current_user.id,
            status="accepted",
        )
        db.add(friendship)
        message = "已添加好友"
    else:
        request.status = "rejected"
        message = "已拒绝请求"
    
    await db.commit()
    
    return {"success": True, "message": message}


@router.delete("/friends/{friend_id}")
async def remove_friend(
    friend_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除好友"""
    result = await db.execute(
        select(Friendship).where(
            and_(
                or_(
                    and_(
                        Friendship.user_id == current_user.id,
                        Friendship.friend_id == friend_id,
                    ),
                    and_(
                        Friendship.user_id == friend_id,
                        Friendship.friend_id == current_user.id,
                    ),
                ),
                Friendship.status == "accepted",
            )
        )
    )
    friendship = result.scalar_one_or_none()
    
    if not friendship:
        raise HTTPException(status_code=404, detail="好友关系不存在")
    
    await db.delete(friendship)
    await db.commit()
    
    return {"success": True, "message": "已删除好友"}


@router.get("/friends/check/{user_id}")
async def check_friendship(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """检查是否是好友"""
    result = await db.execute(
        select(Friendship).where(
            and_(
                or_(
                    and_(
                        Friendship.user_id == current_user.id,
                        Friendship.friend_id == user_id,
                    ),
                    and_(
                        Friendship.user_id == user_id,
                        Friendship.friend_id == current_user.id,
                    ),
                ),
                Friendship.status == "accepted",
            )
        )
    )
    friendship = result.scalar_one_or_none()
    
    return {"is_friend": friendship is not None}


@router.get("/friends/search")
async def search_users(
    q: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """搜索用户（用于添加好友）"""
    query = select(User).where(
        and_(
            User.id != current_user.id,
            or_(
                User.nickname.ilike(f"%{q}%"),
                User.phone.like(f"%{q}%"),
            )
        )
    ).limit(size).offset((page - 1) * size)
    
    result = await db.execute(query)
    users = result.scalars().all()
    
    items = []
    for u in users:
        # 检查好友状态
        friendship_result = await db.execute(
            select(Friendship).where(
                and_(
                    or_(
                        and_(
                            Friendship.user_id == current_user.id,
                            Friendship.friend_id == u.id,
                        ),
                        and_(
                            Friendship.user_id == u.id,
                            Friendship.friend_id == current_user.id,
                        ),
                    ),
                    Friendship.status == "accepted",
                )
            )
        )
        is_friend = friendship_result.scalar_one_or_none() is not None
        
        items.append({
            "id": u.id,
            "nickname": u.nickname,
            "avatar": u.avatar,
            "phone": u.phone[:3] + "****" + u.phone[-4:] if u.phone else None,
            "is_friend": is_friend,
        })
    
    return {"items": items, "total": len(items), "page": page, "size": size}
