import sys
import os
import time
from sqlalchemy import text

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.database import default_engine

def optimize_indexes():
    print("=" * 50)
    print("开始执行深度索引优化...")
    print("=" * 50)

    # 这里的目标是让 type_of_dates 的查询完全走索引
    sql_commands = [
        # 1. 为当前表和历史表添加 (document_number, type_of_dates) 的复合索引，优化 JOIN
        "ALTER TABLE ext_eng_db_current ADD INDEX IF NOT EXISTS idx_doc_type (document_number, type_of_dates(50))",
        "ALTER TABLE ext_eng_db_previous ADD INDEX IF NOT EXISTS idx_doc_type (document_number, type_of_dates(50))",
        
        # 2. 为 document_number 添加单列索引（如果缺失）
        "ALTER TABLE ext_eng_db_current ADD INDEX IF NOT EXISTS idx_document_number (document_number)",
        "ALTER TABLE ext_eng_db_previous ADD INDEX IF NOT EXISTS idx_document_number (document_number)",
        
        # 3. 为过滤维度添加索引
        "ALTER TABLE ext_eng_db_current ADD INDEX IF NOT EXISTS idx_filter_dims (originator_code(20), discipline(20))",
        "ALTER TABLE ext_eng_db_previous ADD INDEX IF NOT EXISTS idx_filter_dims (originator_code(20), discipline(20))"
    ]

    with default_engine.connect() as conn:
        conn.execute(text("SET SESSION innodb_lock_wait_timeout = 600"))
        for cmd in sql_commands:
            # MySQL不支持IF NOT EXISTS，需要先检查
            if "IF NOT EXISTS" in cmd:
                # 提取表名和索引名
                import re
                match = re.search(r'ALTER TABLE (\w+) ADD INDEX IF NOT EXISTS (\w+)', cmd)
                if match:
                    table_name = match.group(1)
                    idx_name = match.group(2)
                    # 检查索引是否存在
                    check_sql = text("""
                        SELECT COUNT(*) FROM information_schema.statistics 
                        WHERE table_schema = DATABASE() 
                        AND table_name = :table_name
                        AND index_name = :idx_name
                    """)
                    result = conn.execute(check_sql, {"table_name": table_name, "idx_name": idx_name})
                    if result.scalar() > 0:
                        print(f"  跳过: {table_name}.{idx_name} 已存在")
                        continue
                    # 移除 IF NOT EXISTS
                    cmd = cmd.replace(" IF NOT EXISTS", "")
            
            print(f"正在执行: {cmd}")
            try:
                start = time.time()
                conn.execute(text(cmd))
                conn.commit()
                print(f"  ✅ 成功！耗时: {time.time() - start:.2f} 秒")
            except Exception as e:
                error_msg = str(e)
                if "Duplicate key name" in error_msg or "already exists" in error_msg.lower():
                    print(f"  ⚠️  索引已存在，跳过")
                else:
                    print(f"  ⚠️  失败: {error_msg}")

if __name__ == "__main__":
    optimize_indexes()
