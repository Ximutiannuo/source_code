from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from app.database import get_db
from app.dependencies import get_current_active_user, get_current_system_admin
from app.models.user import User, Permission, Role
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

# Role Management
class RoleRead(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True

class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: bool = True

class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

@router.get("/roles", response_model=List[RoleRead])
async def get_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    return db.query(Role).all()

@router.post("/roles", response_model=RoleRead)
async def create_role(
    role_in: RoleCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_system_admin)
):
    role = Role(
        name=role_in.name,
        description=role_in.description,
        is_active=role_in.is_active
    )
    db.add(role)
    db.commit()
    db.refresh(role)
    return role

@router.put("/roles/{role_id}", response_model=RoleRead)
async def update_role(
    role_id: int,
    role_in: RoleUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_system_admin)
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="角色未找到")
    
    if role_in.name is not None:
        role.name = role_in.name
    if role_in.description is not None:
        role.description = role_in.description
    if role_in.is_active is not None:
        role.is_active = role_in.is_active
    
    db.commit()
    db.refresh(role)
    return role

@router.delete("/roles/{role_id}")
async def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_system_admin)
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="角色未找到")
    
    db.delete(role)
    db.commit()
    return {"message": "Role deleted successfully"}
