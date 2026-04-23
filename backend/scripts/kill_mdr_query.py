"""
终止卡住的MDR Delta Cache查询
"""
import sys
import os
from sqlalchemy import text

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.database import default_engine

def kill_mdr_query(process_id=None):
    """终止MDR相关的查询"""
    print("=" * 80)
    print("终止MDR Delta Cache查询")
    print("=" * 80)
    print()
    
    with default_engine.connect() as conn:
        # 查找正在运行的MDR相关查询
        if process_id:
            print(f"查找进程 ID: {process_id}")
            result = conn.execute(text("""
                SELECT 
                    id, user, host, db, command, time, state, info
                FROM information_schema.processlist
                WHERE id = :pid
            """), {"pid": process_id})
        else:
            print("查找所有MDR相关的查询...")
            result = conn.execute(text("""
                SELECT 
                    id, user, host, db, command, time, state, info
                FROM information_schema.processlist
                WHERE command != 'Sleep' 
                AND db = DATABASE()
                AND (info LIKE '%mdr_delta_cache%' OR info LIKE '%ext_eng_db%' OR info LIKE '%Delta Cache%')
                ORDER BY time DESC
            """))
        
        processes = result.fetchall()
        
        if not processes:
            print("❌ 未找到相关查询")
            return
        
        print(f"找到 {len(processes)} 个相关查询:\n")
        for p in processes:
            pid = p[0]
            user = p[1]
            time_sec = p[5]
            state = p[6]
            info = p[7][:200] if p[7] else "N/A"
            
            print(f"  进程 ID: {pid}")
            print(f"  用户: {user}")
            print(f"  运行时间: {time_sec} 秒 ({time_sec // 60} 分钟)")
            print(f"  状态: {state}")
            print(f"  SQL: {info}")
            print()
        
        # 确认是否终止
        if not process_id:
            print("=" * 80)
            print("⚠️  警告: 将终止以上所有查询！")
            print("=" * 80)
            response = input("\n是否确认终止这些查询？(yes/no): ")
            if response.lower() != 'yes':
                print("已取消")
                return
        
        # 终止查询
        print("\n正在终止查询...")
        for p in processes:
            pid = p[0]
            try:
                conn.execute(text(f"KILL {pid}"))
                print(f"  ✅ 已终止进程 {pid}")
            except Exception as e:
                print(f"  ❌ 终止进程 {pid} 失败: {e}")
        
        print("\n" + "=" * 80)
        print("操作完成！")
        print("=" * 80)
        print("\n建议：")
        print("1. 运行 fix_missing_mdr_index.py 添加缺失的索引")
        print("2. 重新运行MDR同步任务")
        print("3. 下次同步时，Delta Cache计算应该会快很多（使用优化后的查询）")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description='终止MDR Delta Cache查询')
    parser.add_argument('--pid', type=int, help='要终止的进程ID（如果不指定，将查找所有MDR相关查询）')
    args = parser.parse_args()
    
    try:
        kill_mdr_query(args.pid)
    except KeyboardInterrupt:
        print("\n\n已取消")
        sys.exit(0)
    except Exception as e:
        print(f"❌ 操作失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
