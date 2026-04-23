import sys
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from sqlalchemy import text
from app.database import engine, SessionLocal
from app.models.system_task import Base

def init_system_task_locks():
    print("正在创建 system_task_locks 表...")
    Base.metadata.create_all(bind=engine, tables=[Base.metadata.tables['system_task_locks']])
    
    db = SessionLocal()
    try:
        # 预设一些关键任务锁
        tasks = [
            ("daily_report_upload", "用户日报上传/Excel导入"),
            ("welding_sync", "焊接数据库同步"),
            ("mdr_sync", "MDR设计数据同步"),
            ("background_refresh", "后台全量计算任务")
        ]
        
        from app.models.system_task import SystemTaskLock
        
        for name, remarks in tasks:
            existing = db.query(SystemTaskLock).filter(SystemTaskLock.task_name == name).first()
            if not existing:
                lock = SystemTaskLock(task_name=name, remarks=remarks, is_active=False)
                db.add(lock)
        
        db.commit()
        print("Done: system_task_locks table initialized")
    except Exception as e:
        db.rollback()
        print(f"Error: initialization failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    init_system_task_locks()
