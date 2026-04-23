"""
快速刷新作业汇总状态脚本
利用原生 SQL 高效同步 activity_summary 和 volume_control_quantity 表
适用于全量数据导入后的初始化同步
"""
import sys
from pathlib import Path
from sqlalchemy import text

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from app.database import SessionLocal

def fast_refresh():
    db = SessionLocal()
    try:
        print("开始快速同步汇总数据 (统一服务版)...")
        
        # 获取所有 activity_id
        activity_ids_res = db.execute(text("SELECT activity_id FROM activity_summary")).fetchall()
        activity_ids = [r[0] for r in activity_ids_res if r[0]]
        
        print(f"找到 {len(activity_ids)} 条作业，开始刷新...")
        
        from app.services.data_refresh_service import DataRefreshService
        result = DataRefreshService.batch_refresh_activities(db, activity_ids)
        
        if result.get("success"):
            db.commit()
            print(f"\n✓ 同步完成！{result.get('message')}")
        else:
            print(f"\n✗ 同步失败: {result.get('error')}")

    except Exception as e:
        db.rollback()
        print(f"\n✗ 同步失败: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    fast_refresh()
