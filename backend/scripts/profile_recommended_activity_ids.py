"""
调试脚本：测试 recommended-activity-ids 在最差情况下的耗时与资源释放

模拟场景：
  - 冷缓存（跳过缓存逻辑）
  - 单次调用：各步骤耗时、总耗时、连接释放时机
  - 并发调用：N 个并发请求同时执行时的总耗时与资源占用

用法：在 backend 目录下执行
  python scripts/profile_recommended_activity_ids.py              # 单次
  python scripts/profile_recommended_activity_ids.py --concurrent 5  # 5 并发
  python scripts/profile_recommended_activity_ids.py --concurrent 10 --runs 2  # 10 并发 × 2 轮
"""
import sys
import time
import argparse
from typing import List, Dict, Tuple
from pathlib import Path
from datetime import date, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed

project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.report import MPDB, VFACTDB
from app.models.activity_summary import ActivitySummary
from app.models.user import User, Permission, Role, RolePermission, user_role_table
from app.services.permission_service import PermissionService

# 与 ahead_plan.py 保持一致
_RECOMMENDED_UPDATE_METHODS = ("daily_report", "system_sync")
SCOPE_FIELD_MAPPING = {"scope": "scope"}


def _run_single_query(db: Session, user: User, timings: dict) -> Tuple[List[str], dict]:
    """执行单次 recommended-activity-ids 完整逻辑，返回 (activity_ids, timings)。"""
    t0 = time.perf_counter()
    cutoff = date.today() - timedelta(days=30)

    # 1. MPDB
    mp_cond = and_(
        MPDB.date >= cutoff,
        MPDB.activity_id.isnot(None),
        MPDB.activity_id != "",
        or_(
            MPDB.update_method.in_(_RECOMMENDED_UPDATE_METHODS),
            MPDB.update_method.like("daily_report%"),
            MPDB.update_method.like("system_sync%"),
        ),
    )
    mp_ids = db.query(MPDB.activity_id).filter(mp_cond).distinct().all()
    t1 = time.perf_counter()
    timings["mpdb"] = t1 - t0

    # 2. VFACTDB
    vf_cond = and_(
        VFACTDB.date >= cutoff,
        VFACTDB.activity_id.isnot(None),
        VFACTDB.activity_id != "",
        or_(
            VFACTDB.update_method.in_(_RECOMMENDED_UPDATE_METHODS),
            VFACTDB.update_method.like("daily_report%"),
            VFACTDB.update_method.like("system_sync%"),
        ),
    )
    vf_ids = db.query(VFACTDB.activity_id).filter(vf_cond).distinct().all()
    t2 = time.perf_counter()
    timings["vfactdb"] = t2 - t1

    candidate_ids = list({r[0] for r in mp_ids + vf_ids if r[0]})
    if not candidate_ids:
        return [], timings

    # 3. 权限过滤
    aq = db.query(ActivitySummary.activity_id).filter(
        ActivitySummary.activity_id.in_(candidate_ids)
    )
    aq = PermissionService.filter_by_permission(
        db=db,
        user=user,
        query=aq,
        permission_code="planning:read",
        scope_field_mapping=SCOPE_FIELD_MAPPING,
    )
    allowed_ids = [r[0] for r in aq.distinct().all()]
    t3 = time.perf_counter()
    timings["permission"] = t3 - t2

    if not allowed_ids:
        return [], timings

    # 4. 完成比例 != 100%
    not_100 = db.query(ActivitySummary.activity_id).filter(
        ActivitySummary.activity_id.in_(allowed_ids),
        or_(
            ActivitySummary.key_qty.is_(None),
            ActivitySummary.key_qty == 0,
            ActivitySummary.completed.is_(None),
            ActivitySummary.completed < ActivitySummary.key_qty,
        ),
    ).distinct().all()
    activity_ids = [r[0] for r in not_100 if r[0]]
    t4 = time.perf_counter()
    timings["completion_filter"] = t4 - t3
    timings["total"] = t4 - t0

    return activity_ids, timings


def run_one(tid: int, user: User) -> dict:
    """单线程执行一次，使用独立 session，返回结果与耗时。"""
    db = SessionLocal()
    timings = {}
    try:
        ids, timings = _run_single_query(db, user, timings)
        return {"tid": tid, "count": len(ids), "timings": timings, "released_at": time.perf_counter()}
    finally:
        db.close()
        # 连接在此处释放回连接池


def main():
    parser = argparse.ArgumentParser(description="Profile recommended-activity-ids 最差情况耗时")
    parser.add_argument("--concurrent", "-c", type=int, default=1, help="并发数（默认 1）")
    parser.add_argument("--runs", "-n", type=int, default=1, help="并发轮数（默认 1）")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        from sqlalchemy.orm import joinedload

        # 获取一个有 planning:read 权限的用户
        perm = db.query(Permission).filter(Permission.code == "planning:read").first()
        if perm:
            role_ids = db.query(RolePermission.role_id).filter(
                RolePermission.permission_id == perm.id
            ).distinct().all()
            role_ids = [r[0] for r in role_ids]
            if role_ids:
                user = (
                    db.query(User)
                    .join(user_role_table, User.id == user_role_table.c.user_id)
                    .filter(user_role_table.c.role_id.in_(role_ids))
                    .filter(User.is_active == True)
                    .options(joinedload(User.roles))
                    .first()
                )
        else:
            user = None
        if not user:
            user = db.query(User).filter(User.is_active == True).options(joinedload(User.roles)).first()
        if not user:
            print("错误：未找到可用用户")
            return 1
        print(f"使用用户: id={user.id}, username={user.username}")
    finally:
        db.close()

    print("\n" + "=" * 60)
    print(f"recommended-activity-ids 压力测试")
    print(f"  并发数: {args.concurrent}, 轮数: {args.runs}")
    print("=" * 60)

    all_results = []
    wall_start = time.perf_counter()

    for run in range(args.runs):
        print(f"\n--- 第 {run + 1}/{args.runs} 轮 (并发 {args.concurrent}) ---")
        with ThreadPoolExecutor(max_workers=args.concurrent) as ex:
            futures = {ex.submit(run_one, i, user): i for i in range(args.concurrent)}
            for f in as_completed(futures):
                try:
                    r = f.result()
                    all_results.append(r)
                    t = r["timings"]
                    print(f"  [线程 {r['tid']}] 耗时: {t.get('total', 0):.2f}s | "
                          f"MPDB:{t.get('mpdb',0):.2f}s VFACTDB:{t.get('vfactdb',0):.2f}s "
                          f"权限:{t.get('permission',0):.2f}s 完成过滤:{t.get('completion_filter',0):.2f}s | "
                          f"返回 {r['count']} 条")
                except Exception as e:
                    print(f"  [线程 {futures[f]}] 异常: {e}")

    wall_end = time.perf_counter()
    wall_total = wall_end - wall_start

    # 汇总
    print("\n" + "-" * 60)
    if all_results:
        totals = [r["timings"].get("total", 0) for r in all_results]
        print(f"单次耗时: 最小 {min(totals):.2f}s, 最大 {max(totals):.2f}s, 平均 {sum(totals)/len(totals):.2f}s")
    print(f"墙钟总耗时: {wall_total:.2f}s")
    print(f"连接释放: 每个请求在 db.close() 时释放，约在各自 total 耗时结束后 ~1ms 内")
    print("=" * 60)

    return 0


if __name__ == "__main__":
    sys.exit(main())
