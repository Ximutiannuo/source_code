"""
手动创建 welding_sync_logs 表
如果表已存在，则跳过
"""
from app.database import engine, Base
from app.models.welding_sync_log import WeldingSyncLog

# 创建表
try:
    WeldingSyncLog.__table__.create(bind=engine, checkfirst=True)
    print("✅ welding_sync_logs 表创建成功（或已存在）")
except Exception as e:
    print(f"❌ 创建表失败: {e}")

