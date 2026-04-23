import sys
import os
import time
from sqlalchemy import text

# 将项目根目录添加到路径中以导入 app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.database import default_engine

def add_indexes():
    """
    为 MDR 相关大表添加索引，优化查询性能
    """
    print("=" * 50)
    print("开始为 MDR 数据表添加索引...")
    print("注意：对于 300w+ 数据的表，这可能需要几分钟时间，请耐心等待。")
    print("=" * 50)

    indexes_to_add = [
        # 为当前表添加索引
        ("ext_eng_db_current", "idx_mdr_lookup", "(originator_code, discipline, document_type)"),
        ("ext_eng_db_current", "idx_mdr_dates", "(type_of_dates, dates)"),
        ("ext_eng_db_current", "idx_doc_num", "(document_number)"),
        
        # 为历史表添加索引
        ("ext_eng_db_previous", "idx_mdr_lookup", "(originator_code, discipline, document_type)"),
        ("ext_eng_db_previous", "idx_mdr_dates", "(type_of_dates, dates)"),
        ("ext_eng_db_previous", "idx_doc_num", "(document_number)"),
    ]

    with default_engine.connect() as conn:
        # 设置较大的超时时间 (10分钟)
        conn.execute(text("SET SESSION innodb_lock_wait_timeout = 600"))
        
        for table, index_name, columns in indexes_to_add:
            print(f"检查 {table} 的索引 {index_name}...")
            
            # 检查索引是否已存在
            check_sql = text(f"SHOW INDEX FROM {table} WHERE Key_name = '{index_name}'")
            exists = conn.execute(check_sql).fetchone()
            
            if exists:
                print(f"  - 索引 {index_name} 已存在，跳过。")
                continue
                
            print(f"  - 正在添加索引 {index_name} 到 {table} {columns}...")
            start_time = time.time()
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD INDEX {index_name} {columns}"))
                conn.commit()
                duration = time.time() - start_time
                print(f"  ✅ 成功！耗时: {duration:.2f} 秒")
            except Exception as e:
                print(f"  ❌ 失败: {str(e)}")
                conn.rollback()

    print("\n" + "=" * 50)
    print("所有索引操作处理完毕。")
    print("=" * 50)

if __name__ == "__main__":
    add_indexes()
