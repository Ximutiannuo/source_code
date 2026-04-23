"""
生产环境迁移脚本：初始化作业状态控制系统
1. 创建 activity_status_records 表 (持久化存储)
2. 为 activity_summary 表增加 system_status 字段 (用于物化视图展示)
"""
import sys
import os
from pathlib import Path
from sqlalchemy import text

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from app.database import SessionLocal, engine

def run_migration():
    db = SessionLocal()
    print("=" * 60)
    print("开始执行作业状态控制系统迁移...")
    print("=" * 60)

    try:
        # 1. 创建 activity_status_records 表
        print("\n[1/3] 检查并创建 activity_status_records 表...")
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS activity_status_records (
                activity_id VARCHAR(100) PRIMARY KEY,
                status VARCHAR(50) DEFAULT 'In Progress',
                actual_finish_date DATE,
                confirmed_by INT,
                confirmed_at DATETIME,
                remarks VARCHAR(255),
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_asr_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """))
        print("  ✓ 确认: activity_status_records 表已就绪。")

        # 2. 检查并为 activity_summary 增加 system_status 字段
        print("\n[2/3] 检查 activity_summary 字段扩展...")
        # 修复：在 MySQL 中检查列是否存在
        check_col_sql = text("""
            SELECT COUNT(*) 
            FROM information_schema.columns 
            WHERE table_schema = DATABASE() 
            AND table_name = 'activity_summary' 
            AND column_name = 'system_status'
        """)
        exists = db.execute(check_col_sql).scalar() > 0
        
        if not exists:
            print("  - 正在添加 system_status 字段到 activity_summary...")
            db.execute(text("""
                ALTER TABLE activity_summary 
                ADD COLUMN system_status VARCHAR(50) DEFAULT 'In Progress' 
                AFTER type;
            """))
            db.execute(text("ALTER TABLE activity_summary ADD INDEX idx_summary_system_status (system_status);"))
            print("  ✓ system_status 字段添加成功。")
        else:
            print("  ✓ 字段 system_status 已存在，跳过。")

        # 3. 验证结构
        print("\n[3/3] 最终结构验证日志:")
        asr_count = db.execute(text("SELECT COUNT(*) FROM activity_status_records")).scalar()
        summary_cols_count = db.execute(text("""
            SELECT COUNT(*) 
            FROM information_schema.columns 
            WHERE table_schema = DATABASE() 
            AND table_name = 'activity_summary'
        """)).scalar()
        
        print(f"  - 当前已确认完成的作业数 (activity_status_records): {asr_count}")
        print(f"  - activity_summary 当前总字段数: {summary_cols_count}")
        
        db.commit()
        print("\n" + "=" * 60)
        print("迁移验证通过！你可以继续进行下一步。")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        print(f"\n[!] 迁移失败，已回滚: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    run_migration()
