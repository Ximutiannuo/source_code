"""
⚠️ DEPRECATED - 危险操作脚本，请谨慎使用
强制清空指定表（先清理所有锁，然后DROP + CREATE）

建议：仅在紧急情况下使用，使用前请备份数据
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
from app.database import SessionLocal, engine
import logging
import time
import argparse

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def force_clear_table(table_name: str):
    """强制清空表：先清理所有锁，然后DROP + CREATE"""
    db = SessionLocal()
    
    try:
        logger.info(f"\n{'#'*60}")
        logger.info(f"强制清空表: {table_name}")
        logger.info(f"{'#'*60}\n")
        
        # 步骤1: 强制杀死所有相关查询
        logger.info("步骤1: 强制清理所有相关查询...")
        max_retries = 10
        for retry in range(max_retries):
            try:
                # 查找所有相关查询（包括Sleep状态的）
                # 排除系统线程：event_scheduler, system user等
                blocking_sql = text(f"""
                    SELECT ID, USER, TIME, STATE, LEFT(INFO, 200) as QUERY
                    FROM information_schema.PROCESSLIST 
                    WHERE DB = DATABASE() 
                    AND (INFO LIKE :pattern OR INFO IS NULL)
                    AND ID != CONNECTION_ID()
                    AND USER NOT IN ('event_scheduler', 'system user')
                    AND USER IS NOT NULL
                """)
                blocking_queries = db.execute(blocking_sql, {"pattern": f"%{table_name}%"}).fetchall()
                
                if blocking_queries:
                    logger.warning(f"  尝试 {retry+1}/{max_retries}: 发现 {len(blocking_queries)} 个相关查询")
                    killed_count = 0
                    for q in blocking_queries:
                        query_id = q[0]
                        user = q[1]
                        time_elapsed = q[2]
                        state = q[3]
                        query = q[4] or "N/A"
                        
                        logger.info(f"    查询ID: {query_id}, 用户: {user}, 运行时间: {time_elapsed}秒, 状态: {state}")
                        logger.info(f"    查询: {query[:100]}")
                        
                        try:
                            # 先尝试KILL QUERY（只杀死查询，不杀死连接）
                            db.execute(text(f"KILL QUERY {query_id}"))
                            db.commit()
                            killed_count += 1
                            logger.info(f"      ✓ 已杀死查询 {query_id}")
                        except:
                            try:
                                # 如果KILL QUERY失败，尝试KILL（杀死整个连接）
                                db.execute(text(f"KILL {query_id}"))
                                db.commit()
                                killed_count += 1
                                logger.info(f"      ✓ 已杀死连接 {query_id}")
                            except Exception as e:
                                logger.warning(f"      ⚠️ 无法杀死查询 {query_id}: {e}")
                    
                    if killed_count > 0:
                        logger.info(f"    已杀死 {killed_count} 个查询/连接，等待锁释放...")
                        time.sleep(3)  # 等待3秒让锁释放
                    else:
                        logger.warning(f"    无法杀死任何查询，可能已经断开或不存在")
                        break
                else:
                    logger.info(f"  ✓ 没有发现相关查询")
                    break
            except Exception as e:
                logger.warning(f"  检查阻塞查询失败: {e}")
                if retry < max_retries - 1:
                    time.sleep(2)
        
        # 额外等待一段时间确保锁完全释放
        logger.info("\n等待5秒确保所有锁完全释放...")
        time.sleep(5)
        
        # 步骤2: 获取表结构
        logger.info("\n步骤2: 获取表结构...")
        try:
            show_create_sql = text(f"SHOW CREATE TABLE {table_name}")
            create_result = db.execute(show_create_sql).fetchone()
            
            if not create_result or len(create_result) < 2:
                raise Exception("无法获取表结构")
            
            create_table_sql = create_result[1]
            logger.info(f"  ✓ 已获取表结构")
        except Exception as e:
            logger.error(f"  ❌ 获取表结构失败: {e}")
            logger.info("  尝试使用SQLAlchemy模型重建...")
            create_table_sql = None
        
        # 步骤3: 检查表锁状态
        logger.info("\n步骤3: 检查表锁状态...")
        try:
            # 检查是否有表锁等待
            lock_check_sql = text(f"""
                SELECT 
                    r.trx_id waiting_trx_id,
                    r.trx_mysql_thread_id waiting_thread,
                    r.trx_query waiting_query,
                    b.trx_id blocking_trx_id,
                    b.trx_mysql_thread_id blocking_thread,
                    b.trx_query blocking_query
                FROM information_schema.innodb_lock_waits w
                INNER JOIN information_schema.innodb_trx b ON b.trx_id = w.blocking_trx_id
                INNER JOIN information_schema.innodb_trx r ON r.trx_id = w.requesting_trx_id
            """)
            locks = db.execute(lock_check_sql).fetchall()
            if locks:
                logger.warning(f"  发现 {len(locks)} 个锁等待，等待释放...")
                for lock in locks:
                    logger.warning(f"    等待事务: {lock[0]}, 阻塞事务: {lock[3]}")
                time.sleep(5)
            else:
                logger.info(f"  ✓ 没有发现锁等待")
        except Exception as e:
            logger.warning(f"  无法检查锁状态（可能需要启用innodb监控）: {e}")
        
        # 步骤4: 禁用外键检查（避免外键约束阻止DROP）
        logger.info("\n步骤4: 禁用外键检查...")
        try:
            db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
            db.commit()
            logger.info(f"  ✓ 已禁用外键检查")
        except Exception as e:
            logger.warning(f"  无法禁用外键检查: {e}")
        
        # 步骤5: DROP TABLE（多次重试，带超时）
        logger.info("\n步骤5: 删除表（DROP TABLE，带超时保护）...")
        drop_success = False
        for drop_retry in range(10):  # 增加重试次数
            try:
                logger.info(f"  尝试 {drop_retry+1}/10: 执行DROP TABLE...")
                drop_start = time.time()
                
                # 使用超时设置
                db.execute(text("SET SESSION wait_timeout = 60"))
                db.execute(text("SET SESSION interactive_timeout = 60"))
                db.commit()
                
                # 尝试使用原始连接执行DROP（绕过SQLAlchemy的某些限制）
                # 如果SQLAlchemy执行卡住，尝试使用原始连接
                try:
                    drop_sql = text(f"DROP TABLE IF EXISTS {table_name}")
                    db.execute(drop_sql)
                    db.commit()
                except Exception as sqlalchemy_error:
                    # 如果SQLAlchemy执行失败，尝试使用原始连接
                    logger.warning(f"  SQLAlchemy执行失败，尝试使用原始连接...")
                    raw_conn = db.connection().connection
                    cursor = raw_conn.cursor()
                    try:
                        cursor.execute(f"DROP TABLE IF EXISTS {table_name}")
                        raw_conn.commit()
                        cursor.close()
                    except Exception as raw_error:
                        cursor.close()
                        raise raw_error
                
                drop_elapsed = time.time() - drop_start
                drop_success = True
                logger.info(f"  ✓ 已删除表（尝试 {drop_retry+1}/10，耗时 {drop_elapsed:.2f}秒）")
                break
            except Exception as drop_error:
                drop_elapsed = time.time() - drop_start if 'drop_start' in locals() else 0
                if drop_elapsed > 30:
                    logger.warning(f"  DROP超时（耗时 {drop_elapsed:.2f}秒），可能表仍被锁定")
                else:
                    logger.warning(f"  DROP失败（尝试 {drop_retry+1}/10）: {drop_error}")
                
                if drop_retry < 9:
                    wait_time = min(5 + drop_retry * 2, 15)  # 逐渐增加等待时间
                    logger.info(f"  等待 {wait_time} 秒后重试...")
                    time.sleep(wait_time)
                else:
                    logger.error(f"  ❌ DROP TABLE最终失败（已重试10次）")
                    logger.error(f"  建议：")
                    logger.error(f"    1. 手动在MySQL中执行: DROP TABLE IF EXISTS {table_name}")
                    logger.error(f"    2. 或重启MySQL服务（最彻底但会影响其他连接）")
                    raise
        
        # 步骤6: 重新启用外键检查
        if drop_success:
            try:
                db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
                db.commit()
                logger.info(f"  ✓ 已重新启用外键检查")
            except:
                pass
        
        # 步骤7: 重新创建表
        logger.info("\n步骤7: 重新创建表...")
        if create_table_sql:
            try:
                db.execute(text(create_table_sql))
                db.commit()
                logger.info(f"  ✓ 已使用原始CREATE TABLE语句重建表")
            except Exception as e:
                logger.warning(f"  使用原始CREATE TABLE失败: {e}，尝试SQLAlchemy模型...")
                create_table_sql = None
        
        if not create_table_sql:
            # 使用SQLAlchemy模型重建
            try:
                # 根据表名导入对应的模型
                if table_name == 'p6_activity_code_assignments':
                    from app.p6_sync.models import activity_code_assignment
                    activity_code_assignment.P6ActivityCodeAssignment.__table__.create(bind=engine)
                elif table_name == 'p6_resource_assignments':
                    from app.p6_sync.models import resource_assignment
                    resource_assignment.P6ResourceAssignment.__table__.create(bind=engine)
                elif table_name == 'p6_activities':
                    from app.p6_sync.models import activity
                    activity.P6Activity.__table__.create(bind=engine)
                elif table_name == 'p6_wbs':
                    from app.p6_sync.models import wbs
                    wbs.P6WBS.__table__.create(bind=engine)
                elif table_name == 'p6_activity_codes':
                    from app.p6_sync.models import activity_code
                    activity_code.P6ActivityCode.__table__.create(bind=engine)
                elif table_name == 'p6_resources':
                    from app.p6_sync.models import resource
                    resource.P6Resource.__table__.create(bind=engine)
                elif table_name == 'p6_projects':
                    from app.p6_sync.models import project
                    project.P6Project.__table__.create(bind=engine)
                elif table_name == 'p6_eps':
                    from app.p6_sync.models import eps
                    eps.P6EPS.__table__.create(bind=engine)
                else:
                    raise Exception(f"未知的表名: {table_name}，无法使用SQLAlchemy重建")
                
                logger.info(f"  ✓ 已使用SQLAlchemy模型重建表")
            except Exception as e:
                logger.error(f"  ❌ SQLAlchemy重建失败: {e}")
                raise
        
        logger.info(f"\n{'='*60}")
        logger.info("✅ 表清空完成！")
        logger.info(f"{'='*60}")
        
    except Exception as e:
        logger.error(f"\n❌ 清空表失败: {e}", exc_info=True)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='强制清空指定表（先清理所有锁，然后DROP + CREATE）')
    parser.add_argument('--table', type=str, default='p6_activity_code_assignments', help='要清空的表名')
    args = parser.parse_args()
    
    force_clear_table(args.table)
