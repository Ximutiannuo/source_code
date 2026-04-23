"""
数据库迁移脚本：为role_permissions表添加范围字段
"""
import sys
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from sqlalchemy import text
from app.database import engine, SessionLocal
import traceback


def migrate_add_role_permission_scope_fields():
    """
    为role_permissions表添加范围字段
    包括：scope, project, subproject, block, facility_id, discipline, work_package
    """
    db = SessionLocal()
    try:
        print("=" * 60)
        print("为role_permissions表添加范围字段")
        print("=" * 60)
        
        # 检查字段是否已存在
        def check_column_exists(table_name: str, column_name: str) -> bool:
            check_sql = """
            SELECT COUNT(*) as count
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = :table_name
            AND COLUMN_NAME = :column_name
            """
            result = db.execute(text(check_sql), {"table_name": table_name, "column_name": column_name})
            return result.scalar() > 0
        
        # 为role_permissions表添加字段
        print("\n1. 检查role_permissions表...")
        
        fields_to_add = [
            ("scope", "VARCHAR(100) NULL COMMENT 'GCC_Scope范围限制'", "permission_id"),
            ("project", "VARCHAR(100) NULL COMMENT '项目范围限制'", "scope"),
            ("subproject", "VARCHAR(100) NULL COMMENT '子项目范围限制'", "project"),
            ("block", "VARCHAR(100) NULL COMMENT '区块范围限制'", "subproject"),
            ("facility_id", "INTEGER NULL COMMENT 'Facility范围限制'", "block"),
            ("discipline", "VARCHAR(100) NULL COMMENT '专业范围限制'", "facility_id"),
            ("work_package", "VARCHAR(100) NULL COMMENT '工作包范围限制'", "discipline"),
        ]
        
        for field_name, field_def, after_field in fields_to_add:
            if not check_column_exists("role_permissions", field_name):
                print(f"  添加{field_name}字段...")
                db.execute(text(f"""
                    ALTER TABLE role_permissions 
                    ADD COLUMN {field_name} {field_def} AFTER {after_field}
                """))
                print(f"  ✓ {field_name}字段已添加")
            else:
                print(f"  - {field_name}字段已存在，跳过")
        
        # 添加facility_id的外键约束
        print("\n2. 检查facility_id外键约束...")
        def check_foreign_key_exists(table_name: str, constraint_name: str) -> bool:
            check_sql = """
            SELECT COUNT(*) as count
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = :table_name
            AND CONSTRAINT_NAME = :constraint_name
            """
            result = db.execute(text(check_sql), {"table_name": table_name, "constraint_name": constraint_name})
            return result.scalar() > 0
        
        if not check_foreign_key_exists("role_permissions", "fk_role_permissions_facility_id"):
            print("  添加facility_id外键约束...")
            db.execute(text("""
                ALTER TABLE role_permissions 
                ADD CONSTRAINT fk_role_permissions_facility_id 
                FOREIGN KEY (facility_id) REFERENCES facilities(id) 
                ON DELETE SET NULL
            """))
            print("  ✓ facility_id外键约束已添加")
        else:
            print("  - facility_id外键约束已存在，跳过")
        
        # 添加索引
        print("\n3. 添加索引...")
        
        def check_index_exists(table_name: str, index_name: str) -> bool:
            check_sql = """
            SELECT COUNT(*) as count
            FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = :table_name
            AND INDEX_NAME = :index_name
            """
            result = db.execute(text(check_sql), {"table_name": table_name, "index_name": index_name})
            return result.scalar() > 0
        
        indexes_to_create = [
            ("role_permissions", "idx_role_permissions_scope", "scope"),
            ("role_permissions", "idx_role_permissions_project", "project"),
            ("role_permissions", "idx_role_permissions_subproject", "subproject"),
            ("role_permissions", "idx_role_permissions_block", "block"),
            ("role_permissions", "idx_role_permissions_facility_id", "facility_id"),
            ("role_permissions", "idx_role_permissions_discipline", "discipline"),
            ("role_permissions", "idx_role_permissions_work_package", "work_package"),
        ]
        
        for table_name, index_name, column_name in indexes_to_create:
            if not check_index_exists(table_name, index_name):
                print(f"  创建索引 {index_name}...")
                db.execute(text(f"""
                    CREATE INDEX {index_name} ON {table_name}({column_name})
                """))
                print(f"  ✓ 索引 {index_name} 已创建")
            else:
                print(f"  - 索引 {index_name} 已存在，跳过")
        
        db.commit()
        print("\n" + "=" * 60)
        print("迁移完成！")
        print("=" * 60)
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ 迁移失败: {str(e)}")
        traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate_add_role_permission_scope_fields()

