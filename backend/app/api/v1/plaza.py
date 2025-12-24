"""
开发：Excellent（11964948@qq.com）
功能：场景广场 API
作用：提供场景社交功能，包括热门场景发现、点赞/收藏/Fork、评论、创作者关注、
      积分系统、成就系统、排行榜、标签、专题合集等
创建时间：2025-12-24
最后修改：2025-12-24
"""

from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, delete, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.api.deps import get_current_user, get_db, get_optional_user
from app.models import (
    Post,
    Scenario,
    ScenarioCollection,
    ScenarioComment,
    ScenarioLike,
    ScenarioShare,
    User,
)
from app.models.plaza import Collection, SearchHistory
from app.services import plaza_service

router = APIRouter()


# ========== Schemas ==========

class CreatorBrief(BaseModel):
    id: str
    user_id: str
    nickname: str
    avatar: str | None = None
    level: str = "Lv.1"
    is_verified: bool = False
    scenario_count: int = 0
    followers_count: int = 0


class PublicScenario(BaseModel):
    id: str
    name: str
    description: str | None = None
    cover_image: str | None = None
    track: str
    difficulty: int
    tags: list[str] = []

    # 创作者
    creator: CreatorBrief | None = None

    # 统计
    train_count: int = 0
    likes_count: int = 0
    comments_count: int = 0
    fork_count: int = 0
    avg_score: float = 0.0

    # 用户状态
    is_liked: bool = False
    is_collected: bool = False
    is_forked: bool = False

    # 推荐
    is_official: bool = False
    is_featured: bool = False

    created_at: str
    published_at: str | None = None

    class Config:
        from_attributes = True


class ScenarioListResponse(BaseModel):
    items: list[PublicScenario]
    total: int
    page: int
    size: int


class CommentItem(BaseModel):
    id: str
    user_id: str
    nickname: str
    avatar: str | None = None
    content: str
    likes_count: int = 0
    created_at: str
    replies: list["CommentItem"] = []

    class Config:
        from_attributes = True


class CommentListResponse(BaseModel):
    items: list[CommentItem]
    total: int


class CreateCommentRequest(BaseModel):
    content: str
    parent_id: str | None = None


class PublishScenarioRequest(BaseModel):
    visibility: Literal["public", "circle"] = "public"
    share_to_feed: bool = True


class QuickCreateRequest(BaseModel):
    name: str
    description: str
    track: Literal["sales", "social"] = "sales"
    difficulty: int = 3


class AIGenerateRequest(BaseModel):
    prompt: str


# ========== 扩展功能 Schemas ==========


class TagItem(BaseModel):
    id: str
    name: str
    category: str
    usage_count: int
    is_hot: bool


class PointsBalance(BaseModel):
    total_points: int
    available_points: int
    level: int
    exp: int
    streak_days: int
    checked_in_today: bool = False
    today_points: int = 0


class PointRecordItem(BaseModel):
    id: str
    points: int
    type: str
    source: str
    description: str | None
    created_at: str


class AchievementItem(BaseModel):
    id: str
    name: str
    description: str | None
    icon: str | None
    category: str
    rarity: str
    reward_points: int
    progress: int
    is_unlocked: bool
    unlocked_at: str | None


class CollectionItemSchema(BaseModel):
    id: str
    title: str
    description: str | None
    cover_image: str | None
    is_official: bool
    scenario_count: int
    created_at: str


class CreateCollectionRequest(BaseModel):
    title: str
    description: str | None = None
    cover_image: str | None = None
    is_public: bool = True


class LeaderboardItem(BaseModel):
    rank: int
    scenario_id: str | None = None
    creator_id: str | None = None
    user_id: str | None = None
    name: str | None = None
    nickname: str | None = None
    avatar: str | None = None
    score: float | None = None


class CreatorProfile(BaseModel):
    id: str
    user_id: str
    nickname: str
    avatar: str | None
    bio: str | None
    level: str
    is_verified: bool
    scenario_count: int
    total_trains: int
    total_likes: int
    followers_count: int
    following_count: int
    is_following: bool


# ========== 广场发现 API ==========

@router.get("/hot", response_model=ScenarioListResponse)
async def get_hot_scenarios(
    track: str | None = None,
    difficulty: int | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
):
    """获取热门场景列表

    显示规则：
    1. 官方场景(is_official=True)默认显示
    2. 用户发布的公开场景(visibility=public, status=published)
    """
    # 基础查询：官方场景 OR (公开且已发布的场景)
    query = select(Scenario).where(
        or_(
            Scenario.is_official.is_(True),
            and_(
                Scenario.visibility == "public",
                Scenario.status == "published",
            )
        )
    )

    # 筛选条件
    if track:
        query = query.where(Scenario.track == track)
    if difficulty:
        query = query.where(Scenario.difficulty == difficulty)

    # 按热度排序
    query = query.order_by(desc(Scenario.hot_score), desc(Scenario.published_at))

    # 分页
    total_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = total_result.scalar() or 0

    query = query.offset((page - 1) * size).limit(size)
    query = query.options(joinedload(Scenario.creator))

    result = await db.execute(query)
    scenarios = result.unique().scalars().all()

    # 获取用户状态
    items = []
    for scenario in scenarios:
        item = await _build_public_scenario(db, scenario, current_user)
        items.append(item)

    return ScenarioListResponse(items=items, total=total, page=page, size=size)


@router.get("/recommended", response_model=ScenarioListResponse)
async def get_recommended_scenarios(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取个性化推荐场景"""
    # TODO: 实现基于用户历史的推荐算法
    # 当前简单返回官方推荐 + 热门场景
    query = select(Scenario).where(
        and_(
            Scenario.visibility == "public",
            Scenario.status == "published",
            or_(
                Scenario.is_official.is_(True),
                Scenario.is_featured.is_(True),
            )
        )
    ).order_by(desc(Scenario.hot_score)).limit(size)

    query = query.options(joinedload(Scenario.creator))
    result = await db.execute(query)
    scenarios = result.unique().scalars().all()

    items = []
    for scenario in scenarios:
        item = await _build_public_scenario(db, scenario, current_user)
        items.append(item)

    return ScenarioListResponse(items=items, total=len(items), page=1, size=size)


@router.get("/search", response_model=ScenarioListResponse)
async def search_scenarios(
    q: str = Query(..., min_length=1),
    track: str | None = None,
    difficulty: int | None = None,
    sort: Literal["hot", "new", "score"] = "hot",
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
):
    """搜索公开场景"""
    # 保存搜索历史
    if current_user:
        from app.services import plaza_service
        await plaza_service.save_search_history(db, current_user.id, q)

    query = select(Scenario).where(
        and_(
            Scenario.visibility == "public",
            Scenario.status == "published",
            or_(
                Scenario.name.ilike(f"%{q}%"),
                Scenario.description.ilike(f"%{q}%"),
            )
        )
    )

    if track:
        query = query.where(Scenario.track == track)
    if difficulty:
        query = query.where(Scenario.difficulty == difficulty)

    # 排序
    if sort == "hot":
        query = query.order_by(desc(Scenario.hot_score))
    elif sort == "new":
        query = query.order_by(desc(Scenario.published_at))
    elif sort == "score":
        query = query.order_by(desc(Scenario.avg_score))

    # 分页
    total_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = total_result.scalar() or 0

    query = query.offset((page - 1) * size).limit(size)
    query = query.options(joinedload(Scenario.creator))

    result = await db.execute(query)
    scenarios = result.unique().scalars().all()

    items = []
    for scenario in scenarios:
        item = await _build_public_scenario(db, scenario, current_user)
        items.append(item)

    return ScenarioListResponse(items=items, total=total, page=page, size=size)


# ========== 场景发布 API ==========

@router.post("/scenarios/{scenario_id}/publish")
async def publish_scenario(
    scenario_id: str,
    request: PublishScenarioRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """发布场景到广场"""
    # 获取场景
    result = await db.execute(
        select(Scenario).where(
            and_(
                Scenario.id == scenario_id,
                Scenario.created_by == current_user.id,
            )
        )
    )
    scenario = result.scalar_one_or_none()

    if not scenario:
        raise HTTPException(status_code=404, detail="场景不存在或无权限")

    # 更新场景状态
    scenario.visibility = request.visibility
    scenario.status = "published"
    scenario.published_at = datetime.now(UTC)

    # 如果需要发到动态
    if request.share_to_feed:
        post = Post(
            user_id=current_user.id,
            content=f"分享了一个新场景: 【{scenario.name}】\n{scenario.description or ''}",
            images=[],
        )
        db.add(post)

        # 记录分享
        share = ScenarioShare(
            scenario_id=scenario_id,
            user_id=current_user.id,
            share_type="post",
        )
        db.add(share)

    await db.commit()

    return {"success": True, "message": "场景发布成功"}


# ========== 场景互动 API ==========

@router.post("/scenarios/{scenario_id}/like")
async def like_scenario(
    scenario_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """点赞场景"""
    # 检查场景是否存在
    scenario = await db.get(Scenario, scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="场景不存在")

    # 检查是否已点赞
    result = await db.execute(
        select(ScenarioLike).where(
            and_(
                ScenarioLike.scenario_id == scenario_id,
                ScenarioLike.user_id == current_user.id,
            )
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        raise HTTPException(status_code=400, detail="已点赞")

    # 创建点赞
    like = ScenarioLike(scenario_id=scenario_id, user_id=current_user.id)
    db.add(like)

    # 更新统计
    scenario.likes_count += 1
    _update_hot_score(scenario)

    await db.commit()

    return {"success": True, "likes_count": scenario.likes_count}


@router.delete("/scenarios/{scenario_id}/like")
async def unlike_scenario(
    scenario_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """取消点赞"""
    result = await db.execute(
        select(ScenarioLike).where(
            and_(
                ScenarioLike.scenario_id == scenario_id,
                ScenarioLike.user_id == current_user.id,
            )
        )
    )
    like = result.scalar_one_or_none()

    if not like:
        raise HTTPException(status_code=400, detail="未点赞")

    await db.delete(like)

    # 更新统计
    scenario = await db.get(Scenario, scenario_id)
    if scenario:
        scenario.likes_count = max(0, scenario.likes_count - 1)
        _update_hot_score(scenario)

    await db.commit()

    return {"success": True}


@router.post("/scenarios/{scenario_id}/collect")
async def collect_scenario(
    scenario_id: str,
    folder: str = "默认收藏夹",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """收藏场景"""
    scenario = await db.get(Scenario, scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="场景不存在")

    # 检查是否已收藏
    result = await db.execute(
        select(ScenarioCollection).where(
            and_(
                ScenarioCollection.scenario_id == scenario_id,
                ScenarioCollection.user_id == current_user.id,
            )
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        raise HTTPException(status_code=400, detail="已收藏")

    collection = ScenarioCollection(
        user_id=current_user.id,
        scenario_id=scenario_id,
        folder=folder,
    )
    db.add(collection)

    scenario.collections_count += 1

    await db.commit()

    return {"success": True}


@router.delete("/scenarios/{scenario_id}/collect")
async def uncollect_scenario(
    scenario_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """取消收藏"""
    result = await db.execute(
        select(ScenarioCollection).where(
            and_(
                ScenarioCollection.scenario_id == scenario_id,
                ScenarioCollection.user_id == current_user.id,
            )
        )
    )
    collection = result.scalar_one_or_none()

    if not collection:
        raise HTTPException(status_code=400, detail="未收藏")

    await db.delete(collection)

    scenario = await db.get(Scenario, scenario_id)
    if scenario:
        scenario.collections_count = max(0, scenario.collections_count - 1)

    await db.commit()

    return {"success": True}


@router.post("/scenarios/{scenario_id}/fork")
async def fork_scenario(
    scenario_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """复制公开场景到自己的场景库"""
    # 获取原场景
    source = await db.get(Scenario, scenario_id)
    if not source:
        raise HTTPException(status_code=404, detail="场景不存在")

    if source.visibility == "private" and source.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="无权复制私有场景")

    # 创建新场景
    forked = Scenario(
        name=f"{source.name} (复制)",
        track=source.track,
        mode=source.mode,
        difficulty=source.difficulty,
        description=source.description,
        config=source.config.copy() if source.config else {},
        rubric_version=source.rubric_version,
        status="draft",
        created_by=current_user.id,
        visibility="private",
        forked_from=scenario_id,
    )
    db.add(forked)

    # 更新原场景统计
    source.fork_count += 1
    _update_hot_score(source)

    await db.commit()
    await db.refresh(forked)

    return {"success": True, "scenario_id": forked.id}


# ========== 场景详情 API ==========

class ScenarioDetailResponse(BaseModel):
    """场景详情响应"""
    id: str
    name: str
    description: str | None = None
    cover_image: str | None = None
    track: str
    difficulty: int
    tags: list[str] = []

    # 创作者
    creator: CreatorBrief | None = None

    # 统计
    train_count: int = 0
    likes_count: int = 0
    comments_count: int = 0
    fork_count: int = 0
    avg_score: float = 0.0
    pass_rate: float = 0.0

    # 用户状态
    is_liked: bool = False
    is_collected: bool = False
    is_forked: bool = False

    # 推荐
    is_official: bool = False
    is_featured: bool = False

    # 配置信息
    channel: str | None = None
    background: str | None = None
    objective: str | None = None

    created_at: str
    published_at: str | None = None

    class Config:
        from_attributes = True


class RelatedScenarioItem(BaseModel):
    id: str
    name: str
    track: str
    difficulty: int
    train_count: int
    avg_score: float


@router.get("/scenarios/{scenario_id}/detail", response_model=ScenarioDetailResponse)
async def get_scenario_detail(
    scenario_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
):
    """获取场景详情"""
    # 获取场景
    result = await db.execute(
        select(Scenario)
        .where(Scenario.id == scenario_id)
        .options(joinedload(Scenario.creator))
    )
    scenario = result.unique().scalar_one_or_none()

    if not scenario:
        raise HTTPException(status_code=404, detail="场景不存在")

    # 检查访问权限
    if scenario.visibility == "private" and scenario.created_by != (current_user.id if current_user else None):
        raise HTTPException(status_code=403, detail="无权访问私有场景")

    # 构建响应
    public_scenario = await _build_public_scenario(db, scenario, current_user)

    # 获取额外配置信息
    config = scenario.config or {}

    return ScenarioDetailResponse(
        id=public_scenario.id,
        name=public_scenario.name,
        description=public_scenario.description,
        cover_image=public_scenario.cover_image,
        track=public_scenario.track,
        difficulty=public_scenario.difficulty,
        tags=public_scenario.tags,
        creator=public_scenario.creator,
        train_count=public_scenario.train_count,
        likes_count=public_scenario.likes_count,
        comments_count=public_scenario.comments_count,
        fork_count=public_scenario.fork_count,
        avg_score=public_scenario.avg_score,
        pass_rate=0.0,  # TODO: 计算通过率
        is_liked=public_scenario.is_liked,
        is_collected=public_scenario.is_collected,
        is_forked=public_scenario.is_forked,
        is_official=public_scenario.is_official,
        is_featured=public_scenario.is_featured,
        channel=config.get("channel"),
        background=config.get("background"),
        objective=config.get("objective"),
        created_at=public_scenario.created_at,
        published_at=public_scenario.published_at,
    )


@router.get("/scenarios/{scenario_id}/related")
async def get_related_scenarios(
    scenario_id: str,
    limit: int = Query(6, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    """获取相关场景推荐"""
    # 获取当前场景
    scenario = await db.get(Scenario, scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="场景不存在")

    # 查找同赛道、相近难度的场景
    query = select(Scenario).where(
        and_(
            Scenario.id != scenario_id,
            Scenario.visibility == "public",
            Scenario.status == "published",
            Scenario.track == scenario.track,
            Scenario.difficulty.between(
                max(1, scenario.difficulty - 1),
                min(5, scenario.difficulty + 1)
            ),
        )
    ).order_by(desc(Scenario.hot_score)).limit(limit)

    result = await db.execute(query)
    related = result.scalars().all()

    return {
        "items": [
            RelatedScenarioItem(
                id=s.id,
                name=s.name,
                track=s.track,
                difficulty=s.difficulty,
                train_count=s.train_count,
                avg_score=s.avg_score,
            )
            for s in related
        ]
    }


# ========== 评论 API ==========

@router.get("/scenarios/{scenario_id}/comments", response_model=CommentListResponse)
async def get_scenario_comments(
    scenario_id: str,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
):
    """获取场景评论列表（包含回复）"""
    # 获取顶级评论
    query = select(ScenarioComment).where(
        and_(
            ScenarioComment.scenario_id == scenario_id,
            ScenarioComment.parent_id.is_(None),
            ScenarioComment.is_deleted.is_(False),
        )
    ).order_by(desc(ScenarioComment.likes_count), desc(ScenarioComment.created_at))

    total_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = total_result.scalar() or 0

    query = query.offset((page - 1) * size).limit(size)
    query = query.options(joinedload(ScenarioComment.user))

    result = await db.execute(query)
    comments = result.unique().scalars().all()

    items = []
    for comment in comments:
        # 加载回复
        replies_result = await db.execute(
            select(ScenarioComment)
            .where(
                and_(
                    ScenarioComment.parent_id == comment.id,
                    ScenarioComment.is_deleted.is_(False),
                )
            )
            .order_by(ScenarioComment.created_at)
            .limit(5)
            .options(joinedload(ScenarioComment.user))
        )
        replies = replies_result.unique().scalars().all()

        reply_items = [
            CommentItem(
                id=r.id,
                user_id=r.user_id,
                nickname=r.user.nickname if r.user else "未知用户",
                avatar=r.user.avatar if r.user else None,
                content=r.content,
                likes_count=r.likes_count,
                created_at=r.created_at.isoformat() if r.created_at else "",
                replies=[],
            )
            for r in replies
        ]

        item = CommentItem(
            id=comment.id,
            user_id=comment.user_id,
            nickname=comment.user.nickname if comment.user else "未知用户",
            avatar=comment.user.avatar if comment.user else None,
            content=comment.content,
            likes_count=comment.likes_count,
            created_at=comment.created_at.isoformat() if comment.created_at else "",
            replies=reply_items,
        )
        items.append(item)

    return CommentListResponse(items=items, total=total)


@router.post("/scenarios/{scenario_id}/comments")
async def create_scenario_comment(
    scenario_id: str,
    request: CreateCommentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """发表评论"""
    scenario = await db.get(Scenario, scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="场景不存在")

    comment = ScenarioComment(
        scenario_id=scenario_id,
        user_id=current_user.id,
        content=request.content,
        parent_id=request.parent_id,
    )
    db.add(comment)

    scenario.comments_count += 1
    _update_hot_score(scenario)

    await db.commit()
    await db.refresh(comment)

    return {
        "success": True,
        "comment_id": comment.id,
        "comments_count": scenario.comments_count,
    }


# ========== 快速创建 API ==========

@router.post("/scenarios/quick-create")
async def quick_create_scenario(
    request: QuickCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """快速创建场景（AI自动补充配置）"""
    # 根据描述自动生成配置
    config = {
        "channel": "电话",
        "persona": {
            "name": "客户",
            "identity": "潜在客户",
            "personality": "中立型",
            "attitude": "neutral",
            "pain_points": [],
            "objectives": [],
        },
        "background": request.description,
        "user_role": "销售代表" if request.track == "sales" else "普通用户",
        "objective": f"完成{request.name}相关的对话训练",
        "success_criteria": [],
    }

    scenario = Scenario(
        name=request.name,
        track=request.track,
        mode="train",
        difficulty=request.difficulty,
        description=request.description,
        config=config,
        rubric_version="v2.0",
        status="draft",
        created_by=current_user.id,
        visibility="private",
    )
    db.add(scenario)
    await db.commit()
    await db.refresh(scenario)

    return {"success": True, "scenario_id": scenario.id}


# ========== 辅助函数 ==========

async def _build_public_scenario(
    db: AsyncSession,
    scenario: Scenario,
    current_user: User | None,
) -> PublicScenario:
    """构建公开场景响应"""
    # 获取创作者信息
    creator_brief = None
    if scenario.creator:
        creator_brief = CreatorBrief(
            id=scenario.created_by or "",
            user_id=scenario.created_by or "",
            nickname=scenario.creator.nickname,
            avatar=getattr(scenario.creator, 'avatar', None),
            level=f"Lv.{getattr(scenario.creator, 'level', 1)}",
        )

    # 获取用户状态
    is_liked = False
    is_collected = False
    is_forked = False

    if current_user:
        # 检查点赞
        like_result = await db.execute(
            select(ScenarioLike).where(
                and_(
                    ScenarioLike.scenario_id == scenario.id,
                    ScenarioLike.user_id == current_user.id,
                )
            )
        )
        is_liked = like_result.scalar_one_or_none() is not None

        # 检查收藏
        collect_result = await db.execute(
            select(ScenarioCollection).where(
                and_(
                    ScenarioCollection.scenario_id == scenario.id,
                    ScenarioCollection.user_id == current_user.id,
                )
            )
        )
        is_collected = collect_result.scalar_one_or_none() is not None

        # 检查是否Fork过
        fork_result = await db.execute(
            select(Scenario).where(
                and_(
                    Scenario.forked_from == scenario.id,
                    Scenario.created_by == current_user.id,
                )
            )
        )
        is_forked = fork_result.scalar_one_or_none() is not None

    # 获取标签
    tags = scenario.config.get("tags", []) if scenario.config else []

    return PublicScenario(
        id=scenario.id,
        name=scenario.name,
        description=scenario.description,
        cover_image=scenario.cover_image,
        track=scenario.track,
        difficulty=scenario.difficulty,
        tags=tags,
        creator=creator_brief,
        train_count=scenario.train_count,
        likes_count=scenario.likes_count,
        comments_count=scenario.comments_count,
        fork_count=scenario.fork_count,
        avg_score=scenario.avg_score,
        is_liked=is_liked,
        is_collected=is_collected,
        is_forked=is_forked,
        is_official=scenario.is_official,
        is_featured=scenario.is_featured,
        created_at=scenario.created_at.isoformat() if scenario.created_at else "",
        published_at=scenario.published_at.isoformat() if scenario.published_at else None,
    )


def _update_hot_score(scenario: Scenario) -> None:
    """更新场景热度分数"""
    # 热度算法: 训练*1 + 点赞*2 + 评论*3 + Fork*5
    scenario.hot_score = (
        scenario.train_count * 1.0 +
        scenario.likes_count * 2.0 +
        scenario.comments_count * 3.0 +
        scenario.fork_count * 5.0 +
        scenario.avg_score * 0.5
    )


# ========== 标签 API ==========


@router.get("/tags/hot")
async def get_hot_tags(
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """获取热门标签"""
    tags = await plaza_service.get_hot_tags(db, limit)
    return {
        "items": [
            TagItem(
                id=tag.id,
                name=tag.name,
                category=tag.category,
                usage_count=tag.usage_count,
                is_hot=tag.is_hot,
            )
            for tag in tags
        ]
    }


@router.get("/tags")
async def get_tags(
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """获取标签列表"""
    tags = await plaza_service.get_tags_by_category(db, category)
    return {
        "items": [
            TagItem(
                id=tag.id,
                name=tag.name,
                category=tag.category,
                usage_count=tag.usage_count,
                is_hot=tag.is_hot,
            )
            for tag in tags
        ]
    }


@router.get("/tags/search")
async def search_tags(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """搜索标签"""
    tags = await plaza_service.search_tags(db, q, limit)
    return {
        "items": [
            TagItem(
                id=tag.id,
                name=tag.name,
                category=tag.category,
                usage_count=tag.usage_count,
                is_hot=tag.is_hot,
            )
            for tag in tags
        ]
    }


# ========== 搜索 API ==========


@router.get("/search/hot")
async def get_hot_searches(
    limit: int = Query(10, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    """获取热门搜索"""
    hot_searches = await plaza_service.get_hot_searches(db, limit)
    return {"items": [{"keyword": hs.keyword, "count": hs.search_count} for hs in hot_searches]}


@router.get("/search/suggestions")
async def get_search_suggestions(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    """获取搜索建议"""
    user_id = current_user.id if current_user else None
    suggestions = await plaza_service.get_search_suggestions(db, user_id, q, limit)
    return {"items": suggestions}


@router.get("/search/history")
async def get_search_history(
    limit: int = Query(10, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取搜索历史"""
    history = await plaza_service.get_search_history(db, current_user.id, limit)
    return {"items": history}


@router.delete("/search/history")
async def clear_search_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """清空搜索历史"""
    await db.execute(delete(SearchHistory).where(SearchHistory.user_id == current_user.id))
    await db.commit()
    return {"success": True, "message": "搜索历史已清空"}


# ========== 积分 API ==========


@router.get("/points/balance")
async def get_points_balance(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取积分余额"""
    from datetime import date
    
    user_points = await plaza_service.get_or_create_user_points(db, current_user.id)
    await db.commit()
    
    # 检查今天是否已签到
    # last_checkin_date 是字符串格式 "YYYY-MM-DD"，需要转换为相同格式比较
    today_str = date.today().isoformat()
    checked_in_today = user_points.last_checkin_date == today_str

    return PointsBalance(
        total_points=user_points.total_points,
        available_points=user_points.available_points,
        level=user_points.level,
        exp=user_points.exp,
        streak_days=user_points.streak_days,
        checked_in_today=checked_in_today,
        today_points=10 if checked_in_today else 0,  # 基础签到积分
    )


@router.get("/points/records")
async def get_point_records(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取积分记录"""
    records, total = await plaza_service.get_point_records(db, current_user.id, page, size)

    return {
        "items": [
            PointRecordItem(
                id=r.id,
                points=r.points,
                type=r.type,
                source=r.source,
                description=r.description,
                created_at=r.created_at.isoformat() if r.created_at else "",
            )
            for r in records
        ],
        "total": total,
        "page": page,
        "size": size,
    }


@router.post("/points/checkin")
async def daily_checkin(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """每日签到"""
    result = await plaza_service.daily_checkin(db, current_user.id)
    await db.commit()
    return result


# ========== 成就 API ==========


@router.get("/achievements")
async def get_achievements(
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取成就列表"""
    achievements = await plaza_service.get_user_achievements(db, current_user.id, category)
    return {"items": achievements}


@router.get("/achievements/my")
async def get_my_achievements(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取我的已解锁成就"""
    achievements = await plaza_service.get_user_achievements(db, current_user.id)
    unlocked = [a for a in achievements if a["is_unlocked"]]
    return {
        "items": unlocked,
        "total_unlocked": len(unlocked),
        "total_achievements": len(achievements),
    }


# ========== 排行榜 API ==========


@router.get("/leaderboards/scenarios")
async def get_scenario_leaderboard(
    type: Literal["hot", "new", "rating", "trains"] = "hot",
    track: str | None = None,
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """获取场景排行榜"""
    items = await plaza_service.get_scenario_leaderboard(db, type, track, limit)
    return {"items": items, "type": type}


@router.get("/leaderboards/creators")
async def get_creator_leaderboard(
    type: Literal["popular", "contribution", "influence"] = "popular",
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """获取创作者排行榜"""
    items = await plaza_service.get_creator_leaderboard(db, type, limit)
    return {"items": items, "type": type}


@router.get("/leaderboards/users")
async def get_user_leaderboard(
    type: Literal["training", "points", "improvement"] = "points",
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """获取用户排行榜"""
    items = await plaza_service.get_user_leaderboard(db, type, limit)
    return {"items": items, "type": type}


# ========== 专题/合集 API ==========


@router.get("/collections/official")
async def get_official_collections(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """获取官方专题"""
    collections = await plaza_service.get_official_collections(db, limit)
    return {
        "items": [
            CollectionItemSchema(
                id=c.id,
                title=c.title,
                description=c.description,
                cover_image=c.cover_image,
                is_official=c.is_official,
                scenario_count=c.scenario_count,
                created_at=c.created_at.isoformat() if c.created_at else "",
            )
            for c in collections
        ]
    }


@router.get("/collections/my")
async def get_my_collections(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取我的合集"""
    collections = await plaza_service.get_user_collections(db, current_user.id)
    return {
        "items": [
            CollectionItemSchema(
                id=c.id,
                title=c.title,
                description=c.description,
                cover_image=c.cover_image,
                is_official=c.is_official,
                scenario_count=c.scenario_count,
                created_at=c.created_at.isoformat() if c.created_at else "",
            )
            for c in collections
        ]
    }


@router.post("/collections")
async def create_collection(
    request: CreateCollectionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建合集"""
    collection = await plaza_service.create_collection(
        db,
        current_user.id,
        request.title,
        request.description,
        request.cover_image,
        request.is_public,
    )
    await db.commit()

    return {
        "success": True,
        "collection_id": collection.id,
        "message": "合集创建成功",
    }


@router.get("/collections/{collection_id}")
async def get_collection_detail(
    collection_id: str,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """获取合集详情及场景列表"""
    # 获取合集信息
    result = await db.execute(select(Collection).where(Collection.id == collection_id))
    collection = result.scalar_one_or_none()

    if not collection:
        raise HTTPException(status_code=404, detail="合集不存在")

    # 获取场景列表
    scenarios, total = await plaza_service.get_collection_scenarios(db, collection_id, page, size)

    return {
        "collection": CollectionItemSchema(
            id=collection.id,
            title=collection.title,
            description=collection.description,
            cover_image=collection.cover_image,
            is_official=collection.is_official,
            scenario_count=collection.scenario_count,
            created_at=collection.created_at.isoformat() if collection.created_at else "",
        ),
        "scenarios": [
            {
                "id": s.id,
                "name": s.name,
                "description": s.description,
                "track": s.track,
                "difficulty": s.difficulty,
            }
            for s in scenarios
        ],
        "total": total,
        "page": page,
        "size": size,
    }


@router.post("/collections/{collection_id}/scenarios/{scenario_id}")
async def add_to_collection(
    collection_id: str,
    scenario_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """添加场景到合集"""
    success = await plaza_service.add_scenario_to_collection(
        db, collection_id, scenario_id, current_user.id
    )

    if not success:
        raise HTTPException(status_code=400, detail="添加失败，可能无权限或已存在")

    await db.commit()
    return {"success": True, "message": "添加成功"}


@router.delete("/collections/{collection_id}/scenarios/{scenario_id}")
async def remove_from_collection(
    collection_id: str,
    scenario_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """从合集移除场景"""
    success = await plaza_service.remove_scenario_from_collection(
        db, collection_id, scenario_id, current_user.id
    )

    if not success:
        raise HTTPException(status_code=400, detail="移除失败")

    await db.commit()
    return {"success": True, "message": "移除成功"}


# ========== 创作者 API ==========


@router.get("/creators/{creator_id}")
async def get_creator_profile(
    creator_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    """获取创作者详情"""
    user_id = current_user.id if current_user else None
    profile = await plaza_service.get_creator_profile(db, creator_id, user_id)

    if not profile:
        raise HTTPException(status_code=404, detail="创作者不存在")

    return profile


@router.get("/creators/{creator_id}/scenarios")
async def get_creator_scenarios(
    creator_id: str,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """获取创作者发布的场景"""
    scenarios, total = await plaza_service.get_creator_scenarios(db, creator_id, page, size)

    return {
        "items": [
            {
                "id": s.id,
                "name": s.name,
                "description": s.description,
                "track": s.track,
                "difficulty": s.difficulty,
                "train_count": s.train_count,
                "likes_count": s.likes_count,
                "avg_score": s.avg_score,
                "published_at": s.published_at.isoformat() if s.published_at else None,
            }
            for s in scenarios
        ],
        "total": total,
        "page": page,
        "size": size,
    }


@router.get("/creators/{creator_id}/followers")
async def get_creator_followers(
    creator_id: str,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """获取创作者的粉丝列表"""
    followers, total = await plaza_service.get_creator_followers(db, creator_id, page, size)

    return {
        "items": followers,
        "total": total,
        "page": page,
        "size": size,
    }


@router.post("/creators/{creator_id}/follow")
async def follow_creator(
    creator_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """关注创作者"""
    success = await plaza_service.follow_creator(db, current_user.id, creator_id)

    if not success:
        raise HTTPException(status_code=400, detail="关注失败，可能已关注或不能关注自己")

    await db.commit()
    return {"success": True, "message": "关注成功"}


@router.delete("/creators/{creator_id}/follow")
async def unfollow_creator(
    creator_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """取消关注创作者"""
    success = await plaza_service.unfollow_creator(db, current_user.id, creator_id)

    if not success:
        raise HTTPException(status_code=400, detail="取消关注失败")

    await db.commit()
    return {"success": True, "message": "已取消关注"}


# ========== 评论点赞 API ==========


@router.post("/comments/{comment_id}/like")
async def like_comment(
    comment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """点赞评论"""
    success, likes_count = await plaza_service.like_comment(db, comment_id, current_user.id)

    if not success:
        raise HTTPException(status_code=400, detail="点赞失败，可能已点赞")

    await db.commit()
    return {"success": True, "likes_count": likes_count}


@router.delete("/comments/{comment_id}/like")
async def unlike_comment(
    comment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """取消点赞评论"""
    success, likes_count = await plaza_service.unlike_comment(db, comment_id, current_user.id)

    if not success:
        raise HTTPException(status_code=400, detail="取消点赞失败")

    await db.commit()
    return {"success": True, "likes_count": likes_count}


@router.get("/scenarios/{scenario_id}/comments/hot")
async def get_hot_comments(
    scenario_id: str,
    limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    """获取热门评论"""
    comments = await plaza_service.get_hot_comments(db, scenario_id, limit)

    return {
        "items": [
            {
                "id": c.id,
                "user_id": c.user_id,
                "nickname": c.user.nickname if c.user else "未知",
                "avatar": c.user.avatar if c.user else None,
                "content": c.content,
                "likes_count": c.likes_count,
                "created_at": c.created_at.isoformat() if c.created_at else "",
            }
            for c in comments
        ]
    }
