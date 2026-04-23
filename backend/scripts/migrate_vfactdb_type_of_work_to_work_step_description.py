"""
数据库迁移脚本：将 vfactdb 表的 type_of_work 字段重命名为 work_step_description
"""
import sys
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from sqlalchemy import text
from app.database import engine


def migrate():
    """执行迁移"""
    print("开始迁移 vfactdb.type_of_work -> work_step_description...")
    
    with engine.connect() as conn:
        try:
            # 检查字段是否存在
            result = conn.execute(text("""
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'vfactdb' 
                AND COLUMN_NAME IN ('type_of_work', 'work_step_description')
            """))
            
            columns = [row[0] for row in result]
            
            if 'work_step_description' in columns:
                print("  ✓ work_step_description 字段已存在，跳过迁移")
                return
            
            if 'type_of_work' not in columns:
                print("  ⚠ type_of_work 字段不存在，创建新字段 work_step_description")
                # 直接创建新字段
                conn.execute(text("""
                    ALTER TABLE vfactdb 
                    ADD COLUMN work_step_description VARCHAR(255) 
                    COMMENT '工作步骤描述（原 type_of_work，对应 workstep_defines.work_step_description）'
                    AFTER title
                """))
                conn.commit()
                print("  ✓ 已创建 work_step_description 字段")
                return
            
            # 重命名字段
            print("  正在重命名字段...")
            conn.execute(text("""
                ALTER TABLE vfactdb 
                CHANGE COLUMN type_of_work work_step_description VARCHAR(255) 
                COMMENT '工作步骤描述（原 type_of_work，对应 workstep_defines.work_step_description）'
            """))
            conn.commit()
            print("  ✓ 字段重命名成功")
            
            # 更新索引（如果有基于 type_of_work 的索引）
            # 注意：MySQL 会自动更新索引名称
            
        except Exception as e:
            print(f"  ✗ 迁移失败: {str(e)}")
            import traceback
            traceback.print_exc()
            conn.rollback()
            raise


if __name__ == "__main__":
    migrate()
    print("\n迁移完成！")

