"""
测试进度实时查询（get_progress_realtime）在最差/典型场景下的耗时，并输出返回值便于校验算法。

场景：
1. 全局（无过滤）
2. 单维度 implement_phase=CT
3. 单维度 contract_phase=Add.3
4. 组合 contract_phase=Add.3 + implement_phase=CT
5. Add.3 + CT + main_block=12401
6. Add.3 + CT + main_block=12401 + scope=C12
7. Add.3 + CT + main_block=12401 + scope=C12 + discipline=CI

用法（在项目根目录执行）：
  1) 可选：先建索引再测
       python backend/scripts/add_progress_realtime_indexes.py
  2) 跑测试
       python backend/scripts/test_progress_realtime_performance.py
"""
import sys
import time
from pathlib import Path
from datetime import date
from typing import Optional, Dict, List, Any, Tuple

project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal
from app.services.dashboard_service import DashboardService


def _fmt(result: Optional[Dict[str, Any]]) -> str:
    if result is None:
        return "无数据"
    return (
        f"date={result.get('date')} "
        f"cum_plan_wf={result.get('cum_plan_wf')} "
        f"cum_forecast_wf={result.get('cum_forecast_wf')} "
        f"cum_actual_wf={result.get('cum_actual_wf')}"
    )


def run_one(
    db, name: str, filters: Optional[Dict[str, List[str]]], as_of: date
) -> Tuple[float, Optional[Dict[str, Any]]]:
    svc = DashboardService(db)
    t0 = time.perf_counter()
    result = svc.get_progress_realtime(filters, as_of)
    elapsed = time.perf_counter() - t0
    print(f"  {name}")
    print(f"    耗时: {elapsed:.3f}s  结果: {_fmt(result)}")
    return (elapsed, result)


def main():
    db = SessionLocal()
    as_of = date.today()
    print("进度实时查询耗时测试（get_progress_realtime）")
    print(f"截止日期: {as_of}")
    print("=" * 60)

    cases = [
        ("1. 全局（无过滤）", None),
        ("2. 单维度 implement_phase=CT", {"implement_phase": ["CT"]}),
        ("3. 单维度 contract_phase=Add.3", {"contract_phase": ["Add.3"]}),
        (
            "4. 组合 Add.3 + CT",
            {"implement_phase": ["CT"], "contract_phase": ["Add.3"]},
        ),
        (
            "5. Add.3 + CT + main_block=12401",
            {"implement_phase": ["CT"], "contract_phase": ["Add.3"], "main_block": ["12401"]},
        ),
        (
            "6. Add.3 + CT + main_block=12401 + scope=C12",
            {"implement_phase": ["CT"], "contract_phase": ["Add.3"], "main_block": ["12401"], "scope": ["C12"]},
        ),
        (
            "7. Add.3 + CT + main_block=12401 + scope=C12 + discipline=CI",
            {"implement_phase": ["CT"], "contract_phase": ["Add.3"], "main_block": ["12401"], "scope": ["C12"], "discipline": ["CI"]},
        ),
    ]
    times = []
    for name, filters in cases:
        elapsed, _ = run_one(db, name, filters, as_of)
        times.append(elapsed)
    print("=" * 60)
    worst = max(times)
    print(f"最差耗时: {worst:.3f}s")
    if worst > 10:
        print("建议: 运行 scripts/add_progress_realtime_indexes.py 添加索引后重测对比")
    db.close()


if __name__ == "__main__":
    main()
