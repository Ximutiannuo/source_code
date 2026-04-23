from datetime import date, timedelta
from decimal import Decimal
from typing import Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.activity_summary import ActivitySummary
from app.models.facility import Facility
from app.models.process_template import ProcessTemplate, TemplateActivity, TemplateActivityLink
from app.models.rsc import RSCDefine


def _to_decimal(value: Optional[object], default: str = "0") -> Decimal:
    if value is None:
        return Decimal(default)
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


class ProcessTemplateService:
    @staticmethod
    def list_templates(
        db: Session,
        facility_type_id: Optional[int] = None,
        facility_id: Optional[int] = None,
        work_package: Optional[str] = None,
    ) -> List[ProcessTemplate]:
        query = db.query(ProcessTemplate)
        if facility_type_id is not None:
            query = query.filter(ProcessTemplate.facility_type_id == facility_type_id)
        if facility_id is not None:
            query = query.filter(ProcessTemplate.facility_id == facility_id)
        if work_package is not None:
            query = query.filter(ProcessTemplate.work_package == work_package)
        return query.order_by(ProcessTemplate.updated_at.desc(), ProcessTemplate.id.desc()).all()

    @staticmethod
    def get_template(db: Session, template_id: int) -> Optional[ProcessTemplate]:
        return db.query(ProcessTemplate).filter(ProcessTemplate.id == template_id).first()

    @staticmethod
    def create_template(db: Session, payload: dict) -> ProcessTemplate:
        template = ProcessTemplate(**payload)
        db.add(template)
        db.commit()
        db.refresh(template)
        return template

    @staticmethod
    def update_template(db: Session, template_id: int, payload: dict) -> Optional[ProcessTemplate]:
        template = ProcessTemplateService.get_template(db, template_id)
        if not template:
            return None
        for key, value in payload.items():
            setattr(template, key, value)
        db.commit()
        db.refresh(template)
        return template

    @staticmethod
    def delete_template(db: Session, template_id: int) -> bool:
        template = ProcessTemplateService.get_template(db, template_id)
        if not template:
            return False
        db.delete(template)
        db.commit()
        return True

    @staticmethod
    def list_template_activities(db: Session, template_id: int) -> List[TemplateActivity]:
        return (
            db.query(TemplateActivity)
            .filter(TemplateActivity.template_id == template_id)
            .order_by(TemplateActivity.sort_order.asc(), TemplateActivity.id.asc())
            .all()
        )

    @staticmethod
    def get_template_activity(db: Session, template_id: int, activity_id: int) -> Optional[TemplateActivity]:
        return (
            db.query(TemplateActivity)
            .filter(TemplateActivity.template_id == template_id, TemplateActivity.id == activity_id)
            .first()
        )

    @staticmethod
    def init_template_from_work_packages(db: Session, template_id: int) -> List[TemplateActivity]:
        template = ProcessTemplateService.get_template(db, template_id)
        if not template:
            raise ValueError("Process template not found")

        existing_activities = ProcessTemplateService.list_template_activities(db, template_id)
        existing_keys = {activity.activity_key for activity in existing_activities}
        next_sort_order = len(existing_activities)

        rows = (
            db.query(
                RSCDefine.work_package,
                func.min(RSCDefine.wpkg_description).label("label"),
            )
            .filter(RSCDefine.is_active == True, RSCDefine.work_package.isnot(None), RSCDefine.work_package != "")
            .group_by(RSCDefine.work_package)
            .order_by(RSCDefine.work_package.asc())
            .all()
        )

        if not rows:
            rows = (
                db.query(
                    ActivitySummary.work_package,
                    func.min(ActivitySummary.title).label("label"),
                )
                .filter(ActivitySummary.work_package.isnot(None), ActivitySummary.work_package != "")
                .group_by(ActivitySummary.work_package)
                .order_by(ActivitySummary.work_package.asc())
                .all()
            )

        for row in rows:
            work_package = row.work_package
            if not work_package or work_package in existing_keys:
                continue
            db.add(
                TemplateActivity(
                    template_id=template_id,
                    activity_key=work_package[:100],
                    label=(row.label or work_package)[:255],
                    planned_duration=Decimal("1"),
                    standard_hours=Decimal("8"),
                    setup_hours=Decimal("0"),
                    sort_order=next_sort_order,
                )
            )
            next_sort_order += 1

        db.commit()
        return ProcessTemplateService.list_template_activities(db, template_id)

    @staticmethod
    def update_template_activity(
        db: Session,
        template_id: int,
        activity_id: int,
        planned_duration: Optional[float] = None,
        standard_hours: Optional[float] = None,
        setup_hours: Optional[float] = None,
    ) -> Optional[TemplateActivity]:
        activity = ProcessTemplateService.get_template_activity(db, template_id, activity_id)
        if not activity:
            return None

        if planned_duration is not None:
            activity.planned_duration = max(Decimal("0.1"), _to_decimal(planned_duration, default="1"))
        if standard_hours is not None:
            activity.standard_hours = max(Decimal("0"), _to_decimal(standard_hours))
        if setup_hours is not None:
            activity.setup_hours = max(Decimal("0"), _to_decimal(setup_hours))

        db.commit()
        db.refresh(activity)
        return activity

    @staticmethod
    def list_template_activity_links(db: Session, template_id: int) -> List[TemplateActivityLink]:
        return (
            db.query(TemplateActivityLink)
            .filter(TemplateActivityLink.template_id == template_id)
            .order_by(TemplateActivityLink.sort_order.asc(), TemplateActivityLink.id.asc())
            .all()
        )

    @staticmethod
    def create_template_activity_links(db: Session, template_id: int, links: List[dict]) -> List[TemplateActivityLink]:
        template = ProcessTemplateService.get_template(db, template_id)
        if not template:
            raise ValueError("Process template not found")

        for payload in links:
            db.add(
                TemplateActivityLink(
                    template_id=template_id,
                    predecessor_activity_id=payload["predecessor_activity_id"],
                    successor_activity_id=payload["successor_activity_id"],
                    link_type=payload.get("link_type", "FS"),
                    lag_days=_to_decimal(payload.get("lag_days", 0)),
                    sort_order=payload.get("sort_order", 0) or 0,
                )
            )

        db.commit()
        return ProcessTemplateService.list_template_activity_links(db, template_id)

    @staticmethod
    def delete_template_activity_link(db: Session, template_id: int, link_id: int) -> bool:
        link = (
            db.query(TemplateActivityLink)
            .filter(TemplateActivityLink.template_id == template_id, TemplateActivityLink.id == link_id)
            .first()
        )
        if not link:
            return False
        db.delete(link)
        db.commit()
        return True

    @staticmethod
    def get_activities_by_facility(db: Session, facility_id: int) -> List[Dict[str, Optional[str]]]:
        facility = db.query(Facility).filter(Facility.id == facility_id, Facility.is_active == True).first()
        if not facility:
            return []

        query = db.query(
            ActivitySummary.activity_id,
            ActivitySummary.title,
            ActivitySummary.work_package,
            ActivitySummary.block,
            ActivitySummary.unit,
            ActivitySummary.discipline,
        )
        if facility.simple_block:
            query = query.filter(ActivitySummary.simple_block == facility.simple_block)
        else:
            query = query.filter(ActivitySummary.block == facility.block, ActivitySummary.unit == facility.unit)

        rows = query.order_by(ActivitySummary.work_package.asc(), ActivitySummary.activity_id.asc()).limit(500).all()
        return [
            {
                "activity_id": row.activity_id,
                "title": row.title,
                "work_package": row.work_package,
                "block": row.block,
                "unit": row.unit,
                "discipline": row.discipline,
            }
            for row in rows
        ]

    @staticmethod
    def recalc_template_dates(db: Session, template_id: int) -> Dict[str, Dict[str, object]]:
        activities = ProcessTemplateService.list_template_activities(db, template_id)
        links = ProcessTemplateService.list_template_activity_links(db, template_id)
        if not activities:
            return {}

        states: Dict[str, Dict[str, Decimal]] = {}
        cursor = Decimal("0")
        for activity in activities:
            duration = max(Decimal("1"), _to_decimal(activity.planned_duration, default="1"))
            states[activity.activity_key] = {"start_day": cursor, "duration": duration}
            cursor += duration

        for _ in range(len(activities) + 1):
            changed = False
            for link in links:
                predecessor = states.get(link.predecessor_activity_id)
                successor = states.get(link.successor_activity_id)
                if not predecessor or not successor:
                    continue

                lag_days = _to_decimal(link.lag_days)
                predecessor_start = predecessor["start_day"]
                predecessor_end = predecessor_start + predecessor["duration"]
                successor_start = successor["start_day"]
                successor_duration = successor["duration"]

                if link.link_type == "SS":
                    candidate_start = predecessor_start + lag_days
                elif link.link_type == "FF":
                    candidate_start = predecessor_end + lag_days - successor_duration
                elif link.link_type == "SF":
                    candidate_start = predecessor_start + lag_days - successor_duration
                else:
                    candidate_start = predecessor_end + lag_days

                candidate_start = max(Decimal("0"), candidate_start)
                if candidate_start > successor_start:
                    successor["start_day"] = candidate_start
                    changed = True

            if not changed:
                break

        base_date = date.today()
        result: Dict[str, Dict[str, object]] = {}
        for activity in activities:
            state = states[activity.activity_key]
            start_day = int(state["start_day"])
            duration = max(1, int(state["duration"]))
            end_day = start_day + duration
            start_date = base_date + timedelta(days=start_day)
            end_date = base_date + timedelta(days=max(start_day, end_day - 1))
            result[activity.activity_key] = {
                "start_day": start_day,
                "end_day": end_day,
                "start_date_iso": start_date.isoformat(),
                "end_date_iso": end_date.isoformat(),
            }
        return result

    @staticmethod
    def generate_relation_table(
        db: Session,
        facility_type_id: Optional[int] = None,
        facility_ids: Optional[List[int]] = None,
    ) -> List[Dict[str, object]]:
        relation_table: List[Dict[str, object]] = []

        if facility_ids:
            facilities = db.query(Facility).filter(Facility.id.in_(facility_ids), Facility.is_active == True).all()
            for facility in facilities:
                if not facility.facility_type_id:
                    continue
                templates = ProcessTemplateService.list_templates(db, facility_type_id=facility.facility_type_id)
                for template in templates:
                    for link in ProcessTemplateService.list_template_activity_links(db, template.id):
                        relation_table.append(
                            {
                                "predecessor_activity_id": link.predecessor_activity_id,
                                "successor_activity_id": link.successor_activity_id,
                                "link_type": link.link_type,
                                "lag_days": float(_to_decimal(link.lag_days)),
                                "facility_id": facility.id,
                            }
                        )
            return relation_table

        templates = ProcessTemplateService.list_templates(db, facility_type_id=facility_type_id)
        for template in templates:
            for link in ProcessTemplateService.list_template_activity_links(db, template.id):
                relation_table.append(
                    {
                        "predecessor_activity_id": link.predecessor_activity_id,
                        "successor_activity_id": link.successor_activity_id,
                        "link_type": link.link_type,
                        "lag_days": float(_to_decimal(link.lag_days)),
                    }
                )
        return relation_table
