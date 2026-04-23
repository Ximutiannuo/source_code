from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_active_user, require_permission
from app.models.equipment import Equipment
from app.models.facility import Facility

router = APIRouter()


class FacilityRead(BaseModel):
    id: int
    block: Optional[str] = None
    project: Optional[str] = None
    subproject: Optional[str] = None
    train: Optional[str] = None
    unit: Optional[str] = None
    main_block: Optional[str] = None
    descriptions: Optional[str] = None
    simple_block: Optional[str] = None
    quarter: Optional[str] = None
    start_up_sequence: Optional[str] = None
    title_type: Optional[str] = None
    facility_type_id: Optional[int] = None
    is_active: bool

    class Config:
        from_attributes = True


class FacilityWrite(BaseModel):
    block: Optional[str] = None
    project: Optional[str] = None
    subproject: Optional[str] = None
    train: Optional[str] = None
    unit: Optional[str] = None
    main_block: Optional[str] = None
    descriptions: Optional[str] = None
    simple_block: Optional[str] = None
    quarter: Optional[str] = None
    start_up_sequence: Optional[str] = None
    title_type: Optional[str] = None
    facility_type_id: Optional[int] = None
    is_active: Optional[bool] = True


class EquipmentRead(BaseModel):
    id: int
    code: str
    name: str
    model_number: Optional[str] = None
    workstation: Optional[str] = None
    status: str

    class Config:
        from_attributes = True


@router.get("/", response_model=List[FacilityRead])
async def get_facilities(
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("facility:read")),
):
    return db.query(Facility).filter(Facility.is_active == True).order_by(Facility.id.asc()).all()


@router.post("/", response_model=FacilityRead)
async def create_facility(
    payload: FacilityWrite,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    facility = Facility(**payload.dict())
    db.add(facility)
    db.commit()
    db.refresh(facility)
    return facility


@router.get("/equipment", response_model=List[EquipmentRead])
async def get_equipment(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    return db.query(Equipment).order_by(Equipment.code.asc(), Equipment.id.asc()).all()


@router.get("/{facility_id}", response_model=FacilityRead)
async def get_facility(
    facility_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("facility:read")),
):
    facility = db.query(Facility).filter(Facility.id == facility_id).first()
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")
    return facility


@router.put("/{facility_id}", response_model=FacilityRead)
async def update_facility(
    facility_id: int,
    payload: FacilityWrite,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    facility = db.query(Facility).filter(Facility.id == facility_id).first()
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")

    for key, value in payload.dict(exclude_unset=True).items():
        setattr(facility, key, value)

    db.commit()
    db.refresh(facility)
    return facility


@router.delete("/{facility_id}")
async def delete_facility(
    facility_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    facility = db.query(Facility).filter(Facility.id == facility_id).first()
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")
    db.delete(facility)
    db.commit()
    return {"success": True}
