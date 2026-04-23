"""
数据库迁移脚本：为权限表添加所有与facilities/activity_summary/rsc_defines匹配的字段
确保权限范围限制能够完全对应数据表的字段
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


def migrate_complete_permission_fields():
    """
    为user_permissions和role_permissions表添加所有缺失的字段
    确保与facilities、activity_summary、rsc_defines表的字段完全匹配
    """
    db = SessionLocal()
    try:
        print("=" * 60)
        print("为权限表添加所有缺失的字段（完整版）")
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
        # 按照在数据表中的重要性排序
        fields_to_add = [
            # 基础字段（已存在，但检查一下）
            ("scope", "VARCHAR(100) NULL COMMENT 'GCC_Scope范围限制'", "permission_id"),
            ("project", "VARCHAR(100) NULL COMMENT '项目范围限制'", "scope"),
            ("subproject", "VARCHAR(100) NULL COMMENT '子项目范围限制'", "project"),
            ("block", "VARCHAR(100) NULL COMMENT '区块范围限制'", "subproject"),
            
            # Facilities相关字段（缺失的）
            ("train", "VARCHAR(100) NULL COMMENT 'Train范围限制'", "block"),
            ("unit", "VARCHAR(100) NULL COMMENT 'Unit范围限制'", "train"),
            ("main_block", "VARCHAR(100) NULL COMMENT 'Main_Block范围限制'", "unit"),
            ("quarter", "VARCHAR(100) NULL COMMENT 'Quarter范围限制'", "main_block"),
            ("simple_block", "VARCHAR(100) NULL COMMENT 'Simple_Block范围限制'", "quarter"),
            
            # 其他字段
            ("facility_id", "INTEGER NULL COMMENT 'Facility范围限制'", "simple_block"),
            ("discipline", "VARCHAR(100) NULL COMMENT '专业范围限制'", "facility_id"),
            ("work_package", "VARCHAR(100) NULL COMMENT '工作包范围限制'", "discipline"),
            ("resource_id", "VARCHAR(100) NULL COMMENT '资源ID范围限制（来自rsc_defines）'", "work_package"),
        ]
        
        # 为user_permissions表添加字段
        print("\n1. 检查user_permissions表...")
        for field_name, field_def, after_field in fields_to_add:
            if not check_column_exists("user_permissions", field_name):
                print(f"  添加{field_name}字段...")
                try:
                    db.execute(text(f"""
                        ALTER TABLE user_permissions 
                        ADD COLUMN {field_name} {field_def} AFTER {after_field}
                    """))
                    print(f"  [OK] {field_name}字段已添加")
                except Exception as e:
                    # 如果after_field不存在，尝试添加到末尾
                    print(f"  [WARN] 尝试在{after_field}后添加失败，尝试添加到末尾...")
                    try:
                        db.execute(text(f"""
                            ALTER TABLE user_permissions 
                            ADD COLUMN {field_name} {field_def}
                        """))
                        print(f"  [OK] {field_name}字段已添加到末尾")
                    except Exception as e2:
                        print(f"  [ERROR] 添加{field_name}字段失败: {str(e2)}")
            else:
                print(f"  [-] {field_name}字段已存在，跳过")
        
        # 为role_permissions表添加字段（不需要resource_id，因为role权限不需要那么细的粒度）
        print("\n2. 检查role_permissions表...")
        role_fields = [f for f in fields_to_add if f[0] != "resource_id"]
        for field_name, field_def, after_field in role_fields:
            if not check_column_exists("role_permissions", field_name):
                print(f"  添加{field_name}字段...")
                try:
                    db.execute(text(f"""
                        ALTER TABLE role_permissions 
                        ADD COLUMN {field_name} {field_def} AFTER {after_field}
                    """))
                    print(f"  [OK] {field_name}字段已添加")
                except Exception as e:
                    # 如果after_field不存在，尝试添加到末尾
                    print(f"  [WARN] 尝试在{after_field}后添加失败，尝试添加到末尾...")
                    try:
                        db.execute(text(f"""
                            ALTER TABLE role_permissions 
                            ADD COLUMN {field_name} {field_def}
                        """))
                        print(f"  [OK] {field_name}字段已添加到末尾")
                    except Exception as e2:
                        print(f"  [ERROR] 添加{field_name}字段失败: {str(e2)}")
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
        
        # 需要添加索引的字段（除了已存在的）
        indexes_to_create = [
            ("user_permissions", "idx_user_permissions_scope", "scope"),
            ("user_permissions", "idx_user_permissions_project", "project"),
            ("user_permissions", "idx_user_permissions_subproject", "subproject"),
            ("user_permissions", "idx_user_permissions_block", "block"),
            ("user_permissions", "idx_user_permissions_train", "train"),
            ("user_permissions", "idx_user_permissions_unit", "unit"),
            ("user_permissions", "idx_user_permissions_main_block", "main_block"),
            ("user_permissions", "idx_user_permissions_quarter", "quarter"),
            ("user_permissions", "idx_user_permissions_simple_block", "simple_block"),
            ("user_permissions", "idx_user_permissions_facility_id", "facility_id"),
            ("user_permissions", "idx_user_permissions_discipline", "discipline"),
            ("user_permissions", "idx_user_permissions_work_package", "work_package"),
            ("user_permissions", "idx_user_permissions_resource_id", "resource_id"),
            
            ("role_permissions", "idx_role_permissions_scope", "scope"),
            ("role_permissions", "idx_role_permissions_project", "project"),
            ("role_permissions", "idx_role_permissions_subproject", "subproject"),
            ("role_permissions", "idx_role_permissions_block", "block"),
            ("role_permissions", "idx_role_permissions_train", "train"),
            ("role_permissions", "idx_role_permissions_unit", "unit"),
            ("role_permissions", "idx_role_permissions_main_block", "main_block"),
            ("role_permissions", "idx_role_permissions_quarter", "quarter"),
            ("role_permissions", "idx_role_permissions_simple_block", "simple_block"),
            ("role_permissions", "idx_role_permissions_facility_id", "facility_id"),
            ("role_permissions", "idx_role_permissions_discipline", "discipline"),
            ("role_permissions", "idx_role_permissions_work_package", "work_package"),
        ]
        
        for table_name, index_name, column_name in indexes_to_create:
            # 先检查字段是否存在
            if not check_column_exists(table_name, column_name):
                print(f"  [-] 跳过索引 {index_name}（字段{column_name}不存在）")
                continue
                
            if not check_index_exists(table_name, index_name):
                print(f"  创建索引 {index_name}...")
                try:
                    db.execute(text(f"""
                        CREATE INDEX {index_name} ON {table_name}({column_name})
                    """))
                    print(f"  [OK] 索引 {index_name} 已创建")
                except Exception as e:
                    print(f"  [ERROR] 创建索引 {index_name} 失败: {str(e)}")
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
    migrate_complete_permission_fields()

