from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy.orm import Session

from app.models.bom import BOMHeader, BOMItem, Material
from app.models.order import ManufacturingOrder


class MaterialPlanningService:
    OPEN_ORDER_STATUSES = {"PLANNED", "RELEASED", "IN_PROGRESS", "QC"}

    @staticmethod
    def _to_float(value: Optional[object]) -> float:
        if value is None:
            return 0.0
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0.0

    @staticmethod
    def _load_bom_context(
        db: Session,
        bom_id: int,
    ) -> Tuple[Optional[BOMHeader], Dict[str, List[BOMItem]]]:
        header = db.query(BOMHeader).filter(BOMHeader.id == bom_id).first()
        if not header:
            return None, {}

        items = db.query(BOMItem).filter(BOMItem.header_id == bom_id).all()
        children_by_parent: Dict[str, List[BOMItem]] = defaultdict(list)
        root_key = (header.product_code or "").strip()

        for item in items:
            parent_code = (item.parent_item_code or "").strip() or root_key
            if not item.child_item_code:
                continue
            children_by_parent[parent_code].append(item)

        return header, children_by_parent

    @staticmethod
    def _explode_bom_requirements(
        children_by_parent: Dict[str, List[BOMItem]],
        root_code: str,
        quantity: float,
    ) -> Dict[str, float]:
        demand_by_code: Dict[str, float] = defaultdict(float)

        def walk(parent_code: str, parent_multiplier: float, path: Set[str]) -> None:
            if parent_code in path:
                return

            next_path = set(path)
            next_path.add(parent_code)
            for item in children_by_parent.get(parent_code, []):
                child_code = (item.child_item_code or "").strip()
                if not child_code:
                    continue

                child_quantity = max(MaterialPlanningService._to_float(item.quantity), 0.0)
                required_qty = parent_multiplier * child_quantity
                if required_qty <= 0:
                    continue

                demand_by_code[child_code] += required_qty
                walk(child_code, required_qty, next_path)

        walk(root_code, max(quantity, 0.0), set())
        return dict(demand_by_code)

    @staticmethod
    def _build_readiness_item(
        material_code: str,
        required_qty: float,
        material: Optional[Material],
        impacted_orders: Optional[Set[str]] = None,
    ) -> Dict[str, Any]:
        required_qty = round(max(required_qty, 0.0), 4)
        impacted_orders = impacted_orders or set()

        if not material:
            return {
                "material_code": material_code,
                "material_name": material_code,
                "unit": "PCS",
                "material_type": None,
                "material_category": None,
                "lead_time_days": 0,
                "required_qty": required_qty,
                "current_stock": 0.0,
                "reserved_stock": 0.0,
                "incoming_stock": 0.0,
                "available_qty": 0.0,
                "net_available_qty": 0.0,
                "safety_stock": 0.0,
                "shortage_qty": required_qty,
                "shortage_with_safety_qty": required_qty,
                "readiness_status": "MISSING",
                "shortage_reason": "主数据缺失",
                "impacted_order_count": len(impacted_orders),
                "impacted_orders": sorted(list(impacted_orders)),
            }

        current_stock = MaterialPlanningService._to_float(material.current_stock)
        reserved_stock = MaterialPlanningService._to_float(material.reserved_stock)
        incoming_stock = MaterialPlanningService._to_float(material.incoming_stock)
        safety_stock = MaterialPlanningService._to_float(material.safety_stock)
        available_qty = max(0.0, current_stock - reserved_stock)
        net_available_qty = available_qty + incoming_stock
        shortage_qty = max(0.0, required_qty - net_available_qty)
        shortage_with_safety_qty = max(0.0, required_qty + safety_stock - net_available_qty)

        if shortage_qty > 0:
            readiness_status = "SHORT"
            shortage_reason = "采购在途" if incoming_stock > 0 else "待采购"
        elif shortage_with_safety_qty > 0:
            readiness_status = "RISK"
            shortage_reason = "低于安全库存"
        else:
            readiness_status = "READY"
            shortage_reason = "齐套"

        return {
            "material_code": material.code,
            "material_name": material.name,
            "unit": material.unit or "PCS",
            "material_type": material.material_type,
            "material_category": material.category,
            "lead_time_days": int(material.lead_time_days or 0),
            "required_qty": required_qty,
            "current_stock": round(current_stock, 4),
            "reserved_stock": round(reserved_stock, 4),
            "incoming_stock": round(incoming_stock, 4),
            "available_qty": round(available_qty, 4),
            "net_available_qty": round(net_available_qty, 4),
            "safety_stock": round(safety_stock, 4),
            "shortage_qty": round(shortage_qty, 4),
            "shortage_with_safety_qty": round(shortage_with_safety_qty, 4),
            "readiness_status": readiness_status,
            "shortage_reason": shortage_reason,
            "impacted_order_count": len(impacted_orders),
            "impacted_orders": sorted(list(impacted_orders)),
        }

    @staticmethod
    def _empty_order_readiness(order: ManufacturingOrder) -> Dict[str, Any]:
        return {
            "order_id": order.id,
            "order_number": order.order_number,
            "bom_id": order.bom_id,
            "bom_version": None,
            "kit_status": "BOM_PENDING",
            "required_items_total": 0,
            "ready_items": 0,
            "risk_items": 0,
            "short_items": 0,
            "shortage_qty_total": 0.0,
            "kit_rate": 0.0,
            "items": [],
        }

    @staticmethod
    def _get_open_orders(db: Session) -> List[ManufacturingOrder]:
        return (
            db.query(ManufacturingOrder)
            .filter(ManufacturingOrder.status.in_(list(MaterialPlanningService.OPEN_ORDER_STATUSES)))
            .all()
        )

    @staticmethod
    def _aggregate_open_order_demands(
        db: Session,
        orders: List[ManufacturingOrder],
    ) -> Dict[str, Any]:
        aggregated_demand: Dict[str, float] = defaultdict(float)
        impacted_orders_by_material: Dict[str, Set[str]] = defaultdict(set)
        earliest_due_by_material: Dict[str, datetime] = {}
        orders_without_bom = 0

        for order in orders:
            if not order.bom_id:
                orders_without_bom += 1
                continue

            header, children_by_parent = MaterialPlanningService._load_bom_context(db, order.bom_id)
            if not header:
                orders_without_bom += 1
                continue

            demand_by_code = MaterialPlanningService._explode_bom_requirements(
                children_by_parent=children_by_parent,
                root_code=(header.product_code or "").strip(),
                quantity=MaterialPlanningService._to_float(order.quantity),
            )
            for material_code, required_qty in demand_by_code.items():
                aggregated_demand[material_code] += required_qty
                impacted_orders_by_material[material_code].add(order.order_number)
                if order.due_date:
                    current_due_date = earliest_due_by_material.get(material_code)
                    if current_due_date is None or order.due_date < current_due_date:
                        earliest_due_by_material[material_code] = order.due_date

        return {
            "aggregated_demand": aggregated_demand,
            "impacted_orders_by_material": impacted_orders_by_material,
            "earliest_due_by_material": earliest_due_by_material,
            "orders_without_bom": orders_without_bom,
        }

    @staticmethod
    def _resolve_procurement_mode(item: Dict[str, Any]) -> str:
        category = (item.get("material_category") or "").strip()
        material_type = (item.get("material_type") or "").strip().upper()

        if category == "标准件" or material_type == "STD":
            return "标准件拉动补货"
        if category == "原材料" or material_type == "RAW":
            return "原材备料"
        if category == "外购件":
            return "按单请购"
        if material_type == "SUB":
            return "外协跟催"
        if category == "自制件" or material_type in {"PART", "FINISHED"}:
            return "自制外协协同"
        return "按需采购"

    @staticmethod
    def _resolve_procurement_action(item: Dict[str, Any]) -> Tuple[str, str]:
        status = item.get("readiness_status")
        incoming_stock = MaterialPlanningService._to_float(item.get("incoming_stock"))
        procurement_mode = MaterialPlanningService._resolve_procurement_mode(item)

        if status == "MISSING":
            return "补主数据", "请先补齐物料主数据或 BOM 映射关系，再触发请购。"
        if status == "SHORT":
            if procurement_mode == "外协跟催":
                return "外协催交", "外协件齐套不足，需立即跟催协作单位排产与交期。"
            if incoming_stock > 0:
                return "催交在途", "已有在途但仍无法满足需求，建议采购跟催并确认到货批次。"
            return "发起请购", "净可用库存不足，建议按缺口数量立即发起请购。"
        if status == "RISK":
            return "补安全库存", "当前可支撑订单，但已跌破安全库存，建议提前补货。"
        return "无需动作", "当前物料已齐套。"

    @staticmethod
    def _resolve_urgency_level(
        readiness_status: str,
        earliest_due_date: Optional[datetime],
        lead_time_days: int,
    ) -> str:
        if readiness_status == "READY":
            return "LOW"
        if earliest_due_date is None:
            return "HIGH" if readiness_status in {"SHORT", "MISSING"} else "MEDIUM"

        days_to_due = (earliest_due_date.date() - date.today()).days
        if readiness_status in {"SHORT", "MISSING"}:
            if days_to_due <= max(0, lead_time_days):
                return "URGENT"
            if days_to_due <= max(3, lead_time_days + 3):
                return "HIGH"
            return "MEDIUM"

        if days_to_due <= max(7, lead_time_days):
            return "HIGH"
        return "MEDIUM"

    @staticmethod
    def _build_procurement_suggestion(
        item: Dict[str, Any],
        earliest_due_date: Optional[datetime],
    ) -> Optional[Dict[str, Any]]:
        readiness_status = item.get("readiness_status")
        if readiness_status == "READY":
            return None

        action, planning_note = MaterialPlanningService._resolve_procurement_action(item)
        procurement_mode = MaterialPlanningService._resolve_procurement_mode(item)
        lead_time_days = int(item.get("lead_time_days") or 0)
        suggested_purchase_qty = MaterialPlanningService._to_float(item.get("shortage_with_safety_qty"))
        if suggested_purchase_qty <= 0:
            suggested_purchase_qty = MaterialPlanningService._to_float(item.get("shortage_qty"))

        suggested_order_date = (
            earliest_due_date - timedelta(days=lead_time_days)
            if earliest_due_date is not None
            else None
        )
        urgency_level = MaterialPlanningService._resolve_urgency_level(
            readiness_status=readiness_status,
            earliest_due_date=earliest_due_date,
            lead_time_days=lead_time_days,
        )

        return {
            "material_code": item.get("material_code"),
            "material_name": item.get("material_name"),
            "unit": item.get("unit") or "PCS",
            "material_type": item.get("material_type"),
            "material_category": item.get("material_category"),
            "readiness_status": readiness_status,
            "shortage_reason": item.get("shortage_reason"),
            "procurement_mode": procurement_mode,
            "suggested_action": action,
            "suggested_purchase_qty": round(suggested_purchase_qty, 4),
            "shortage_qty": round(MaterialPlanningService._to_float(item.get("shortage_qty")), 4),
            "shortage_with_safety_qty": round(
                MaterialPlanningService._to_float(item.get("shortage_with_safety_qty")),
                4,
            ),
            "current_stock": round(MaterialPlanningService._to_float(item.get("current_stock")), 4),
            "reserved_stock": round(MaterialPlanningService._to_float(item.get("reserved_stock")), 4),
            "incoming_stock": round(MaterialPlanningService._to_float(item.get("incoming_stock")), 4),
            "net_available_qty": round(MaterialPlanningService._to_float(item.get("net_available_qty")), 4),
            "safety_stock": round(MaterialPlanningService._to_float(item.get("safety_stock")), 4),
            "lead_time_days": lead_time_days,
            "earliest_due_date": earliest_due_date,
            "suggested_order_date": suggested_order_date,
            "urgency_level": urgency_level,
            "planning_note": planning_note,
            "impacted_order_count": int(item.get("impacted_order_count") or 0),
            "impacted_orders": list(item.get("impacted_orders") or []),
        }

    @staticmethod
    def _summarize_procurement_suggestions(
        items: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        urgent_items = sum(1 for item in items if item["urgency_level"] == "URGENT")
        high_items = sum(1 for item in items if item["urgency_level"] == "HIGH")
        to_purchase_items = sum(1 for item in items if item["suggested_action"] == "发起请购")
        to_expedite_items = sum(1 for item in items if item["suggested_action"] in {"催交在途", "外协催交"})
        master_data_gap_items = sum(1 for item in items if item["suggested_action"] == "补主数据")
        replenish_items = sum(1 for item in items if item["suggested_action"] == "补安全库存")
        suggested_purchase_qty_total = round(
            sum(MaterialPlanningService._to_float(item["suggested_purchase_qty"]) for item in items),
            4,
        )
        impacted_orders = sorted(
            {
                order_number
                for item in items
                for order_number in item.get("impacted_orders", [])
            }
        )

        return {
            "items_total": len(items),
            "urgent_items": urgent_items,
            "high_items": high_items,
            "to_purchase_items": to_purchase_items,
            "to_expedite_items": to_expedite_items,
            "master_data_gap_items": master_data_gap_items,
            "replenish_items": replenish_items,
            "suggested_purchase_qty_total": suggested_purchase_qty_total,
            "impacted_orders": len(impacted_orders),
        }

    @staticmethod
    def _calculate_order_readiness(
        db: Session,
        order: ManufacturingOrder,
    ) -> Dict[str, Any]:
        bom = order.bom or (db.query(BOMHeader).filter(BOMHeader.id == order.bom_id).first() if order.bom_id else None)
        if not bom:
            return MaterialPlanningService._empty_order_readiness(order)

        header, children_by_parent = MaterialPlanningService._load_bom_context(db, bom.id)
        if not header:
            return MaterialPlanningService._empty_order_readiness(order)

        demand_by_code = MaterialPlanningService._explode_bom_requirements(
            children_by_parent=children_by_parent,
            root_code=(header.product_code or "").strip(),
            quantity=MaterialPlanningService._to_float(order.quantity),
        )
        if not demand_by_code:
            return {
                "order_id": order.id,
                "order_number": order.order_number,
                "bom_id": bom.id,
                "bom_version": bom.version,
                "kit_status": "KIT_READY",
                "required_items_total": 0,
                "ready_items": 0,
                "risk_items": 0,
                "short_items": 0,
                "shortage_qty_total": 0.0,
                "kit_rate": 1.0,
                "items": [],
            }

        materials = db.query(Material).filter(Material.code.in_(list(demand_by_code.keys()))).all()
        material_by_code = {material.code: material for material in materials}

        items: List[Dict[str, Any]] = []
        ready_items = 0
        risk_items = 0
        short_items = 0
        shortage_qty_total = 0.0

        for material_code in sorted(demand_by_code.keys()):
            item = MaterialPlanningService._build_readiness_item(
                material_code=material_code,
                required_qty=demand_by_code[material_code],
                material=material_by_code.get(material_code),
                impacted_orders={order.order_number},
            )
            items.append(item)

            if item["readiness_status"] == "READY":
                ready_items += 1
            elif item["readiness_status"] == "RISK":
                risk_items += 1
            else:
                short_items += 1

            shortage_qty_total += item["shortage_qty"]

        if short_items > 0:
            kit_status = "KIT_SHORT"
        elif risk_items > 0:
            kit_status = "KIT_RISK"
        else:
            kit_status = "KIT_READY"

        required_items_total = len(items)
        kit_rate = (ready_items / required_items_total) if required_items_total > 0 else 1.0

        return {
            "order_id": order.id,
            "order_number": order.order_number,
            "bom_id": bom.id,
            "bom_version": bom.version,
            "kit_status": kit_status,
            "required_items_total": required_items_total,
            "ready_items": ready_items,
            "risk_items": risk_items,
            "short_items": short_items,
            "shortage_qty_total": round(shortage_qty_total, 4),
            "kit_rate": round(kit_rate, 4),
            "items": items,
        }

    @staticmethod
    def get_order_material_readiness(db: Session, order_id: int) -> Optional[Dict[str, Any]]:
        order = db.query(ManufacturingOrder).filter(ManufacturingOrder.id == order_id).first()
        if not order:
            return None
        return MaterialPlanningService._calculate_order_readiness(db, order)

    @staticmethod
    def get_material_planning_summary(db: Session) -> Dict[str, Any]:
        orders = MaterialPlanningService._get_open_orders(db)
        aggregate_result = MaterialPlanningService._aggregate_open_order_demands(db, orders)
        aggregated_demand = aggregate_result["aggregated_demand"]
        impacted_orders_by_material = aggregate_result["impacted_orders_by_material"]
        orders_without_bom = aggregate_result["orders_without_bom"]

        materials = (
            db.query(Material).filter(Material.code.in_(list(aggregated_demand.keys()))).all()
            if aggregated_demand
            else []
        )
        material_by_code = {material.code: material for material in materials}

        items: List[Dict[str, Any]] = []
        ready_materials = 0
        risk_materials = 0
        short_materials = 0
        shortage_qty_total = 0.0
        impacted_orders: Set[str] = set()

        for material_code in sorted(aggregated_demand.keys()):
            item = MaterialPlanningService._build_readiness_item(
                material_code=material_code,
                required_qty=aggregated_demand[material_code],
                material=material_by_code.get(material_code),
                impacted_orders=impacted_orders_by_material.get(material_code, set()),
            )
            items.append(item)

            if item["readiness_status"] == "READY":
                ready_materials += 1
            elif item["readiness_status"] == "RISK":
                risk_materials += 1
                impacted_orders.update(item["impacted_orders"])
            else:
                short_materials += 1
                impacted_orders.update(item["impacted_orders"])

            shortage_qty_total += item["shortage_qty"]

        return {
            "orders_considered": len(orders),
            "orders_without_bom": orders_without_bom,
            "materials_total": len(items),
            "ready_materials": ready_materials,
            "risk_materials": risk_materials,
            "short_materials": short_materials,
            "shortage_qty_total": round(shortage_qty_total, 4),
            "impacted_orders": len(impacted_orders),
            "items": items,
        }

    @staticmethod
    def get_material_procurement_suggestions(db: Session) -> Dict[str, Any]:
        orders = MaterialPlanningService._get_open_orders(db)
        planning_summary = MaterialPlanningService.get_material_planning_summary(db)
        aggregate_result = MaterialPlanningService._aggregate_open_order_demands(db, orders)
        earliest_due_by_material = aggregate_result["earliest_due_by_material"]

        items: List[Dict[str, Any]] = []
        for item in planning_summary["items"]:
            suggestion = MaterialPlanningService._build_procurement_suggestion(
                item=item,
                earliest_due_date=earliest_due_by_material.get(item["material_code"]),
            )
            if suggestion:
                items.append(suggestion)

        items.sort(
            key=lambda current: (
                {"URGENT": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}.get(current["urgency_level"], 9),
                current["earliest_due_date"].timestamp() if current["earliest_due_date"] else float("inf"),
                current["material_code"],
            )
        )
        summary = MaterialPlanningService._summarize_procurement_suggestions(items)
        summary.update(
            {
                "orders_considered": len(orders),
                "orders_without_bom": planning_summary["orders_without_bom"],
                "items": items,
            }
        )
        return summary

    @staticmethod
    def get_order_procurement_suggestions(db: Session, order_id: int) -> Optional[Dict[str, Any]]:
        order = db.query(ManufacturingOrder).filter(ManufacturingOrder.id == order_id).first()
        if not order:
            return None

        readiness = MaterialPlanningService._calculate_order_readiness(db, order)
        items: List[Dict[str, Any]] = []
        for item in readiness["items"]:
            suggestion = MaterialPlanningService._build_procurement_suggestion(
                item=item,
                earliest_due_date=order.due_date,
            )
            if suggestion:
                items.append(suggestion)

        items.sort(
            key=lambda current: (
                {"URGENT": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}.get(current["urgency_level"], 9),
                current["material_code"],
            )
        )
        summary = MaterialPlanningService._summarize_procurement_suggestions(items)
        summary.update(
            {
                "order_id": order.id,
                "order_number": order.order_number,
                "kit_status": readiness["kit_status"],
                "items": items,
            }
        )
        return summary
