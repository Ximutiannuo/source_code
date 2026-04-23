from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.dependencies import get_current_active_user, get_current_system_admin
from app.models.user import User, Role
from app.models.department import Department
from pydantic import BaseModel, EmailStr

router = APIRouter()

class RoleRead(BaseModel):
    id: int
    name: str
    description: Optional[str]

class DeptRead(BaseModel):
    id: int
    name: str
    code: Optional[str]

class UserRead(BaseModel):
    id: int
    username: str
    email: Optional[str]
    full_name: Optional[str]
    is_active: bool
    is_superuser: bool
    department: Optional[DeptRead]
    roles: List[RoleRead]
    responsible_for: Optional[str]

    class Config:
        from_attributes = True

class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    department_id: Optional[int] = None
    role_ids: List[int] = []

@router.get("/", response_model=List[UserRead])
async def get_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None
):
    query = db.query(User)
    if search:
        query = query.filter(User.username.like(f"%{search}%") | User.full_name.like(f"%{search}%"))
    return query.offset(skip).limit(limit).all()

@router.post("/", response_model=UserRead)
async def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_system_admin)
):
    db_user = db.query(User).filter(User.username == user_in.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="用户名已存在")
    
    new_user = User(
        username=user_in.username,
        email=user_in.email,
        full_name=user_in.full_name,
        department_id=user_in.department_id,
        is_active=True
    )
    new_user.set_password(user_in.password)
    
    if user_in.role_ids:
        roles = db.query(Role).filter(Role.id.in_(user_in.role_ids)).all()
        new_user.roles = roles
        
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_system_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户未找到")
    if user.username == "role_system_admin":
        raise HTTPException(status_code=400, detail="不能删除系统管理员系统账号")
    
    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}

@router.get("/roles", response_model=List[RoleRead])
async def get_roles(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    return db.query(Role).all()
