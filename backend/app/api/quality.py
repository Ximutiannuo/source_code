"""Quality management API routes."""

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_active_user
from app.services.quality_service import QualityService

router = APIRouter()


class QualityDashboardRead(BaseModel):
    period_days: int
    total_checks: int
    pass_count: int
    fail_count: int
    rework_count: int
    hold_count: int
    checked_qty_total: float
    defect_qty_total: float
    rework_qty_total: float
    first_pass_rate: float
    defect_rate: float


class DefectParetoItem(BaseModel):
    step_code: str
    defect_qty: float
    rework_qty: float
    check_count: int
    cumulative_pct: float


class QualityTrendItem(BaseModel):
    date: str
    total_checks: int
    pass_count: int
    fail_count: int
    rework_count: int
    hold_count: int
    checked_qty: float
    defect_qty: float
    first_pass_rate: float


class QualityCheckListItem(BaseModel):
    id: int
    step_id: int
    step_code: Optional[str] = None
    step_name: Optional[str] = None
    order_id: Optional[int] = None
    order_number: Optional[str] = None
    inspector_id: Optional[int] = None
    inspector_name: Optional[str] = None
    check_type: str
    result: str
    checked_qty: float
    defect_qty: float
    rework_qty: float
    remarks: Optional[str] = None
    checked_at: Optional[str] = None


@router.get("/dashboard", response_model=QualityDashboardRead)
async def get_quality_dashboard(
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    return QualityService.get_quality_dashboard(db, days=days)


@router.get("/defect-pareto", response_model=List[DefectParetoItem])
async def get_defect_pareto(
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    return QualityService.get_defect_pareto(db, days=days)


@router.get("/trend", response_model=List[QualityTrendItem])
async def get_quality_trend(
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    return QualityService.get_quality_trend(db, days=days)


@router.get("/checks", response_model=List[QualityCheckListItem])
async def list_quality_checks(
    result: Optional[str] = None,
    step_code: Optional[str] = None,
    days: int = Query(default=90, ge=1, le=365),
    limit: int = Query(default=200, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    return QualityService.list_quality_checks(
        db, result_filter=result, step_code=step_code, days=days, limit=limit,
    )
