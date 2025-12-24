"""用户路由"""

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.api.deps import CurrentUserId, DatabaseSession
from app.schemas.user import (
    ProfileResponse, 
    ProfileUpdate, 
    UserResponse, 
    UserUpdate,
    OnboardingData,
    OnboardingStatus,
)
from app.services.user_service import UserService
from app.core.exceptions import NotFoundException

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def get_current_user(user_id: CurrentUserId, db: DatabaseSession):
    """获取当前用户信息"""
    service = UserService(db)
    return await service.get_current_user(user_id)


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    user_id: CurrentUserId,
    user_in: UserUpdate,
    db: DatabaseSession,
):
    """更新当前用户信息"""
    service = UserService(db)
    user = await service.get_user_by_id(user_id)
    if not user:
        raise NotFoundException("用户不存在")

    # 更新字段
    if user_in.nickname is not None:
        user.nickname = user_in.nickname
    if user_in.avatar is not None:
        user.avatar = user_in.avatar
    if user_in.track is not None:
        user.track = user_in.track

    return UserResponse.model_validate(user)


@router.get("/me/profile", response_model=ProfileResponse)
async def get_user_profile(user_id: CurrentUserId, db: DatabaseSession):
    """获取用户画像"""
    service = UserService(db)
    profile = await service.get_user_profile(user_id)
    return ProfileResponse.model_validate(profile)


@router.put("/me/profile", response_model=ProfileResponse)
async def update_user_profile(
    user_id: CurrentUserId,
    profile_in: ProfileUpdate,
    db: DatabaseSession,
):
    """更新用户画像"""
    service = UserService(db)
    profile = await service.update_user_profile(user_id, profile_in.preferences)
    return ProfileResponse.model_validate(profile)


# ===== Onboarding 引导 =====
@router.get("/me/onboarding-status", response_model=OnboardingStatus)
async def get_onboarding_status(user_id: CurrentUserId, db: DatabaseSession):
    """获取引导状态"""
    service = UserService(db)
    user = await service.get_current_user(user_id)
    profile = await service.get_user_profile(user_id)
    
    return OnboardingStatus(
        onboarding_completed=profile.onboarding_completed,
        baseline_completed=profile.baseline_completed,
        track=user.track,
        goal=profile.goal,
        experience_level=profile.experience_level,
        daily_commitment_min=profile.daily_commitment_min,
    )


@router.put("/me/onboarding", response_model=OnboardingStatus)
async def complete_onboarding(
    user_id: CurrentUserId,
    data: OnboardingData,
    db: DatabaseSession,
):
    """保存引导数据并标记完成"""
    service = UserService(db)
    
    # 更新用户赛道
    user = await service.get_user_by_id(user_id)
    if not user:
        raise NotFoundException("用户不存在")
    user.track = data.track
    
    # 更新画像
    profile = await service.get_user_profile(user_id)
    profile.goal = data.goal
    profile.experience_level = data.experience_level
    profile.daily_commitment_min = data.daily_commitment_min
    profile.onboarding_completed = True
    
    await db.commit()
    
    return OnboardingStatus(
        onboarding_completed=True,
        baseline_completed=profile.baseline_completed,
        track=data.track,
        goal=data.goal,
        experience_level=data.experience_level,
        daily_commitment_min=data.daily_commitment_min,
    )


# ===== Baseline 基线测评 =====
class BaselineData(BaseModel):
    """基线测评数据"""
    questionnaire: dict[str, int] = Field(..., description="问卷答案")
    score: int = Field(..., ge=0, le=100, description="分数")
    weak_dimensions: list[str] = Field(default_factory=list, description="弱项维度")


@router.put("/me/baseline")
async def complete_baseline(
    user_id: CurrentUserId,
    data: BaselineData,
    db: DatabaseSession,
):
    """完成基线测评"""
    service = UserService(db)
    profile = await service.get_user_profile(user_id)
    
    # 更新基线测评数据
    profile.baseline_questionnaire = data.questionnaire
    profile.baseline_score = data.score
    profile.weak_dimensions = data.weak_dimensions
    profile.baseline_completed = True
    
    await db.commit()
    
    return {
        "success": True,
        "baseline_completed": True,
        "score": data.score,
        "weak_dimensions": data.weak_dimensions,
    }


@router.get("/me/baseline/scenarios")
async def get_baseline_scenarios(
    user_id: CurrentUserId,
    db: DatabaseSession,
):
    """
    获取基线测评的 Exam 场景
    
    返回 2 个固定 seed 的 Exam 场景，用于基线测评
    """
    from sqlalchemy import select
    from app.models.scenario import Scenario
    from app.models.user import User
    
    # 获取用户赛道
    user = await db.get(User, user_id)
    track = user.track if user else "sales"
    
    # 查找该赛道下的基础场景（难度1-2）
    stmt = select(Scenario).where(
        Scenario.track == track,
        Scenario.status == "published",
        Scenario.difficulty <= 2,  # 基础难度
    ).order_by(Scenario.difficulty).limit(2)
    
    result = await db.execute(stmt)
    scenarios = result.scalars().all()
    
    # 为每个场景分配固定 seed
    baseline_scenarios = []
    fixed_seeds = [20241220, 20241221]  # 固定 seed，保证可复现
    
    for i, scenario in enumerate(scenarios):
        baseline_scenarios.append({
            "id": scenario.id,
            "name": scenario.name,
            "description": scenario.description,
            "difficulty": scenario.difficulty,
            "channel": scenario.channel,
            "seed": fixed_seeds[i] if i < len(fixed_seeds) else 20241220 + i,
            "mode": "exam",
            "order": i + 1,
        })
    
    # 如果场景不足，添加默认场景
    if len(baseline_scenarios) < 2:
        stmt = select(Scenario).where(
            Scenario.status == "published",
        ).order_by(Scenario.difficulty).limit(2 - len(baseline_scenarios))
        result = await db.execute(stmt)
        extra_scenarios = result.scalars().all()
        
        for i, scenario in enumerate(extra_scenarios):
            order = len(baseline_scenarios) + i + 1
            baseline_scenarios.append({
                "id": scenario.id,
                "name": scenario.name,
                "description": scenario.description,
                "difficulty": scenario.difficulty,
                "channel": getattr(scenario, 'channel', '电话'),
                "seed": fixed_seeds[order - 1] if order - 1 < len(fixed_seeds) else 20241220 + order,
                "mode": "exam",
                "order": order,
            })
    
    return {
        "scenarios": baseline_scenarios,
        "total": len(baseline_scenarios),
        "description": "基线测评包含 2 个标准化场景，用于评估您的当前能力水平",
    }
