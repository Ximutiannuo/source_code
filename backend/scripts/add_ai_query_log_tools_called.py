#!/usr/bin/env python3
"""确保 ai_assistant_query_log 表存在且包含 tools_called 列"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.chdir(os.path.join(os.path.dirname(__file__), ".."))

from app.database import get_default_engine, Base
from app.models.ai_assistant_query_log import AIAssistantQueryLog  # noqa: F401 - register table
from sqlalchemy import text

def main():
    engine = get_default_engine()
    with engine.connect() as conn:
        # 检查表是否存在
        r = conn.execute(text("""
            SELECT COUNT(*) FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_assistant_query_log'
        """))
        table_exists = r.scalar() > 0

        if not table_exists:
            conn.commit()
            Base.metadata.create_all(bind=engine, tables=[AIAssistantQueryLog.__table__])
            print("OK: ai_assistant_query_log table created (with tools_called).")
            return

        # 表存在，检查并添加缺失的列
        for col, sql in [
            ("reply", "ALTER TABLE ai_assistant_query_log ADD COLUMN reply TEXT NULL COMMENT 'AI 回复原文，便于优化'"),
            ("tools_called", "ALTER TABLE ai_assistant_query_log ADD COLUMN tools_called TEXT NULL COMMENT 'JSON'"),
            ("feedback", "ALTER TABLE ai_assistant_query_log ADD COLUMN feedback VARCHAR(20) NULL COMMENT 'like/dislike'"),
        ]:
            r2 = conn.execute(text(f"""
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_assistant_query_log' AND COLUMN_NAME = '{col}'
            """))
            if r2.scalar() == 0:
                conn.execute(text(sql))
                conn.commit()
                print(f"OK: {col} column added.")
            else:
                print(f"OK: {col} column already exists.")

if __name__ == "__main__":
    main()
