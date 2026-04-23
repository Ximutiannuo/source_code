"""
一次性迁移：为工序逻辑规则库添加 facility_type 相关列和表。
解决错误：Unknown column 'facility_type_id' in 'field list'

执行方式：cd backend && python scripts/migrate_process_template_facility_type.py
"""
import sys
import os
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from app.database import load_env_with_fallback
if not os.getenv("DATABASE_URL"):
    load_env_with_fallback()

from app.database import get_default_engine
from sqlalchemy import text

def run():
    engine = get_default_engine()
    with engine.connect() as conn:
        # 1. 创建 facility_types 表（若不存在）
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS facility_types (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                sort_order INT DEFAULT 0,
                created_at DATETIME NULL,
                updated_at DATETIME NULL,
                UNIQUE KEY uq_facility_types_name (name),
                KEY idx_facility_types_name (name)
            )
        """))
        conn.commit()
        print("  facility_types: 表已存在或已创建")

        # 2. process_templates 添加 facility_type_id（若不存在）
        db_name = conn.execute(text("SELECT DATABASE()")).scalar()
        r = conn.execute(text("""
            SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'process_templates' AND COLUMN_NAME = 'facility_type_id'
        """), {"db": db_name}).scalar()
        if r == 0:
            conn.execute(text("ALTER TABLE process_templates ADD COLUMN facility_type_id INT NULL COMMENT '装置类型ID'"))
            conn.execute(text("CREATE INDEX idx_process_templates_facility_type_id ON process_templates (facility_type_id)"))
            try:
                conn.execute(text("""
                    ALTER TABLE process_templates
                    ADD CONSTRAINT fk_process_templates_facility_type
                    FOREIGN KEY (facility_type_id) REFERENCES facility_types(id) ON DELETE CASCADE
                """))
            except Exception as e:
                if "Duplicate" in str(e) or "already exists" in str(e).lower():
                    pass
                else:
                    print("    外键可选，跳过:", e)
            conn.commit()
            print("  process_templates: 已添加 facility_type_id 列")
        else:
            print("  process_templates: facility_type_id 列已存在")

        # 2b. process_templates 允许 work_package 等列为 NULL（按装置类型建模板时可不填）
        try:
            conn.execute(text("ALTER TABLE process_templates MODIFY COLUMN work_package VARCHAR(100) NULL COMMENT '工作包（按工作包配置时使用）'"))
            conn.execute(text("ALTER TABLE process_templates MODIFY COLUMN applicable_qty_min DECIMAL(18,2) NULL"))
            conn.execute(text("ALTER TABLE process_templates MODIFY COLUMN applicable_qty_max DECIMAL(18,2) NULL"))
            conn.execute(text("ALTER TABLE process_templates MODIFY COLUMN min_required_workers INT NULL"))
            conn.commit()
            print("  process_templates: work_package、applicable_qty_min/max、min_required_workers 已改为允许 NULL")
        except Exception as e:
            try:
                conn.rollback()
            except Exception:
                pass
            print("  process_templates MODIFY（若列已是 NULL 可忽略）:", e)

        # 3. 创建 template_activities 表（若不存在）
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS template_activities (
                id INT AUTO_INCREMENT PRIMARY KEY,
                template_id INT NOT NULL,
                activity_key VARCHAR(100) NOT NULL,
                label VARCHAR(255) NULL,
                planned_duration DECIMAL(10,2) DEFAULT 1,
                sort_order INT DEFAULT 0,
                created_at DATETIME NULL,
                updated_at DATETIME NULL,
                KEY idx_template_activities_template_id (template_id),
                KEY idx_activity_key (activity_key),
                CONSTRAINT fk_template_activities_template
                    FOREIGN KEY (template_id) REFERENCES process_templates(id) ON DELETE CASCADE
            )
        """))
        conn.commit()
        print("  template_activities: 表已存在或已创建")

        # 4. facilities 添加 facility_type_id（若不存在）
        r = conn.execute(text("""
            SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'facilities' AND COLUMN_NAME = 'facility_type_id'
        """), {"db": db_name}).scalar()
        if r == 0:
            conn.execute(text("ALTER TABLE facilities ADD COLUMN facility_type_id INT NULL COMMENT '装置类型ID'"))
            conn.execute(text("CREATE INDEX idx_facilities_facility_type_id ON facilities (facility_type_id)"))
            try:
                conn.execute(text("""
                    ALTER TABLE facilities
                    ADD CONSTRAINT fk_facilities_facility_type
                    FOREIGN KEY (facility_type_id) REFERENCES facility_types(id) ON DELETE SET NULL
                """))
            except Exception as e:
                if "Duplicate" in str(e) or "already exists" in str(e).lower():
                    pass
                else:
                    print("    外键可选，跳过:", e)
            conn.commit()
            print("  facilities: 已添加 facility_type_id 列")
        else:
            print("  facilities: facility_type_id 列已存在")

    print("迁移完成。")

if __name__ == "__main__":
    run()
