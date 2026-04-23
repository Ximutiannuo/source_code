from datetime import datetime
from pathlib import Path
import sys


CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database import SessionLocal, Base, get_default_engine
from app.models.bom import BOMHeader, BOMItem, Material


MATERIALS = [
    {
        "code": "ASM-1001",
        "name": "伺服传动组件",
        "specification": "STD-DRIVE-01",
        "category": "成品",
        "unit": "SET",
        "safety_stock": 2,
        "current_stock": 1,
        "reserved_stock": 0,
        "incoming_stock": 1,
        "lead_time_days": 15,
        "drawing_no": "DWG-ASM-1001",
        "revision": "B",
        "material_type": "FINISHED",
        "description": "用于包装设备的非标伺服传动组件样例。",
    },
    {
        "code": "SUB-2100",
        "name": "传动子装配",
        "specification": "SUB-DRIVE-2100",
        "category": "半成品",
        "unit": "SET",
        "safety_stock": 1,
        "current_stock": 0,
        "reserved_stock": 0,
        "incoming_stock": 0,
        "lead_time_days": 7,
        "drawing_no": "DWG-SUB-2100",
        "revision": "B",
        "material_type": "SUB",
        "description": "包含壳体、主轴、轴承和联轴器的关键子装配。",
    },
    {
        "code": "CAS-3100",
        "name": "铸铝壳体",
        "specification": "AL-356-T6",
        "category": "自制件",
        "unit": "PCS",
        "safety_stock": 4,
        "current_stock": 6,
        "reserved_stock": 1,
        "incoming_stock": 2,
        "lead_time_days": 10,
        "drawing_no": "DWG-CAS-3100",
        "revision": "A",
        "material_type": "RAW",
        "description": "机加工后作为传动组件主壳体使用。",
    },
    {
        "code": "SHA-3200",
        "name": "主轴",
        "specification": "40Cr φ28x286",
        "category": "自制件",
        "unit": "PCS",
        "safety_stock": 5,
        "current_stock": 8,
        "reserved_stock": 0,
        "incoming_stock": 0,
        "lead_time_days": 5,
        "drawing_no": "DWG-SHA-3200",
        "revision": "B",
        "material_type": "RAW",
        "description": "传动总成主轴，需热处理和磨削。",
    },
    {
        "code": "BRG-6204",
        "name": "深沟球轴承 6204",
        "specification": "6204-2RS",
        "category": "标准件",
        "unit": "PCS",
        "safety_stock": 20,
        "current_stock": 40,
        "reserved_stock": 6,
        "incoming_stock": 10,
        "lead_time_days": 3,
        "drawing_no": "STD-6204-2RS",
        "revision": "A",
        "material_type": "STD",
        "description": "早期版本使用的标准轴承。",
    },
    {
        "code": "BRG-6205",
        "name": "深沟球轴承 6205",
        "specification": "6205-2RS",
        "category": "标准件",
        "unit": "PCS",
        "safety_stock": 20,
        "current_stock": 28,
        "reserved_stock": 2,
        "incoming_stock": 8,
        "lead_time_days": 3,
        "drawing_no": "STD-6205-2RS",
        "revision": "A",
        "material_type": "STD",
        "description": "优化承载能力后切换到 6205 规格。",
    },
    {
        "code": "CPL-3300",
        "name": "弹性联轴器",
        "specification": "D28-L35",
        "category": "标准件",
        "unit": "PCS",
        "safety_stock": 8,
        "current_stock": 10,
        "reserved_stock": 1,
        "incoming_stock": 4,
        "lead_time_days": 4,
        "drawing_no": "STD-CPL-3300",
        "revision": "A",
        "material_type": "STD",
        "description": "用于电机和主轴的柔性连接。",
    },
    {
        "code": "FLT-3400",
        "name": "安装法兰",
        "specification": "Q235B t12",
        "category": "自制件",
        "unit": "PCS",
        "safety_stock": 6,
        "current_stock": 5,
        "reserved_stock": 0,
        "incoming_stock": 3,
        "lead_time_days": 4,
        "drawing_no": "DWG-FLT-3400",
        "revision": "A",
        "material_type": "RAW",
        "description": "用于与设备主机台连接的安装法兰。",
    },
    {
        "code": "MTR-4000",
        "name": "750W 伺服电机",
        "specification": "AC750W-220V",
        "category": "外购件",
        "unit": "PCS",
        "safety_stock": 2,
        "current_stock": 2,
        "reserved_stock": 0,
        "incoming_stock": 2,
        "lead_time_days": 12,
        "drawing_no": "PUR-MTR-4000",
        "revision": "A",
        "material_type": "STD",
        "description": "外购伺服电机，交期较长。",
    },
    {
        "code": "ENC-4100",
        "name": "编码器组件",
        "specification": "17bit ABS",
        "category": "外购件",
        "unit": "PCS",
        "safety_stock": 2,
        "current_stock": 3,
        "reserved_stock": 0,
        "incoming_stock": 1,
        "lead_time_days": 8,
        "drawing_no": "PUR-ENC-4100",
        "revision": "A",
        "material_type": "STD",
        "description": "用于位移反馈的编码器组件。",
    },
    {
        "code": "BLT-M8X25",
        "name": "内六角螺栓 M8x25",
        "specification": "12.9级",
        "category": "标准件",
        "unit": "PCS",
        "safety_stock": 200,
        "current_stock": 500,
        "reserved_stock": 48,
        "incoming_stock": 300,
        "lead_time_days": 2,
        "drawing_no": "STD-BLT-M8X25",
        "revision": "A",
        "material_type": "STD",
        "description": "主装配和安装法兰通用紧固件。",
    },
    {
        "code": "WSH-M8",
        "name": "平垫圈 M8",
        "specification": "304",
        "category": "标准件",
        "unit": "PCS",
        "safety_stock": 200,
        "current_stock": 500,
        "reserved_stock": 50,
        "incoming_stock": 200,
        "lead_time_days": 2,
        "drawing_no": "STD-WSH-M8",
        "revision": "A",
        "material_type": "STD",
        "description": "与 M8 螺栓配套使用。",
    },
    {
        "code": "RNG-3500",
        "name": "密封挡圈",
        "specification": "NBR-35",
        "category": "标准件",
        "unit": "PCS",
        "safety_stock": 20,
        "current_stock": 22,
        "reserved_stock": 2,
        "incoming_stock": 5,
        "lead_time_days": 3,
        "drawing_no": "STD-RNG-3500",
        "revision": "A",
        "material_type": "STD",
        "description": "用于改善防尘和润滑保持。",
    },
]


BOM_DEFINITIONS = [
    {
        "header": {
            "product_code": "ASM-1001",
            "version": "v1.0",
            "bom_type": "EBOM",
            "status": "RELEASED",
            "description": "首版工程 BOM，适合方案评审和早期采购测算。",
            "is_active": False,
        },
        "items": [
            {"parent_item_code": "ASM-1001", "child_item_code": "SUB-2100", "quantity": 1, "component_type": "KEY"},
            {"parent_item_code": "ASM-1001", "child_item_code": "MTR-4000", "quantity": 1, "component_type": "KEY"},
            {"parent_item_code": "ASM-1001", "child_item_code": "ENC-4100", "quantity": 1, "component_type": "NORMAL"},
            {"parent_item_code": "ASM-1001", "child_item_code": "BLT-M8X25", "quantity": 8, "component_type": "NORMAL"},
            {"parent_item_code": "ASM-1001", "child_item_code": "WSH-M8", "quantity": 8, "component_type": "NORMAL"},
            {"parent_item_code": "SUB-2100", "child_item_code": "CAS-3100", "quantity": 1, "component_type": "KEY"},
            {"parent_item_code": "SUB-2100", "child_item_code": "SHA-3200", "quantity": 1, "component_type": "KEY"},
            {"parent_item_code": "SUB-2100", "child_item_code": "BRG-6204", "quantity": 2, "component_type": "KEY"},
            {"parent_item_code": "SUB-2100", "child_item_code": "CPL-3300", "quantity": 1, "component_type": "NORMAL"},
            {"parent_item_code": "SUB-2100", "child_item_code": "FLT-3400", "quantity": 1, "component_type": "NORMAL"},
        ],
    },
    {
        "header": {
            "product_code": "ASM-1001",
            "version": "v1.1",
            "bom_type": "EBOM",
            "status": "RELEASED",
            "description": "优化后工程 BOM，主轴承升级并新增密封挡圈。",
            "is_active": True,
        },
        "items": [
            {"parent_item_code": "ASM-1001", "child_item_code": "SUB-2100", "quantity": 1, "component_type": "KEY"},
            {"parent_item_code": "ASM-1001", "child_item_code": "MTR-4000", "quantity": 1, "component_type": "KEY"},
            {"parent_item_code": "ASM-1001", "child_item_code": "ENC-4100", "quantity": 1, "component_type": "NORMAL"},
            {"parent_item_code": "ASM-1001", "child_item_code": "BLT-M8X25", "quantity": 10, "component_type": "NORMAL"},
            {"parent_item_code": "ASM-1001", "child_item_code": "WSH-M8", "quantity": 10, "component_type": "NORMAL"},
            {"parent_item_code": "SUB-2100", "child_item_code": "CAS-3100", "quantity": 1, "component_type": "KEY"},
            {"parent_item_code": "SUB-2100", "child_item_code": "SHA-3200", "quantity": 1, "component_type": "KEY"},
            {"parent_item_code": "SUB-2100", "child_item_code": "BRG-6205", "quantity": 2, "component_type": "KEY"},
            {"parent_item_code": "SUB-2100", "child_item_code": "CPL-3300", "quantity": 1, "component_type": "NORMAL"},
            {"parent_item_code": "SUB-2100", "child_item_code": "FLT-3400", "quantity": 1, "component_type": "NORMAL"},
            {"parent_item_code": "SUB-2100", "child_item_code": "RNG-3500", "quantity": 1, "component_type": "NORMAL"},
        ],
    },
    {
        "header": {
            "product_code": "ASM-1001",
            "version": "v1.1",
            "bom_type": "PBOM",
            "status": "RELEASED",
            "description": "制造 BOM，面向领料、装配和工位报工。",
            "is_active": True,
        },
        "items": [
            {"parent_item_code": "ASM-1001", "child_item_code": "CAS-3100", "quantity": 1, "component_type": "KEY", "routing_link": "OP10"},
            {"parent_item_code": "ASM-1001", "child_item_code": "SHA-3200", "quantity": 1, "component_type": "KEY", "routing_link": "OP20"},
            {"parent_item_code": "ASM-1001", "child_item_code": "BRG-6205", "quantity": 2, "component_type": "KEY", "routing_link": "OP30"},
            {"parent_item_code": "ASM-1001", "child_item_code": "CPL-3300", "quantity": 1, "component_type": "NORMAL", "routing_link": "OP40"},
            {"parent_item_code": "ASM-1001", "child_item_code": "FLT-3400", "quantity": 1, "component_type": "NORMAL", "routing_link": "OP10"},
            {"parent_item_code": "ASM-1001", "child_item_code": "MTR-4000", "quantity": 1, "component_type": "KEY", "routing_link": "OP50"},
            {"parent_item_code": "ASM-1001", "child_item_code": "ENC-4100", "quantity": 1, "component_type": "NORMAL", "routing_link": "OP50"},
            {"parent_item_code": "ASM-1001", "child_item_code": "RNG-3500", "quantity": 1, "component_type": "NORMAL", "routing_link": "OP30"},
            {"parent_item_code": "ASM-1001", "child_item_code": "BLT-M8X25", "quantity": 10, "component_type": "NORMAL", "routing_link": "OP60"},
            {"parent_item_code": "ASM-1001", "child_item_code": "WSH-M8", "quantity": 10, "component_type": "NORMAL", "routing_link": "OP60"},
        ],
    },
    {
        "header": {
            "product_code": "JIG-2001",
            "version": "v1.0",
            "bom_type": "EBOM",
            "status": "RELEASED",
            "description": "夹紧治具总成示例，用于展示多产品版本列表。",
            "is_active": True,
        },
        "items": [
            {"parent_item_code": "JIG-2001", "child_item_code": "FLT-3400", "quantity": 1, "component_type": "KEY"},
            {"parent_item_code": "JIG-2001", "child_item_code": "BLT-M8X25", "quantity": 6, "component_type": "NORMAL"},
            {"parent_item_code": "JIG-2001", "child_item_code": "WSH-M8", "quantity": 6, "component_type": "NORMAL"},
        ],
    },
]


ADDITIONAL_MATERIALS = [
    {
        "code": "JIG-2001",
        "name": "夹紧治具总成",
        "specification": "FIXTURE-2001",
        "category": "成品",
        "unit": "SET",
        "safety_stock": 1,
        "current_stock": 0,
        "reserved_stock": 0,
        "incoming_stock": 0,
        "lead_time_days": 6,
        "drawing_no": "DWG-JIG-2001",
        "revision": "A",
        "material_type": "FINISHED",
        "description": "辅助装配治具的简化样例。",
    }
]


def ensure_tables() -> None:
    Base.metadata.create_all(
        bind=get_default_engine(),
        tables=[Material.__table__, BOMHeader.__table__, BOMItem.__table__],
    )


def upsert_material(db, payload):
    material = db.query(Material).filter(Material.code == payload["code"]).first()
    if material is None:
        material = Material(**payload)
        db.add(material)
    else:
        for field, value in payload.items():
            setattr(material, field, value)
    db.flush()
    return material


def upsert_bom_header(db, payload):
    header = (
        db.query(BOMHeader)
        .filter(
            BOMHeader.product_code == payload["product_code"],
            BOMHeader.version == payload["version"],
            BOMHeader.bom_type == payload["bom_type"],
        )
        .first()
    )

    effective_date = payload.get("effective_date") or datetime.utcnow()

    if header is None:
        header = BOMHeader(**payload, effective_date=effective_date)
        db.add(header)
        db.flush()
    else:
        for field, value in payload.items():
            setattr(header, field, value)
        header.effective_date = effective_date
        db.flush()

    if payload.get("is_active"):
        (
            db.query(BOMHeader)
            .filter(
                BOMHeader.product_code == payload["product_code"],
                BOMHeader.bom_type == payload["bom_type"],
                BOMHeader.id != header.id,
            )
            .update({"is_active": False}, synchronize_session=False)
        )

    return header


def replace_bom_items(db, header_id, items):
    db.query(BOMItem).filter(BOMItem.header_id == header_id).delete(synchronize_session=False)
    for item in items:
        db.add(BOMItem(header_id=header_id, **item))
    db.flush()


def seed_sample_bom_data():
    ensure_tables()
    db = SessionLocal()
    try:
        material_count = 0
        bom_count = 0

        for payload in MATERIALS + ADDITIONAL_MATERIALS:
            upsert_material(db, payload)
            material_count += 1

        for definition in BOM_DEFINITIONS:
            header = upsert_bom_header(db, definition["header"])
            replace_bom_items(db, header.id, definition["items"])
            bom_count += 1

        db.commit()
        print(f"Seeded {material_count} sample materials and {bom_count} BOM headers.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_sample_bom_data()
