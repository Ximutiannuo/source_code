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

class UserBase(BaseModel):
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    department: Optional[DeptRead] = None
    responsible_for: Optional[str] = None

class UserRead(UserBase):
    id: int
    is_active: bool
    roles: List[RoleRead] = []

    class Config:
        from_attributes = True

class UserListResponse(BaseModel):
    items: List[UserRead]
    total: int
    active_count: int
    inactive_count: int

class UserCreate(BaseModel):
    username: str
    password: Optional[str] = None
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    department_id: Optional[int] = None
    role_ids: List[int] = []

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    department_id: Optional[int] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
    role_ids: Optional[List[int]] = None
    responsible_for: Optional[str] = None

@router.get("/", response_model=UserListResponse)
async def get_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    department_id: Optional[int] = None
):
    query = db.query(User)
    if search:
        query = query.filter(User.username.like(f"%{search}%") | User.full_name.like(f"%{search}%"))
    if department_id:
        query = query.filter(User.department_id == department_id)
        
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    
    active_count = db.query(User).filter(User.is_active == True).count()
    inactive_count = db.query(User).filter(User.is_active == False).count()
    
    return {
        "items": items,
        "total": total,
        "active_count": active_count,
        "inactive_count": inactive_count
    }

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
    password = user_in.password or "Ww@1932635539"
    new_user.set_password(password)
    
    if user_in.role_ids:
        roles = db.query(Role).filter(Role.id.in_(user_in.role_ids)).all()
        new_user.roles = roles
        
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.put("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_system_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户未找到")
    
    if user_in.email is not None:
        user.email = user_in.email
    if user_in.full_name is not None:
        user.full_name = user_in.full_name
    if user_in.department_id is not None:
        user.department_id = user_in.department_id
    if user_in.is_active is not None:
        user.is_active = user_in.is_active
    if user_in.responsible_for is not None:
        user.responsible_for = user_in.responsible_for
    if user_in.password:
        user.set_password(user_in.password)
        
    if user_in.role_ids is not None:
        roles = db.query(Role).filter(Role.id.in_(user_in.role_ids)).all()
        user.roles = roles
        
    db.commit()
    db.refresh(user)
    return user

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
