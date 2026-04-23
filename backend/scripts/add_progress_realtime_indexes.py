"""
为进度实时查询（get_progress_realtime）添加索引建议

实时查询路径：activity_summary WHERE implement_phase/contract_phase/... + JOIN budgeted_db/atcompletion_db/vfactdb/owf_db ON activity_id
- activity_summary: 当前有 idx_activity_summary_implement_phase，缺 contract_phase 单列及 (implement_phase, contract_phase) 复合，组合条件时能显著加速
- budgeted_db / atcompletion_db: 已有 (activity_id, resource_id, date)，满足 JOIN + resource_id='GCC_WF' 过滤

用法（在 backend 目录或项目根目录执行）：
  python scripts/add_progress_realtime_indexes.py
"""
import sys
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text
from app.database import SessionLocal
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# (索引名, 表名, 列...) — 覆盖索引让 WHERE resource_id='GCC_WF' GROUP BY date 可仅扫索引
INDEXES = [
    ("idx_activity_summary_contract_phase", "activity_summary", "contract_phase"),
    ("idx_activity_summary_impl_contract", "activity_summary", "implement_phase", "contract_phase"),
    ("idx_budgeted_resource_date_units", "budgeted_db", "resource_id", "date", "budgeted_units"),
    ("idx_atcompletion_resource_date_units", "atcompletion_db", "resource_id", "date", "atcompletion_units"),
]


def main():
    db = SessionLocal()
    try:
        for item in INDEXES:
            idx_name, table_name, *cols = item
            cols_str = ", ".join(cols)
            try:
                logger.info("创建索引 %s on %s(%s)...", idx_name, table_name, cols_str)
                db.execute(text(f"CREATE INDEX {idx_name} ON {table_name}({cols_str})"))
                db.commit()
                logger.info("✓ 索引 %s 创建成功", idx_name)
            except Exception as e:
                err = str(e)
                if "Duplicate key name" in err or "already exists" in err.lower():
                    logger.warning("⚠ 索引 %s 已存在，跳过", idx_name)
                    db.rollback()
                else:
                    logger.error("✗ 索引 %s 创建失败: %s", idx_name, e)
                    db.rollback()
                    raise
        logger.info("✓ 进度实时查询相关索引处理完成")
    finally:
        db.close()


if __name__ == "__main__":
    main()
