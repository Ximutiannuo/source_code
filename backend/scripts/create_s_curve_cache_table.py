"""
创建 S 曲线缓存表（含 GlobalFilter 维度列）、高性能索引，并可选择执行首次刷新
适用于 1400 万级 atcompletion_db、700 万级 budgeted_db、100 万级 vfactdb

维度列与 activity_summary / rsc_defines 一致:
  activity_summary: subproject, train, unit, simple_block, main_block, block, quarter,
                   scope, discipline, implement_phase, contract_phase, type, work_package
  rsc_defines:      resource_id_name, bcc_kq_code, kq, cn_wk_report

用法:
  python scripts/create_s_curve_cache_table.py           # 仅建表+索引
  python scripts/create_s_curve_cache_table.py --refresh # 建表+索引+全量刷新（全局+各 implement_phase/contract_phase，约半小时）
  python scripts/create_s_curve_cache_table.py --recreate # 表结构变更时先 DROP 再建（列名升级需用此）
"""
import sys
import argparse
from pathlib import Path

project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from app.database import load_env_with_fallback
load_env_with_fallback()

from sqlalchemy import text
from app.database import engine

def create_table_and_indexes(recreate: bool = False):
    with engine.connect() as conn:
        if recreate:
            conn.execute(text("DROP TABLE IF EXISTS dashboard_s_curve_cache"))
            conn.commit()
            print("✓ 已删除旧表")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS dashboard_s_curve_cache (
                filter_key VARCHAR(512) NOT NULL DEFAULT '',
                date DATE NOT NULL,
                cum_plan_wf DECIMAL(18,4) DEFAULT 0,
                cum_actual_wf DECIMAL(18,4) DEFAULT 0,
                cum_forecast_wf DECIMAL(18,4) DEFAULT 0,
                subproject VARCHAR(512),
                train VARCHAR(512),
                unit VARCHAR(512),
                simple_block VARCHAR(512),
                main_block VARCHAR(512),
                block VARCHAR(512),
                quarter VARCHAR(512),
                scope VARCHAR(512),
                discipline VARCHAR(512),
                implement_phase VARCHAR(512),
                contract_phase VARCHAR(512),
                type VARCHAR(512),
                work_package VARCHAR(512),
                resource_id_name VARCHAR(512),
                bcc_kq_code VARCHAR(512),
                kq VARCHAR(512),
                cn_wk_report VARCHAR(512),
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (filter_key, date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """))
        conn.commit()
        print("✓ dashboard_s_curve_cache 表已就绪")

        # 若表已存在，补充 cum_forecast_wf 列
        try:
            conn.execute(text("ALTER TABLE dashboard_s_curve_cache ADD COLUMN cum_forecast_wf DECIMAL(18,4) DEFAULT 0 AFTER cum_actual_wf"))
            conn.commit()
            print("✓ 已添加 cum_forecast_wf 列")
        except Exception as e:
            if "Duplicate column" in str(e) or "1060" in str(e):
                print("  cum_forecast_wf 列已存在")
            else:
                print(f"  添加列: {e}")

        indexes = [
            ("activity_summary", "idx_implement_phase", "(implement_phase)"),
            ("activity_summary", "idx_contract_phase", "(contract_phase)"),
            ("budgeted_db", "idx_budgeted_resource_date_val", "(resource_id, date, budgeted_units)"),
            ("budgeted_db", "idx_budgeted_resource_activity_date", "(resource_id, activity_id, date)"),
            ("atcompletion_db", "idx_atcompletion_resource_date_val", "(resource_id, date, atcompletion_units)"),
            ("atcompletion_db", "idx_atcompletion_resource_activity_date", "(resource_id, activity_id, date)"),
            ("vfactdb", "idx_vfactdb_date", "(date)"),
            ("vfactdb", "idx_vfactdb_activity_date", "(activity_id, date)"),
            ("owf_db", "idx_owf_date", "(date)"),
            ("owf_db", "idx_owf_activity_date", "(activity_id, date)"),
        ]
        for table, idx_name, cols in indexes:
            try:
                conn.execute(text(f"CREATE INDEX {idx_name} ON {table} {cols}"))
                conn.commit()
                print(f"✓ {table}: {idx_name}")
            except Exception as e:
                if "Duplicate key name" in str(e) or "1061" in str(e):
                    print(f"  {table}.{idx_name} 已存在")
                else:
                    print(f"  {table} 索引失败: {e}")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true", help="建表后执行首次缓存刷新")
    ap.add_argument("--recreate", action="store_true", help="删除旧表后重建（升级时用）")
    args = ap.parse_args()

    create_table_and_indexes(recreate=args.recreate)
    if args.refresh:
        print("正在全量刷新 S 曲线缓存（全局 + 各维度批量扫表，约半小时）...")
        from app.database import SessionLocal
        from app.services.dashboard_service import DashboardService
        db = SessionLocal()
        try:
            DashboardService(db).refresh_s_curve_cache_all()
        finally:
            db.close()
