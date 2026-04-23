from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.department import Department
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

@router.get("/departments", response_model=List[DepartmentRead])
async def get_departments(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    return db.query(Department).filter(Department.is_active == True).order_by(Department.sort_order).all()
