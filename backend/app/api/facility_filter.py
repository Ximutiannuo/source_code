from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any
from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.facility import Facility

router = APIRouter()

@router.get("/")
async def get_facility_filters(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """
    提供 Facility 清单的筛选维度数据（层次化：Block -> Project -> Sub-project -> Unit）
    """
    results = db.query(
        Facility.block, 
        Facility.project, 
        Facility.subproject, 
        Facility.unit
    ).filter(Facility.is_active == True).distinct().all()
    
    # 构建树形或列表结构的筛选数据
    blocks = sorted(list(set(r.block for r in results if r.block)))
    projects = sorted(list(set(r.project for r in results if r.project)))
    subprojects = sorted(list(set(r.subproject for r in results if r.subproject)))
    units = sorted(list(set(r.unit for r in results if r.unit)))
    
    return {
        "blocks": blocks,
        "projects": projects,
        "subprojects": subprojects,
        "units": units
    }
