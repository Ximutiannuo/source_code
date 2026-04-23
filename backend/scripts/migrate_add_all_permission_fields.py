"""
数据库迁移脚本：为权限表添加所有缺失的字段
包括：scope, subproject, resource_id 等
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


def migrate_add_all_permission_fields():
    """
    为user_permissions和role_permissions表添加所有缺失的字段
    """
    db = SessionLocal()
    try:
        print("=" * 60)
        print("为权限表添加所有缺失的字段")
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
        
        # 需要添加的字段列表（字段名, SQL定义, 位置）
        fields_to_add = [
            ("scope", "VARCHAR(100) NULL COMMENT 'GCC_Scope范围限制'", "permission_id"),
            ("subproject", "VARCHAR(100) NULL COMMENT '子项目范围限制'", "project"),
            ("resource_id", "VARCHAR(100) NULL COMMENT '资源ID范围限制（来自rsc_defines）'", "work_package"),
        ]
        
        # 为user_permissions表添加字段
        print("\n1. 检查user_permissions表...")
        for field_name, field_def, after_field in fields_to_add:
            if not check_column_exists("user_permissions", field_name):
                print(f"  添加{field_name}字段...")
                db.execute(text(f"""
                    ALTER TABLE user_permissions 
                    ADD COLUMN {field_name} {field_def} AFTER {after_field}
                """))
                print(f"  [OK] {field_name}字段已添加")
            else:
                print(f"  [-] {field_name}字段已存在，跳过")
        
        # 为role_permissions表添加字段（不需要resource_id）
        print("\n2. 检查role_permissions表...")
        role_fields = [f for f in fields_to_add if f[0] != "resource_id"]
        for field_name, field_def, after_field in role_fields:
            if not check_column_exists("role_permissions", field_name):
                print(f"  添加{field_name}字段...")
                db.execute(text(f"""
                    ALTER TABLE role_permissions 
                    ADD COLUMN {field_name} {field_def} AFTER {after_field}
                """))
                print(f"  [OK] {field_name}字段已添加")
            else:
                print(f"  [-] {field_name}字段已存在，跳过")
        
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
            ("user_permissions", "idx_user_permissions_scope", "scope"),
            ("user_permissions", "idx_user_permissions_subproject", "subproject"),
            ("user_permissions", "idx_user_permissions_resource_id", "resource_id"),
            ("role_permissions", "idx_role_permissions_scope", "scope"),
            ("role_permissions", "idx_role_permissions_subproject", "subproject"),
        ]
        
        for table_name, index_name, column_name in indexes_to_create:
            if not check_index_exists(table_name, index_name):
                print(f"  创建索引 {index_name}...")
                db.execute(text(f"""
                    CREATE INDEX {index_name} ON {table_name}({column_name})
                """))
                print(f"  [OK] 索引 {index_name} 已创建")
            else:
                print(f"  [-] 索引 {index_name} 已存在，跳过")
        
        db.commit()
        print("\n" + "=" * 60)
        print("迁移完成！")
        print("=" * 60)
        
    except Exception as e:
        db.rollback()
        print(f"\n[ERROR] 迁移失败: {str(e)}")
        traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate_add_all_permission_fields()

