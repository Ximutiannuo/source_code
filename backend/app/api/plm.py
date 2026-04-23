from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_active_user
from app.services.plm_service import PLMService

router = APIRouter()


class MaterialRead(BaseModel):
    id: int
    code: str
    name: str
    specification: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    material_type: Optional[str] = None
    drawing_no: Optional[str] = None
    revision: Optional[str] = None
    safety_stock: Optional[float] = None
    current_stock: Optional[float] = None
    reserved_stock: Optional[float] = None
    incoming_stock: Optional[float] = None
    lead_time_days: Optional[int] = None
    description: Optional[str] = None

    class Config:
        from_attributes = True


class MaterialCreate(BaseModel):
    code: str
    name: str
    specification: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = "PCS"
    material_type: Optional[str] = "PART"
    drawing_no: Optional[str] = None
    revision: Optional[str] = "A"
    safety_stock: Optional[float] = 0
    current_stock: Optional[float] = 0
    reserved_stock: Optional[float] = 0
    incoming_stock: Optional[float] = 0
    lead_time_days: Optional[int] = 0
    description: Optional[str] = None


class MaterialUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    specification: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    material_type: Optional[str] = None
    drawing_no: Optional[str] = None
    revision: Optional[str] = None
    safety_stock: Optional[float] = None
    current_stock: Optional[float] = None
    reserved_stock: Optional[float] = None
    incoming_stock: Optional[float] = None
    lead_time_days: Optional[int] = None
    description: Optional[str] = None


class BOMHeaderRead(BaseModel):
    id: int
    product_code: str
    version: str
    bom_type: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None
    is_active: bool
    material: Optional[MaterialRead] = None


class BOMNodeRead(BaseModel):
    id: int
    material_code: str
    material_name: str
    quantity: float
    unit: str
    level: int
    children: List["BOMNodeRead"] = Field(default_factory=list)


class ECNCreate(BaseModel):
    ecn_no: str
    title: Optional[str] = None
    description: Optional[str] = None
    change_type: str
    reason: Optional[str] = None
    impacts: List[Dict[str, Any]] = Field(default_factory=list)


@router.get("/materials", response_model=List[MaterialRead])
async def list_materials(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    return PLMService.get_materials(db, skip, limit, search)


@router.post("/materials", response_model=MaterialRead)
async def create_material(
    material_in: MaterialCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    return PLMService.create_material(db, material_in.dict())


@router.patch("/materials/{material_id}", response_model=MaterialRead)
async def update_material(
    material_id: int,
    material_in: MaterialUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = PLMService.update_material(db, material_id, material_in.dict(exclude_unset=True))
    if not result:
        raise HTTPException(status_code=404, detail="Material not found")
    return result


@router.get("/boms", response_model=List[BOMHeaderRead])
async def list_boms(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    return PLMService.get_boms(db, skip, limit)


@router.get("/boms/{bom_id}/expand", response_model=BOMNodeRead)
async def get_bom_structure(
    bom_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = PLMService.expand_bom(db, bom_id)
    if not result:
        raise HTTPException(status_code=404, detail="BOM not found")
    return result


@router.post("/ecns")
async def create_ecn(
    ecn_in: ECNCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    data = ecn_in.dict()
    data["creator_id"] = current_user.id
    impacts = data.pop("impacts")
    return PLMService.create_ecn(db, data, impacts)


@router.post("/ecns/{ecn_id}/approve")
async def approve_ecn(
    ecn_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = PLMService.approve_ecn(db, ecn_id, current_user.id)
    if not result:
        raise HTTPException(status_code=404, detail="ECN not found")
    return result


try:
    BOMNodeRead.model_rebuild()
except AttributeError:
    BOMNodeRead.update_forward_refs()
