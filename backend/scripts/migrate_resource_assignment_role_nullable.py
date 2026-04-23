"""
迁移脚本：修改 p6_resource_assignments 表的 role_object_id 字段允许为 NULL
（因为实际数据中很多ResourceAssignment记录没有RoleObjectId）
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

from sqlalchemy import text
from app.database import SessionLocal
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def migrate_role_object_id_nullable():
    """修改 role_object_id 字段允许为 NULL"""
    db = SessionLocal()
    
    try:
        logger.info("开始迁移：修改 p6_resource_assignments.role_object_id 字段允许为 NULL...")
        logger.info("（因为实际数据中很多ResourceAssignment记录没有RoleObjectId）")
        
        # 检查当前字段定义
        check_sql = text("""
            SELECT COLUMN_TYPE, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'p6_resource_assignments'
            AND COLUMN_NAME = 'role_object_id'
        """)
        
        result = db.execute(check_sql).fetchone()
        if result:
            current_type, is_nullable = result
            logger.info(f"当前字段定义: {current_type}, 允许NULL: {is_nullable}")
            
            if is_nullable == 'YES':
                logger.info("✓ 字段已经允许为 NULL，无需迁移")
                return True
        
        # 修改字段允许为 NULL
        alter_sql = text("""
            ALTER TABLE p6_resource_assignments
            MODIFY COLUMN role_object_id INT NULL
        """)
        
        db.execute(alter_sql)
        db.commit()
        
        logger.info("✓ 成功修改 role_object_id 字段允许为 NULL")
        
        # 验证修改结果
        result = db.execute(check_sql).fetchone()
        if result:
            current_type, is_nullable = result
            logger.info(f"修改后字段定义: {current_type}, 允许NULL: {is_nullable}")
            if is_nullable == 'YES':
                logger.info("✅ 迁移成功！")
                return True
            else:
                logger.error("❌ 迁移失败：字段仍然不允许为 NULL")
                return False
        
        return True
        
    except Exception as e:
        logger.error(f"❌ 迁移失败: {e}", exc_info=True)
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    success = migrate_role_object_id_nullable()
    if success:
        logger.info("\n" + "="*60)
        logger.info("✅ 迁移完成！")
        logger.info("="*60)
    else:
        logger.error("\n" + "="*60)
        logger.error("❌ 迁移失败")
        logger.error("="*60)
        sys.exit(1)
