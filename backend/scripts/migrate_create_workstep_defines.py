"""
数据库迁移脚本：创建 workstep_defines 表
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
    print("开始创建 workstep_defines 表...")
    
    with engine.connect() as conn:
        try:
            # 检查表是否已存在
            result = conn.execute(text("""
                SELECT TABLE_NAME 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'workstep_defines'
            """))
            
            if result.fetchone():
                print("  ⚠ workstep_defines 表已存在")
                confirm = input("是否删除并重新创建? (yes/no): ")
                if confirm.lower() == 'yes':
                    conn.execute(text("DROP TABLE IF EXISTS workstep_defines"))
                    conn.commit()
                    print("  ✓ 已删除旧表")
                else:
                    print("  跳过创建")
                    return
            
            # 创建 workstep_defines 表
            print("  正在创建 workstep_defines 表...")
            conn.execute(text("""
                CREATE TABLE workstep_defines (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    work_package VARCHAR(50) NOT NULL COMMENT '工作包（外键关联 rsc_defines.work_package）',
                    work_step_description VARCHAR(255) NOT NULL COMMENT '工作步骤描述',
                    work_step_weight DECIMAL(10, 4) NULL COMMENT '工作步骤权重（百分比）',
                    is_key_quantity BOOLEAN DEFAULT FALSE NOT NULL COMMENT '是否为关键数量（绿色底纹）',
                    estimated_total DECIMAL(18, 2) NULL COMMENT '预估总量（仅非关键工作步骤使用，可选）',
                    sort_order INT DEFAULT 0 NOT NULL COMMENT '排序',
                    is_active BOOLEAN DEFAULT TRUE NOT NULL COMMENT '是否激活',
                    created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
                    updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
                    INDEX idx_workstep_define_work_package (work_package),
                    INDEX idx_workstep_define_is_key (is_key_quantity),
                    INDEX idx_workstep_define_work_package_key (work_package, is_key_quantity),
                    UNIQUE KEY uk_work_package_description (work_package, work_step_description)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                COMMENT='工作步骤定义表 - 对应 WorkSteps.xlsx'
            """))
            conn.commit()
            print("  ✓ workstep_defines 表创建成功")
            
        except Exception as e:
            print(f"  ✗ 迁移失败: {str(e)}")
            import traceback
            traceback.print_exc()
            conn.rollback()
            raise


if __name__ == "__main__":
    migrate()
    print("\n迁移完成！")

