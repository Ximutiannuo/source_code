"""
为 mpdb、vfactdb 添加工效分析复合索引，加速工效分析查询

查询模式：date 范围 + scope/subproject/work_package 过滤 + GROUP BY dim
现有 (work_package, date) 仅在 work_package 有值时有效。
按 scope/subproject 过滤时，需 (date, scope) / (date, subproject) 以加速。

用法：在 backend 目录下执行
  python scripts/add_productivity_indexes.py
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

# (索引名, 表名, 列1, 列2?) - 列2 为空时创建单列索引
INDEXES = [
    ("idx_mpdb_work_pkg_date", "mpdb", "work_package", "date"),
    ("idx_vfactdb_work_pkg_date", "vfactdb", "work_package", "date"),
    ("idx_mpdb_date_scope", "mpdb", "date", "scope"),
    ("idx_vfactdb_date_scope", "vfactdb", "date", "scope"),
    ("idx_mpdb_date_subproject", "mpdb", "date", "subproject"),
    ("idx_vfactdb_date_subproject", "vfactdb", "date", "subproject"),
    ("idx_mpdb_date_main_block", "mpdb", "date", "main_block"),
    ("idx_vfactdb_date_main_block", "vfactdb", "date", "main_block"),
    ("idx_mpdb_date_unit", "mpdb", "date", "unit"),
    ("idx_vfactdb_date_unit", "vfactdb", "date", "unit"),
    ("idx_mpdb_date_quarter", "mpdb", "date", "quarter"),
    ("idx_vfactdb_date_quarter", "vfactdb", "date", "quarter"),
    ("idx_mpdb_date_wp", "mpdb", "date", "work_package"),
    ("idx_vfactdb_date_wp", "vfactdb", "date", "work_package"),
    ("idx_mpdb_date_train", "mpdb", "date", "train"),
    ("idx_vfactdb_date_train", "vfactdb", "date", "train"),
    ("idx_rsc_wp", "rsc_defines", "work_package"),
    ("idx_rsc_name", "rsc_defines", "resource_id_name"),
    ("idx_rsc_id", "rsc_defines", "resource_id"),
    # contract_phase 过滤时无索引导致全表扫描，需添加
    ("idx_activity_summary_contract_phase", "activity_summary", "contract_phase"),
]


def main():
    db = SessionLocal()
    try:
        for item in INDEXES:
            idx_name, table_name, col1, col2 = item[0], item[1], item[2], item[3] if len(item) > 3 else None
            try:
                cols = f"{col1}, {col2}" if col2 is not None else col1
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
        logger.info("✓ 工效分析索引迁移完成")
    finally:
        db.close()


if __name__ == "__main__":
    main()
