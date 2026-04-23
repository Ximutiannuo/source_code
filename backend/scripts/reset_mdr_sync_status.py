"""
重置MDR同步状态
将卡住的同步任务标记为failed，以便重新运行
"""
import sys
import os

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, project_root)
sys.path.insert(0, os.path.join(project_root, 'backend'))

from app.database import default_engine
from sqlalchemy import text

def reset_sync_status():
    """重置运行中的同步状态为failed"""
    print("=" * 80)
    print("重置MDR同步状态")
    print("=" * 80)
    print()
    
    with default_engine.connect() as conn:
        # 查找正在运行的同步
        result = conn.execute(text("""
            SELECT id, sync_time, message, processed_count, total_count
            FROM mdr_sync_log
            WHERE status = 'running'
            ORDER BY sync_time DESC
        """))
        
        running_syncs = result.fetchall()
        
        if not running_syncs:
            print("✅ 没有正在运行的同步任务")
            return
        
        print(f"找到 {len(running_syncs)} 个正在运行的同步任务:\n")
        for sync in running_syncs:
            print(f"  同步ID: {sync[0]}")
            print(f"  开始时间: {sync[1]}")
            print(f"  消息: {sync[2]}")
            if sync[3] and sync[4]:
                progress = (sync[3] / sync[4] * 100) if sync[4] > 0 else 0
                print(f"  进度: {sync[3]:,} / {sync[4]:,} ({progress:.1f}%)")
            print()
        
        # 更新状态
        print("正在更新状态为 'failed'...")
        update_result = conn.execute(text("""
            UPDATE mdr_sync_log
            SET status = 'failed',
                message = CONCAT(COALESCE(message, ''), ' - 查询已终止，需要重新运行')
            WHERE status = 'running'
        """))
        conn.commit()
        
        affected = update_result.rowcount
        print(f"✅ 已更新 {affected} 个同步任务的状态")
        
        print()
        print("=" * 80)
        print("状态重置完成！")
        print("=" * 80)
        print()
        print("现在可以重新运行MDR同步了。")
        print("下次同步时，Delta Cache计算会使用优化后的查询（临时表策略），")
        print("预计耗时从 2+ 小时降低到 10-20 分钟。")

if __name__ == "__main__":
    try:
        reset_sync_status()
    except Exception as e:
        print(f"❌ 操作失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
