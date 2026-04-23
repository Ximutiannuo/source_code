
from sqlalchemy import text
import sys
import os

# 添加后端路径
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.database import default_engine

def fix_resource_ids():
    print("正在修复数据库中的 resource_id...")
    with default_engine.connect() as conn:
        # 1. 修复 budgeted_db
        print("正在更新 budgeted_db...")
        res1 = conn.execute(text("UPDATE budgeted_db SET resource_id = 'GCC_WF' WHERE resource_id IS NULL OR resource_id = ''"))
        print(f"budgeted_db 修复完成，影响行数: {res1.rowcount}")
        
        # 2. 修复 atcompletion_db
        print("正在更新 atcompletion_db...")
        res2 = conn.execute(text("UPDATE atcompletion_db SET resource_id = 'GCC_WF' WHERE resource_id IS NULL OR resource_id = ''"))
        print(f"atcompletion_db 修复完成，影响行数: {res2.rowcount}")
        
        conn.commit()
    print("全部修复完成！")

if __name__ == "__main__":
    fix_resource_ids()
