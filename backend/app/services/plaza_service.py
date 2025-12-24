"""
开发：Excellent（11964948@qq.com）
功能：训练广场服务层
作用：提供积分、成就、排行榜、标签等业务逻辑
创建时间：2025-12-24
最后修改：2025-12-24
"""

import math
from datetime import UTC, date, datetime
from typing import Literal

from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models import Scenario
from app.models.plaza import (
    Collection,
    CollectionScenario,
    CommentLike,
    HotSearch,
    PlazaAchievement,
    PlazaPointRecord,
    PlazaUserAchievement,
    PlazaUserPoints,
    ScenarioTag,
    ScenarioTagRelation,
    SearchHistory,
)
from app.models.scenario_social import (
    Creator,
    CreatorFollow,
    ScenarioComment,
)

# ========== 积分服务 ==========

POINT_RULES = {
    "checkin": 5,  # 每日签到
    "training": 10,  # 完成训练
    "publish": 20,  # 发布场景
    "trained": 2,  # 场景被训练
    "liked": 1,  # 获得点赞
    "comment": 2,  # 发表评论
}

LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500, 7500]


async def get_or_create_user_points(db: AsyncSession, user_id: str) -> PlazaUserPoints:
    """获取或创建用户积分记录"""
    result = await db.execute(select(PlazaUserPoints).where(PlazaUserPoints.user_id == user_id))
    user_points = result.scalar_one_or_none()

    if not user_points:
        user_points = PlazaUserPoints(user_id=user_id)
        db.add(user_points)
        await db.flush()

    return user_points


async def add_points(
    db: AsyncSession,
    user_id: str,
    source: str,
    description: str | None = None,
    reference_id: str | None = None,
) -> tuple[int, int]:
    """
    添加积分
    返回: (获得的积分, 当前总积分)
    """
    points = POINT_RULES.get(source, 0)
    if points <= 0:
        return 0, 0

    user_points = await get_or_create_user_points(db, user_id)

    # 更新积分
    user_points.total_points += points
    user_points.available_points += points
    user_points.exp += points

    # 检查升级
    new_level = calculate_level(user_points.total_points)
    if new_level > user_points.level:
        user_points.level = new_level

    # 记录积分变化
    record = PlazaPointRecord(
        user_id=user_id,
        points=points,
        type="earn",
        source=source,
        description=description,
        reference_id=reference_id,
    )
    db.add(record)

    return points, user_points.total_points


def calculate_level(total_points: int) -> int:
    """根据总积分计算等级"""
    for i, threshold in enumerate(LEVEL_THRESHOLDS):
        if total_points < threshold:
            return max(1, i)
    return len(LEVEL_THRESHOLDS)


async def daily_checkin(db: AsyncSession, user_id: str) -> dict:
    """每日签到"""
    from app.models.system_config import SystemConfig
    
    user_points = await get_or_create_user_points(db, user_id)
    today = date.today().isoformat()

    # 检查是否已签到
    if user_points.last_checkin_date == today:
        return {"success": False, "message": "今日已签到", "points": 0, "already_checked_in": True}

    # 获取签到配置
    config_result = await db.execute(
        select(SystemConfig).where(SystemConfig.key == "checkin_config")
    )
    config_record = config_result.scalar_one_or_none()
    
    if config_record and config_record.value:
        checkin_config = config_record.value
        base_points = checkin_config.get("base_points", 5)
        streak_bonus_config = checkin_config.get("streak_bonus", {})
        enabled = checkin_config.get("enabled", True)
    else:
        # 默认配置
        base_points = 5
        streak_bonus_config = {"3": 5, "7": 10, "14": 20, "30": 50}
        enabled = True
    
    if not enabled:
        return {"success": False, "message": "签到功能暂时关闭", "points": 0}

    # 检查连续签到
    yesterday = (date.today().replace(day=date.today().day - 1)).isoformat()
    if user_points.last_checkin_date == yesterday:
        user_points.streak_days += 1
    else:
        user_points.streak_days = 1

    user_points.last_checkin_date = today

    # 计算基础积分
    points = base_points
    
    # 记录基础签到积分
    user_points.total_points += points
    user_points.available_points += points
    user_points.exp += points
    
    record = PlazaPointRecord(
        user_id=user_id,
        points=points,
        type="earn",
        source="checkin",
        description=f"每日签到 (连续第{user_points.streak_days}天)",
    )
    db.add(record)

    # 计算连续签到奖励
    bonus = 0
    streak_days_str = str(user_points.streak_days)
    if streak_days_str in streak_bonus_config:
        bonus = streak_bonus_config[streak_days_str]
    
    bonus_message = None
    if bonus > 0:
        user_points.total_points += bonus
        user_points.available_points += bonus
        bonus_record = PlazaPointRecord(
            user_id=user_id,
            points=bonus,
            type="earn",
            source="checkin_bonus",
            description=f"连续签到{user_points.streak_days}天奖励",
        )
        db.add(bonus_record)
        bonus_message = f"连续签到{user_points.streak_days}天，额外奖励{bonus}积分"

    # 检查升级
    new_level = calculate_level(user_points.total_points)
    if new_level > user_points.level:
        user_points.level = new_level

    return {
        "success": True,
        "message": "签到成功",
        "points": points,
        "bonus": bonus,
        "bonus_message": bonus_message,
        "total_points_earned": points + bonus,
        "streak_days": user_points.streak_days,
        "total_points": user_points.total_points,
    }


async def get_point_records(
    db: AsyncSession,
    user_id: str,
    page: int = 1,
    size: int = 20,
) -> tuple[list[PlazaPointRecord], int]:
    """获取积分记录"""
    query = (
        select(PlazaPointRecord)
        .where(PlazaPointRecord.user_id == user_id)
        .order_by(desc(PlazaPointRecord.created_at))
    )

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar() or 0

    query = query.offset((page - 1) * size).limit(size)
    result = await db.execute(query)
    records = result.scalars().all()

    return list(records), total


# ========== 成就服务 ==========


async def check_and_unlock_achievements(
    db: AsyncSession,
    user_id: str,
    check_type: str,
    current_value: int | float,
) -> list[PlazaAchievement]:
    """检查并解锁成就"""
    # 获取该类型的所有成就
    result = await db.execute(
        select(PlazaAchievement).where(
            and_(
                PlazaAchievement.is_active,
                PlazaAchievement.condition["type"].astext == check_type,
            )
        )
    )
    achievements = result.scalars().all()

    unlocked = []
    for achievement in achievements:
        condition_value = achievement.condition.get("value", 0)

        # 检查是否已解锁
        ua_result = await db.execute(
            select(PlazaUserAchievement).where(
                and_(
                    PlazaUserAchievement.user_id == user_id,
                    PlazaUserAchievement.achievement_id == achievement.id,
                )
            )
        )
        user_achievement = ua_result.scalar_one_or_none()

        if user_achievement and user_achievement.is_unlocked:
            continue

        # 计算进度
        progress = min(100, int((current_value / condition_value) * 100))

        if not user_achievement:
            user_achievement = PlazaUserAchievement(
                user_id=user_id,
                achievement_id=achievement.id,
                progress=progress,
                is_unlocked=progress >= 100,
            )
            db.add(user_achievement)
        else:
            user_achievement.progress = progress
            user_achievement.is_unlocked = progress >= 100

        # 如果解锁，发放奖励
        if user_achievement.is_unlocked:
            unlocked.append(achievement)
            if achievement.reward_points > 0:
                user_points = await get_or_create_user_points(db, user_id)
                user_points.total_points += achievement.reward_points
                user_points.available_points += achievement.reward_points

                record = PlazaPointRecord(
                    user_id=user_id,
                    points=achievement.reward_points,
                    type="earn",
                    source="achievement",
                    description=f"解锁成就: {achievement.name}",
                    reference_id=achievement.id,
                )
                db.add(record)

    return unlocked


async def get_user_achievements(
    db: AsyncSession,
    user_id: str,
    category: str | None = None,
) -> list[dict]:
    """获取用户成就列表"""
    query = select(PlazaAchievement).where(PlazaAchievement.is_active)
    if category:
        query = query.where(PlazaAchievement.category == category)
    query = query.order_by(PlazaAchievement.sort_order)

    result = await db.execute(query)
    achievements = result.scalars().all()

    # 获取用户解锁状态
    ua_result = await db.execute(
        select(PlazaUserAchievement).where(PlazaUserAchievement.user_id == user_id)
    )
    user_achievements = {ua.achievement_id: ua for ua in ua_result.scalars().all()}

    items = []
    for achievement in achievements:
        ua = user_achievements.get(achievement.id)
        items.append(
            {
                "id": achievement.id,
                "name": achievement.name,
                "description": achievement.description,
                "icon": achievement.icon,
                "category": achievement.category,
                "rarity": achievement.rarity,
                "reward_points": achievement.reward_points,
                "progress": ua.progress if ua else 0,
                "is_unlocked": ua.is_unlocked if ua else False,
                "unlocked_at": ua.updated_at.isoformat() if ua and ua.is_unlocked else None,
            }
        )

    return items


# ========== 标签服务 ==========


async def get_hot_tags(db: AsyncSession, limit: int = 20) -> list[ScenarioTag]:
    """获取热门标签"""
    result = await db.execute(
        select(ScenarioTag)
        .where(ScenarioTag.is_hot)
        .order_by(desc(ScenarioTag.usage_count))
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_tags_by_category(
    db: AsyncSession,
    category: str | None = None,
) -> list[ScenarioTag]:
    """按分类获取标签"""
    query = select(ScenarioTag).order_by(desc(ScenarioTag.usage_count))
    if category:
        query = query.where(ScenarioTag.category == category)

    result = await db.execute(query)
    return list(result.scalars().all())


async def search_tags(db: AsyncSession, keyword: str, limit: int = 10) -> list[ScenarioTag]:
    """搜索标签"""
    result = await db.execute(
        select(ScenarioTag)
        .where(ScenarioTag.name.ilike(f"%{keyword}%"))
        .order_by(desc(ScenarioTag.usage_count))
        .limit(limit)
    )
    return list(result.scalars().all())


async def add_tags_to_scenario(
    db: AsyncSession,
    scenario_id: str,
    tag_names: list[str],
) -> None:
    """为场景添加标签"""
    for tag_name in tag_names:
        # 获取或创建标签
        result = await db.execute(select(ScenarioTag).where(ScenarioTag.name == tag_name))
        tag = result.scalar_one_or_none()

        if not tag:
            tag = ScenarioTag(name=tag_name, category="other")
            db.add(tag)
            await db.flush()

        # 检查是否已关联
        rel_result = await db.execute(
            select(ScenarioTagRelation).where(
                and_(
                    ScenarioTagRelation.scenario_id == scenario_id,
                    ScenarioTagRelation.tag_id == tag.id,
                )
            )
        )
        if not rel_result.scalar_one_or_none():
            relation = ScenarioTagRelation(scenario_id=scenario_id, tag_id=tag.id)
            db.add(relation)
            tag.usage_count += 1


# ========== 搜索服务 ==========


async def get_hot_searches(db: AsyncSession, limit: int = 10) -> list[HotSearch]:
    """获取热门搜索"""
    result = await db.execute(
        select(HotSearch)
        .order_by(desc(HotSearch.is_pinned), desc(HotSearch.search_count))
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_search_suggestions(
    db: AsyncSession,
    user_id: str | None,
    keyword: str,
    limit: int = 10,
) -> list[str]:
    """获取搜索建议"""
    suggestions = []

    # 从热门搜索中匹配
    hot_result = await db.execute(
        select(HotSearch.keyword)
        .where(HotSearch.keyword.ilike(f"%{keyword}%"))
        .order_by(desc(HotSearch.search_count))
        .limit(5)
    )
    suggestions.extend([r[0] for r in hot_result.all()])

    # 从场景名称中匹配
    scenario_result = await db.execute(
        select(Scenario.name)
        .where(
            and_(
                Scenario.visibility == "public",
                Scenario.status == "published",
                Scenario.name.ilike(f"%{keyword}%"),
            )
        )
        .limit(5)
    )
    suggestions.extend([r[0] for r in scenario_result.all()])

    # 去重并限制数量
    seen = set()
    unique_suggestions = []
    for s in suggestions:
        if s.lower() not in seen:
            seen.add(s.lower())
            unique_suggestions.append(s)
            if len(unique_suggestions) >= limit:
                break

    return unique_suggestions


async def save_search_history(
    db: AsyncSession,
    user_id: str,
    keyword: str,
) -> None:
    """保存搜索历史"""
    # 删除旧的相同关键词
    await db.execute(
        select(SearchHistory).where(
            and_(
                SearchHistory.user_id == user_id,
                SearchHistory.keyword == keyword,
            )
        )
    )

    # 添加新记录
    history = SearchHistory(user_id=user_id, keyword=keyword)
    db.add(history)

    # 更新热门搜索计数
    hot_result = await db.execute(select(HotSearch).where(HotSearch.keyword == keyword))
    hot = hot_result.scalar_one_or_none()
    if hot:
        hot.search_count += 1
    else:
        hot = HotSearch(keyword=keyword, search_count=1)
        db.add(hot)

    # 限制历史记录数量
    count_result = await db.execute(
        select(func.count()).select_from(SearchHistory).where(SearchHistory.user_id == user_id)
    )
    count = count_result.scalar() or 0

    if count > 10:
        # 删除最旧的记录
        oldest = await db.execute(
            select(SearchHistory)
            .where(SearchHistory.user_id == user_id)
            .order_by(SearchHistory.created_at)
            .limit(count - 10)
        )
        for record in oldest.scalars().all():
            await db.delete(record)


async def get_search_history(
    db: AsyncSession,
    user_id: str,
    limit: int = 10,
) -> list[str]:
    """获取用户搜索历史"""
    result = await db.execute(
        select(SearchHistory.keyword)
        .where(SearchHistory.user_id == user_id)
        .order_by(desc(SearchHistory.created_at))
        .limit(limit)
    )
    return [r[0] for r in result.all()]


# ========== 专题/合集服务 ==========


async def get_official_collections(
    db: AsyncSession,
    limit: int = 10,
) -> list[Collection]:
    """获取官方专题"""
    result = await db.execute(
        select(Collection)
        .where(
            and_(
                Collection.is_official,
                Collection.is_public,
            )
        )
        .order_by(Collection.sort_order)
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_user_collections(
    db: AsyncSession,
    user_id: str,
) -> list[Collection]:
    """获取用户的合集"""
    result = await db.execute(
        select(Collection)
        .where(Collection.user_id == user_id)
        .order_by(desc(Collection.created_at))
    )
    return list(result.scalars().all())


async def create_collection(
    db: AsyncSession,
    user_id: str,
    title: str,
    description: str | None = None,
    cover_image: str | None = None,
    is_public: bool = True,
) -> Collection:
    """创建合集"""
    collection = Collection(
        user_id=user_id,
        title=title,
        description=description,
        cover_image=cover_image,
        is_public=is_public,
    )
    db.add(collection)
    await db.flush()
    return collection


async def add_scenario_to_collection(
    db: AsyncSession,
    collection_id: str,
    scenario_id: str,
    user_id: str,
) -> bool:
    """添加场景到合集"""
    # 检查合集所有权
    result = await db.execute(select(Collection).where(Collection.id == collection_id))
    collection = result.scalar_one_or_none()

    if not collection or (collection.user_id != user_id and not collection.is_official):
        return False

    # 检查是否已存在
    rel_result = await db.execute(
        select(CollectionScenario).where(
            and_(
                CollectionScenario.collection_id == collection_id,
                CollectionScenario.scenario_id == scenario_id,
            )
        )
    )
    if rel_result.scalar_one_or_none():
        return False

    # 添加关联
    relation = CollectionScenario(
        collection_id=collection_id,
        scenario_id=scenario_id,
        sort_order=collection.scenario_count,
    )
    db.add(relation)
    collection.scenario_count += 1

    return True


async def remove_scenario_from_collection(
    db: AsyncSession,
    collection_id: str,
    scenario_id: str,
    user_id: str,
) -> bool:
    """从合集移除场景"""
    # 检查合集所有权
    result = await db.execute(select(Collection).where(Collection.id == collection_id))
    collection = result.scalar_one_or_none()

    if not collection or (collection.user_id != user_id and not collection.is_official):
        return False

    # 删除关联
    rel_result = await db.execute(
        select(CollectionScenario).where(
            and_(
                CollectionScenario.collection_id == collection_id,
                CollectionScenario.scenario_id == scenario_id,
            )
        )
    )
    relation = rel_result.scalar_one_or_none()

    if relation:
        await db.delete(relation)
        collection.scenario_count = max(0, collection.scenario_count - 1)
        return True

    return False


async def get_collection_scenarios(
    db: AsyncSession,
    collection_id: str,
    page: int = 1,
    size: int = 20,
) -> tuple[list[Scenario], int]:
    """获取合集中的场景"""
    # 获取关联
    query = (
        select(Scenario)
        .join(CollectionScenario, CollectionScenario.scenario_id == Scenario.id)
        .where(CollectionScenario.collection_id == collection_id)
        .order_by(CollectionScenario.sort_order)
    )

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar() or 0

    query = query.offset((page - 1) * size).limit(size)
    result = await db.execute(query)
    scenarios = result.scalars().all()

    return list(scenarios), total


# ========== 排行榜服务 ==========


async def get_scenario_leaderboard(
    db: AsyncSession,
    leaderboard_type: Literal["hot", "new", "rating", "trains"] = "hot",
    track: str | None = None,
    limit: int = 50,
) -> list[dict]:
    """获取场景排行榜"""
    query = select(Scenario).where(
        and_(
            Scenario.visibility == "public",
            Scenario.status == "published",
        )
    )

    if track:
        query = query.where(Scenario.track == track)

    if leaderboard_type == "hot":
        query = query.order_by(desc(Scenario.hot_score))
    elif leaderboard_type == "new":
        query = query.order_by(desc(Scenario.published_at))
    elif leaderboard_type == "rating":
        query = query.order_by(desc(Scenario.avg_score))
    elif leaderboard_type == "trains":
        query = query.order_by(desc(Scenario.train_count))

    query = query.limit(limit)
    query = query.options(joinedload(Scenario.creator))

    result = await db.execute(query)
    scenarios = result.unique().scalars().all()

    items = []
    for rank, scenario in enumerate(scenarios, 1):
        items.append(
            {
                "rank": rank,
                "scenario_id": scenario.id,
                "name": scenario.name,
                "track": scenario.track,
                "difficulty": scenario.difficulty,
                "hot_score": scenario.hot_score,
                "train_count": scenario.train_count,
                "likes_count": scenario.likes_count,
                "avg_score": scenario.avg_score,
                "creator": {
                    "id": scenario.created_by,
                    "nickname": scenario.creator.nickname if scenario.creator else "官方",
                }
                if scenario.created_by
                else None,
            }
        )

    return items


async def get_creator_leaderboard(
    db: AsyncSession,
    leaderboard_type: Literal["popular", "contribution", "influence"] = "popular",
    limit: int = 50,
) -> list[dict]:
    """获取创作者排行榜"""
    query = select(Creator).options(joinedload(Creator.user))

    if leaderboard_type == "popular":
        query = query.order_by(desc(Creator.followers_count))
    elif leaderboard_type == "contribution":
        query = query.order_by(desc(Creator.scenario_count))
    elif leaderboard_type == "influence":
        # 综合指标: 粉丝*1 + 场景*10 + 训练*0.1 + 点赞*0.5
        query = query.order_by(
            desc(
                Creator.followers_count * 1
                + Creator.scenario_count * 10
                + Creator.total_trains * 0.1
                + Creator.total_likes * 0.5
            )
        )

    query = query.limit(limit)
    result = await db.execute(query)
    creators = result.unique().scalars().all()

    items = []
    for rank, creator in enumerate(creators, 1):
        items.append(
            {
                "rank": rank,
                "creator_id": creator.id,
                "user_id": creator.user_id,
                "nickname": creator.user.nickname if creator.user else "未知",
                "avatar": creator.user.avatar if creator.user else None,
                "level": f"Lv.{creator.creator_level}",
                "is_verified": creator.is_verified,
                "followers_count": creator.followers_count,
                "scenario_count": creator.scenario_count,
                "total_trains": creator.total_trains,
                "total_likes": creator.total_likes,
            }
        )

    return items


async def get_user_leaderboard(
    db: AsyncSession,
    leaderboard_type: Literal["training", "points", "improvement"] = "training",
    limit: int = 50,
) -> list[dict]:
    """获取用户排行榜"""
    if leaderboard_type == "points":
        query = (
            select(PlazaUserPoints)
            .options(joinedload(PlazaUserPoints.user))
            .order_by(desc(PlazaUserPoints.total_points))
            .limit(limit)
        )
        result = await db.execute(query)
        user_points_list = result.unique().scalars().all()

        items = []
        for rank, up in enumerate(user_points_list, 1):
            items.append(
                {
                    "rank": rank,
                    "user_id": up.user_id,
                    "nickname": up.user.nickname if up.user else "未知",
                    "avatar": up.user.avatar if up.user else None,
                    "level": f"Lv.{up.level}",
                    "total_points": up.total_points,
                    "streak_days": up.streak_days,
                }
            )
        return items

    # 训练排行榜 - 基于 Session 统计
    # TODO: 实现基于训练次数的排行榜
    return []


# ========== 评论点赞服务 ==========


async def like_comment(
    db: AsyncSession,
    comment_id: str,
    user_id: str,
) -> tuple[bool, int]:
    """点赞评论，返回 (是否成功, 当前点赞数)"""
    # 检查评论是否存在
    comment_result = await db.execute(
        select(ScenarioComment).where(ScenarioComment.id == comment_id)
    )
    comment = comment_result.scalar_one_or_none()
    if not comment:
        return False, 0

    # 检查是否已点赞
    like_result = await db.execute(
        select(CommentLike).where(
            and_(
                CommentLike.comment_id == comment_id,
                CommentLike.user_id == user_id,
            )
        )
    )
    if like_result.scalar_one_or_none():
        return False, comment.likes_count

    # 添加点赞
    like = CommentLike(comment_id=comment_id, user_id=user_id)
    db.add(like)
    comment.likes_count += 1

    # 给评论作者加积分
    if comment.user_id != user_id:
        await add_points(db, comment.user_id, "liked", "评论获得点赞", comment_id)

    return True, comment.likes_count


async def unlike_comment(
    db: AsyncSession,
    comment_id: str,
    user_id: str,
) -> tuple[bool, int]:
    """取消点赞评论"""
    # 检查评论是否存在
    comment_result = await db.execute(
        select(ScenarioComment).where(ScenarioComment.id == comment_id)
    )
    comment = comment_result.scalar_one_or_none()
    if not comment:
        return False, 0

    # 检查是否已点赞
    like_result = await db.execute(
        select(CommentLike).where(
            and_(
                CommentLike.comment_id == comment_id,
                CommentLike.user_id == user_id,
            )
        )
    )
    like = like_result.scalar_one_or_none()
    if not like:
        return False, comment.likes_count

    # 删除点赞
    await db.delete(like)
    comment.likes_count = max(0, comment.likes_count - 1)

    return True, comment.likes_count


async def get_hot_comments(
    db: AsyncSession,
    scenario_id: str,
    limit: int = 5,
) -> list[ScenarioComment]:
    """获取热门评论"""
    result = await db.execute(
        select(ScenarioComment)
        .where(
            and_(
                ScenarioComment.scenario_id == scenario_id,
                ScenarioComment.parent_id is None,
                not ScenarioComment.is_deleted,
            )
        )
        .order_by(desc(ScenarioComment.likes_count))
        .limit(limit)
        .options(joinedload(ScenarioComment.user))
    )
    return list(result.unique().scalars().all())


# ========== 创作者服务 ==========


async def get_or_create_creator(db: AsyncSession, user_id: str) -> Creator:
    """获取或创建创作者记录"""
    result = await db.execute(select(Creator).where(Creator.user_id == user_id))
    creator = result.scalar_one_or_none()

    if not creator:
        creator = Creator(user_id=user_id)
        db.add(creator)
        await db.flush()

    return creator


async def get_creator_profile(
    db: AsyncSession,
    creator_id: str,
    current_user_id: str | None = None,
) -> dict | None:
    """获取创作者详情"""
    result = await db.execute(
        select(Creator).where(Creator.id == creator_id).options(joinedload(Creator.user))
    )
    creator = result.unique().scalar_one_or_none()

    if not creator:
        return None

    # 检查是否已关注
    is_following = False
    if current_user_id:
        follow_result = await db.execute(
            select(CreatorFollow).where(
                and_(
                    CreatorFollow.follower_id == current_user_id,
                    CreatorFollow.creator_id == creator_id,
                )
            )
        )
        is_following = follow_result.scalar_one_or_none() is not None

    return {
        "id": creator.id,
        "user_id": creator.user_id,
        "nickname": creator.user.nickname if creator.user else "未知",
        "avatar": creator.user.avatar if creator.user else None,
        "bio": creator.bio,
        "level": f"Lv.{creator.creator_level}",
        "is_verified": creator.is_verified,
        "scenario_count": creator.scenario_count,
        "total_trains": creator.total_trains,
        "total_likes": creator.total_likes,
        "followers_count": creator.followers_count,
        "following_count": creator.following_count,
        "is_following": is_following,
        "created_at": creator.created_at.isoformat() if creator.created_at else None,
    }


async def follow_creator(
    db: AsyncSession,
    follower_id: str,
    creator_id: str,
) -> bool:
    """关注创作者"""
    # 检查创作者是否存在
    creator_result = await db.execute(select(Creator).where(Creator.id == creator_id))
    creator = creator_result.scalar_one_or_none()
    if not creator:
        return False

    # 不能关注自己
    if creator.user_id == follower_id:
        return False

    # 检查是否已关注
    follow_result = await db.execute(
        select(CreatorFollow).where(
            and_(
                CreatorFollow.follower_id == follower_id,
                CreatorFollow.creator_id == creator_id,
            )
        )
    )
    if follow_result.scalar_one_or_none():
        return False

    # 添加关注
    follow = CreatorFollow(follower_id=follower_id, creator_id=creator_id)
    db.add(follow)
    creator.followers_count += 1

    # 更新关注者的 following_count
    follower_creator = await get_or_create_creator(db, follower_id)
    follower_creator.following_count += 1

    return True


async def unfollow_creator(
    db: AsyncSession,
    follower_id: str,
    creator_id: str,
) -> bool:
    """取消关注创作者"""
    # 检查是否已关注
    follow_result = await db.execute(
        select(CreatorFollow).where(
            and_(
                CreatorFollow.follower_id == follower_id,
                CreatorFollow.creator_id == creator_id,
            )
        )
    )
    follow = follow_result.scalar_one_or_none()
    if not follow:
        return False

    # 删除关注
    await db.delete(follow)

    # 更新计数
    creator_result = await db.execute(select(Creator).where(Creator.id == creator_id))
    creator = creator_result.scalar_one_or_none()
    if creator:
        creator.followers_count = max(0, creator.followers_count - 1)

    follower_creator_result = await db.execute(
        select(Creator).where(Creator.user_id == follower_id)
    )
    follower_creator = follower_creator_result.scalar_one_or_none()
    if follower_creator:
        follower_creator.following_count = max(0, follower_creator.following_count - 1)

    return True


async def get_creator_followers(
    db: AsyncSession,
    creator_id: str,
    page: int = 1,
    size: int = 20,
) -> tuple[list[dict], int]:
    """获取创作者的粉丝列表"""
    query = (
        select(CreatorFollow)
        .where(CreatorFollow.creator_id == creator_id)
        .options(joinedload(CreatorFollow.follower))
        .order_by(desc(CreatorFollow.created_at))
    )

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar() or 0

    query = query.offset((page - 1) * size).limit(size)
    result = await db.execute(query)
    follows = result.unique().scalars().all()

    items = []
    for follow in follows:
        user = follow.follower
        items.append(
            {
                "user_id": user.id if user else None,
                "nickname": user.nickname if user else "未知",
                "avatar": user.avatar if user else None,
                "level": user.level if user else "Lv.1",
                "followed_at": follow.created_at.isoformat() if follow.created_at else None,
            }
        )

    return items, total


async def get_creator_scenarios(
    db: AsyncSession,
    creator_id: str,
    page: int = 1,
    size: int = 20,
) -> tuple[list[Scenario], int]:
    """获取创作者发布的场景"""
    # 获取创作者的 user_id
    creator_result = await db.execute(select(Creator).where(Creator.id == creator_id))
    creator = creator_result.scalar_one_or_none()
    if not creator:
        return [], 0

    query = (
        select(Scenario)
        .where(
            and_(
                Scenario.created_by == creator.user_id,
                Scenario.visibility == "public",
                Scenario.status == "published",
            )
        )
        .order_by(desc(Scenario.published_at))
    )

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar() or 0

    query = query.offset((page - 1) * size).limit(size)
    result = await db.execute(query)
    scenarios = result.scalars().all()

    return list(scenarios), total


# ========== 热度算法 ==========


def calculate_hot_score(
    train_count: int,
    likes_count: int,
    comments_count: int,
    fork_count: int,
    avg_score: float,
    published_at: datetime | None = None,
) -> float:
    """计算热度分数（带时间衰减）"""
    base_score = (
        train_count * 1.0
        + likes_count * 2.0
        + comments_count * 3.0
        + fork_count * 5.0
        + avg_score * 0.5
    )

    # 时间衰减因子
    if published_at:
        days_old = (datetime.now(UTC) - published_at).days
        decay = math.exp(-0.05 * days_old)  # 半衰期约14天
        base_score *= decay

    return base_score


async def update_scenario_hot_score(db: AsyncSession, scenario_id: str) -> None:
    """更新场景热度分数"""
    scenario = await db.get(Scenario, scenario_id)
    if scenario:
        scenario.hot_score = calculate_hot_score(
            scenario.train_count,
            scenario.likes_count,
            scenario.comments_count,
            scenario.fork_count,
            scenario.avg_score,
            scenario.published_at,
        )
