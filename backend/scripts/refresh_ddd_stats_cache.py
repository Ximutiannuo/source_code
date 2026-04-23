"""
单独刷新 DDD 统计缓存（ext_eng_db_current 聚合 → ddd_stats_cache）。
用于验证「ENG 这一段」逻辑与耗时，不跑完整 MDR 同步。

用法（在 backend 目录或项目根目录）：
  python -m scripts.refresh_ddd_stats_cache
  或
  python scripts/refresh_ddd_stats_cache.py
"""
import sys
import time
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from sqlalchemy import text
from app.database import default_engine
from app.services.dashboard_service import _ddd_aggregation_sql


def main():
    print("=" * 60)
    print("刷新 DDD 统计缓存（ext_eng_db_current → ddd_stats_cache）")
    print("=" * 60)

    with default_engine.connect() as conn:
        # 1. 检查表是否存在
        try:
            n = conn.execute(text("SELECT COUNT(*) FROM ext_eng_db_current")).scalar()
            print(f"\n  ext_eng_db_current 行数: {n:,}")
        except Exception as e:
            print(f"\n  [错误] ext_eng_db_current 不可用: {e}")
            return 1

        try:
            conn.execute(text("SELECT 1 FROM ddd_stats_cache WHERE id = 1")).fetchone()
        except Exception as e:
            print(f"\n  [错误] ddd_stats_cache 表不存在或不可用: {e}")
            print("  请先执行: database/ddd_stats_cache.sql")
            return 1

        # 2. 执行聚合（与 MDR 同步内 _run_ddd_stats_cache 一致）
        print("\n  正在对 ext_eng_db_current 做单次聚合（可能较慢，约 300 万行）...")
        conn.execute(text("SET SESSION max_execution_time = 600000"))  # 10 分钟
        t0 = time.perf_counter()
        row = conn.execute(text(_ddd_aggregation_sql())).fetchone()
        elapsed = time.perf_counter() - t0
        print(f"  聚合耗时: {elapsed:.2f} 秒")

        if not row:
            print("  [警告] 聚合结果为空，未更新缓存")
            return 0

        total, ifr, ifc, ifc_a, mac_total, mac_ifc_a, kisto_total, kisto_ifc_a = [
            x or 0 for x in row
        ]

        # 3. 写入缓存表
        conn.execute(text("""
            INSERT INTO ddd_stats_cache (id, total, ifr, ifc, ifc_a, mac_total, mac_ifc_a, kisto_total, kisto_ifc_a)
            VALUES (1, :t, :ifr, :ifc, :ifc_a, :mt, :ma, :kt, :ka)
            ON DUPLICATE KEY UPDATE
              total = VALUES(total), ifr = VALUES(ifr), ifc = VALUES(ifc), ifc_a = VALUES(ifc_a),
              mac_total = VALUES(mac_total), mac_ifc_a = VALUES(mac_ifc_a),
              kisto_total = VALUES(kisto_total), kisto_ifc_a = VALUES(kisto_ifc_a),
              updated_at = CURRENT_TIMESTAMP
        """), {
            "t": total, "ifr": ifr, "ifc": ifc, "ifc_a": ifc_a,
            "mt": mac_total, "ma": mac_ifc_a, "kt": kisto_total, "ka": kisto_ifc_a,
        })
        conn.commit()

    print("\n  结果已写入 ddd_stats_cache：")
    print(f"    total   = {total:,}")
    print(f"    ifr     = {ifr:,}")
    print(f"    ifc     = {ifc:,}")
    print(f"    ifc_a   = {ifc_a:,}")
    print(f"    mac_total = {mac_total:,}  mac_ifc_a = {mac_ifc_a:,}")
    print(f"    kisto_total = {kisto_total:,}  kisto_ifc_a = {kisto_ifc_a:,}")
    print("\n  完成。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
