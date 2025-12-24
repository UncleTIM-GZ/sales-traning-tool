"""
开发：Excellent（11964948@qq.com）
功能：广场后台管理 API
作用：管理官方专题、成就、热门搜索、标签等
创建时间：2025-12-24
最后修改：2025-12-24
"""


from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin, get_db
from app.models import User
from app.models.plaza import (
    Collection,
    CollectionScenario,
    HotSearch,
    PlazaAchievement,
    PlazaUserAchievement,
    PlazaUserPoints,
    ScenarioTag,
)

router = APIRouter()


# ========== Schemas ==========


class CreateCollectionRequest(BaseModel):
    title: str
    description: str | None = None
    cover_image: str | None = None
    is_official: bool = True
    sort_order: int = 0


class UpdateCollectionRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    cover_image: str | None = None
    sort_order: int | None = None


class CreatePlazaAchievementRequest(BaseModel):
    name: str
    description: str | None = None
    icon: str | None = None
    category: str
    condition: dict
    reward_points: int = 0
    rarity: str = "common"
    sort_order: int = 0


class UpdatePlazaAchievementRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    icon: str | None = None
    category: str | None = None
    condition: dict | None = None
    reward_points: int | None = None
    rarity: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class CreateHotSearchRequest(BaseModel):
    keyword: str
    is_pinned: bool = False
    sort_order: int = 0


class CreateTagRequest(BaseModel):
    name: str
    category: str = "other"
    is_hot: bool = False


# ========== 统计 API ==========


@router.get("/stats")
async def get_plaza_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """获取广场统计数据"""
    # 专题统计
    collections_result = await db.execute(select(func.count()).select_from(Collection))
    total_collections = collections_result.scalar() or 0

    official_result = await db.execute(
        select(func.count()).select_from(Collection).where(Collection.is_official.is_(True))
    )
    official_collections = official_result.scalar() or 0

    # 成就统计
    achievements_result = await db.execute(select(func.count()).select_from(PlazaAchievement))
    total_achievements = achievements_result.scalar() or 0

    unlocks_result = await db.execute(
        select(func.count())
        .select_from(PlazaUserAchievement)
        .where(PlazaUserAchievement.is_unlocked.is_(True))
    )
    total_unlocks = unlocks_result.scalar() or 0

    # 标签统计
    tags_result = await db.execute(select(func.count()).select_from(ScenarioTag))
    total_tags = tags_result.scalar() or 0

    hot_tags_result = await db.execute(
        select(func.count()).select_from(ScenarioTag).where(ScenarioTag.is_hot.is_(True))
    )
    hot_tags = hot_tags_result.scalar() or 0

    # 积分统计
    points_result = await db.execute(
        select(func.sum(PlazaUserPoints.total_points)).select_from(PlazaUserPoints)
    )
    total_points = points_result.scalar() or 0

    return {
        "collections": {
            "total": total_collections,
            "official": official_collections,
        },
        "achievements": {
            "total": total_achievements,
            "total_unlocks": total_unlocks,
        },
        "tags": {
            "total": total_tags,
            "hot": hot_tags,
        },
        "points": {
            "total_distributed": total_points,
        },
    }


# ========== 专题管理 API ==========


@router.get("/collections")
async def list_collections(
    is_official: bool | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """获取专题列表"""
    query = select(Collection).order_by(Collection.sort_order, Collection.created_at.desc())

    if is_official is not None:
        query = query.where(Collection.is_official == is_official)

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar() or 0

    query = query.offset((page - 1) * size).limit(size)
    result = await db.execute(query)
    collections = result.scalars().all()

    return {
        "items": [
            {
                "id": c.id,
                "title": c.title,
                "description": c.description,
                "cover_image": c.cover_image,
                "is_official": c.is_official,
                "is_public": c.is_public,
                "scenario_count": c.scenario_count,
                "sort_order": c.sort_order,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in collections
        ],
        "total": total,
        "page": page,
        "size": size,
    }


@router.post("/collections")
async def create_collection(
    request: CreateCollectionRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """创建官方专题"""
    collection = Collection(
        title=request.title,
        description=request.description,
        cover_image=request.cover_image,
        is_official=request.is_official,
        is_public=True,
        sort_order=request.sort_order,
    )
    db.add(collection)
    await db.commit()
    await db.refresh(collection)

    return {
        "success": True,
        "collection_id": collection.id,
        "message": "专题创建成功",
    }


@router.put("/collections/{collection_id}")
async def update_collection(
    collection_id: str,
    request: UpdateCollectionRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """更新专题"""
    result = await db.execute(select(Collection).where(Collection.id == collection_id))
    collection = result.scalar_one_or_none()

    if not collection:
        raise HTTPException(status_code=404, detail="专题不存在")

    if request.title is not None:
        collection.title = request.title
    if request.description is not None:
        collection.description = request.description
    if request.cover_image is not None:
        collection.cover_image = request.cover_image
    if request.sort_order is not None:
        collection.sort_order = request.sort_order

    await db.commit()

    return {"success": True, "message": "更新成功"}


@router.delete("/collections/{collection_id}")
async def delete_collection(
    collection_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """删除专题"""
    result = await db.execute(select(Collection).where(Collection.id == collection_id))
    collection = result.scalar_one_or_none()

    if not collection:
        raise HTTPException(status_code=404, detail="专题不存在")

    # 删除关联
    await db.execute(
        delete(CollectionScenario).where(CollectionScenario.collection_id == collection_id)
    )

    await db.delete(collection)
    await db.commit()

    return {"success": True, "message": "删除成功"}


# ========== 成就管理 API ==========


@router.get("/achievements")
async def list_achievements(
    category: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """获取成就列表"""
    query = select(PlazaAchievement).order_by(
        PlazaAchievement.sort_order, PlazaAchievement.created_at
    )

    if category:
        query = query.where(PlazaAchievement.category == category)

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar() or 0

    query = query.offset((page - 1) * size).limit(size)
    result = await db.execute(query)
    achievements = result.scalars().all()

    # 获取解锁统计
    unlock_counts = {}
    for achievement in achievements:
        count_result = await db.execute(
            select(func.count())
            .select_from(PlazaUserAchievement)
            .where(
                PlazaUserAchievement.achievement_id == achievement.id,
                PlazaUserAchievement.is_unlocked.is_(True),
            )
        )
        unlock_counts[achievement.id] = count_result.scalar() or 0

    return {
        "items": [
            {
                "id": a.id,
                "name": a.name,
                "description": a.description,
                "icon": a.icon,
                "category": a.category,
                "condition": a.condition,
                "reward_points": a.reward_points,
                "rarity": a.rarity,
                "sort_order": a.sort_order,
                "is_active": a.is_active,
                "unlock_count": unlock_counts.get(a.id, 0),
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in achievements
        ],
        "total": total,
        "page": page,
        "size": size,
    }


@router.post("/achievements")
async def create_achievement(
    request: CreatePlazaAchievementRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """创建成就"""
    achievement = PlazaAchievement(
        name=request.name,
        description=request.description,
        icon=request.icon,
        category=request.category,
        condition=request.condition,
        reward_points=request.reward_points,
        rarity=request.rarity,
        sort_order=request.sort_order,
    )
    db.add(achievement)
    await db.commit()
    await db.refresh(achievement)

    return {
        "success": True,
        "achievement_id": achievement.id,
        "message": "成就创建成功",
    }


@router.put("/achievements/{achievement_id}")
async def update_achievement(
    achievement_id: str,
    request: UpdatePlazaAchievementRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """更新成就"""
    result = await db.execute(select(PlazaAchievement).where(PlazaAchievement.id == achievement_id))
    achievement = result.scalar_one_or_none()

    if not achievement:
        raise HTTPException(status_code=404, detail="成就不存在")

    if request.name is not None:
        achievement.name = request.name
    if request.description is not None:
        achievement.description = request.description
    if request.icon is not None:
        achievement.icon = request.icon
    if request.category is not None:
        achievement.category = request.category
    if request.condition is not None:
        achievement.condition = request.condition
    if request.reward_points is not None:
        achievement.reward_points = request.reward_points
    if request.rarity is not None:
        achievement.rarity = request.rarity
    if request.sort_order is not None:
        achievement.sort_order = request.sort_order
    if request.is_active is not None:
        achievement.is_active = request.is_active

    await db.commit()

    return {"success": True, "message": "更新成功"}


@router.delete("/achievements/{achievement_id}")
async def delete_achievement(
    achievement_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """删除成就"""
    result = await db.execute(select(PlazaAchievement).where(PlazaAchievement.id == achievement_id))
    achievement = result.scalar_one_or_none()

    if not achievement:
        raise HTTPException(status_code=404, detail="成就不存在")

    # 删除用户成就记录
    await db.execute(
        delete(PlazaUserAchievement).where(PlazaUserAchievement.achievement_id == achievement_id)
    )

    await db.delete(achievement)
    await db.commit()

    return {"success": True, "message": "删除成功"}


# ========== 热门搜索管理 API ==========


@router.get("/hot-searches")
async def list_hot_searches(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """获取热门搜索列表"""
    query = select(HotSearch).order_by(
        HotSearch.is_pinned.desc(),
        HotSearch.search_count.desc(),
    )

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar() or 0

    query = query.offset((page - 1) * size).limit(size)
    result = await db.execute(query)
    searches = result.scalars().all()

    return {
        "items": [
            {
                "id": s.id,
                "keyword": s.keyword,
                "search_count": s.search_count,
                "is_pinned": s.is_pinned,
                "sort_order": s.sort_order,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in searches
        ],
        "total": total,
        "page": page,
        "size": size,
    }


@router.post("/hot-searches")
async def create_hot_search(
    request: CreateHotSearchRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """创建热门搜索"""
    # 检查是否已存在
    existing = await db.execute(select(HotSearch).where(HotSearch.keyword == request.keyword))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="关键词已存在")

    hot_search = HotSearch(
        keyword=request.keyword,
        is_pinned=request.is_pinned,
        sort_order=request.sort_order,
    )
    db.add(hot_search)
    await db.commit()

    return {"success": True, "message": "创建成功"}


@router.put("/hot-searches/{search_id}")
async def update_hot_search(
    search_id: str,
    is_pinned: bool | None = None,
    sort_order: int | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """更新热门搜索"""
    result = await db.execute(select(HotSearch).where(HotSearch.id == search_id))
    hot_search = result.scalar_one_or_none()

    if not hot_search:
        raise HTTPException(status_code=404, detail="记录不存在")

    if is_pinned is not None:
        hot_search.is_pinned = is_pinned
    if sort_order is not None:
        hot_search.sort_order = sort_order

    await db.commit()

    return {"success": True, "message": "更新成功"}


@router.delete("/hot-searches/{search_id}")
async def delete_hot_search(
    search_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """删除热门搜索"""
    result = await db.execute(select(HotSearch).where(HotSearch.id == search_id))
    hot_search = result.scalar_one_or_none()

    if not hot_search:
        raise HTTPException(status_code=404, detail="记录不存在")

    await db.delete(hot_search)
    await db.commit()

    return {"success": True, "message": "删除成功"}


# ========== 标签管理 API ==========


@router.get("/tags")
async def list_tags(
    category: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """获取标签列表"""
    query = select(ScenarioTag).order_by(ScenarioTag.usage_count.desc())

    if category:
        query = query.where(ScenarioTag.category == category)

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar() or 0

    query = query.offset((page - 1) * size).limit(size)
    result = await db.execute(query)
    tags = result.scalars().all()

    return {
        "items": [
            {
                "id": t.id,
                "name": t.name,
                "category": t.category,
                "usage_count": t.usage_count,
                "is_hot": t.is_hot,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in tags
        ],
        "total": total,
        "page": page,
        "size": size,
    }


@router.post("/tags")
async def create_tag(
    request: CreateTagRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """创建标签"""
    # 检查是否已存在
    existing = await db.execute(select(ScenarioTag).where(ScenarioTag.name == request.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="标签已存在")

    tag = ScenarioTag(
        name=request.name,
        category=request.category,
        is_hot=request.is_hot,
    )
    db.add(tag)
    await db.commit()

    return {"success": True, "message": "创建成功"}


@router.put("/tags/{tag_id}")
async def update_tag(
    tag_id: str,
    category: str | None = None,
    is_hot: bool | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """更新标签"""
    result = await db.execute(select(ScenarioTag).where(ScenarioTag.id == tag_id))
    tag = result.scalar_one_or_none()

    if not tag:
        raise HTTPException(status_code=404, detail="标签不存在")

    if category is not None:
        tag.category = category
    if is_hot is not None:
        tag.is_hot = is_hot

    await db.commit()

    return {"success": True, "message": "更新成功"}


@router.delete("/tags/{tag_id}")
async def delete_tag(
    tag_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """删除标签"""
    from app.models.plaza import ScenarioTagRelation

    result = await db.execute(select(ScenarioTag).where(ScenarioTag.id == tag_id))
    tag = result.scalar_one_or_none()

    if not tag:
        raise HTTPException(status_code=404, detail="标签不存在")

    # 删除关联
    await db.execute(delete(ScenarioTagRelation).where(ScenarioTagRelation.tag_id == tag_id))

    await db.delete(tag)
    await db.commit()

    return {"success": True, "message": "删除成功"}
