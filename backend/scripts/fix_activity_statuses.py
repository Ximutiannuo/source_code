
import sys
from pathlib import Path
from decimal import Decimal

# 添加路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from app.database import SessionLocal
from sqlalchemy import text

def fix_activity_statuses():
    db = SessionLocal()
    try:
        print("开始严格按照确认规则修正 activity_summary 状态...")
        
        # 1. 基础修正：根据实际数据驱动 (规则 2 & 3)
        # 先处理 In Progress
        res1 = db.execute(text("""
            UPDATE activity_summary 
            SET system_status = 'In Progress',
                actual_finish_date = NULL
            WHERE (completed > 0 OR actual_manhour > 0)
            AND system_status != 'Completed'
        """))
        print(f"  ✓ 已将 {res1.rowcount} 条有进度的作业设为 'In Progress'")

        # 再处理 Not Started
        res2 = db.execute(text("""
            UPDATE activity_summary 
            SET system_status = 'Not Started',
                actual_finish_date = NULL
            WHERE (completed IS NULL OR completed <= 0) 
            AND (actual_manhour IS NULL OR actual_manhour <= 0)
            AND system_status != 'Completed'
        """))
        print(f"  ✓ 已将 {res2.rowcount} 条无进度的作业设为 'Not Started'")

        # 2. 最高优先级同步：手动确认状态 (规则 1)
        res3 = db.execute(text("""
            UPDATE activity_summary a
            INNER JOIN activity_status_records asr ON a.activity_id = asr.activity_id
            SET a.system_status = asr.status,
                a.actual_finish_date = asr.actual_finish_date
            WHERE asr.status = 'Completed'
        """))
        print(f"  ✓ 已强制同步手动确认的 'Completed' 记录 {res3.rowcount} 条")

        db.commit()
        print("\n修正完成！")
        
        # 统计分布
        stats = db.execute(text("SELECT system_status, COUNT(*) FROM activity_summary GROUP BY system_status")).fetchall()
        print("最终状态分布：")
        for status, count in stats:
            print(f"  - {status}: {count}")

    except Exception as e:
        db.rollback()
        print(f"错误: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    fix_activity_statuses()
