"""
工效算法验证：与 DAX 考虑辅助人力公式完全一致。
DAX 对应：Period LaborInput=mp_filtered, Period Productivity LaborInput=prod_all(REMOVEFILTERS资源),
Period Non-Prod=nonprod_all, Percentage=mp/prod_all, Allocated=pct*nonprod_all,
工效(含辅助)=achieved/(mp+allocated)
"""
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

def verify_algorithm():
    db = SessionLocal()
    wp = "PI04"
    d_start = "2025-01-01"
    d_end = "2026-02-22"
    
    CO_NON_PRODUCTIVITY = ["CO01", "CO03", "CO04"]

    print("="*60)
    print(f"工效算法逻辑验证报告 - {wp}")
    print("="*60)

    try:
        # 1. 该资源下的产出 (Achieved)
        sql_ach = f"SELECT sum(achieved) FROM vfactdb WHERE work_package = '{wp}' AND date >= '{d_start}' AND date <= '{d_end}'"
        achieved = float(db.execute(text(sql_ach)).scalar() or 0)
        
        # 2. 该资源下的直接人力投入 (Filtered MP)
        # 注意：PI04 属于生产性工作包
        sql_mp = f"SELECT sum(manpower) FROM mpdb WHERE work_package = '{wp}' AND date >= '{d_start}' AND date <= '{d_end}'"
        mp_filtered = float(db.execute(text(sql_mp)).scalar() or 0)

        # 3. 计算分摊辅助人力
        # A. 全局生产性人力 (用于计算占比)
        sql_prod_all = f"""
            SELECT sum(manpower) FROM mpdb 
            WHERE date >= '{d_start}' AND date <= '{d_end}'
              AND activity_id IS NOT NULL AND activity_id != ''
              AND work_package NOT IN ('CO01', 'CO03', 'CO04')
        """
        prod_all = float(db.execute(text(sql_prod_all)).scalar() or 1) # 避免除零

        # B. 全局辅助人力 (待分摊总量)
        sql_nonprod_all = f"""
            SELECT sum(manpower) FROM mpdb 
            WHERE date >= '{d_start}' AND date <= '{d_end}'
              AND work_package IN ('CO01', 'CO03', 'CO04')
        """
        nonprod_all = float(db.execute(text(sql_nonprod_all)).scalar() or 0)

        # C. 分摊逻辑
        # 分摊比例 = 当前资源投入 / 全局生产性投入
        pct = mp_filtered / prod_all
        allocated_nonprod = pct * nonprod_all

        # 4. 工效计算对比
        # 算法 A: 不考虑辅助人力 (Pure Direct)
        # 公式: Achieved / Direct MP
        prod_a = achieved / mp_filtered if mp_filtered > 0 else 0
        
        # 算法 B: 考虑辅助人力 (Direct + Allocated Indirect)
        # 公式: Achieved / (Direct MP + Allocated Non-Prod MP)
        total_input_b = mp_filtered + allocated_nonprod
        prod_b = achieved / total_input_b if total_input_b > 0 else 0

        print(f"数据概览 (周期: {d_start} ~ {d_end}):")
        print(f"    1. 完成工程量 (Achieved): {achieved:,.2f}")
        print(f"    2. 直接人力投入 (Direct MP): {mp_filtered:,.2f}")
        print(f"    3. 分摊比例 (Allocation Pct): {pct:.6%}")
        print(f"    4. 分摊到的辅助人力 (Allocated Non-Prod): {allocated_nonprod:,.2f}")
        print(f"    5. 考虑辅助后的总投入: {total_input_b:,.2f}")
        
        print("\n算法对比结果:")
        print(f"    [不考虑辅助人力] 工效 = {prod_a:,.4f}")
        print(f"    [考虑辅助人力]   工效 = {prod_b:,.4f}")
        print(f"    数值差异: {prod_a - prod_b:,.6f} ({( (prod_a - prod_b)/prod_a*100 if prod_a>0 else 0 ):.2f}%)")

        if abs(prod_a - prod_b) < 1e-6:
            print("\n!!! 结论: 两个算法结果几乎完全一致，说明当前过滤条件下分摊到的辅助人力极小或为0。")
        else:
            print("\n结论: 两个算法存在差异，逻辑生效。")

    except Exception as e:
        print(f"\n[!] 验证出错: {e}")
    finally:
        db.close()
        print("\n" + "="*60)

if __name__ == "__main__":
    verify_algorithm()
