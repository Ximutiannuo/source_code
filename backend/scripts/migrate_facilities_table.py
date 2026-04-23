"""
数据库迁移脚本：重建 facilities 表结构
根据新的 Facility_List.xlsx 列结构重建表
"""
import sys
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from sqlalchemy import text, inspect
from app.database import engine, SessionLocal
from app.models.facility import Facility
import traceback


def migrate_facilities_table():
    """
    重建 facilities 表结构
    1. 备份现有数据（如果有）
    2. 删除旧表
    3. 创建新表
    """
    db = SessionLocal()
    try:
        print("=" * 60)
        print("重建 facilities 表结构")
        print("=" * 60)
        
        # 检查表是否存在
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        if 'facilities' in tables:
            print("\n步骤1: 备份现有数据...")
            # 检查是否有数据
            result = db.execute(text("SELECT COUNT(*) FROM facilities"))
            count = result.scalar()
            print(f"  当前表中有 {count} 条记录")
            
            if count > 0:
                # 创建备份表
                backup_table_sql = """
                CREATE TABLE IF NOT EXISTS facilities_backup AS 
                SELECT * FROM facilities
                """
                db.execute(text(backup_table_sql))
                db.commit()
                print(f"  ✓ 数据已备份到 facilities_backup 表")
            
            print("\n步骤2: 删除旧表...")
            db.execute(text("DROP TABLE IF EXISTS facilities"))
            db.commit()
            print("  ✓ 旧表已删除")
        else:
            print("\n表不存在，直接创建新表...")
        
        print("\n步骤3: 创建新表...")
        # 使用 SQLAlchemy 创建表
        Facility.__table__.create(engine, checkfirst=True)
        db.commit()
        print("  ✓ 新表已创建")
        
        # 验证表结构
        print("\n步骤4: 验证表结构...")
        columns = inspector.get_columns('facilities')
        print("  新表字段:")
        for col in columns:
            print(f"    - {col['name']}: {col['type']}")
        
        print("\n" + "=" * 60)
        print("✓ 迁移完成！")
        print("=" * 60)
        
        if count > 0:
            print(f"\n注意: 原有 {count} 条数据已备份到 facilities_backup 表")
            print("如果需要恢复数据，请手动处理备份表")
        
    except Exception as e:
        db.rollback()
        print(f"\n✗ 迁移失败: {e}")
        print(traceback.format_exc())
        raise
    finally:
        db.close()


if __name__ == "__main__":
    try:
        migrate_facilities_table()
        print("\n迁移完成！")
    except Exception as e:
        print(f"\n迁移失败: {e}")
        sys.exit(1)

