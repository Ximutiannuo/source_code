import sys
import os
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from app.database import SessionLocal
from app.models.report import VFACTDB
from app.models.workstep import WorkStepDefine
from sqlalchemy import or_, and_

def locate_unmatched():
    db = SessionLocal()
    try:
        # 获取所有定义的 (work_package, description) 组合
        defines = db.query(WorkStepDefine.work_package, WorkStepDefine.work_step_description).all()
        define_set = set((d.work_package, d.work_step_description) for d in defines)

        # 获取所有 vfactdb 记录
        vfact_records = db.query(VFACTDB).all()
        
        print(f"{'ID':<10} | {'Date':<12} | {'Work Package':<15} | {'Activity ID':<30} | {'Description'}")
        print("-" * 100)
        
        count = 0
        for r in vfact_records:
            # 检查是否不在定义集中
            if (r.work_package, r.work_step_description) not in define_set:
                count += 1
                wp_display = str(r.work_package) if r.work_package else "None"
                print(f"{r.id:<10} | {str(r.date):<12} | {wp_display:<15} | {str(r.activity_id):<30} | {r.work_step_description}")
        
        print("-" * 100)
        print(f"共找到 {count} 条未匹配记录。")

    except Exception as e:
        print(f"发生错误: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    locate_unmatched()
