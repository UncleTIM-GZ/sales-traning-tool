"""报告服务层"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import NotFoundException
from app.models.session import Session, SessionTurn
from app.models.report import Report
from app.models.user import User, Profile
from app.models.scenario import Scenario


class ReportService:
    """报告服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_reports(
        self,
        user_id: str,
        page: int = 1,
        size: int = 20,
    ) -> dict:
        """获取用户报告列表"""
        query = (
            select(Report)
            .where(Report.user_id == user_id)
            .order_by(Report.created_at.desc())
        )

        # 计算总数
        count_query = select(func.count()).where(Report.user_id == user_id)
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        # 分页
        query = query.offset((page - 1) * size).limit(size)

        result = await self.db.execute(query)
        reports = result.scalars().all()

        items = []
        for r in reports:
            # 获取关联的会话和场景信息
            session = await self.db.execute(
                select(Session).where(Session.id == r.session_id)
            )
            session_obj = session.scalar_one_or_none()

            scenario_name = "未知场景"
            mode = "train"
            if session_obj:
                mode = session_obj.mode
                scenario = await self.db.execute(
                    select(Scenario).where(Scenario.id == session_obj.scenario_id)
                )
                scenario_obj = scenario.scalar_one_or_none()
                if scenario_obj:
                    scenario_name = scenario_obj.name

            items.append({
                "id": str(r.id),
                "session_id": str(r.session_id),
                "scenario_name": scenario_name,
                "total_score": r.total_score,
                "mode": mode,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            })

        return {
            "items": items,
            "total": total,
            "page": page,
            "size": size,
        }

    async def get_report(self, report_id: UUID, user_id: str) -> dict:
        """获取报告详情（完整版）"""
        result = await self.db.execute(
            select(Report).where(
                Report.id == report_id,
                Report.user_id == user_id,
            )
        )
        report = result.scalar_one_or_none()

        if not report:
            raise NotFoundException("报告不存在")

        # 获取关联的会话和场景信息
        session_result = await self.db.execute(
            select(Session).where(Session.id == report.session_id)
        )
        session = session_result.scalar_one_or_none()
        
        scenario_name = "未知场景"
        scenario_id = None
        mode = "train"
        if session:
            mode = session.mode
            scenario_id = session.scenario_id
            scenario_result = await self.db.execute(
                select(Scenario).where(Scenario.id == session.scenario_id)
            )
            scenario = scenario_result.scalar_one_or_none()
            if scenario:
                scenario_name = scenario.name

        return {
            "id": str(report.id),
            "session_id": str(report.session_id),
            "user_id": str(report.user_id),
            "scenario_id": scenario_id,
            "scenario_name": scenario_name,
            "mode": mode,
            "rubric_version": report.rubric_version,
            "total_score": report.total_score,
            # 基础评分
            "dimensions": report.dimensions,
            "highlights": report.highlights,
            "issues": report.issues,
            "replacements": report.replacements,
            # 商业化新增字段
            "evidence_sentences": getattr(report, 'evidence_sentences', []) or [],
            "rewrite_suggestions": getattr(report, 'rewrite_suggestions', []) or [],
            "training_prescription": getattr(report, 'training_prescription', None),
            "conversation_scores": getattr(report, 'conversation_scores', []) or [],
            "comparison_data": getattr(report, 'comparison_data', None),
            "next_actions": report.next_actions,
            "metadata": report.metadata_,
            "created_at": report.created_at.isoformat() if report.created_at else None,
        }

    async def compare_reports(
        self,
        user_id: str,
        report_a_id: str,
        report_b_id: str,
    ) -> dict:
        """对比两份报告"""
        # 获取两份报告
        result_a = await self.db.execute(
            select(Report).where(
                Report.id == report_a_id,
                Report.user_id == user_id,
            )
        )
        report_a = result_a.scalar_one_or_none()
        
        result_b = await self.db.execute(
            select(Report).where(
                Report.id == report_b_id,
                Report.user_id == user_id,
            )
        )
        report_b = result_b.scalar_one_or_none()
        
        if not report_a or not report_b:
            raise NotFoundException("报告不存在")
        
        # 计算分数变化
        score_change = report_b.total_score - report_a.total_score
        
        # 计算维度变化
        dimension_changes = {}
        dims_a = {d.get('name'): d.get('score', 0) for d in report_a.dimensions}
        dims_b = {d.get('name'): d.get('score', 0) for d in report_b.dimensions}
        
        for name in set(dims_a.keys()) | set(dims_b.keys()):
            before = dims_a.get(name, 0)
            after = dims_b.get(name, 0)
            dimension_changes[name] = {
                "before": before,
                "after": after,
                "change": after - before,
            }
        
        # 维度名称映射
        dimension_names = {
            "opening": "开场白",
            "discovery": "需求挖掘",
            "value_presentation": "价值呈现",
            "objection_handling": "异议处理",
            "closing": "促单成交",
            "communication": "沟通表达",
        }
        
        return {
            "report_a": {
                "id": str(report_a.id),
                "total_score": report_a.total_score,
                "created_at": report_a.created_at.isoformat() if report_a.created_at else None,
            },
            "report_b": {
                "id": str(report_b.id),
                "total_score": report_b.total_score,
                "created_at": report_b.created_at.isoformat() if report_b.created_at else None,
            },
            "score_change": score_change,
            "dimension_changes": dimension_changes,
            "dimension_names": dimension_names,
            "improved_dimensions": [
                name for name, data in dimension_changes.items() if data["change"] > 0
            ],
            "declined_dimensions": [
                name for name, data in dimension_changes.items() if data["change"] < 0
            ],
        }


class DashboardService:
    """仪表盘服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_user_stats(self, user_id: str) -> dict:
        """获取用户统计数据"""
        # 获取用户画像
        profile_result = await self.db.execute(
            select(Profile).where(Profile.user_id == user_id)
        )
        profile = profile_result.scalar_one_or_none()

        # 获取总训练场次
        session_count_result = await self.db.execute(
            select(func.count()).where(
                Session.user_id == user_id,
                Session.status == "completed",
            )
        )
        total_sessions = session_count_result.scalar() or 0

        # 计算本周训练时长（分钟）
        now = datetime.now(timezone.utc)
        week_start = now - timedelta(days=now.weekday())
        week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)

        # 获取本周完成的会话
        week_sessions_result = await self.db.execute(
            select(Session).where(
                Session.user_id == user_id,
                Session.status == "completed",
                Session.ended_at >= week_start,
            )
        )
        week_sessions = week_sessions_result.scalars().all()

        # 计算时长
        week_duration_minutes = 0
        for s in week_sessions:
            if s.started_at and s.ended_at:
                duration = (s.ended_at - s.started_at).total_seconds() / 60
                week_duration_minutes += duration

        # 计算连续训练天数
        streak_days = await self._calculate_streak(user_id)

        # 获取最近得分趋势（最近7天）
        recent_scores = await self._get_recent_scores(user_id, days=7)

        # 计算平均分和提升
        current_score = profile.baseline_score if profile and profile.baseline_score else 0
        if recent_scores:
            current_score = recent_scores[-1].get("score", current_score)

        # 能力维度（从最近的报告获取）
        ability_dimensions = await self._get_ability_dimensions(user_id)

        return {
            "user_id": user_id,
            "current_score": current_score,
            "total_sessions": total_sessions,
            "week_duration_hours": round(week_duration_minutes / 60, 1),
            "streak_days": streak_days,
            "score_trend": recent_scores,
            "ability_dimensions": ability_dimensions,
            "rank_percentile": await self._get_rank_percentile(user_id, current_score),
        }

    async def _calculate_streak(self, user_id: str) -> int:
        """计算连续训练天数"""
        now = datetime.now(timezone.utc).date()
        streak = 0
        current_date = now

        for _ in range(365):  # 最多查一年
            day_start = datetime.combine(current_date, datetime.min.time()).replace(tzinfo=timezone.utc)
            day_end = datetime.combine(current_date, datetime.max.time()).replace(tzinfo=timezone.utc)

            result = await self.db.execute(
                select(func.count()).where(
                    Session.user_id == user_id,
                    Session.status == "completed",
                    Session.ended_at >= day_start,
                    Session.ended_at <= day_end,
                )
            )
            count = result.scalar() or 0

            if count > 0:
                streak += 1
                current_date -= timedelta(days=1)
            else:
                break

        return streak

    async def _get_recent_scores(self, user_id: str, days: int = 7) -> list:
        """获取最近得分趋势"""
        now = datetime.now(timezone.utc)
        start_date = now - timedelta(days=days)

        result = await self.db.execute(
            select(Report)
            .where(
                Report.user_id == user_id,
                Report.created_at >= start_date,
            )
            .order_by(Report.created_at.asc())
        )
        reports = result.scalars().all()

        scores = []
        for r in reports:
            scores.append({
                "date": r.created_at.strftime("%m/%d") if r.created_at else "",
                "score": r.total_score,
            })

        return scores

    async def _get_ability_dimensions(self, user_id: str) -> list:
        """获取能力维度数据"""
        # 获取最近的报告
        result = await self.db.execute(
            select(Report)
            .where(Report.user_id == user_id)
            .order_by(Report.created_at.desc())
            .limit(1)
        )
        report = result.scalar_one_or_none()

        # 默认能力维度
        default_dimensions = [
            {"ability": "逻辑思维", "value": 50, "fullMark": 100},
            {"ability": "表达能力", "value": 50, "fullMark": 100},
            {"ability": "共情力", "value": 50, "fullMark": 100},
            {"ability": "反应速度", "value": 50, "fullMark": 100},
            {"ability": "抗压能力", "value": 50, "fullMark": 100},
            {"ability": "说服力", "value": 50, "fullMark": 100},
        ]

        if not report or not report.dimensions:
            return default_dimensions

        # 从报告维度映射到能力雷达图
        dimension_mapping = {
            "opening": "表达能力",
            "discovery": "逻辑思维",
            "value_presentation": "说服力",
            "objection_handling": "抗压能力",
            "closing": "反应速度",
            "communication": "共情力",
        }

        abilities = {}
        for dim in report.dimensions:
            name = dim.get("name", "")
            score = dim.get("score", 5)
            max_score = dim.get("max_score", 10)
            ability_name = dimension_mapping.get(name, name)
            abilities[ability_name] = int(score / max_score * 100)

        # 合并到默认维度
        for dim in default_dimensions:
            if dim["ability"] in abilities:
                dim["value"] = abilities[dim["ability"]]

        return default_dimensions

    async def _get_rank_percentile(self, user_id: str, score: float) -> int:
        """获取排名百分比"""
        # 获取所有用户的平均分
        result = await self.db.execute(
            select(Profile.baseline_score).where(Profile.baseline_score.isnot(None))
        )
        all_scores = [r for r in result.scalars().all() if r]

        if not all_scores:
            return 50

        # 计算排名百分比
        lower_count = sum(1 for s in all_scores if s < score)
        percentile = int(lower_count / len(all_scores) * 100)

        return percentile

    async def get_training_plan(self, user_id: str) -> list:
        """获取今日学习计划"""
        # TODO: 从训练计划表获取
        # 目前返回默认计划
        return [
            {"id": 1, "title": "早安语音热身", "time": "10min", "type": "发音校准", "status": "待开始"},
            {"id": 2, "title": "异议处理专项", "time": "30min", "type": "实战演练", "status": "待开始"},
            {"id": 3, "title": "每日复盘总结", "time": "15min", "type": "反思优化", "status": "待开始"},
        ]
