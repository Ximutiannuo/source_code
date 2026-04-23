"""
ITP 命名迁移：itp_definitions 主键改为 document_number；rfi_groundfields 用 document_number + itp_id(行号)；去掉 code；inspectiondb 只存 document_number。
会检测各表当前字段，只执行尚未完成的步骤（可重复执行）。

执行：cd backend && python scripts/migrate_itp_document_number.py
依赖：DATABASE_URL 或 .env 已配置
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

from app.database import get_default_engine
from sqlalchemy import text


def get_columns(conn, table: str, db: str) -> set:
    """返回表 table 的列名集合"""
    r = conn.execute(
        text("""
            SELECT COLUMN_NAME FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = :db AND TABLE_NAME = :tbl
        """),
        {"db": db, "tbl": table},
    )
    return {row[0] for row in r}


def has_fk(conn, table: str, fk_name: str, db: str) -> bool:
    """是否存在指定名称的外键"""
    r = conn.execute(
        text("""
            SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = :db AND TABLE_NAME = :tbl AND CONSTRAINT_NAME = :fk AND CONSTRAINT_TYPE = 'FOREIGN KEY'
        """),
        {"db": db, "tbl": table, "fk": fk_name},
    )
    return r.fetchone() is not None


def has_unique_or_pk_on_column(conn, table: str, column: str, db: str) -> bool:
    """表 table 的 column 是否在某个 UNIQUE 或 PRIMARY KEY 中"""
    r = conn.execute(
        text("""
            SELECT 1 FROM information_schema.KEY_COLUMN_USAGE k
            JOIN information_schema.TABLE_CONSTRAINTS c
              ON c.TABLE_SCHEMA = k.TABLE_SCHEMA AND c.TABLE_NAME = k.TABLE_NAME AND c.CONSTRAINT_NAME = k.CONSTRAINT_NAME
            WHERE k.TABLE_SCHEMA = :db AND k.TABLE_NAME = :tbl AND k.COLUMN_NAME = :col
              AND c.CONSTRAINT_TYPE IN ('UNIQUE', 'PRIMARY KEY')
        """),
        {"db": db, "tbl": table, "col": column},
    )
    return r.fetchone() is not None


def run():
    engine = get_default_engine()
    db_name = None

    with engine.connect() as conn:
        db_name = conn.execute(text("SELECT DATABASE()")).scalar()
        if not db_name:
            print("未选中数据库，请设置连接默认库")
            return
        print(f"当前库: {db_name}")

        # 检查 itp_definitions 是否存在
        t = conn.execute(
            text("SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'itp_definitions'"),
            {"db": db_name},
        ).fetchone()
        if not t:
            print("  itp_definitions 表不存在，请先执行 alter_rfi_groundfields_add_itp.sql 创建表。")
            return

        # ---------- 1. itp_definitions: 增加 document_number，用 id 做 WHERE 避免 safe update ----------
        itp_cols = get_columns(conn, "itp_definitions", db_name)
        if "document_number" not in itp_cols and "itp_no" in itp_cols:
            conn.execute(text("""
                ALTER TABLE itp_definitions
                ADD COLUMN document_number VARCHAR(255) NULL COMMENT 'ITP 文档编号（主键替代 id）' AFTER id
            """))
            conn.commit()
            # 用主键列做 WHERE，满足 safe update
            conn.execute(text("UPDATE itp_definitions SET document_number = itp_no WHERE id IS NOT NULL"))
            conn.execute(text("ALTER TABLE itp_definitions MODIFY COLUMN document_number VARCHAR(255) NOT NULL"))
            conn.execute(text("ALTER TABLE itp_definitions ADD UNIQUE KEY uk_itp_document_number (document_number)"))
            conn.commit()
            print("  itp_definitions: 已添加 document_number 并回填")
        elif "document_number" in itp_cols:
            print("  itp_definitions: document_number 已存在，跳过")

        # 确保 itp_definitions.document_number 有唯一约束（外键引用需要）
        if "document_number" in get_columns(conn, "itp_definitions", db_name):
            if not has_unique_or_pk_on_column(conn, "itp_definitions", "document_number", db_name):
                try:
                    conn.execute(text("ALTER TABLE itp_definitions ADD UNIQUE KEY uk_itp_document_number (document_number)"))
                    conn.commit()
                    print("  itp_definitions: 已为 document_number 添加 UNIQUE 约束")
                except Exception as e:
                    if "Duplicate" in str(e) or "already exists" in str(e).lower():
                        print("  itp_definitions: document_number 已有唯一约束")
                    else:
                        raise

        # ---------- 2. rfi_groundfields: itp_id(FK) -> document_number，no -> itp_id，删 code ----------
        rfi_cols = get_columns(conn, "rfi_groundfields", db_name)
        if "document_number" not in rfi_cols and "itp_id" in rfi_cols:
            conn.execute(text("""
                ALTER TABLE rfi_groundfields
                ADD COLUMN document_number VARCHAR(255) NULL COMMENT '所属 ITP 文档编号' AFTER itp_id
            """))
            conn.commit()
            # 用主键做 WHERE
            conn.execute(text("""
                UPDATE rfi_groundfields g
                INNER JOIN itp_definitions t ON g.itp_id = t.id
                SET g.document_number = t.document_number
                WHERE g.id IS NOT NULL
            """))
            conn.commit()
            if has_fk(conn, "rfi_groundfields", "fk_rfi_ground_itp", db_name):
                conn.execute(text("ALTER TABLE rfi_groundfields DROP FOREIGN KEY fk_rfi_ground_itp"))
            try:
                conn.execute(text("ALTER TABLE rfi_groundfields DROP INDEX idx_rfi_ground_itp_level"))
            except Exception:
                pass
            conn.execute(text("ALTER TABLE rfi_groundfields DROP COLUMN itp_id"))
            conn.execute(text("ALTER TABLE rfi_groundfields ADD INDEX idx_rfi_ground_doc_level (document_number, level, sort_order)"))
            conn.execute(text("""
                ALTER TABLE rfi_groundfields ADD CONSTRAINT fk_rfi_ground_document
                FOREIGN KEY (document_number) REFERENCES itp_definitions(document_number)
            """))
            conn.commit()
            print("  rfi_groundfields: 已用 document_number 替代 itp_id(FK)")
        elif "document_number" in rfi_cols:
            print("  rfi_groundfields: document_number 已存在，跳过")

        rfi_cols = get_columns(conn, "rfi_groundfields", db_name)
        if "no" in rfi_cols:
            conn.execute(text("""
                ALTER TABLE rfi_groundfields CHANGE COLUMN no itp_id VARCHAR(50) NULL
                COMMENT 'Level3: 行号，如 1.1, 1.2（与 ground_of_works 一致）'
            """))
            conn.commit()
            print("  rfi_groundfields: 已重命名 no -> itp_id")

        rfi_cols = get_columns(conn, "rfi_groundfields", db_name)
        if "code" in rfi_cols:
            try:
                conn.execute(text("ALTER TABLE rfi_groundfields DROP INDEX uk_rfi_ground_code"))
            except Exception:
                pass
            conn.execute(text("ALTER TABLE rfi_groundfields DROP COLUMN code"))
            conn.commit()
            try:
                conn.execute(text("ALTER TABLE rfi_groundfields ADD UNIQUE KEY uk_rfi_ground_doc_itp (document_number, itp_id)"))
            except Exception:
                pass
            conn.commit()
            print("  rfi_groundfields: 已删除 code，并添加 uk_rfi_ground_doc_itp（若不存在）")

        # ---------- 3. inspectiondb: itp_id/itp_no -> document_number ----------
        insp_cols = get_columns(conn, "inspectiondb", db_name)
        if "document_number" not in insp_cols:
            after = "matched_drawing_number"
            if "itp_no" in insp_cols:
                after = "itp_no"
            elif "itp_id" in insp_cols:
                after = "itp_id"
            conn.execute(text(f"""
                ALTER TABLE inspectiondb
                ADD COLUMN document_number VARCHAR(255) NULL COMMENT '关联 ITP 文档编号' AFTER {after}
            """))
            conn.commit()
            # 用主键做 WHERE
            if "itp_id" in insp_cols:
                conn.execute(text("""
                    UPDATE inspectiondb i
                    INNER JOIN itp_definitions t ON i.itp_id = t.id
                    SET i.document_number = t.document_number
                    WHERE i.id IS NOT NULL
                """))
            if "itp_no" in insp_cols:
                conn.execute(text("""
                    UPDATE inspectiondb SET document_number = itp_no
                    WHERE id IS NOT NULL AND (document_number IS NULL OR document_number = '') AND itp_no IS NOT NULL AND itp_no != ''
                """))
            conn.commit()
            if has_fk(conn, "inspectiondb", "fk_inspectiondb_itp", db_name):
                conn.execute(text("ALTER TABLE inspectiondb DROP FOREIGN KEY fk_inspectiondb_itp"))
            try:
                conn.execute(text("ALTER TABLE inspectiondb DROP INDEX idx_inspectiondb_itp_id"))
            except Exception:
                pass
            if "itp_id" in get_columns(conn, "inspectiondb", db_name):
                conn.execute(text("ALTER TABLE inspectiondb DROP COLUMN itp_id"))
            if "itp_no" in get_columns(conn, "inspectiondb", db_name):
                conn.execute(text("ALTER TABLE inspectiondb DROP COLUMN itp_no"))
            conn.execute(text("ALTER TABLE inspectiondb ADD INDEX idx_inspectiondb_document (document_number)"))
            conn.execute(text("""
                ALTER TABLE inspectiondb ADD CONSTRAINT fk_inspectiondb_document
                FOREIGN KEY (document_number) REFERENCES itp_definitions(document_number)
            """))
            conn.commit()
            print("  inspectiondb: 已用 document_number 替代 itp_id/itp_no")
        else:
            print("  inspectiondb: document_number 已存在，跳过")

        # ---------- 4. itp_definitions: 主键改为 document_number，删 id / itp_no ----------
        itp_cols = get_columns(conn, "itp_definitions", db_name)
        if "id" in itp_cols and "document_number" in itp_cols:
            if has_fk(conn, "itp_definitions", "fk_itp_created_by", db_name):
                conn.execute(text("ALTER TABLE itp_definitions DROP FOREIGN KEY fk_itp_created_by"))
            if has_fk(conn, "itp_definitions", "fk_itp_updated_by", db_name):
                conn.execute(text("ALTER TABLE itp_definitions DROP FOREIGN KEY fk_itp_updated_by"))
            # 先去掉 id 的 AUTO_INCREMENT，否则 DROP PRIMARY KEY 会报 1075
            conn.execute(text("ALTER TABLE itp_definitions MODIFY COLUMN id INT NOT NULL"))
            conn.execute(text("ALTER TABLE itp_definitions DROP PRIMARY KEY"))
            conn.execute(text("ALTER TABLE itp_definitions ADD PRIMARY KEY (document_number)"))
            try:
                conn.execute(text("ALTER TABLE itp_definitions DROP INDEX uk_itp_document_number"))
            except Exception:
                pass
            conn.execute(text("ALTER TABLE itp_definitions DROP COLUMN id"))
            if "itp_no" in get_columns(conn, "itp_definitions", db_name):
                conn.execute(text("ALTER TABLE itp_definitions DROP COLUMN itp_no"))
            conn.execute(text("ALTER TABLE itp_definitions ADD CONSTRAINT fk_itp_created_by FOREIGN KEY (created_by) REFERENCES users(id)"))
            conn.execute(text("ALTER TABLE itp_definitions ADD CONSTRAINT fk_itp_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)"))
            conn.commit()
            print("  itp_definitions: 主键已改为 document_number，已删除 id / itp_no")
        elif "id" not in itp_cols:
            print("  itp_definitions: 已是 document_number 主键，跳过")

        # ---------- 5. inspectiondb: 新增 rfi_short_id、rfi_inspection_location ----------
        insp_cols = get_columns(conn, "inspectiondb", db_name)
        if "rfi_short_id" not in insp_cols:
            conn.execute(text("""
                ALTER TABLE inspectiondb ADD COLUMN rfi_short_id VARCHAR(50) NULL
                COMMENT 'RFI 短编码，取自 rfi_id 最后一段，如 99237' AFTER rfi_id
            """))
            conn.execute(text("ALTER TABLE inspectiondb ADD INDEX idx_inspectiondb_rfi_short_id (rfi_short_id)"))
            conn.execute(text("""
                UPDATE inspectiondb SET rfi_short_id = TRIM(SUBSTRING_INDEX(rfi_id, '-', -1))
                WHERE rfi_id IS NOT NULL AND TRIM(rfi_id) != '' AND (rfi_short_id IS NULL OR rfi_short_id = '')
            """))
            conn.commit()
            print("  inspectiondb: 已添加 rfi_short_id 并回填")
        if "rfi_inspection_location" not in insp_cols:
            conn.execute(text("""
                ALTER TABLE inspectiondb ADD COLUMN rfi_inspection_location VARCHAR(255) NULL
                COMMENT '验收地点' AFTER rfi_description
            """))
            conn.commit()
            print("  inspectiondb: 已添加 rfi_inspection_location")

    print("迁移检查完成。")


if __name__ == "__main__":
    run()
