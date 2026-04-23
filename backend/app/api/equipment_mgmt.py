"""Equipment management API routes."""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.equipment import Equipment
from app.models.equipment_maintenance import EquipmentMaintenance
from app.utils.timezone import now as system_now

router = APIRouter()


class EquipmentCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=200)
    model_number: Optional[str] = None
    workstation: Optional[str] = None
    status: str = "ACTIVE"
    department: Optional[str] = None
    location: Optional[str] = None
    purchase_date: Optional[datetime] = None
    maintenance_cycle_days: int = 0
    description: Optional[str] = None


class EquipmentUpdate(BaseModel):
    name: Optional[str] = None
    model_number: Optional[str] = None
    workstation: Optional[str] = None
    status: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    purchase_date: Optional[datetime] = None
    maintenance_cycle_days: Optional[int] = None
    description: Optional[str] = None


class EquipmentRead(BaseModel):
    id: int
    code: str
    name: str
    model_number: Optional[str] = None
    workstation: Optional[str] = None
    status: str
    department: Optional[str] = None
    location: Optional[str] = None
    purchase_date: Optional[datetime] = None
    last_maintenance_date: Optional[datetime] = None
    next_maintenance_date: Optional[datetime] = None
    maintenance_cycle_days: int = 0
    description: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MaintenanceCreate(BaseModel):
    equipment_id: int
    maintenance_type: str = "PLANNED"
    description: Optional[str] = None
    operator_name: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    downtime_minutes: int = 0
    cost: int = 0
    status: str = "COMPLETED"
    remarks: Optional[str] = None


class MaintenanceRead(BaseModel):
    id: int
    equipment_id: int
    maintenance_type: str
    description: Optional[str] = None
    operator_name: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    downtime_minutes: int
    cost: int
    status: str
    remarks: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EquipmentDashboardRead(BaseModel):
    total: int
    active: int
    maintenance: int
    offline: int
    overdue_maintenance: int
    upcoming_maintenance_7d: int
    total_maintenance_records: int
    total_downtime_minutes: int


# ── Equipment CRUD ──────────────────────────────────────────────

@router.get("", response_model=List[EquipmentRead])
async def list_equipment(
    status: Optional[str] = None,
    keyword: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    query = db.query(Equipment)
    if status:
        query = query.filter(Equipment.status == status.upper())
    if keyword:
        kw = f"%{keyword}%"
        query = query.filter(
            (Equipment.code.ilike(kw)) |
            (Equipment.name.ilike(kw)) |
            (Equipment.workstation.ilike(kw))
        )
    return query.order_by(Equipment.code).all()


@router.get("/dashboard", response_model=EquipmentDashboardRead)
async def get_equipment_dashboard(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    from datetime import timedelta
    equipments = db.query(Equipment).all()
    now = system_now()
    seven_days_later = now + timedelta(days=7)

    total = len(equipments)
    active = sum(1 for e in equipments if e.status == "ACTIVE")
    maintenance = sum(1 for e in equipments if e.status == "MAINTENANCE")
    offline = sum(1 for e in equipments if e.status == "OFFLINE")

    overdue = 0
    upcoming = 0
    for e in equipments:
        if e.next_maintenance_date:
            if e.next_maintenance_date < now:
                overdue += 1
            elif e.next_maintenance_date <= seven_days_later:
                upcoming += 1

    maint_records = db.query(EquipmentMaintenance).all()
    total_downtime = sum(m.downtime_minutes or 0 for m in maint_records)

    return {
        "total": total,
        "active": active,
        "maintenance": maintenance,
        "offline": offline,
        "overdue_maintenance": overdue,
        "upcoming_maintenance_7d": upcoming,
        "total_maintenance_records": len(maint_records),
        "total_downtime_minutes": total_downtime,
    }


@router.post("", response_model=EquipmentRead)
async def create_equipment(
    eq_in: EquipmentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    existing = db.query(Equipment).filter(Equipment.code == eq_in.code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"设备编码 {eq_in.code} 已存在")

    eq = Equipment(**eq_in.dict())
    db.add(eq)
    db.commit()
    db.refresh(eq)
    return eq


@router.get("/{equipment_id}", response_model=EquipmentRead)
async def get_equipment(
    equipment_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    eq = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not eq:
        raise HTTPException(status_code=404, detail="设备不存在")
    return eq


@router.patch("/{equipment_id}", response_model=EquipmentRead)
async def update_equipment(
    equipment_id: int,
    eq_in: EquipmentUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    eq = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not eq:
        raise HTTPException(status_code=404, detail="设备不存在")

    update_data = eq_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(eq, field, value)

    db.commit()
    db.refresh(eq)
    return eq


@router.delete("/{equipment_id}")
async def delete_equipment(
    equipment_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    eq = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not eq:
        raise HTTPException(status_code=404, detail="设备不存在")
    db.delete(eq)
    db.commit()
    return {"detail": "已删除"}


# ── Maintenance Records ────────────────────────────────────────

@router.get("/{equipment_id}/maintenances", response_model=List[MaintenanceRead])
async def list_equipment_maintenances(
    equipment_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    return (
        db.query(EquipmentMaintenance)
        .filter(EquipmentMaintenance.equipment_id == equipment_id)
        .order_by(EquipmentMaintenance.created_at.desc())
        .all()
    )


@router.get("/maintenances/all", response_model=List[MaintenanceRead])
async def list_all_maintenances(
    maintenance_type: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    query = db.query(EquipmentMaintenance)
    if maintenance_type:
        query = query.filter(EquipmentMaintenance.maintenance_type == maintenance_type.upper())
    return query.order_by(EquipmentMaintenance.created_at.desc()).limit(limit).all()


@router.post("/maintenances", response_model=MaintenanceRead)
async def create_maintenance(
    m_in: MaintenanceCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    eq = db.query(Equipment).filter(Equipment.id == m_in.equipment_id).first()
    if not eq:
        raise HTTPException(status_code=404, detail="设备不存在")

    record = EquipmentMaintenance(**m_in.dict())
    db.add(record)

    # Update last_maintenance_date on equipment
    if m_in.status == "COMPLETED":
        eq.last_maintenance_date = m_in.end_time or system_now()
        if eq.maintenance_cycle_days and eq.maintenance_cycle_days > 0:
            from datetime import timedelta
            eq.next_maintenance_date = eq.last_maintenance_date + timedelta(days=eq.maintenance_cycle_days)

    db.commit()
    db.refresh(record)
    return record
