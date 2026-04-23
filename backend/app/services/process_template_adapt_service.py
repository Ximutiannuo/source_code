"""
工序逻辑动态适配引擎
根据装置(facility_id)从 ProcessTemplate/TemplateActivityLink 规则库匹配模板，
结合 activity_summary 的实际数据调整工期，并可写回 activity_summary。
"""
from decimal import Decimal
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.facility import Facility
from app.models.activity_summary import ActivitySummary
from app.models.process_template import ProcessTemplate, TemplateActivityLink


def get_facility_work_package_quantities(
    db: Session,
    facility_id: int,
) -> List[Dict[str, Any]]:
    """
    按装置获取其下各工作包的预估总量（通过 activity_summary.simple_block = facility.simple_block 关联）。
    返回 [ {"work_package": str, "estimated_qty": float}, ... ]
    """
    facility = db.query(Facility).filter(Facility.id == facility_id, Facility.is_active == True).first()
    if not facility:
        return []
    if not facility.simple_block:
        # 无 simple_block 时用 block + unit 匹配
        q = (
            db.query(ActivitySummary.work_package, func.coalesce(func.sum(ActivitySummary.key_qty), 0).label("total_qty"))
            .filter(
                ActivitySummary.block == facility.block,
                ActivitySummary.unit == facility.unit,
                ActivitySummary.work_package.isnot(None),
                ActivitySummary.work_package != "",
            )
            .group_by(ActivitySummary.work_package)
        )
    else:
        q = (
            db.query(ActivitySummary.work_package, func.coalesce(func.sum(ActivitySummary.key_qty), 0).label("total_qty"))
            .filter(
                ActivitySummary.simple_block == facility.simple_block,
                ActivitySummary.work_package.isnot(None),
                ActivitySummary.work_package != "",
            )
            .group_by(ActivitySummary.work_package)
        )
    rows = q.all()
    return [{"work_package": r.work_package, "estimated_qty": float(r.total_qty)} for r in rows]


def match_template(
    db: Session,
    work_package: str,
    estimated_qty: float,
    max_workers: Optional[int] = None,
) -> Optional[ProcessTemplate]:
    """
    根据工作包、预估总量、人数匹配一条 ProcessTemplate。
    规则：applicable_qty_min <= estimated_qty <= applicable_qty_max，
         若传 max_workers：min_required_workers <= max_workers，且 max_allowed_workers 为空或 >= max_workers。
    同工作包多条时取区间最窄的一条（或第一条）。
    """
    q = (
        db.query(ProcessTemplate)
        .filter(
            ProcessTemplate.work_package == work_package,
            ProcessTemplate.applicable_qty_min <= estimated_qty,
            ProcessTemplate.applicable_qty_max >= estimated_qty,
        )
    )
    if max_workers is not None:
        q = q.filter(ProcessTemplate.min_required_workers <= max_workers)
        # max_allowed_workers 为 NULL 表示不限制上限
        from sqlalchemy import or_
        q = q.filter(
            or_(
                ProcessTemplate.max_allowed_workers.is_(None),
                ProcessTemplate.max_allowed_workers >= max_workers,
            )
        )
    templates = q.order_by(
        (ProcessTemplate.applicable_qty_max - ProcessTemplate.applicable_qty_min).asc()
    ).all()
    return templates[0] if templates else None


def get_template_links(db: Session, template_id: int) -> List[TemplateActivityLink]:
    """获取模板的工序逻辑关系列表。"""
    return (
        db.query(TemplateActivityLink)
        .filter(TemplateActivityLink.template_id == template_id)
        .order_by(TemplateActivityLink.sort_order.asc(), TemplateActivityLink.id.asc())
        .all()
    )


def compute_adjusted_days(
    db: Session,
    facility_id: int,
    template: ProcessTemplate,
    max_workers: Optional[int] = None,
) -> Optional[int]:
    """
    结合 activity_summary 的 actual_workers、actual_days_spent 与模板的 suggested 区间，
    给出调整后总工期（天）。逻辑：
    - 若模板有 suggested_min_days / suggested_max_days，在区间内取建议值；
    - 若装置下该 work_package 已有实际工时，可按 actual_manhour / (max_workers or min_required_workers) 估算剩余/总天数；
    - 否则返回 suggested_max_days 或 suggested_min_days 或 None。
    """
    facility = db.query(Facility).filter(Facility.id == facility_id).first()
    if not facility:
        return None
    workers = max_workers or template.min_required_workers
    if workers <= 0:
        workers = template.min_required_workers

    # 优先使用模板建议工期
    if template.suggested_max_days is not None or template.suggested_min_days is not None:
        if template.suggested_min_days is not None and template.suggested_max_days is not None:
            # 取中间值或上限，简单取平均
            return (template.suggested_min_days + template.suggested_max_days) // 2
        return template.suggested_max_days or template.suggested_min_days

    # 从 activity_summary 该装置下该 work_package 的 actual_manhour 反推
    if facility.simple_block:
        q = db.query(
            func.coalesce(func.sum(ActivitySummary.actual_manhour), 0).label("total_mhrs"),
            func.coalesce(func.max(ActivitySummary.actual_duration), 0).label("max_days"),
        ).filter(
            ActivitySummary.simple_block == facility.simple_block,
            ActivitySummary.work_package == template.work_package,
        )
    else:
        q = db.query(
            func.coalesce(func.sum(ActivitySummary.actual_manhour), 0).label("total_mhrs"),
            func.coalesce(func.max(ActivitySummary.actual_duration), 0).label("max_days"),
        ).filter(
            ActivitySummary.block == facility.block,
            ActivitySummary.unit == facility.unit,
            ActivitySummary.work_package == template.work_package,
        )
    row = q.first()
    if row and row.total_mhrs and float(row.total_mhrs) > 0 and workers > 0:
        # 人天 ≈ 人时/8，总天数 ≈ 总人时/(8*人数)
        from math import ceil
        return max(1, ceil(float(row.total_mhrs) / (8 * workers)))
    if row and row.max_days and int(row.max_days) > 0:
        return int(row.max_days)
    return None


def run_adaptation(
    db: Session,
    facility_id: int,
    max_workers: Optional[int] = None,
    work_package_override: Optional[str] = None,
    estimated_qty_override: Optional[float] = None,
) -> Dict[str, Any]:
    """
    执行动态适配：按装置匹配模板并计算调整后工期。
    返回：
      - facility_id, work_package, estimated_qty, max_workers_used
      - matched_template_id, adjusted_template_name
      - adjusted_total_days, activity_links (工序关系)
      - activity_ids (该装置下该工作包涉及的 activity_id 列表，便于写回)
    """
    facility = db.query(Facility).filter(Facility.id == facility_id, Facility.is_active == True).first()
    if not facility:
        return {"error": "装置不存在或未激活", "facility_id": facility_id}

    if work_package_override and estimated_qty_override is not None:
        wp_qty_list = [{"work_package": work_package_override, "estimated_qty": estimated_qty_override}]
    else:
        wp_qty_list = get_facility_work_package_quantities(db, facility_id)
    if not wp_qty_list:
        return {
            "facility_id": facility_id,
            "adjusted_template_name": None,
            "adjusted_total_days": None,
            "message": "该装置下无工作包或预估量为空，请先维护 activity_summary 或传入 work_package / estimated_qty",
        }

    # 取第一个工作包做匹配（若多工作包可后续扩展为循环或主工作包策略）
    wp = wp_qty_list[0]["work_package"]
    qty = wp_qty_list[0]["estimated_qty"]
    template = match_template(db, wp, qty, max_workers)
    if not template:
        return {
            "facility_id": facility_id,
            "work_package": wp,
            "estimated_qty": qty,
            "max_workers_used": max_workers,
            "adjusted_template_name": None,
            "adjusted_total_days": None,
            "message": f"未找到匹配的工序模板（工作包={wp}, 预估量={qty}, 人数={max_workers}）",
        }

    links = get_template_links(db, template.id)
    adjusted_days = compute_adjusted_days(db, facility_id, template, max_workers)

    # 该装置下该 work_package 的 activity_id 列表（用于写回）
    if facility.simple_block:
        act_query = (
            db.query(ActivitySummary.activity_id)
            .filter(
                ActivitySummary.simple_block == facility.simple_block,
                ActivitySummary.work_package == wp,
            )
        )
    else:
        act_query = (
            db.query(ActivitySummary.activity_id)
            .filter(
                ActivitySummary.block == facility.block,
                ActivitySummary.unit == facility.unit,
                ActivitySummary.work_package == wp,
            )
        )
    activity_ids = [r[0] for r in act_query.all()]

    return {
        "facility_id": facility_id,
        "work_package": wp,
        "estimated_qty": qty,
        "max_workers_used": max_workers or template.min_required_workers,
        "matched_template_id": template.id,
        "adjusted_template_name": template.name,
        "adjusted_total_days": adjusted_days,
        "activity_links": [
            {
                "predecessor_activity_id": l.predecessor_activity_id,
                "successor_activity_id": l.successor_activity_id,
                "link_type": l.link_type,
                "lag_days": float(l.lag_days),
            }
            for l in links
        ],
        "activity_ids": activity_ids,
    }


def write_back_planned_duration(
    db: Session,
    activity_ids: List[str],
    planned_duration_days: int,
) -> int:
    """
    将调整后的计划工期写回 activity_summary.planned_duration。
    返回更新行数。
    """
    if not activity_ids or planned_duration_days is None:
        return 0
    updated = (
        db.query(ActivitySummary)
        .filter(ActivitySummary.activity_id.in_(activity_ids))
        .update({"planned_duration": planned_duration_days}, synchronize_session=False)
    )
    db.commit()
    return updated
