"""
在 projectcontrols 库中创建专项计划表 ahead_plan（事实表：date=周开始日，planned_units=该周计划量）。
表结构含审计戳及 create_by/updated_by/reviewed_at/reviewed_by/approved_at/approved_by/comments/commented_by。
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
from app.models.ahead_plan import AheadPlan
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def create_tables():
    """只创建 ahead_plan 表"""
    engine = default_engine
    logger.info("创建专项计划表 ahead_plan（库: projectcontrols）...")
    Base.metadata.create_all(engine, tables=[AheadPlan.__table__])
    logger.info("ahead_plan 表已就绪。")


if __name__ == "__main__":
    create_tables()
