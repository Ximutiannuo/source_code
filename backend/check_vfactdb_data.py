import os
import sys
from pathlib import Path

# Add project root to path
project_root = Path(os.getcwd())
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from app.database import SessionLocal
from app.models.activity_summary import ActivitySummary
from app.models.workstep import WorkStepDefine
from app.models.report import VFACTDB
from app.services.volume_control_service import VolumeControlService
from app.services.activity_sync_service import ActivitySyncService
from sqlalchemy import text

def fix_data():
    db = SessionLocal()
    try:
        print("Scanning VFACTDB for invalid work_step_description...")
        
        # 1. 获取所有关键工作步骤定义，按 work_package 分组
        defines = db.query(WorkStepDefine).filter(WorkStepDefine.is_key_quantity == True).all()
        wp_define_map = {}
        for d in defines:
            if d.work_package not in wp_define_map:
                wp_define_map[d.work_package] = []
            wp_define_map[d.work_package].append(d.work_step_description)
            
        # 2. 获取 vfactdb 中的所有记录
        records = db.query(VFACTDB).all()
        
        invalid_groups = {} # (work_package, old_description) -> [VFACTDB records]
        
        for r in records:
            wp = r.work_package
            desc = r.work_step_description
            allowed_descs = set(wp_define_map.get(wp, []))
            
            if desc not in allowed_descs:
                key = (wp, desc)
                if key not in invalid_groups:
                    invalid_groups[key] = []
                invalid_groups[key].append(r)
        
        if not invalid_groups:
            print("No invalid records found!")
            return

        print(f"Found {len(invalid_groups)} types of invalid descriptions.\n")
        
        affected_activity_ids = set()
        
        for (wp, old_desc), items in sorted(invalid_groups.items(), key=lambda x: len(x[1]), reverse=True):
            print(f"\n[INVALID] WP: {wp}, Description: {old_desc}")
            print(f"Total records affected: {len(items)}")
            
            # 获取该工作包下的所有关键工程量选项
            options = wp_define_map.get(wp, [])
            
            target_desc = None
            if len(options) == 0:
                print(f"  ⚠️ Warning: No key quantity definitions found for work package {wp}.")
                continue
            elif len(options) == 1:
                target_desc = options[0]
                print(f"  ✅ Auto-fixing: Only one key quantity exists for {wp} -> '{target_desc}'")
            else:
                # 尝试不区分大小写匹配
                case_insensitive_match = [o for o in options if o.lower() == old_desc.lower()]
                if len(case_insensitive_match) == 1:
                    target_desc = case_insensitive_match[0]
                    print(f"  ✅ Auto-fixing (Case Insensitive Match): '{old_desc}' -> '{target_desc}'")
                else:
                    print("  Multiple key quantities found. Please choose:")
                    for idx, opt in enumerate(options, 1):
                        print(f"    {idx}. {opt}")
                    print("    0. Skip this group")
                    
                    while True:
                        try:
                            choice = input(f"  Select option (0-{len(options)}): ").strip()
                            if choice == '0':
                                break
                            idx = int(choice)
                            if 1 <= idx <= len(options):
                                target_desc = options[idx-1]
                                break
                        except ValueError:
                            pass
                        print("Invalid choice, try again.")
            
            if target_desc:
                for r in items:
                    r.work_step_description = target_desc
                    affected_activity_ids.add(r.activity_id)
                print(f"  Updated {len(items)} records.")

        if affected_activity_ids:
            confirm = input(f"\nProceed to commit changes for {len(affected_activity_ids)} activities? (y/n): ").strip().lower()
            if confirm == 'y':
                db.commit()
                print("Changes committed. Refreshing aggregates...")
                
                # 刷新相关汇总数据
                for aid in affected_activity_ids:
                    try:
                        VolumeControlService.update_construction_completed_from_vfactdb(db, aid)
                        ActivitySyncService.update_activity_from_reports(db, aid)
                        print(f"  Refreshed: {aid}")
                    except Exception as e:
                        print(f"  Failed to refresh {aid}: {e}")
                
                db.commit()
                print("\nAll done!")
            else:
                db.rollback()
                print("Changes rolled back.")
            
    finally:
        db.close()

if __name__ == "__main__":
    fix_data()
