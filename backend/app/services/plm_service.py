from collections import defaultdict
from typing import Any, Dict, List, Optional, Set

from sqlalchemy.orm import Session

from app.models.bom import BOMHeader, BOMItem, Material
from app.models.ecn import ECNHeader, ECNImpact


class PLMService:
    @staticmethod
    def get_materials(
        db: Session,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
    ) -> List[Material]:
        query = db.query(Material)
        if search:
            like_pattern = f"%{search}%"
            query = query.filter(
                Material.code.like(like_pattern) | Material.name.like(like_pattern)
            )
        return query.order_by(Material.code.asc()).offset(skip).limit(limit).all()

    @staticmethod
    def create_material(db: Session, data: dict) -> Material:
        material = Material(**data)
        db.add(material)
        db.commit()
        db.refresh(material)
        return material

    @staticmethod
    def update_material(db: Session, material_id: int, data: dict) -> Optional[Material]:
        material = db.query(Material).filter(Material.id == material_id).first()
        if not material:
            return None

        for key, value in data.items():
            setattr(material, key, value)

        db.commit()
        db.refresh(material)
        return material

    @staticmethod
    def get_boms(db: Session, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        headers = (
            db.query(BOMHeader)
            .order_by(BOMHeader.is_active.desc(), BOMHeader.id.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        product_codes = [header.product_code for header in headers if header.product_code]
        materials = (
            db.query(Material).filter(Material.code.in_(product_codes)).all()
            if product_codes
            else []
        )
        material_by_code = {material.code: material for material in materials}

        results: List[Dict[str, Any]] = []
        for header in headers:
            results.append(
                {
                    "id": header.id,
                    "product_code": header.product_code,
                    "version": header.version,
                    "bom_type": header.bom_type,
                    "status": header.status,
                    "description": header.description,
                    "is_active": header.is_active,
                    "material": material_by_code.get(header.product_code),
                }
            )
        return results

    @staticmethod
    def expand_bom(db: Session, bom_id: int) -> Optional[Dict[str, Any]]:
        header = db.query(BOMHeader).filter(BOMHeader.id == bom_id).first()
        if not header:
            return None

        items = db.query(BOMItem).filter(BOMItem.header_id == bom_id).all()
        codes: Set[str] = {header.product_code}
        for item in items:
            if item.parent_item_code:
                codes.add(item.parent_item_code)
            if item.child_item_code:
                codes.add(item.child_item_code)

        materials = db.query(Material).filter(Material.code.in_(list(codes))).all() if codes else []
        material_by_code = {material.code: material for material in materials}

        children_by_parent: Dict[str, List[BOMItem]] = defaultdict(list)
        root_key = header.product_code
        for item in items:
            parent_code = (item.parent_item_code or "").strip() or root_key
            children_by_parent[parent_code].append(item)

        def build_node(
            item_code: str,
            level: int,
            quantity: float,
            source_item: Optional[BOMItem],
            path: Set[str],
        ) -> Dict[str, Any]:
            material = material_by_code.get(item_code)
            node: Dict[str, Any] = {
                "id": source_item.id if source_item else header.id,
                "material_code": item_code,
                "material_name": material.name if material else item_code,
                "quantity": quantity,
                "unit": material.unit if material and material.unit else "PCS",
                "level": level,
                "children": [],
            }

            if item_code in path:
                return node

            next_path = set(path)
            next_path.add(item_code)
            children: List[Dict[str, Any]] = []
            for child_item in sorted(children_by_parent.get(item_code, []), key=lambda current: current.id):
                child_code = child_item.child_item_code
                child_quantity = float(child_item.quantity or 0)
                children.append(
                    build_node(
                        item_code=child_code,
                        level=level + 1,
                        quantity=child_quantity,
                        source_item=child_item,
                        path=next_path,
                    )
                )
            node["children"] = children
            return node

        return build_node(root_key, level=0, quantity=1.0, source_item=None, path=set())

    @staticmethod
    def create_ecn(db: Session, data: dict, impacts: List[dict]) -> ECNHeader:
        payload = {
            "ecn_no": data["ecn_no"],
            "change_type": data["change_type"],
            "reason": data.get("reason"),
            "description": data.get("description") or data.get("title"),
            "status": data.get("status", "DRAFT"),
            "creator_id": data.get("creator_id"),
        }
        ecn = ECNHeader(**payload)
        db.add(ecn)
        db.flush()

        for impact_data in impacts:
            impact = ECNImpact(
                ecn_header_id=ecn.id,
                impact_type=impact_data.get("impact_type"),
                impact_entity_id=str(impact_data.get("impact_entity_id", "")),
                change_detail=impact_data.get("change_detail", impact_data),
            )
            db.add(impact)

        db.commit()
        db.refresh(ecn)
        return ecn

    @staticmethod
    def approve_ecn(db: Session, ecn_id: int, user_id: int) -> Optional[ECNHeader]:
        ecn = db.query(ECNHeader).filter(ECNHeader.id == ecn_id).first()
        if not ecn:
            return None

        ecn.status = "APPROVED"
        ecn.approver_id = user_id
        db.commit()
        db.refresh(ecn)
        return ecn
