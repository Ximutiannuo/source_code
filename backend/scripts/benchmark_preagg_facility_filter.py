"""
facility_filter 预聚合方案 B 测试脚本

对比：当前方案（19 次 UNION ALL）vs 预聚合方案（distinct 组合表）
验证：预聚合结果与当前方案在功能上等价（预聚合因 is_active 过滤可能为子集）

用法（在 backend 目录下执行）：
  python scripts/benchmark_preagg_facility_filter.py
  python scripts/benchmark_preagg_facility_filter.py --scope C01    # 带 scope 筛选
  python scripts/benchmark_preagg_facility_filter.py --runs 3      # 各跑 3 次取平均
  python scripts/benchmark_preagg_facility_filter.py --verify      # 验证功能等价性
"""
import sys
import time
import argparse
from pathlib import Path

project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from sqlalchemy import and_, func, select, text, union_all, literal_column
from app.database import SessionLocal, load_env_with_fallback
from app.models.activity_summary import ActivitySummary
from app.models.rsc import RSCDefine


def run_current_approach(db, subqueries_fn, scope=None):
    """当前方案：activity_summary JOIN rsc_defines，19 次 UNION ALL"""
    subqueries, mega_union_stmt = subqueries_fn(scope=scope)
    rows = db.execute(mega_union_stmt).fetchall()
    return rows


def run_preagg_approach(db, scope=None, preagg_table="facility_filter_preagg_test"):
    """预聚合方案：从 distinct 组合表查询，19 次 UNION ALL"""
    # 构建与 preagg 表对应的列名（表列名与 facility_filter 维度一致）
    dim_cols = [
        ("project", "project"),
        ("subproject", "subproject"),
        ("train", "train"),
        ("unit", "unit"),
        ("simple_block", "simple_block"),
        ("quarter", "quarter"),
        ("scope", "scope"),
        ("discipline", "discipline"),
        ("implement_phase", "implement_phase"),
        ("contract_phase", "contract_phase"),
        ("type", "type"),
        ("work_package", "work_package"),
        ("resource_id_name", "resource_id_name"),
        ("bcc_kq_code", "bcc_kq_code"),
        ("kq", "kq"),
        ("cn_wk_report", "cn_wk_report"),
    ]
    # 构建完整 UNION SQL（scope 作为可选筛选，内部脚本假设 scope 值不含引号）
    parts = []
    # MySQL 保留字 type 需加反引号
    def col_sql(c):
        return f"`{c}`" if c == "type" else c
    for label, col in dim_cols:
        cs = col_sql(col)
        if scope:
            scopes_sql = ", ".join([f"'{s.replace(chr(39), chr(39)+chr(39))}'" for s in scope])  # 转义单引号
            parts.append(f"SELECT '{label}' AS dim, {cs} AS val FROM {preagg_table} WHERE scope IN ({scopes_sql}) AND {cs} IS NOT NULL GROUP BY {cs}")
        else:
            parts.append(f"SELECT '{label}' AS dim, {cs} AS val FROM {preagg_table} WHERE {cs} IS NOT NULL GROUP BY {cs}")
    if scope:
        scopes_sql = ", ".join([f"'{s.replace(chr(39), chr(39)+chr(39))}'" for s in scope])
        parts.append(f"SELECT 'pair_sb_mb' AS dim, CONCAT(COALESCE(simple_block,''), '|||', main_block) AS val FROM {preagg_table} WHERE main_block IS NOT NULL AND scope IN ({scopes_sql}) GROUP BY simple_block, main_block")
        parts.append(f"SELECT 'pair_mb_b' AS dim, CONCAT(COALESCE(main_block,''), '|||', block) AS val FROM {preagg_table} WHERE block IS NOT NULL AND scope IN ({scopes_sql}) GROUP BY main_block, block")
    else:
        parts.append(f"SELECT 'pair_sb_mb' AS dim, CONCAT(COALESCE(simple_block,''), '|||', main_block) AS val FROM {preagg_table} WHERE main_block IS NOT NULL GROUP BY simple_block, main_block")
        parts.append(f"SELECT 'pair_mb_b' AS dim, CONCAT(COALESCE(main_block,''), '|||', block) AS val FROM {preagg_table} WHERE block IS NOT NULL GROUP BY main_block, block")

    union_sql = " UNION ALL ".join(parts)
    rows = db.execute(text(union_sql)).fetchall()
    return rows


def build_current_subqueries(scope=None):
    """构建当前方案的查询（复用 explain 脚本逻辑）"""
    def get_all_active_criteria(exclude_label=None):
        conds = []
        if scope and exclude_label != "scope": conds.append(ActivitySummary.scope.in_(scope))
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


def parse_union_rows_to_response(rows, all_dims):
    """将 UNION 查询的 (dim, val) 行解析为 FacilityFilterOptionsResponse 结构"""
    results_map = {label: [] for label, _ in all_dims}
    main_blocks_dict = {}
    blocks_dict = {}
    for label, val in rows:
        if not val:
            continue
        if label == "pair_sb_mb":
            parts = val.split("|||")
            if len(parts) >= 2 and parts[1]:
                sb_part, mb_val = (parts[0] or "", parts[1])
                main_blocks_dict.setdefault(sb_part, []).append(mb_val)
        elif label == "pair_mb_b":
            parts = val.split("|||")
            if len(parts) >= 2 and parts[1]:
                mb_part, b_val = (parts[0] or "", parts[1])
                blocks_dict.setdefault(mb_part, []).append(b_val)
        elif label in results_map:
            results_map[label].append(val)
    return {
        "projects": sorted(set(results_map["project"])),
        "subproject_codes": sorted(set(results_map["subproject"])),
        "trains": sorted(set(results_map["train"])),
        "units": sorted(set(results_map["unit"])),
        "simple_blocks": sorted(set(results_map["simple_block"])),
        "quarters": sorted(set(results_map["quarter"])),
        "scopes": sorted(set(results_map["scope"])),
        "disciplines": sorted(set(results_map["discipline"])),
        "implement_phases": sorted(set(results_map["implement_phase"])),
        "contract_phases": sorted(set(results_map["contract_phase"])),
        "types": sorted(set(results_map["type"])),
        "work_packages": sorted(set(results_map["work_package"])),
        "resource_id_names": sorted(set(results_map["resource_id_name"])),
        "bcc_kq_codes": sorted(set(results_map["bcc_kq_code"])),
        "kqs": sorted(set(results_map["kq"])),
        "cn_wk_reports": sorted(set(results_map["cn_wk_report"])),
        "main_blocks": {k: sorted(set(v)) for k, v in main_blocks_dict.items()},
        "blocks": {k: sorted(set(v)) for k, v in blocks_dict.items()},
    }


def verify_results_match(current_resp, preagg_resp):
    """
    验证预聚合结果与当前方案功能等价。
    预聚合因 rsc_defines.is_active 过滤，rsc 相关字段可能为当前方案的子集，属预期。
    """
    list_keys = [
        "projects", "subproject_codes", "trains", "units", "simple_blocks",
        "quarters", "scopes", "disciplines", "implement_phases", "contract_phases",
        "types", "work_packages", "resource_id_names", "bcc_kq_codes", "kqs", "cn_wk_reports"
    ]
    rsc_keys = {"resource_id_names", "bcc_kq_codes", "kqs", "cn_wk_reports"}
    ok, diffs = True, []
    for k in list_keys:
        cur_set = set(current_resp.get(k, []))
        pre_set = set(preagg_resp.get(k, []))
        if k in rsc_keys:
            if not pre_set.issubset(cur_set):
                diffs.append(f"{k}: 预聚合含当前方案没有的值 {pre_set - cur_set}")
                ok = False
            elif len(pre_set) < len(cur_set):
                diffs.append(f"{k}: 预聚合={len(pre_set)}, 当前={len(cur_set)} (is_active 过滤，预期)")
        else:
            if cur_set != pre_set:
                diffs.append(f"{k}: 不一致 cur={len(cur_set)} preagg={len(pre_set)}, diff={cur_set ^ pre_set}")
                ok = False
    for k in ("main_blocks", "blocks"):
        cur_d = current_resp.get(k, {})
        pre_d = preagg_resp.get(k, {})
        for pk, pv in pre_d.items():
            if pk not in cur_d or not set(pv).issubset(set(cur_d.get(pk, []))):
                diffs.append(f"{k}[{pk}]: 预聚合值非当前子集")
                ok = False
    return ok, diffs


def main():
    load_env_with_fallback()
    parser = argparse.ArgumentParser(description="facility_filter 预聚合方案 B  benchmark")
    parser.add_argument("--scope", type=str, help="scope 筛选，逗号分隔，如 C01,C02")
    parser.add_argument("--runs", type=int, default=2, help="每种方案执行次数，取平均")
    parser.add_argument("--verify", action="store_true", help="验证预聚合结果与当前方案功能等价")
    args = parser.parse_args()
    scope = [s.strip() for s in args.scope.split(",")] if args.scope else None

    db = SessionLocal()
    preagg_table = "facility_filter_preagg_test"
    prod_table = "facility_filter_options"  # 与 facility_filter API 一致

    try:
        print("=" * 60)
        print("facility_filter 预聚合方案 B 测试")
        print("=" * 60)
        print("筛选条件: scope =", scope or "无")
        print()

        # 1. 统计数据量
        print("--- 数据量统计 ---")
        as_count = db.execute(text("SELECT COUNT(*) FROM activity_summary")).scalar()
        join_count = db.execute(text("""
            SELECT COUNT(*) FROM activity_summary a
            LEFT JOIN rsc_defines r ON a.work_package = r.work_package AND (r.is_active IS NULL OR r.is_active = 1)
        """)).scalar()
        print(f"activity_summary 行数:        {as_count:,}")
        print(f"JOIN 结果行数 (含 rsc):      {join_count:,}")

        # 2. 创建预聚合表（distinct 组合，结构与 refresh 一致）
        # 使用普通表：MySQL 同一查询中不能多次引用同一张临时表 (ERR 1137)
        print()
        print("--- 创建预聚合表 (方案 B: distinct 组合) ---")
        t0 = time.perf_counter()
        for t in (preagg_table, prod_table):
            db.execute(text(f"DROP TABLE IF EXISTS {t}"))
        db.execute(text(f"""
            CREATE TABLE {preagg_table} AS
            SELECT DISTINCT
                a.scope, a.project, a.subproject, a.train, a.unit,
                a.simple_block, a.main_block, a.block, a.quarter,
                a.discipline, a.implement_phase, a.contract_phase, a.type, a.work_package,
                r.resource_id_name, r.bcc_kq_code, r.kq, r.cn_wk_report
            FROM activity_summary a
            LEFT JOIN rsc_defines r ON a.work_package = r.work_package AND (r.is_active IS NULL OR r.is_active = 1)
        """))
        # 同步到 prod 表名，供 --verify 调用 facility_filter 的 _query_from_preagg_table
        db.execute(text(f"CREATE TABLE {prod_table} AS SELECT * FROM {preagg_table}"))
        db.commit()
        build_time = time.perf_counter() - t0
        preagg_count = db.execute(text(f"SELECT COUNT(*) FROM {preagg_table}")).scalar()
        print(f"预聚合表行数:                {preagg_count:,}")
        print(f"压缩比:                      {join_count / preagg_count:.1f}x" if preagg_count else "N/A")
        print(f"建表耗时:                    {build_time:.3f} 秒")

        # 3. 当前方案 benchmark
        print()
        print("--- 当前方案 (19 次 UNION ALL, activity_summary + rsc_defines) ---")
        _, mega_union = build_current_subqueries(scope=scope)
        times_current = []
        for i in range(args.runs):
            t0 = time.perf_counter()
            rows = db.execute(mega_union).fetchall()
            elapsed = time.perf_counter() - t0
            times_current.append(elapsed)
        avg_current = sum(times_current) / len(times_current)
        print(f"执行 {args.runs} 次，平均耗时: {avg_current:.3f} 秒")
        print(f"返回行数: {len(rows):,}")

        # 4. 预聚合方案 benchmark
        print()
        print("--- 预聚合方案 B (19 次 UNION ALL, distinct 组合表) ---")
        times_preagg = []
        for i in range(args.runs):
            t0 = time.perf_counter()
            rows_preagg = run_preagg_approach(db, scope=scope, preagg_table=preagg_table)
            elapsed = time.perf_counter() - t0
            times_preagg.append(elapsed)
        avg_preagg = sum(times_preagg) / len(times_preagg)
        print(f"执行 {args.runs} 次，平均耗时: {avg_preagg:.3f} 秒")
        print(f"返回行数: {len(rows_preagg):,}")

        # 5. 对比
        print()
        print("=" * 60)
        print("对比结果")
        print("=" * 60)
        print(f"当前方案:     {avg_current:.3f} 秒")
        print(f"预聚合方案:   {avg_preagg:.3f} 秒")
        if avg_current > 0:
            speedup = avg_current / avg_preagg
            print(f"预聚合提速:   {speedup:.1f}x")
            print(f"耗时减少:     {(avg_current - avg_preagg):.3f} 秒 ({(1 - avg_preagg/avg_current)*100:.0f}%)")
        print()

        # 6. 验证功能等价性（--verify）
        if args.verify:
            print("--- 验证功能等价性 ---")
            all_dims = [
                ("project", "project"), ("subproject", "subproject"), ("train", "train"), ("unit", "unit"),
                ("simple_block", "simple_block"), ("quarter", "quarter"), ("scope", "scope"),
                ("discipline", "discipline"), ("implement_phase", "implement_phase"), ("contract_phase", "contract_phase"),
                ("type", "type"), ("work_package", "work_package"), ("resource_id_name", "resource_id_name"),
                ("bcc_kq_code", "bcc_kq_code"), ("kq", "kq"), ("cn_wk_report", "cn_wk_report"),
            ]
            current_resp = parse_union_rows_to_response(rows, all_dims)
            # 使用 facility_filter API 的预聚合逻辑（prod_table = facility_filter_options）
            from app.api.facility_filter import _query_from_preagg_table
            preagg_api = _query_from_preagg_table(db, scope=scope)
            if preagg_api is None:
                print("  ⚠ 预聚合 API 返回 None（表可能被清理），跳过验证")
            else:
                if hasattr(preagg_api, "model_dump"):
                    preagg_resp = preagg_api.model_dump()
                else:
                    preagg_resp = preagg_api.dict()  # Pydantic v1
                ok, diffs = verify_results_match(current_resp, preagg_resp)
                if ok:
                    print("  ✓ 验证通过：预聚合结果与当前方案功能等价（rsc 字段可能因 is_active 过滤为子集，属预期）")
                else:
                    print("  ✗ 验证失败:")
                    for d in diffs:
                        print(f"    - {d}")
    finally:
        try:
            db.execute(text(f"DROP TABLE IF EXISTS {preagg_table}"))
            db.execute(text(f"DROP TABLE IF EXISTS {prod_table}"))
            db.commit()
        except Exception:
            pass
        db.close()


if __name__ == "__main__":
    main()
