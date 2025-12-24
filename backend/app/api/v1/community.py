"""社区 API"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_db
from app.models import (
    Post,
    PostLike,
    PostComment,
    Challenge,
    ChallengeParticipant,
    Leaderboard,
    User,
)

router = APIRouter()


# ===== Schemas =====

class AuthorResponse(BaseModel):
    id: str
    nickname: str
    avatar: Optional[str]
    level: str

    class Config:
        from_attributes = True


class PostResponse(BaseModel):
    id: str
    content: str
    images: list[str]
    likes_count: int
    comments_count: int
    is_pinned: bool
    created_at: str
    author: AuthorResponse
    is_liked: bool = False

    class Config:
        from_attributes = True


class PostListResponse(BaseModel):
    items: list[PostResponse]
    total: int
    page: int
    size: int


class CommentResponse(BaseModel):
    id: str
    content: str
    created_at: str
    author: AuthorResponse
    parent_id: Optional[str]

    class Config:
        from_attributes = True


class LeaderboardUserResponse(BaseModel):
    rank: int
    user_id: str
    nickname: str
    avatar: Optional[str]
    level: str
    score: int
    rank_change: int

    class Config:
        from_attributes = True


class LeaderboardResponse(BaseModel):
    items: list[LeaderboardUserResponse]
    my_rank: Optional[LeaderboardUserResponse]
    period: str


class ChallengeResponse(BaseModel):
    id: str
    title: str
    description: str
    start_time: str
    end_time: str
    reward: str
    participant_count: int
    is_joined: bool = False
    progress: Optional[dict] = None

    class Config:
        from_attributes = True


class ChallengeListResponse(BaseModel):
    items: list[ChallengeResponse]


class CreatePostRequest(BaseModel):
    content: str
    images: list[str] = []


class CreateCommentRequest(BaseModel):
    content: str
    parent_id: Optional[str] = None


# ===== 动态列表 =====

@router.get("/posts", response_model=PostListResponse)
async def list_posts(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """获取动态列表"""
    # 查询动态
    query = (
        select(Post)
        .options(selectinload(Post.user))
        .where(Post.is_deleted == False)
        .order_by(Post.is_pinned.desc(), Post.created_at.desc())
    )
    
    offset = (page - 1) * size
    result = await db.execute(query.offset(offset).limit(size))
    posts = result.scalars().all()
    
    # 获取当前用户点赞的动态
    liked_post_ids = set()
    if current_user:
        likes_result = await db.execute(
            select(PostLike.post_id).where(PostLike.user_id == current_user.id)
        )
        liked_post_ids = {row[0] for row in likes_result.all()}
    
    # 统计总数
    count_result = await db.execute(
        select(func.count(Post.id)).where(Post.is_deleted == False)
    )
    total = count_result.scalar() or 0
    
    items = []
    for post in posts:
        items.append(PostResponse(
            id=post.id,
            content=post.content,
            images=post.images or [],
            likes_count=post.likes_count,
            comments_count=post.comments_count,
            is_pinned=post.is_pinned,
            created_at=post.created_at.isoformat() if post.created_at else "",
            author=AuthorResponse(
                id=post.user.id,
                nickname=post.user.nickname,
                avatar=post.user.avatar,
                level=post.user.level,
            ),
            is_liked=post.id in liked_post_ids,
        ))
    
    return PostListResponse(items=items, total=total, page=page, size=size)


# ===== 发布动态 =====

@router.post("/posts", response_model=PostResponse)
async def create_post(
    data: CreatePostRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """发布动态"""
    import uuid
    
    if not data.content.strip():
        raise HTTPException(status_code=400, detail="内容不能为空")
    
    post = Post(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        content=data.content.strip(),
        images=data.images,
        likes_count=0,
        comments_count=0,
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    
    return PostResponse(
        id=post.id,
        content=post.content,
        images=post.images or [],
        likes_count=0,
        comments_count=0,
        is_pinned=False,
        created_at=post.created_at.isoformat() if post.created_at else "",
        author=AuthorResponse(
            id=current_user.id,
            nickname=current_user.nickname,
            avatar=current_user.avatar,
            level=current_user.level,
        ),
        is_liked=False,
    )


# ===== 删除动态 =====

@router.delete("/posts/{post_id}")
async def delete_post(
    post_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除动态"""
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    
    if not post:
        raise HTTPException(status_code=404, detail="动态不存在")
    
    if post.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权删除")
    
    post.is_deleted = True
    await db.commit()
    
    return {"message": "删除成功"}


# ===== 点赞动态 =====

@router.post("/posts/{post_id}/like")
async def like_post(
    post_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """点赞动态"""
    import uuid
    
    # 检查动态是否存在
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="动态不存在")
    
    # 检查是否已点赞
    like_result = await db.execute(
        select(PostLike).where(
            PostLike.post_id == post_id,
            PostLike.user_id == current_user.id,
        )
    )
    if like_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="已点赞")
    
    # 创建点赞
    like = PostLike(
        id=str(uuid.uuid4()),
        post_id=post_id,
        user_id=current_user.id,
    )
    db.add(like)
    
    # 更新点赞数
    post.likes_count += 1
    
    await db.commit()
    
    return {"message": "点赞成功", "likes_count": post.likes_count}


# ===== 取消点赞 =====

@router.delete("/posts/{post_id}/like")
async def unlike_post(
    post_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """取消点赞"""
    # 检查动态是否存在
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="动态不存在")
    
    # 检查是否已点赞
    like_result = await db.execute(
        select(PostLike).where(
            PostLike.post_id == post_id,
            PostLike.user_id == current_user.id,
        )
    )
    like = like_result.scalar_one_or_none()
    if not like:
        raise HTTPException(status_code=400, detail="未点赞")
    
    # 删除点赞
    await db.delete(like)
    
    # 更新点赞数
    post.likes_count = max(0, post.likes_count - 1)
    
    await db.commit()
    
    return {"message": "取消点赞", "likes_count": post.likes_count}


# ===== 获取评论 =====

@router.get("/posts/{post_id}/comments", response_model=list[CommentResponse])
async def get_comments(
    post_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取动态评论"""
    result = await db.execute(
        select(PostComment)
        .options(selectinload(PostComment.user))
        .where(
            PostComment.post_id == post_id,
            PostComment.is_deleted == False,
        )
        .order_by(PostComment.created_at)
    )
    comments = result.scalars().all()
    
    return [
        CommentResponse(
            id=c.id,
            content=c.content,
            created_at=c.created_at.isoformat() if c.created_at else "",
            author=AuthorResponse(
                id=c.user.id,
                nickname=c.user.nickname,
                avatar=c.user.avatar,
                level=c.user.level,
            ),
            parent_id=c.parent_id,
        )
        for c in comments
    ]


# ===== 发表评论 =====

@router.post("/posts/{post_id}/comments", response_model=CommentResponse)
async def create_comment(
    post_id: str,
    data: CreateCommentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """发表评论"""
    import uuid
    
    # 检查动态是否存在
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="动态不存在")
    
    if not data.content.strip():
        raise HTTPException(status_code=400, detail="评论内容不能为空")
    
    comment = PostComment(
        id=str(uuid.uuid4()),
        post_id=post_id,
        user_id=current_user.id,
        content=data.content.strip(),
        parent_id=data.parent_id,
    )
    db.add(comment)
    
    # 更新评论数
    post.comments_count += 1
    
    await db.commit()
    await db.refresh(comment)
    
    return CommentResponse(
        id=comment.id,
        content=comment.content,
        created_at=comment.created_at.isoformat() if comment.created_at else "",
        author=AuthorResponse(
            id=current_user.id,
            nickname=current_user.nickname,
            avatar=current_user.avatar,
            level=current_user.level,
        ),
        parent_id=comment.parent_id,
    )


# ===== 排行榜 =====

@router.get("/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard(
    period: str = Query("weekly", regex="^(weekly|monthly|all_time)$"),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """获取排行榜"""
    result = await db.execute(
        select(Leaderboard)
        .options(selectinload(Leaderboard.user))
        .where(Leaderboard.period == period)
        .order_by(Leaderboard.rank)
        .limit(50)
    )
    entries = result.scalars().all()
    
    items = [
        LeaderboardUserResponse(
            rank=e.rank,
            user_id=e.user_id,
            nickname=e.user.nickname,
            avatar=e.user.avatar,
            level=e.user.level,
            score=e.score,
            rank_change=e.rank_change,
        )
        for e in entries
    ]
    
    # 获取当前用户排名
    my_rank = None
    if current_user:
        my_result = await db.execute(
            select(Leaderboard)
            .options(selectinload(Leaderboard.user))
            .where(
                Leaderboard.user_id == current_user.id,
                Leaderboard.period == period,
            )
        )
        my_entry = my_result.scalar_one_or_none()
        if my_entry:
            my_rank = LeaderboardUserResponse(
                rank=my_entry.rank,
                user_id=my_entry.user_id,
                nickname=my_entry.user.nickname,
                avatar=my_entry.user.avatar,
                level=my_entry.user.level,
                score=my_entry.score,
                rank_change=my_entry.rank_change,
            )
    
    return LeaderboardResponse(items=items, my_rank=my_rank, period=period)


# ===== 挑战赛列表 =====

@router.get("/challenges", response_model=ChallengeListResponse)
async def list_challenges(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """获取挑战赛列表"""
    result = await db.execute(
        select(Challenge)
        .where(Challenge.is_active == True)
        .order_by(Challenge.created_at.desc())
    )
    challenges = result.scalars().all()
    
    # 获取用户参与的挑战
    joined_challenges = {}
    if current_user:
        participants_result = await db.execute(
            select(ChallengeParticipant).where(
                ChallengeParticipant.user_id == current_user.id
            )
        )
        for p in participants_result.scalars().all():
            joined_challenges[p.challenge_id] = p.progress
    
    items = [
        ChallengeResponse(
            id=c.id,
            title=c.title,
            description=c.description,
            start_time=c.start_time,
            end_time=c.end_time,
            reward=c.reward,
            participant_count=c.participant_count,
            is_joined=c.id in joined_challenges,
            progress=joined_challenges.get(c.id),
        )
        for c in challenges
    ]
    
    return ChallengeListResponse(items=items)


# ===== 参加挑战 =====

@router.post("/challenges/{challenge_id}/join")
async def join_challenge(
    challenge_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """参加挑战"""
    import uuid
    
    # 检查挑战是否存在
    result = await db.execute(
        select(Challenge).where(Challenge.id == challenge_id)
    )
    challenge = result.scalar_one_or_none()
    if not challenge:
        raise HTTPException(status_code=404, detail="挑战不存在")
    
    if not challenge.is_active:
        raise HTTPException(status_code=400, detail="挑战已结束")
    
    # 检查是否已参加
    participant_result = await db.execute(
        select(ChallengeParticipant).where(
            ChallengeParticipant.challenge_id == challenge_id,
            ChallengeParticipant.user_id == current_user.id,
        )
    )
    if participant_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="您已参加该挑战")
    
    # 创建参与记录
    participant = ChallengeParticipant(
        id=str(uuid.uuid4()),
        challenge_id=challenge_id,
        user_id=current_user.id,
        progress={},
        score=0,
    )
    db.add(participant)
    
    # 更新参与人数
    challenge.participant_count += 1
    
    await db.commit()
    
    return {"message": "参加成功"}


# ===== 获取挑战进度 =====

@router.get("/challenges/{challenge_id}/progress")
async def get_challenge_progress(
    challenge_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取挑战进度"""
    result = await db.execute(
        select(ChallengeParticipant).where(
            ChallengeParticipant.challenge_id == challenge_id,
            ChallengeParticipant.user_id == current_user.id,
        )
    )
    participant = result.scalar_one_or_none()
    
    if not participant:
        raise HTTPException(status_code=404, detail="未参加该挑战")
    
    return {
        "challenge_id": challenge_id,
        "progress": participant.progress,
        "score": participant.score,
        "completed_at": participant.completed_at,
    }
