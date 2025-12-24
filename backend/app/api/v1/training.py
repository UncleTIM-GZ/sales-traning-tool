"""训练计划路由"""

from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Query, HTTPException

from app.api.deps import CurrentUserId, DatabaseSession
from app.schemas.training import (
    DayTasks,
    ProgressResponse,
    TaskCompleteRequest,
    TaskCompleteResponse,
    TaskItem,
    TrainingPlanCreate,
    TrainingPlanGenerate,
    TrainingPlanListItem,
    TrainingPlanListResponse,
    TrainingPlanResponse,
    TrainingPlanUpdate,
)
from app.services.training_plan_service import TrainingPlanService

router = APIRouter()


def _plan_to_response(plan, service: TrainingPlanService) -> dict:
    """将计划模型转换为响应格式"""
    # 转换 daily_tasks 格式
    daily_tasks = []
    for day_data in plan.daily_tasks:
        tasks = []
        for task in day_data.get("tasks", []):
            tasks.append(TaskItem(
                id=task.get("id", ""),
                type=task.get("type", "learn"),
                title=task.get("title", ""),
                description=task.get("description"),
                duration_min=task.get("duration_min", 10),
                content_type=task.get("content_type"),
                content_id=task.get("content_id"),
                status=task.get("status", "pending"),
                result_score=task.get("result_score"),
            ))
        
        # 检查是否今天
        is_today = day_data.get("day") == plan.current_day
        # 检查是否完成
        is_completed = all(t.status in ["completed", "skipped"] for t in tasks) if tasks else False
        
        daily_tasks.append(DayTasks(
            day=day_data.get("day", 1),
            tasks=tasks,
            is_today=is_today,
            is_completed=is_completed,
        ))
    
    progress = service.calculate_progress(plan)
    
    return {
        "id": plan.id,
        "user_id": plan.user_id,
        "name": plan.name,
        "description": plan.description,
        "duration_days": plan.duration_days,
        "target_dimensions": plan.target_dimensions or [],
        "experience_level": plan.experience_level,
        "daily_time_min": plan.daily_time_min,
        "daily_tasks": daily_tasks,
        "current_day": plan.current_day,
        "completed_tasks": plan.completed_tasks or [],
        "status": plan.status,
        "progress": progress,
        "started_at": plan.started_at,
        "completed_at": plan.completed_at,
    }


@router.get("/plans", response_model=TrainingPlanListResponse)
async def list_training_plans(
    user_id: CurrentUserId,
    db: DatabaseSession,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
):
    """获取训练计划列表"""
    service = TrainingPlanService(db)
    plans, total = await service.list_plans(user_id, page, size)
    
    items = []
    for plan in plans:
        progress = service.calculate_progress(plan)
        items.append(TrainingPlanListItem(
            id=plan.id,
            name=plan.name,
            description=plan.description,
            duration_days=plan.duration_days,
            current_day=plan.current_day,
            status=plan.status,
            progress=progress,
            started_at=plan.started_at,
        ))
    
    return TrainingPlanListResponse(
        items=items,
        total=total,
        page=page,
        size=size,
    )


@router.post("/plans/generate", response_model=TrainingPlanResponse, status_code=201)
async def generate_training_plan(
    user_id: CurrentUserId,
    db: DatabaseSession,
    plan_in: TrainingPlanGenerate,
):
    """
    基于用户画像自动生成训练计划
    
    - 根据短板维度选择相关场景
    - 根据每日时间预算分配任务
    - 每天包含学习+练习+复盘三个任务
    """
    service = TrainingPlanService(db)
    plan = await service.generate_plan(
        user_id=user_id,
        duration_days=plan_in.duration_days,
        target_dimensions=plan_in.target_dimensions,
        daily_time_min=plan_in.daily_time_min,
    )
    
    return _plan_to_response(plan, service)


@router.post("/plans", response_model=TrainingPlanResponse, status_code=201)
async def create_training_plan(
    user_id: CurrentUserId,
    db: DatabaseSession,
    plan_in: TrainingPlanCreate,
):
    """
    创建训练计划
    
    可以手动创建或基于基线评估自动生成
    """
    service = TrainingPlanService(db)
    
    if plan_in.auto_generate:
        # 自动生成
        plan = await service.generate_plan(
            user_id=user_id,
            duration_days=plan_in.duration_days,
        )
    else:
        # 手动创建（简化版，生成空计划）
        plan = await service.generate_plan(
            user_id=user_id,
            duration_days=plan_in.duration_days,
        )
    
    return _plan_to_response(plan, service)


@router.get("/plans/active", response_model=TrainingPlanResponse | None)
async def get_active_plan(
    user_id: CurrentUserId,
    db: DatabaseSession,
):
    """获取当前激活的训练计划"""
    service = TrainingPlanService(db)
    plan = await service.get_active_plan(user_id)
    
    if not plan:
        return None
    
    return _plan_to_response(plan, service)


@router.get("/plans/{plan_id}", response_model=TrainingPlanResponse)
async def get_training_plan(
    user_id: CurrentUserId,
    db: DatabaseSession,
    plan_id: str,
):
    """获取训练计划详情"""
    service = TrainingPlanService(db)
    plan = await service.get_plan(plan_id, user_id)
    
    if not plan:
        raise HTTPException(status_code=404, detail="训练计划不存在")
    
    return _plan_to_response(plan, service)


@router.put("/plans/{plan_id}", response_model=TrainingPlanResponse)
async def update_training_plan(
    user_id: CurrentUserId,
    db: DatabaseSession,
    plan_id: str,
    plan_in: TrainingPlanUpdate,
):
    """更新训练计划"""
    service = TrainingPlanService(db)
    plan = await service.update_plan(
        plan_id=plan_id,
        user_id=user_id,
        name=plan_in.name,
        status=plan_in.status,
    )
    
    if not plan:
        raise HTTPException(status_code=404, detail="训练计划不存在")
    
    return _plan_to_response(plan, service)


@router.put("/plans/{plan_id}/tasks/{task_id}/complete", response_model=TaskCompleteResponse)
async def complete_task(
    user_id: CurrentUserId,
    db: DatabaseSession,
    plan_id: str,
    task_id: str,
    body: TaskCompleteRequest | None = None,
):
    """完成任务"""
    service = TrainingPlanService(db)
    
    try:
        result = await service.complete_task(
            plan_id=plan_id,
            task_id=task_id,
            user_id=user_id,
            result_score=body.result_score if body else None,
            result_data=body.result_data if body else None,
        )
        return TaskCompleteResponse(
            task_id=result["task_id"],
            status=result["status"],
            completed_at=result["completed_at"],
            plan_progress=result["plan_progress"],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/today", response_model=dict | None)
async def get_today_tasks(
    user_id: CurrentUserId,
    db: DatabaseSession,
):
    """
    获取今日任务
    
    返回当前计划的今日任务列表
    """
    service = TrainingPlanService(db)
    return await service.get_today_tasks(user_id)


@router.get("/progress", response_model=ProgressResponse)
async def get_training_progress(
    user_id: CurrentUserId,
    db: DatabaseSession,
):
    """
    获取训练进度

    包含当前计划进度、历史训练统计
    """
    service = TrainingPlanService(db)
    plan = await service.get_active_plan(user_id)
    
    current_plan = None
    if plan:
        # 计算今日完成情况
        day_data = next(
            (d for d in plan.daily_tasks if d.get("day") == plan.current_day),
            None
        )
        today_tasks = day_data.get("tasks", []) if day_data else []
        today_completed = sum(1 for t in today_tasks if t.get("status") == "completed")
        
        current_plan = {
            "id": plan.id,
            "name": plan.name,
            "day": plan.current_day,
            "total_days": plan.duration_days,
            "today_completed": today_completed,
            "today_total": len(today_tasks),
        }
    
    # TODO: 从数据库获取真实统计数据
    return ProgressResponse(
        user_id=user_id,
        current_plan=current_plan,
        stats={
            "total_sessions": 0,
            "total_duration_min": 0,
            "avg_score": 0,
            "score_trend": [],
        },
        streak={
            "current": 0,
            "longest": 0,
        },
    )
