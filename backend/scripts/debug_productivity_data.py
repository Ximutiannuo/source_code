import sys
from pathlib import Path
from datetime import date

# 设置项目根目录
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from sqlalchemy import text, func
from app.database import SessionLocal
from app.models.report import MPDB, VFACTDB
from app.models.rsc import RSCDefine
from app.models.productivity_cache import ProductivityCache

def debug_pi04():
    db = SessionLocal()
    wp = "PI04"
    res_name = "GCC_Process Piping Fabrication (DIN)"
    d_start = "2025-01-01"
    d_end = "2026-02-22"
    
    print("="*60)
    print(f"工效分析数据一致性诊断报告 - {wp}")
    print(f"查询范围: {d_start} 至 {d_end}")
    print("="*60)

    try:
        # 1. 原始表统计 (Ground Truth)
        sql_vf_raw = f"SELECT sum(achieved) FROM vfactdb WHERE work_package = '{wp}' AND date >= '{d_start}' AND date <= '{d_end}'"
        vf_raw = db.execute(text(sql_vf_raw)).scalar() or 0
        
        sql_mp_raw = f"SELECT sum(manpower) FROM mpdb WHERE work_package = '{wp}' AND date >= '{d_start}' AND date <= '{d_end}'"
        mp_raw = db.execute(text(sql_mp_raw)).scalar() or 0
        
        print(f"[1] 原始底表统计 (仅过滤 WP={wp}):")
        print(f"    VFACTDB 产值总计: {vf_raw:,.2f}")
        print(f"    MPDB 人力投入总计: {mp_raw:,.2f}")

        # 2. JOIN 关联检查
        sql_vf_join = f"""
            SELECT sum(v.achieved) 
            FROM vfactdb v
            JOIN rsc_defines r ON v.work_package = r.work_package
            WHERE v.work_package = '{wp}' 
              AND v.date >= '{d_start}' AND v.date <= '{d_end}'
              AND r.resource_id_name = '{res_name}'
        """
        vf_join = db.execute(text(sql_vf_join)).scalar() or 0
        
        print(f"\n[2] JOIN 关联检查 (关联 RSCDefine 并过滤名称):")
        print(f"    JOIN 后的产值总计: {vf_join:,.2f}")
        print(f"    数据丢失率: {((vf_raw - vf_join) / vf_raw * 100 if vf_raw > 0 else 0):.2f}%")
        if vf_raw > vf_join:
            print(f"    !!! 预警: 有 {vf_raw - vf_join:,.2f} 的产值在 JOIN 时丢失了。")

        # 3. 维度空值检查
        sql_vf_null = f"SELECT sum(achieved) FROM vfactdb WHERE work_package = '{wp}' AND (scope IS NULL OR scope = '')"
        vf_null = db.execute(text(sql_vf_null)).scalar() or 0
        print(f"\n[3] 维度空值检查 (WP={wp}):")
        print(f"    Scope 为空的产值: {vf_null:,.2f}")

        # 4. 预聚合缓存检查
        # 寻找对应的 filter_key
        from app.services.productivity_service import build_filter_key
        fk = build_filter_key({"resource_id_name": res_name})
        
        sql_cache = f"""
            SELECT sum(achieved), sum(mp) 
            FROM productivity_cache 
            WHERE filter_key = '{fk}' 
              AND group_by = 'scope'
              AND date >= '{d_start}' AND date <= '{d_end}'
        """
        cache_res = db.execute(text(sql_cache)).fetchone()
        cache_ach = float(cache_res[0] or 0)
        cache_mp = float(cache_res[1] or 0)
        
        print(f"\n[4] 预聚合缓存对比 (FilterKey='{fk}'):")
        print(f"    缓存中的产值总计: {cache_ach:,.2f}")
        print(f"    缓存中的人力总计: {cache_mp:,.2f}")
        print(f"    缓存与底表产值差异: {vf_join - cache_ach:,.2f}")

        # 5. 开累历史数据检查
        sql_cum_vf = f"SELECT sum(achieved) FROM vfactdb WHERE work_package = '{wp}' AND date <= '{d_end}'"
        cum_vf_raw = db.execute(text(sql_cum_vf)).scalar() or 0
        
        sql_cum_cache = f"SELECT sum(achieved) FROM productivity_cache WHERE filter_key = '{fk}' AND group_by = 'scope' AND date <= '{d_end}'"
        cum_cache = db.execute(text(sql_cum_cache)).scalar() or 0
        
        print(f"\n[5] 开累数据对比 (截至 {d_end}):")
        print(f"    底表全量累计产值: {cum_vf_raw:,.2f}")
        print(f"    缓存全量累计产值: {cum_cache:,.2f}")

    except Exception as e:
        print(f"\n[!] 诊断过程中出错: {e}")
    finally:
        db.close()
        print("\n" + "="*60)
        print("诊断完成。")

if __name__ == "__main__":
    debug_pi04()
