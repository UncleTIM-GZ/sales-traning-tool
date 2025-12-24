"""训练计划服务"""

import uuid
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scenario import Scenario
from app.models.training_plan import TrainingPlan, PlanTask
from app.models.user import Profile
from app.models.course import Course


class TrainingPlanService:
    """训练计划服务"""

    # 维度到场景标签的映射
    DIMENSION_SCENARIO_MAP = {
        "objection_handling": ["异议处理", "价格谈判"],
        "closing": ["促单成交", "临门一脚"],
        "rapport_building": ["破冰开场", "关系建立"],
        "need_discovery": ["需求挖掘", "痛点发现"],
        "product_presentation": ["产品介绍", "价值传递"],
        "confidence": ["自信表达", "气场训练"],
        "empathy": ["共情表达", "情绪管理"],
        "logic": ["逻辑表达", "结构化表达"],
    }

    # 学习内容模板
    LEARN_TASK_TEMPLATES = {
        "objection_handling": [
            {"title": "价格异议处理技巧", "description": "学习如何应对'太贵了'的客户"},
            {"title": "竞品对比话术", "description": "学习与竞争对手对比时的应对策略"},
            {"title": "延迟成交异议处理", "description": "学习如何应对'再考虑考虑'"},
        ],
        "closing": [
            {"title": "假设成交法", "description": "用假设已成交的方式引导客户"},
            {"title": "二选一成交法", "description": "给客户两个选择促进决策"},
            {"title": "稀缺紧迫法", "description": "利用稀缺性和紧迫感促成交"},
        ],
        "rapport_building": [
            {"title": "30秒破冰技巧", "description": "快速建立良好第一印象"},
            {"title": "寻找共同话题", "description": "通过共同兴趣拉近距离"},
            {"title": "镜像与匹配", "description": "模仿客户行为建立信任"},
        ],
        "need_discovery": [
            {"title": "SPIN提问法", "description": "情境-问题-暗示-需求四步提问"},
            {"title": "开放式提问技巧", "description": "用开放问题挖掘真实需求"},
            {"title": "痛点放大法", "description": "帮助客户认识到问题严重性"},
        ],
        "confidence": [
            {"title": "自信表达基础", "description": "语速、语调、停顿的运用"},
            {"title": "权威感塑造", "description": "专业词汇和案例引用"},
            {"title": "应对尴尬场景", "description": "如何优雅地化解尴尬"},
        ],
    }

    # 复盘任务模板
    REVIEW_TASK_TEMPLATES = [
        {"title": "今日训练复盘", "description": "回顾今天的训练，写下3个收获和1个改进点"},
        {"title": "话术优化笔记", "description": "整理今天学到的话术，用自己的语言重新表达"},
        {"title": "实战计划", "description": "规划明天在真实场景中应用所学的一个小目标"},
    ]

    def __init__(self, db: AsyncSession):
        self.db = db

    async def generate_plan(
        self,
        user_id: str,
        duration_days: int = 7,
        target_dimensions: list[str] | None = None,
        daily_time_min: int | None = None,
    ) -> TrainingPlan:
        """
        基于用户画像自动生成训练计划
        
        Args:
            user_id: 用户ID
            duration_days: 计划天数
            target_dimensions: 目标维度，为空则使用画像短板
            daily_time_min: 每日时间预算，为空则使用画像设置
        """
        # 获取用户画像
        profile = await self.db.scalar(
            select(Profile).where(Profile.user_id == user_id)
        )
        
        # 确定目标维度
        if not target_dimensions:
            target_dimensions = profile.weak_dimensions if profile else ["objection_handling", "closing"]
        if not target_dimensions:
            target_dimensions = ["objection_handling", "closing"]  # 默认
        
        # 确定每日时间
        if not daily_time_min:
            daily_time_min = profile.daily_commitment_min if profile else 30
        
        # 确定经验等级
        experience_level = profile.experience_level if profile else "beginner"
        
        # 获取相关场景
        scenarios = await self._get_relevant_scenarios(target_dimensions)
        
        # 生成每日任务
        daily_tasks = await self._generate_daily_tasks(
            duration_days=duration_days,
            target_dimensions=target_dimensions,
            daily_time_min=daily_time_min,
            experience_level=experience_level,
            scenarios=scenarios,
        )
        
        # 生成计划名称
        plan_name = self._generate_plan_name(target_dimensions, duration_days)
        
        # 创建计划
        plan = TrainingPlan(
            id=str(uuid.uuid4()),
            user_id=user_id,
            name=plan_name,
            description=f"基于您的能力画像自动生成的{duration_days}天个性化训练计划",
            duration_days=duration_days,
            target_dimensions=target_dimensions,
            experience_level=experience_level,
            daily_time_min=daily_time_min,
            daily_tasks=daily_tasks,
            current_day=1,
            completed_tasks=[],
            status="active",
            started_at=datetime.utcnow(),
        )
        
        self.db.add(plan)
        await self.db.commit()
        await self.db.refresh(plan)
        
        return plan

    async def _get_relevant_scenarios(self, dimensions: list[str]) -> list[Scenario]:
        """获取与目标维度相关的场景"""
        # 收集相关标签
        tags = []
        for dim in dimensions:
            if dim in self.DIMENSION_SCENARIO_MAP:
                tags.extend(self.DIMENSION_SCENARIO_MAP[dim])
        
        if not tags:
            # 没有特定标签，获取所有入门场景
            result = await self.db.execute(
                select(Scenario)
                .where(Scenario.status == "published")
                .where(Scenario.difficulty <= 2)  # 入门级难度
                .limit(10)
            )
            return list(result.scalars().all())
        
        # 获取已发布的场景
        result = await self.db.execute(
            select(Scenario)
            .where(Scenario.status == "published")
            .limit(20)
        )
        scenarios = list(result.scalars().all())
        
        # 按名称或描述匹配度排序
        def score_scenario(s: Scenario) -> int:
            score = 0
            for tag in tags:
                if s.name and tag in s.name:
                    score += 2
                if s.description and tag in s.description:
                    score += 1
            return score
        
        scenarios.sort(key=score_scenario, reverse=True)
        return scenarios[:10]

    async def _generate_daily_tasks(
        self,
        duration_days: int,
        target_dimensions: list[str],
        daily_time_min: int,
        experience_level: str,
        scenarios: list[Scenario],
    ) -> list[dict[str, Any]]:
        """生成每日任务列表"""
        daily_tasks = []
        scenario_idx = 0
        
        for day in range(1, duration_days + 1):
            day_data = {"day": day, "tasks": []}
            
            # 根据每日时间预算分配任务
            remaining_time = daily_time_min
            
            # 1. 学习任务（约1/3时间）
            learn_time = min(15, remaining_time // 3)
            if learn_time >= 5:
                dim = target_dimensions[(day - 1) % len(target_dimensions)]
                learn_templates = self.LEARN_TASK_TEMPLATES.get(dim, [
                    {"title": "销售技巧学习", "description": "提升销售能力的基础知识"}
                ])
                template = learn_templates[(day - 1) % len(learn_templates)]
                
                day_data["tasks"].append({
                    "id": f"day{day}_learn",
                    "type": "learn",
                    "title": template["title"],
                    "description": template["description"],
                    "duration_min": learn_time,
                    "content_type": "article",
                    "content_id": None,
                    "status": "pending",
                })
                remaining_time -= learn_time
            
            # 2. 练习任务（约1/2时间）
            if scenarios and remaining_time >= 10:
                practice_time = min(20, remaining_time // 2)
                scenario = scenarios[scenario_idx % len(scenarios)]
                scenario_idx += 1
                
                # 根据经验等级调整难度描述
                difficulty_text = {
                    "beginner": "入门级练习",
                    "intermediate": "进阶练习",
                    "advanced": "高级挑战",
                }.get(experience_level, "标准练习")
                
                day_data["tasks"].append({
                    "id": f"day{day}_practice",
                    "type": "practice",
                    "title": f"场景对练: {scenario.name}",
                    "description": f"{difficulty_text} - {scenario.description[:50]}..." if scenario.description else difficulty_text,
                    "duration_min": practice_time,
                    "content_type": "scenario",
                    "content_id": scenario.id,
                    "status": "pending",
                })
                remaining_time -= practice_time
            
            # 3. 复盘任务（剩余时间，至少5分钟）
            if remaining_time >= 5:
                review_template = self.REVIEW_TASK_TEMPLATES[(day - 1) % len(self.REVIEW_TASK_TEMPLATES)]
                day_data["tasks"].append({
                    "id": f"day{day}_review",
                    "type": "review",
                    "title": review_template["title"],
                    "description": review_template["description"],
                    "duration_min": remaining_time,
                    "content_type": None,
                    "content_id": None,
                    "status": "pending",
                })
            
            daily_tasks.append(day_data)
        
        return daily_tasks

    def _generate_plan_name(self, dimensions: list[str], days: int) -> str:
        """生成计划名称"""
        dim_names = {
            "objection_handling": "异议处理",
            "closing": "成交技巧",
            "rapport_building": "关系建立",
            "need_discovery": "需求挖掘",
            "product_presentation": "产品展示",
            "confidence": "自信表达",
            "empathy": "共情能力",
            "logic": "逻辑表达",
        }
        
        if len(dimensions) == 1:
            focus = dim_names.get(dimensions[0], "综合能力")
        elif len(dimensions) == 2:
            focus = " + ".join(dim_names.get(d, d) for d in dimensions[:2])
        else:
            focus = "全面提升"
        
        return f"{days}天{focus}训练计划"

    async def get_plan(self, plan_id: str, user_id: str) -> TrainingPlan | None:
        """获取训练计划详情"""
        result = await self.db.execute(
            select(TrainingPlan)
            .where(TrainingPlan.id == plan_id)
            .where(TrainingPlan.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_active_plan(self, user_id: str) -> TrainingPlan | None:
        """获取用户当前激活的计划"""
        result = await self.db.execute(
            select(TrainingPlan)
            .where(TrainingPlan.user_id == user_id)
            .where(TrainingPlan.status == "active")
            .order_by(TrainingPlan.started_at.desc())
        )
        return result.scalar_one_or_none()

    async def list_plans(
        self,
        user_id: str,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[TrainingPlan], int]:
        """获取用户的训练计划列表"""
        # 计数
        count_result = await self.db.execute(
            select(func.count(TrainingPlan.id))
            .where(TrainingPlan.user_id == user_id)
        )
        total = count_result.scalar() or 0
        
        # 列表
        result = await self.db.execute(
            select(TrainingPlan)
            .where(TrainingPlan.user_id == user_id)
            .order_by(TrainingPlan.created_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
        plans = list(result.scalars().all())
        
        return plans, total

    async def complete_task(
        self,
        plan_id: str,
        task_id: str,
        user_id: str,
        result_score: float | None = None,
        result_data: dict | None = None,
    ) -> dict:
        """完成任务"""
        plan = await self.get_plan(plan_id, user_id)
        if not plan:
            raise ValueError("训练计划不存在")
        
        if plan.status != "active":
            raise ValueError("计划已暂停或完成")
        
        # 检查任务是否存在
        task_found = False
        for day_data in plan.daily_tasks:
            for task in day_data.get("tasks", []):
                if task.get("id") == task_id:
                    task["status"] = "completed"
                    if result_score is not None:
                        task["result_score"] = result_score
                    task_found = True
                    break
            if task_found:
                break
        
        if not task_found:
            raise ValueError("任务不存在")
        
        # 更新已完成任务列表
        if task_id not in plan.completed_tasks:
            plan.completed_tasks = plan.completed_tasks + [task_id]
        
        # 计算进度
        total_tasks = sum(len(d.get("tasks", [])) for d in plan.daily_tasks)
        completed_count = len(plan.completed_tasks)
        progress = completed_count / total_tasks if total_tasks > 0 else 0
        
        # 检查当天任务是否完成，自动推进
        current_day = plan.current_day
        current_day_tasks = next(
            (d for d in plan.daily_tasks if d.get("day") == current_day),
            None
        )
        if current_day_tasks:
            all_completed = all(
                t.get("status") == "completed" or t.get("status") == "skipped"
                for t in current_day_tasks.get("tasks", [])
            )
            if all_completed and current_day < plan.duration_days:
                plan.current_day = current_day + 1
        
        # 检查计划是否完成
        if progress >= 1.0:
            plan.status = "completed"
            plan.completed_at = datetime.utcnow()
        
        await self.db.commit()
        await self.db.refresh(plan)
        
        return {
            "task_id": task_id,
            "status": "completed",
            "completed_at": datetime.utcnow(),
            "plan_progress": progress,
        }

    async def update_plan(
        self,
        plan_id: str,
        user_id: str,
        name: str | None = None,
        status: str | None = None,
    ) -> TrainingPlan | None:
        """更新训练计划"""
        plan = await self.get_plan(plan_id, user_id)
        if not plan:
            return None
        
        if name:
            plan.name = name
        if status:
            plan.status = status
            if status == "completed":
                plan.completed_at = datetime.utcnow()
        
        await self.db.commit()
        await self.db.refresh(plan)
        return plan

    def calculate_progress(self, plan: TrainingPlan) -> float:
        """计算计划进度"""
        total_tasks = sum(len(d.get("tasks", [])) for d in plan.daily_tasks)
        if total_tasks == 0:
            return 0
        return len(plan.completed_tasks) / total_tasks

    async def get_today_tasks(self, user_id: str) -> dict | None:
        """获取用户今日任务"""
        plan = await self.get_active_plan(user_id)
        if not plan:
            return None
        
        current_day = plan.current_day
        day_data = next(
            (d for d in plan.daily_tasks if d.get("day") == current_day),
            None
        )
        
        if not day_data:
            return None
        
        # 计算今日进度
        tasks = day_data.get("tasks", [])
        completed = sum(1 for t in tasks if t.get("status") == "completed")
        
        return {
            "plan_id": plan.id,
            "plan_name": plan.name,
            "day": current_day,
            "total_days": plan.duration_days,
            "tasks": tasks,
            "completed_count": completed,
            "total_count": len(tasks),
        }
