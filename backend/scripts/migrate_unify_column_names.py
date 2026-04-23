"""
统一数据库字段名迁移脚本

根据 column_names_mapping.md 执行完整的字段名统一迁移：
1. 禁用外键约束
2. Truncate相关表
3. 重命名字段
4. 重建外键约束和索引
"""

import sys
import os
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import text
from app.database import engine, SessionLocal
from datetime import datetime

def disable_foreign_key_checks(db):
    """禁用外键检查"""
    print("\n🔒 禁用外键检查...")
    try:
        db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
        db.commit()
        print("  ✅ 外键检查已禁用")
        return True
    except Exception as e:
        print(f"  ❌ 禁用外键检查失败: {str(e)}")
        return False

def enable_foreign_key_checks(db):
    """启用外键检查"""
    print("\n🔓 启用外键检查...")
    try:
        db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
        db.commit()
        print("  ✅ 外键检查已启用")
        return True
    except Exception as e:
        print(f"  ❌ 启用外键检查失败: {str(e)}")
        return False

def truncate_table(db, table_name):
    """清空表数据"""
    try:
        print(f"  🗑️  清空表 {table_name}...")
        db.execute(text(f"TRUNCATE TABLE `{table_name}`"))
        db.commit()
        print(f"  ✅ 表 {table_name} 已清空")
        return True
    except Exception as e:
        print(f"  ❌ 清空表 {table_name} 失败: {str(e)}")
        db.rollback()
        return False

def drop_foreign_key(db, table_name, constraint_name):
    """删除外键约束"""
    try:
        db.execute(text(f"ALTER TABLE `{table_name}` DROP FOREIGN KEY `{constraint_name}`"))
        db.commit()
        print(f"  ✅ 删除外键 {table_name}.{constraint_name}")
        return True
    except Exception as e:
        # 外键可能不存在，忽略错误
        print(f"  ⚠️  外键 {table_name}.{constraint_name} 不存在或已删除: {str(e)}")
        return False

def migrate_table_column(db, table_name, old_column, new_column, column_type):
    """迁移单个表的单个字段"""
    try:
        # 检查旧字段是否存在
        check_old_sql = f"""
        SELECT COUNT(*) as cnt 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = '{table_name}' 
        AND COLUMN_NAME = '{old_column}'
        """
        result = db.execute(text(check_old_sql)).fetchone()
        
        if not result or result[0] == 0:
            print(f"  ⚠️  表 {table_name} 的字段 {old_column} 不存在，跳过")
            return False
        
        # 检查新字段是否已存在
        check_new_sql = f"""
        SELECT COUNT(*) as cnt 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = '{table_name}' 
        AND COLUMN_NAME = '{new_column}'
        """
        result = db.execute(text(check_new_sql)).fetchone()
        
        if result and result[0] > 0:
            print(f"  ⚠️  表 {table_name} 的字段 {new_column} 已存在，跳过")
            return False
        
        # 重命名字段
        rename_sql = f"ALTER TABLE `{table_name}` CHANGE COLUMN `{old_column}` `{new_column}` {column_type}"
        print(f"  🔄 重命名 {table_name}.{old_column} → {table_name}.{new_column}")
        db.execute(text(rename_sql))
        db.commit()
        print(f"  ✅ 成功")
        return True
    except Exception as e:
        db.rollback()
        print(f"  ❌ 失败: {str(e)}")
        return False

def migrate_activities_table(db):
    """迁移activities表"""
    print("\n📋 迁移 activities 表...")
    
    migrations = [
        ("act_id", "activity_id", "VARCHAR(100)"),
        ("act_description", "title", "TEXT"),
    ]
    
    for old_col, new_col, col_type in migrations:
        migrate_table_column(db, "activities", old_col, new_col, col_type)

def migrate_mpdb_table(db):
    """迁移mpdb表"""
    print("\n📋 迁移 mpdb 表...")
    
    migrations = [
        ("gcc_block", "block", "VARCHAR(50)"),
        ("gcc_scope", "scope", "VARCHAR(100)"),
        ("gcc_discipline", "discipline", "VARCHAR(50)"),
        ("gcc_workpackage", "work_package", "VARCHAR(50)"),
        ("gcc_project", "project", "VARCHAR(50)"),
        ("gcc_subproject", "subproject", "VARCHAR(50)"),
        ("gcc_phase", "implement_phase", "VARCHAR(50)"),
        ("gcc_train", "train", "VARCHAR(50)"),
        ("gcc_unit", "unit", "VARCHAR(50)"),
        ("bcc_quarter", "quarter", "VARCHAR(50)"),
        ("activity_description", "title", "TEXT"),
    ]
    
    for old_col, new_col, col_type in migrations:
        migrate_table_column(db, "mpdb", old_col, new_col, col_type)

def migrate_vfactdb_table(db):
    """迁移vfactdb表"""
    print("\n📋 迁移 vfactdb 表...")
    
    migrations = [
        ("gcc_block", "block", "VARCHAR(50)"),
        ("gcc_scope", "scope", "VARCHAR(100)"),
        ("gcc_discipline", "discipline", "VARCHAR(50)"),
        ("gcc_workpackage", "work_package", "VARCHAR(50)"),
        ("gcc_project", "project", "VARCHAR(50)"),
        ("gcc_subproject", "subproject", "VARCHAR(50)"),
        ("gcc_phase", "implement_phase", "VARCHAR(50)"),
        ("gcc_train", "train", "VARCHAR(50)"),
        ("gcc_unit", "unit", "VARCHAR(50)"),
        ("bcc_quarter", "quarter", "VARCHAR(50)"),
        ("gcc_description", "title", "TEXT"),
    ]
    
    for old_col, new_col, col_type in migrations:
        migrate_table_column(db, "vfactdb", old_col, new_col, col_type)

def migrate_activity_summary_table(db):
    """迁移activity_summary表"""
    print("\n📋 迁移 activity_summary 表...")
    
    migrations = [
        ("workpackage", "work_package", "VARCHAR(100)"),
        ("subproject_code", "subproject", "VARCHAR(100)"),
        ("phase", "implement_phase", "VARCHAR(100)"),
        ("bcc_work_package", "contract_phase", "VARCHAR(100)"),
        ("bcc_quarter", "quarter", "VARCHAR(100)"),
        ("gcc_simpblk", "simple_block", "VARCHAR(100)"),
        ("bcc_startup_sequence", "start_up_sequence", "VARCHAR(100)"),
    ]
    
    for old_col, new_col, col_type in migrations:
        migrate_table_column(db, "activity_summary", old_col, new_col, col_type)

def migrate_facilities_table(db):
    """迁移facilities表"""
    print("\n📋 迁移 facilities 表...")
    
    migrations = [
        ("subproject_code", "subproject", "VARCHAR(100)"),
        ("bcc_quarter", "quarter", "VARCHAR(100)"),
        ("bcc_startup_sequence", "start_up_sequence", "VARCHAR(100)"),
    ]
    
    for old_col, new_col, col_type in migrations:
        migrate_table_column(db, "facilities", old_col, new_col, col_type)

def update_foreign_keys(db):
    """更新外键约束"""
    print("\n🔗 更新外键约束...")
    
    # 删除旧的外键
    foreign_keys_to_drop = [
        ("mpdb", "mpdb_ibfk_1"),
        ("vfactdb", "vfactdb_ibfk_1"),
        ("volume_controls", "volume_controls_ibfk_1"),
    ]
    
    for table_name, constraint_name in foreign_keys_to_drop:
        drop_foreign_key(db, table_name, constraint_name)
    
    # 添加新的外键
    try:
        # mpdb表外键
        db.execute(text("""
            ALTER TABLE `mpdb` 
            ADD CONSTRAINT `fk_mpdb_activity_id` 
            FOREIGN KEY (`activity_id`) 
            REFERENCES `activities` (`activity_id`) 
            ON DELETE SET NULL
        """))
        db.commit()
        print("  ✅ 更新 mpdb.activity_id 外键")
    except Exception as e:
        print(f"  ⚠️  mpdb外键更新: {str(e)}")
        db.rollback()
    
    try:
        # vfactdb表外键
        db.execute(text("""
            ALTER TABLE `vfactdb` 
            ADD CONSTRAINT `fk_vfactdb_activity_id` 
            FOREIGN KEY (`activity_id`) 
            REFERENCES `activities` (`activity_id`) 
            ON DELETE SET NULL
        """))
        db.commit()
        print("  ✅ 更新 vfactdb.activity_id 外键")
    except Exception as e:
        print(f"  ⚠️  vfactdb外键更新: {str(e)}")
        db.rollback()
    
    try:
        # volume_controls表外键
        db.execute(text("""
            ALTER TABLE `volume_controls` 
            ADD CONSTRAINT `fk_volume_controls_activity_id` 
            FOREIGN KEY (`activity_id`) 
            REFERENCES `activities` (`activity_id`) 
            ON DELETE CASCADE
        """))
        db.commit()
        print("  ✅ 更新 volume_controls.activity_id 外键")
    except Exception as e:
        print(f"  ⚠️  volume_controls外键更新: {str(e)}")
        db.rollback()

def rebuild_indexes(db):
    """重建索引"""
    print("\n📇 重建索引...")
    
    # 删除旧索引
    indexes_to_drop = [
        ("activities", "idx_activity_wbs"),
        ("mpdb", "idx_mpdb_date_activity"),
        ("vfactdb", "idx_vfactdb_date_activity"),
        ("activity_summary", "idx_activity_summary_subproject"),
        ("activity_summary", "idx_activity_summary_workpackage"),
    ]
    
    for table_name, index_name in indexes_to_drop:
        try:
            db.execute(text(f"ALTER TABLE `{table_name}` DROP INDEX `{index_name}`"))
            db.commit()
            print(f"  ✅ 删除索引 {table_name}.{index_name}")
        except Exception as e:
            print(f"  ⚠️  索引 {table_name}.{index_name} 不存在: {str(e)}")
    
    # 创建新索引
    indexes_to_create = [
        ("activities", "idx_activities_activity_id", ["activity_id"]),
        ("mpdb", "idx_mpdb_date_activity_id", ["date", "activity_id"]),
        ("mpdb", "idx_mpdb_block", ["block"]),
        ("mpdb", "idx_mpdb_discipline", ["discipline"]),
        ("mpdb", "idx_mpdb_work_package", ["work_package"]),
        ("vfactdb", "idx_vfactdb_date_activity_id", ["date", "activity_id"]),
        ("vfactdb", "idx_vfactdb_block", ["block"]),
        ("vfactdb", "idx_vfactdb_discipline", ["discipline"]),
        ("vfactdb", "idx_vfactdb_work_package", ["work_package"]),
        ("activity_summary", "idx_activity_summary_subproject", ["subproject"]),
        ("activity_summary", "idx_activity_summary_work_package", ["work_package"]),
        ("facilities", "idx_facilities_subproject", ["subproject"]),
    ]
    
    for table_name, index_name, columns in indexes_to_create:
        try:
            # 处理联合索引：多个列用逗号分隔
            columns_str = ", ".join([f"`{col}`" for col in columns])
            db.execute(text(f"CREATE INDEX `{index_name}` ON `{table_name}` ({columns_str})"))
            db.commit()
            print(f"  ✅ 创建索引 {table_name}.{index_name}")
        except Exception as e:
            print(f"  ⚠️  创建索引 {table_name}.{index_name} 失败: {str(e)}")
            db.rollback()

def main():
    """主函数"""
    print("=" * 60)
    print("数据库字段名统一迁移脚本")
    print("=" * 60)
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("\n⚠️  警告：此脚本将清空以下表的数据：")
    print("  - activities")
    print("  - mpdb")
    print("  - vfactdb")
    print("  - activity_summary")
    print("  - facilities")
    print("  - volume_controls")
    
    confirm = input("\n确认继续？(yes/no): ")
    if confirm.lower() != 'yes':
        print("❌ 已取消")
        return
    
    db = SessionLocal()
    
    try:
        # 1. 禁用外键检查
        disable_foreign_key_checks(db)
        
        # 2. 清空表数据
        print("\n🗑️  清空表数据...")
        tables_to_truncate = [
            "volume_controls",
            "vfactdb",
            "mpdb",
            "activity_summary",
            "facilities",
            "activities",
        ]
        
        for table_name in tables_to_truncate:
            truncate_table(db, table_name)
        
        # 3. 执行字段迁移
        migrate_activities_table(db)
        migrate_mpdb_table(db)
        migrate_vfactdb_table(db)
        migrate_activity_summary_table(db)
        migrate_facilities_table(db)
        
        # 4. 更新外键约束
        update_foreign_keys(db)
        
        # 5. 重建索引
        rebuild_indexes(db)
        
        # 6. 启用外键检查
        enable_foreign_key_checks(db)
        
        print("\n" + "=" * 60)
        print("✅ 迁移完成！")
        print("=" * 60)
        print(f"结束时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("\n⚠️  请记得更新以下代码：")
        print("  1. 更新所有模型文件 (backend/app/models/)")
        print("  2. 更新所有API代码 (backend/app/api/)")
        print("  3. 更新所有服务代码 (backend/app/services/)")
        print("  4. 更新前端代码 (frontend/src/)")
        
    except Exception as e:
        print(f"\n❌ 迁移失败: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
        enable_foreign_key_checks(db)
        raise
    finally:
        db.close()

if __name__ == "__main__":
    main()
