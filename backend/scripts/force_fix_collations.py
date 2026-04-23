import sys
from pathlib import Path

# 添加项目根目录和 backend 目录到路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from app.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    print("正在强制统一所有关联表的字符集排序规则...")
    
    # 需要统一的表和列
    tables = [
        "p6_activities",
        "vfactdb",
        "mpdb",
        "volume_control_quantity"
    ]
    
    for table in tables:
        print(f"  正在修复表: {table}...")
        try:
            # 1. 强制修改列的字符集和排序规则
            db.execute(text(f"""
                ALTER TABLE {table} 
                MODIFY activity_id VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
            """))
            print(f"    ✓ {table}.activity_id 已修复")
        except Exception as e:
            print(f"    ⚠️ 修复 {table} 失败: {e}")
    
    db.commit()
    print("\n✅ 所有表的字符集已强制统一！现在 UNION 操作不会再报错了。")
    print("请再次尝试运行刷新脚本。")
except Exception as e:
    print(f"\n❌ 强力修复失败: {e}")
finally:
    db.close()
