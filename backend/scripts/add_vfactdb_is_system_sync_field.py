"""
为VFACTDB表添加is_system_sync字段的迁移脚本
用于区分系统同步数据和用户提交的数据
"""
import sys
import os
import logging
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# 添加项目根目录到路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def add_is_system_sync_field():
    """为VFACTDB表添加is_system_sync字段"""
    logger.info("开始为VFACTDB表添加is_system_sync字段...")
    try:
        load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            raise ValueError("未找到 DATABASE_URL 环境变量")
        
        engine = create_engine(database_url, echo=False)
        
        with engine.connect() as conn:
            # 检查字段是否已存在
            check_sql = text("""
                SELECT COUNT(*) as count
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'vfactdb'
                AND COLUMN_NAME = 'is_system_sync'
            """)
            result = conn.execute(check_sql).fetchone()
            
            if result and result[0] > 0:
                logger.info("is_system_sync 字段已存在，跳过添加")
            else:
                # 添加字段
                alter_sql = text("""
                    ALTER TABLE vfactdb
                    ADD COLUMN is_system_sync BOOLEAN DEFAULT FALSE COMMENT '是否为系统同步数据（True=系统同步，False=用户提交）',
                    ADD INDEX idx_vfactdb_is_system_sync (is_system_sync)
                """)
                conn.execute(alter_sql)
                conn.commit()
                logger.info("成功添加 is_system_sync 字段到 vfactdb 表")
                
                # 将现有的PI04/PI05数据标记为系统同步（如果它们看起来是系统同步的）
                # 注意：这里我们只标记work_package为PI04或PI05的数据
                # 因为系统同步只同步这两个work_package
                update_sql = text("""
                    UPDATE vfactdb
                    SET is_system_sync = TRUE
                    WHERE work_package IN ('PI04', 'PI05')
                    AND is_system_sync = FALSE
                """)
                result = conn.execute(update_sql)
                conn.commit()
                logger.info(f"已将 {result.rowcount} 条PI04/PI05数据标记为系统同步")
            
            logger.info("字段添加完成。")
            
    except Exception as e:
        logger.error(f"添加字段失败: {e}", exc_info=True)
        raise

if __name__ == "__main__":
    add_is_system_sync_field()

