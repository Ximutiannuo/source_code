from collections import defaultdict
from datetime import datetime
from itertools import zip_longest
import re
from typing import Any, Dict, List, Optional, Set

from sqlalchemy.orm import Session

from app.models.bom import BOMHeader, BOMItem, Material
from app.models.drawing_document import DrawingDocument
from app.models.ecn import ECNHeader, ECNImpact


class PLMService:
    @staticmethod
    def _normalize_bom_items(product_code: str, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        normalized: List[Dict[str, Any]] = []
        for index, raw in enumerate(items, start=1):
            child_code = str(raw.get("child_item_code") or "").strip()
            if not child_code:
                continue
            parent_code = str(raw.get("parent_item_code") or product_code).strip() or product_code
            quantity = float(raw.get("quantity") or 0)
            unit_price = float(raw.get("unit_price") or 0)
            loss_rate = float(raw.get("loss_rate") or 0)
            total_price = raw.get("total_price")
            if total_price in (None, ""):
                total_price = quantity * unit_price * (1 + loss_rate)
            normalized.append(
                {
                    **raw,
                    "parent_item_code": parent_code,
                    "child_item_code": child_code,
                    "quantity": quantity,
                    "unit_price": unit_price,
                    "loss_rate": loss_rate,
                    "total_price": float(total_price or 0),
                    "find_number": raw.get("find_number") or f"{index:03d}",
                    "item_level": int(raw.get("item_level") or 0),
                }
            )

        children_by_parent: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for item in normalized:
            children_by_parent[item["parent_item_code"]].append(item)

        def assign_level(parent_code: str, level: int, lineage: Set[str]) -> None:
            for item in children_by_parent.get(parent_code, []):
                if item["item_level"] <= 0:
                    item["item_level"] = level
                lineage_key = f"{parent_code}>{item['child_item_code']}>{item['find_number']}"
                if lineage_key in lineage:
                    continue
                next_lineage = set(lineage)
                next_lineage.add(lineage_key)
                assign_level(item["child_item_code"], level + 1, next_lineage)

        assign_level(product_code, 1, set())
        for item in normalized:
            if item["item_level"] <= 0:
                item["item_level"] = 1

        return normalized

    @staticmethod
    def _serialize_drawing_link(document: Optional[DrawingDocument]) -> Optional[Dict[str, Any]]:
        if not document:
            return None
        return {
            "id": document.id,
            "document_number": document.document_number,
            "document_name": document.document_name,
            "document_type": document.document_type,
            "status": document.status,
            "version": document.version,
            "revision": document.revision,
            "material_code": document.material_code,
            "product_code": document.product_code,
        }

    @staticmethod
    def _version_tokens(value: Optional[str]) -> List[Any]:
        if not value:
            return []
        tokens: List[Any] = []
        for token in re.findall(r"\d+|[A-Za-z]+", str(value).upper()):
            tokens.append(int(token) if token.isdigit() else token)
        return tokens

    @staticmethod
    def _compare_version_values(left: Optional[str], right: Optional[str]) -> int:
        left_tokens = PLMService._version_tokens(left)
        right_tokens = PLMService._version_tokens(right)
        for left_token, right_token in zip_longest(left_tokens, right_tokens, fillvalue=None):
            if left_token is None:
                return -1
            if right_token is None:
                return 1
            if left_token == right_token:
                continue
            return 1 if left_token > right_token else -1
        return 0

    @staticmethod
    def _compare_drawing_versions(candidate: DrawingDocument, current: DrawingDocument) -> int:
        version_compare = PLMService._compare_version_values(candidate.version, current.version)
        if version_compare != 0:
            return version_compare
        return PLMService._compare_version_values(candidate.revision, current.revision)

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
    def get_boms(
        db: Session,
        skip: int = 0,
        limit: int = 100,
        bom_type: Optional[str] = None,
        source_system: Optional[str] = None,
        project_code: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        query = db.query(BOMHeader)
        if bom_type:
            query = query.filter(BOMHeader.bom_type == bom_type)
        if source_system:
            query = query.filter(BOMHeader.source_system == source_system)
        if project_code:
            query = query.filter(BOMHeader.project_code == project_code)

        headers = query.order_by(BOMHeader.is_active.desc(), BOMHeader.id.desc()).offset(skip).limit(limit).all()
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
                    "product_family": header.product_family,
                    "business_unit": header.business_unit,
                    "project_code": header.project_code,
                    "plant_code": header.plant_code,
                    "discipline": header.discipline,
                    "source_system": header.source_system,
                    "source_file": header.source_file,
                    "sync_status": header.sync_status,
                    "cad_document_no": header.cad_document_no,
                    "released_by": header.released_by,
                    "last_synced_at": header.last_synced_at,
                    "material": material_by_code.get(header.product_code),
                }
            )
        return results

    @staticmethod
    def get_bom_header(db: Session, bom_id: int) -> Optional[BOMHeader]:
        return db.query(BOMHeader).filter(BOMHeader.id == bom_id).first()

    @staticmethod
    def upsert_bom(db: Session, header_data: Dict[str, Any], items: List[Dict[str, Any]]) -> BOMHeader:
        header = None
        header_id = header_data.get("id")
        if header_id:
            header = db.query(BOMHeader).filter(BOMHeader.id == header_id).first()

        if header is None:
            header = (
                db.query(BOMHeader)
                .filter(
                    BOMHeader.product_code == header_data["product_code"],
                    BOMHeader.version == header_data.get("version", "v1.0"),
                    BOMHeader.bom_type == header_data.get("bom_type", "EBOM"),
                )
                .first()
            )

        if header is None:
            header = BOMHeader()
            db.add(header)

        for field in [
            "product_code",
            "version",
            "bom_type",
            "status",
            "description",
            "is_active",
            "effective_date",
            "expiry_date",
            "product_family",
            "business_unit",
            "project_code",
            "plant_code",
            "discipline",
            "source_system",
            "source_file",
            "sync_status",
            "cad_document_no",
            "released_by",
            "last_synced_at",
        ]:
            if field in header_data:
                setattr(header, field, header_data[field])

        if not header.version:
            header.version = "v1.0"
        if not header.bom_type:
            header.bom_type = "EBOM"
        if not header.status:
            header.status = "DRAFT"
        if header.is_active is None:
            header.is_active = True

        PLMService.upsert_material_by_code(
            db,
            code=header.product_code,
            payload={
                "name": header_data.get("product_name") or header.product_code,
                "category": header.product_family,
                "unit": header_data.get("unit") or "SET",
                "material_type": "FINISHED",
                "drawing_no": header.cad_document_no,
                "revision": header_data.get("revision") or "A",
            },
        )

        db.flush()

        if header.is_active:
            (
                db.query(BOMHeader)
                .filter(
                    BOMHeader.product_code == header.product_code,
                    BOMHeader.bom_type == header.bom_type,
                    BOMHeader.id != header.id,
                )
                .update({"is_active": False}, synchronize_session=False)
            )

        PLMService.replace_bom_items(db, header.id, PLMService._normalize_bom_items(header.product_code, items))
        db.commit()
        db.refresh(header)
        return header

    @staticmethod
    def replace_bom_items(db: Session, bom_id: int, items: List[Dict[str, Any]]) -> None:
        header = db.query(BOMHeader).filter(BOMHeader.id == bom_id).first()
        if not header:
            raise ValueError("BOM not found")

        existing_items = {
            item.id: item
            for item in db.query(BOMItem).filter(BOMItem.header_id == bom_id).all()
        }
        retained_ids: Set[int] = set()

        for index, item_data in enumerate(items, start=1):
            child_code = (item_data.get("child_item_code") or "").strip()
            if not child_code:
                continue

            quantity = float(item_data.get("quantity") or 0)
            unit_price = float(item_data.get("unit_price") or 0)
            loss_rate = float(item_data.get("loss_rate") or 0)
            total_price = item_data.get("total_price")
            if total_price in (None, ""):
                total_price = quantity * unit_price * (1 + loss_rate)

            item = None
            item_id = item_data.get("id")
            if item_id:
                item = existing_items.get(int(item_id))
                if item is not None:
                    retained_ids.add(item.id)

            previous_child_code = item.child_item_code if item is not None else None
            if item is None:
                item = BOMItem(header_id=bom_id)
                db.add(item)

            item.header_id = bom_id
            item.parent_item_code = (item_data.get("parent_item_code") or header.product_code).strip()
            item.child_item_code = child_code
            item.quantity = quantity
            item.component_type = item_data.get("component_type") or "NORMAL"
            item.routing_link = item_data.get("routing_link")
            item.find_number = item_data.get("find_number") or str(index)
            item.item_level = int(item_data.get("item_level") or 1)
            item.item_category = item_data.get("item_category")
            item.procurement_type = item_data.get("procurement_type")
            item.loss_rate = loss_rate
            item.unit_price = unit_price
            item.total_price = float(total_price or 0)
            item.source_reference = item_data.get("source_reference")
            if "drawing_document_id" in item_data:
                item.drawing_document_id = item_data.get("drawing_document_id")
            elif previous_child_code and previous_child_code != child_code:
                item.drawing_document_id = None
                item.drawing_mapping_status = "UNMAPPED"
                item.drawing_validation_message = "物料编码变更后已清除旧图纸映射"

            material_data = item_data.get("material") or {}
            if material_data.get("name") or item_data.get("material_name"):
                PLMService.upsert_material_by_code(
                    db,
                    code=child_code,
                    payload={
                        "name": material_data.get("name") or item_data.get("material_name") or child_code,
                        "specification": material_data.get("specification") or item_data.get("specification"),
                        "category": material_data.get("category") or item_data.get("item_category"),
                        "unit": material_data.get("unit") or item_data.get("unit") or "PCS",
                        "material_type": material_data.get("material_type") or item_data.get("procurement_type"),
                        "drawing_no": material_data.get("drawing_no") or item_data.get("drawing_no"),
                        "revision": material_data.get("revision") or item_data.get("revision") or "A",
                        },
                )

        for existing_id, existing_item in existing_items.items():
            if existing_id not in retained_ids:
                db.delete(existing_item)
        db.flush()

    @staticmethod
    def update_bom_items(db: Session, bom_id: int, items: List[Dict[str, Any]]) -> BOMHeader:
        header = db.query(BOMHeader).filter(BOMHeader.id == bom_id).first()
        if not header:
            raise ValueError("BOM not found")
        PLMService.replace_bom_items(db, bom_id, PLMService._normalize_bom_items(header.product_code, items))
        db.commit()
        return header

    @staticmethod
    def validate_bom_item_drawing_mappings(
        db: Session,
        bom_id: int,
        mappings: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        item_ids = [int(mapping["bom_item_id"]) for mapping in mappings if mapping.get("bom_item_id")]
        drawing_ids = [int(mapping["drawing_document_id"]) for mapping in mappings if mapping.get("drawing_document_id")]

        bom_items = (
            db.query(BOMItem)
            .filter(BOMItem.header_id == bom_id, BOMItem.id.in_(item_ids))
            .all()
            if item_ids
            else []
        )
        items_by_id = {item.id: item for item in bom_items}

        drawings = (
            db.query(DrawingDocument).filter(DrawingDocument.id.in_(drawing_ids)).all()
            if drawing_ids
            else []
        )
        drawings_by_id = {drawing.id: drawing for drawing in drawings}

        material_codes = {item.child_item_code for item in bom_items if item.child_item_code}
        materials = (
            db.query(Material).filter(Material.code.in_(list(material_codes))).all()
            if material_codes
            else []
        )
        materials_by_code = {material.code: material for material in materials}

        results: List[Dict[str, Any]] = []
        for mapping in mappings:
            bom_item_id = int(mapping["bom_item_id"])
            drawing_document_id = mapping.get("drawing_document_id")
            item = items_by_id.get(bom_item_id)

            if not item:
                results.append(
                    {
                        "bom_item_id": bom_item_id,
                        "child_item_code": None,
                        "find_number": None,
                        "validation_status": "ERROR",
                        "can_apply": False,
                        "message": "BOM明细行不存在",
                        "warnings": [],
                        "errors": ["BOM明细行不存在"],
                        "current_document": None,
                        "candidate_document": None,
                    }
                )
                continue

            current_document = item.drawing_document
            if not drawing_document_id:
                results.append(
                    {
                        "bom_item_id": bom_item_id,
                        "child_item_code": item.child_item_code,
                        "find_number": item.find_number,
                        "validation_status": "UNMAPPED",
                        "can_apply": True,
                        "message": "将清除当前图纸映射",
                        "warnings": [],
                        "errors": [],
                        "current_document": PLMService._serialize_drawing_link(current_document),
                        "candidate_document": None,
                    }
                )
                continue

            candidate_document = drawings_by_id.get(int(drawing_document_id))
            if not candidate_document:
                results.append(
                    {
                        "bom_item_id": bom_item_id,
                        "child_item_code": item.child_item_code,
                        "find_number": item.find_number,
                        "validation_status": "ERROR",
                        "can_apply": False,
                        "message": "候选图纸不存在",
                        "warnings": [],
                        "errors": ["候选图纸不存在"],
                        "current_document": PLMService._serialize_drawing_link(current_document),
                        "candidate_document": None,
                    }
                )
                continue

            warnings: List[str] = []
            errors: List[str] = []
            material = materials_by_code.get(item.child_item_code)

            if candidate_document.status == "ARCHIVED":
                errors.append("归档图纸不能作为当前映射")

            if current_document and current_document.id != candidate_document.id:
                if current_document.document_number == candidate_document.document_number:
                    version_compare = PLMService._compare_drawing_versions(candidate_document, current_document)
                    if version_compare < 0:
                        errors.append("候选图纸版本低于当前映射版本")
                    elif version_compare == 0:
                        warnings.append("候选图纸与当前映射版本一致，将覆盖当前引用")
                    else:
                        warnings.append("检测到高版本替换，将更新当前明细行图纸映射")
                else:
                    warnings.append(
                        f"当前图号 {current_document.document_number} 将被 {candidate_document.document_number} 替换"
                    )

            if material and material.drawing_no and candidate_document.document_number != material.drawing_no:
                warnings.append(f"候选图号与物料图号 {material.drawing_no} 不一致")

            if candidate_document.material_code and candidate_document.material_code != item.child_item_code:
                warnings.append(
                    f"候选图纸关联物料 {candidate_document.material_code} 与明细物料 {item.child_item_code} 不一致"
                )

            if candidate_document.bom_header_id and candidate_document.bom_header_id != bom_id:
                warnings.append("候选图纸当前关联到其他BOM版本")

            validation_status = "ERROR" if errors else "WARNING" if warnings else "VALID"
            message = errors[0] if errors else warnings[0] if warnings else "图纸映射校验通过"
            results.append(
                {
                    "bom_item_id": bom_item_id,
                    "child_item_code": item.child_item_code,
                    "find_number": item.find_number,
                    "validation_status": validation_status,
                    "can_apply": not errors,
                    "message": message,
                    "warnings": warnings,
                    "errors": errors,
                    "current_document": PLMService._serialize_drawing_link(current_document),
                    "candidate_document": PLMService._serialize_drawing_link(candidate_document),
                }
            )

        return {"updated": 0, "results": results}

    @staticmethod
    def apply_bom_item_drawing_mappings(
        db: Session,
        bom_id: int,
        mappings: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        validation = PLMService.validate_bom_item_drawing_mappings(db, bom_id, mappings)
        result_by_item_id = {result["bom_item_id"]: result for result in validation["results"]}

        if any(not result["can_apply"] for result in validation["results"]):
            return validation

        item_ids = [int(mapping["bom_item_id"]) for mapping in mappings if mapping.get("bom_item_id")]
        bom_items = (
            db.query(BOMItem)
            .filter(BOMItem.header_id == bom_id, BOMItem.id.in_(item_ids))
            .all()
            if item_ids
            else []
        )
        items_by_id = {item.id: item for item in bom_items}

        updated = 0
        for mapping in mappings:
            bom_item_id = int(mapping["bom_item_id"])
            item = items_by_id.get(bom_item_id)
            if not item:
                continue
            result = result_by_item_id.get(bom_item_id)
            item.drawing_document_id = mapping.get("drawing_document_id") or None
            item.drawing_mapping_status = result["validation_status"]
            item.drawing_validation_message = result["message"]
            updated += 1

        db.commit()
        validation["updated"] = updated
        return validation

    @staticmethod
    def upsert_material_by_code(db: Session, code: str, payload: Dict[str, Any]) -> Material:
        material = db.query(Material).filter(Material.code == code).first()
        if material is None:
            material = Material(code=code, name=payload.get("name") or code)
            db.add(material)
        for field in [
            "name",
            "specification",
            "category",
            "unit",
            "material_type",
            "drawing_no",
            "revision",
            "description",
        ]:
            value = payload.get(field)
            if value not in (None, ""):
                setattr(material, field, value)
        db.flush()
        return material

    @staticmethod
    def sync_bom_from_cad(db: Session, payload: Dict[str, Any], operator_name: Optional[str] = None) -> BOMHeader:
        header_data = {
            "product_code": payload["product_code"],
            "version": payload.get("version") or payload.get("revision") or "v1.0",
            "bom_type": payload.get("bom_type") or "EBOM",
            "status": payload.get("status") or "DRAFT",
            "description": payload.get("description"),
            "is_active": payload.get("is_active", True),
            "product_family": payload.get("product_family"),
            "business_unit": payload.get("business_unit"),
            "project_code": payload.get("project_code"),
            "plant_code": payload.get("plant_code"),
            "discipline": payload.get("discipline"),
            "source_system": payload.get("source_system") or "CAD",
            "source_file": payload.get("source_file"),
            "sync_status": "SYNCED",
            "cad_document_no": payload.get("cad_document_no"),
            "released_by": operator_name,
            "last_synced_at": datetime.utcnow(),
        }

        PLMService.upsert_material_by_code(
            db,
            code=header_data["product_code"],
            payload={
                "name": payload.get("product_name") or header_data["product_code"],
                "category": payload.get("product_family"),
                "unit": payload.get("unit") or "SET",
                "material_type": "FINISHED",
                "drawing_no": payload.get("cad_document_no"),
                "revision": payload.get("revision") or "A",
            },
        )

        return PLMService.upsert_bom(db, header_data, payload.get("items", []))

    @staticmethod
    def get_bom_detail(db: Session, bom_id: int) -> Optional[Dict[str, Any]]:
        header = db.query(BOMHeader).filter(BOMHeader.id == bom_id).first()
        if not header:
            return None

        items = (
            db.query(BOMItem)
            .filter(BOMItem.header_id == bom_id)
            .order_by(BOMItem.item_level.asc(), BOMItem.find_number.asc(), BOMItem.id.asc())
            .all()
        )
        codes: Set[str] = {header.product_code}
        for item in items:
            if item.child_item_code:
                codes.add(item.child_item_code)
            if item.parent_item_code:
                codes.add(item.parent_item_code)

        materials = db.query(Material).filter(Material.code.in_(list(codes))).all() if codes else []
        material_by_code = {material.code: material for material in materials}
        drawing_document_ids = {item.drawing_document_id for item in items if item.drawing_document_id}
        drawing_documents = (
            db.query(DrawingDocument).filter(DrawingDocument.id.in_(list(drawing_document_ids))).all()
            if drawing_document_ids
            else []
        )
        drawing_by_id = {drawing.id: drawing for drawing in drawing_documents}
        total_cost = 0.0
        item_rows: List[Dict[str, Any]] = []
        for item in items:
            line_total = float(item.total_price or 0)
            total_cost += line_total
            item_rows.append(
                {
                    "id": item.id,
                    "parent_item_code": item.parent_item_code or header.product_code,
                    "child_item_code": item.child_item_code,
                    "quantity": float(item.quantity or 0),
                    "component_type": item.component_type,
                    "routing_link": item.routing_link,
                    "find_number": item.find_number,
                    "item_level": int(item.item_level or 1),
                    "item_category": item.item_category,
                    "procurement_type": item.procurement_type,
                    "loss_rate": float(item.loss_rate or 0),
                    "unit_price": float(item.unit_price or 0),
                    "total_price": line_total,
                    "source_reference": item.source_reference,
                    "drawing_document_id": item.drawing_document_id,
                    "drawing_mapping_status": item.drawing_mapping_status or ("VALID" if item.drawing_document_id else "UNMAPPED"),
                    "drawing_validation_message": item.drawing_validation_message,
                    "drawing_document": drawing_by_id.get(item.drawing_document_id),
                    "material": material_by_code.get(item.child_item_code),
                }
            )

        return {
            "id": header.id,
            "product_code": header.product_code,
            "version": header.version,
            "bom_type": header.bom_type,
            "status": header.status,
            "description": header.description,
            "is_active": header.is_active,
            "product_family": header.product_family,
            "business_unit": header.business_unit,
            "project_code": header.project_code,
            "plant_code": header.plant_code,
            "discipline": header.discipline,
            "source_system": header.source_system,
            "source_file": header.source_file,
            "sync_status": header.sync_status,
            "cad_document_no": header.cad_document_no,
            "released_by": header.released_by,
            "last_synced_at": header.last_synced_at,
            "material": material_by_code.get(header.product_code),
            "items": item_rows,
            "statistics": {
                "item_count": len(item_rows),
                "leaf_count": len({item["child_item_code"] for item in item_rows} - {item["parent_item_code"] for item in item_rows}),
                "estimated_total_cost": round(total_cost, 2),
            },
        }

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
                "find_number": source_item.find_number if source_item else None,
                "component_type": source_item.component_type if source_item else None,
                "routing_link": source_item.routing_link if source_item else None,
                "item_category": source_item.item_category if source_item else None,
                "procurement_type": source_item.procurement_type if source_item else None,
                "loss_rate": float(source_item.loss_rate or 0) if source_item else 0,
                "unit_price": float(source_item.unit_price or 0) if source_item else 0,
                "total_price": float(source_item.total_price or 0) if source_item else 0,
                "source_reference": source_item.source_reference if source_item else None,
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
