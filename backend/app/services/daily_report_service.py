
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import date, datetime
from typing import Optional
from decimal import Decimal
from app.models.daily_report import DailyReportSubmission
from app.models.report import MPDB, VFACTDB
from app.models.activity_summary import ActivitySummary
from app.models.rsc import RSCDefine
from app.utils.timezone import now as system_now

class DailyReportService:
    @staticmethod
    def update_submission_status(db: Session, report_date: date, report_type: str, scope: str, submitted_by: Optional[int] = None):
        """
        更新或创建日报填报记录，包含详细统计信息
        """
        details = {}
        
        # 1. 计算统计数据
        if report_type == "MP":
            # 总统计
            stats = db.query(
                func.sum(MPDB.manpower).label('total_manpower'),
                func.sum(MPDB.machinery).label('total_machinery'),
                func.count(func.distinct(MPDB.activity_id)).label('filled_activities')
            ).filter(
                MPDB.date == report_date,
                MPDB.scope == scope
            ).first()
            
            total_manpower = stats.total_manpower if stats.total_manpower is not None else Decimal('0')
            total_machinery = stats.total_machinery if stats.total_machinery is not None else Decimal('0')
            filled_activities = int(stats.filled_activities or 0)
            total_volume = None

            # 详细分解
            # 直接人力 (Direct, discipline != 'CO', activity_id is not None)
            direct_manpower = db.query(func.sum(MPDB.manpower)).filter(
                MPDB.date == report_date,
                MPDB.scope == scope,
                MPDB.activity_id.isnot(None),
                MPDB.discipline != 'CO'
            ).scalar() or Decimal('0')
            
            # 辅助人力 (Support, discipline == 'CO', activity_id is not None)
            support_manpower = db.query(func.sum(MPDB.manpower)).filter(
                MPDB.date == report_date,
                MPDB.scope == scope,
                MPDB.activity_id.isnot(None),
                MPDB.discipline == 'CO'
            ).scalar() or Decimal('0')
            
            # MP 额外项
            # 间接人力 (工作): "Management Personnel", "Technical Personnel", "HSE", "Logistic"
            indirect_work = db.query(func.sum(MPDB.manpower)).filter(
                MPDB.date == report_date,
                MPDB.scope == scope,
                MPDB.activity_id.is_(None),
                MPDB.title.in_(["Management Personnel", "Technical Personnel", "HSE", "Logistic"])
            ).scalar() or Decimal('0')
            
            # 间接人力 (请假): "Day-off(indirect)"
            indirect_leave = db.query(func.sum(MPDB.manpower)).filter(
                MPDB.date == report_date,
                MPDB.scope == scope,
                MPDB.activity_id.is_(None),
                MPDB.title == "Day-off(indirect)"
            ).scalar() or Decimal('0')
            
            # 直接人力 (请假): "Day-off(direct)"
            direct_leave = db.query(func.sum(MPDB.manpower)).filter(
                MPDB.date == report_date,
                MPDB.scope == scope,
                MPDB.activity_id.is_(None),
                MPDB.title == "Day-off(direct)"
            ).scalar() or Decimal('0')
            
            def format_val(v):
                if v is None: return '0'
                d = Decimal(str(v)).normalize()
                return "{:f}".format(d)

            details = {
                "direct": format_val(direct_manpower),
                "support": format_val(support_manpower),
                "indirect_work": format_val(indirect_work),
                "indirect_leave": format_val(indirect_leave),
                "direct_leave": format_val(direct_leave)
            }
        else:
            # VFACT 总统计
            stats = db.query(
                func.sum(VFACTDB.achieved).label('total_volume'),
                func.count(func.distinct(VFACTDB.activity_id)).label('filled_activities')
            ).filter(
                VFACTDB.date == report_date,
                VFACTDB.scope == scope
            ).first()
            
            total_manpower = None
            total_machinery = None
            filled_activities = int(stats.filled_activities or 0)
            total_volume = stats.total_volume if stats.total_volume is not None else Decimal('0')

            # 工程量分解 (按 cn_wk_report 分组，且 kq='Y')
            vfact_breakdown = db.query(
                RSCDefine.cn_wk_report,
                func.sum(VFACTDB.achieved)
            ).join(
                RSCDefine, RSCDefine.work_package == VFACTDB.work_package
            ).filter(
                VFACTDB.date == report_date,
                VFACTDB.scope == scope,
                RSCDefine.kq == 'Y'
            ).group_by(RSCDefine.cn_wk_report).all()
            
            def format_val(v):
                if v is None: return '0'
                d = Decimal(str(v)).normalize()
                return "{:f}".format(d)

            details = {
                "work_content": {row[0]: format_val(row[1]) for row in vfact_breakdown if row[0]}
            }

        # 2. 获取该 scope 下的总活动数
        total_activities = db.query(ActivitySummary).filter(
            ActivitySummary.scope == scope
        ).count()

        # 3. 查找并更新现有记录
        submission = db.query(DailyReportSubmission).filter(
            DailyReportSubmission.date == report_date,
            DailyReportSubmission.report_type == report_type,
            DailyReportSubmission.scope == scope
        ).first()

        now_time = system_now()

        if submission:
            submission.status = "submitted"
            submission.submitted_at = now_time
            if submission.first_submitted_at is None:
                submission.first_submitted_at = now_time
            submission.total_activities = total_activities
            submission.filled_activities = filled_activities
            submission.details = details
            if report_type == "MP":
                submission.total_manpower = total_manpower
                submission.total_machinery = total_machinery
            else:
                submission.total_volume = total_volume
            if submitted_by:
                submission.submitted_by = submitted_by
        else:
            submission = DailyReportSubmission(
                date=report_date,
                report_type=report_type,
                scope=scope,
                status="submitted",
                submitted_at=now_time,
                first_submitted_at=now_time,
                total_activities=total_activities,
                filled_activities=filled_activities,
                details=details,
                total_manpower=total_manpower,
                total_machinery=total_machinery,
                total_volume=total_volume,
                submitted_by=submitted_by
            )
            db.add(submission)
        
        return submission
