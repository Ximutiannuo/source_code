"""
迁移脚本：为p6_activities表添加wbs_id, wbs_path, baseline1_start_date, baseline1_finish_date字段
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

from sqlalchemy.orm import Session
from sqlalchemy import text, inspect
from app.database import SessionLocal, engine
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    force=True
)
logger = logging.getLogger(__name__)


def migrate_p6_activities_add_fields():
    """为p6_activities表添加缺失的字段"""
    db = SessionLocal()
    
    try:
        logger.info(f"\n{'#'*60}")
        logger.info("检查并迁移p6_activities表字段")
        logger.info(f"{'#'*60}\n")
        
        # 检查表是否存在
        check_table_sql = text("""
            SELECT COUNT(*) 
            FROM information_schema.tables 
            WHERE table_schema = DATABASE()
            AND table_name = 'p6_activities'
        """)
        result = db.execute(check_table_sql).fetchone()
        
        if not result or result[0] == 0:
            logger.warning("⚠️ p6_activities表不存在，将使用SQLAlchemy自动创建")
            logger.info("   请运行同步脚本，表会自动创建")
            return {
                "success": True,
                "message": "表不存在，将在首次同步时自动创建"
            }
        
        logger.info("✓ p6_activities表已存在")
        
        # 检查现有字段
        check_columns_sql = text("""
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
            AND table_name = 'p6_activities'
            AND COLUMN_NAME IN ('wbs_id', 'wbs_path', 'baseline1_start_date', 'baseline1_finish_date')
        """)
        existing_columns = db.execute(check_columns_sql).fetchall()
        existing_column_names = {row[0] for row in existing_columns}
        
        logger.info(f"现有字段: {existing_column_names}")
        
        # 需要添加的字段
        fields_to_add = []
        
        if 'wbs_id' not in existing_column_names:
            fields_to_add.append({
                'name': 'wbs_id',
                'definition': 'VARCHAR(100) NULL COMMENT "WBS ID"'
            })
        
        if 'wbs_path' not in existing_column_names:
            fields_to_add.append({
                'name': 'wbs_path',
                'definition': 'VARCHAR(1000) NULL COMMENT "WBS Path (long)"'
            })
        
        if 'baseline1_start_date' not in existing_column_names:
            fields_to_add.append({
                'name': 'baseline1_start_date',
                'definition': 'DATETIME NULL COMMENT "Baseline1 Start Date"'
            })
        
        if 'baseline1_finish_date' not in existing_column_names:
            fields_to_add.append({
                'name': 'baseline1_finish_date',
                'definition': 'DATETIME NULL COMMENT "Baseline1 Finish Date"'
            })
        
        if not fields_to_add:
            logger.info("✓ 所有字段已存在，无需迁移")
            return {
                "success": True,
                "message": "所有字段已存在"
            }
        
        logger.info(f"\n需要添加 {len(fields_to_add)} 个字段:")
        for field in fields_to_add:
            logger.info(f"  - {field['name']}")
        
        # 添加字段
        logger.info("\n开始添加字段...")
        for field in fields_to_add:
            try:
                alter_sql = text(f"ALTER TABLE p6_activities ADD COLUMN {field['name']} {field['definition']}")
                db.execute(alter_sql)
                db.commit()
                logger.info(f"  ✓ 已添加字段: {field['name']}")
            except Exception as e:
                logger.error(f"  ❌ 添加字段 {field['name']} 失败: {e}")
                db.rollback()
                return {
                    "success": False,
                    "error": f"添加字段 {field['name']} 失败: {str(e)}"
                }
        
        logger.info(f"\n{'='*60}")
        logger.info("✅ 迁移完成！")
        logger.info(f"{'='*60}")
        
        return {
            "success": True,
            "fields_added": [f['name'] for f in fields_to_add]
        }
        
    except Exception as e:
        logger.error(f"❌ 迁移失败: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e)
        }
    finally:
        db.close()


if __name__ == "__main__":
    result = migrate_p6_activities_add_fields()
    if not result.get('success'):
        sys.exit(1)
    else:
        logger.info("\n迁移脚本执行完成")
