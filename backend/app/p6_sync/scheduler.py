"""
P6同步任务调度器
使用APScheduler进行定时任务调度
"""
import logging
import os
import json
import tempfile
import time
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.p6_sync.services.delete_detection_service import DeleteDetectionService
from app.p6_sync.services.raw_data_sync_direct import sync_all_p6_entities
from app.p6_sync.services.task_coordinator import TaskCoordinator

logger = logging.getLogger(__name__)

# 导入 activity_summary 计算函数
try:
    import sys
    from pathlib import Path
    # 获取项目根目录
    current_file = Path(__file__).resolve()
    project_root = current_file.parent.parent.parent.parent
    backend_dir = project_root / "backend"
    
    # 添加路径（如果还没有）
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    
    # 导入 refresh_activity_summary_sql
    import importlib.util
    refresh_activity_summary_sql_path = backend_dir / "scripts" / "refresh_activity_summary_sql.py"
    if refresh_activity_summary_sql_path.exists():
        spec = importlib.util.spec_from_file_location("refresh_activity_summary_sql", refresh_activity_summary_sql_path)
        refresh_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(refresh_module)
        refresh_activity_summary_sql = refresh_module.refresh_activity_summary_sql
        logger.info("✅ refresh_activity_summary_sql 函数导入成功")
    else:
        refresh_activity_summary_sql = None
        logger.warning(f"⚠️ 找不到 refresh_activity_summary_sql.py: {refresh_activity_summary_sql_path}")
except Exception as e:
    refresh_activity_summary_sql = None
    logger.warning(f"⚠️ 导入 refresh_activity_summary_sql 失败: {e}")

# 心跳文件路径（与 run_scheduler.py 使用相同的路径）
_heartbeat_file = Path(tempfile.gettempdir()) / "p6_scheduler_heartbeat.json"

def _update_heartbeat_task_status(task_type: str, running: bool):
    """更新心跳文件中的任务状态（由调度器任务调用）
    
    Args:
        task_type: 任务类型 ('incremental_sync', 'delete_detection', 'reset_sync')
        running: 是否正在运行
    """
    try:
        # 读取现有心跳文件
        existing_data = {
            "running": True,
            "last_update": datetime.now(timezone.utc).isoformat(),
            "pid": os.getpid(),
            "task_status": {
                "delete_detection_running": False,
                "incremental_sync_running": False,
                "reset_sync_running": False,
                "status": {
                    "delete_detection": {"running": False, "started_at": None, "pid": None},
                    "incremental_sync": {"running": False, "started_at": None, "pid": None},
                    "reset_sync": {"running": False, "started_at": None, "pid": None}
                }
            }
        }
        
        if _heartbeat_file.exists():
            try:
                with open(_heartbeat_file, 'r', encoding='utf-8') as f:
                    existing_data = json.load(f)
            except Exception:
                pass
        
        # 更新任务状态
        started_at = datetime.now(timezone.utc).isoformat() if running else existing_data.get('task_status', {}).get('status', {}).get(task_type, {}).get('started_at')
        
        if 'task_status' not in existing_data:
            existing_data['task_status'] = {
                "delete_detection_running": False,
                "incremental_sync_running": False,
                "reset_sync_running": False,
                "status": {}
            }
        
        if 'status' not in existing_data['task_status']:
            existing_data['task_status']['status'] = {}
        
        # 更新特定任务的状态
        if task_type == 'incremental_sync':
            existing_data['task_status']['incremental_sync_running'] = running
            existing_data['task_status']['status']['incremental_sync'] = {
                "running": running,
                "started_at": started_at,
                "pid": os.getpid() if running else None
            }
        elif task_type == 'delete_detection':
            existing_data['task_status']['delete_detection_running'] = running
            existing_data['task_status']['status']['delete_detection'] = {
                "running": running,
                "started_at": started_at,
                "pid": os.getpid() if running else None
            }
        elif task_type == 'reset_sync':
            existing_data['task_status']['reset_sync_running'] = running
            existing_data['task_status']['status']['reset_sync'] = {
                "running": running,
                "started_at": started_at,
                "pid": os.getpid() if running else None
            }
        
        # 更新心跳文件
        existing_data['last_update'] = datetime.now(timezone.utc).isoformat()
        existing_data['pid'] = os.getpid()
        existing_data['running'] = True
        
        with open(_heartbeat_file, 'w', encoding='utf-8') as f:
            json.dump(existing_data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.debug(f"更新心跳文件任务状态失败: {e}")

# 全局调度器实例
_scheduler = None

def get_scheduler() -> BackgroundScheduler:
    """获取调度器实例（单例模式）"""
    global _scheduler
    if _scheduler is None:
        _scheduler = BackgroundScheduler()
    return _scheduler

def start_scheduler(project_ids: list = None):
    """
    启动调度器
    
    Args:
        project_ids: 项目ID列表（可选，如果为None则同步所有项目）
    """
    # 启动前清理过时的僵尸锁（比如由于崩溃导致的未释放锁）
    try:
        from app.services.system_task_service import SystemTaskService
        SystemTaskService.clear_stale_locks(timeout_minutes=15)
    except Exception as e:
        logger.warning(f"启动时清理任务锁失败: {e}")

    scheduler = get_scheduler()
    
    if scheduler.running:
        logger.warning("调度器已在运行中")
        return
    
    coordinator = TaskCoordinator()
    
    # 增量同步任务：每5分钟执行一次，避开整点窗口（:00-:05）
    # 执行时间：:05, :10, :15, :20, :25, :30, :35, :40, :45, :50, :55
    # 使用默认参数捕获 project_ids，确保闭包正确工作
    def incremental_sync_job(project_ids_arg=project_ids):
        """增量同步任务"""
        # 更新心跳文件：任务开始
        _update_heartbeat_task_status('incremental_sync', True)
        
        try:
            # 额外检查：如果在:00-:05之间，跳过（保护窗口）
            current_minute = datetime.now().minute
            if current_minute < 5:
                logger.info(f"[调度器] 当前时间在删除检测窗口内，跳过本次增量同步")
                _update_heartbeat_task_status('incremental_sync', False)
                return
            
            # 检查删除检测是否在运行
            if coordinator.is_delete_detection_running():
                logger.info(f"[调度器] 删除检测运行中，跳过本次增量同步")
                _update_heartbeat_task_status('incremental_sync', False)
                return
            
            logger.info(f"[调度器] 开始执行增量同步任务...")
            if project_ids_arg:
                logger.info(f"[调度器] 同步指定项目: {', '.join(project_ids_arg)}")
            else:
                logger.warning(f"[调度器] ⚠️ 未指定项目ID列表，将同步所有项目")
            result = sync_all_p6_entities(project_ids=project_ids_arg)
            if result and result.get('success'):
                logger.info(f"[调度器] 增量同步完成")
                
                # 同步成功后，自动计算 activity_summary（包括 weight_factor, actual_weight_factor, data_date 等）
                if refresh_activity_summary_sql:
                    try:
                        logger.info(f"[调度器] 开始计算 activity_summary（weight_factor, actual_weight_factor, calculated_mhrs, actual_manhour, data_date）...")
                        calc_start_time = datetime.now()
                        calc_result = refresh_activity_summary_sql(is_clear_mode=False)  # 增量模式
                        calc_duration = (datetime.now() - calc_start_time).total_seconds()
                        
                        if calc_result and calc_result.get('success'):
                            logger.info(f"[调度器] ✅ activity_summary 计算完成（耗时: {calc_duration:.2f}秒）")
                        else:
                            error_msg = calc_result.get('error', '未知错误') if calc_result else '计算结果为空'
                            logger.error(f"[调度器] ❌ activity_summary 计算失败: {error_msg}")
                    except Exception as calc_error:
                        logger.error(f"[调度器] ❌ activity_summary 计算异常: {calc_error}", exc_info=True)
                else:
                    logger.warning(f"[调度器] ⚠️ refresh_activity_summary_sql 函数未导入，跳过计算步骤")
            else:
                error_msg = result.get('error', '未知错误') if result else '同步结果为空'
                logger.error(f"[调度器] 增量同步失败: {error_msg}")
        except Exception as e:
            logger.error(f"[调度器] 增量同步任务异常: {e}", exc_info=True)
        finally:
            # 更新心跳文件：任务完成
            _update_heartbeat_task_status('incremental_sync', False)
    
    # 删除检测任务：每小时整点执行
    # 使用默认参数捕获 project_ids，确保闭包正确工作
    def delete_detection_job(project_ids_arg=project_ids):
        """删除检测任务"""
        # 更新心跳文件：任务开始
        _update_heartbeat_task_status('delete_detection', True)
        
        try:
            logger.info(f"[调度器] 开始执行删除检测任务...")
            if project_ids_arg:
                logger.info(f"[调度器] 检测指定项目: {', '.join(project_ids_arg)}")
            else:
                logger.warning(f"[调度器] ⚠️ 未指定项目ID列表，将检测所有项目")
            service = DeleteDetectionService()
            # 使用多线程并行处理，默认并发数等于项目数（最大5）
            result = service.detect_and_mark_deleted_entities(
                project_ids=project_ids_arg,
                max_workers=None  # None表示自动计算（项目数，最大5）
            )
            if result and result.get('success'):
                logger.info(f"[调度器] 删除检测完成，删除 {result.get('total_deleted', 0)} 条记录")
            else:
                error_msg = result.get('error', '未知错误') if result else '删除检测结果为空'
                logger.error(f"[调度器] 删除检测失败: {error_msg}")
        except Exception as e:
            logger.error(f"[调度器] 删除检测任务异常: {e}", exc_info=True)
        finally:
            # 更新心跳文件：任务完成
            _update_heartbeat_task_status('delete_detection', False)
    
    # 添加增量同步任务
    scheduler.add_job(
        incremental_sync_job,
        trigger=CronTrigger(minute='5,10,15,20,25,30,35,40,45,50,55'),
        id='incremental_sync',
        name='增量同步',
        replace_existing=True
    )
    
    # 添加删除检测任务
    scheduler.add_job(
        delete_detection_job,
        trigger=CronTrigger(minute=0),  # 每小时整点
        id='delete_detection',
        name='删除检测',
        replace_existing=True
    )
    
    # 添加 MDR 自动同步任务：每周四 22:00 执行
    from app.services.mdr_sync_service import MDRSyncService
    scheduler.add_job(
        MDRSyncService.sync_mdr_data,
        trigger=CronTrigger(day_of_week='thu', hour=22, minute=0),
        id='mdr_weekly_sync',
        name='MDR设计数据周同步',
        replace_existing=True
    )
    logger.info("  - MDR同步: 每周四 22:00 执行")

    # 添加焊接数据自动同步任务：每天中午 12:00 执行
    from app.services.welding_sync_service import WeldingSyncService
    from app.services.system_task_service import SystemTaskService
    from app.database import SessionLocal
    from app.models.welding_sync_log import WeldingSyncLog
    from app.utils.timezone import now as system_now
    from datetime import timedelta, datetime
    from apscheduler.triggers.date import DateTrigger

    def welding_sync_job():
        """定时焊接数据同步任务。带自动避让、重试及日志记录逻辑。"""
        logger.info("[调度器] 开始执行每天 12:00 焊接数据同步任务...")
        
        db = SessionLocal()
        sync_log = None
        try:
            # 1. 检查避让逻辑
            if SystemTaskService.is_task_active("daily_report_upload"):
                logger.warning("[调度器] 检测到用户正在上传日报，避让本次焊接同步，将在 5 分钟后重试")
                # 记录一个跳过的日志，方便前端查看
                skip_log = WeldingSyncLog(
                    sync_type='all',
                    status='failed',
                    message='[避让] 检测到用户正在上传日报，本次同步已跳过，5 分钟后将自动重试。',
                    completed_at=system_now()
                )
                db.add(skip_log)
                db.commit()
                
                # 5 分钟后重试
                retry_time = datetime.now() + timedelta(minutes=5)
                scheduler.add_job(
                    welding_sync_job,
                    trigger=DateTrigger(run_date=retry_time),
                    id=f'welding_sync_retry_{int(time.time())}',
                    name='焊接同步重试'
                )
                return

            # 2. 创建同步日志
            sync_log = WeldingSyncLog(
                sync_type='all',
                status='running',
                message='[定时任务] 同步任务已启动'
            )
            db.add(sync_log)
            db.commit()
            db.refresh(sync_log)

            # 3. 执行同步
            service = WeldingSyncService(db=db)
            
            def progress_callback(progress: Optional[int], message: str):
                if sync_log:
                    try:
                        sync_log.message = f"[{progress}%] {message}" if progress is not None else message
                        if progress is not None:
                            sync_log.progress = progress
                        db.flush()
                        db.commit()
                    except Exception as e:
                        logger.debug(f"更新同步进度失败: {e}")

            result = service.sync_pi04_pi05_from_welding_list(
                db=db,
                progress_callback=progress_callback
            )
            
            # 4. 如果同步成功，执行汇总刷新（确保完成量在汇总表生效）
            if result.get("success"):
                logger.info(f"[调度器] 焊接同步成功，开始刷新 PI04/PI05 汇总数据...")
                from app.models.activity_summary import ActivitySummary
                from app.services.activity_sync_service import ActivitySyncService
                
                # 获取所有 PI04/PI05 作业进行汇总刷新
                ids_in_summary = db.query(ActivitySummary.activity_id).filter(
                    ActivitySummary.work_package.in_(['PI04', 'PI05'])
                ).all()
                affected_ids = [r[0] for r in ids_in_summary if r[0]]
                
                if affected_ids:
                    SystemTaskService.set_task_lock("activity_summary_sync", True, updated_by="scheduler_welding")
                    try:
                        ActivitySyncService.batch_sync_activity_summary_from_vcq(db, affected_ids)
                    finally:
                        SystemTaskService.set_task_lock("activity_summary_sync", False)
                
                # 更新最终日志
                sync_log.status = 'success'
                sync_log.message = result.get('message', '同步成功')
            else:
                # 如果是因为内部避让（虽然前面检查过了，但 service 内部也有检查）
                if result.get("skipped"):
                    sync_log.status = 'failed'
                    sync_log.message = f"[避让] {result.get('message')}"
                    # 同样在 5 分钟后重试
                    retry_time = datetime.now() + timedelta(minutes=5)
                    scheduler.add_job(
                        welding_sync_job,
                        trigger=DateTrigger(run_date=retry_time),
                        id=f'welding_sync_retry_{int(time.time())}',
                        name='焊接同步重试'
                    )
                else:
                    sync_log.status = 'failed'
                    sync_log.message = result.get('message', '同步失败')

            # 填充统计字段
            sync_log.deleted_count = result.get('deleted_count', 0)
            sync_log.inserted_count = result.get('inserted_count', 0)
            statistics = result.get('statistics', {})
            if statistics:
                sync_log.welding_list_total = statistics.get('welding_list_total', 0.0)
                sync_log.welding_list_completed = statistics.get('welding_list_completed', 0.0)
                sync_log.vfactdb_matched = statistics.get('vfactdb_matched', 0.0)
            
            sync_log.completed_at = system_now()
            db.commit()
            logger.info(f"[调度器] 焊接数据同步任务结束: {sync_log.status}")

        except Exception as e:
            logger.error(f"[调度器] 焊接数据同步异常: {e}", exc_info=True)
            if sync_log:
                try:
                    sync_log.status = 'failed'
                    sync_log.message = f"异常失败: {str(e)}"
                    sync_log.completed_at = system_now()
                    db.commit()
                except:
                    pass
        finally:
            db.close()

    scheduler.add_job(
        welding_sync_job,
        trigger=CronTrigger(hour=12, minute=0),
        id='welding_sync',
        name='每天焊接数据同步',
        replace_existing=True
    )
    logger.info("  - 焊接同步: 每天 12:00 执行")

    # S 曲线缓存全量刷新：每天 12:30、16:30 各执行一次（耗时约半小时，与其它任务无表冲突，独立线程执行）
    from app.services.dashboard_service import DashboardService

    def s_curve_cache_refresh_job():
        """定时 S 曲线缓存全量刷新。仅读写 dashboard_s_curve_cache / activity_summary 等，与增量同步、删除检测、焊接等无表冲突。"""
        logger.info("[调度器] 开始执行 S 曲线缓存全量刷新（约半小时）...")
        db = SessionLocal()
        try:
            total = DashboardService(db).refresh_s_curve_cache_all(log_progress=True)
            logger.info(f"[调度器] S 曲线缓存全量刷新完成，写入 {total} 条")
        except Exception as e:
            logger.error(f"[调度器] S 曲线缓存刷新异常: {e}", exc_info=True)
        finally:
            db.close()

    scheduler.add_job(
        s_curve_cache_refresh_job,
        trigger=CronTrigger(hour=12, minute=30),
        id='s_curve_cache_refresh_1230',
        name='S曲线缓存刷新_12:30',
        replace_existing=True
    )
    scheduler.add_job(
        s_curve_cache_refresh_job,
        trigger=CronTrigger(hour=16, minute=30),
        id='s_curve_cache_refresh_1630',
        name='S曲线缓存刷新_16:30',
        replace_existing=True
    )
    logger.info("  - S曲线缓存刷新: 每天 12:30、16:30 各执行一次（约半小时/次）")

    # 工效预聚合缓存全量刷新：每天凌晨 2:00 执行（与 S 曲线无表冲突）
    from app.services.productivity_service import refresh_productivity_cache_all

    def productivity_cache_refresh_job():
        """定时工效缓存全量刷新。仅读写 productivity_cache 表，与其它任务无表冲突。"""
        logger.info("[调度器] 开始执行工效预聚合缓存全量刷新...")
        db = SessionLocal()
        try:
            total = refresh_productivity_cache_all(db, log_progress=True)
            logger.info(f"[调度器] 工效缓存全量刷新完成，写入 {total} 行")
        except Exception as e:
            logger.error(f"[调度器] 工效缓存刷新异常: {e}", exc_info=True)
        finally:
            db.close()

    scheduler.add_job(
        productivity_cache_refresh_job,
        trigger=CronTrigger(hour=4, minute=0),
        id='productivity_cache_refresh',
        name='工效缓存每日刷新',
        replace_existing=True
    )

    # 启动调度器
    scheduler.start()
    logger.info("✅ 调度器已启动")
    logger.info("  - 增量同步: 每5分钟执行（:05, :10, :15, :20, :25, :30, :35, :40, :45, :50, :55）")
    logger.info("  - 删除检测: 每小时整点执行（:00）")
    logger.info("  - S曲线缓存刷新: 每天 12:30、16:30 各执行一次（约半小时/次）")
    logger.info("  - 工效缓存刷新: 每天 02:00 执行")
    if refresh_activity_summary_sql:
        logger.info("  - 自动计算: 同步成功后自动计算 activity_summary（weight_factor, actual_weight_factor, calculated_mhrs, actual_manhour）")
    else:
        logger.warning("  - ⚠️ 自动计算: refresh_activity_summary_sql 未导入，不会自动计算权重字段")

def stop_scheduler():
    """停止调度器"""
    scheduler = get_scheduler()
    if scheduler.running:
        scheduler.shutdown()
        logger.info("调度器已停止")
    else:
        logger.warning("调度器未运行")

def _check_scheduler_by_heartbeat():
    """通过心跳文件检查 run_scheduler.py 是否在运行，并返回任务状态信息
    
    心跳文件由 run_scheduler.py 定期更新（每30秒）
    如果心跳文件存在且最近2分钟内更新过，则认为 run_scheduler.py 在运行
    
    Returns:
        (is_running, task_status): (是否运行, 任务状态信息)
    """
    default_task_status = {
        "delete_detection_running": False,
        "incremental_sync_running": False,
        "reset_sync_running": False,
        "status": {}
    }
    
    try:
        import tempfile
        from pathlib import Path
        from datetime import datetime, timezone, timedelta
        
        heartbeat_file = Path(tempfile.gettempdir()) / "p6_scheduler_heartbeat.json"
        
        logger.info(f"[心跳检测] 检查心跳文件: {heartbeat_file}")
        
        if not heartbeat_file.exists():
            logger.warning(f"[心跳检测] 心跳文件不存在: {heartbeat_file}")
            return False, default_task_status
        
        # 检查文件修改时间（考虑时区）
        try:
            mtime = heartbeat_file.stat().st_mtime
            # 将文件修改时间转换为 UTC 时间
            file_time = datetime.fromtimestamp(mtime, tz=timezone.utc)
            now = datetime.now(timezone.utc)
            
            # 如果文件在最近2分钟内更新过，认为调度器在运行
            time_diff = now - file_time
            logger.info(f"[心跳检测] 文件修改时间: {file_time}, 当前时间: {now}, 时间差: {time_diff.total_seconds():.1f}秒")
            if time_diff > timedelta(minutes=2):
                logger.warning(f"[心跳检测] 心跳文件过期: {time_diff.total_seconds():.1f}秒前更新（超过2分钟阈值）")
                return False, default_task_status
        except Exception as e:
            logger.debug(f"检查心跳文件修改时间失败: {e}")
            # 如果无法检查修改时间，尝试读取文件内容
            pass
        
        # 读取心跳文件内容，验证 running 标志，并提取任务状态
        try:
            import json
            with open(heartbeat_file, 'r', encoding='utf-8') as f:
                heartbeat_data = json.load(f)
                if not heartbeat_data.get('running', False):
                    logger.warning(f"[心跳检测] 心跳文件显示调度器未运行: running={heartbeat_data.get('running')}")
                    return False, default_task_status
                
                # 检查 last_update 时间戳（如果存在）
                last_update_str = heartbeat_data.get('last_update')
                if last_update_str:
                    try:
                        if isinstance(last_update_str, str):
                            last_update = datetime.fromisoformat(last_update_str.replace('Z', '+00:00'))
                            if last_update.tzinfo is None:
                                last_update = last_update.replace(tzinfo=timezone.utc)
                            now = datetime.now(timezone.utc)
                            time_diff = now - last_update
                            if time_diff > timedelta(minutes=2):
                                logger.warning(f"[心跳检测] 心跳文件时间戳过期: {time_diff.total_seconds():.1f}秒前更新（超过2分钟阈值）")
                                return False, default_task_status
                    except Exception as e:
                        logger.debug(f"解析心跳文件时间戳失败: {e}")
                
                # 从心跳文件中提取任务状态信息
                task_status = heartbeat_data.get('task_status', default_task_status)
                if not isinstance(task_status, dict):
                    task_status = default_task_status
                else:
                    # 确保 task_status 包含所有必需的字段
                    if 'status' not in task_status:
                        task_status['status'] = {}
                    if 'delete_detection_running' not in task_status:
                        task_status['delete_detection_running'] = False
                    if 'incremental_sync_running' not in task_status:
                        task_status['incremental_sync_running'] = False
                    if 'reset_sync_running' not in task_status:
                        task_status['reset_sync_running'] = False
                
                file_time_str = file_time.isoformat() if 'file_time' in locals() else 'N/A'
                logger.info(f"✅ 检测到调度器心跳文件，最后更新: {file_time_str}, PID: {heartbeat_data.get('pid')}")
                logger.info(f"[心跳文件] 任务状态: incremental_sync_running={task_status.get('incremental_sync_running')}, delete_detection_running={task_status.get('delete_detection_running')}, status_keys={list(task_status.get('status', {}).keys())}")
                return True, task_status
        except Exception as e:
            logger.debug(f"读取心跳文件失败: {e}")
            return False, default_task_status
        
    except Exception as e:
        logger.debug(f"心跳检测异常: {e}")
        return False, default_task_status


# 已移除：不再使用进程检测，只依赖心跳文件
def _check_run_scheduler_process() -> bool:
    """检查 run_scheduler.py 进程是否在运行
    
    由于 run_scheduler.py 在独立终端运行，需要准确检测其进程
    """
    try:
        import psutil
        import os
        from pathlib import Path
        
        current_pid = os.getpid()
        script_name = "run_scheduler.py"
        
        # 获取脚本的绝对路径用于更精确的匹配
        try:
            # 尝试找到 run_scheduler.py 的路径
            backend_dir = Path(__file__).parent.parent.parent
            script_path = backend_dir / script_name
            script_abs_path = str(script_path.resolve())
        except:
            script_abs_path = None
        
        # 添加超时保护，避免遍历所有进程时阻塞太久
        import signal
        
        def timeout_handler(signum, frame):
            raise TimeoutError("进程检测超时")
        
        # 设置超时（2秒）
        try:
            # Windows 不支持 signal.alarm，使用其他方式
            import threading
            timeout_occurred = threading.Event()
            
            def check_processes():
                try:
                    # 限制最多检查100个进程，避免遍历所有进程太慢
                    checked_count = 0
                    max_checks = 100
                    
                    for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'exe']):
                        if timeout_occurred.is_set() or checked_count >= max_checks:
                            return False
                        
                        checked_count += 1
                        
                        try:
                            # 跳过当前进程
                            if proc.info['pid'] == current_pid:
                                continue
                            
                            cmdline = proc.info.get('cmdline', [])
                            if not cmdline:
                                continue
                            
                            # 方法1: 检查命令行参数中是否包含 run_scheduler.py
                            cmdline_lower = ' '.join(cmdline).lower()
                            if script_name.lower() in cmdline_lower:
                                # 进一步验证：确保是 Python 进程
                                exe = proc.info.get('exe', '')
                                if 'python' in exe.lower() or 'python' in cmdline_lower:
                                    logger.debug(f"找到 run_scheduler.py 进程: PID={proc.info['pid']}")
                                    return True
                            
                            # 方法2: 如果知道脚本路径，检查是否匹配
                            if script_abs_path:
                                for arg in cmdline:
                                    if script_abs_path in arg or script_name in arg:
                                        exe = proc.info.get('exe', '')
                                        if 'python' in exe.lower() or 'python' in cmdline_lower:
                                            logger.debug(f"找到 run_scheduler.py 进程（通过路径）: PID={proc.info['pid']}")
                                            return True
                                            
                        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                            continue
                        except Exception:
                            continue
                    return False
                except Exception:
                    return False
            
            result = [False]
            def run_check():
                result[0] = check_processes()
            
            thread = threading.Thread(target=run_check, daemon=True)
            thread.start()
            thread.join(timeout=0.5)  # 缩短到0.5秒，避免阻塞太久
            
            if thread.is_alive():
                timeout_occurred.set()
                logger.debug("进程检测超时，跳过进程检测")
                return False
            
            return result[0]
        except Exception as e:
            logger.debug(f"使用 psutil 检测进程时出错: {e}")
            return False
    except ImportError:
        # 如果 psutil 未安装，尝试使用其他方法
        try:
            import subprocess
            import platform
            
            if platform.system() == 'Windows':
                # Windows: 使用 wmic 或 tasklist
                try:
                    # 方法1: 使用 wmic（更准确），大幅缩短超时时间
                    result = subprocess.run(
                        ['wmic', 'process', 'where', f'commandline like "%{script_name}%"', 'get', 'processid,commandline'],
                        capture_output=True,
                        text=True,
                        encoding='utf-8',
                        errors='replace',
                        timeout=0.3  # 缩短到0.3秒
                    )
                    stdout = result.stdout or ""
                    if script_name in stdout and 'python' in stdout.lower():
                        return True
                except subprocess.TimeoutExpired:
                    logger.debug("wmic 检测超时")
                except:
                    pass
                
                # 方法2: 使用 tasklist（备用），大幅缩短超时时间
                try:
                    result = subprocess.run(
                        ['tasklist', '/FI', 'IMAGENAME eq python.exe', '/FO', 'CSV', '/V'],
                        capture_output=True,
                        text=True,
                        encoding='utf-8',
                        errors='replace',
                        timeout=0.3  # 缩短到0.3秒
                    )
                    if script_name in (result.stdout or ""):
                        return True
                except subprocess.TimeoutExpired:
                    logger.debug("tasklist 检测超时")
                except:
                    pass
            else:
                # Linux/Mac: 使用 ps 和 grep，大幅缩短超时时间
                try:
                    result = subprocess.run(
                        ['ps', 'aux'],
                        capture_output=True,
                        text=True,
                        encoding='utf-8',
                        errors='replace',
                        timeout=0.3  # 缩短到0.3秒
                    )
                    stdout = result.stdout or ""
                    if script_name in stdout:
                        # 进一步验证是 Python 进程
                        lines = stdout.split('\n')
                        for line in lines:
                            if script_name in line and ('python' in line.lower() or 'python3' in line.lower()):
                                return True
                except subprocess.TimeoutExpired:
                    logger.debug("ps 检测超时")
                except:
                    pass
        except Exception as e:
            logger.debug(f"使用 subprocess 检测进程失败: {e}")
        return False
    except Exception as e:
        logger.warning(f"检查 run_scheduler.py 进程失败: {e}")
        return False


# 已移除：不再使用活动检测，只依赖心跳文件
def _check_scheduler_by_recent_activity() -> bool:
    """通过检查最近的任务活动来判断调度器是否在运行
    
    如果最近（比如10分钟内）有任务执行记录，则认为调度器在运行
    """
    try:
        from app.p6_sync.services.task_coordinator import TaskCoordinator
        from datetime import datetime, timedelta, timezone
        
        coordinator = TaskCoordinator()
        status = coordinator.get_status()
        
        # 检查是否有任务正在运行
        if (status.get('incremental_sync_running') or 
            status.get('delete_detection_running') or 
            status.get('reset_sync_running')):
            return True
        
        # 检查最近是否有任务执行（通过检查任务状态中的时间戳）
        # 如果最近10分钟内有任务活动，认为调度器在运行
        now = datetime.now(timezone.utc)
        recent_threshold = timedelta(minutes=10)
        
        # 从状态文件中检查最近的任务执行时间
        status_detail = status.get('status', {})
        
        # 检查增量同步的最后执行时间
        incremental_sync_info = status_detail.get('incremental_sync', {})
        started_at_str = incremental_sync_info.get('started_at')
        if started_at_str:
            try:
                if isinstance(started_at_str, str):
                    started_at = datetime.fromisoformat(started_at_str.replace('Z', '+00:00'))
                    if started_at.tzinfo is None:
                        started_at = started_at.replace(tzinfo=timezone.utc)
                    if (now - started_at) < recent_threshold:
                        logger.debug(f"检测到最近10分钟内有增量同步活动: {started_at}")
                        return True
            except Exception as e:
                logger.debug(f"解析增量同步时间失败: {e}")
        
        # 检查删除检测的最后执行时间
        delete_detection_info = status_detail.get('delete_detection', {})
        started_at_str = delete_detection_info.get('started_at')
        if started_at_str:
            try:
                if isinstance(started_at_str, str):
                    started_at = datetime.fromisoformat(started_at_str.replace('Z', '+00:00'))
                    if started_at.tzinfo is None:
                        started_at = started_at.replace(tzinfo=timezone.utc)
                    if (now - started_at) < recent_threshold:
                        logger.debug(f"检测到最近10分钟内有删除检测活动: {started_at}")
                        return True
            except Exception as e:
                logger.debug(f"解析删除检测时间失败: {e}")
        
        return False
    except Exception as e:
        logger.debug(f"通过活动检查调度器状态失败: {e}")
        return False


def get_scheduler_status() -> dict:
    """获取调度器状态
    
    优化：优先使用心跳文件检测，如果成功则立即返回，避免阻塞
    """
    import time
    start_time = time.time()
    MAX_TOTAL_TIME = 2.0  # 总超时时间：最多2秒
    
    try:
        scheduler = get_scheduler()
        
        # 优先使用心跳文件检测（最可靠且最快），并获取任务状态信息
        run_scheduler_running, task_status_from_heartbeat = _check_scheduler_by_heartbeat()
        heartbeat_time = time.time() - start_time
        logger.info(f"[调度器状态检测] 心跳检测结果: {run_scheduler_running}, 耗时: {heartbeat_time:.3f}秒")
        
        # 快速获取 jobs（不阻塞）
        # 即使当前进程的调度器未运行，如果 run_scheduler.py 在运行，也尝试获取 jobs
        jobs = []
        try:
            # 如果 run_scheduler.py 在运行，或者当前进程的调度器在运行，都尝试获取 jobs
            if run_scheduler_running or (scheduler and scheduler.running):
                if scheduler:
                    for job in scheduler.get_jobs():
                        jobs.append({
                            "id": job.id,
                            "name": job.name,
                            "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None
                        })
        except Exception as e:
            logger.debug(f"获取调度器任务列表失败: {e}")
            jobs = []
        
        # 快速获取任务状态（不阻塞，如果超时就使用默认值）
        task_status = {
            "delete_detection_running": False,
            "incremental_sync_running": False,
            "reset_sync_running": False,
            "status": {}
        }
        
        # 只依赖心跳文件检测，不再进行任何其他检测（避免阻塞）
        if run_scheduler_running:
            # 心跳检测成功，直接使用心跳文件中的任务状态（已包含在心跳文件中）
            task_status = task_status_from_heartbeat
            
            # 如果心跳文件中有 jobs 信息，使用它（因为调度器在独立进程运行，当前进程可能无法获取jobs）
            try:
                import tempfile
                heartbeat_file = Path(tempfile.gettempdir()) / "p6_scheduler_heartbeat.json"
                if heartbeat_file.exists():
                    import json
                    with open(heartbeat_file, 'r', encoding='utf-8') as f:
                        heartbeat_data = json.load(f)
                        if 'jobs' in heartbeat_data and heartbeat_data['jobs']:
                            jobs = heartbeat_data['jobs']
                            logger.debug(f"从心跳文件获取到 {len(jobs)} 个jobs")
            except Exception as e:
                logger.debug(f"从心跳文件读取jobs失败: {e}")
            
            logger.info(f"[调度器状态检测] 心跳检测成功，使用心跳文件中的任务状态，总耗时: {time.time() - start_time:.3f}秒")
        else:
            # 心跳检测失败，直接返回默认状态，不再进行任何其他检测（避免阻塞）
            logger.info(f"[调度器状态检测] 心跳检测失败，返回默认状态，总耗时: {time.time() - start_time:.3f}秒")
            # task_status 保持为默认值（已在上面定义）
        
        logger.info(f"[调度器状态检测] 最终判断: run_scheduler_running={run_scheduler_running}")
        
        # 如果 run_scheduler.py 在运行，则认为调度器在运行
        # 或者当前进程中的调度器在运行
        # 或者有任务正在运行（说明调度器肯定在运行）
        is_running = (run_scheduler_running or 
                     (scheduler.running if scheduler else False) or
                     task_status.get('incremental_sync_running', False) or
                     task_status.get('delete_detection_running', False))
        
        result = {
            "running": is_running,
            "run_scheduler_running": run_scheduler_running,  # 单独标记 run_scheduler.py 是否运行
            "jobs": jobs,
            "task_status": task_status
        }
        
        total_time = time.time() - start_time
        logger.info(f"[调度器状态返回] running={is_running}, run_scheduler_running={run_scheduler_running}, jobs_count={len(jobs)}, has_error={('error' in result)}, 总耗时: {total_time:.3f}秒")
        return result
    except Exception as e:
        logger.error(f"获取调度器状态异常: {e}", exc_info=True)
        # 返回默认状态，避免前端一直加载
        return {
            "running": False,
            "run_scheduler_running": False,
            "jobs": [],
            "task_status": {
                "delete_detection_running": False,
                "incremental_sync_running": False,
                "status": {}
            },
            "error": str(e)
        }

