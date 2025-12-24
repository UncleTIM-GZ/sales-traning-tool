"""场景路由"""

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Query

from app.api.deps import CurrentUserId, DatabaseSession, OptionalUserId
from app.schemas.scenario import (
    ScenarioCreate,
    ScenarioListResponse,
    ScenarioPackListResponse,
    ScenarioResponse,
    ScenarioUpdate,
    UserScenarioCreate,
)
from app.services.scenario_service import ScenarioService

router = APIRouter()


@router.get("", response_model=ScenarioListResponse)
async def list_scenarios(
    db: DatabaseSession,
    user_id: OptionalUserId = None,
    track: Literal["sales", "social"] | None = Query(None, description="赛道筛选"),
    difficulty: int | None = Query(None, ge=1, le=5, description="难度筛选"),
    channel: str | None = Query(None, description="渠道筛选"),
    status: Literal["draft", "published", "archived"] | None = Query(None, description="状态筛选"),
    scope: Literal["all", "mine", "official", "public"] = Query("all", description="范围筛选"),
    include_custom: bool = Query(True, description="是否包含自定义场景"),
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
):
    """
    获取场景列表

    支持按赛道、难度、渠道、状态筛选
    """
    service = ScenarioService(db)
    return await service.list_scenarios(
        user_id=user_id,
        track=track,
        difficulty=difficulty,
        channel=channel,
        status=status,
        scope=scope,
        include_custom=include_custom,
        page=page,
        size=size,
    )


@router.get("/packs", response_model=ScenarioPackListResponse)
async def list_scenario_packs(
    db: DatabaseSession,
    user_id: OptionalUserId = None,
    track: Literal["sales", "social"] | None = Query(None, description="赛道筛选"),
):
    """获取场景包列表"""
    service = ScenarioService(db)
    return await service.list_packs(track=track)


@router.get("/{scenario_id}", response_model=ScenarioResponse)
async def get_scenario(
    db: DatabaseSession,
    scenario_id: str,
    user_id: OptionalUserId = None,
):
    """获取场景详情"""
    service = ScenarioService(db)
    scenario = await service.get_scenario(scenario_id)
    
    return {
        "id": str(scenario.id),
        "name": scenario.name,
        "track": scenario.track,
        "mode": scenario.mode,
        "difficulty": scenario.difficulty,
        "description": scenario.description,
        "config": scenario.config,
        "rubric_version": scenario.rubric_version,
        "status": scenario.status,
    }


@router.post("", response_model=ScenarioResponse, status_code=201)
async def create_scenario(
    user_id: CurrentUserId,
    db: DatabaseSession,
    scenario_in: ScenarioCreate,
):
    """
    创建场景（管理员）

    需要管理员权限
    """
    service = ScenarioService(db)
    scenario = await service.create_scenario({
        "name": scenario_in.name,
        "track": scenario_in.track,
        "mode": scenario_in.mode,
        "difficulty": scenario_in.difficulty,
        "description": scenario_in.description,
        "config": scenario_in.config,
        "rubric_version": scenario_in.rubric_version,
        "status": "draft",
    })
    
    return {
        "id": str(scenario.id),
        "name": scenario.name,
        "track": scenario.track,
        "mode": scenario.mode,
        "difficulty": scenario.difficulty,
        "description": scenario.description,
        "config": scenario.config,
        "rubric_version": scenario.rubric_version,
        "status": scenario.status,
    }


@router.post("/custom", response_model=ScenarioResponse, status_code=201)
async def create_custom_scenario(
    user_id: CurrentUserId,
    db: DatabaseSession,
    scenario_in: UserScenarioCreate,
):
    """
    用户创建自定义场景
    """
    service = ScenarioService(db)
    
    # 构建场景配置
    config = {
        "channel": scenario_in.channel,
        "tags": scenario_in.tags,
        "persona": scenario_in.ai_identity,
        "ai_name": scenario_in.ai_name,
        "ai_personality": scenario_in.ai_personality,
        "ai_attitude": scenario_in.ai_attitude,
        "ai_pain_points": scenario_in.ai_pain_points,
        "ai_objectives": scenario_in.ai_objectives,
        "background": scenario_in.background,
        "user_role": scenario_in.user_role,
        "objective": scenario_in.objective,
        "success_criteria": scenario_in.success_criteria,
    }
    
    scenario = await service.create_user_scenario(
        user_id=user_id,
        data={
            "name": scenario_in.name,
            "track": scenario_in.track,
            "mode": "train",
            "difficulty": scenario_in.difficulty,
            "description": scenario_in.description,
            "config": config,
            "rubric_version": "1.0",
            "status": "published",
            "visibility": "private", # DB enum definition mismatch: 'pending' not supported in DB yet. Default to private.
        }
    )
    
    return {
        "id": str(scenario.id),
        "name": scenario.name,
        "track": scenario.track,
        "mode": scenario.mode,
        "difficulty": scenario.difficulty,
        "description": scenario.description,
        "config": scenario.config,
        "rubric_version": scenario.rubric_version,
        "status": scenario.status,
    }


@router.put("/{scenario_id}", response_model=ScenarioResponse)
async def update_scenario(
    user_id: CurrentUserId,
    db: DatabaseSession,
    scenario_id: UUID,
    scenario_in: ScenarioUpdate,
):
    """
    更新场景（管理员）

    需要管理员权限
    """
    service = ScenarioService(db)
    
    update_data = {}
    if scenario_in.name is not None:
        update_data["name"] = scenario_in.name
    if scenario_in.difficulty is not None:
        update_data["difficulty"] = scenario_in.difficulty
    if scenario_in.description is not None:
        update_data["description"] = scenario_in.description
    if scenario_in.config is not None:
        update_data["config"] = scenario_in.config
    if scenario_in.status is not None:
        update_data["status"] = scenario_in.status
    
    scenario = await service.update_scenario(scenario_id, update_data)
    
    return {
        "id": str(scenario.id),
        "name": scenario.name,
        "track": scenario.track,
        "mode": scenario.mode,
        "difficulty": scenario.difficulty,
        "description": scenario.description,
        "config": scenario.config,
        "rubric_version": scenario.rubric_version,
        "status": scenario.status,
    }


@router.delete("/{scenario_id}", status_code=204)
async def delete_scenario(
    user_id: CurrentUserId,
    db: DatabaseSession,
    scenario_id: str,
):
    """
    删除场景
    
    用户只能删除自己创建的场景
    """
    service = ScenarioService(db)
    
    # 检查权限：获取场景判断是否归属当前用户
    scenario = await service.get_scenario(scenario_id)
    if scenario.created_by != user_id:
        # 管理员可以删除任意场景(这里暂未实现管理员判断，简单起见仅允许本人)
        # 如果需要管理员权限，需扩展 CurrentUserId 为 CurrentUser 并检查 role
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="无权删除此场景")
        
    await service.delete_scenario(scenario_id)
