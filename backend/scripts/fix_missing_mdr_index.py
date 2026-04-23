"""
快速修复缺失的MDR索引
专门用于修复 ext_eng_db_previous.idx_document_number 缺失的问题
"""
import sys
import os
import time
from sqlalchemy import text

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.database import default_engine

def fix_missing_index():
    """添加缺失的索引"""
    print("=" * 80)
    print("快速修复缺失的MDR索引")
    print("=" * 80)
    print()
    
    with default_engine.connect() as conn:
        conn.execute(text("SET SESSION innodb_lock_wait_timeout = 600"))
        
        # 检查并添加缺失的索引
        indexes_to_add = [
            ("ext_eng_db_previous", "idx_document_number", "document_number"),
        ]
        
        for table, idx_name, column in indexes_to_add:
            print(f"检查 {table}.{idx_name}...")
            
            # 检查索引是否存在
            check_sql = text("""
                SELECT COUNT(*) FROM information_schema.statistics 
                WHERE table_schema = DATABASE() 
                AND table_name = :table_name
                AND index_name = :idx_name
            """)
            result = conn.execute(check_sql, {"table_name": table, "idx_name": idx_name})
            exists = result.scalar() > 0
            
            if exists:
                print(f"  ✅ {table}.{idx_name} 已存在，跳过")
            else:
                print(f"  ❌ {table}.{idx_name} 缺失，正在添加...")
                try:
                    start = time.time()
                    add_sql = f"ALTER TABLE {table} ADD INDEX {idx_name} ({column})"
                    conn.execute(text(add_sql))
                    conn.commit()
                    elapsed = time.time() - start
                    print(f"  ✅ 成功！耗时: {elapsed:.2f} 秒")
                except Exception as e:
                    error_msg = str(e)
                    if "Duplicate key name" in error_msg or "already exists" in error_msg.lower():
                        print(f"  ⚠️  索引已存在（可能刚被其他进程创建）")
                    else:
                        print(f"  ❌ 失败: {error_msg}")
                        raise
        
        print()
        print("=" * 80)
        print("索引修复完成！")
        print("=" * 80)
        print()
        print("建议：")
        print("1. 如果Delta Cache查询仍在运行，可以等待其完成")
        print("2. 如果查询已卡住超过30分钟，可以考虑终止并重新运行同步")
        print("3. 下次同步时，Delta Cache计算应该会快很多")

if __name__ == "__main__":
    try:
        fix_missing_index()
    except Exception as e:
        print(f"❌ 修复失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
