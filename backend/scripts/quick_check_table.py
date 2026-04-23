"""
快速检查表状态
"""
import sys
import os
from pathlib import Path

project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from app.database import load_env_with_fallback
if not os.getenv('DATABASE_URL'):
    load_env_with_fallback()

from sqlalchemy import text
from app.database import SessionLocal
import logging
import time

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

table_name = 'p6_activity_code_assignments'
db = SessionLocal()

try:
    # 1. 快速检查行数（使用估算值）
    logger.info("1. 检查表行数（估算）...")
    info_sql = text(f"SELECT TABLE_ROWS FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '{table_name}'")
    result = db.execute(info_sql).fetchone()
    estimated_rows = result[0] if result else 0
    logger.info(f"   估算行数: {estimated_rows:,}")
    
    # 2. 实际COUNT（如果估算值很大）
    if estimated_rows > 0:
        logger.info("2. 实际统计行数...")
        start = time.time()
        count_sql = text(f"SELECT COUNT(*) FROM {table_name}")
        count_result = db.execute(count_sql).fetchone()
        actual_count = count_result[0] if count_result else 0
        elapsed = time.time() - start
        logger.info(f"   实际行数: {actual_count:,} (耗时: {elapsed:.2f}秒)")
    else:
        logger.info("2. 表可能已空，跳过COUNT")
        actual_count = 0
    
    # 3. 检查是否有锁
    logger.info("3. 检查表锁...")
    try:
        lock_sql = text(f"""
            SELECT COUNT(*) FROM information_schema.PROCESSLIST 
            WHERE DB = DATABASE() 
            AND INFO LIKE '%{table_name}%' 
            AND COMMAND != 'Sleep'
        """)
        lock_count = db.execute(lock_sql).fetchone()[0]
        if lock_count > 0:
            logger.warning(f"   ⚠️ 发现 {lock_count} 个相关查询正在运行！")
            # 显示详细信息
            detail_sql = text(f"""
                SELECT ID, USER, TIME, STATE, LEFT(INFO, 200) 
                FROM information_schema.PROCESSLIST 
                WHERE DB = DATABASE() 
                AND INFO LIKE '%{table_name}%' 
                AND COMMAND != 'Sleep'
            """)
            for row in db.execute(detail_sql):
                logger.warning(f"     查询ID: {row[0]}, 运行时间: {row[2]}秒, 状态: {row[3]}")
                logger.warning(f"     查询: {row[4]}")
        else:
            logger.info("   ✓ 没有相关查询")
    except Exception as e:
        logger.warning(f"   无法检查锁: {e}")
    
    # 4. 测试删除1行
    if actual_count > 0:
        logger.info("4. 测试删除1行...")
        try:
            start = time.time()
            test_sql = text(f"DELETE FROM {table_name} LIMIT 1")
            result = db.execute(test_sql)
            db.rollback()  # 回滚
            elapsed = time.time() - start
            logger.info(f"   删除1行耗时: {elapsed:.2f}秒")
            if elapsed > 1:
                logger.warning(f"   ⚠️ 删除1行耗时超过1秒，表可能有性能问题！")
        except Exception as e:
            logger.error(f"   测试删除失败: {e}")
    
    # 5. 检查索引数量
    logger.info("5. 检查索引...")
    idx_sql = text(f"""
        SELECT COUNT(DISTINCT INDEX_NAME) 
        FROM information_schema.STATISTICS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = '{table_name}'
        AND INDEX_NAME != 'PRIMARY'
    """)
    idx_count = db.execute(idx_sql).fetchone()[0]
    logger.info(f"   非主键索引数量: {idx_count}")
    
    if idx_count > 10:
        logger.warning(f"   ⚠️ 索引数量较多({idx_count}个)，可能影响删除性能")
    
finally:
    db.close()
