#!/usr/bin/env python3
"""
排查「12401工艺管完成量」为何超 100 万。
模拟 query_achieved 的 work_package 解析逻辑，按工作包拆分 VFACTDB 实际数据，
检查哪些 work_package 被算进来、各自贡献多少、单位是否混加。

运行: python backend/scripts/debug_12401_work_packages.py
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from datetime import datetime
from app.database import SessionLocal
from app.models.report import VFACTDB
from app.models.rsc import RSCDefine

# 复制 _get_work_packages 逻辑（避免导入整个 service）
WORK_TYPE_MAPPING = {
    "工艺管": ["PI04", "PI05", "PI06", "PI07", "PI08", "PI09"],
    "工艺管道": ["PI04", "PI05", "PI06", "PI07", "PI08", "PI09"],
    "工艺管道防腐": ["PA01"],
    "管道防腐": ["PA01"],
    # ... 其他省略，仅测工艺管
}
_LOCATION_COLS = ("subproject", "train", "unit", "block", "quarter", "main_block")


def _escape_like(s):
    return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _location_filter_clauses(table_ref, loc):
    """复制 _location_filter 逻辑"""
    esc = _escape_like(loc)
    clauses = []
    for c in _LOCATION_COLS:
        col = getattr(table_ref, c, None)
        if col is not None:
            clauses.append(or_(col == loc, col.like(f"%{esc}%", escape="\\")))
    return or_(*clauses) if clauses else True


def simulate_get_work_packages(work_type: str, simulate_before_fix: bool = False):
    """
    模拟 _get_work_packages：
    - simulate_before_fix=False：当前逻辑（工艺管 精确匹配 → PI04-PI09）
    - simulate_before_fix=True：修复前逻辑（工艺管 无精确匹配 → 模糊匹配：工艺管 in 工艺管道、工艺管道防腐 → PI04,PI05,PA01）
    """
    key = work_type.strip()
    # 修复前：工艺管 未在 WORK_TYPE_MAPPING 中，走模糊匹配
    mapping = {k: v for k, v in WORK_TYPE_MAPPING.items() if k != "工艺管"} if simulate_before_fix else WORK_TYPE_MAPPING
    pkgs = mapping.get(key)
    if pkgs:
        return pkgs
    # 模糊匹配
    collected = []
    for k, v in mapping.items():
        if key in k:
            collected.extend(v)
    if collected:
        return list(dict.fromkeys(collected))
    return []


def main():
    db: Session = SessionLocal()
    try:
        # 全周期日期
        d_start = datetime(2020, 1, 1).date()
        d_end = datetime.now().date()

        print("=== 1. work_type='工艺管' 会解析出哪些 work_package？ ===\n")
        pkgs_exact = simulate_get_work_packages("工艺管", simulate_before_fix=False)
        pkgs_fuzzy = simulate_get_work_packages("工艺管", simulate_before_fix=True)
        print(f"精确匹配（当前逻辑）: {pkgs_exact}")
        print(f"模糊匹配（修复前，key in mapping.key）: {pkgs_fuzzy}")
        print()

        # 合并可能被查到的（精确 + 模糊可能多出来的）
        all_possible = list(dict.fromkeys(pkgs_exact + pkgs_fuzzy))
        print(f"合并后可能涉及的 work_package: {all_possible}")
        print()

        print("=== 2. VFACTDB 中 location=12401、全周期，按 work_package 拆分 ===\n")
        loc_filter = _location_filter_clauses(VFACTDB, "12401")
        q = (
            db.query(
                VFACTDB.work_package,
                func.sum(VFACTDB.achieved).label("achieved"),
            )
            .filter(
                VFACTDB.date >= d_start,
                VFACTDB.date <= d_end,
                VFACTDB.work_package.in_(all_possible),
                loc_filter,
            )
            .group_by(VFACTDB.work_package)
        )
        rows = q.all()

        # 取 rsc_defines 的 uom、cn
        wp_codes = [r[0] for r in rows if r[0]]
        wp_info = {}
        if wp_codes:
            rsc = db.query(RSCDefine.work_package, RSCDefine.uom, RSCDefine.cn_wk_report).filter(
                RSCDefine.work_package.in_(wp_codes), RSCDefine.is_active == True
            ).all()
            wp_info = {r[0]: {"uom": r[1] or "单位", "cn": r[2] or r[0]} for r in rsc}

        print(f"{'work_package':<10} {'uom':<8} {'中文名':<20} {'achieved':>18}")
        print("-" * 60)
        total_by_unit = {}  # uom -> sum
        for wp, ach in rows:
            if not wp:
                continue
            info = wp_info.get(wp, {"uom": "单位", "cn": wp})
            uom = info["uom"]
            val = float(ach or 0)
            total_by_unit[uom] = total_by_unit.get(uom, 0) + val
            print(f"{wp:<10} {uom:<8} {(info['cn'] or wp):<20} {val:>18,.2f}")

        print("-" * 60)
        wrong_sum = sum(float(r[1] or 0) for r in rows)
        print(f"\n【错误做法】所有 work_package 直接相加: {wrong_sum:,.2f} （单位混加，无意义）")
        print(f"\n【正确做法】按单位分别汇总:")
        for uom, s in total_by_unit.items():
            print(f"  {uom}: {s:,.2f}")

        # 区分 PI vs PA
        pi_sum = sum(float(r[1] or 0) for r in rows if r[0] and r[0].startswith("PI"))
        pa_sum = sum(float(r[1] or 0) for r in rows if r[0] and r[0].startswith("PA"))
        print(f"\n【PI 专业合计】: {pi_sum:,.2f}")
        print(f"【PA 专业合计】: {pa_sum:,.2f} （若被模糊匹配进来，会与 PI 混加）")
    finally:
        db.close()


if __name__ == "__main__":
    main()
