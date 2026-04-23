from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.user import User, Permission
from app.services.permission_service import PermissionService
from pydantic import BaseModel

router = APIRouter()

class PermissionRead(BaseModel):
    id: int
    code: str
    name: str
    description: Optional[str] = None
    resource_type: str
    action: str

    class Config:
        from_attributes = True

@router.get("/", response_model=List[PermissionRead])
async def get_all_permissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    return db.query(Permission).all()

@router.get("/my", response_model=List[Dict[str, Any]])
async def get_my_permissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取当前用户的所有权限（包括通过角色继承的）"""
    return PermissionService.get_user_permissions(db, current_user)
