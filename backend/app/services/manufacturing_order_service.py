from datetime import date
from decimal import Decimal
from typing import Dict, List, Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models.bom import BOMHeader
from app.models.equipment import Equipment
from app.models.order import ManufacturingOrder
from app.models.process_template import ProcessTemplate, TemplateActivity
from app.models.production_step import ProductionStep
from app.models.step_quality_check import StepQualityCheck
from app.models.work_report import WorkReport


VALID_STEP_STATUSES = {"PLANNED", "READY", "IN_PROGRESS", "QC", "COMPLETED", "BLOCKED"}
VALID_QUALITY_RESULTS = {"PASS", "FAIL", "REWORK", "HOLD"}
VALID_CHECK_TYPES = {"IPQC", "FQC", "OQC"}
VALID_ORDER_STATUSES = {"PLANNED", "RELEASED", "IN_PROGRESS", "QC", "COMPLETED", "CANCELLED"}


def _to_decimal(value: Optional[object]) -> Decimal:
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _ratio(numerator: Decimal, denominator: Decimal) -> float:
    if denominator <= 0:
        return 0.0
    value = numerator / denominator
    return float(max(Decimal("0"), min(Decimal("1"), value)))


class ManufacturingOrderService:
    @staticmethod
    def _order_query(db: Session, include_reports: bool = False, include_quality: bool = False):
        base_step_loader = joinedload(ManufacturingOrder.steps)
        options = [
            joinedload(ManufacturingOrder.bom),
            joinedload(ManufacturingOrder.process_template),
            base_step_loader.joinedload(ProductionStep.equipment),
        ]
        if include_reports:
            options.append(base_step_loader.joinedload(ProductionStep.reports).joinedload(WorkReport.operator))
        if include_quality:
            options.append(
                base_step_loader.joinedload(ProductionStep.quality_checks).joinedload(StepQualityCheck.inspector)
            )
        return db.query(ManufacturingOrder).options(*options)

    @staticmethod
    def _step_query(db: Session, include_reports: bool = False, include_quality: bool = False):
        query = db.query(ProductionStep).options(joinedload(ProductionStep.equipment))
        if include_reports:
            query = query.options(joinedload(ProductionStep.reports).joinedload(WorkReport.operator))
        if include_quality:
            query = query.options(
                joinedload(ProductionStep.quality_checks).joinedload(StepQualityCheck.inspector)
            )
        return query

    @staticmethod
    def _sync_order_status(order: ManufacturingOrder) -> None:
        if order.status == "CANCELLED":
            return

        steps = list(order.steps or [])
        if not steps:
            return

        if all(step.status == "COMPLETED" for step in steps):
            order.status = "COMPLETED"
            return

        if any(step.status == "QC" for step in steps):
            order.status = "QC"
            return

        has_started = any(
            step.status in {"IN_PROGRESS", "BLOCKED"} or _to_decimal(step.completed_qty) > 0 for step in steps
        )
        if has_started:
            order.status = "IN_PROGRESS"
            return

        has_released = any(step.status == "READY" for step in steps)
        order.status = "RELEASED" if has_released else "PLANNED"

    @staticmethod
    def _derive_report_work_hours(step: ProductionStep, reported_qty: Decimal, reported_scrap: Decimal) -> Decimal:
        target_qty = _to_decimal(step.target_qty)
        planned_work_hours = _to_decimal(step.planned_work_hours)
        total_reported_qty = reported_qty + reported_scrap
        if target_qty <= 0 or planned_work_hours <= 0 or total_reported_qty <= 0:
            return Decimal("0")
        return (planned_work_hours * total_reported_qty) / target_qty

    @staticmethod
    def _build_equipment_metrics(equipment: Equipment) -> Dict[str, object]:
        return {
            "id": equipment.id,
            "code": equipment.code,
            "name": equipment.name,
            "model_number": equipment.model_number,
            "workstation": equipment.workstation,
            "status": equipment.status,
            "assigned_steps": 0,
            "orders": set(),
            "planned_hours_total": Decimal("0"),
            "actual_hours_total": Decimal("0"),
            "downtime_minutes_total": 0,
            "runtime_hours_total": Decimal("0"),
            "theoretical_hours_total": Decimal("0"),
            "good_qty_total": Decimal("0"),
            "total_qty_total": Decimal("0"),
            "scrap_qty_total": Decimal("0"),
        }

    @staticmethod
    def list_orders(
        db: Session,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
    ) -> List[ManufacturingOrder]:
        query = ManufacturingOrderService._order_query(db, include_reports=False, include_quality=False)

        if status:
            query = query.filter(ManufacturingOrder.status == status)

        if keyword:
            like_pattern = f"%{keyword}%"
            query = query.filter(
                or_(
                    ManufacturingOrder.order_number.like(like_pattern),
                    ManufacturingOrder.customer_name.like(like_pattern),
                    ManufacturingOrder.product_name.like(like_pattern),
                )
            )

        return query.order_by(ManufacturingOrder.created_at.desc(), ManufacturingOrder.id.desc()).all()

    @staticmethod
    def get_order(
        db: Session,
        order_id: int,
        include_reports: bool = False,
        include_quality: bool = False,
    ) -> Optional[ManufacturingOrder]:
        return (
            ManufacturingOrderService._order_query(
                db,
                include_reports=include_reports,
                include_quality=include_quality,
            )
            .filter(ManufacturingOrder.id == order_id)
            .first()
        )

    @staticmethod
    def create_order(
        db: Session,
        payload: dict,
        auto_generate_steps: bool = True,
    ) -> ManufacturingOrder:
        order_number = str(payload.get("order_number") or "").strip()
        if not order_number:
            raise ValueError("Order number is required")
        duplicate_order = (
            db.query(ManufacturingOrder)
            .filter(ManufacturingOrder.order_number == order_number)
            .first()
        )
        if duplicate_order:
            raise ValueError("Order number already exists")
        payload["order_number"] = order_number

        bom_id = payload.get("bom_id")
        process_template_id = payload.get("process_template_id")

        if bom_id is not None:
            bom = db.query(BOMHeader).filter(BOMHeader.id == bom_id).first()
            if not bom:
                raise ValueError("Selected BOM does not exist")

        template: Optional[ProcessTemplate] = None
        if process_template_id is not None:
            template = db.query(ProcessTemplate).filter(ProcessTemplate.id == process_template_id).first()
            if not template:
                raise ValueError("Selected process template does not exist")

        order = ManufacturingOrder(**payload)
        db.add(order)
        db.flush()

        if template and auto_generate_steps:
            activities = (
                db.query(TemplateActivity)
                .filter(TemplateActivity.template_id == template.id)
                .order_by(TemplateActivity.sort_order.asc(), TemplateActivity.id.asc())
                .all()
            )
            for index, activity in enumerate(activities):
                template_standard_hours = _to_decimal(getattr(activity, "standard_hours", None))
                planned_work_hours = (
                    template_standard_hours
                    if template_standard_hours > 0
                    else _to_decimal(activity.planned_duration) * Decimal("8")
                )
                setup_hours = _to_decimal(getattr(activity, "setup_hours", None))
                db.add(
                    ProductionStep(
                        order_id=order.id,
                        step_code=activity.activity_key[:50],
                        name=(activity.label or activity.activity_key)[:200],
                        sort_order=activity.sort_order if activity.sort_order is not None else index,
                        target_qty=order.quantity,
                        planned_work_hours=planned_work_hours,
                        setup_hours=setup_hours,
                        status="PLANNED",
                    )
                )

        db.commit()
        return ManufacturingOrderService.get_order(db, order.id, include_reports=True, include_quality=True)

    @staticmethod
    def update_order(
        db: Session,
        order_id: int,
        payload: dict,
    ) -> ManufacturingOrder:
        order = ManufacturingOrderService.get_order(db, order_id, include_reports=False, include_quality=False)
        if not order:
            raise ValueError("Manufacturing order not found")

        if "order_number" in payload:
            order_number = str(payload.get("order_number") or "").strip()
            if not order_number:
                raise ValueError("Order number is required")
            duplicate_order = (
                db.query(ManufacturingOrder)
                .filter(
                    ManufacturingOrder.order_number == order_number,
                    ManufacturingOrder.id != order_id,
                )
                .first()
            )
            if duplicate_order:
                raise ValueError("Order number already exists")
            order.order_number = order_number

        if "customer_name" in payload:
            customer_name = str(payload.get("customer_name") or "").strip()
            order.customer_name = customer_name or None

        if "product_name" in payload:
            product_name = str(payload.get("product_name") or "").strip()
            order.product_name = product_name or None

        if "bom_id" in payload:
            bom_id = payload.get("bom_id")
            if bom_id is not None:
                bom = db.query(BOMHeader).filter(BOMHeader.id == bom_id).first()
                if not bom:
                    raise ValueError("Selected BOM does not exist")
            order.bom_id = bom_id

        if "process_template_id" in payload:
            process_template_id = payload.get("process_template_id")
            if process_template_id is not None:
                template = db.query(ProcessTemplate).filter(ProcessTemplate.id == process_template_id).first()
                if not template:
                    raise ValueError("Selected process template does not exist")
            order.process_template_id = process_template_id

        if "quantity" in payload and payload.get("quantity") is not None:
            quantity = int(payload.get("quantity") or 0)
            if quantity < 1:
                raise ValueError("Quantity must be greater than zero")
            order.quantity = quantity
            quantity_decimal = _to_decimal(quantity)
            for step in order.steps or []:
                step.target_qty = quantity_decimal
                if _to_decimal(step.completed_qty) > quantity_decimal:
                    step.completed_qty = quantity_decimal

        if "due_date" in payload:
            order.due_date = payload.get("due_date")

        if "priority" in payload and payload.get("priority") is not None:
            priority = int(payload.get("priority") or 0)
            if priority < 1 or priority > 5:
                raise ValueError("Priority must be between 1 and 5")
            order.priority = priority

        if "status" in payload and payload.get("status"):
            normalized_status = str(payload.get("status")).upper()
            if normalized_status not in VALID_ORDER_STATUSES:
                raise ValueError("Invalid order status")
            order.status = normalized_status

        if "notes" in payload:
            notes = str(payload.get("notes") or "").strip()
            order.notes = notes or None

        db.commit()
        return ManufacturingOrderService.get_order(db, order_id, include_reports=True, include_quality=True)

    @staticmethod
    def get_step(
        db: Session,
        order_id: int,
        step_id: int,
        include_reports: bool = False,
        include_quality: bool = False,
    ) -> Optional[ProductionStep]:
        return (
            ManufacturingOrderService._step_query(
                db,
                include_reports=include_reports,
                include_quality=include_quality,
            )
            .filter(ProductionStep.id == step_id, ProductionStep.order_id == order_id)
            .first()
        )

    @staticmethod
    def update_step_status(
        db: Session,
        order_id: int,
        step_id: int,
        status: str,
        completed_qty: Optional[float] = None,
    ) -> ProductionStep:
        normalized_status = status.upper()
        if normalized_status not in VALID_STEP_STATUSES:
            raise ValueError("Invalid step status")

        order = ManufacturingOrderService.get_order(db, order_id, include_reports=False, include_quality=False)
        if not order:
            raise ValueError("Manufacturing order not found")

        step = next((item for item in order.steps if item.id == step_id), None)
        if not step:
            raise ValueError("Production step not found")

        if completed_qty is not None:
            normalized_qty = _to_decimal(completed_qty)
            if normalized_qty < 0:
                raise ValueError("Completed quantity cannot be negative")
            step.completed_qty = normalized_qty

        if normalized_status == "COMPLETED":
            target_qty = _to_decimal(step.target_qty)
            current_completed = _to_decimal(step.completed_qty)
            if target_qty > 0 and current_completed < target_qty:
                step.completed_qty = target_qty

        step.status = normalized_status
        ManufacturingOrderService._sync_order_status(order)
        db.commit()
        return ManufacturingOrderService.get_step(db, order_id, step_id, include_reports=True, include_quality=True)

    @staticmethod
    def update_step_planning(
        db: Session,
        order_id: int,
        step_id: int,
        workstation_id: Optional[int] = None,
        planned_work_hours: Optional[float] = None,
        setup_hours: Optional[float] = None,
    ) -> ProductionStep:
        order = ManufacturingOrderService.get_order(db, order_id, include_reports=False, include_quality=False)
        if not order:
            raise ValueError("Manufacturing order not found")

        step = next((item for item in order.steps if item.id == step_id), None)
        if not step:
            raise ValueError("Production step not found")

        if workstation_id is not None:
            if workstation_id > 0:
                equipment = db.query(Equipment).filter(Equipment.id == workstation_id).first()
                if not equipment:
                    raise ValueError("Selected equipment does not exist")
                step.workstation_id = workstation_id
            else:
                step.workstation_id = None

        if planned_work_hours is not None:
            normalized_planned_hours = _to_decimal(planned_work_hours)
            if normalized_planned_hours < 0:
                raise ValueError("Planned work hours cannot be negative")
            step.planned_work_hours = normalized_planned_hours

        if setup_hours is not None:
            normalized_setup_hours = _to_decimal(setup_hours)
            if normalized_setup_hours < 0:
                raise ValueError("Setup hours cannot be negative")
            step.setup_hours = normalized_setup_hours

        if step.status == "PLANNED" and step.workstation_id:
            step.status = "READY"
        elif step.status == "READY" and not step.workstation_id:
            step.status = "PLANNED"

        ManufacturingOrderService._sync_order_status(order)
        db.commit()
        return ManufacturingOrderService.get_step(db, order_id, step_id, include_reports=True, include_quality=True)

    @staticmethod
    def get_work_report(db: Session, report_id: int) -> Optional[WorkReport]:
        return (
            db.query(WorkReport)
            .options(joinedload(WorkReport.operator))
            .filter(WorkReport.id == report_id)
            .first()
        )

    @staticmethod
    def create_work_report(
        db: Session,
        order_id: int,
        step_id: int,
        operator_id: int,
        quantity: float,
        scrap_qty: float = 0,
        report_type: str = "MANUAL",
        remarks: Optional[str] = None,
        work_hours: Optional[float] = None,
        downtime_minutes: int = 0,
    ) -> WorkReport:
        reported_qty = _to_decimal(quantity)
        reported_scrap = _to_decimal(scrap_qty)
        if reported_qty < 0 or reported_scrap < 0:
            raise ValueError("Reported quantity cannot be negative")
        if reported_qty == 0 and reported_scrap == 0:
            raise ValueError("At least one of quantity or scrap quantity must be greater than zero")
        if downtime_minutes < 0:
            raise ValueError("Downtime minutes cannot be negative")

        order = ManufacturingOrderService.get_order(db, order_id, include_reports=False, include_quality=False)
        if not order:
            raise ValueError("Manufacturing order not found")

        step = next((item for item in order.steps if item.id == step_id), None)
        if not step:
            raise ValueError("Production step not found")

        resolved_work_hours = (
            _to_decimal(work_hours)
            if work_hours is not None
            else ManufacturingOrderService._derive_report_work_hours(step, reported_qty, reported_scrap)
        )
        if resolved_work_hours < 0:
            raise ValueError("Work hours cannot be negative")
        if resolved_work_hours == 0 and downtime_minutes > 0:
            raise ValueError("Downtime minutes require work hours greater than zero")
        if resolved_work_hours > 0 and Decimal(downtime_minutes) > (resolved_work_hours * Decimal("60")):
            raise ValueError("Downtime minutes cannot exceed total reported work minutes")

        report = WorkReport(
            step_id=step.id,
            operator_id=operator_id,
            quantity=reported_qty,
            scrap_qty=reported_scrap,
            work_hours=resolved_work_hours,
            downtime_minutes=downtime_minutes,
            report_type=report_type,
            remarks=remarks,
        )
        db.add(report)

        step.completed_qty = _to_decimal(step.completed_qty) + reported_qty
        target_qty = _to_decimal(step.target_qty)
        current_completed = _to_decimal(step.completed_qty)
        if target_qty > 0 and current_completed >= target_qty:
            step.status = "QC"
        else:
            step.status = "IN_PROGRESS"

        ManufacturingOrderService._sync_order_status(order)
        db.commit()
        return ManufacturingOrderService.get_work_report(db, report.id)

    @staticmethod
    def get_quality_check(db: Session, check_id: int) -> Optional[StepQualityCheck]:
        return (
            db.query(StepQualityCheck)
            .options(joinedload(StepQualityCheck.inspector))
            .filter(StepQualityCheck.id == check_id)
            .first()
        )

    @staticmethod
    def create_quality_check(
        db: Session,
        order_id: int,
        step_id: int,
        inspector_id: int,
        result: str,
        checked_qty: float = 0,
        defect_qty: float = 0,
        rework_qty: float = 0,
        check_type: str = "IPQC",
        remarks: Optional[str] = None,
    ) -> StepQualityCheck:
        normalized_result = result.upper()
        if normalized_result not in VALID_QUALITY_RESULTS:
            raise ValueError("Invalid quality result")

        normalized_check_type = check_type.upper()
        if normalized_check_type not in VALID_CHECK_TYPES:
            raise ValueError("Invalid quality check type")

        checked_qty_value = _to_decimal(checked_qty)
        defect_qty_value = _to_decimal(defect_qty)
        rework_qty_value = _to_decimal(rework_qty)
        if checked_qty_value < 0 or defect_qty_value < 0 or rework_qty_value < 0:
            raise ValueError("Quality quantities cannot be negative")

        step = ManufacturingOrderService.get_step(
            db,
            order_id,
            step_id,
            include_reports=False,
            include_quality=False,
        )
        if not step:
            raise ValueError("Production step not found")

        order = step.order
        if not order:
            raise ValueError("Manufacturing order not found")

        quality_check = StepQualityCheck(
            step_id=step.id,
            inspector_id=inspector_id,
            check_type=normalized_check_type,
            result=normalized_result,
            checked_qty=checked_qty_value,
            defect_qty=defect_qty_value,
            rework_qty=rework_qty_value,
            remarks=remarks,
        )
        db.add(quality_check)

        current_completed = _to_decimal(step.completed_qty)
        target_qty = _to_decimal(step.target_qty)

        if normalized_result == "PASS":
            if target_qty > 0 and current_completed >= target_qty:
                step.status = "COMPLETED"
            elif current_completed > 0:
                step.status = "IN_PROGRESS"
            else:
                step.status = "READY"
        else:
            reduction_qty = rework_qty_value if rework_qty_value > 0 else defect_qty_value
            if reduction_qty > 0:
                step.completed_qty = max(Decimal("0"), current_completed - reduction_qty)
            step.status = "BLOCKED"

        ManufacturingOrderService._sync_order_status(order)
        db.commit()
        return ManufacturingOrderService.get_quality_check(db, quality_check.id)

    @staticmethod
    def get_equipment_oee_summary(db: Session) -> Dict[str, object]:
        equipment_list = db.query(Equipment).order_by(Equipment.code.asc(), Equipment.id.asc()).all()
        metric_map = {equipment.id: ManufacturingOrderService._build_equipment_metrics(equipment) for equipment in equipment_list}

        orders = ManufacturingOrderService._order_query(db, include_reports=True, include_quality=False).all()
        for order in orders:
            if order.status == "CANCELLED":
                continue
            for step in order.steps:
                if not step.workstation_id or step.workstation_id not in metric_map:
                    continue
                equipment_metrics = metric_map[step.workstation_id]
                equipment_metrics["assigned_steps"] += 1
                equipment_metrics["orders"].add(order.id)
                equipment_metrics["planned_hours_total"] += _to_decimal(step.planned_work_hours) + _to_decimal(
                    step.setup_hours
                )

                target_qty = _to_decimal(step.target_qty)
                planned_work_hours = _to_decimal(step.planned_work_hours)
                for report in step.reports or []:
                    reported_good_qty = _to_decimal(report.quantity)
                    reported_scrap_qty = _to_decimal(report.scrap_qty)
                    reported_total_qty = reported_good_qty + reported_scrap_qty
                    actual_hours = _to_decimal(report.work_hours)
                    downtime_minutes = int(report.downtime_minutes or 0)
                    downtime_hours = Decimal(downtime_minutes) / Decimal("60")
                    runtime_hours = max(Decimal("0"), actual_hours - downtime_hours)
                    theoretical_hours = Decimal("0")
                    if target_qty > 0 and planned_work_hours > 0 and reported_total_qty > 0:
                        theoretical_hours = (planned_work_hours * reported_total_qty) / target_qty

                    equipment_metrics["actual_hours_total"] += actual_hours
                    equipment_metrics["downtime_minutes_total"] += downtime_minutes
                    equipment_metrics["runtime_hours_total"] += runtime_hours
                    equipment_metrics["theoretical_hours_total"] += theoretical_hours
                    equipment_metrics["good_qty_total"] += reported_good_qty
                    equipment_metrics["total_qty_total"] += reported_total_qty
                    equipment_metrics["scrap_qty_total"] += reported_scrap_qty

        items: List[Dict[str, object]] = []
        total_planned_hours = Decimal("0")
        total_actual_hours = Decimal("0")
        total_runtime_hours = Decimal("0")
        total_theoretical_hours = Decimal("0")
        total_good_qty = Decimal("0")
        total_qty = Decimal("0")
        total_downtime_minutes = 0

        for equipment in equipment_list:
            raw = metric_map[equipment.id]
            planned_hours_total = _to_decimal(raw["planned_hours_total"])
            actual_hours_total = _to_decimal(raw["actual_hours_total"])
            runtime_hours_total = _to_decimal(raw["runtime_hours_total"])
            theoretical_hours_total = _to_decimal(raw["theoretical_hours_total"])
            good_qty_total = _to_decimal(raw["good_qty_total"])
            total_qty_total = _to_decimal(raw["total_qty_total"])
            scrap_qty_total = _to_decimal(raw["scrap_qty_total"])
            downtime_minutes_total = int(raw["downtime_minutes_total"])

            availability_rate = _ratio(runtime_hours_total, planned_hours_total)
            performance_rate = _ratio(theoretical_hours_total, runtime_hours_total)
            quality_rate = _ratio(good_qty_total, total_qty_total)
            utilization_rate = _ratio(actual_hours_total, planned_hours_total)
            oee_rate = availability_rate * performance_rate * quality_rate

            total_planned_hours += planned_hours_total
            total_actual_hours += actual_hours_total
            total_runtime_hours += runtime_hours_total
            total_theoretical_hours += theoretical_hours_total
            total_good_qty += good_qty_total
            total_qty += total_qty_total
            total_downtime_minutes += downtime_minutes_total

            items.append(
                {
                    "id": equipment.id,
                    "code": equipment.code,
                    "name": equipment.name,
                    "model_number": equipment.model_number,
                    "workstation": equipment.workstation,
                    "status": equipment.status,
                    "assigned_steps": int(raw["assigned_steps"]),
                    "orders_count": len(raw["orders"]),
                    "planned_hours_total": float(planned_hours_total),
                    "actual_hours_total": float(actual_hours_total),
                    "runtime_hours_total": float(runtime_hours_total),
                    "theoretical_hours_total": float(theoretical_hours_total),
                    "downtime_minutes_total": downtime_minutes_total,
                    "good_qty_total": float(good_qty_total),
                    "scrap_qty_total": float(scrap_qty_total),
                    "availability_rate": availability_rate,
                    "performance_rate": performance_rate,
                    "quality_rate": quality_rate,
                    "utilization_rate": utilization_rate,
                    "oee_rate": oee_rate,
                }
            )

        items.sort(key=lambda item: (item["status"] != "ACTIVE", item["oee_rate"], -item["assigned_steps"]))

        overall_availability_rate = _ratio(total_runtime_hours, total_planned_hours)
        overall_performance_rate = _ratio(total_theoretical_hours, total_runtime_hours)
        overall_quality_rate = _ratio(total_good_qty, total_qty)
        overall_oee_rate = overall_availability_rate * overall_performance_rate * overall_quality_rate

        return {
            "equipment_total": len(equipment_list),
            "equipment_active": sum(1 for item in equipment_list if item.status == "ACTIVE"),
            "equipment_maintenance": sum(1 for item in equipment_list if item.status == "MAINTENANCE"),
            "equipment_offline": sum(1 for item in equipment_list if item.status == "OFFLINE"),
            "equipment_assigned": sum(1 for item in items if item["assigned_steps"] > 0),
            "planned_hours_total": float(total_planned_hours),
            "actual_hours_total": float(total_actual_hours),
            "runtime_hours_total": float(total_runtime_hours),
            "downtime_minutes_total": total_downtime_minutes,
            "overall_availability_rate": overall_availability_rate,
            "overall_performance_rate": overall_performance_rate,
            "overall_quality_rate": overall_quality_rate,
            "overall_oee_rate": overall_oee_rate,
            "items": items,
        }

    @staticmethod
    def get_wip_summary(db: Session) -> Dict[str, float]:
        orders = ManufacturingOrderService._order_query(db, include_reports=True, include_quality=True).all()
        quality_checks = db.query(StepQualityCheck).all()
        work_reports = db.query(WorkReport).all()
        equipment_summary = ManufacturingOrderService.get_equipment_oee_summary(db)

        order_status_counts = {
            "orders_total": len(orders),
            "orders_planned": 0,
            "orders_released": 0,
            "orders_in_progress": 0,
            "orders_qc": 0,
            "orders_completed": 0,
            "orders_cancelled": 0,
        }
        step_status_counts = {
            "steps_total": 0,
            "steps_planned": 0,
            "steps_ready": 0,
            "steps_in_progress": 0,
            "steps_qc": 0,
            "steps_completed": 0,
            "steps_blocked": 0,
        }

        planned_hours_total = Decimal("0")
        for order in orders:
            key = f"orders_{order.status.lower()}"
            if key in order_status_counts:
                order_status_counts[key] += 1
            step_status_counts["steps_total"] += len(order.steps)
            for step in order.steps:
                planned_hours_total += _to_decimal(step.planned_work_hours) + _to_decimal(step.setup_hours)
                step_key = f"steps_{step.status.lower()}"
                if step_key in step_status_counts:
                    step_status_counts[step_key] += 1

        today = date.today()
        reports_today = 0
        reported_hours_total = Decimal("0")
        downtime_minutes_total = 0
        for report in work_reports:
            report_dt = report.report_time or report.created_at
            if report_dt and report_dt.date() == today:
                reports_today += 1
            reported_hours_total += _to_decimal(report.work_hours)
            downtime_minutes_total += int(report.downtime_minutes or 0)

        quality_summary = {
            "quality_pass_count": 0,
            "quality_fail_count": 0,
            "quality_rework_count": 0,
            "quality_hold_count": 0,
            "rework_qty_total": float(sum(_to_decimal(item.rework_qty) for item in quality_checks)),
            "defect_qty_total": float(sum(_to_decimal(item.defect_qty) for item in quality_checks)),
        }
        for quality_check in quality_checks:
            key = f"quality_{quality_check.result.lower()}_count"
            if key in quality_summary:
                quality_summary[key] += 1

        summary: Dict[str, float] = {
            **order_status_counts,
            **step_status_counts,
            **quality_summary,
            "planned_hours_total": float(planned_hours_total),
            "reported_hours_total": float(reported_hours_total),
            "downtime_minutes_total": downtime_minutes_total,
            "equipment_total": int(equipment_summary["equipment_total"]),
            "equipment_active": int(equipment_summary["equipment_active"]),
            "equipment_maintenance": int(equipment_summary["equipment_maintenance"]),
            "equipment_offline": int(equipment_summary["equipment_offline"]),
            "equipment_assigned": int(equipment_summary["equipment_assigned"]),
            "overall_oee_rate": float(equipment_summary["overall_oee_rate"]),
            "reports_total": len(work_reports),
            "reports_today": reports_today,
        }
        return summary
