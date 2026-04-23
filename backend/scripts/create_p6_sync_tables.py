"""
创建P6同步相关的数据库表
"""
import sys
import os
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

# 确保环境变量已加载
from app.database import load_env_with_fallback
if not os.getenv('DATABASE_URL'):
    load_env_with_fallback()

from app.database import Base, engine
from app.p6_sync.models import (
    P6EPS,
    P6Project,
    P6WBS,
    P6Activity,
    P6ActivityCode,
    P6ActivityCodeAssignment,
    P6Resource,
    P6ResourceAssignment,
    P6SyncLog
)
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def create_tables():
    """创建所有P6同步相关的表"""
    logger.info("开始创建P6同步相关的数据库表...")
    
    try:
        # 创建所有表
        Base.metadata.create_all(bind=engine)
        logger.info("✅ 所有表创建成功！")
        
        # 列出创建的表
        from sqlalchemy import inspect
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        p6_tables = [t for t in tables if t.startswith('p6_')]
        logger.info(f"\n创建的P6表 ({len(p6_tables)} 个):")
        for table in sorted(p6_tables):
            logger.info(f"  - {table}")
        
    except Exception as e:
        logger.error(f"❌ 创建表失败: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    create_tables()
