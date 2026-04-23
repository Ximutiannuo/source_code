"""
数据库迁移脚本：添加外键约束
为 Activity、VolumeControl、MPDB、VFACTDB 表添加外键关系
"""
import sys
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from sqlalchemy import text, inspect
from app.database import engine, SessionLocal
import traceback


def migrate_add_foreign_keys():
    """
    添加外键约束
    1. VolumeControl.activity_id -> activities.act_id
    2. MPDB.activity_id -> activities.act_id
    3. VFACTDB.activity_id -> activities.act_id
    """
    db = SessionLocal()
    try:
        print("=" * 60)
        print("添加外键约束")
        print("=" * 60)
        
        # 检查 activities 表是否存在
        inspector = inspect(engine)
        if "activities" not in inspector.get_table_names():
            print("错误: activities 表不存在，请先创建 activities 表")
            return False
        
        # 检查 act_id 字段是否存在且为 unique
        activities_columns = [col['name'] for col in inspector.get_columns("activities")]
        if "act_id" not in activities_columns:
            print("错误: activities 表中不存在 act_id 字段")
            return False
        
        # 检查 act_id 是否为 unique
        activities_indexes = inspector.get_indexes("activities")
        act_id_unique = any(
            idx['name'] for idx in activities_indexes 
            if 'act_id' in idx.get('column_names', []) and idx.get('unique', False)
        )
        if not act_id_unique:
            print("警告: activities.act_id 不是 unique，外键可能无法创建")
            print("建议: 请确保 act_id 字段有 unique 约束")
        
        # 0. 清理无效的 activity_id 值
        print("\n0. 清理无效的 activity_id 值...")
        try:
            # 清理 mpdb 表中的无效 activity_id
            result = db.execute(text("""
                UPDATE mpdb 
                SET activity_id = NULL 
                WHERE activity_id IS NOT NULL 
                AND activity_id NOT IN (SELECT act_id FROM activities)
            """))
            mpdb_cleaned = result.rowcount
            print(f"  ✓ 清理了 {mpdb_cleaned} 条 MPDB 记录的无效 activity_id")
            
            # 清理 vfactdb 表中的无效 activity_id
            result = db.execute(text("""
                UPDATE vfactdb 
                SET activity_id = NULL 
                WHERE activity_id IS NOT NULL 
                AND activity_id NOT IN (SELECT act_id FROM activities)
            """))
            vfactdb_cleaned = result.rowcount
            print(f"  ✓ 清理了 {vfactdb_cleaned} 条 VFACTDB 记录的无效 activity_id")
            
            # 清理 volume_controls 表中的无效 activity_id
            result = db.execute(text("""
                UPDATE volume_controls 
                SET activity_id = NULL 
                WHERE activity_id IS NOT NULL 
                AND activity_id NOT IN (SELECT act_id FROM activities)
            """))
            volume_control_cleaned = result.rowcount
            print(f"  ✓ 清理了 {volume_control_cleaned} 条 VolumeControl 记录的无效 activity_id")
            
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"  ✗ 清理无效 activity_id 失败: {e}")
            print(f"  详细信息: {traceback.format_exc()}")
        
        # 1. 添加 VolumeControl 外键
        print("\n1. 添加 VolumeControl.activity_id 外键...")
        try:
            # 检查外键是否已存在
            volume_control_fks = inspector.get_foreign_keys("volume_controls")
            fk_exists = any(
                fk['constrained_columns'] == ['activity_id'] 
                for fk in volume_control_fks
            )
            
            if not fk_exists:
                db.execute(text("""
                    ALTER TABLE volume_controls
                    ADD CONSTRAINT fk_volume_control_activity
                    FOREIGN KEY (activity_id) REFERENCES activities(act_id)
                    ON DELETE SET NULL ON UPDATE CASCADE
                """))
                db.commit()
                print("  ✓ VolumeControl.activity_id 外键添加成功")
            else:
                print("  - VolumeControl.activity_id 外键已存在，跳过")
        except Exception as e:
            db.rollback()
            print(f"  ✗ 添加 VolumeControl 外键失败: {e}")
            print(f"  详细信息: {traceback.format_exc()}")
        
        # 2. 添加 MPDB 外键
        print("\n2. 添加 MPDB.activity_id 外键...")
        try:
            # 检查外键是否已存在
            mpdb_fks = inspector.get_foreign_keys("mpdb")
            fk_exists = any(
                fk['constrained_columns'] == ['activity_id'] 
                for fk in mpdb_fks
            )
            
            if not fk_exists:
                db.execute(text("""
                    ALTER TABLE mpdb
                    ADD CONSTRAINT fk_mpdb_activity
                    FOREIGN KEY (activity_id) REFERENCES activities(act_id)
                    ON DELETE SET NULL ON UPDATE CASCADE
                """))
                db.commit()
                print("  ✓ MPDB.activity_id 外键添加成功")
            else:
                print("  - MPDB.activity_id 外键已存在，跳过")
        except Exception as e:
            db.rollback()
            print(f"  ✗ 添加 MPDB 外键失败: {e}")
            print(f"  详细信息: {traceback.format_exc()}")
        
        # 3. 添加 VFACTDB 外键
        print("\n3. 添加 VFACTDB.activity_id 外键...")
        try:
            # 检查外键是否已存在
            vfactdb_fks = inspector.get_foreign_keys("vfactdb")
            fk_exists = any(
                fk['constrained_columns'] == ['activity_id'] 
                for fk in vfactdb_fks
            )
            
            if not fk_exists:
                db.execute(text("""
                    ALTER TABLE vfactdb
                    ADD CONSTRAINT fk_vfactdb_activity
                    FOREIGN KEY (activity_id) REFERENCES activities(act_id)
                    ON DELETE SET NULL ON UPDATE CASCADE
                """))
                db.commit()
                print("  ✓ VFACTDB.activity_id 外键添加成功")
            else:
                print("  - VFACTDB.activity_id 外键已存在，跳过")
        except Exception as e:
            db.rollback()
            print(f"  ✗ 添加 VFACTDB 外键失败: {e}")
            print(f"  详细信息: {traceback.format_exc()}")
        
        print("\n" + "=" * 60)
        print("外键约束添加完成")
        print("=" * 60)
        return True
        
    except Exception as e:
        db.rollback()
        print(f"\n错误: {e}")
        print(f"详细信息: {traceback.format_exc()}")
        return False
    finally:
        db.close()


if __name__ == "__main__":
    success = migrate_add_foreign_keys()
    sys.exit(0 if success else 1)

