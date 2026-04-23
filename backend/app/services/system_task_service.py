import logging
import time
from datetime import datetime, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import SessionLocal
from app.models.system_task import SystemTaskLock
from app.utils.timezone import now as system_now

logger = logging.getLogger(__name__)

class SystemTaskService:
    """
    系统任务管理服务，用于处理并发避让机制。

    避让原则：当以下任一任务锁为活跃时，后台汇总刷新（DataRefreshService）会主动跳过，避免锁冲突。
    - daily_report_upload：日报上传（日报管理导入保存）
    - mdr_sync / activity_summary_sync：MDR/汇总同步
    - mpdb_delete：删除人力日报（单条/批量删除时每次 DELETE 请求持锁）
    - vfactdb_delete：删除完成量（准确）- 单条/批量删除（每次 DELETE 请求持锁）
    - vfactdb_batch_adjust：调整完成量（覆写）- 批量调整/Excel 导入
    - vfactdb_weekly_distribute：新增完成量（分配）- 按周分配/Excel 导入
    - vfactdb_excel_import：新增完成量（准确）- Excel 导入
    """
    
    # 统一超时阈值：30分钟（给长任务留足空间，只要它定期心跳就不会被清理）
    DEFAULT_TIMEOUT_MINUTES = 30
    
    @staticmethod
    def clear_stale_locks(timeout_minutes: int = None):
        """
        清理过时的任务锁。如果一个锁处于活跃状态但超过指定时间未更新，将其强制设为不活跃。
        通常在服务启动时调用。
        """
        if timeout_minutes is None:
            timeout_minutes = SystemTaskService.DEFAULT_TIMEOUT_MINUTES

        db = SessionLocal()
        try:
            now = system_now()
            threshold = now - timedelta(minutes=timeout_minutes)
            
            # 找到那些虽然标记为活跃，但长时间未更新的锁
            result = db.execute(text("""
                UPDATE system_task_locks 
                SET is_active = 0, remarks = CONCAT(COALESCE(remarks, ''), ' [系统超时自动清理]')
                WHERE is_active = 1 AND last_active_at < :threshold
            """), {"threshold": threshold})
            
            if result.rowcount > 0:
                db.commit()
                logger.info(f"成功清理了 {result.rowcount} 个过时的系统任务锁 (超过 {timeout_minutes} 分钟未更新)")
        except Exception as e:
            db.rollback()
            logger.error(f"清理过时系统任务锁失败: {e}")
        finally:
            db.close()

    @staticmethod
    def set_task_lock(task_name: str, is_active: bool, updated_by: Optional[str] = None, remarks: Optional[str] = None, quiet: bool = False):
        """设置任务锁状态。"""
        db = SessionLocal()
        try:
            now = system_now()
            # 使用原生 SQL 原子 upsert
            db.execute(text("""
                INSERT INTO system_task_locks (task_name, is_active, last_active_at, updated_by, remarks)
                VALUES (:task_name, :is_active, :last_active_at, :updated_by, :remarks)
                ON DUPLICATE KEY UPDATE
                    is_active = VALUES(is_active),
                    last_active_at = VALUES(last_active_at),
                    updated_by = VALUES(updated_by),
                    remarks = VALUES(remarks)
            """), {
                "task_name": task_name,
                "is_active": is_active,
                "last_active_at": now,
                "updated_by": updated_by,
                "remarks": remarks,
            })
            db.commit()
            if not quiet:
                logger.info(f"系统任务锁 [{task_name}] 状态更新为: {'运行中' if is_active else '停止'}")
        except Exception as e:
            db.rollback()
            logger.error(f"更新系统任务锁 [{task_name}] 失败: {e}")
        finally:
            db.close()

    @staticmethod
    def is_any_high_priority_task_active(exclude_tasks: Optional[List[str]] = None) -> bool:
        """
        检查是否有任何高优先级任务（用户操作）正在运行
        """
        db = SessionLocal()
        try:
            query = db.query(SystemTaskLock).filter(SystemTaskLock.is_active == True)
            if exclude_tasks:
                query = query.filter(SystemTaskLock.task_name.notin_(exclude_tasks))
            
            active_locks = query.all()
            
            now = system_now()
            really_active = []
            for lock in active_locks:
                # 如果有活跃锁，进一步检查是否过时（使用统一的 30 分钟检测）
                if (now - lock.last_active_at.replace(tzinfo=now.tzinfo)) < timedelta(minutes=SystemTaskService.DEFAULT_TIMEOUT_MINUTES):
                    really_active.append(lock)
            
            return len(really_active) > 0
        except Exception as e:
            logger.error(f"检查系统任务锁失败: {e}")
            return False
        finally:
            db.close()

    @staticmethod
    def is_task_active(task_name: str) -> bool:
        """
        检查指定任务是否正在运行（未超时视为活跃）。
        用于互斥：如后台同步前检查日报上传，或日报上传前检查后台同步。
        """
        db = SessionLocal()
        try:
            lock = db.query(SystemTaskLock).filter(
                SystemTaskLock.task_name == task_name,
                SystemTaskLock.is_active == True
            ).first()
            if not lock:
                return False
            now = system_now()
            # 统一处理时区，确保比较准确
            last = lock.last_active_at.replace(tzinfo=now.tzinfo) if lock.last_active_at.tzinfo is None else lock.last_active_at
            return (now - last) < timedelta(minutes=SystemTaskService.DEFAULT_TIMEOUT_MINUTES)
        except Exception as e:
            logger.error(f"检查任务锁 [{task_name}] 失败: {e}")
            return False
        finally:
            db.close()

    @staticmethod
    def check_and_abort_background_task(db: Session = None):
        """
        供后台任务调用：检查是否有冲突，如果有则报错以触发退出
        """
        # 排除掉自己
        if SystemTaskService.is_any_high_priority_task_active(exclude_tasks=["background_refresh"]):
            logger.warning("检测到高优先级系统任务正在运行，后台任务主动避让。")
            raise InterruptedError("检测到用户操作，后台任务中止")
