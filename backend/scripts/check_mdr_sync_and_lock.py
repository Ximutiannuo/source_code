"""
诊断 MDR 同步是否卡死：同时查看 mdr_sync_log 与 system_task_locks。
- 若 status=running 且 last_active_at 很久未更新 → 可能进程已死，锁未释放。
- 若 last_active_at 持续在更新 → 进程仍在跑，可能卡在备份/拉取等耗时步骤。

用法:
  python check_mdr_sync_and_lock.py           # 仅诊断
  python check_mdr_sync_and_lock.py --clear   # 诊断后若判定卡死，释放 mdr_sync 锁并把 running 标为 failed
"""
import sys
import argparse
from pathlib import Path
from datetime import datetime, timezone, timedelta

project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

from app.database import default_engine
from app.utils.timezone import now as system_now
from sqlalchemy import text

# 超过多少分钟未更新视为“可能卡死”
STALE_MINUTES = 15


def clear_stuck_mdr_lock(conn):
    """释放 mdr_sync 锁并将 mdr_sync_log 中 running 标为 failed。"""
    conn.execute(text("""
        UPDATE system_task_locks
        SET is_active = 0, remarks = CONCAT(COALESCE(remarks, ''), ' [脚本强制释放]')
        WHERE task_name = 'mdr_sync'
    """))
    conn.execute(text("""
        UPDATE mdr_sync_log
        SET status = 'failed', message = CONCAT(COALESCE(message, ''), ' - 已判定卡死并释放锁，可重新触发同步')
        WHERE status = 'running'
    """))
    conn.commit()
    print("\n  ✅ 已执行: system_task_locks.mdr_sync is_active=0, mdr_sync_log running -> failed")


def main():
    parser = argparse.ArgumentParser(description="MDR 同步与任务锁诊断")
    parser.add_argument("--clear", action="store_true", help="若判定卡死则释放锁并重置 running 状态")
    args = parser.parse_args()
    do_clear = args.clear
    print("=" * 70)
    print("MDR 同步与任务锁诊断")
    print("=" * 70)

    with default_engine.connect() as conn:
        # 1. system_task_locks 中 mdr_sync
        lock_row = conn.execute(text("""
            SELECT task_name, is_active, last_active_at, updated_by, remarks
            FROM system_task_locks
            WHERE task_name = 'mdr_sync'
        """)).fetchone()

        if lock_row:
            task_name, is_active, last_active_at, updated_by, remarks = lock_row
            print("\n【system_task_locks - mdr_sync】")
            print(f"  is_active:    {bool(is_active)}")
            print(f"  updated_by:   {updated_by}")
            print(f"  remarks:      {remarks}")
            print(f"  last_active_at: {last_active_at}")

            if last_active_at:
                # 与后端一致：后端用 GMT+3 写入 last_active_at（naive），这里用系统时区当前时间做差
                now_naive = system_now().replace(tzinfo=None)
                last_naive = last_active_at.replace(tzinfo=None) if getattr(last_active_at, "tzinfo", None) else last_active_at
                age = now_naive - last_naive
                age_min = age.total_seconds() / 60
                if age_min < 0:
                    age_min = 0  # 时钟偏差或跨时区时避免误判
                print(f"  距上次更新:  {age_min:.1f} 分钟")

                if is_active and age_min > STALE_MINUTES:
                    print(f"\n  ⚠️ 结论: 锁已持有时长超过 {STALE_MINUTES} 分钟未更新，很可能进程已退出/卡死，锁未释放。")
                    if do_clear:
                        clear_stuck_mdr_lock(conn)
                    else:
                        print("  建议: 运行 reset_mdr_sync_status.py 将 mdr_sync_log 中 running 标为 failed，")
                        print("        并手动将 system_task_locks 中 mdr_sync 的 is_active 置为 0，或执行本脚本: check_mdr_sync_and_lock.py --clear")
                elif is_active:
                    print(f"\n  ✅ 结论: 锁在 {STALE_MINUTES} 分钟内仍有更新，进程大概率仍在运行（可能卡在备份/拉取等耗时步骤）。")
        else:
            print("\n【system_task_locks】 未找到 task_name = 'mdr_sync' 的记录")

        # 2. mdr_sync_log 最新一条
        log_row = conn.execute(text("""
            SELECT id, sync_time, status, total_count, processed_count, message, duration_seconds
            FROM mdr_sync_log
            ORDER BY sync_time DESC
            LIMIT 1
        """)).fetchone()

        if log_row:
            log_id, sync_time, status, total_count, processed_count, message, duration_seconds = log_row
            print("\n【mdr_sync_log 最新一条】")
            print(f"  id:               {log_id}")
            print(f"  sync_time:        {sync_time}")
            print(f"  status:           {status}")
            print(f"  total_count:      {total_count}")
            print(f"  processed_count:  {processed_count}")
            print(f"  message:          {message}")
            print(f"  duration_seconds: {duration_seconds}")

            if status == "running" and sync_time:
                # 计算已运行时长（与后端时区一致）
                if hasattr(sync_time, "replace"):
                    st = sync_time.replace(tzinfo=None) if sync_time.tzinfo else sync_time
                else:
                    st = sync_time
                now_naive = system_now().replace(tzinfo=None)
                elapsed = now_naive - st
                print(f"  已运行:          {elapsed}")
                if "备份" in (message or ""):
                    print("\n  当前阶段: 正在备份上周历史数据（把 ext_eng_db_current 拷到 ext_eng_db_previous）。")
                    print("  该阶段不更新 processed_count，只有每 10 万行一批的心跳会更新 system_task_locks.last_active_at。")
        else:
            print("\n【mdr_sync_log】 无记录")

    print("\n" + "=" * 70)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"诊断失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
