import sys
from pathlib import Path
from datetime import date, timedelta

# 添加项目根目录和 backend 目录到路径
project_root = Path("c:/Projects/ProjectControls")
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from app.database import SessionLocal
from app.services.volume_control_service import VolumeControlService
from sqlalchemy import text

def sync_yesterday():
    db = SessionLocal()
    try:
        # 今天是 2026-01-21，昨天是 2026-01-20
        yesterday = date(2026, 1, 20)
        print(f"Starting sync for activities with records on {yesterday}...")
        
        # 查找昨天有填报记录的所有作业 ID
        query = text("""
            SELECT DISTINCT activity_id 
            FROM vfactdb 
            WHERE date = :target_date AND activity_id IS NOT NULL
        """)
        activities = db.execute(query, {"target_date": yesterday}).fetchall()
        
        total = len(activities)
        print(f"Found {total} activities with records on {yesterday}")
        
        if total == 0:
            print("No activities found to sync. Skipping.")
            return

        for i, row in enumerate(activities):
            activity_id = row[0]
            if (i + 1) % 10 == 0 or i + 1 == total:
                print(f"Processing {i + 1}/{total}: {activity_id}...")
            
            # 仅针对这些受影响的作业进行汇总计算
            VolumeControlService.update_construction_completed_from_vfactdb(db, activity_id)
            
        print("Incremental sync completed successfully.")
        
    except Exception as e:
        print(f"Error during incremental sync: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    sync_yesterday()
