from app.database import SessionLocal
from app.models.report import MPDB
from app.models.activity_summary import ActivitySummary
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def fix_null_scopes():
    db = SessionLocal()
    try:
        # 查找所有 Scope 为空的 MPDB 记录
        null_scope_records = db.query(MPDB).filter(MPDB.scope == None).all()
        logger.info(f"找到 {len(null_scope_records)} 条 Scope 为空的记录")
        
        fixed_count = 0
        for record in null_scope_records:
            if record.activity_id:
                # 尝试从 ActivitySummary 补全
                activity = db.query(ActivitySummary).filter(ActivitySummary.activity_id == record.activity_id).first()
                if activity:
                    record.scope = activity.scope
                    record.project = record.project or activity.project
                    record.subproject = record.subproject or activity.subproject
                    record.implement_phase = record.implement_phase or activity.implement_phase
                    record.train = record.train or activity.train
                    record.unit = record.unit or activity.unit
                    record.block = record.block or activity.block
                    record.quarter = record.quarter or activity.quarter
                    record.main_block = record.main_block or activity.main_block
                    record.title = record.title or activity.title
                    record.discipline = record.discipline or activity.discipline
                    record.work_package = record.work_package or activity.work_package
                    fixed_count += 1
                    if fixed_count % 100 == 0:
                        logger.info(f"已修复 {fixed_count} 条...")
        
        db.commit()
        logger.info(f"成功修复 {fixed_count} 条记录的 Scope 字段")
    except Exception as e:
        db.rollback()
        logger.error(f"修复失败: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    fix_null_scopes()
