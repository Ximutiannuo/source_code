import sys
from pathlib import Path

# 添加项目根目录和 backend 目录到路径
project_root = Path("c:/Projects/ProjectControls")
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from app.database import SessionLocal
from sqlalchemy import text

def sync_all():
    db = SessionLocal()
    try:
        print("Starting ultra-fast SQL sync of construction_completed (with zero-reset logic)...")
        
        # 步骤 1: 批量同步 construction_completed 到 volume_control_quantity
        # 使用 LEFT JOIN 确保 vfactdb 中删除的数据能被重置为 0
        print("Step 1: Syncing VFACTDB aggregates to volume_control_quantity...")
        db.execute(text("""
            UPDATE volume_control_quantity vq
            LEFT JOIN (
                SELECT activity_id, SUM(achieved) as total 
                FROM vfactdb 
                GROUP BY activity_id
            ) v ON vq.activity_id = v.activity_id
            SET vq.construction_completed = COALESCE(v.total, 0),
                vq.updated_at = NOW()
        """))
        
        # 补齐 volume_control_quantity 中缺失的行
        db.execute(text("""
            INSERT IGNORE INTO volume_control_quantity (activity_id, construction_completed, updated_at)
            SELECT activity_id, SUM(achieved), NOW()
            FROM vfactdb
            GROUP BY activity_id
        """))
        
        # 步骤 2: 将数值同步到 activity_summary 汇总表
        # 同样使用 LEFT JOIN 确保缺失数据被刷为 0
        print("Step 2: Syncing completed quantity to activity_summary...")
        db.execute(text("""
            UPDATE activity_summary a
            LEFT JOIN (
                SELECT activity_id, SUM(achieved) as total 
                FROM vfactdb 
                GROUP BY activity_id
            ) v ON a.activity_id = v.activity_id
            SET a.completed = COALESCE(v.total, 0),
                a.updated_at = NOW()
        """))

        # 步骤 3: 统一重算工时和系统状态
        print("Step 3: Calculating manhours and updating system status...")
        db.execute(text("""
            UPDATE activity_summary 
            SET actual_manhour = COALESCE(spe_mhrs, 0) * COALESCE(completed, 0),
                system_status = CASE 
                    WHEN (SELECT status FROM activity_status_records WHERE activity_id = activity_summary.activity_id LIMIT 1) = 'Completed' THEN 'Completed'
                    WHEN completed >= COALESCE(key_qty, 0) AND COALESCE(key_qty, 0) > 0 THEN 'Completed'
                    WHEN completed > 0 THEN 'In Progress'
                    ELSE 'Not Started'
                END,
                updated_at = NOW()
        """))
        
        db.commit()
        print("Sync and calculation completed successfully.")
        
    except Exception as e:
        print(f"Error during sync: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    sync_all()
