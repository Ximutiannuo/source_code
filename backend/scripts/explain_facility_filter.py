"""
facility_filter 查询 EXPLAIN 与耗时测试脚本

用法（在 backend 目录下执行）：
  python scripts/explain_facility_filter.py                    # 无筛选条件（最慢场景）
  python scripts/explain_facility_filter.py --scope A,B        # 带 scope 筛选
  python scripts/explain_facility_filter.py --explain single   # 只 EXPLAIN 单个子查询
  python scripts/explain_facility_filter.py --explain full     # EXPLAIN 完整 UNION（19 行）
  python scripts/explain_facility_filter.py --run              # 执行实际查询并计时
"""
import sys
import time
import argparse
from pathlib import Path

project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from sqlalchemy import and_, func, select, text, union_all, literal_column
from sqlalchemy.dialects import mysql
from app.database import SessionLocal, load_env_with_fallback
from app.models.activity_summary import ActivitySummary
from app.models.rsc import RSCDefine


def build_facility_filter_query(scope=None, project=None, subproject=None, train=None,
                                unit=None, simple_block=None, main_block=None, block=None,
                                quarter=None, discipline=None, implement_phase=None,
                                contract_phase=None, type_=None, work_package=None,
                                resource_id_name=None, bcc_kq_code=None, kq=None, cn_wk_report=None):
    """构建与 facility_filter API 完全一致的查询（返回 subqueries 列表和 mega_union_stmt）"""

    def get_all_active_criteria(exclude_label=None):
        conds = []
        if scope and exclude_label != "scope": conds.append(ActivitySummary.scope.in_(scope))
        if project and exclude_label != "project": conds.append(ActivitySummary.project.in_(project))
        if subproject and exclude_label != "subproject": conds.append(ActivitySummary.subproject.in_(subproject))
        if train and exclude_label != "train": conds.append(ActivitySummary.train.in_(train))
        if unit and exclude_label != "unit": conds.append(ActivitySummary.unit.in_(unit))
        if simple_block and exclude_label != "simple_block": conds.append(ActivitySummary.simple_block.in_(simple_block))
        if main_block and exclude_label != "main_block": conds.append(ActivitySummary.main_block.in_(main_block))
        if block and exclude_label != "block": conds.append(ActivitySummary.block.in_(block))
        if quarter and exclude_label != "quarter": conds.append(ActivitySummary.quarter.in_(quarter))
        if discipline and exclude_label != "discipline": conds.append(ActivitySummary.discipline.in_(discipline))
        if implement_phase and exclude_label != "implement_phase": conds.append(ActivitySummary.implement_phase.in_(implement_phase))
        if contract_phase and exclude_label != "contract_phase": conds.append(ActivitySummary.contract_phase.in_(contract_phase))
        if type_ and exclude_label != "type": conds.append(ActivitySummary.type.in_(type_))
        if work_package and exclude_label != "work_package": conds.append(ActivitySummary.work_package.in_(work_package))
        if resource_id_name and exclude_label != "resource_id_name": conds.append(RSCDefine.resource_id_name.in_(resource_id_name))
        if bcc_kq_code and exclude_label != "bcc_kq_code": conds.append(RSCDefine.bcc_kq_code.in_(bcc_kq_code))
        if kq and exclude_label != "kq": conds.append(RSCDefine.kq.in_(kq))
        if cn_wk_report and exclude_label != "cn_wk_report": conds.append(RSCDefine.cn_wk_report.in_(cn_wk_report))
        return conds

    all_dims = [
        ("project", ActivitySummary.project),
        ("subproject", ActivitySummary.subproject),
        ("train", ActivitySummary.train),
        ("unit", ActivitySummary.unit),
        ("simple_block", ActivitySummary.simple_block),
        ("quarter", ActivitySummary.quarter),
        ("scope", ActivitySummary.scope),
        ("discipline", ActivitySummary.discipline),
        ("implement_phase", ActivitySummary.implement_phase),
        ("contract_phase", ActivitySummary.contract_phase),
        ("type", ActivitySummary.type),
        ("work_package", ActivitySummary.work_package),
        ("resource_id_name", RSCDefine.resource_id_name),
        ("bcc_kq_code", RSCDefine.bcc_kq_code),
        ("kq", RSCDefine.kq),
        ("cn_wk_report", RSCDefine.cn_wk_report),
    ]

    subqueries = []
    for label, col in all_dims:
        criteria = get_all_active_criteria(label)
        stmt = (
            select(literal_column(f"'{label}'").label("dim"), col.label("val"))
            .select_from(ActivitySummary)
            .outerjoin(RSCDefine, ActivitySummary.work_package == RSCDefine.work_package)
            .where(and_(*criteria) if criteria else True)
            .where(col.isnot(None))
            .group_by(col)
        )
        subqueries.append(stmt)

    mb_criteria = get_all_active_criteria("main_block")
    stmt_mb = (
        select(
            literal_column("'pair_sb_mb'").label("dim"),
            func.concat(func.coalesce(ActivitySummary.simple_block, ""), "|||", ActivitySummary.main_block).label("val"),
        )
        .select_from(ActivitySummary)
        .outerjoin(RSCDefine, ActivitySummary.work_package == RSCDefine.work_package)
        .where(and_(*mb_criteria) if mb_criteria else True)
        .where(ActivitySummary.main_block.isnot(None))
        .group_by(ActivitySummary.simple_block, ActivitySummary.main_block)
    )
    subqueries.append(stmt_mb)

    b_criteria = get_all_active_criteria("block")
    stmt_b = (
        select(
            literal_column("'pair_mb_b'").label("dim"),
            func.concat(func.coalesce(ActivitySummary.main_block, ""), "|||", ActivitySummary.block).label("val"),
        )
        .select_from(ActivitySummary)
        .outerjoin(RSCDefine, ActivitySummary.work_package == RSCDefine.work_package)
        .where(and_(*b_criteria) if b_criteria else True)
        .where(ActivitySummary.block.isnot(None))
        .group_by(ActivitySummary.main_block, ActivitySummary.block)
    )
    subqueries.append(stmt_b)

    mega_union_stmt = union_all(*subqueries)
    return subqueries, mega_union_stmt


def main():
    load_env_with_fallback()
    parser = argparse.ArgumentParser(description="facility_filter EXPLAIN 与耗时测试")
    parser.add_argument("--scope", type=str, help="scope 筛选，逗号分隔，如 A,B")
    parser.add_argument("--explain", choices=["single", "full"], help="EXPLAIN 模式：single=单子查询, full=完整 UNION")
    parser.add_argument("--run", action="store_true", help="执行实际查询并计时")
    parser.add_argument("--save-sql", type=str, metavar="FILE", help="将 SQL 保存到文件")
    args = parser.parse_args()

    scope = [s.strip() for s in args.scope.split(",")] if args.scope else None
    subqueries, mega_union_stmt = build_facility_filter_query(scope=scope)

    db = SessionLocal()
    try:
        dialect = mysql.dialect()

        def _compile(stmt):
            return str(stmt.compile(dialect=dialect, compile_kwargs={"literal_binds": True}))

        if args.explain == "single":
            # 单个子查询 EXPLAIN（project 维度）
            stmt = subqueries[0]
            raw_sql = _compile(stmt)
            explain_sql = f"EXPLAIN {raw_sql}"
            print("=== EXPLAIN 单子查询 (project 维度) ===")
            print("SQL (前 500 字符):", raw_sql[:500], "...")
            print()
            rows = db.execute(text(explain_sql)).fetchall()
            cols = list(rows[0]._mapping.keys()) if rows else []
            print("EXPLAIN 结果:")
            print(" | ".join(cols))
            print("-" * 80)
            for r in rows:
                print(" | ".join(str(v) for v in r))

        elif args.explain == "full":
            # 完整 UNION ALL 的 EXPLAIN
            raw_sql = _compile(mega_union_stmt)
            explain_sql = f"EXPLAIN {raw_sql}"
            print("=== EXPLAIN 完整 UNION ALL (19 个子查询) ===")
            print("SQL 长度:", len(raw_sql), "字符")
            print()
            rows = db.execute(text(explain_sql)).fetchall()
            cols = list(rows[0]._mapping.keys()) if rows else []
            print("EXPLAIN 结果 (每行对应一个子查询):")
            print(" | ".join(cols))
            print("-" * 120)
            for i, r in enumerate(rows):
                print(f"#{i+1:2d} | " + " | ".join(str(v) for v in r))
            print()
            # MySQL EXPLAIN: id, select_type, table, type, possible_keys, key, ...
            all_types = [str(r._mapping.get("type", r[4] if len(r) > 4 else "?")) for r in rows]
            all_count = sum(1 for t in all_types if t == "ALL")
            if all_count > 0:
                print(f"⚠ 全表扫描 (type=ALL) 的子查询数量: {all_count} / {len(rows)}")

        if args.save_sql:
            raw_sql = _compile(mega_union_stmt)
            with open(args.save_sql, "w", encoding="utf-8") as f:
                f.write(raw_sql)
            print(f"\n✓ SQL 已保存到 {args.save_sql}")

        if args.run:
            print("\n=== 执行实际查询并计时 ===")
            print("筛选条件: scope =", scope or "无")
            t0 = time.perf_counter()
            rows = db.execute(mega_union_stmt).fetchall()
            elapsed = time.perf_counter() - t0
            print(f"耗时: {elapsed:.3f} 秒")
            print(f"返回行数: {len(rows)}")

        if not args.explain and not args.run and not args.save_sql:
            # 默认：EXPLAIN 单个子查询
            stmt = subqueries[0]
            raw_sql = _compile(stmt)
            explain_sql = f"EXPLAIN {raw_sql}"
            print("=== 默认: EXPLAIN 单子查询 (project 维度)，无筛选条件 ===")
            print("SQL:", raw_sql[:600], "...")
            print()
            rows = db.execute(text(explain_sql)).fetchall()
            cols = list(rows[0]._mapping.keys()) if rows else []
            print("EXPLAIN 结果:")
            print(" | ".join(cols))
            print("-" * 80)
            for r in rows:
                print(" | ".join(str(v) for v in r))
            print("\n提示: 使用 --explain full 查看完整 UNION，使用 --run 执行并计时")
    finally:
        db.close()


if __name__ == "__main__":
    main()
