from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session, joinedload

from app.models.procurement import ProcurementRequest, ProcurementRequestItem
from app.models.user import User
from app.services.material_planning_service import MaterialPlanningService
from app.utils.timezone import now as system_now


VALID_PROCUREMENT_REQUEST_STATUSES = {
    "DRAFT",
    "SUBMITTED",
    "IN_PROGRESS",
    "ORDERED",
    "RECEIVED",
    "CANCELLED",
}
VALID_URGENCY_LEVELS = {"URGENT", "HIGH", "MEDIUM", "LOW"}

STATUS_TRANSITIONS = {
    "DRAFT": {"SUBMITTED", "CANCELLED"},
    "SUBMITTED": {"IN_PROGRESS", "CANCELLED"},
    "IN_PROGRESS": {"ORDERED", "CANCELLED"},
    "ORDERED": {"RECEIVED", "CANCELLED"},
    "RECEIVED": set(),
    "CANCELLED": set(),
}

URGENCY_PRIORITY = {"URGENT": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}


class ProcurementRequestService:
    @staticmethod
    def _request_query(db: Session):
        return db.query(ProcurementRequest).options(
            joinedload(ProcurementRequest.items),
            joinedload(ProcurementRequest.requester),
            joinedload(ProcurementRequest.source_order),
        )

    @staticmethod
    def _generate_request_no(db: Session) -> str:
        today_prefix = system_now().strftime("PR-%Y%m%d")
        latest_request = (
            db.query(ProcurementRequest)
            .filter(ProcurementRequest.request_no.like(f"{today_prefix}-%"))
            .order_by(ProcurementRequest.request_no.desc())
            .first()
        )
        next_sequence = 1
        if latest_request and latest_request.request_no:
            try:
                next_sequence = int(latest_request.request_no.rsplit("-", 1)[-1]) + 1
            except (TypeError, ValueError):
                next_sequence = 1
        return f"{today_prefix}-{next_sequence:03d}"

    @staticmethod
    def _resolve_overall_urgency(items: List[Dict[str, Any]]) -> str:
        if not items:
            return "LOW"
        return sorted(
            (str(item.get("urgency_level") or "LOW") for item in items),
            key=lambda current: URGENCY_PRIORITY.get(current, 99),
        )[0]

    @staticmethod
    def _get_source_suggestions(
        db: Session,
        source_scope: str,
        order_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        normalized_scope = (source_scope or "GLOBAL").upper()
        if normalized_scope == "ORDER":
            if not order_id:
                raise ValueError("订单维度生成请购草稿时必须传入 order_id")
            result = MaterialPlanningService.get_order_procurement_suggestions(db, order_id)
            if not result:
                raise ValueError("制造订单不存在")
            return result
        return MaterialPlanningService.get_material_procurement_suggestions(db)

    @staticmethod
    def _build_default_title(source_scope: str, suggestion_result: Dict[str, Any]) -> str:
        normalized_scope = (source_scope or "GLOBAL").upper()
        order_number = suggestion_result.get("order_number")
        if normalized_scope == "ORDER" and order_number:
            return f"{order_number} 缺料请购草稿"
        return "制造缺料请购草稿"

    @staticmethod
    def create_from_suggestions(
        db: Session,
        current_user: User,
        source_scope: str = "GLOBAL",
        order_id: Optional[int] = None,
        material_codes: Optional[List[str]] = None,
        title: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> ProcurementRequest:
        suggestion_result = ProcurementRequestService._get_source_suggestions(db, source_scope, order_id)
        suggestion_items = list(suggestion_result.get("items") or [])

        selected_codes = {code.strip() for code in (material_codes or []) if code and code.strip()}
        if selected_codes:
            suggestion_items = [
                item
                for item in suggestion_items
                if str(item.get("material_code") or "").strip() in selected_codes
            ]

        if not suggestion_items:
            raise ValueError("当前没有可生成请购草稿的采购建议")

        normalized_scope = (source_scope or "GLOBAL").upper()
        request = ProcurementRequest(
            request_no=ProcurementRequestService._generate_request_no(db),
            title=(title or "").strip() or ProcurementRequestService._build_default_title(normalized_scope, suggestion_result),
            source_scope=normalized_scope,
            source_order_id=(
                int(suggestion_result.get("order_id") or order_id)
                if normalized_scope == "ORDER" and (suggestion_result.get("order_id") or order_id)
                else None
            ),
            status="DRAFT",
            urgency_level=ProcurementRequestService._resolve_overall_urgency(suggestion_items),
            total_items=len(suggestion_items),
            suggested_purchase_qty_total=round(
                sum(float(item.get("suggested_purchase_qty") or 0) for item in suggestion_items),
                4,
            ),
            requester_id=current_user.id,
            requester_name=(
                getattr(current_user, "full_name", None)
                or getattr(current_user, "username", None)
                or getattr(current_user, "email", None)
            ),
            notes=notes,
        )
        db.add(request)
        db.flush()

        for item in suggestion_items:
            db.add(
                ProcurementRequestItem(
                    request_id=request.id,
                    material_code=str(item.get("material_code") or "").strip(),
                    material_name=str(item.get("material_name") or "").strip(),
                    unit=str(item.get("unit") or "PCS"),
                    material_type=item.get("material_type"),
                    material_category=item.get("material_category"),
                    readiness_status=str(item.get("readiness_status") or ""),
                    shortage_reason=str(item.get("shortage_reason") or ""),
                    procurement_mode=str(item.get("procurement_mode") or ""),
                    suggested_action=str(item.get("suggested_action") or ""),
                    urgency_level=str(item.get("urgency_level") or "LOW"),
                    requested_qty=float(item.get("suggested_purchase_qty") or 0),
                    shortage_qty=float(item.get("shortage_qty") or 0),
                    shortage_with_safety_qty=float(item.get("shortage_with_safety_qty") or 0),
                    current_stock=float(item.get("current_stock") or 0),
                    reserved_stock=float(item.get("reserved_stock") or 0),
                    incoming_stock=float(item.get("incoming_stock") or 0),
                    net_available_qty=float(item.get("net_available_qty") or 0),
                    safety_stock=float(item.get("safety_stock") or 0),
                    lead_time_days=int(item.get("lead_time_days") or 0),
                    earliest_due_date=item.get("earliest_due_date"),
                    suggested_order_date=item.get("suggested_order_date"),
                    impacted_order_count=int(item.get("impacted_order_count") or 0),
                    impacted_orders=list(item.get("impacted_orders") or []),
                    planning_note=str(item.get("planning_note") or ""),
                )
            )

        db.commit()
        return ProcurementRequestService.get_request(db, request.id)

    @staticmethod
    def update_request(
        db: Session,
        request_id: int,
        payload: Dict[str, Any],
    ) -> Optional[ProcurementRequest]:
        request = db.query(ProcurementRequest).filter(ProcurementRequest.id == request_id).first()
        if not request:
            return None

        if "title" in payload:
            title = str(payload.get("title") or "").strip()
            if not title:
                raise ValueError("Procurement title is required")
            request.title = title

        if "source_scope" in payload and payload.get("source_scope"):
            request.source_scope = str(payload.get("source_scope")).upper()

        if "urgency_level" in payload and payload.get("urgency_level"):
            urgency_level = str(payload.get("urgency_level")).upper()
            if urgency_level not in VALID_URGENCY_LEVELS:
                raise ValueError("Procurement urgency level is invalid")
            request.urgency_level = urgency_level

        if "status" in payload and payload.get("status"):
            normalized_status = str(payload.get("status")).upper()
            if normalized_status not in VALID_PROCUREMENT_REQUEST_STATUSES:
                raise ValueError("Procurement status is invalid")
            request.status = normalized_status
            if normalized_status == "SUBMITTED" and request.submitted_at is None:
                request.submitted_at = system_now()
            if normalized_status in {"RECEIVED", "CANCELLED"}:
                request.completed_at = system_now()
            else:
                request.completed_at = None

        if "notes" in payload:
            notes = str(payload.get("notes") or "").strip()
            request.notes = notes or None

        if "requester_name" in payload:
            requester_name = str(payload.get("requester_name") or "").strip()
            request.requester_name = requester_name or None

        db.commit()
        return ProcurementRequestService.get_request(db, request_id)

    @staticmethod
    def replace_request_items(
        db: Session,
        request_id: int,
        items: List[Dict[str, Any]],
    ) -> Optional[ProcurementRequest]:
        request = db.query(ProcurementRequest).filter(ProcurementRequest.id == request_id).first()
        if not request:
            return None

        db.query(ProcurementRequestItem).filter(ProcurementRequestItem.request_id == request_id).delete()

        normalized_items: List[Dict[str, Any]] = []
        for item in items:
            material_code = str(item.get("material_code") or "").strip()
            material_name = str(item.get("material_name") or "").strip()
            if not material_code or not material_name:
                continue
            normalized_items.append(
                {
                    "material_code": material_code,
                    "material_name": material_name,
                    "unit": str(item.get("unit") or "PCS").strip() or "PCS",
                    "material_type": item.get("material_type"),
                    "material_category": item.get("material_category"),
                    "readiness_status": str(item.get("readiness_status") or "").strip() or None,
                    "shortage_reason": str(item.get("shortage_reason") or "").strip() or None,
                    "procurement_mode": str(item.get("procurement_mode") or "").strip() or None,
                    "suggested_action": str(item.get("suggested_action") or "").strip() or None,
                    "urgency_level": str(item.get("urgency_level") or "LOW").upper(),
                    "requested_qty": float(item.get("requested_qty") or 0),
                    "shortage_qty": float(item.get("shortage_qty") or 0),
                    "shortage_with_safety_qty": float(item.get("shortage_with_safety_qty") or 0),
                    "current_stock": float(item.get("current_stock") or 0),
                    "reserved_stock": float(item.get("reserved_stock") or 0),
                    "incoming_stock": float(item.get("incoming_stock") or 0),
                    "net_available_qty": float(item.get("net_available_qty") or 0),
                    "safety_stock": float(item.get("safety_stock") or 0),
                    "lead_time_days": int(item.get("lead_time_days") or 0),
                    "earliest_due_date": item.get("earliest_due_date"),
                    "suggested_order_date": item.get("suggested_order_date"),
                    "impacted_order_count": int(item.get("impacted_order_count") or 0),
                    "impacted_orders": list(item.get("impacted_orders") or []),
                    "planning_note": str(item.get("planning_note") or "").strip() or None,
                }
            )

        for item in normalized_items:
            db.add(ProcurementRequestItem(request_id=request_id, **item))

        request.total_items = len(normalized_items)
        request.suggested_purchase_qty_total = round(
            sum(float(item.get("requested_qty") or 0) for item in normalized_items),
            4,
        )
        request.urgency_level = (
            ProcurementRequestService._resolve_overall_urgency(normalized_items)
            if normalized_items
            else "LOW"
        )

        db.commit()
        return ProcurementRequestService.get_request(db, request_id)

    @staticmethod
    def get_request(db: Session, request_id: int) -> Optional[ProcurementRequest]:
        return (
            ProcurementRequestService._request_query(db)
            .filter(ProcurementRequest.id == request_id)
            .first()
        )

    @staticmethod
    def list_requests(
        db: Session,
        status: Optional[str] = None,
        order_id: Optional[int] = None,
    ) -> List[ProcurementRequest]:
        query = ProcurementRequestService._request_query(db)
        if status:
            query = query.filter(ProcurementRequest.status == status.upper())
        if order_id:
            query = query.filter(ProcurementRequest.source_order_id == order_id)
        return query.order_by(ProcurementRequest.created_at.desc(), ProcurementRequest.id.desc()).all()

    @staticmethod
    def update_status(
        db: Session,
        request_id: int,
        status: str,
    ) -> Optional[ProcurementRequest]:
        request = db.query(ProcurementRequest).filter(ProcurementRequest.id == request_id).first()
        if not request:
            return None

        normalized_status = (status or "").upper()
        if normalized_status not in VALID_PROCUREMENT_REQUEST_STATUSES:
            raise ValueError("请购状态不合法")

        current_status = request.status or "DRAFT"
        if normalized_status == current_status:
            return ProcurementRequestService.get_request(db, request_id)

        allowed_transitions = STATUS_TRANSITIONS.get(current_status, set())
        if normalized_status not in allowed_transitions:
            raise ValueError(f"当前状态不允许从 {current_status} 变更为 {normalized_status}")

        request.status = normalized_status
        if normalized_status == "SUBMITTED" and request.submitted_at is None:
            request.submitted_at = system_now()

        if normalized_status in {"RECEIVED", "CANCELLED"}:
            request.completed_at = system_now()
        else:
            request.completed_at = None

        db.commit()
        return ProcurementRequestService.get_request(db, request_id)
