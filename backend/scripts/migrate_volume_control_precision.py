"""
迁移 volume control 相关表的精度至 Numeric(38, 20)
"""
import sys
from pathlib import Path

# 添加项目根目录和后端目录到路径
current_file = Path(__file__).resolve()
scripts_dir = current_file.parent
backend_dir = scripts_dir.parent
project_root = backend_dir.parent

if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from sqlalchemy import text
from app.database import SessionLocal

def migrate_precision():
    db = SessionLocal()
    try:
        print("开始同步迁移 volume control 表精度至 (38, 20)...")
        
        tables_and_columns = {
            "volume_control_quantity": [
                "estimated_total", "drawing_approved_afc", "material_arrived",
                "available_workface", "workface_restricted_material",
                "workface_restricted_site", "construction_completed"
            ],
            "volume_control_quantity_history": ["old_value", "new_value"],
            "volume_control_inspection": [
                "rfi_completed_a", "rfi_completed_b", "rfi_completed_c"
            ],
            "volume_control_inspection_history": ["old_value", "new_value"],
            "volume_control_asbuilt": [
                "asbuilt_signed_r0", "asbuilt_signed_r1"
            ],
            "volume_control_asbuilt_history": ["old_value", "new_value"],
            "volume_control_payment": ["obp_signed"],
            "volume_control_payment_history": ["old_value", "new_value"]
        }
        
        for table, columns in tables_and_columns.items():
            print(f"正在处理表: {table}")
            for col in columns:
                print(f"  修改列: {col}")
                # 检查列是否存在
                check_sql = text(f"SHOW COLUMNS FROM {table} LIKE '{col}'")
                if db.execute(check_sql).fetchone():
                    alter_sql = text(f"ALTER TABLE {table} MODIFY COLUMN {col} DECIMAL(38, 20)")
                    db.execute(alter_sql)
                    print(f"    ✓ {col} 已更新为 DECIMAL(38, 20)")
                else:
                    print(f"    ⚠️ 跳过: 列 {col} 不存在")
            db.commit()
            
        print("\n✅ 所有表精度迁移完成！")
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ 迁移失败: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    migrate_precision()
