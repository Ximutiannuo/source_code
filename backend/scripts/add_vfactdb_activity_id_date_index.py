"""
为 VFACTDB 添加 (activity_id, date) 复合索引

专项计划汇总「对比实际完成」查询：从 activity_summary（权限+筛选）驱动，按 activity_id 关联 VFACTDB 并限制 date 范围。
(activity_id, date) 可显著加速该 JOIN + 日期范围过滤；若表已很大，建议在低峰期执行。

用法：在 backend 目录下执行
  python scripts/add_vfactdb_activity_id_date_index.py
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

IDX_NAME = "idx_vfactdb_activity_id_date"
TABLE = "vfactdb"
COLS = "activity_id, date"


def main():
    db = SessionLocal()
    try:
        logger.info("创建索引 %s on %s(%s)...", IDX_NAME, TABLE, COLS)
        db.execute(text(f"CREATE INDEX {IDX_NAME} ON {TABLE}({COLS})"))
        db.commit()
        logger.info("✓ 索引 %s 创建成功", IDX_NAME)
    except Exception as e:
        error_msg = str(e)
        if "Duplicate key name" in error_msg or "already exists" in error_msg.lower():
            logger.warning("⚠ 索引 %s 已存在，跳过", IDX_NAME)
            db.rollback()
        else:
            logger.error("✗ 索引创建失败: %s", e)
            db.rollback()
            raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
