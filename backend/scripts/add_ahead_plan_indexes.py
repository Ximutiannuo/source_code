"""
为 ahead_plan、activity_summary 添加复合索引，解决 504 超时

ahead_plan 查询模式: type_of_plan = X AND date BETWEEN first AND last
  - 现有 idx_ahead_plan_date_type(date, type_of_plan) 对 (type, date) 过滤次优
  - 新增 idx_ahead_plan_type_date_activity(type_of_plan, date, activity_id) 覆盖主过滤+JOIN

activity_summary: facility_filter 按 implement_phase 过滤时无索引
  - 新增 idx_activity_summary_implement_phase(implement_phase)

用法：在 backend 目录下执行
  python scripts/add_ahead_plan_indexes.py
"""
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from sqlalchemy import text
from app.database import SessionLocal
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

INDEXES = [
    ("idx_ahead_plan_type_date_activity", "ahead_plan", "type_of_plan", "date", "activity_id"),
    ("idx_activity_summary_implement_phase", "activity_summary", "implement_phase"),
]


def main():
    db = SessionLocal()
    try:
        for item in INDEXES:
            idx_name = item[0]
            table_name = item[1]
            cols = ", ".join(item[2:])
            try:
                logger.info(f"创建索引 {idx_name} on {table_name}({cols})...")
                db.execute(text(f"CREATE INDEX {idx_name} ON {table_name}({cols})"))
                db.commit()
                logger.info(f"✓ 索引 {idx_name} 创建成功")
            except Exception as e:
                error_msg = str(e)
                if "Duplicate key name" in error_msg or "already exists" in error_msg.lower():
                    logger.warning(f"⚠ 索引 {idx_name} 已存在，跳过")
                    db.rollback()
                else:
                    logger.error(f"✗ 索引 {idx_name} 创建失败: {e}")
                    db.rollback()
                    raise
        logger.info("✓ ahead_plan / facility_filter 索引迁移完成")
    finally:
        db.close()


if __name__ == "__main__":
    main()
