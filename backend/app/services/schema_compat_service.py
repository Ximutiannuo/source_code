import logging
from typing import Dict, List, Tuple

from sqlalchemy import inspect
from sqlalchemy.engine import Engine


logger = logging.getLogger(__name__)


SchemaPatch = Tuple[str, str]

SCHEMA_PATCHES: Dict[str, List[SchemaPatch]] = {
    "manufacturing_orders": [
        ("bom_id", "ALTER TABLE manufacturing_orders ADD COLUMN bom_id INTEGER NULL"),
        ("process_template_id", "ALTER TABLE manufacturing_orders ADD COLUMN process_template_id INTEGER NULL"),
        ("notes", "ALTER TABLE manufacturing_orders ADD COLUMN notes TEXT NULL"),
        ("created_at", "ALTER TABLE manufacturing_orders ADD COLUMN created_at DATETIME NULL"),
    ],
    "materials": [
        ("current_stock", "ALTER TABLE materials ADD COLUMN current_stock DOUBLE DEFAULT 0"),
        ("reserved_stock", "ALTER TABLE materials ADD COLUMN reserved_stock DOUBLE DEFAULT 0"),
        ("incoming_stock", "ALTER TABLE materials ADD COLUMN incoming_stock DOUBLE DEFAULT 0"),
        ("lead_time_days", "ALTER TABLE materials ADD COLUMN lead_time_days INTEGER DEFAULT 0"),
        ("description", "ALTER TABLE materials ADD COLUMN description TEXT NULL"),
    ],
    "bom_headers": [
        ("product_family", "ALTER TABLE bom_headers ADD COLUMN product_family VARCHAR(100) NULL"),
        ("business_unit", "ALTER TABLE bom_headers ADD COLUMN business_unit VARCHAR(100) NULL"),
        ("project_code", "ALTER TABLE bom_headers ADD COLUMN project_code VARCHAR(100) NULL"),
        ("plant_code", "ALTER TABLE bom_headers ADD COLUMN plant_code VARCHAR(50) NULL"),
        ("discipline", "ALTER TABLE bom_headers ADD COLUMN discipline VARCHAR(100) NULL"),
        ("source_system", "ALTER TABLE bom_headers ADD COLUMN source_system VARCHAR(50) DEFAULT 'MANUAL'"),
        ("source_file", "ALTER TABLE bom_headers ADD COLUMN source_file VARCHAR(255) NULL"),
        ("sync_status", "ALTER TABLE bom_headers ADD COLUMN sync_status VARCHAR(30) DEFAULT 'MANUAL'"),
        ("cad_document_no", "ALTER TABLE bom_headers ADD COLUMN cad_document_no VARCHAR(100) NULL"),
        ("released_by", "ALTER TABLE bom_headers ADD COLUMN released_by VARCHAR(100) NULL"),
        ("last_synced_at", "ALTER TABLE bom_headers ADD COLUMN last_synced_at DATETIME NULL"),
    ],
    "bom_items": [
        ("find_number", "ALTER TABLE bom_items ADD COLUMN find_number VARCHAR(50) NULL"),
        ("item_level", "ALTER TABLE bom_items ADD COLUMN item_level INTEGER DEFAULT 1"),
        ("item_category", "ALTER TABLE bom_items ADD COLUMN item_category VARCHAR(100) NULL"),
        ("procurement_type", "ALTER TABLE bom_items ADD COLUMN procurement_type VARCHAR(50) NULL"),
        ("loss_rate", "ALTER TABLE bom_items ADD COLUMN loss_rate DOUBLE DEFAULT 0"),
        ("unit_price", "ALTER TABLE bom_items ADD COLUMN unit_price DOUBLE DEFAULT 0"),
        ("total_price", "ALTER TABLE bom_items ADD COLUMN total_price DOUBLE DEFAULT 0"),
        ("source_reference", "ALTER TABLE bom_items ADD COLUMN source_reference VARCHAR(255) NULL"),
        ("drawing_document_id", "ALTER TABLE bom_items ADD COLUMN drawing_document_id INTEGER NULL"),
        ("drawing_mapping_status", "ALTER TABLE bom_items ADD COLUMN drawing_mapping_status VARCHAR(30) DEFAULT 'UNMAPPED'"),
        ("drawing_validation_message", "ALTER TABLE bom_items ADD COLUMN drawing_validation_message VARCHAR(255) NULL"),
    ],
    "drawing_documents": [
        ("source_relative_path", "ALTER TABLE drawing_documents ADD COLUMN source_relative_path VARCHAR(500) NULL"),
    ],
    "template_activities": [
        ("standard_hours", "ALTER TABLE template_activities ADD COLUMN standard_hours DECIMAL(10, 2) DEFAULT 8"),
        ("setup_hours", "ALTER TABLE template_activities ADD COLUMN setup_hours DECIMAL(10, 2) DEFAULT 0"),
    ],
    "procurement_requests": [
        ("request_no", "ALTER TABLE procurement_requests ADD COLUMN request_no VARCHAR(50) NULL"),
        ("title", "ALTER TABLE procurement_requests ADD COLUMN title VARCHAR(200) NULL"),
        ("source_scope", "ALTER TABLE procurement_requests ADD COLUMN source_scope VARCHAR(20) DEFAULT 'GLOBAL'"),
        ("source_order_id", "ALTER TABLE procurement_requests ADD COLUMN source_order_id INTEGER NULL"),
        ("status", "ALTER TABLE procurement_requests ADD COLUMN status VARCHAR(30) DEFAULT 'DRAFT'"),
        ("urgency_level", "ALTER TABLE procurement_requests ADD COLUMN urgency_level VARCHAR(20) DEFAULT 'MEDIUM'"),
        ("total_items", "ALTER TABLE procurement_requests ADD COLUMN total_items INTEGER DEFAULT 0"),
        (
            "suggested_purchase_qty_total",
            "ALTER TABLE procurement_requests ADD COLUMN suggested_purchase_qty_total DOUBLE DEFAULT 0",
        ),
        ("requester_id", "ALTER TABLE procurement_requests ADD COLUMN requester_id INTEGER NULL"),
        ("requester_name", "ALTER TABLE procurement_requests ADD COLUMN requester_name VARCHAR(100) NULL"),
        ("notes", "ALTER TABLE procurement_requests ADD COLUMN notes TEXT NULL"),
        ("submitted_at", "ALTER TABLE procurement_requests ADD COLUMN submitted_at DATETIME NULL"),
        ("completed_at", "ALTER TABLE procurement_requests ADD COLUMN completed_at DATETIME NULL"),
        ("created_at", "ALTER TABLE procurement_requests ADD COLUMN created_at DATETIME NULL"),
        ("updated_at", "ALTER TABLE procurement_requests ADD COLUMN updated_at DATETIME NULL"),
    ],
    "equipment": [
        ("department", "ALTER TABLE equipment ADD COLUMN department VARCHAR(100) NULL"),
        ("location", "ALTER TABLE equipment ADD COLUMN location VARCHAR(200) NULL"),
        ("purchase_date", "ALTER TABLE equipment ADD COLUMN purchase_date DATETIME NULL"),
        ("last_maintenance_date", "ALTER TABLE equipment ADD COLUMN last_maintenance_date DATETIME NULL"),
        ("next_maintenance_date", "ALTER TABLE equipment ADD COLUMN next_maintenance_date DATETIME NULL"),
        ("maintenance_cycle_days", "ALTER TABLE equipment ADD COLUMN maintenance_cycle_days INTEGER DEFAULT 0"),
        ("description", "ALTER TABLE equipment ADD COLUMN description TEXT NULL"),
        ("created_at", "ALTER TABLE equipment ADD COLUMN created_at DATETIME NULL"),
    ],
    "procurement_request_items": [
        ("material_id", "ALTER TABLE procurement_request_items ADD COLUMN material_id INTEGER NULL"),
        ("material_code", "ALTER TABLE procurement_request_items ADD COLUMN material_code VARCHAR(50) NULL"),
        ("material_name", "ALTER TABLE procurement_request_items ADD COLUMN material_name VARCHAR(200) NULL"),
        ("unit", "ALTER TABLE procurement_request_items ADD COLUMN unit VARCHAR(20) NULL"),
        ("material_type", "ALTER TABLE procurement_request_items ADD COLUMN material_type VARCHAR(50) NULL"),
        ("material_category", "ALTER TABLE procurement_request_items ADD COLUMN material_category VARCHAR(100) NULL"),
        ("readiness_status", "ALTER TABLE procurement_request_items ADD COLUMN readiness_status VARCHAR(20) NULL"),
        ("shortage_reason", "ALTER TABLE procurement_request_items ADD COLUMN shortage_reason VARCHAR(100) NULL"),
        ("procurement_mode", "ALTER TABLE procurement_request_items ADD COLUMN procurement_mode VARCHAR(100) NULL"),
        ("suggested_action", "ALTER TABLE procurement_request_items ADD COLUMN suggested_action VARCHAR(50) NULL"),
        ("urgency_level", "ALTER TABLE procurement_request_items ADD COLUMN urgency_level VARCHAR(20) NULL"),
        ("requested_qty", "ALTER TABLE procurement_request_items ADD COLUMN requested_qty DOUBLE DEFAULT 0"),
        ("received_qty", "ALTER TABLE procurement_request_items ADD COLUMN received_qty DOUBLE DEFAULT 0"),
        ("shortage_qty", "ALTER TABLE procurement_request_items ADD COLUMN shortage_qty DOUBLE DEFAULT 0"),
        (
            "shortage_with_safety_qty",
            "ALTER TABLE procurement_request_items ADD COLUMN shortage_with_safety_qty DOUBLE DEFAULT 0",
        ),
        ("current_stock", "ALTER TABLE procurement_request_items ADD COLUMN current_stock DOUBLE DEFAULT 0"),
        ("reserved_stock", "ALTER TABLE procurement_request_items ADD COLUMN reserved_stock DOUBLE DEFAULT 0"),
        ("incoming_stock", "ALTER TABLE procurement_request_items ADD COLUMN incoming_stock DOUBLE DEFAULT 0"),
        ("net_available_qty", "ALTER TABLE procurement_request_items ADD COLUMN net_available_qty DOUBLE DEFAULT 0"),
        ("safety_stock", "ALTER TABLE procurement_request_items ADD COLUMN safety_stock DOUBLE DEFAULT 0"),
        ("lead_time_days", "ALTER TABLE procurement_request_items ADD COLUMN lead_time_days INTEGER DEFAULT 0"),
        ("earliest_due_date", "ALTER TABLE procurement_request_items ADD COLUMN earliest_due_date DATETIME NULL"),
        ("suggested_order_date", "ALTER TABLE procurement_request_items ADD COLUMN suggested_order_date DATETIME NULL"),
        ("impacted_order_count", "ALTER TABLE procurement_request_items ADD COLUMN impacted_order_count INTEGER DEFAULT 0"),
        ("impacted_orders", "ALTER TABLE procurement_request_items ADD COLUMN impacted_orders JSON NULL"),
        ("planning_note", "ALTER TABLE procurement_request_items ADD COLUMN planning_note TEXT NULL"),
        ("created_at", "ALTER TABLE procurement_request_items ADD COLUMN created_at DATETIME NULL"),
        ("updated_at", "ALTER TABLE procurement_request_items ADD COLUMN updated_at DATETIME NULL"),
    ],
}


def ensure_schema_compatibility(engine: Engine) -> None:
    inspector = inspect(engine)
    applied_patches: List[str] = []

    with engine.begin() as connection:
        for table_name, patches in SCHEMA_PATCHES.items():
            try:
                existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
            except Exception as exc:
                logger.warning("Skip schema compatibility check for table %s: %s", table_name, exc)
                continue

            for column_name, ddl in patches:
                if column_name in existing_columns:
                    continue
                logger.info("Apply schema patch for %s.%s", table_name, column_name)
                connection.exec_driver_sql(ddl)
                applied_patches.append(f"{table_name}.{column_name}")
                existing_columns.add(column_name)

    if applied_patches:
        logger.info("Applied schema patches: %s", ", ".join(applied_patches))
