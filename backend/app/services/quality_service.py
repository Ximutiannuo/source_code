"""Quality analysis service: cross-order quality statistics."""

from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.order import ManufacturingOrder
from app.models.production_step import ProductionStep
from app.models.step_quality_check import StepQualityCheck
from app.models.work_report import WorkReport


class QualityService:
    """Aggregate quality data across all manufacturing orders."""

    @staticmethod
    def get_quality_dashboard(db: Session, days: int = 30) -> Dict[str, Any]:
        cutoff = datetime.combine(date.today() - timedelta(days=days), datetime.min.time())

        checks = (
            db.query(StepQualityCheck)
            .filter(StepQualityCheck.checked_at >= cutoff)
            .all()
        )

        total = len(checks)
        pass_count = sum(1 for c in checks if c.result == "PASS")
        fail_count = sum(1 for c in checks if c.result == "FAIL")
        rework_count = sum(1 for c in checks if c.result == "REWORK")
        hold_count = sum(1 for c in checks if c.result == "HOLD")
        defect_qty = sum(float(c.defect_qty or 0) for c in checks)
        rework_qty = sum(float(c.rework_qty or 0) for c in checks)
        checked_qty = sum(float(c.checked_qty or 0) for c in checks)

        first_pass_rate = round(pass_count / total, 4) if total > 0 else 0.0
        defect_rate = round(defect_qty / checked_qty, 4) if checked_qty > 0 else 0.0

        return {
            "period_days": days,
            "total_checks": total,
            "pass_count": pass_count,
            "fail_count": fail_count,
            "rework_count": rework_count,
            "hold_count": hold_count,
            "checked_qty_total": round(checked_qty, 2),
            "defect_qty_total": round(defect_qty, 2),
            "rework_qty_total": round(rework_qty, 2),
            "first_pass_rate": first_pass_rate,
            "defect_rate": defect_rate,
        }

    @staticmethod
    def get_defect_pareto(db: Session, days: int = 30) -> List[Dict[str, Any]]:
        """Defect Pareto by step_code (process)."""
        cutoff = datetime.combine(date.today() - timedelta(days=days), datetime.min.time())

        checks = (
            db.query(StepQualityCheck)
            .filter(StepQualityCheck.checked_at >= cutoff)
            .filter(StepQualityCheck.defect_qty > 0)
            .all()
        )

        step_ids = {c.step_id for c in checks}
        steps = db.query(ProductionStep).filter(ProductionStep.id.in_(list(step_ids))).all() if step_ids else []
        step_map = {s.id: s for s in steps}

        by_process: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
            "defect_qty": 0.0,
            "rework_qty": 0.0,
            "check_count": 0,
        })

        for c in checks:
            step = step_map.get(c.step_id)
            key = step.step_code if step else "UNKNOWN"
            by_process[key]["defect_qty"] += float(c.defect_qty or 0)
            by_process[key]["rework_qty"] += float(c.rework_qty or 0)
            by_process[key]["check_count"] += 1

        items = []
        for step_code, data in by_process.items():
            items.append({
                "step_code": step_code,
                "defect_qty": round(data["defect_qty"], 2),
                "rework_qty": round(data["rework_qty"], 2),
                "check_count": data["check_count"],
            })

        items.sort(key=lambda x: x["defect_qty"], reverse=True)

        # Cumulative percentage
        total_defects = sum(i["defect_qty"] for i in items)
        cumulative = 0.0
        for item in items:
            cumulative += item["defect_qty"]
            item["cumulative_pct"] = round(cumulative / total_defects, 4) if total_defects > 0 else 0.0

        return items

    @staticmethod
    def get_quality_trend(db: Session, days: int = 30) -> List[Dict[str, Any]]:
        """Daily quality trend for the past N days."""
        today = date.today()
        start_date = today - timedelta(days=days)

        checks = (
            db.query(StepQualityCheck)
            .filter(StepQualityCheck.checked_at >= datetime.combine(start_date, datetime.min.time()))
            .all()
        )

        by_date: Dict[str, Dict[str, Any]] = {}
        for d in range(days + 1):
            day_str = (start_date + timedelta(days=d)).isoformat()
            by_date[day_str] = {"pass": 0, "fail": 0, "rework": 0, "hold": 0, "checked_qty": 0.0, "defect_qty": 0.0}

        for c in checks:
            day_str = c.checked_at.date().isoformat() if c.checked_at else today.isoformat()
            if day_str not in by_date:
                continue
            by_date[day_str][c.result.lower() if c.result in ("PASS", "FAIL", "REWORK", "HOLD") else "fail"] += 1
            by_date[day_str]["checked_qty"] += float(c.checked_qty or 0)
            by_date[day_str]["defect_qty"] += float(c.defect_qty or 0)

        result = []
        for day_str in sorted(by_date.keys()):
            d = by_date[day_str]
            total = d["pass"] + d["fail"] + d["rework"] + d["hold"]
            result.append({
                "date": day_str,
                "total_checks": total,
                "pass_count": d["pass"],
                "fail_count": d["fail"],
                "rework_count": d["rework"],
                "hold_count": d["hold"],
                "checked_qty": round(d["checked_qty"], 2),
                "defect_qty": round(d["defect_qty"], 2),
                "first_pass_rate": round(d["pass"] / total, 4) if total > 0 else 0.0,
            })

        return result

    @staticmethod
    def list_quality_checks(
        db: Session,
        result_filter: Optional[str] = None,
        step_code: Optional[str] = None,
        days: int = 90,
        limit: int = 200,
    ) -> List[Dict[str, Any]]:
        cutoff = datetime.combine(date.today() - timedelta(days=days), datetime.min.time())

        query = db.query(StepQualityCheck).filter(StepQualityCheck.checked_at >= cutoff)

        if result_filter:
            query = query.filter(StepQualityCheck.result == result_filter.upper())

        checks = query.order_by(StepQualityCheck.checked_at.desc()).limit(limit).all()

        step_ids = {c.step_id for c in checks}
        steps = db.query(ProductionStep).filter(ProductionStep.id.in_(list(step_ids))).all() if step_ids else []
        step_map = {s.id: s for s in steps}

        order_ids = {s.order_id for s in steps}
        orders = db.query(ManufacturingOrder).filter(ManufacturingOrder.id.in_(list(order_ids))).all() if order_ids else []
        order_map = {o.id: o for o in orders}

        result_list = []
        for c in checks:
            step = step_map.get(c.step_id)
            if step_code and step and step.step_code != step_code.upper():
                continue
            order = order_map.get(step.order_id) if step else None
            result_list.append({
                "id": c.id,
                "step_id": c.step_id,
                "step_code": step.step_code if step else None,
                "step_name": step.name if step else None,
                "order_id": step.order_id if step else None,
                "order_number": order.order_number if order else None,
                "inspector_id": c.inspector_id,
                "inspector_name": c.inspector_name,
                "check_type": c.check_type,
                "result": c.result,
                "checked_qty": float(c.checked_qty or 0),
                "defect_qty": float(c.defect_qty or 0),
                "rework_qty": float(c.rework_qty or 0),
                "remarks": c.remarks,
                "checked_at": c.checked_at.isoformat() if c.checked_at else None,
            })

        return result_list
