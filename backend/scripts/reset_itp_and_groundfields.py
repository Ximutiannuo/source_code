"""
重置 itp_definitions 与 rfi_groundfields：删除两表外键、清空数据、重建外键。
用于导出数据有问题时清空后重新执行 import_itp_word。

用法（项目根目录下，激活 myenv 后）:
  python -m backend.scripts.reset_itp_and_groundfields
  python -m backend.scripts.reset_itp_and_groundfields --dry-run  # 仅打印将执行的 SQL，不执行
"""
import sys
import os
import argparse
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))
os.chdir(project_root)

from app.database import load_env_with_fallback

if not os.getenv("DATABASE_URL"):
    load_env_with_fallback()

from app.database import get_default_engine
from sqlalchemy import text


def get_foreign_keys(conn, table: str, db: str):
    """查询表上所有外键约束名"""
    r = conn.execute(
        text("""
            SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = :db AND TABLE_NAME = :tbl AND CONSTRAINT_TYPE = 'FOREIGN KEY'
        """),
        {"db": db, "tbl": table},
    )
    return [row[0] for row in r]


def run(dry_run: bool = False):
    engine = get_default_engine()
    drop_steps = []  # (table, fk_name, sql)
    add_steps = []   # (label, sql)

    with engine.connect() as conn:
        db_name = conn.execute(text("SELECT DATABASE()")).scalar()
        if not db_name:
            print("未选中数据库，请设置连接默认库")
            return
        print(f"当前库: {db_name}")

        # ---------- 1. 动态获取并移除两表上的所有外键 ----------
        for table in ("rfi_groundfields", "itp_definitions"):
            for fk_name in get_foreign_keys(conn, table, db_name):
                drop_steps.append((table, fk_name, f"ALTER TABLE {table} DROP FOREIGN KEY `{fk_name}`"))

        # ---------- 2. 清空数据：用 TRUNCATE 确保彻底清空并重置自增 ----------
        add_steps.append(("truncate", "SET FOREIGN_KEY_CHECKS = 0"))
        add_steps.append(("truncate", "TRUNCATE TABLE rfi_groundfields"))
        add_steps.append(("truncate", "TRUNCATE TABLE itp_definitions"))
        add_steps.append(("truncate", "SET FOREIGN_KEY_CHECKS = 1"))

        # ---------- 3. 重建 itp_definitions 外键 ----------
        add_steps.append(("itp_definitions", "ALTER TABLE itp_definitions ADD CONSTRAINT fk_itp_created_by FOREIGN KEY (created_by) REFERENCES users(id)"))
        add_steps.append(("itp_definitions", "ALTER TABLE itp_definitions ADD CONSTRAINT fk_itp_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)"))

        # ---------- 4. 重建 rfi_groundfields 外键 ----------
        add_steps.append(("rfi_groundfields", "ALTER TABLE rfi_groundfields ADD CONSTRAINT fk_rfi_ground_document FOREIGN KEY (document_number) REFERENCES itp_definitions(document_number)"))
        add_steps.append(("rfi_groundfields", "ALTER TABLE rfi_groundfields ADD CONSTRAINT fk_rfi_ground_parent FOREIGN KEY (parent_id) REFERENCES rfi_groundfields(id)"))

    if dry_run:
        print("[DRY RUN] 将执行以下步骤：")
        for tbl, fk_name, sql in drop_steps:
            print(f"  [DROP FK] {tbl}.{fk_name}")
        for label, sql in add_steps:
            print(f"  [{label}] {sql}")
        return

    with engine.begin() as conn:
        # 1. 删除两表上所有外键（按 information_schema 动态获取，避免漏删）
        for tbl, fk_name, sql in drop_steps:
            conn.execute(text(sql))
            print("  已删除外键:", tbl, "->", fk_name)
        # 2. TRUNCATE 清空（比 DELETE 彻底，并重置自增）
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
        conn.execute(text("TRUNCATE TABLE rfi_groundfields"))
        conn.execute(text("TRUNCATE TABLE itp_definitions"))
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
        print("  已 TRUNCATE rfi_groundfields, itp_definitions")
        # 3. 重建外键
        for label, sql in add_steps:
            if label in ("truncate",):
                continue  # 已在上面执行
            conn.execute(text(sql))
            print("  已重建:", label, "外键")

    print("重置完成。可执行: python -m backend.scripts.import_itp_word \"D:\\Inspections\\ITP\\word\"")


def main():
    parser = argparse.ArgumentParser(description="重置 itp_definitions 与 rfi_groundfields 表及外键")
    parser.add_argument("--dry-run", action="store_true", help="仅打印将执行的 SQL，不执行")
    args = parser.parse_args()
    run(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
