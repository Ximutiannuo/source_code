"""
迁移脚本：为 users 表添加 responsible_for 列

执行方式：
  cd backend && python -m scripts.migrate_add_user_responsible_for
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


def run_migration():
    engine = get_default_engine()

    with engine.connect() as conn:
        db_name = conn.execute(text("SELECT DATABASE()")).scalar()
        result = conn.execute(
            text(
                """
            SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'responsible_for'
            """
            ),
            {"db": db_name},
        )
        if result.scalar() > 0:
            print("  users 表已有 responsible_for 列，跳过")
            return

        conn.execute(
            text(
                """
            ALTER TABLE users ADD COLUMN responsible_for VARCHAR(200) NULL
            COMMENT '负责内容（供选责任人时参考，如：采购对接、设计审批）'
            AFTER department_id
            """
            )
        )
        conn.commit()
        print("✅ users 表已添加 responsible_for 列")


if __name__ == "__main__":
    print("=" * 60)
    print("迁移：users.responsible_for")
    print("=" * 60)
    try:
        run_migration()
        print("\n=== 迁移完成 ===")
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
