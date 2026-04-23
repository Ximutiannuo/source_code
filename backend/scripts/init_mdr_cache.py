import sys
import os
from sqlalchemy import text

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.database import default_engine
from app.services.mdr_sync_service import MDRSyncService

def initialize_cache():
    print("=" * 50)
    print("正在初始化 MDR 缓存表并进行首次预计算...")
    print("=" * 50)

    with default_engine.connect() as conn:
        # 1. 创建缓存表 (确保表存在)
        print("正在检查并创建缓存表...")
        
        # 变动分析缓存表
        conn.execute(text("""
        CREATE TABLE IF NOT EXISTS `mdr_delta_cache` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `originator_code` VARCHAR(255),
            `discipline` VARCHAR(255),
            `new_completed` INT DEFAULT 0,
            `accelerated` INT DEFAULT 0,
            `delayed` INT DEFAULT 0,
            `updated_at` DATETIME,
            INDEX `idx_lookup` (`originator_code`, `discipline`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """))

        # S 曲线缓存表
        conn.execute(text("""
        CREATE TABLE IF NOT EXISTS `mdr_scurve_cache` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `originator_code` VARCHAR(255),
            `discipline` VARCHAR(255),
            `month` VARCHAR(7),
            `p_count` INT DEFAULT 0,
            `f_count` INT DEFAULT 0,
            `a_count` INT DEFAULT 0,
            INDEX `idx_lookup` (`originator_code`, `discipline`, `month`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """))

        # 扩展分析汇总表 (如果已存在则修改结构)
        try:
            conn.execute(text("ALTER TABLE mdr_analysis_summary ADD COLUMN document_type VARCHAR(255) AFTER discipline"))
            conn.execute(text("ALTER TABLE mdr_analysis_summary ADD COLUMN plan_count INT DEFAULT 0 AFTER total_dwg"))
            conn.execute(text("ALTER TABLE mdr_analysis_summary ADD COLUMN forecast_count INT DEFAULT 0 AFTER plan_count"))
            conn.execute(text("ALTER TABLE mdr_analysis_summary ADD COLUMN actual_count INT DEFAULT 0 AFTER forecast_count"))
            conn.execute(text("ALTER TABLE mdr_analysis_summary ADD COLUMN review_a_count INT DEFAULT 0 AFTER actual_count"))
            conn.execute(text("ALTER TABLE mdr_analysis_summary DROP COLUMN finished_dwg"))
        except:
            # 如果列已存在或表结构已经是新的，忽略错误
            pass

        conn.commit()
        print("✅ 缓存表结构检查完毕。")

        # 2. 调用服务中的预计算逻辑
        print("正在进行全面预计算 (针对 300w+ 数据)...")
        try:
            print("  - 正在预计算汇总统计 (Summary Table)...")
            MDRSyncService._run_analysis(conn)
            print("  - 正在预计算变动分析 (Delta Cache)...")
            MDRSyncService._run_delta_cache(conn)
            print("  - 正在预计算 S 曲线 (SCurve Cache)...")
            MDRSyncService._run_scurve_cache(conn)
            
            conn.commit()
            print("✅ 全面预计算成功！仪表盘页面现在将秒开结果。")
        except Exception as e:
            print(f"❌ 预计算失败: {e}")

if __name__ == "__main__":
    initialize_cache()
