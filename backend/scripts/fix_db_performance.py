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
    print("正在统一字符集排序规则以恢复索引性能...")
    print("这可能需要 1-2 分钟，请耐心等待...")
    
    # 1. 修改 p6_activities 表的 activity_id 字符集
    db.execute(text("""
        ALTER TABLE p6_activities 
        MODIFY activity_id VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    """))
    print("  ✓ p6_activities.activity_id 已统一为 utf8mb4_unicode_ci")

    # 2. 为相关的 updated_at 字段添加索引（如果不存在）
    tables_to_index = {
        "vfactdb": "updated_at",
        "mpdb": "updated_at",
        "volume_control_quantity": "updated_at"
    }
    
    for table, col in tables_to_index.items():
        try:
            index_name = f"idx_{table}_{col}"
            db.execute(text(f"CREATE INDEX {index_name} ON {table}({col})"))
            print(f"  ✓ 为 {table}.{col} 创建了索引")
        except Exception as e:
            if "Duplicate key name" in str(e):
                print(f"  - {table}.{col} 的索引已存在")
            else:
                print(f"  ⚠️ 为 {table} 创建索引失败: {e}")
    
    db.commit()
    print("\n✅ 数据库层优化完成！现在可以运行同步脚本了。")
except Exception as e:
    print(f"\n❌ 修复失败: {e}")
    print("建议尝试运行: python scripts/kill_long_queries.py 然后再重试。")
finally:
    db.close()
