"""报告路由"""

from uuid import UUID

from fastapi import APIRouter, Query

from app.api.deps import CurrentUserId, DatabaseSession
from app.schemas.report import (
    ReportListResponse,
    ReportResponse,
)
from app.services.report_service import ReportService

router = APIRouter()


@router.get("", response_model=ReportListResponse)
async def list_reports(
    user_id: CurrentUserId,
    db: DatabaseSession,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
):
    """获取报告列表"""
    service = ReportService(db)
    return await service.list_reports(user_id, page=page, size=size)


@router.get("/compare")
async def compare_reports(
    user_id: CurrentUserId,
    db: DatabaseSession,
    before_id: UUID = Query(..., description="之前的报告ID"),
    after_id: UUID = Query(..., description="之后的报告ID"),
):
    """
    对比两份报告

    用于Before/After对比，展示进步
    """
    service = ReportService(db)
    return await service.compare_reports(
        user_id=user_id,
        report_a_id=str(before_id),
        report_b_id=str(after_id),
    )


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(
    user_id: CurrentUserId,
    db: DatabaseSession,
    report_id: UUID,
):
    """获取报告详情"""
    service = ReportService(db)
    return await service.get_report(report_id, user_id)
