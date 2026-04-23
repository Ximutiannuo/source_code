#!/usr/bin/env python
"""
HMD 评分种子脚本：为前端呈现效果预览插入 200 条测试评分。

固定计划类型和作业 ID，方便前端查看：
  计划类型：月滚动计划_2026-01-30~2026-02-26
  作业 ID：EC2CT2210004PI01012、EC2CT2210000CI09001

用法：
  python backend/scripts/seed_hmd_ratings_for_preview.py

删除测试数据：
  python backend/scripts/seed_hmd_ratings_for_preview.py --delete
"""
import argparse
import os
import sys
from datetime import date, datetime, timedelta
import random

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.ahead_plan_issue import AheadPlanIssue, IssueRating, AheadPlanIssueReply
from app.models.user import User
from app.models.department import Department
from app.utils.timezone import now as system_now


TYPE_OF_PLAN = "月滚动计划_2026-01-30~2026-02-26"
ACTIVITY_IDS = ["EC2CT2210004PI01012", "EC2CT2210000CI09001"]
SEED_PREFIX = "【种子测试】"
TOTAL_RATINGS = 50000
ISSUE_TYPES = ["design_tech", "procurement_material", "construction_management", "hse_safety", "quality_management"]
REASON_OPTIONS = ["响应慢", "推诿", "沟通不畅", "未解决", "其他"]


def get_users_with_dept(db, limit: int = 200):
    """获取用户 ID 列表及 user_id -> department_code 映射。优先使用有部门的用户。"""
    users = db.query(User.id, User.department_id).filter(User.is_active == True).limit(limit * 2).all()
    user_ids = [u[0] for u in users]
    dept_ids = list({u[1] for u in users if u[1]})
    dept_code_by_id = {}
    if dept_ids:
        depts = db.query(Department.id, Department.code).filter(Department.id.in_(dept_ids)).all()
        dept_code_by_id = {d[0]: d[1] for d in depts}
    user_dept: dict[int, str] = {u[0]: dept_code_by_id.get(u[1]) for u in users if u[1] and dept_code_by_id.get(u[1])}
    # 优先有部门的用户
    users_with_dept = [uid for uid in user_ids if uid in user_dept]
    users_all = list(dict.fromkeys(users_with_dept + [uid for uid in user_ids if uid not in user_dept]))
    if len(users_all) < 10:
        raise RuntimeError("系统中用户数不足 10，无法分配责任人和提出人")
    return users_all, user_dept


BATCH_SIZE = 5000  # 每批提交，减轻单次事务压力


def seed(db):
    user_ids, user_dept = get_users_with_dept(db)
    random.shuffle(user_ids)
    now = system_now()
    today = date.today()
    total_issues = 0
    total_ratings = 0

    for batch_start in range(0, TOTAL_RATINGS, BATCH_SIZE):
        batch_end = min(batch_start + BATCH_SIZE, TOTAL_RATINGS)
        created_issues: list[AheadPlanIssue] = []

        for i in range(batch_start, batch_end):
            act_id = ACTIVITY_IDS[i % len(ACTIVITY_IDS)]
            raised_by = user_ids[i % len(user_ids)]
            resp_id = user_ids[(i + 1) % len(user_ids)]
            resolved_by = user_ids[(i + 2) % len(user_ids)]
            if resp_id == raised_by:
                resp_id = user_ids[(i + 3) % len(user_ids)]
            if resolved_by == raised_by:
                resolved_by = user_ids[(i + 4) % len(user_ids)]
            resolving_dept = user_dept.get(resp_id) or user_dept.get(resolved_by) or "design"

            issue = AheadPlanIssue(
                activity_id=act_id,
                type_of_plan=TYPE_OF_PLAN,
                issue_type=random.choice(ISSUE_TYPES),
                description=f"{SEED_PREFIX}测试问题 #{i+1} - 模拟协作反馈",
                raised_by=raised_by,
                raised_at=now - timedelta(days=random.randint(1, 30)),
                responsible_user_id=resp_id,
                priority=random.choice(["high", "medium", "low"]),
                status="closed",
                resolving_department=resolving_dept,
                resolved_by=resolved_by,
                resolved_at=now - timedelta(days=random.randint(0, 14)),
                planned_resolve_at=today - timedelta(days=random.randint(1, 20)),
                confirmed_at=now,
                confirmed_by=raised_by,
                rating=None,
            )
            db.add(issue)
            created_issues.append(issue)

        db.flush()

        # 为每条问题添加解决方案回复（前端会展示）
        from app.models.ahead_plan_issue import AheadPlanIssueReply
        for iss in created_issues:
            sol = AheadPlanIssueReply(
                issue_id=iss.id,
                user_id=iss.resolved_by or iss.responsible_user_id or iss.raised_by,
                content="【解决方案】测试解决方案，用于前端预览。",
                reply_type="solution",
            )
            db.add(sol)

        db.flush()

        # 创建 issue_rating（issues 已有 id）
        for j, iss in enumerate(created_issues):
            rating_val = random.choices([1, 2, 3, 4, 5], weights=[5, 10, 25, 35, 25])[0]
            confirmed_at = iss.resolved_at or now
            if isinstance(confirmed_at, datetime):
                confirmed_at = confirmed_at.replace(tzinfo=None) if confirmed_at.tzinfo else confirmed_at
            else:
                confirmed_at = now
            hours = random.randint(0, 24)
            visible_after = confirmed_at + timedelta(hours=hours)
            if random.random() < 0.8:
                visible_after = confirmed_at - timedelta(hours=random.randint(1, 48))

            reason = None
            tags = None
            if rating_val <= 3:
                if random.random() < 0.7:
                    tags = random.sample(REASON_OPTIONS, k=random.randint(1, 2))
                else:
                    reason = f"测试低分原因 #{batch_start + j + 1}"

            ir = IssueRating(
                issue_id=iss.id,
                rating=rating_val,
                rating_reason=reason,
                rating_reason_tags=tags,
                visible_after=visible_after,
                confirmed_at=confirmed_at,
                confirmed_by=iss.raised_by,
            )
            db.add(ir)

        db.commit()
        total_issues += len(created_issues)
        total_ratings += len(created_issues)
        print(f"  批次 {batch_start // BATCH_SIZE + 1}/{(TOTAL_RATINGS + BATCH_SIZE - 1) // BATCH_SIZE}: 已写入 {len(created_issues)} 条")
    print(f"已创建 {total_issues} 条 ahead_plan_issue、{total_ratings} 条 issue_rating")
    print(f"计划类型: {TYPE_OF_PLAN}")
    print(f"作业 ID: {', '.join(ACTIVITY_IDS)}")
    print("前端可在专项计划管理中，选择上述计划类型和作业 ID 查看效果。")
    print("删除测试数据请运行: python backend/scripts/seed_hmd_ratings_for_preview.py --delete")


def delete_seed(db):
    # 删除描述以 SEED_PREFIX 开头的问题（级联删除 issue_rating、replies 等）
    deleted = db.query(AheadPlanIssue).filter(
        AheadPlanIssue.description.like(f"{SEED_PREFIX}%")
    ).delete(synchronize_session=False)
    db.commit()
    print(f"已删除 {deleted} 条种子测试问题（含关联的 issue_rating）")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--delete", action="store_true", help="删除之前插入的种子测试数据")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.delete:
            delete_seed(db)
        else:
            seed(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
