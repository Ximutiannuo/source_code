"""
迁移脚本：移除 role_permissions 和 user_permissions 表中的 gcc_scope 字段

原因：gcc_scope 和 scope 字段重复，scope 字段已经存储了从 P6 的 activity code 中读取的 code value
"""
import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import engine
from sqlalchemy import text
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def check_column_exists(conn, table_name: str, column_name: str) -> bool:
    """检查表中是否存在指定列"""
    result = conn.execute(text(f"""
        SELECT COUNT(*) 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = '{table_name}'
        AND COLUMN_NAME = '{column_name}'
    """))
    return result.scalar() > 0


def migrate():
    """执行迁移"""
    logger.info("开始迁移：移除 gcc_scope 字段")
    
    with engine.connect() as conn:
        # 检查并移除 user_permissions 表中的 gcc_scope 字段
        if check_column_exists(conn, 'user_permissions', 'gcc_scope'):
            logger.info("发现 user_permissions 表中的 gcc_scope 字段，准备移除...")
            
            # 如果 gcc_scope 有值但 scope 为空，将 gcc_scope 的值复制到 scope
            conn.execute(text("""
                UPDATE user_permissions
                SET scope = gcc_scope
                WHERE gcc_scope IS NOT NULL 
                AND gcc_scope != ''
                AND (scope IS NULL OR scope = '')
            """))
            conn.commit()
            logger.info("已将 user_permissions 表中 gcc_scope 的值复制到 scope（如果 scope 为空）")
            
            # 移除 gcc_scope 字段
            conn.execute(text("""
                ALTER TABLE user_permissions
                DROP COLUMN gcc_scope
            """))
            conn.commit()
            logger.info("  [OK] user_permissions 表中的 gcc_scope 字段已移除")
        else:
            logger.info("  [SKIP] user_permissions 表中不存在 gcc_scope 字段")
        
        # 检查并移除 role_permissions 表中的 gcc_scope 字段
        if check_column_exists(conn, 'role_permissions', 'gcc_scope'):
            logger.info("发现 role_permissions 表中的 gcc_scope 字段，准备移除...")
            
            # 如果 gcc_scope 有值但 scope 为空，将 gcc_scope 的值复制到 scope
            conn.execute(text("""
                UPDATE role_permissions
                SET scope = gcc_scope
                WHERE gcc_scope IS NOT NULL 
                AND gcc_scope != ''
                AND (scope IS NULL OR scope = '')
            """))
            conn.commit()
            logger.info("已将 role_permissions 表中 gcc_scope 的值复制到 scope（如果 scope 为空）")
            
            # 移除 gcc_scope 字段
            conn.execute(text("""
                ALTER TABLE role_permissions
                DROP COLUMN gcc_scope
            """))
            conn.commit()
            logger.info("  [OK] role_permissions 表中的 gcc_scope 字段已移除")
        else:
            logger.info("  [SKIP] role_permissions 表中不存在 gcc_scope 字段")
    
    logger.info("迁移完成！")


if __name__ == "__main__":
    try:
        migrate()
        print("\n✅ 迁移成功完成！")
    except Exception as e:
        logger.error(f"迁移失败: {e}", exc_info=True)
        print(f"\n❌ 迁移失败: {e}")
        sys.exit(1)

