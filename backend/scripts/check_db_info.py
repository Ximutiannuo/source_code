import sys
import os
from sqlalchemy import text

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.database import default_engine

def check_db_info():
    with default_engine.connect() as conn:
        # 1. 检查表和列的字符集/排序规则
        print("--- Table Collation Info ---")
        res = conn.execute(text("SELECT table_name, table_collation FROM information_schema.tables WHERE table_schema = 'projectcontrols' AND table_name IN ('ext_eng_db_current', 'ext_eng_db_previous')"))
        for row in res:
            print(f"Table: {row[0]}, Collation: {row[1]}")
            
        print("\n--- Column Collation Info (type_of_dates) ---")
        res = conn.execute(text("SELECT table_name, column_name, collation_name FROM information_schema.columns WHERE table_schema = 'projectcontrols' AND table_name IN ('ext_eng_db_current') AND column_name = 'type_of_dates'"))
        for row in res:
            print(f"Table: {row[0]}, Column: {row[1]}, Collation: {row[2]}")

        # 2. 检查 type_of_dates 的实际值示例
        print("\n--- type_of_dates Value Samples (Top 20) ---")
        res = conn.execute(text("SELECT type_of_dates, COUNT(*) as cnt FROM ext_eng_db_current GROUP BY type_of_dates ORDER BY cnt DESC LIMIT 20"))
        for row in res:
            print(f"Value: '{row[0]}', Count: {row[1]}")

if __name__ == "__main__":
    check_db_info()
