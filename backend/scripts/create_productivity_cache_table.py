"""
创建工效预聚合缓存表 productivity_cache / productivity_cache_wp

用法：
  python scripts/create_productivity_cache_table.py
  python scripts/create_productivity_cache_table.py --refresh   # 建表后立即执行一次全量刷新
"""
import sys
import argparse
from pathlib import Path

project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from sqlalchemy import text
from app.database import SessionLocal
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_tables(db) -> None:
    """创建 productivity_cache 和 productivity_cache_wp 表"""
    ddl_main = """
    CREATE TABLE IF NOT EXISTS productivity_cache (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filter_key VARCHAR(512) NOT NULL DEFAULT '',
        `date` DATE NOT NULL,
        group_by VARCHAR(64) NOT NULL,
        dim_val VARCHAR(512) NOT NULL,
        mp DECIMAL(18,4) DEFAULT 0,
        achieved DECIMAL(18,4) DEFAULT 0,
        mp_prod DECIMAL(18,4) DEFAULT 0,
        mp_nonprod DECIMAL(18,4) DEFAULT 0,
        updated_at DATETIME,
        INDEX idx_prod_cache_key_date (filter_key(191), `date`),
        INDEX idx_prod_cache_lookup (filter_key(191), group_by(32), `date`, dim_val(191))
    ) COMMENT '工效预聚合缓存'
    """
    ddl_wp = """
    CREATE TABLE IF NOT EXISTS productivity_cache_wp (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filter_key VARCHAR(512) NOT NULL DEFAULT '',
        `date` DATE NOT NULL,
        group_by VARCHAR(64) NOT NULL,
        dim_val VARCHAR(512) NOT NULL,
        work_package VARCHAR(128) NOT NULL,
        mp DECIMAL(18,4) DEFAULT 0,
        updated_at DATETIME,
        INDEX idx_prod_cache_wp_lookup (filter_key(191), group_by(32), `date`, dim_val(191), work_package(64))
    ) COMMENT '工效按工作包预聚合(用于 weighted_norms)'
    """
    db.execute(text(ddl_main))
    db.execute(text(ddl_wp))
    db.commit()
    logger.info("✓ productivity_cache 与 productivity_cache_wp 表创建完成")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh", action="store_true", help="建表后执行一次全量刷新")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        create_tables(db)
        if args.refresh:
            logger.info("执行工效缓存全量刷新...")
            from app.services.productivity_service import refresh_productivity_cache_all
            total = refresh_productivity_cache_all(db, log_progress=True)
            logger.info(f"✓ 工效缓存刷新完成: 共 {total} 行")
    finally:
        db.close()


if __name__ == "__main__":
    main()
