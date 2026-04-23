"""
查找并显示正在阻塞其他连接的 MySQL 查询

此脚本用于诊断数据库死锁和锁等待问题，显示：
1. 哪些连接正在持有锁
2. 哪些连接正在等待锁
3. 被阻塞的查询详情
4. 持有锁的查询详情

用法：
    python find_blocking_connections.py
    python find_blocking_connections.py --kill  # 自动终止阻塞超过60秒的连接
"""

import sys
import os
from datetime import datetime
import argparse

# 添加项目根目录到路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import text
from app.database import get_default_engine, load_env_with_fallback

# 加载环境变量
load_env_with_fallback()


def get_blocking_info(engine):
    """获取锁等待和阻塞信息"""
    
    # MySQL 8.0+ 使用 performance_schema
    # MySQL 5.7 使用 information_schema
    
    # 先检查 MySQL 版本
    version_query = "SELECT VERSION()"
    with engine.connect() as conn:
        version = conn.execute(text(version_query)).scalar()
        is_mysql8 = int(version.split('.')[0]) >= 8
    
    if is_mysql8:
        # MySQL 8.0+ 使用 performance_schema.data_locks 和 data_lock_waits
        query = text("""
            SELECT 
                r.trx_id AS waiting_trx_id,
                r.trx_mysql_thread_id AS waiting_thread,
                r.trx_query AS waiting_query,
                r.trx_operation_state AS waiting_state,
                TIMESTAMPDIFF(SECOND, r.trx_started, NOW()) AS waiting_time,
                
                b.trx_id AS blocking_trx_id,
                b.trx_mysql_thread_id AS blocking_thread,
                b.trx_query AS blocking_query,
                b.trx_operation_state AS blocking_state,
                TIMESTAMPDIFF(SECOND, b.trx_started, NOW()) AS blocking_time,
                
                pl_waiting.USER AS waiting_user,
                pl_waiting.HOST AS waiting_host,
                pl_waiting.DB AS waiting_db,
                pl_waiting.TIME AS waiting_process_time,
                
                pl_blocking.USER AS blocking_user,
                pl_blocking.HOST AS blocking_host,
                pl_blocking.DB AS blocking_db,
                pl_blocking.TIME AS blocking_process_time
                
            FROM performance_schema.data_lock_waits w
            INNER JOIN information_schema.innodb_trx r ON w.REQUESTING_ENGINE_TRANSACTION_ID = r.trx_id
            INNER JOIN information_schema.innodb_trx b ON w.BLOCKING_ENGINE_TRANSACTION_ID = b.trx_id
            LEFT JOIN information_schema.processlist pl_waiting ON r.trx_mysql_thread_id = pl_waiting.ID
            LEFT JOIN information_schema.processlist pl_blocking ON b.trx_mysql_thread_id = pl_blocking.ID
            ORDER BY waiting_time DESC
        """)
    else:
        # MySQL 5.7 兼容查询
        query = text("""
            SELECT 
                r.trx_id AS waiting_trx_id,
                r.trx_mysql_thread_id AS waiting_thread,
                r.trx_query AS waiting_query,
                r.trx_operation_state AS waiting_state,
                TIMESTAMPDIFF(SECOND, r.trx_started, NOW()) AS waiting_time,
                
                b.trx_id AS blocking_trx_id,
                b.trx_mysql_thread_id AS blocking_thread,
                b.trx_query AS blocking_query,
                b.trx_operation_state AS blocking_state,
                TIMESTAMPDIFF(SECOND, b.trx_started, NOW()) AS blocking_time,
                
                pl_waiting.USER AS waiting_user,
                pl_waiting.HOST AS waiting_host,
                pl_waiting.DB AS waiting_db,
                pl_waiting.TIME AS waiting_process_time,
                
                pl_blocking.USER AS blocking_user,
                pl_blocking.HOST AS blocking_host,
                pl_blocking.DB AS blocking_db,
                pl_blocking.TIME AS blocking_process_time
                
            FROM information_schema.innodb_trx r
            INNER JOIN information_schema.innodb_lock_waits w ON r.trx_id = w.requesting_trx_id
            INNER JOIN information_schema.innodb_trx b ON w.blocking_trx_id = b.trx_id
            LEFT JOIN information_schema.processlist pl_waiting ON r.trx_mysql_thread_id = pl_waiting.ID
            LEFT JOIN information_schema.processlist pl_blocking ON b.trx_mysql_thread_id = pl_blocking.ID
            ORDER BY waiting_time DESC
        """)
    
    with engine.connect() as conn:
        result = conn.execute(query)
        return result.fetchall()


def get_long_running_processes(engine, min_seconds=30):
    """获取长时间运行的进程（不需要 PROCESS 权限的简化版本）"""
    # 使用 processlist，但不关联 innodb_trx（避免权限问题）
    query = text("""
        SELECT 
            ID AS thread_id,
            USER,
            HOST,
            DB,
            COMMAND,
            TIME AS running_seconds,
            STATE,
            INFO AS query_text
        FROM information_schema.processlist
        WHERE DB = 'projectcontrols' 
          AND TIME >= :min_seconds
          AND COMMAND != 'Sleep'
          AND COMMAND != 'Daemon'
        ORDER BY TIME DESC
    """)
    
    with engine.connect() as conn:
        result = conn.execute(query, {"min_seconds": min_seconds})
        return result.fetchall()


def kill_blocking_connection(engine, thread_id):
    """终止指定的连接"""
    query = text(f"KILL {thread_id}")
    try:
        with engine.connect() as conn:
            conn.execute(query)
            conn.commit()
        return True
    except Exception as e:
        print(f"  [ERROR] 无法终止连接 {thread_id}: {e}")
        return False


def format_query(query, max_length=200):
    """格式化查询字符串"""
    if query is None:
        return "[NULL]"
    query_str = str(query).strip().replace('\n', ' ').replace('\r', '')
    if len(query_str) > max_length:
        return query_str[:max_length] + "..."
    return query_str


def main():
    parser = argparse.ArgumentParser(description='查找并显示 MySQL 阻塞连接')
    parser.add_argument('--kill', action='store_true', help='自动终止阻塞超过60秒的连接')
    parser.add_argument('--min-time', type=int, default=30, help='显示运行时间超过N秒的事务（默认30秒）')
    args = parser.parse_args()
    
    print(f"\n{'='*100}")
    print(f"MySQL 阻塞连接诊断工具")
    print(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"数据库: {os.getenv('DB_HOST', 'localhost')}:{os.getenv('DB_PORT', '3306')}/{os.getenv('DB_NAME', 'projectcontrols')}")
    print(f"{'='*100}\n")
    
    engine = get_default_engine()
    
    # 1. 查找阻塞关系
    print("[查询] 正在查找锁等待和阻塞关系...\n")
    
    try:
        blocking_info = get_blocking_info(engine)
    except Exception as e:
        if '1142' in str(e) or 'SELECT command denied' in str(e):
            print(f"[提示] 当前用户无权访问 performance_schema，跳过锁等待分析")
            print(f"[提示] 如需查看锁等待详情，请使用 root 用户或授予以下权限：")
            print(f"        GRANT SELECT ON performance_schema.* TO 'role_system_admin'@'%';")
            print(f"        GRANT PROCESS ON *.* TO 'role_system_admin'@'%';\n")
            blocking_info = []
        else:
            raise
    
    if not blocking_info:
        print("[OK] 未发现锁等待情况\n")
    else:
        print(f"[警告] 发现 {len(blocking_info)} 个锁等待情况:\n")
        
        for idx, row in enumerate(blocking_info, 1):
            print(f"【阻塞关系 #{idx}】")
            print(f"  等待线程: {row.waiting_thread} (用户: {row.waiting_user}@{row.waiting_host})")
            print(f"  等待时间: {row.waiting_time} 秒")
            print(f"  等待查询: {format_query(row.waiting_query)}")
            print(f"  等待状态: {row.waiting_state}")
            print()
            print(f"  阻塞线程: {row.blocking_thread} (用户: {row.blocking_user}@{row.blocking_host})")
            print(f"  阻塞时长: {row.blocking_time} 秒")
            print(f"  阻塞查询: {format_query(row.blocking_query)}")
            print(f"  阻塞状态: {row.blocking_state}")
            print(f"{'-'*100}")
            
            # 如果启用了自动终止，且阻塞时间超过60秒
            if args.kill and row.blocking_time >= 60:
                print(f"  [KILL] 正在终止阻塞线程 {row.blocking_thread}...")
                if kill_blocking_connection(engine, row.blocking_thread):
                    print(f"  [OK] 已成功终止连接 {row.blocking_thread}")
                print(f"{'-'*100}")
    
    # 2. 查找长时间运行的进程
    print(f"\n[查询] 正在查找长时间运行的查询（>{args.min_time}秒）...\n")
    
    try:
        long_processes = get_long_running_processes(engine, args.min_time)
        
        if not long_processes:
            print(f"[OK] 未发现运行超过 {args.min_time} 秒的活动查询\n")
        else:
            print(f"[警告] 发现 {len(long_processes)} 个长时间运行的查询:\n")
            
            for idx, row in enumerate(long_processes, 1):
                print(f"【查询 #{idx}】")
                print(f"  线程ID: {row.thread_id}")
                print(f"  用户: {row.USER}@{row.HOST}")
                print(f"  数据库: {row.DB}")
                print(f"  命令类型: {row.COMMAND}")
                print(f"  运行时长: {row.running_seconds} 秒")
                print(f"  当前状态: {row.STATE}")
                print(f"  当前查询: {format_query(row.query_text)}")
                print(f"{'-'*100}")
                
                # 如果启用了自动终止，且运行时间超过60秒
                if args.kill and row.running_seconds >= 60:
                    print(f"  [KILL] 正在终止线程 {row.thread_id}...")
                    if kill_blocking_connection(engine, row.thread_id):
                        print(f"  [OK] 已成功终止连接 {row.thread_id}")
                    print(f"{'-'*100}")
    except Exception as e:
        if '1227' in str(e) or 'PROCESS privilege' in str(e):
            print(f"[提示] 当前用户缺少 PROCESS 权限，无法查询进程详情")
            print(f"[提示] 请联系数据库管理员授予权限，或查看现有项目中的 kill_db_locks.py 脚本\n")
        else:
            raise
    
    print(f"\n{'='*100}")
    print("诊断完成")
    print(f"{'='*100}\n")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n操作已取消")
        sys.exit(0)
    except Exception as e:
        print(f"\n[ERROR] 执行失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
