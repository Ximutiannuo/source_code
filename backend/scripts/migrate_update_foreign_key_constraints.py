"""
数据库迁移脚本：更新外键约束策略
根据业务规则更新外键的 ON DELETE 策略：
- MPDB 和 VFACTDB：从 SET NULL 改为 RESTRICT（不允许删除有事实表数据的 Activity）
- VolumeControl：保持 CASCADE（删除 Activity 时自动删除）
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


def migrate_update_foreign_key_constraints():
    """
    更新外键约束策略
    
    1. 删除现有的外键约束
    2. 重新创建外键约束，使用新的策略：
       - MPDB: ON DELETE RESTRICT（不允许删除有 MPDB 数据的 Activity）
       - VFACTDB: ON DELETE RESTRICT（不允许删除有 VFACTDB 数据的 Activity）
       - VolumeControl: ON DELETE CASCADE（删除 Activity 时自动删除）
    """
    db = SessionLocal()
    try:
        print("=" * 60)
        print("更新外键约束策略")
        print("=" * 60)
        
        inspector = inspect(engine)
        
        # 1. 更新 MPDB 外键约束
        print("\n1. 更新 MPDB.activity_id 外键约束...")
        try:
            # 检查并删除现有外键
            mpdb_fks = inspector.get_foreign_keys("mpdb")
            for fk in mpdb_fks:
                if 'activity_id' in fk.get('constrained_columns', []):
                    fk_name = fk.get('name') or 'fk_mpdb_activity'
                    db.execute(text(f"ALTER TABLE mpdb DROP FOREIGN KEY {fk_name}"))
                    print(f"  ✓ 删除现有外键: {fk_name}")
            
            # 创建新外键（RESTRICT 策略）
            db.execute(text("""
                ALTER TABLE mpdb
                ADD CONSTRAINT fk_mpdb_activity
                FOREIGN KEY (activity_id) REFERENCES activities(act_id)
                ON DELETE RESTRICT ON UPDATE CASCADE
            """))
            db.commit()
            print("  ✓ MPDB.activity_id 外键更新成功（ON DELETE RESTRICT）")
        except Exception as e:
            db.rollback()
            print(f"  ✗ 更新 MPDB 外键失败: {e}")
            print(f"  详细信息: {traceback.format_exc()}")
        
        # 2. 更新 VFACTDB 外键约束
        print("\n2. 更新 VFACTDB.activity_id 外键约束...")
        try:
            # 检查并删除现有外键
            vfactdb_fks = inspector.get_foreign_keys("vfactdb")
            for fk in vfactdb_fks:
                if 'activity_id' in fk.get('constrained_columns', []):
                    fk_name = fk.get('name') or 'fk_vfactdb_activity'
                    db.execute(text(f"ALTER TABLE vfactdb DROP FOREIGN KEY {fk_name}"))
                    print(f"  ✓ 删除现有外键: {fk_name}")
            
            # 创建新外键（RESTRICT 策略）
            db.execute(text("""
                ALTER TABLE vfactdb
                ADD CONSTRAINT fk_vfactdb_activity
                FOREIGN KEY (activity_id) REFERENCES activities(act_id)
                ON DELETE RESTRICT ON UPDATE CASCADE
            """))
            db.commit()
            print("  ✓ VFACTDB.activity_id 外键更新成功（ON DELETE RESTRICT）")
        except Exception as e:
            db.rollback()
            print(f"  ✗ 更新 VFACTDB 外键失败: {e}")
            print(f"  详细信息: {traceback.format_exc()}")
        
        # 3. 更新 VolumeControl 外键约束
        print("\n3. 更新 VolumeControl.activity_id 外键约束...")
        try:
            # 检查并删除现有外键
            volume_control_fks = inspector.get_foreign_keys("volume_controls")
            for fk in volume_control_fks:
                if 'activity_id' in fk.get('constrained_columns', []):
                    fk_name = fk.get('name') or 'fk_volume_control_activity'
                    db.execute(text(f"ALTER TABLE volume_controls DROP FOREIGN KEY {fk_name}"))
                    print(f"  ✓ 删除现有外键: {fk_name}")
            
            # 创建新外键（CASCADE 策略）
            db.execute(text("""
                ALTER TABLE volume_controls
                ADD CONSTRAINT fk_volume_control_activity
                FOREIGN KEY (activity_id) REFERENCES activities(act_id)
                ON DELETE CASCADE ON UPDATE CASCADE
            """))
            db.commit()
            print("  ✓ VolumeControl.activity_id 外键更新成功（ON DELETE CASCADE）")
        except Exception as e:
            db.rollback()
            print(f"  ✗ 更新 VolumeControl 外键失败: {e}")
            print(f"  详细信息: {traceback.format_exc()}")
        
        print("\n" + "=" * 60)
        print("外键约束策略更新完成")
        print("=" * 60)
        print("\n约束策略说明：")
        print("  - MPDB/VFACTDB: ON DELETE RESTRICT（不允许删除有事实表数据的 Activity）")
        print("  - VolumeControl: ON DELETE CASCADE（删除 Activity 时自动删除）")
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
    success = migrate_update_foreign_key_constraints()
    sys.exit(0 if success else 1)

