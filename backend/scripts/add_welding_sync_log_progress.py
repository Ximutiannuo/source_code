"""
添加 welding_sync_logs 表的 progress 字段
"""
import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import create_engine, text
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def add_progress_column():
    """添加 progress 列到 welding_sync_logs 表"""
    try:
        # 从环境变量或 .env 文件读取数据库URL
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            # 尝试从 .env 文件读取
            env_file = os.path.join(os.path.dirname(__file__), '..', '.env')
            if os.path.exists(env_file):
                with open(env_file, 'r', encoding='utf-8') as f:
                    for line in f:
                        if line.startswith('DATABASE_URL='):
                            database_url = line.split('=', 1)[1].strip().strip('"').strip("'")
                            break
        
        if not database_url:
            raise ValueError("未找到 DATABASE_URL 环境变量")
        
        # 创建数据库引擎
        engine = create_engine(database_url, echo=False)
        
        with engine.connect() as conn:
            # 检查列是否已存在
            check_sql = text("""
                SELECT COUNT(*) as count
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'welding_sync_logs'
                AND COLUMN_NAME = 'progress'
            """)
            result = conn.execute(check_sql).fetchone()
            
            if result and result[0] > 0:
                logger.info("progress 列已存在，跳过添加")
                return
            
            # 添加 progress 列
            alter_sql = text("""
                ALTER TABLE welding_sync_logs
                ADD COLUMN progress INT DEFAULT 0 COMMENT '进度百分比（0-100）'
            """)
            conn.execute(alter_sql)
            conn.commit()
            
            logger.info("成功添加 progress 列到 welding_sync_logs 表")
            
    except Exception as e:
        logger.error(f"添加 progress 列失败: {e}", exc_info=True)
        raise

if __name__ == "__main__":
    add_progress_column()

