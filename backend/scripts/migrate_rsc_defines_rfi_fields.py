"""
数据库迁移脚本：修改 RSCDefine 表的 RFI 字段类型
从 String(50) 改为 Text，以支持更长的文本内容
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


def migrate_rsc_defines_rfi_fields():
    """
    修改 rsc_defines 表的 rfi_a, rfi_b, rfi_c 字段类型
    从 VARCHAR(50) 改为 TEXT
    """
    db = SessionLocal()
    try:
        print("=" * 60)
        print("修改 RSCDefine 表的 RFI 字段类型")
        print("=" * 60)
        
        # 检查当前字段类型
        check_sql = """
        SELECT 
            COLUMN_NAME,
            COLUMN_TYPE,
            DATA_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'rsc_defines'
        AND COLUMN_NAME IN ('rfi_a', 'rfi_b', 'rfi_c')
        """
        
        result = db.execute(text(check_sql))
        rows = result.fetchall()
        
        if not rows:
            print("警告：未找到 rfi_a, rfi_b, rfi_c 字段")
            return
        
        print("\n当前字段类型:")
        for row in rows:
            print(f"  {row[0]}: {row[1]}")
        
        # 执行迁移：修改字段类型
        fields_to_migrate = ['rfi_a', 'rfi_b', 'rfi_c']
        
        for field in fields_to_migrate:
            print(f"\n修改字段 {field}...")
            migrate_sql = f"""
            ALTER TABLE rsc_defines 
            MODIFY COLUMN {field} TEXT COMMENT 'RFI ({field[-1].upper()})'
            """
            
            db.execute(text(migrate_sql))
            print(f"  ✓ {field} 字段已修改为 TEXT")
        
        db.commit()
        
        # 再次检查字段类型确认
        result = db.execute(text(check_sql))
        rows = result.fetchall()
        
        print("\n新字段类型:")
        for row in rows:
            print(f"  {row[0]}: {row[1]}")
        
        print("\n" + "=" * 60)
        print("✓ 迁移完成！")
        print("=" * 60)
        
    except Exception as e:
        db.rollback()
        print(f"\n✗ 迁移失败: {e}")
        print(traceback.format_exc())
        raise
    finally:
        db.close()


if __name__ == "__main__":
    try:
        migrate_rsc_defines_rfi_fields()
        print("\n迁移完成！")
    except Exception as e:
        print(f"\n迁移失败: {e}")
        sys.exit(1)

