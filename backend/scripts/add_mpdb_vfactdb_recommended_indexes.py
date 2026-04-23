"""
为 MPDB、VFACTDB 添加 (date, activity_id, update_method) 复合索引

recommended-activity-ids 查询模式：按 date 范围 + activity_id 非空 + update_method 条件过滤
  - 现有 idx_*_date_activity_id 仅覆盖 (date, activity_id)
  - 新增 idx_*_date_activity_update 覆盖 (date, activity_id, update_method)，加速推荐入池查询

用法：在 backend 目录下执行
  python scripts/add_mpdb_vfactdb_recommended_indexes.py
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
    ("idx_mpdb_date_activity_update", "mpdb", "date", "activity_id", "update_method"),
    ("idx_vfactdb_date_activity_update", "vfactdb", "date", "activity_id", "update_method"),
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
        logger.info("✓ MPDB/VFACTDB recommended-activity-ids 索引迁移完成")
    finally:
        db.close()


if __name__ == "__main__":
    main()
