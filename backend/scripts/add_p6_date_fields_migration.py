"""
P6表添加p6_create_date和p6_last_update_date字段的迁移脚本

说明：
1. 先kill相关连接，避免ALTER TABLE时锁表
2. 为所有p6_*表添加p6_create_date和p6_last_update_date字段
3. 为p6_activities表额外添加data_date和baseline1_duration字段
4. 为新字段创建索引（用于增量同步查询）
"""
import sys
import os
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from sqlalchemy import text
from app.database import SessionLocal
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def kill_connections_to_p6_tables(db):
    """
    查找并kill正在使用p6_*表的连接
    """
    logger.info("查找正在使用p6_*表的连接...")
    
    # 获取当前数据库名称
    result = db.execute(text("SELECT DATABASE() as db_name")).first()
    db_name = result.db_name if result else None
    
    if not db_name:
        logger.warning("无法获取数据库名称，跳过kill连接步骤")
        return
    
    # 查找相关连接
    query = text("""
        SELECT id, user, host, db, command, time, state, info
        FROM information_schema.processlist
        WHERE db = :db_name
          AND (
            info LIKE '%p6_activities%' OR
            info LIKE '%p6_wbs%' OR
            info LIKE '%p6_projects%' OR
            info LIKE '%p6_eps%' OR
            info LIKE '%p6_activity_codes%' OR
            info LIKE '%p6_resources%' OR
            info LIKE '%p6_activity_code_assignments%' OR
            info LIKE '%p6_resource_assignments%'
          )
          AND id != CONNECTION_ID()
    """)
    
    connections = db.execute(query, {'db_name': db_name}).fetchall()
    
    if not connections:
        logger.info("没有找到需要kill的连接")
        return
    
    logger.info(f"找到 {len(connections)} 个相关连接，准备kill...")
    
    killed_count = 0
    for conn in connections:
        try:
            conn_id = conn.id
            logger.info(f"Killing connection {conn_id} (user: {conn.user}, host: {conn.host})")
            db.execute(text(f"KILL {conn_id}"))
            killed_count += 1
        except Exception as e:
            logger.error(f"Kill connection {conn.id} 失败: {e}")
    
    db.commit()
    logger.info(f"已kill {killed_count} 个连接")


def add_columns_to_tables(db):
    """
    为所有p6_*表添加字段
    """
    logger.info("开始为p6_*表添加字段...")
    
    # 定义所有需要添加的字段
    alter_statements = [
        # p6_activities: 添加p6_create_date, p6_last_update_date, data_date, baseline1_duration
        """
        ALTER TABLE p6_activities 
          ADD COLUMN p6_create_date DATETIME NULL COMMENT 'P6 CreateDate（记录创建时间）',
          ADD COLUMN p6_last_update_date DATETIME NULL COMMENT 'P6 LastUpdateDate（记录最后更新时间，用于增量同步）',
          ADD COLUMN data_date DATETIME NULL COMMENT 'Data Date',
          ADD COLUMN baseline1_duration DECIMAL(18, 2) NULL COMMENT 'Baseline1 Duration'
        """,
        
        # p6_wbs
        """
        ALTER TABLE p6_wbs 
          ADD COLUMN p6_create_date DATETIME NULL COMMENT 'P6 CreateDate（记录创建时间）',
          ADD COLUMN p6_last_update_date DATETIME NULL COMMENT 'P6 LastUpdateDate（记录最后更新时间，用于增量同步）'
        """,
        
        # p6_projects
        """
        ALTER TABLE p6_projects 
          ADD COLUMN p6_create_date DATETIME NULL COMMENT 'P6 CreateDate（记录创建时间）',
          ADD COLUMN p6_last_update_date DATETIME NULL COMMENT 'P6 LastUpdateDate（记录最后更新时间，用于增量同步）'
        """,
        
        # p6_eps
        """
        ALTER TABLE p6_eps 
          ADD COLUMN p6_create_date DATETIME NULL COMMENT 'P6 CreateDate（记录创建时间）',
          ADD COLUMN p6_last_update_date DATETIME NULL COMMENT 'P6 LastUpdateDate（记录最后更新时间，用于增量同步）'
        """,
        
        # p6_activity_codes
        """
        ALTER TABLE p6_activity_codes 
          ADD COLUMN p6_create_date DATETIME NULL COMMENT 'P6 CreateDate（记录创建时间）',
          ADD COLUMN p6_last_update_date DATETIME NULL COMMENT 'P6 LastUpdateDate（记录最后更新时间，用于增量同步）'
        """,
        
        # p6_resources
        """
        ALTER TABLE p6_resources 
          ADD COLUMN p6_create_date DATETIME NULL COMMENT 'P6 CreateDate（记录创建时间）',
          ADD COLUMN p6_last_update_date DATETIME NULL COMMENT 'P6 LastUpdateDate（记录最后更新时间，用于增量同步）'
        """,
        
        # p6_activity_code_assignments
        """
        ALTER TABLE p6_activity_code_assignments 
          ADD COLUMN p6_create_date DATETIME NULL COMMENT 'P6 CreateDate（记录创建时间）',
          ADD COLUMN p6_last_update_date DATETIME NULL COMMENT 'P6 LastUpdateDate（记录最后更新时间，用于增量同步）'
        """,
        
        # p6_resource_assignments
        """
        ALTER TABLE p6_resource_assignments 
          ADD COLUMN p6_create_date DATETIME NULL COMMENT 'P6 CreateDate（记录创建时间）',
          ADD COLUMN p6_last_update_date DATETIME NULL COMMENT 'P6 LastUpdateDate（记录最后更新时间，用于增量同步）'
        """,
    ]
    
    for i, statement in enumerate(alter_statements, 1):
        try:
            # 提取表名用于日志
            table_name = statement.split('ALTER TABLE')[1].split()[0] if 'ALTER TABLE' in statement else 'unknown'
            logger.info(f"[{i}/{len(alter_statements)}] 正在为 {table_name} 添加字段...")
            db.execute(text(statement))
            db.commit()
            logger.info(f"✓ {table_name} 字段添加成功")
        except Exception as e:
            error_msg = str(e)
            if "Duplicate column name" in error_msg:
                logger.warning(f"⚠ {table_name} 字段已存在，跳过")
            else:
                logger.error(f"✗ {table_name} 字段添加失败: {e}")
                raise


def truncate_p6_tables(db):
    """
    清空所有p6_*表（可选步骤，用于加快ALTER TABLE速度）
    警告：这会删除所有数据！
    """
    logger.warning("=" * 60)
    logger.warning("警告：即将清空所有p6_*表的数据！")
    logger.warning("=" * 60)
    
    tables = [
        'p6_activity_code_assignments',
        'p6_resource_assignments',
        'p6_activities',
        'p6_wbs',
        'p6_activity_codes',
        'p6_resources',
        'p6_projects',
        'p6_eps',
    ]
    
    for table in tables:
        try:
            logger.info(f"清空表 {table}...")
            db.execute(text(f"TRUNCATE TABLE {table}"))
            db.commit()
            logger.info(f"✓ {table} 已清空")
        except Exception as e:
            logger.error(f"✗ 清空 {table} 失败: {e}")
            raise


def create_indexes(db):
    """
    为新字段创建索引
    """
    logger.info("开始创建索引...")
    
    indexes = [
        ("idx_p6_activities_last_update_date", "p6_activities", "p6_last_update_date"),
        ("idx_p6_wbs_last_update_date", "p6_wbs", "p6_last_update_date"),
        ("idx_p6_projects_last_update_date", "p6_projects", "p6_last_update_date"),
        ("idx_p6_eps_last_update_date", "p6_eps", "p6_last_update_date"),
        ("idx_p6_activity_codes_last_update_date", "p6_activity_codes", "p6_last_update_date"),
        ("idx_p6_resources_last_update_date", "p6_resources", "p6_last_update_date"),
        ("idx_p6_activity_code_assignments_last_update_date", "p6_activity_code_assignments", "p6_last_update_date"),
        ("idx_p6_resource_assignments_last_update_date", "p6_resource_assignments", "p6_last_update_date"),
    ]
    
    for idx_name, table_name, column_name in indexes:
        try:
            logger.info(f"创建索引 {idx_name} on {table_name}({column_name})...")
            db.execute(text(f"CREATE INDEX {idx_name} ON {table_name}({column_name})"))
            db.commit()
            logger.info(f"✓ 索引 {idx_name} 创建成功")
        except Exception as e:
            error_msg = str(e)
            if "Duplicate key name" in error_msg:
                logger.warning(f"⚠ 索引 {idx_name} 已存在，跳过")
            else:
                logger.error(f"✗ 索引 {idx_name} 创建失败: {e}")
                raise


def main():
    """
    主函数
    
    参数（通过环境变量或命令行）：
    - TRUNCATE_TABLES=1: 是否先清空表（会删除所有数据！）
    - --truncate: 命令行参数，等同于TRUNCATE_TABLES=1
    """
    import sys
    
    # 检查是否要truncate表
    truncate_tables = os.getenv('TRUNCATE_TABLES', '0') == '1' or '--truncate' in sys.argv
    
    logger.info("=" * 60)
    logger.info("P6表添加p6_create_date和p6_last_update_date字段的迁移脚本")
    logger.info("=" * 60)
    
    if truncate_tables:
        logger.warning("\n⚠️  警告：将先清空所有p6_*表的数据！")
        logger.warning("   这可以加快ALTER TABLE的速度，但会丢失所有数据")
        logger.warning("   仅在测试环境或数据可重建时使用")
        response = input("\n确认要继续吗？(yes/no): ")
        if response.lower() != 'yes':
            logger.info("已取消")
            return
    
    db = SessionLocal()
    
    try:
        # 第一步：Kill相关连接
        logger.info("\n[步骤1] Kill相关连接...")
        kill_connections_to_p6_tables(db)
        
        # 可选步骤：清空表（加快ALTER TABLE速度）
        if truncate_tables:
            logger.info("\n[步骤1.5] 清空所有p6_*表...")
            truncate_p6_tables(db)
        
        # 第二步：添加字段
        logger.info("\n[步骤2] 为所有p6_*表添加字段...")
        add_columns_to_tables(db)
        
        # 第三步：创建索引
        logger.info("\n[步骤3] 创建索引...")
        create_indexes(db)
        
        logger.info("\n" + "=" * 60)
        logger.info("✓ 迁移完成！")
        logger.info("=" * 60)
        logger.info("\n注意：")
        if truncate_tables:
            logger.info("- 所有p6_*表的数据已被清空")
            logger.info("- 需要重新同步数据")
        else:
            logger.info("- 现有记录的p6_create_date和p6_last_update_date将为NULL")
            logger.info("- 下次同步时会自动填充这些字段的值")
        
    except Exception as e:
        logger.error(f"\n✗ 迁移失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()

