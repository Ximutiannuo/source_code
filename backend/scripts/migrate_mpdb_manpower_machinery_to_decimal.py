"""
将MPDB表的manpower和machinery字段从INT改为DECIMAL(38,20)的迁移脚本

使用方法:
    python backend/scripts/migrate_mpdb_manpower_machinery_to_decimal.py

注意事项:
    1. 执行前请备份数据库
    2. 如果表中有大量数据，此操作可能需要较长时间
    3. 脚本会自动处理连接超时和重试
"""

import sys
import os
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from sqlalchemy import text, inspect
from app.database import SessionLocal, get_default_engine
import time
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def check_column_type(db, table_name, column_name):
    """检查列的类型"""
    try:
        inspector = inspect(db.bind)
        columns = inspector.get_columns(table_name)
        for col in columns:
            if col['name'] == column_name:
                return str(col['type'])
    except Exception as e:
        logger.error(f"检查列类型时出错: {e}")
    return None


def get_table_row_count(db):
    """获取表的行数"""
    result = db.execute(text("SELECT COUNT(*) as cnt FROM mpdb")).fetchone()
    return result[0] if result else 0


def migrate_column(db, column_name, max_retries=5, retry_delay=10):
    """迁移单个列，带重试机制和超时处理
    
    Args:
        db: 数据库会话对象
        column_name: 要迁移的列名
        max_retries: 最大重试次数
        retry_delay: 重试延迟（秒）
    
    Returns:
        (success: bool, db: Session) - 成功标志和数据库会话（可能需要重新创建）
    """
    current_db = db
    for attempt in range(1, max_retries + 1):
        try:
            logger.info(f"开始修改 {column_name} 字段类型 (尝试 {attempt}/{max_retries})...")
            
            # 检查当前类型
            current_type = check_column_type(current_db, 'mpdb', column_name)
            logger.info(f"当前 {column_name} 字段类型: {current_type}")
            
            if current_type and ('DECIMAL' in str(current_type) or 'NUMERIC' in str(current_type)):
                logger.info(f"✓ {column_name} 字段已经是 DECIMAL 类型，跳过")
                return True, current_db
            
            # 设置较长的超时时间（对于大表很重要）
            # 先设置会话级别的超时
            current_db.execute(text("SET SESSION wait_timeout = 28800"))  # 8小时
            current_db.execute(text("SET SESSION interactive_timeout = 28800"))  # 8小时
            current_db.execute(text("SET SESSION lock_wait_timeout = 31536000"))  # 1年（实际上不限制）
            current_db.commit()
            
            # 执行 ALTER TABLE
            comment = '人力数量' if column_name == 'manpower' else '机械数量'
            sql = f"""
            ALTER TABLE mpdb 
            MODIFY COLUMN {column_name} DECIMAL(38,20) COMMENT '{comment}' 
            DEFAULT 0
            """
            
            logger.info(f"执行 SQL: ALTER TABLE mpdb MODIFY COLUMN {column_name} DECIMAL(38,20)...")
            logger.info("⚠ 注意：如果表中有大量数据，此操作可能需要较长时间，请耐心等待...")
            start_time = time.time()
            
            # 执行SQL
            current_db.execute(text(sql))
            current_db.commit()
            
            elapsed_time = time.time() - start_time
            logger.info(f"✓ {column_name} 字段修改成功，耗时 {elapsed_time:.2f} 秒 ({elapsed_time/60:.2f} 分钟)")
            
            # 验证修改结果
            new_type = check_column_type(current_db, 'mpdb', column_name)
            logger.info(f"修改后 {column_name} 字段类型: {new_type}")
            
            if new_type and ('DECIMAL' in str(new_type) or 'NUMERIC' in str(new_type)):
                logger.info(f"✓ {column_name} 字段类型验证成功")
                return True, current_db
            else:
                logger.warning(f"⚠ {column_name} 字段类型验证失败，当前类型: {new_type}")
                return False, current_db
                
        except Exception as e:
            error_msg = str(e)
            error_code = getattr(e, 'orig', None)
            if error_code:
                error_code = getattr(error_code, 'args', [None])[0] if hasattr(error_code, 'args') else None
            
            logger.error(f"✗ 修改 {column_name} 字段失败 (尝试 {attempt}/{max_retries}): {error_msg}")
            if error_code:
                logger.error(f"   错误代码: {error_code}")
            
            # 如果是连接超时错误，增加重试延迟
            if 'Lost connection' in error_msg or 'timeout' in error_msg.lower() or error_code == 2013:
                logger.warning("检测到连接超时错误，将使用更长的重试延迟")
                retry_delay = max(retry_delay, 30)  # 至少等待30秒
            
            try:
                current_db.rollback()
            except:
                pass
            
            if attempt < max_retries:
                logger.info(f"等待 {retry_delay} 秒后重试...")
                time.sleep(retry_delay)
                retry_delay *= 2  # 指数退避
                # 重新创建数据库连接
                try:
                    current_db.close()
                except:
                    pass
                current_db = SessionLocal()
            else:
                logger.error(f"✗ {column_name} 字段修改失败，已达到最大重试次数")
                logger.error("建议：")
                logger.error("  1. 检查数据库连接是否稳定")
                logger.error("  2. 增加 MySQL 的 wait_timeout 和 interactive_timeout 设置")
                logger.error("  3. 在维护窗口期间执行此操作")
                logger.error("  4. 考虑分批处理或使用在线DDL工具（如 pt-online-schema-change）")
                return False, current_db
    
    return False, current_db


def main():
    """主函数"""
    logger.info("=" * 60)
    logger.info("MPDB表manpower/machinery字段类型迁移脚本")
    logger.info("=" * 60)
    
    db = SessionLocal()
    
    try:
        # 检查表是否存在
        logger.info("检查mpdb表是否存在...")
        result = db.execute(text("SHOW TABLES LIKE 'mpdb'")).fetchone()
        if not result:
            logger.error("✗ mpdb表不存在，请先创建表")
            return False
        logger.info("✓ mpdb表存在")
        
        # 获取表的行数
        row_count = get_table_row_count(db)
        logger.info(f"mpdb表当前有 {row_count:,} 条记录")
        
        if row_count > 0:
            logger.warning(f"⚠ 表中有 {row_count:,} 条记录，迁移可能需要较长时间")
            logger.warning("⚠ 建议在维护窗口期间执行此操作")
            
            # 询问是否继续（在非交互模式下自动继续）
            logger.info("开始执行迁移...")
        
        # 迁移manpower字段
        logger.info("\n" + "=" * 60)
        logger.info("步骤 1/2: 迁移 manpower 字段")
        logger.info("=" * 60)
        success1, db = migrate_column(db, 'manpower', max_retries=5, retry_delay=10)
        
        if not success1:
            logger.error("✗ manpower字段迁移失败，停止执行")
            return False
        
        # 等待一下，避免数据库连接过载
        logger.info("等待 5 秒后继续...")
        time.sleep(5)
        
        # 重新创建连接，确保连接健康
        try:
            db.close()
        except:
            pass
        db = SessionLocal()
        
        # 迁移machinery字段
        logger.info("\n" + "=" * 60)
        logger.info("步骤 2/2: 迁移 machinery 字段")
        logger.info("=" * 60)
        success2, db = migrate_column(db, 'machinery', max_retries=5, retry_delay=10)
        
        if not success2:
            logger.error("✗ machinery字段迁移失败")
            return False
        
        # 最终验证（重新创建连接确保连接健康）
        try:
            db.close()
        except:
            pass
        db = SessionLocal()
        
        logger.info("\n" + "=" * 60)
        logger.info("最终验证")
        logger.info("=" * 60)
        
        manpower_type = check_column_type(db, 'mpdb', 'manpower')
        machinery_type = check_column_type(db, 'mpdb', 'machinery')
        
        logger.info(f"manpower 字段类型: {manpower_type}")
        logger.info(f"machinery 字段类型: {machinery_type}")
        
        if 'DECIMAL' in str(manpower_type) and 'DECIMAL' in str(machinery_type):
            logger.info("\n" + "=" * 60)
            logger.info("✓ 迁移成功完成！")
            logger.info("=" * 60)
            return True
        else:
            logger.error("\n" + "=" * 60)
            logger.error("✗ 迁移验证失败，请检查")
            logger.error("=" * 60)
            return False
            
    except Exception as e:
        logger.error(f"✗ 迁移过程中发生错误: {str(e)}", exc_info=True)
        try:
            db.rollback()
        except:
            pass
        return False
        
    finally:
        try:
            db.close()
        except:
            pass


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
