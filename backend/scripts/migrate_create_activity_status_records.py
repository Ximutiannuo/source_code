"""
迁移脚本：创建 activity_status_records 表
"""
import sys
import os
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from app.database import engine, Base
from app.models.activity_status import ActivityStatusRecord

def migrate():
    print("正在创建 activity_status_records 表...")
    try:
        # 仅创建不存在的表
        ActivityStatusRecord.__table__.create(engine, checkfirst=True)
        print("  ✓ 表 activity_status_records 创建成功（或已存在）")
    except Exception as e:
        print(f"  ✗ 创建表失败: {e}")
        sys.exit(1)

if __name__ == "__main__":
    migrate()
