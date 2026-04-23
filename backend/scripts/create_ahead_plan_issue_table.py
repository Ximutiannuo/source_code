"""
在 projectcontrols 库中创建专项计划「需要解决的问题」表 ahead_plan_issue。
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
from app.models.ahead_plan_issue import AheadPlanIssue, AheadPlanIssueReply, AheadPlanIssueNotification
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def create_tables():
    """创建 ahead_plan_issue、ahead_plan_issue_reply、ahead_plan_issue_notification 表"""
    engine = default_engine
    logger.info("创建专项计划问题相关表（ahead_plan_issue, reply, notification）...")
    Base.metadata.create_all(
        engine,
        tables=[
            AheadPlanIssue.__table__,
            AheadPlanIssueReply.__table__,
            AheadPlanIssueNotification.__table__,
        ],
    )
    logger.info("表已就绪。")


if __name__ == "__main__":
    create_tables()
