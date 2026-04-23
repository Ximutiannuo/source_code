"""
数据库迁移脚本：创建 workstep_volumes 表（非关键工作步骤工程量日报表）
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
    print("开始创建 workstep_volumes 表...")
    
    with engine.connect() as conn:
        try:
            # 检查表是否已存在
            result = conn.execute(text("""
                SELECT TABLE_NAME 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'workstep_volumes'
            """))
            
            if result.fetchone():
                print("  ⚠ workstep_volumes 表已存在")
                confirm = input("是否删除并重新创建? (yes/no): ")
                if confirm.lower() == 'yes':
                    conn.execute(text("DROP TABLE IF EXISTS workstep_volumes"))
                    conn.commit()
                    print("  ✓ 已删除旧表")
                else:
                    print("  跳过创建")
                    return
            
            # 创建 workstep_volumes 表
            print("  正在创建 workstep_volumes 表...")
            conn.execute(text("""
                CREATE TABLE workstep_volumes (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    date DATE NOT NULL COMMENT '日期',
                    activity_id VARCHAR(100) NULL COMMENT '作业ID',
                    scope VARCHAR(100) NULL COMMENT 'SCOPE',
                    project VARCHAR(50) NULL COMMENT 'Project',
                    subproject VARCHAR(50) NULL COMMENT 'Sub-project',
                    implement_phase VARCHAR(50) NULL COMMENT '实施阶段',
                    train VARCHAR(50) NULL COMMENT 'Train',
                    unit VARCHAR(50) NULL COMMENT 'Unit',
                    block VARCHAR(50) NULL COMMENT 'Block',
                    quarter VARCHAR(50) NULL COMMENT 'Quarter',
                    main_block VARCHAR(50) NULL COMMENT 'Main_Block',
                    title TEXT NULL COMMENT 'Title',
                    work_package VARCHAR(50) NULL COMMENT 'Work Package',
                    work_step_description VARCHAR(255) NOT NULL COMMENT '工作步骤描述',
                    discipline VARCHAR(50) NULL COMMENT 'Discipline',
                    achieved DECIMAL(38, 20) NOT NULL COMMENT 'Achieved - 完成工程量（保留20位小数精度）',
                    created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
                    updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
                    INDEX idx_workstep_volumes_date_activity (date, activity_id),
                    INDEX idx_workstep_volumes_date_work_package (date, work_package),
                    INDEX idx_workstep_volumes_work_package (work_package),
                    INDEX idx_workstep_volumes_block (block),
                    INDEX idx_workstep_volumes_discipline (discipline),
                    INDEX idx_workstep_volumes_scope_block (scope, block),
                    INDEX idx_workstep_volumes_block_discipline (block, discipline),
                    CONSTRAINT fk_workstep_volumes_activity 
                        FOREIGN KEY (activity_id) 
                        REFERENCES activity_summary(activity_id) 
                        ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                COMMENT='非关键工作步骤工程量日报表 - 存储 isKeyQuantity=false 的工作步骤日报数据'
            """))
            conn.commit()
            print("  ✓ workstep_volumes 表创建成功")
            
        except Exception as e:
            print(f"  ✗ 迁移失败: {str(e)}")
            import traceback
            traceback.print_exc()
            conn.rollback()
            raise


if __name__ == "__main__":
    migrate()
    print("\n迁移完成！")

