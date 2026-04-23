import sys
import os
from sqlalchemy import text

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.database import default_engine

def kill_stale_connections():
    print("=" * 50)
    print("正在诊断并清理数据库锁定进程...")
    print("=" * 50)

    with default_engine.connect() as conn:
        # 1. 设置较大的等待超时，确保能执行诊断
        conn.execute(text("SET SESSION innodb_lock_wait_timeout = 10"))
        
        # 2. 检查是否有正在运行的同步任务日志，将其强制标记为失败
        print("清理 mdr_sync_log 中的僵死任务状态...")
        conn.execute(text("UPDATE mdr_sync_log SET status = 'failed', message = '脚本手动清理' WHERE status = 'running'"))
        conn.commit()

        # 3. 查找长时间运行的事务（主要针对 projectcontrols 数据库）
        print("查找卡住的数据库进程...")
        process_sql = """
            SELECT ID, USER, HOST, DB, COMMAND, TIME, STATE, INFO 
            FROM information_schema.processlist 
            WHERE DB = 'projectcontrols' AND TIME > 60 AND COMMAND != 'Sleep'
        """
        processes = conn.execute(text(process_sql)).fetchall()
        
        if not processes:
            print("✅ 未发现明显的僵死进程。")
        else:
            for p in processes:
                pid = p[0]
                info = p[7][:50] if p[7] else "None"
                print(f"发现进程 ID {pid}, 运行时间 {p[5]}秒, 状态: {p[6]}, 语句: {info}")
                try:
                    print(f"  - 尝试杀死进程 {pid}...")
                    conn.execute(text(f"KILL {pid}"))
                    print(f"  ✅ 进程 {pid} 已清理。")
                except Exception as e:
                    print(f"  ❌ 无法杀死进程 {pid}: {e}")

        conn.commit()

    print("\n" + "=" * 50)
    print("清理完成。现在请重新尝试执行 init_mdr_cache.py 脚本。")
    print("=" * 50)

if __name__ == "__main__":
    kill_stale_connections()
