"""
检查MySQL状态，查找阻塞的查询和锁表情况
"""
import sys
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from sqlalchemy import text
from app.database import SessionLocal


def check_mysql_status():
    """检查MySQL状态"""
    db = SessionLocal()
    
    try:
        print("=" * 60)
        print("检查MySQL状态")
        print("=" * 60)
        
        # 1. 检查正在运行的查询
        print("\n1. 正在运行的查询（超过5秒的）：")
        running_queries = db.execute(text("""
            SELECT 
                id,
                user,
                host,
                db,
                command,
                time,
                state,
                LEFT(info, 100) AS query_preview
            FROM information_schema.processlist
            WHERE command != 'Sleep' AND time > 5
            ORDER BY time DESC
        """)).fetchall()
        
        if running_queries:
            for row in running_queries:
                print(f"  ID: {row[0]}, 用户: {row[1]}, 耗时: {row[5]}秒")
                print(f"  状态: {row[6]}")
                print(f"  查询: {row[7]}")
                print()
        else:
            print("  ✓ 没有长时间运行的查询")
        
        # 2. 检查表锁
        print("\n2. 表锁情况：")
        table_locks = db.execute(text("""
            SELECT 
                table_schema,
                table_name,
                engine,
                table_rows,
                data_length,
                index_length
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
            AND table_name LIKE 'activity_summary%'
            ORDER BY table_name
        """)).fetchall()
        
        for row in table_locks:
            print(f"  表: {row[1]}")
            print(f"  行数: {row[3]:,}")
            print(f"  数据大小: {row[4] / 1024 / 1024:.2f} MB" if row[4] else "  数据大小: 0 MB")
            print()
        
        # 3. 检查InnoDB状态（锁等待）
        print("\n3. InnoDB锁等待情况：")
        try:
            innodb_status = db.execute(text("SHOW ENGINE INNODB STATUS")).fetchone()
            if innodb_status:
                status_text = innodb_status[2] if len(innodb_status) > 2 else str(innodb_status)
                if "LOCK WAIT" in status_text or "lock wait" in status_text.lower():
                    print("  ⚠️ 检测到锁等待！")
                    # 提取锁等待信息
                    lines = status_text.split('\n')
                    in_lock_section = False
                    for line in lines:
                        if "LOCK WAIT" in line or "lock wait" in line.lower():
                            in_lock_section = True
                        if in_lock_section:
                            print(f"    {line}")
                            if "---TRANSACTION" in line and in_lock_section:
                                break
                else:
                    print("  ✓ 没有检测到锁等待")
        except Exception as e:
            print(f"  ⚠️ 无法获取InnoDB状态: {e}")
        
        # 4. 检查是否有未提交的事务
        print("\n4. 检查未提交的事务：")
        transactions = db.execute(text("""
            SELECT 
                trx_id,
                trx_state,
                trx_started,
                TIMESTAMPDIFF(SECOND, trx_started, NOW()) AS duration_seconds,
                trx_tables_locked,
                trx_rows_locked
            FROM information_schema.innodb_trx
            ORDER BY trx_started
        """)).fetchall()
        
        if transactions:
            for row in transactions:
                print(f"  事务ID: {row[0]}")
                print(f"  状态: {row[1]}")
                print(f"  开始时间: {row[2]}")
                print(f"  持续时间: {row[3]}秒")
                print(f"  锁定表数: {row[4]}")
                print(f"  锁定行数: {row[5]}")
                print()
        else:
            print("  ✓ 没有未提交的事务")
        
        # 5. 提供建议
        print("\n" + "=" * 60)
        print("建议操作：")
        print("=" * 60)
        
        if running_queries:
            print("\n如果发现长时间运行的查询，可以：")
            print("1. 等待查询完成（如果接近完成）")
            print("2. 或者杀死阻塞的查询（使用下面的脚本）")
            print("\n杀死查询的SQL（替换<query_id>为实际的ID）：")
            print("  KILL <query_id>;")
        
        if transactions:
            print("\n如果发现长时间未提交的事务，可以：")
            print("1. 检查是否有其他脚本在运行")
            print("2. 或者杀死相关连接")
        
        print("\n或者，直接尝试杀死所有长时间运行的查询：")
        print("  python scripts/kill_long_queries.py")
        
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        import traceback
        print(traceback.format_exc())
    finally:
        db.close()


if __name__ == "__main__":
    check_mysql_status()

