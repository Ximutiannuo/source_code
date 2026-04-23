"""
为已存在的 ahead_plan_issue 表增加 responsible_user_id、priority 列，并创建 reply、notification 表。
若表是新建的（含新字段），可只运行 create_ahead_plan_issue_table.py；本脚本用于已有库升级。
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

from app.database import default_engine, Base
from app.models.ahead_plan_issue import AheadPlanIssueReply, AheadPlanIssueNotification
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def migrate():
    from sqlalchemy import text
    engine = default_engine
    with engine.begin() as conn:
        # 检查并添加列（MySQL）
        for col, defn in [
            ("responsible_user_id", "ADD COLUMN responsible_user_id INT NULL COMMENT '责任人 user.id'"),
            ("priority", "ADD COLUMN priority VARCHAR(20) NOT NULL DEFAULT 'medium' COMMENT 'high, medium, low'"),
        ]:
            try:
                r = conn.execute(text(
                    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ahead_plan_issue' AND COLUMN_NAME = :name"
                ), {"name": col})
                if r.fetchone() is None:
                    conn.execute(text(f"ALTER TABLE ahead_plan_issue {defn}"))
                    logger.info("ahead_plan_issue: 已添加列 %s", col)
            except Exception as e:
                logger.warning("列 %s 可能已存在或非 MySQL: %s", col, e)
        # 可选：添加责任人+状态索引（若不存在）
        try:
            conn.execute(text(
                "CREATE INDEX idx_ahead_plan_issue_responsible ON ahead_plan_issue(responsible_user_id, status)")
            )
            logger.info("已添加索引 idx_ahead_plan_issue_responsible")
        except Exception as e:
            if "Duplicate key name" not in str(e):
                logger.warning("索引可能已存在: %s", e)
    # 创建 reply、notification 表
    Base.metadata.create_all(
        engine,
        tables=[AheadPlanIssueReply.__table__, AheadPlanIssueNotification.__table__],
    )
    logger.info("migrate_ahead_plan_issue 完成。")


if __name__ == "__main__":
    migrate()
