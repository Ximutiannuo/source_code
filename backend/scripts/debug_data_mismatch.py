import sys
from pathlib import Path

# 添加项目根目录和 backend 目录到路径
project_root = Path("c:/Projects/ProjectControls")
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from app.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    activity_id = 'BU1CT1230000PA01001'
    print(f"Checking data for Activity ID: {activity_id}")
    
    # 1. Check vfactdb sum
    vfactdb_sum = db.execute(text("SELECT SUM(achieved) FROM vfactdb WHERE activity_id = :aid"), {"aid": activity_id}).scalar()
    print(f"VFACTDB SUM(achieved): {vfactdb_sum}")
    
    # 2. Check activity_summary
    as_completed = db.execute(text("SELECT completed FROM activity_summary WHERE activity_id = :aid"), {"aid": activity_id}).scalar()
    print(f"ActivitySummary.completed: {as_completed}")
    
    # 3. Check volume_control_quantity
    vc_completed = db.execute(text("SELECT construction_completed FROM volume_control_quantity WHERE activity_id = :aid"), {"aid": activity_id}).scalar()
    print(f"VolumeControlQuantity.construction_completed: {vc_completed}")

finally:
    db.close()
