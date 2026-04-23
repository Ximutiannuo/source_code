from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_active_user
from app.services.process_template_adapt_service import run_adaptation, write_back_planned_duration
from app.services.process_template_service import ProcessTemplateService

router = APIRouter()


class ProcessTemplateRead(BaseModel):
    id: int
    facility_type_id: Optional[int] = None
    facility_id: Optional[int] = None
    work_package: Optional[str] = None
    name: str
    applicable_qty_min: Optional[float] = None
    applicable_qty_max: Optional[float] = None
    min_required_workers: Optional[int] = None
    max_allowed_workers: Optional[int] = None
    suggested_min_days: Optional[int] = None
    suggested_max_days: Optional[int] = None

    class Config:
        from_attributes = True


class ProcessTemplateCreate(BaseModel):
    facility_type_id: Optional[int] = None
    facility_id: Optional[int] = None
    work_package: Optional[str] = None
    name: str
    applicable_qty_min: Optional[float] = None
    applicable_qty_max: Optional[float] = None
    min_required_workers: Optional[int] = None
    max_allowed_workers: Optional[int] = None
    suggested_min_days: Optional[int] = None
    suggested_max_days: Optional[int] = None


class TemplateActivityRead(BaseModel):
    id: int
    template_id: int
    activity_key: str
    label: Optional[str] = None
    planned_duration: Optional[float] = None
    standard_hours: Optional[float] = None
    setup_hours: Optional[float] = None
    sort_order: int

    class Config:
        from_attributes = True


class TemplateActivityLinkRead(BaseModel):
    id: int
    template_id: int
    predecessor_activity_id: str
    successor_activity_id: str
    link_type: str
    lag_days: float
    sort_order: int

    class Config:
        from_attributes = True


class TemplateActivityLinkCreate(BaseModel):
    predecessor_activity_id: str = Field(min_length=1)
    successor_activity_id: str = Field(min_length=1)
    link_type: str = "FS"
    lag_days: float = 0
    sort_order: int = 0


class TemplateActivityLinkBatchCreate(BaseModel):
    links: List[TemplateActivityLinkCreate] = Field(default_factory=list)


class ActivityByFacilityRead(BaseModel):
    activity_id: str
    title: Optional[str] = None
    work_package: Optional[str] = None
    block: Optional[str] = None
    unit: Optional[str] = None
    discipline: Optional[str] = None


class AdaptRequest(BaseModel):
    facility_id: int
    max_workers: Optional[int] = None
    work_package: Optional[str] = None
    work_package_estimated_qty: Optional[float] = None
    write_back: bool = False


class AdaptResultRead(BaseModel):
    facility_id: int
    work_package: Optional[str] = None
    estimated_qty: Optional[float] = None
    max_workers_used: Optional[int] = None
    matched_template_id: Optional[int] = None
    adjusted_template_name: Optional[str] = None
    adjusted_total_days: Optional[int] = None
    activity_links: List[Dict[str, object]] = Field(default_factory=list)
    activity_ids: List[str] = Field(default_factory=list)
    message: Optional[str] = None
    write_back_updated_count: Optional[int] = None
    error: Optional[str] = None


class RecalcDatesRead(BaseModel):
    dates_by_activity_key: Dict[str, Dict[str, object]]


class GenerateRelationTableRequest(BaseModel):
    facility_type_id: Optional[int] = None
    facility_ids: Optional[List[int]] = None


class GenerateRelationTableRead(BaseModel):
    relation_table: List[Dict[str, object]] = Field(default_factory=list)


@router.get("/templates", response_model=List[ProcessTemplateRead])
async def list_templates(
    facility_type_id: Optional[int] = None,
    facility_id: Optional[int] = None,
    work_package: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    return ProcessTemplateService.list_templates(
        db=db,
        facility_type_id=facility_type_id,
        facility_id=facility_id,
        work_package=work_package,
    )


@router.post("/templates", response_model=ProcessTemplateRead)
async def create_template(
    template_in: ProcessTemplateCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    return ProcessTemplateService.create_template(db, template_in.dict())


@router.get("/templates/{template_id}", response_model=ProcessTemplateRead)
async def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    template = ProcessTemplateService.get_template(db, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Process template not found")
    return template


@router.put("/templates/{template_id}", response_model=ProcessTemplateRead)
async def update_template(
    template_id: int,
    template_in: ProcessTemplateCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    template = ProcessTemplateService.update_template(db, template_id, template_in.dict(exclude_unset=True))
    if not template:
        raise HTTPException(status_code=404, detail="Process template not found")
    return template


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    deleted = ProcessTemplateService.delete_template(db, template_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Process template not found")
    return {"success": True}


@router.get("/activities-by-facility", response_model=List[ActivityByFacilityRead])
async def get_activities_by_facility(
    facility_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    return ProcessTemplateService.get_activities_by_facility(db, facility_id)


@router.get("/templates/{template_id}/activities", response_model=List[TemplateActivityRead])
async def list_template_activities(
    template_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    template = ProcessTemplateService.get_template(db, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Process template not found")
    return ProcessTemplateService.list_template_activities(db, template_id)


@router.post("/templates/{template_id}/activities/init-from-work-packages", response_model=List[TemplateActivityRead])
async def init_template_activities_from_work_packages(
    template_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    try:
        return ProcessTemplateService.init_template_from_work_packages(db, template_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/templates/{template_id}/activities/{activity_id}", response_model=TemplateActivityRead)
async def update_template_activity(
    template_id: int,
    activity_id: int,
    planned_duration: Optional[float] = None,
    standard_hours: Optional[float] = None,
    setup_hours: Optional[float] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    activity = ProcessTemplateService.update_template_activity(
        db,
        template_id,
        activity_id,
        planned_duration=planned_duration,
        standard_hours=standard_hours,
        setup_hours=setup_hours,
    )
    if not activity:
        raise HTTPException(status_code=404, detail="Template activity not found")
    return activity


@router.get("/templates/{template_id}/activity-links", response_model=List[TemplateActivityLinkRead])
async def list_template_activity_links(
    template_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    template = ProcessTemplateService.get_template(db, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Process template not found")
    return ProcessTemplateService.list_template_activity_links(db, template_id)


@router.post("/templates/{template_id}/activity-links", response_model=List[TemplateActivityLinkRead])
async def create_template_activity_links(
    template_id: int,
    payload: TemplateActivityLinkBatchCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    try:
        return ProcessTemplateService.create_template_activity_links(
            db,
            template_id,
            [item.dict() for item in payload.links],
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/templates/{template_id}/activity-links/{link_id}")
async def delete_template_activity_link(
    template_id: int,
    link_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    deleted = ProcessTemplateService.delete_template_activity_link(db, template_id, link_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Template activity link not found")
    return {"success": True}


@router.get("/templates/{template_id}/recalc-dates", response_model=RecalcDatesRead)
async def recalc_template_dates(
    template_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    template = ProcessTemplateService.get_template(db, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Process template not found")
    return {"dates_by_activity_key": ProcessTemplateService.recalc_template_dates(db, template_id)}


@router.post("/adapt", response_model=AdaptResultRead)
async def adapt_template(
    payload: AdaptRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = run_adaptation(
        db,
        facility_id=payload.facility_id,
        max_workers=payload.max_workers,
        work_package_override=payload.work_package,
        estimated_qty_override=payload.work_package_estimated_qty,
    )
    if payload.write_back and result.get("activity_ids") and result.get("adjusted_total_days") is not None:
        updated_count = write_back_planned_duration(
            db,
            activity_ids=result["activity_ids"],
            planned_duration_days=result["adjusted_total_days"],
        )
        result["write_back_updated_count"] = updated_count
    return result


@router.post("/generate-relation-table", response_model=GenerateRelationTableRead)
async def generate_relation_table(
    payload: GenerateRelationTableRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    relation_table = ProcessTemplateService.generate_relation_table(
        db,
        facility_type_id=payload.facility_type_id,
        facility_ids=payload.facility_ids,
    )
    return {"relation_table": relation_table}
