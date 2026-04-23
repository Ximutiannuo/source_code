from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.facility_type import FacilityType

router = APIRouter()


class FacilityTypeRead(BaseModel):
    id: int
    name: str
    sort_order: int

    class Config:
        from_attributes = True


class FacilityTypeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    sort_order: Optional[int] = 0


@router.get("/", response_model=List[FacilityTypeRead])
async def get_facility_types(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    return db.query(FacilityType).order_by(FacilityType.sort_order.asc(), FacilityType.id.asc()).all()


@router.post("/", response_model=FacilityTypeRead)
async def create_facility_type(
    payload: FacilityTypeCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    exists = db.query(FacilityType).filter(FacilityType.name == payload.name).first()
    if exists:
        raise HTTPException(status_code=400, detail="Facility type already exists")

    facility_type = FacilityType(name=payload.name, sort_order=payload.sort_order or 0)
    db.add(facility_type)
    db.commit()
    db.refresh(facility_type)
    return facility_type


@router.get("/{facility_type_id}", response_model=FacilityTypeRead)
async def get_facility_type(
    facility_type_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    facility_type = db.query(FacilityType).filter(FacilityType.id == facility_type_id).first()
    if not facility_type:
        raise HTTPException(status_code=404, detail="Facility type not found")
    return facility_type


@router.put("/{facility_type_id}", response_model=FacilityTypeRead)
async def update_facility_type(
    facility_type_id: int,
    payload: FacilityTypeCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    facility_type = db.query(FacilityType).filter(FacilityType.id == facility_type_id).first()
    if not facility_type:
        raise HTTPException(status_code=404, detail="Facility type not found")

    duplicated = (
        db.query(FacilityType)
        .filter(FacilityType.name == payload.name, FacilityType.id != facility_type_id)
        .first()
    )
    if duplicated:
        raise HTTPException(status_code=400, detail="Facility type already exists")

    facility_type.name = payload.name
    facility_type.sort_order = payload.sort_order or 0
    db.commit()
    db.refresh(facility_type)
    return facility_type


@router.delete("/{facility_type_id}")
async def delete_facility_type(
    facility_type_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    facility_type = db.query(FacilityType).filter(FacilityType.id == facility_type_id).first()
    if not facility_type:
        raise HTTPException(status_code=404, detail="Facility type not found")
    db.delete(facility_type)
    db.commit()
    return {"success": True}
