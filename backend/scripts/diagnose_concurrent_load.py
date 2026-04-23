"""
诊断脚本：模拟最糟情况下的并发资源消耗（10×2 并发）

测试场景：
  - 10 个并发 worker，共 2 轮 = 20 次请求/端点
  - 目标端点：ahead-plan/summary、ahead-plan/view、recommended-activity-ids
  - 直接调用后端逻辑（不经过 HTTP），评估 DB 连接池、MySQL、Python 线程压力

用法（在 backend 目录下执行）：
  python scripts/diagnose_concurrent_load.py                    # 默认 10 并发 × 2 轮
  python scripts/diagnose_concurrent_load.py -c 10 -n 2        # 同上，显式指定
  python scripts/diagnose_concurrent_load.py -c 20 -n 1        # 20 并发 × 1 轮（更激进）
  python scripts/diagnose_concurrent_load.py --endpoints summary view  # 仅测 summary 和 view
"""
import sys
import time
import argparse
try:
    import resource
except ImportError:
    resource = None  # Windows 上不可用
from pathlib import Path
from datetime import date, timedelta
from typing import List, Dict, Any, Callable, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed

project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

# 延迟导入，确保 path 已设置
def _ensure_load():
    pass


def run_summary(tid: int, run: int, user, type_of_plan: str, period_start: date, period_end: date) -> Dict[str, Any]:
    """执行 ahead-plan summary 逻辑（直接调用， bypass HTTP + heavy_query_limiter）"""
    from app.database import SessionLocal
    from app.api.ahead_plan import (
        _query_summary_aggregate_db,
        _thursdays_in_range,
        AheadPlanSummaryResponse,
        AheadPlanSummaryItem,
    )

    t0 = time.perf_counter()
    db = SessionLocal()
    try:
        thursdays = _thursdays_in_range(period_start, period_end)
        if not thursdays:
            return {"tid": tid, "run": run, "endpoint": "summary", "ok": False, "elapsed": 0, "detail": "no_thursdays"}
        first_d, last_d = thursdays[0], thursdays[-1]
        agg_items = _query_summary_aggregate_db(
            db=db,
            type_of_plan=type_of_plan,
            first_d=first_d,
            last_d=last_d,
            thursdays=thursdays,
            group_key="cn_wk_report",
            filters=None,
            current_user=user,
        )
        result = [
            AheadPlanSummaryItem(
                group_name=it["group_name"],
                description=it.get("description"),
                activity_count=it["activity_count"],
                total_planned_units=it["total_planned_units"],
                weekly=it["weekly"],
                count_reviewed=it["count_reviewed"],
                count_approved=it["count_approved"],
                key_qty=it.get("key_qty", 0),
                completed=it.get("completed", 0),
                remaining_qty=it.get("remaining_qty", 0),
            )
            for it in agg_items
        ]
        elapsed = time.perf_counter() - t0
        return {"tid": tid, "run": run, "endpoint": "summary", "ok": True, "elapsed": elapsed, "items": len(result)}
    except Exception as e:
        elapsed = time.perf_counter() - t0
        return {"tid": tid, "run": run, "endpoint": "summary", "ok": False, "elapsed": elapsed, "detail": str(e)}
    finally:
        db.close()


def run_view(tid: int, run: int, user, type_of_plan: str, period_start: date, period_end: date) -> Dict[str, Any]:
    """执行 ahead-plan view 核心查询（模拟首页 limit=2000 的 DB 压力）"""
    from app.database import SessionLocal
    from app.api.ahead_plan import _thursdays_in_range

    t0 = time.perf_counter()
    db = SessionLocal()
    try:
        thursdays = _thursdays_in_range(period_start, period_end)
        if not thursdays:
            return {"tid": tid, "run": run, "endpoint": "view", "ok": False, "elapsed": 0, "detail": "no_thursdays"}
        first_d, last_d = thursdays[0], thursdays[-1]

        # 调用与 list_ahead_plan_view 等效的底层逻辑（需要从 api 模块提取）
        # 实际 view 入口在 list_ahead_plan_view，内部会做很多查询，我们直接模拟一次完整调用
        # 使用 TestClient 或直接调用路由会引入 async，这里改用同步方式调用核心查询
        from app.models.activity_summary import ActivitySummary
        from app.models.ahead_plan import AheadPlan
        from app.services.permission_service import PermissionService

        SCOPE_FIELD_MAPPING = {"scope": "scope"}
        aq = db.query(ActivitySummary.activity_id).join(
            AheadPlan, AheadPlan.activity_id == ActivitySummary.activity_id
        ).filter(
            AheadPlan.type_of_plan == type_of_plan,
            AheadPlan.date >= first_d,
            AheadPlan.date <= last_d,
        )
        aq = PermissionService.filter_by_permission(
            db=db, user=user, query=aq,
            permission_code="planning:read",
            scope_field_mapping=SCOPE_FIELD_MAPPING,
        )
        act_ids = [r[0] for r in aq.distinct().limit(2000).all()]
        elapsed = time.perf_counter() - t0
        return {"tid": tid, "run": run, "endpoint": "view", "ok": True, "elapsed": elapsed, "items": len(act_ids)}
    except Exception as e:
        elapsed = time.perf_counter() - t0
        return {"tid": tid, "run": run, "endpoint": "view", "ok": False, "elapsed": elapsed, "detail": str(e)}
    finally:
        db.close()


def run_recommended(tid: int, run: int, user) -> Dict[str, Any]:
    """执行 recommended-activity-ids 逻辑"""
    from app.database import SessionLocal
    from scripts.profile_recommended_activity_ids import _run_single_query

    t0 = time.perf_counter()
    db = SessionLocal()
    timings = {}
    try:
        ids, timings = _run_single_query(db, user, timings)
        elapsed = time.perf_counter() - t0
        return {"tid": tid, "run": run, "endpoint": "recommended", "ok": True, "elapsed": elapsed, "items": len(ids)}
    except Exception as e:
        elapsed = time.perf_counter() - t0
        return {"tid": tid, "run": run, "endpoint": "recommended", "ok": False, "elapsed": elapsed, "detail": str(e)}
    finally:
        db.close()


def run_one(
    endpoint: str,
    tid: int,
    run: int,
    user,
    type_of_plan: str | None,
    period_start: date | None,
    period_end: date | None,
) -> Dict[str, Any]:
    if endpoint == "summary":
        return run_summary(tid, run, user, type_of_plan or "", period_start or date.today(), period_end or date.today())
    if endpoint == "view":
        return run_view(tid, run, user, type_of_plan or "", period_start or date.today(), period_end or date.today())
    if endpoint == "recommended":
        return run_recommended(tid, run, user)
    return {"tid": tid, "run": run, "endpoint": endpoint, "ok": False, "elapsed": 0, "detail": "unknown_endpoint"}


def main():
    parser = argparse.ArgumentParser(description="并发负载诊断：10×2 模拟最糟情况")
    parser.add_argument("--concurrent", "-c", type=int, default=10, help="并发数（默认 10）")
    parser.add_argument("--runs", "-n", type=int, default=2, help="每端点轮数（默认 2）")
    parser.add_argument(
        "--endpoints",
        nargs="+",
        default=["summary", "view", "recommended"],
        choices=["summary", "view", "recommended"],
        help="要测试的端点（默认全部）",
    )
    args = parser.parse_args()

    from app.database import SessionLocal
    from app.models.user import User, Permission, RolePermission, user_role_table
    from app.models.activity_summary import ActivitySummary
    from app.models.ahead_plan import AheadPlan
    from sqlalchemy.orm import joinedload

    db = SessionLocal()
    try:
        # 获取有 planning:read 的用户
        perm = db.query(Permission).filter(Permission.code == "planning:read").first()
        user = None
        if perm:
            role_ids = [r[0] for r in db.query(RolePermission.role_id).filter(
                RolePermission.permission_id == perm.id
            ).distinct().all()]
            if role_ids:
                user = (
                    db.query(User)
                    .join(user_role_table, User.id == user_role_table.c.user_id)
                    .filter(user_role_table.c.role_id.in_(role_ids))
                    .filter(User.is_active == True)
                    .options(joinedload(User.roles))
                    .first()
                )
        if not user:
            user = db.query(User).filter(User.is_active == True).options(joinedload(User.roles)).first()
        if not user:
            print("错误：未找到可用用户（需 planning:read 或任意活跃用户）")
            return 1

        # 获取 type_of_plan 与 period
        plan_row = db.query(AheadPlan.type_of_plan, AheadPlan.date).filter(
            AheadPlan.type_of_plan.isnot(None)
        ).order_by(AheadPlan.date.desc()).first()
        if plan_row:
            type_of_plan = plan_row[0]
            last_date = plan_row[1]
            period_end = last_date
            period_start = last_date - timedelta(days=60)
        else:
            type_of_plan = "monthly"
            period_end = date.today()
            period_start = period_end - timedelta(days=30)

        print(f"使用用户: id={user.id}, username={user.username}")
        print(f"计划类型: {type_of_plan}, 周期: {period_start} ~ {period_end}")
    finally:
        db.close()

    print("\n" + "=" * 70)
    print("并发负载诊断（模拟最糟情况）")
    print(f"  并发数: {args.concurrent} | 轮数: {args.runs} | 端点: {', '.join(args.endpoints)}")
    print(f"  总请求数/端点: {args.concurrent * args.runs}")
    print("=" * 70)

    try:
        mem_before = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss if resource else 0
    except Exception:
        mem_before = 0

    wall_start = time.perf_counter()
    all_results: Dict[str, List[Dict]] = {ep: [] for ep in args.endpoints}

    for ep in args.endpoints:
        print(f"\n--- {ep} ---")
        for run in range(args.runs):
            with ThreadPoolExecutor(max_workers=args.concurrent) as ex:
                futures = {
                    ex.submit(run_one, ep, i, run, user, type_of_plan, period_start, period_end): i
                    for i in range(args.concurrent)
                }
                for f in as_completed(futures):
                    try:
                        r = f.result()
                        all_results[ep].append(r)
                        status = "OK" if r.get("ok") else "FAIL"
                        items = r.get("items", r.get("detail", ""))
                        print(f"  [{ep} R{run+1} T{r['tid']}] {status} {r.get('elapsed', 0):.2f}s | {items}")
                    except Exception as e:
                        print(f"  [{ep} R{run+1} T{futures[f]}] EXC: {e}")

    wall_end = time.perf_counter()
    try:
        mem_after = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss if resource else 0
    except Exception:
        mem_after = 0

    # 汇总
    print("\n" + "-" * 70)
    print("汇总")
    print("-" * 70)
    for ep in args.endpoints:
        results = all_results[ep]
        if not results:
            continue
        ok_results = [r for r in results if r.get("ok")]
        times = [r.get("elapsed", 0) for r in ok_results]
        print(f"\n{ep}:")
        print(f"  成功: {len(ok_results)}/{len(results)}")
        if times:
            print(f"  耗时(s): 最小 {min(times):.2f} | 最大 {max(times):.2f} | 平均 {sum(times)/len(times):.2f}")
            if len(times) >= 2:
                sorted_t = sorted(times)
                p95 = sorted_t[int(len(sorted_t) * 0.95)] if len(sorted_t) > 1 else sorted_t[0]
                print(f"  P95: {p95:.2f}s")
    print(f"\n墙钟总耗时: {wall_end - wall_start:.2f}s")
    if mem_after and mem_before:
        # Linux: KB, macOS: bytes; Windows 上 ru_maxrss 可能为 0
        delta = (mem_after - mem_before) / 1024  # 转为 MB 近似
        if delta != 0:
            print(f"内存增量(近似): {delta:.1f} MB (RUSAGE)")
    print("=" * 70)
    return 0


if __name__ == "__main__":
    sys.exit(main())
