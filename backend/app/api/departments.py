from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.dependencies import get_current_active_user, get_current_system_admin
from app.models.department import Department
from app.models.user import User
from pydantic import BaseModel

router = APIRouter()

class DepartmentRead(BaseModel):
    id: int
    code: str
    name: str
    is_active: bool
    sort_order: int

    class Config:
        from_attributes = True

@router.get("/", response_model=List[DepartmentRead])
async def get_departments(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    return db.query(Department).filter(Department.is_active == True).order_by(Department.sort_order).all()

@router.get("/admin/", response_model=List[DepartmentRead])
async def get_departments_admin(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    return db.query(Department).order_by(Department.sort_order).all()

class DepartmentCreate(BaseModel):
    name: str
    code: str
    is_active: bool = True
    sort_order: int = 0

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None

@router.post("/", response_model=DepartmentRead)
async def create_department(
    dept_in: DepartmentCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_system_admin)
):
    dept = Department(
        name=dept_in.name,
        code=dept_in.code,
        is_active=dept_in.is_active,
        sort_order=dept_in.sort_order
    )
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept

@router.put("/{dept_id}", response_model=DepartmentRead)
async def update_department(
    dept_id: int,
    dept_in: DepartmentUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_system_admin)
):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="部门未找到")
    
    if dept_in.name is not None:
        dept.name = dept_in.name
    if dept_in.code is not None:
        dept.code = dept_in.code
    if dept_in.is_active is not None:
        dept.is_active = dept_in.is_active
    if dept_in.sort_order is not None:
        dept.sort_order = dept_in.sort_order
        
    db.commit()
    db.refresh(dept)
    return dept

@router.delete("/{dept_id}")
async def delete_department(
    dept_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_system_admin)
):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="部门未找到")
    
    db.delete(dept)
    db.commit()
    return {"message": "Department deleted successfully"}
