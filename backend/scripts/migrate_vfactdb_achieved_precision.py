"""
数据库迁移脚本：修改 VFACTDB.achieved 字段精度
从 Numeric(18, 2) 改为 Numeric(38, 20) - 完全保留Excel原始精度
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


def migrate_vfactdb_achieved_precision():
    """
    修改 vfactdb 表的 achieved 字段精度
    从 DECIMAL(18,2) 改为 DECIMAL(18,10)
    """
    db = SessionLocal()
    try:
        print("开始迁移：修改 vfactdb.achieved 字段精度...")
        print("从 DECIMAL(18,2) 改为 DECIMAL(38,20) - 完全保留Excel原始精度")
        
        # 检查当前字段类型
        check_sql = """
        SELECT 
            COLUMN_TYPE,
            COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'vfactdb'
        AND COLUMN_NAME = 'achieved'
        """
        
        result = db.execute(text(check_sql))
        row = result.fetchone()
        
        if row:
            current_type = row[0]
            print(f"当前字段类型: {current_type}")
            
            if '38,20' in current_type or '20' in current_type.split(',')[1] if ',' in current_type else '':
                print("字段精度已经是 DECIMAL(38,20) 或更高，无需迁移")
                return
        else:
            print("警告：未找到 vfactdb.achieved 字段")
            return
        
        # 执行迁移：修改字段类型
        # MySQL 的 ALTER TABLE MODIFY COLUMN 语法
        migrate_sql = """
        ALTER TABLE vfactdb 
        MODIFY COLUMN achieved DECIMAL(38,20) COMMENT 'Achieved - 完成工程量（保留20位小数精度，完全保留Excel原始精度）'
        """
        
        print("执行迁移 SQL...")
        db.execute(text(migrate_sql))
        db.commit()
        
        print("✓ 迁移成功！")
        
        # 再次检查字段类型确认
        result = db.execute(text(check_sql))
        row = result.fetchone()
        if row:
            new_type = row[0]
            print(f"新字段类型: {new_type}")
        
    except Exception as e:
        db.rollback()
        print(f"✗ 迁移失败: {e}")
        print(traceback.format_exc())
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 60)
    print("VFACTDB.achieved 字段精度迁移脚本")
    print("=" * 60)
    
    try:
        migrate_vfactdb_achieved_precision()
        print("\n迁移完成！")
    except Exception as e:
        print(f"\n迁移失败: {e}")
        sys.exit(1)

