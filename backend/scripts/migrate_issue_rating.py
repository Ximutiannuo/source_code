"""
同步 ahead_plan_issue 表的新字段：rating, confirmed_at, confirmed_by
"""
import sys
import os
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from app.database import load_env_with_fallback
if not os.getenv("DATABASE_URL"):
    load_env_with_fallback()

from app.database import default_engine
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

def migrate():
    from sqlalchemy import text
    engine = default_engine
    with engine.begin() as conn:
        for col, defn in [
            ("rating", "ADD COLUMN rating INT NULL COMMENT '评分 1-5'"),
            ("confirmed_at", "ADD COLUMN confirmed_at DATETIME NULL COMMENT '确认时间'"),
            ("confirmed_by", "ADD COLUMN confirmed_by INT NULL COMMENT '确认人 ID'"),
        ]:
            try:
                r = conn.execute(text(
                    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ahead_plan_issue' AND COLUMN_NAME = :name"
                ), {"name": col})
                if r.fetchone() is None:
                    conn.execute(text(f"ALTER TABLE ahead_plan_issue {defn}"))
                    logger.info("ahead_plan_issue: 已添加列 %s", col)
            except Exception as e:
                logger.warning("列 %s 可能已存在: %s", col, e)
    logger.info("迁移完成。")

if __name__ == "__main__":
    migrate()
