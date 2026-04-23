"""
修复迁移后的索引问题
处理联合索引创建失败的情况
"""

import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import text
from app.database import engine, SessionLocal

def main():
    """修复索引"""
    print("=" * 60)
    print("修复迁移后的索引")
    print("=" * 60)
    
    db = SessionLocal()
    
    try:
        # 修复联合索引
        indexes_to_create = [
            ("mpdb", "idx_mpdb_date_activity_id", ["date", "activity_id"]),
            ("vfactdb", "idx_vfactdb_date_activity_id", ["date", "activity_id"]),
        ]
        
        for table_name, index_name, columns in indexes_to_create:
            try:
                # 先检查索引是否已存在
                check_sql = f"""
                SELECT COUNT(*) as cnt 
                FROM information_schema.STATISTICS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = '{table_name}' 
                AND INDEX_NAME = '{index_name}'
                """
                result = db.execute(text(check_sql)).fetchone()
                
                if result and result[0] > 0:
                    print(f"  索引 {table_name}.{index_name} 已存在，跳过")
                    continue
                
                # 创建联合索引
                columns_str = ", ".join([f"`{col}`" for col in columns])
                create_sql = f"CREATE INDEX `{index_name}` ON `{table_name}` ({columns_str})"
                print(f"  创建索引 {table_name}.{index_name}...")
                db.execute(text(create_sql))
                db.commit()
                print(f"  成功")
            except Exception as e:
                print(f"  失败: {str(e)}")
                db.rollback()
        
        print("\n" + "=" * 60)
        print("索引修复完成！")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n修复失败: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()

