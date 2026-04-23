"""
迁移 ahead_plan_issue 中的评分到 issue_rating 表。
执行顺序：
1. 运行 database/migrations/create_issue_rating_table.sql 创建表
2. 运行本脚本迁移已有数据
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta
import random
from sqlalchemy import text
from app.database import SessionLocal
from app.models.ahead_plan_issue import AheadPlanIssue, IssueRating
from app.utils.timezone import now as system_now


def migrate():
    db = SessionLocal()
    try:
        # 查询已有评分的 closed 问题
        rows = db.query(AheadPlanIssue).filter(
            AheadPlanIssue.status == "closed",
            AheadPlanIssue.rating.isnot(None)
        ).all()

        migrated = 0
        for row in rows:
            # 检查是否已存在
            existing = db.query(IssueRating).filter(IssueRating.issue_id == row.id).first()
            if existing:
                continue

            confirmed_at = row.confirmed_at or row.resolved_at or system_now()
            if not isinstance(confirmed_at, datetime):
                continue

            # visible_after = 关闭时间 + 随机(6~24) 小时
            hours = random.randint(6, 24)
            visible_after = confirmed_at + timedelta(hours=hours)

            ir = IssueRating(
                issue_id=row.id,
                rating=row.rating,
                rating_reason=None,
                rating_reason_tags=None,
                visible_after=visible_after,
                confirmed_at=confirmed_at.replace(tzinfo=None) if confirmed_at.tzinfo else confirmed_at,
                confirmed_by=row.confirmed_by or row.raised_by,
            )
            db.add(ir)
            migrated += 1

        db.commit()
        print(f"已迁移 {migrated} 条评分到 issue_rating")
    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate()
