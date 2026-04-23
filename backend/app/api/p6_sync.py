from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from app.database import get_db
from app.dependencies import get_current_active_user, require_permission
from app.services.p6_sync_service import P6SyncService
from pydantic import BaseModel

router = APIRouter()

@router.get("/eps-tree")
async def get_p6_eps_tree(
    current_user = Depends(require_permission("p6_database:read"))
):
    service = P6SyncService()
    return service.get_eps_tree()

@router.get("/projects")
async def get_p6_projects(
    eps_object_id: Optional[int] = None,
    current_user = Depends(require_permission("p6_database:read"))
):
    service = P6SyncService()
    return service.get_projects(eps_object_id=eps_object_id)

@router.post("/sync/{project_id}")
async def sync_p6_project(
    project_id: str,
    background_tasks: BackgroundTasks,
    current_user = Depends(require_permission("p6_database:update"))
):
    service = P6SyncService()
    # P6SyncService.sync_activities 比较耗时，这里可以直接阻塞也可以放后台
    # 按照之前的习惯，是直接返回结果
    result = service.sync_activities(project_id)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error"))
    return result
