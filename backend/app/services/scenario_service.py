"""场景服务层"""

from uuid import UUID

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import NotFoundException
from app.models.scenario import (
    Scenario,
    ScenarioPack,
)
from app.models.scenario_social import ScenarioCollection
from app.models.user import User


class ScenarioService:
    """场景服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_scenarios(
        self,
        user_id: str | None = None,
        track: str | None = None,
        difficulty: int | None = None,
        channel: str | None = None,
        status: str | None = None,
        scope: str | None = None,
        include_custom: bool = True,
        page: int = 1,
        size: int = 20,
    ) -> dict:
        """获取场景列表"""
        query = select(Scenario)

        # 权限控制逻辑：
        # 1. 基础过滤：状态必须是 published (Draft/Archived 不显示)
        if status:
            query = query.where(Scenario.status == status)
        else:
            query = query.where(Scenario.status == "published")

        if track:
            query = query.where(Scenario.track == track)
        if difficulty:
            query = query.where(Scenario.difficulty == difficulty)
        
        # 渠道筛选
        if channel:
            query = query.where(Scenario.config["channel"].astext == channel)
        
        # 场景可见性逻辑
        # 场景可见性逻辑
        
        if scope == "mine" and user_id:
            # 仅显示我创建的 或 我收藏的
            # 获取收藏的场景ID子查询
            collected_subquery = select(ScenarioCollection.scenario_id).where(
                ScenarioCollection.user_id == user_id
            )
            
            query = query.where(
                or_(
                    Scenario.created_by == user_id,
                    Scenario.id.in_(collected_subquery),
                )
            )
        elif scope == "official":
            # 官方精选：显示被标记为精选的场景（is_featured=true）
            query = query.where(
                Scenario.visibility == "public",
                Scenario.is_featured == True,
            )
        elif scope == "public":
            # 仅显示所有公开场景
            query = query.where(Scenario.visibility == "public")
        elif not include_custom:
            # 兼容旧参数：仅显示官方公开
            query = query.where(
                Scenario.created_by == None,
                Scenario.visibility == "public"
            )
        elif user_id:
            # 默认(all)：登录用户可以看到公开的和自己的
            query = query.where(
                or_(
                    Scenario.visibility == "public",
                    Scenario.created_by == user_id
                )
            )
        else:
            # 默认(all)：未登录只看公开
            query = query.where(Scenario.visibility == "public")

        # 计算总数
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        # 分页
        query = query.offset((page - 1) * size).limit(size)
        query = query.order_by(Scenario.created_at.desc())
        
        # 加载关联数据
        query = query.options(selectinload(Scenario.creator))

        result = await self.db.execute(query)
        scenarios = result.scalars().all()

        # 获取当前用户的收藏列表
        collected_ids = set()
        if user_id:
            from app.models.scenario_social import ScenarioCollection
            col_result = await self.db.execute(
                select(ScenarioCollection.scenario_id).where(
                    ScenarioCollection.user_id == user_id
                )
            )
            collected_ids = set(col_result.scalars().all())

        return {
            "items": [
                {
                    "id": str(s.id),
                    "name": s.name,
                    "track": s.track,
                    "mode": s.mode,
                    "difficulty": s.difficulty,
                    "description": s.description,
                    "config": s.config,
                    "status": s.status,
                    "is_custom": s.created_by is not None,
                    "created_by": s.created_by,
                    "is_collected": s.id in collected_ids,
                    "creator": {
                        "nickname": s.creator.nickname,
                        "avatar": s.creator.avatar,
                        "level": s.creator.level,
                        "is_verified": getattr(s.creator, "is_verified", False)
                    } if s.creator else None,
                    "created_at": s.created_at.isoformat() if s.created_at else None,
                }
                for s in scenarios
            ],
            "total": total,
            "page": page,
            "size": size,
        }

    async def get_scenario(self, scenario_id: str) -> Scenario:
        """获取场景详情"""
        result = await self.db.execute(
            select(Scenario).where(Scenario.id == scenario_id)
        )
        scenario = result.scalar_one_or_none()

        if not scenario:
            raise NotFoundException("场景不存在")

        return scenario

    async def list_packs(self, track: str | None = None) -> dict:
        """获取场景包列表"""
        query = select(ScenarioPack).where(ScenarioPack.status == "published")

        if track:
            query = query.where(ScenarioPack.track == track)

        result = await self.db.execute(query)
        packs = result.scalars().all()

        items = []
        for p in packs:
            # 获取包内场景数量
            count_result = await self.db.execute(
                select(func.count()).where(Scenario.pack_id == p.id)
            )
            scenario_count = count_result.scalar() or 0

            items.append({
                "id": str(p.id),
                "name": p.name,
                "track": p.track,
                "difficulty_range": p.difficulty_range,
                "scenario_count": scenario_count,
                "status": p.status,
            })

        return {"items": items, "total": len(items)}

    async def create_scenario(self, data: dict) -> Scenario:
        """创建场景"""
        scenario = Scenario(**data)
        self.db.add(scenario)
        await self.db.flush()
        return scenario

    async def create_user_scenario(self, user_id: str, data: dict) -> Scenario:
        """创建用户自定义场景"""
        data["created_by"] = user_id
        scenario = Scenario(**data)
        self.db.add(scenario)
        await self.db.commit()
        await self.db.refresh(scenario)
        return scenario

    async def update_scenario(self, scenario_id: UUID, data: dict) -> Scenario:
        """更新场景"""
        scenario = await self.get_scenario(scenario_id)

        for key, value in data.items():
            if value is not None:
                setattr(scenario, key, value)

        return scenario

    async def delete_scenario(self, scenario_id: str) -> None:
        """删除场景"""
        scenario = await self.get_scenario(scenario_id)
        await self.db.delete(scenario)
        await self.db.commit()
