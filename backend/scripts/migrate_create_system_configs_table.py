"""
数据库迁移脚本：创建 system_configs 表
用于存储系统配置参数
"""
import sys
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from sqlalchemy import text, inspect
from app.database import engine, SessionLocal, Base
from app.models.config import SystemConfig
import traceback


def migrate_create_system_configs_table():
    """
    创建 system_configs 表
    1. 检查表是否已存在
    2. 如果不存在，创建表
    3. 如果存在，检查结构是否正确
    """
    db = SessionLocal()
    try:
        print("=" * 60)
        print("创建 system_configs 表")
        print("=" * 60)
        
        inspector = inspect(engine)
        table_exists = "system_configs" in inspector.get_table_names()
        
        if table_exists:
            print("system_configs 表已存在，检查结构...")
            columns = {col['name']: col for col in inspector.get_columns("system_configs")}
            required_columns = ['id', 'key', 'value', 'value_type', 'description', 'category', 'is_active']
            
            missing_columns = [col for col in required_columns if col not in columns]
            if missing_columns:
                print(f"警告: 缺少以下列: {missing_columns}")
                print("建议: 删除表后重新创建，或手动添加缺失的列")
            else:
                print("  ✓ 表结构完整")
        else:
            print("创建 system_configs 表...")
            SystemConfig.__table__.create(engine, checkfirst=True)
            print("  ✓ system_configs 表创建成功")
        
        print("\n" + "=" * 60)
        print("system_configs 表创建完成")
        print("=" * 60)
        return True
        
    except Exception as e:
        db.rollback()
        print(f"\n错误: {e}")
        print(f"详细信息: {traceback.format_exc()}")
        return False
    finally:
        db.close()


if __name__ == "__main__":
    success = migrate_create_system_configs_table()
    sys.exit(0 if success else 1)

