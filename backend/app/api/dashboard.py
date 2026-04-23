from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from app.database import get_db
from app.dependencies import get_current_active_user
from app.services.dashboard_service import DashboardService
from pydantic import BaseModel

router = APIRouter()

@router.get("/summary")
async def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    service = DashboardService(db)
    return service.get_progress_summary()

@router.get("/s-curve")
async def get_s_curve(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user),
    subproject: Optional[str] = None,
    implement_phase: Optional[str] = None
):
    service = DashboardService(db)
    filters = {}
    if subproject: filters["subproject"] = subproject
    if implement_phase: filters["implement_phase"] = implement_phase
    return service.get_s_curve_data(filters)

@router.get("/home-stats")
async def get_home_stats(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    service = DashboardService(db)
    return service.get_home_stats()

@router.get("/overall-status")
async def get_overall_status(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    service = DashboardService(db)
    return service.get_s_curve_summary()

@router.get("/gcc-status")
async def get_gcc_status(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    service = DashboardService(db)
    return service.get_s_curve_phases_summary()
