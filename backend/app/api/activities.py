from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from app.database import get_db
from app.dependencies import get_current_active_user, require_permission
from app.models.activity_summary import ActivitySummary
from app.services.permission_service import PermissionService
from pydantic import BaseModel

router = APIRouter()

class ActivityRead(BaseModel):
    id: int
    activity_id: str
    activity_name: Optional[str]
    status: Optional[str]
    planned_start_date: Optional[str]
    planned_finish_date: Optional[str]
    actual_start_date: Optional[str]
    actual_finish_date: Optional[str]
    progress: Optional[float]
    work_package: Optional[str]
    
    class Config:
        from_attributes = True

@router.get("/", response_model=List[ActivityRead])
async def get_activities(
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("activity:read")),
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    subproject: Optional[str] = None
):
    query = db.query(ActivitySummary)
    
    # 应用权限过滤
    query = PermissionService.filter_by_permission(
        db, current_user, query, "activity:read", 
        {"subproject": "subproject", "block": "block"}
    )
    
    if search:
        query = query.filter(ActivitySummary.activity_name.like(f"%{search}%") | ActivitySummary.activity_id.like(f"%{search}%"))
    if subproject:
        query = query.filter(ActivitySummary.subproject == subproject)
        
    return query.offset(skip).limit(limit).all()

@router.get("/{activity_id}", response_model=ActivityRead)
async def get_activity(
    activity_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("activity:read"))
):
    activity = db.query(ActivitySummary).filter(ActivitySummary.activity_id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    return activity
