"""
添加焊接同步日志统计字段的迁移脚本
添加三个统计字段：welding_list_total, welding_list_completed, vfactdb_matched
"""
import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import text
from app.database import engine
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def add_statistics_fields():
    """添加统计字段到welding_sync_logs表"""
    try:
        with engine.connect() as conn:
            # 开始事务
            trans = conn.begin()
            try:
                # 检查并添加 welding_list_total 字段
                check_query = text("""
                    SELECT COUNT(*) as count
                    FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                    AND TABLE_NAME = 'welding_sync_logs'
                    AND COLUMN_NAME = 'welding_list_total'
                """)
                result = conn.execute(check_query)
                if result.scalar() == 0:
                    logger.info("添加 welding_list_total 字段...")
                    conn.execute(text("""
                        ALTER TABLE welding_sync_logs
                        ADD COLUMN welding_list_total DECIMAL(18, 2) NULL
                        COMMENT '诺德录入总量（Size总和）'
                    """))
                else:
                    logger.info("welding_list_total 字段已存在，跳过")
                
                # 检查并添加 welding_list_completed 字段
                check_query = text("""
                    SELECT COUNT(*) as count
                    FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                    AND TABLE_NAME = 'welding_sync_logs'
                    AND COLUMN_NAME = 'welding_list_completed'
                """)
                result = conn.execute(check_query)
                if result.scalar() == 0:
                    logger.info("添加 welding_list_completed 字段...")
                    conn.execute(text("""
                        ALTER TABLE welding_sync_logs
                        ADD COLUMN welding_list_completed DECIMAL(18, 2) NULL
                        COMMENT '完成量（有日期的Size总和）'
                    """))
                else:
                    logger.info("welding_list_completed 字段已存在，跳过")
                
                # 检查并添加 vfactdb_matched 字段
                check_query = text("""
                    SELECT COUNT(*) as count
                    FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                    AND TABLE_NAME = 'welding_sync_logs'
                    AND COLUMN_NAME = 'vfactdb_matched'
                """)
                result = conn.execute(check_query)
                if result.scalar() == 0:
                    logger.info("添加 vfactdb_matched 字段...")
                    conn.execute(text("""
                        ALTER TABLE welding_sync_logs
                        ADD COLUMN vfactdb_matched DECIMAL(18, 2) NULL
                        COMMENT 'VFACTDB匹配（PI04/PI05的Achieved总和）'
                    """))
                else:
                    logger.info("vfactdb_matched 字段已存在，跳过")
                
                # 提交事务
                trans.commit()
                logger.info("成功添加统计字段到 welding_sync_logs 表")
                
            except Exception as e:
                trans.rollback()
                raise e
                
    except Exception as e:
        logger.error(f"添加统计字段失败: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    logger.info("开始添加焊接同步日志统计字段...")
    add_statistics_fields()
    logger.info("迁移完成！")

