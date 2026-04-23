"""
数据库迁移脚本：
1. 删除旧的 work_steps 表
2. 创建 workstep_volumes 表（存储非关键工作步骤的预估总量）
3. 创建 workstep_volume_daily 表（存储非关键工作步骤的日报完成量）
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
    print("开始迁移工作步骤相关表...")
    
    with engine.connect() as conn:
        try:
            # 1. 删除旧的 work_steps 表
            result = conn.execute(text("""
                SELECT TABLE_NAME 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'work_steps'
            """))
            
            if result.fetchone():
                print("  发现旧的 work_steps 表")
                confirm = input("是否删除 work_steps 表? (yes/no): ")
                if confirm.lower() == 'yes':
                    conn.execute(text("DROP TABLE IF EXISTS work_steps"))
                    conn.commit()
                    print("  ✓ 已删除 work_steps 表")
                else:
                    print("  保留 work_steps 表")
            
            # 2. 创建 workstep_volumes 表（存储预估总量）
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
                    print("  跳过创建 workstep_volumes 表")
            else:
                print("  正在创建 workstep_volumes 表...")
                # 先检查 activity_summary 表的 activity_id 字段类型
                result = conn.execute(text("""
                    SELECT COLUMN_TYPE, CHARACTER_SET_NAME, COLLATION_NAME
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                    AND TABLE_NAME = 'activity_summary'
                    AND COLUMN_NAME = 'activity_id'
                """))
                activity_id_info = result.fetchone()
                
                if activity_id_info:
                    activity_id_type = activity_id_info[0]
                    activity_id_charset = activity_id_info[1] or 'utf8mb4'
                    activity_id_collation = activity_id_info[2] or 'utf8mb4_unicode_ci'
                    print(f"  activity_summary.activity_id 类型: {activity_id_type}, 字符集: {activity_id_charset}, 排序: {activity_id_collation}")
                else:
                    activity_id_type = 'VARCHAR(100)'
                    activity_id_charset = 'utf8mb4'
                    activity_id_collation = 'utf8mb4_unicode_ci'
                    print("  ⚠ 未找到 activity_summary.activity_id，使用默认类型")
                
                conn.execute(text(f"""
                    CREATE TABLE workstep_volumes (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        activity_id {activity_id_type} NULL COMMENT '作业ID',
                        work_package VARCHAR(50) NULL COMMENT '工作包',
                        work_step_description VARCHAR(255) NOT NULL COMMENT '工作步骤描述',
                        estimated_total DECIMAL(18, 2) NULL COMMENT '预估总量（固定值，不按日期）',
                        created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
                        updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
                        INDEX idx_workstep_volumes_activity_workstep (activity_id, work_step_description),
                        INDEX idx_workstep_volumes_work_package (work_package),
                        UNIQUE KEY uk_workstep_volumes_activity_workstep (activity_id, work_step_description)
                    ) ENGINE=InnoDB DEFAULT CHARSET={activity_id_charset} COLLATE={activity_id_collation}
                    COMMENT='非关键工作步骤工程量表 - 存储 isKeyQuantity=false 的工作步骤预估总量'
                """))
                
                # 单独添加外键约束（如果可能）
                try:
                    conn.execute(text(f"""
                        ALTER TABLE workstep_volumes
                        ADD CONSTRAINT fk_workstep_volumes_activity 
                            FOREIGN KEY (activity_id) 
                            REFERENCES activity_summary(activity_id) 
                            ON DELETE SET NULL
                    """))
                    print("  ✓ 外键约束添加成功")
                except Exception as fk_error:
                    print(f"  ⚠ 外键约束添加失败（可忽略）: {str(fk_error)}")
                conn.commit()
                print("  ✓ workstep_volumes 表创建成功")
            
            # 3. 创建 workstep_volume_daily 表（存储日报完成量）
            result = conn.execute(text("""
                SELECT TABLE_NAME 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'workstep_volume_daily'
            """))
            
            if result.fetchone():
                print("  ⚠ workstep_volume_daily 表已存在")
                confirm = input("是否删除并重新创建? (yes/no): ")
                if confirm.lower() == 'yes':
                    conn.execute(text("DROP TABLE IF EXISTS workstep_volume_daily"))
                    conn.commit()
                    print("  ✓ 已删除旧表")
                else:
                    print("  跳过创建 workstep_volume_daily 表")
                    return
            
            print("  正在创建 workstep_volume_daily 表...")
            # 获取 activity_id 类型（重新查询以确保获取到）
            result = conn.execute(text("""
                SELECT COLUMN_TYPE, CHARACTER_SET_NAME, COLLATION_NAME
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'activity_summary'
                AND COLUMN_NAME = 'activity_id'
            """))
            activity_id_info_daily = result.fetchone()
            if activity_id_info_daily:
                activity_id_type_daily = activity_id_info_daily[0]
                activity_id_charset_daily = activity_id_info_daily[1] or 'utf8mb4'
                activity_id_collation_daily = activity_id_info_daily[2] or 'utf8mb4_unicode_ci'
            else:
                activity_id_type_daily = 'VARCHAR(100)'
                activity_id_charset_daily = 'utf8mb4'
                activity_id_collation_daily = 'utf8mb4_unicode_ci'
            
            conn.execute(text(f"""
                CREATE TABLE workstep_volume_daily (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    date DATE NOT NULL COMMENT '日期',
                    activity_id {activity_id_type_daily} NULL COMMENT '作业ID',
                    work_package VARCHAR(50) NULL COMMENT '工作包',
                    work_step_description VARCHAR(255) NOT NULL COMMENT '工作步骤描述',
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
                    discipline VARCHAR(50) NULL COMMENT 'Discipline',
                    achieved DECIMAL(38, 20) NOT NULL COMMENT 'Achieved - 完成工程量（保留20位小数精度）',
                    created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
                    updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
                    INDEX idx_workstep_volume_daily_date_activity (date, activity_id),
                    INDEX idx_workstep_volume_daily_date_work_package (date, work_package),
                    INDEX idx_workstep_volume_daily_work_package (work_package),
                    INDEX idx_workstep_volume_daily_block (block),
                    INDEX idx_workstep_volume_daily_discipline (discipline),
                    INDEX idx_workstep_volume_daily_scope_block (scope, block),
                    INDEX idx_workstep_volume_daily_block_discipline (block, discipline)
                ) ENGINE=InnoDB DEFAULT CHARSET={activity_id_charset_daily} COLLATE={activity_id_collation_daily}
                COMMENT='非关键工作步骤工程量日报表 - 存储 isKeyQuantity=false 的工作步骤日报完成量'
            """))
            
            # 单独添加外键约束（如果可能）
            try:
                conn.execute(text(f"""
                    ALTER TABLE workstep_volume_daily
                    ADD CONSTRAINT fk_workstep_volume_daily_activity 
                        FOREIGN KEY (activity_id) 
                        REFERENCES activity_summary(activity_id) 
                        ON DELETE SET NULL
                """))
                print("  ✓ 外键约束添加成功")
            except Exception as fk_error:
                print(f"  ⚠ 外键约束添加失败（可忽略）: {str(fk_error)}")
            conn.commit()
            print("  ✓ workstep_volume_daily 表创建成功")
            
        except Exception as e:
            print(f"  ✗ 迁移失败: {str(e)}")
            import traceback
            traceback.print_exc()
            conn.rollback()
            raise


if __name__ == "__main__":
    migrate()
    print("\n迁移完成！")

