"""
P6原始数据直接同步服务（跳过JSON存储，直接写入正式表）
支持：
1. 多线程并行读取多个实体类型
2. 流式写入：读取到一定数量就直接写入到对应的正式表
3. 在内存中处理JSON，直接转换为数据库记录
"""
import sys
import os
from pathlib import Path

# 如果作为脚本直接运行，先设置路径
_IS_MAIN_SCRIPT = False
if __name__ == "__main__":
    _IS_MAIN_SCRIPT = True
    print("脚本启动中，正在设置路径...", flush=True, file=sys.stderr)
    
    # 获取项目根目录（从当前文件向上5级：services -> p6_sync -> app -> backend -> 项目根目录）
    current_file = Path(__file__).resolve()
    project_root = current_file.parent.parent.parent.parent.parent
    backend_dir = project_root / "backend"
    
    print(f"项目根目录: {project_root}", flush=True, file=sys.stderr)
    print(f"Backend目录: {backend_dir}", flush=True, file=sys.stderr)
    
    # 添加路径
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    
    print("路径设置完成，正在加载环境变量...", flush=True, file=sys.stderr)
    
    # 确保环境变量已加载（延迟导入，避免循环依赖）
    try:
        from app.database import load_env_with_fallback
        if not os.getenv('DATABASE_URL'):
            load_env_with_fallback()
        print("环境变量加载完成", flush=True, file=sys.stderr)
    except ImportError as e:
        print(f"警告：无法加载环境变量: {e}", flush=True, file=sys.stderr)
        pass  # 如果导入失败，继续执行（可能是路径问题，会在后续导入时再次尝试）
    
    print("开始导入模块...", flush=True, file=sys.stderr)

from sqlalchemy.orm import Session
from typing import Dict, List, Optional
from datetime import datetime, timezone, timedelta
from app.utils.timezone import utc_to_system
import logging
import json
import uuid
import threading
from queue import Queue
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

# 延迟导入 app 模块（在路径设置后）
try:
    if _IS_MAIN_SCRIPT:
        print("正在导入 app.p6_sync.utils...", flush=True, file=sys.stderr)
    from app.p6_sync.utils import safe_get
    if _IS_MAIN_SCRIPT:
        print("app.p6_sync.utils 导入成功", flush=True, file=sys.stderr)
except ImportError as e:
    if _IS_MAIN_SCRIPT:
        print(f"错误：无法导入 app.p6_sync.utils: {e}", flush=True, file=sys.stderr)
        print(f"当前 sys.path: {sys.path[:3]}", flush=True, file=sys.stderr)
        sys.exit(1)
    raise

logger = logging.getLogger(__name__)

# 确保日志立即输出（不缓冲）
def log_info(message):
    """立即输出的日志函数"""
    logger.info(message)
    sys.stdout.flush()

def log_error(message):
    """立即输出的错误日志函数"""
    logger.error(message)
    sys.stderr.flush()


class RawDataSyncServiceDirect:
    """P6原始数据直接同步服务（直接写入正式表，跳过JSON存储）"""
    
    # 支持的所有实体类型
    SUPPORTED_ENTITIES = [
        'eps',
        'project',
        'wbs',
        'activity',
        'activity_code',
        'activity_code_assignment',
        'resource',
        'resource_assignment'
    ]
    
    # 类级别的线程锁，用于保护 pandas to_csv 操作（Python 3.14 多线程执行缓存问题修复）
    _csv_write_lock = threading.Lock()
    
    def __init__(self, p6_service=None):
        """
        初始化同步服务
        
        Args:
            p6_service: P6同步服务实例，如果为None则创建新实例
        """
        if p6_service is None:
            from app.services.p6_sync_service import P6SyncService
            p6_service = P6SyncService()
        self.p6_service = p6_service
        self.write_batch_size = 50000  # 默认批次大小（优化：从2万提升到5万）
    
    def _get_last_sync_time(
        self,
        db: Session,
        entity_type: str,
        project_id: Optional[str] = None
    ) -> Optional[datetime]:
        """
        获取上次同步时间
        
        Args:
            db: 数据库会话
            entity_type: 实体类型
            project_id: 项目ID（可选，对于项目级别实体需要）
            
        Returns:
            上次同步时间（datetime对象），如果没有记录则返回None
        """
        try:
            from app.p6_sync.models.sync_log import P6SyncLog, SyncStatus, SyncEntityType
            
            # 将实体类型转换为SyncEntityType枚举
            entity_type_map = {
                'eps': SyncEntityType.EPS,
                'project': SyncEntityType.PROJECT,
                'wbs': SyncEntityType.WBS,
                'activity': SyncEntityType.ACTIVITY,
                'activity_code': SyncEntityType.ACTIVITY_CODE,
                'activity_code_assignment': SyncEntityType.ACTIVITY_CODE_ASSIGNMENT,
                'resource': SyncEntityType.RESOURCE,
                'resource_assignment': SyncEntityType.RESOURCE_ASSIGNMENT,
            }
            
            sync_entity_type = entity_type_map.get(entity_type.lower())
            if not sync_entity_type:
                return None
            
            # 查询最近一次成功同步的记录
            query = db.query(P6SyncLog).filter(
                P6SyncLog.sync_type == sync_entity_type,
                P6SyncLog.sync_status == SyncStatus.COMPLETED,
                P6SyncLog.completed_at.isnot(None)
            )
            
            # 对于项目级别实体，添加项目ID过滤
            project_level_entities = {'wbs', 'activity', 'activity_code_assignment', 'resource_assignment'}
            if entity_type.lower() in project_level_entities and project_id:
                query = query.filter(P6SyncLog.project_id == project_id)
            
            # 按完成时间降序排列，取第一条
            last_sync_log = query.order_by(P6SyncLog.completed_at.desc()).first()
            
            if last_sync_log:
                # 优先使用数据库中存储的p6_last_update_date最大值（从对应表中查询）
                # 这样可以确保使用P6系统时间，而不是数据库时间
                try:
                    from sqlalchemy import text, func
                    table_info = self._get_table_info(entity_type)
                    if table_info:
                        table_name = table_info['table_name']
                        # 查询该表中p6_last_update_date的最大值
                        # 对于项目级别实体，添加项目过滤
                        project_level_entities = {'wbs', 'activity', 'activity_code_assignment', 'resource_assignment'}
                        if entity_type.lower() in project_level_entities and project_id:
                            max_date_query = text(f"""
                                SELECT MAX(p6_last_update_date) as max_date
                                FROM {table_name}
                                WHERE is_active = 1 AND project_id = :project_id
                            """)
                            result = db.execute(max_date_query, {'project_id': project_id}).first()
                        else:
                            max_date_query = text(f"""
                                SELECT MAX(p6_last_update_date) as max_date
                                FROM {table_name}
                                WHERE is_active = 1
                            """)
                            result = db.execute(max_date_query).first()
                        
                        if result and result.max_date:
                            log_info(f"使用数据库中{entity_type}的p6_last_update_date最大值: {result.max_date.strftime('%Y-%m-%d %H:%M:%S')}")
                            return result.max_date
                except Exception as e:
                    log_error(f"查询{entity_type}的p6_last_update_date最大值失败: {e}")
                
                # 如果没有p6_last_update_date，回退到使用completed_at（数据库时间）
                if last_sync_log.completed_at:
                    log_info(f"使用数据库completed_at时间: {last_sync_log.completed_at.strftime('%Y-%m-%d %H:%M:%S')}")
                    return last_sync_log.completed_at
            
            return None
        except Exception as e:
            log_error(f"获取上次同步时间失败: {e}")
            return None
    
    def _build_incremental_filter(
        self,
        entity_type: str,
        project_object_id: Optional[int],
        last_sync_time: Optional[datetime]
    ) -> Optional[str]:
        """
        构建增量同步的Filter字符串
        
        Args:
            entity_type: 实体类型
            project_object_id: 项目ObjectId（可选）
            last_sync_time: 上次同步时间（可选）
            
        Returns:
            Filter字符串，如果没有过滤条件则返回None
        """
        # 全局实体（不需要ProjectObjectId过滤，且可能不支持LastUpdateDate过滤）
        global_entities = {'eps', 'project', 'activity_code', 'resource'}
        is_global_entity = entity_type.lower() in global_entities
        
        # 对于全局实体，暂时不使用LastUpdateDate过滤（因为可能不支持或导致错误）
        # 这些实体通常数据量较小，全量读取也可以接受
        if is_global_entity:
            # 全局实体不使用Filter（避免SQL错误）
            return None
        
        if not last_sync_time:
            # 首次同步，只使用项目过滤（如果有）
            if project_object_id:
                return f"ProjectObjectId :eq: {project_object_id}"
            return None
        
        # 格式化时间为P6 API要求的格式（ISO格式：YYYY-MM-DDTHH:MM:SS）
        # 测试发现：P6 API要求使用ISO格式（带T），而不是空格分隔的格式
        # 正确格式: '2020-01-01T00:00:00'
        # 错误格式: '2020-01-01 00:00:00' (会导致ORA-01861错误)
        time_str = last_sync_time.strftime("%Y-%m-%dT%H:%M:%S")
        
        # 构建Filter：LastUpdateDate > 上次同步时间
        filter_parts = [f"LastUpdateDate:gt:'{time_str}'"]
        
        # 对于项目级别实体，添加项目过滤
        if project_object_id:
            filter_parts.insert(0, f"ProjectObjectId :eq: {project_object_id}")
        
        # 使用 :and: 连接多个条件（如果只有一个条件，直接返回）
        if len(filter_parts) == 1:
            return filter_parts[0]
        return " :and: ".join(filter_parts)
    
    def sync_all_entities(
        self,
        project_id: Optional[str] = None,
        project_object_id: Optional[int] = None,
        fields_map: Optional[Dict[str, List[str]]] = None,
        db: Optional[Session] = None
    ) -> Dict:
        """
        同步所有支持的实体类型
        
        Args:
            project_id: 项目ID（可选，某些实体如EPS不需要）
            project_object_id: 项目ObjectId（可选）
            fields_map: 每个实体类型对应的字段列表（可选）
            db: 数据库会话
        
        Returns:
            同步结果字典
        """
        return self.sync_multiple_entities_direct(
            entity_types=self.SUPPORTED_ENTITIES,
            project_id=project_id,
            project_object_id=project_object_id,
            fields_map=fields_map,
            db=db
        )
    
    def sync_single_entity(
        self,
        entity_type: str,
        project_id: Optional[str] = None,
        project_object_id: Optional[int] = None,
        fields: Optional[List[str]] = None,
        db: Optional[Session] = None
    ) -> Dict:
        """
        同步单个实体类型
        
        Args:
            entity_type: 实体类型（如 'activity', 'activity_code_assignment'）
            project_id: 项目ID（可选）
            project_object_id: 项目ObjectId（可选）
            fields: 字段列表（可选）
            db: 数据库会话
        
        Returns:
            同步结果字典
        """
        if entity_type not in self.SUPPORTED_ENTITIES:
            return {
                "success": False,
                "error": f"不支持的实体类型: {entity_type}。支持的实体: {', '.join(self.SUPPORTED_ENTITIES)}"
            }
        
        fields_map = {entity_type: fields} if fields else None
        
        result = self.sync_multiple_entities_direct(
            entity_types=[entity_type],
            project_id=project_id,
            project_object_id=project_object_id,
            fields_map=fields_map,
            db=db
        )
        
        # 简化返回结果（单实体）
        if result.get('success'):
            entity_result = result.get('entity_results', {}).get(entity_type, {})
            entity_stats = result.get('entity_write_stats', {}).get(entity_type, {})
            return {
                "success": entity_result.get('success', False),
                "count": entity_result.get('count', 0),
                "written_count": entity_stats.get('total_written', 0),
                "duration": result.get('total_duration', 0),
                "error": entity_result.get('error')
            }
        else:
            return result
    
    def sync_multiple_entities_direct(
        self,
        entity_types: List[str],
        project_id: Optional[str] = None,
        project_object_id: Optional[int] = None,
        fields_map: Optional[Dict[str, List[str]]] = None,
        db: Optional[Session] = None
    ) -> Dict:
        """
        并行同步多个实体类型，直接写入正式表
        
        Args:
            entity_types: 实体类型列表
            project_id: 项目ID
            project_object_id: 项目ObjectId
            fields_map: 每个实体类型对应的字段列表（可选）
            db: 数据库会话
        
        Returns:
            同步结果字典
        """
        if not db:
            from app.database import SessionLocal
            db = SessionLocal()
            should_close = True
        else:
            should_close = False
        
        try:
            if not self.p6_service.app:
                return {
                    "success": False,
                    "error": "P6连接未初始化"
                }
            
            # 添加项目标识到日志前缀
            log_prefix = f"[项目 {project_id}]" if project_id else "[全局]"
            
            log_info(f"{log_prefix} 开始并行同步多个实体类型（直接写入正式表）: {', '.join(entity_types)}")
            
            # 选择项目
            if project_id:
                self.p6_service.app.select_project(projectId=project_id)
                project_object_id = self.p6_service.app.eppmSession.selectedProjectObjectId
                log_info(f"{log_prefix} 已选择项目: {project_id} (ObjectId: {project_object_id})")
            
            # 统计策略：清空重建模式下跳过预查询，直接根据API数据计算
            # 检测是否是清空重建模式（从主程序传入，或通过命令行参数判断）
            import sys
            is_clear_mode = '--clear' in sys.argv
            
            # 增量同步：获取每个实体类型的上次同步时间并构建Filter
            entity_filters = {}
            if not is_clear_mode:
                log_info(f"{log_prefix} 增量同步模式：获取上次同步时间...")
                for entity_type in entity_types:
                    last_sync_time = self._get_last_sync_time(db, entity_type, project_id)
                    if last_sync_time:
                        filter_str = self._build_incremental_filter(entity_type, project_object_id, last_sync_time)
                        entity_filters[entity_type] = filter_str
                        log_info(f"{log_prefix} {entity_type}: 上次同步时间 {last_sync_time.strftime('%Y-%m-%d %H:%M:%S')}，使用Filter: {filter_str}")
                    else:
                        entity_filters[entity_type] = None
                        log_info(f"{log_prefix} {entity_type}: 首次同步（无上次同步时间）")
            else:
                log_info(f"{log_prefix} 清空重建模式：不使用增量同步Filter")
                for entity_type in entity_types:
                    entity_filters[entity_type] = None
            
            db_existing_object_ids = {}
            p6_all_object_ids = {}  # 从P6 API获取的全量object_id列表（用于删除检测）
            p6_all_composite_keys = {}  # 从P6 API获取的全量组合键列表（用于activity_code_assignment删除检测）
            db_existing_composite_keys = {}  # 数据库中的组合键集合（用于activity_code_assignment删除检测）
            
            for entity_type in entity_types:
                db_existing_object_ids[entity_type] = set()
                p6_all_object_ids[entity_type] = set()
                if entity_type.lower() == 'activity_code_assignment':
                    p6_all_composite_keys[entity_type] = set()
                    db_existing_composite_keys[entity_type] = set()
            
            # 检查删除检测是否在运行，如果在运行则跳过本次增量同步
            from app.p6_sync.services.task_coordinator import TaskCoordinator
            coordinator = TaskCoordinator()
            if coordinator.is_delete_detection_running():
                log_info(f"{log_prefix} [跳过] 删除检测运行中，跳过本次增量同步")
                return {
                    "success": False,
                    "error": "删除检测运行中",
                    "skipped": True
                }
            
            # 尝试获取增量同步锁（非阻塞）
            if not coordinator.acquire_incremental_sync_lock():
                log_info(f"{log_prefix} [跳过] 无法获取增量同步锁，可能有其他进程在运行")
                return {
                    "success": False,
                    "error": "无法获取增量同步锁",
                    "skipped": True
                }
            
            log_info(f"{log_prefix} [优化] 增量同步模式：跳过删除检测（删除检测将定期执行，例如每小时一次）")
            
            # 为每个实体类型创建独立的数据队列和写入线程
            entity_queues = {}
            entity_write_threads = {}
            entity_write_stats = {}
            entity_stop_events = {}
            
            for entity_type in entity_types:
                queue = Queue(maxsize=100000)  # 每个实体类型独立的队列
                entity_queues[entity_type] = queue
                
                stop_event = threading.Event()
                entity_stop_events[entity_type] = stop_event
                
                stats = {
                    'total_written': 0,
                    'errors': [],
                    'api_object_ids': set()  # 记录从API获取的object_id
                }
                entity_write_stats[entity_type] = stats
                
                # 为每个实体类型启动独立的写入线程（不传递db，让线程自己创建）
                # 传递log_prefix以便写入线程也能输出项目标识
                write_thread = threading.Thread(
                    target=self._write_entity_worker,
                    args=(None, entity_type, queue, stop_event, stats, project_id, project_object_id, log_prefix),  # db=None，线程内创建
                    daemon=True
                )
                write_thread.start()
                entity_write_threads[entity_type] = write_thread
            
            # 使用线程池并行读取多个实体（生产者）
            start_time = datetime.now()
            with ThreadPoolExecutor(max_workers=len(entity_types)) as executor:
                futures = {}
                for entity_type in entity_types:
                    fields = fields_map.get(entity_type) if fields_map else None
                    # 获取该实体类型的Filter（用于增量同步）
                    filters = entity_filters.get(entity_type)
                    future = executor.submit(
                        self._read_entity_worker,
                        entity_type,
                        project_id,
                        project_object_id,
                        fields,
                        entity_queues[entity_type],
                        log_prefix,  # 传递log_prefix
                        filters  # 传递filters参数
                    )
                    futures[future] = entity_type
                
                # 等待所有读取任务完成
                results = {}
                for future in as_completed(futures):
                    entity_type = futures[future]
                    try:
                        result = future.result()
                        results[entity_type] = result
                        log_info(f"{log_prefix} ✅ {entity_type} 读取完成: {result.get('count', 0)} 条")
                    except Exception as e:
                        log_error(f"{log_prefix} ❌ {entity_type} 读取失败: {e}")
                        import traceback
                        log_error(traceback.format_exc())
                        results[entity_type] = {
                            "success": False,
                            "error": str(e),
                            "count": 0
                        }
            
            # 等待所有队列的数据写入完成
            log_info(f"{log_prefix} 所有读取线程完成，等待数据写入完成...")
            for entity_type in entity_types:
                entity_queues[entity_type].join()  # 等待该实体类型的队列完成
            
            # 停止所有写入线程
            for entity_type, stop_event in entity_stop_events.items():
                stop_event.set()
                entity_write_threads[entity_type].join(timeout=30)
            
            total_duration = (datetime.now() - start_time).total_seconds()
            
            # 释放增量同步锁
            coordinator.release_incremental_sync_lock()
            
            # 简化统计：删除检测已改为定期执行，不再每次增量同步都计算
            log_info(f"{log_prefix}\n计算统计信息...")
            sync_stats = {}
            
            for entity_type in entity_types:
                api_object_ids = entity_write_stats[entity_type].get('api_object_ids', set())
                
                if is_clear_mode:
                    # 清空重建模式：所有都是新增
                    sync_stats[entity_type] = {
                        'added': len(api_object_ids),
                        'updated': 0,
                        'deleted': 0,
                        'total_from_api': len(api_object_ids),
                        'total_in_db_before': 0
                    }
                else:
                    # 增量更新模式：简化统计（不进行删除检测）
                    # 注意：由于使用REPLACE INTO或批量UPDATE，无法准确区分新增和更新
                    # 这里只统计从API读取的数据量
                    sync_stats[entity_type] = {
                        'added': 0,  # 无法准确统计（REPLACE INTO会替换已存在的记录）
                        'updated': 0,  # 无法准确统计
                        'deleted': 0,  # 删除检测已改为定期执行
                        'total_from_api': len(api_object_ids),
                        'total_in_db_before': 0
                    }
            
            # 统计结果
            total_count = sum(r.get('count', 0) for r in results.values() if r.get('success'))
            total_written = sum(stats['total_written'] for stats in entity_write_stats.values())
            total_added = sum(s['added'] for s in sync_stats.values())
            total_updated = sum(s['updated'] for s in sync_stats.values())
            total_deleted = sum(s['deleted'] for s in sync_stats.values())
            
            log_info(f"{log_prefix}\n{'='*60}")
            log_info(f"{log_prefix} 并行同步完成（直接写入正式表）")
            log_info(f"{log_prefix} {'='*60}")
            log_info(f"{log_prefix} 总耗时: {total_duration:.2f} 秒")
            log_info(f"{log_prefix} 总数据量: {total_count} 条（从API读取）")
            log_info(f"{log_prefix} 写入成功: {total_written} 条")
            log_info(f"{log_prefix}\n增删改统计:")
            log_info(f"{log_prefix}   新增: {total_added} 条")
            log_info(f"{log_prefix}   更新: {total_updated} 条")
            log_info(f"{log_prefix}   删除: {total_deleted} 条（标记为is_active=0）")
            
            log_info(f"{log_prefix}\n各实体类型详细统计:")
            for entity_type in entity_types:
                result = results.get(entity_type, {})
                stats = entity_write_stats.get(entity_type, {})
                sync_stat = sync_stats.get(entity_type, {})
                if result.get('success'):
                    log_info(f"{log_prefix}    ✅ {entity_type}:")
                    log_info(f"{log_prefix}       读取: {result.get('count', 0)} 条")
                    log_info(f"{log_prefix}       写入: {stats.get('total_written', 0)} 条")
                    log_info(f"{log_prefix}       新增: {sync_stat.get('added', 0)} 条")
                    log_info(f"{log_prefix}       更新: {sync_stat.get('updated', 0)} 条")
                    log_info(f"{log_prefix}       删除: {sync_stat.get('deleted', 0)} 条")
                else:
                    log_error(f"{log_prefix}    ❌ {entity_type}: {result.get('error', 'Unknown error')}")
            
            # 记录同步时间到p6_sync_logs表（用于下次增量同步）
            completed_at = datetime.now(timezone.utc)
            try:
                from app.p6_sync.models.sync_log import P6SyncLog, SyncStatus, SyncEntityType
                
                entity_type_map = {
                    'eps': SyncEntityType.EPS,
                    'project': SyncEntityType.PROJECT,
                    'wbs': SyncEntityType.WBS,
                    'activity': SyncEntityType.ACTIVITY,
                    'activity_code': SyncEntityType.ACTIVITY_CODE,
                    'activity_code_assignment': SyncEntityType.ACTIVITY_CODE_ASSIGNMENT,
                    'resource': SyncEntityType.RESOURCE,
                    'resource_assignment': SyncEntityType.RESOURCE_ASSIGNMENT,
                }
                
                # 为每个成功同步的实体类型创建同步日志
                for entity_type in entity_types:
                    sync_entity_type = entity_type_map.get(entity_type.lower())
                    if not sync_entity_type:
                        continue
                    
                    entity_result = results.get(entity_type, {})
                    if entity_result.get('success', False):
                        try:
                            sync_log = P6SyncLog(
                                sync_type=sync_entity_type,
                                sync_status=SyncStatus.COMPLETED,
                                project_id=project_id,
                                project_object_id=project_object_id,
                                total_count=entity_result.get('count', 0),
                                created_count=sync_stats.get(entity_type, {}).get('added', 0),
                                updated_count=sync_stats.get(entity_type, {}).get('updated', 0),
                                skipped_count=0,
                                error_count=0,
                                started_at=start_time,
                                completed_at=completed_at,
                                duration_seconds=int(total_duration)
                            )
                            db.add(sync_log)
                            completed_at_system = utc_to_system(completed_at)
                            log_info(f"{log_prefix} ✓ 已记录 {entity_type} 同步日志（完成时间: {completed_at_system.strftime('%Y-%m-%d %H:%M:%S')}）")
                        except Exception as e:
                            log_error(f"{log_prefix} ⚠️ 记录 {entity_type} 同步日志失败: {e}")
                
                db.commit()
            except Exception as e:
                log_error(f"{log_prefix} ⚠️ 记录同步日志失败: {e}")
                db.rollback()
            
            return {
                "success": True,
                "total_count": total_count,
                "written_count": total_written,
                "total_duration": total_duration,
                "total_added": total_added,
                "total_updated": total_updated,
                "total_deleted": total_deleted,
                "entity_results": results,
                "entity_write_stats": entity_write_stats,
                "entity_sync_stats": sync_stats
            }
            
        except Exception as e:
            # 确保在异常时也释放锁
            try:
                coordinator.release_incremental_sync_lock()
            except:
                pass
            raise
            
        except Exception as e:
            log_prefix = f"[项目 {project_id}]" if project_id else "[全局]"
            log_error(f"{log_prefix} 并行同步失败: {e}")
            import traceback
            log_error(traceback.format_exc())
            return {
                "success": False,
                "error": str(e)
            }
        finally:
            if should_close:
                db.close()
    
    def sync_multiple_projects_entities_direct(
        self,
        project_ids: List[str],
        entity_types: List[str],
        fields_map: Optional[Dict[str, List[str]]] = None,
        max_workers: Optional[int] = None
    ) -> Dict:
        """
        方案B：按实体类型分组，所有项目共享队列和写入线程
        边读边写，避免多线程并发写入同一张表造成死锁
        
        Args:
            project_ids: 项目ID列表
            entity_types: 实体类型列表
            fields_map: 每个实体类型对应的字段列表（可选）
            max_workers: 最大并发读取线程数（可选，默认等于项目数）
        
        Returns:
            同步结果字典
        """
        from app.database import SessionLocal
        
        log_info(f"[方案B] 开始同步 {len(project_ids)} 个项目的实体数据: {', '.join(entity_types)}")
        log_info(f"[方案B] 项目列表: {', '.join(project_ids)}")
        
        if not project_ids:
            return {
                "success": False,
                "error": "项目ID列表为空"
            }
        
        # 确定并发数
        if max_workers is None:
            max_workers = min(len(project_ids), 5)  # 默认不超过5个
        
        # 为每个实体类型创建共享队列和写入线程（所有项目共享）
        entity_queues = {}
        entity_write_threads = {}
        entity_write_stats = {}
        entity_stop_events = {}
        entity_completed_projects = {}  # 记录每个实体类型已完成的项目
        
        # 定义哪些实体类型是项目级别的
        project_level_entities = {'wbs', 'activity', 'activity_code_assignment', 'resource_assignment'}
        
        # 初始化每个实体类型的完成计数器
        for entity_type in entity_types:
            entity_completed_projects[entity_type] = set()
            # 根据实体类型调整队列大小
            # activity_code_assignment数据量大，需要更大的队列
            # 考虑到多个项目并发，使用无界队列（maxsize=0表示无界）避免数据丢失
            if entity_type == 'activity_code_assignment':
                queue_size = 0  # 无界队列，避免数据丢失
            elif entity_type == 'resource_assignment':
                queue_size = 1000000  # 100万
            else:
                queue_size = 500000  # 50万
            queue = Queue(maxsize=queue_size) if queue_size > 0 else Queue()
            if queue_size == 0:
                log_info(f"[方案B] {entity_type} 队列大小: 无界（避免数据丢失）")
            else:
                log_info(f"[方案B] {entity_type} 队列大小: {queue_size:,}")
            entity_queues[entity_type] = queue
            
            stop_event = threading.Event()
            entity_stop_events[entity_type] = stop_event
            
            stats = {
                'total_written': 0,
                'errors': [],
                'api_object_ids': set(),
                'project_stats': {},  # 按项目统计
                'processed_count': 0,  # 已处理的数据条数（用于进度显示）
                'transform_failed': 0  # 转换失败的记录数（缺少必需字段等）
            }
            entity_write_stats[entity_type] = stats
            
            # 为每个实体类型启动一个写入线程（所有项目共享）
            write_thread = threading.Thread(
                target=self._write_entity_worker_shared,
                args=(
                    entity_type,
                    queue,
                    stop_event,
                    stats,
                    entity_completed_projects[entity_type],
                    len(project_ids),  # 总项目数
                    project_level_entities
                ),
                daemon=True
            )
            write_thread.start()
            entity_write_threads[entity_type] = write_thread
            log_info(f"[方案B] 已启动 {entity_type} 写入线程（共享，所有项目共用）")
        
        # 所有项目并行读取，将数据放入共享队列
        start_time = datetime.now()
        read_results = {}  # {project_id: {entity_type: result}}
        
        def read_project_entities(project_id: str):
            """读取单个项目的所有实体数据"""
            project_log_prefix = f"[项目 {project_id}]"
            project_results = {}
            
            try:
                # 为每个项目创建独立的P6连接
                from app.services.p6_sync_service import P6SyncService
                p6_service = P6SyncService()
                if not p6_service.app:
                    error_msg = "P6连接失败"
                    log_error(f"{project_log_prefix} ❌ {error_msg}")
                    return {project_id: {et: {"success": False, "error": error_msg, "count": 0} for et in entity_types}}
                
                # 选择项目
                p6_service.app.select_project(projectId=project_id)
                project_object_id = p6_service.app.eppmSession.selectedProjectObjectId
                
                if not project_object_id:
                    error_msg = f"项目 {project_id} 不存在或无法选择（ObjectId为None）"
                    log_error(f"{project_log_prefix} ❌ {error_msg}")
                    return {project_id: {et: {"success": False, "error": error_msg, "count": 0} for et in entity_types}}
                
                log_info(f"{project_log_prefix} 已选择项目 (ObjectId: {project_object_id})")
                
                # 创建临时同步服务（使用独立的P6连接）
                temp_sync_service = RawDataSyncServiceDirect(p6_service=p6_service)
                
                # 检测是否是清空重建模式
                import sys
                is_clear_mode = '--clear' in sys.argv
                
                # 增量同步：获取每个实体类型的上次同步时间并构建Filter
                entity_filters = {}
                if not is_clear_mode:
                    # 为每个项目创建独立的数据库连接来查询上次同步时间
                    project_db = SessionLocal()
                    try:
                        for entity_type in entity_types:
                            last_sync_time = temp_sync_service._get_last_sync_time(project_db, entity_type, project_id)
                            if last_sync_time:
                                filter_str = temp_sync_service._build_incremental_filter(entity_type, project_object_id, last_sync_time)
                                entity_filters[entity_type] = filter_str
                                log_info(f"{project_log_prefix} {entity_type}: 上次同步时间 {last_sync_time.strftime('%Y-%m-%d %H:%M:%S')}，使用Filter: {filter_str}")
                            else:
                                entity_filters[entity_type] = None
                                log_info(f"{project_log_prefix} {entity_type}: 首次同步（无上次同步时间）")
                    finally:
                        project_db.close()
                else:
                    log_info(f"{project_log_prefix} 清空重建模式：不使用增量同步Filter")
                    for entity_type in entity_types:
                        entity_filters[entity_type] = None
                
                # 并行读取该项目的所有实体类型
                with ThreadPoolExecutor(max_workers=len(entity_types)) as executor:
                    futures = {}
                    for entity_type in entity_types:
                        fields = fields_map.get(entity_type) if fields_map else None
                        # 获取该实体类型的Filter（用于增量同步）
                        filters = entity_filters.get(entity_type)
                        future = executor.submit(
                            temp_sync_service._read_entity_worker,
                            entity_type,
                            project_id,
                            project_object_id,
                            fields,
                            entity_queues[entity_type],  # 使用共享队列
                            project_log_prefix,
                            filters  # 传递filters参数
                        )
                        futures[future] = entity_type
                    
                    # 收集读取结果
                    for future in as_completed(futures):
                        entity_type = futures[future]
                        try:
                            result = future.result()
                            project_results[entity_type] = result
                            log_info(f"{project_log_prefix} ✅ {entity_type} 读取完成: {result.get('count', 0)} 条")
                        except Exception as e:
                            log_error(f"{project_log_prefix} ❌ {entity_type} 读取失败: {e}")
                            project_results[entity_type] = {
                                "success": False,
                                "error": str(e),
                                "count": 0
                            }
                
                # 标记该项目所有实体类型读取完成
                for entity_type in entity_types:
                    entity_queues[entity_type].put({
                        '__project_done__': project_id,
                        '__entity_type__': entity_type
                    })
                    log_info(f"{project_log_prefix} 已标记 {entity_type} 读取完成")
                
                return {project_id: project_results}
                
            except Exception as e:
                log_error(f"{project_log_prefix} ❌ 读取异常: {e}")
                import traceback
                log_error(traceback.format_exc())
                # 即使失败也要标记完成
                for entity_type in entity_types:
                    entity_queues[entity_type].put({
                        '__project_done__': project_id,
                        '__entity_type__': entity_type
                    })
                return {project_id: {et: {"success": False, "error": str(e), "count": 0} for et in entity_types}}
        
        # 使用线程池并行读取所有项目
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {executor.submit(read_project_entities, pid): pid for pid in project_ids}
            
            for future in as_completed(futures):
                pid = futures[future]
                try:
                    result = future.result()
                    read_results.update(result)
                except Exception as e:
                    log_error(f"[项目 {pid}] ❌ 读取任务异常: {e}")
                    read_results[pid] = {et: {"success": False, "error": str(e), "count": 0} for et in entity_types}
        
        # 等待所有写入线程完成，并显示进度
        # 每个实体类型的写入线程独立工作，不需要等待其他实体类型
        log_info(f"[方案B] 所有项目读取完成，等待各实体类型数据写入完成...")
        
        # 使用循环定期检查进度，每个实体类型独立完成
        import time
        wait_start_time = time.time()
        last_progress_log_time = wait_start_time
        completed_entities = set()  # 已完成的实体类型
        
        while len(completed_entities) < len(entity_types):
            current_time = time.time()
            
            # 优化：每60秒输出一次进度（减少日志频率，降低I/O开销）
            if current_time - last_progress_log_time >= 60:
                progress_info = []
                for entity_type in entity_types:
                    if entity_type in completed_entities:
                        continue  # 已完成的实体类型不再显示
                    
                    queue = entity_queues[entity_type]
                    queue_size = queue.qsize()
                    stats = entity_write_stats[entity_type]
                    written = stats.get('total_written', 0)
                    completed_count = len(entity_completed_projects[entity_type])
                    
                    # 检查该实体类型是否已完成
                    if queue_size == 0 and completed_count >= len(project_ids):
                        # 队列为空且所有项目都完成了，标记为已完成
                        if entity_type not in completed_entities:
                            completed_entities.add(entity_type)
                            log_info(f"[方案B] ✅ {entity_type} 写入完成，共写入 {written:,} 条")
                    elif queue_size > 0:
                        # 精简：只显示队列剩余和已写入，去掉实体类型名称（从上下文可知）
                        progress_info.append(f"{entity_type}: 队列{queue_size:,}，已写{written:,}")
                    # 去掉"等待项目完成"的状态，减少日志
                
                if progress_info:
                    elapsed = int(current_time - wait_start_time)
                    remaining = len(entity_types) - len(completed_entities)
                    log_info(f"[方案B] [进度] {elapsed}秒，剩余{remaining}个实体 - {' | '.join(progress_info)}")
                last_progress_log_time = current_time
            
            # 短暂休眠，避免CPU占用过高
            time.sleep(1)
        
        # 停止所有写入线程
        log_info(f"[方案B] 所有实体类型写入完成，等待写入线程退出...")
        for entity_type, stop_event in entity_stop_events.items():
            stop_event.set()
            entity_write_threads[entity_type].join(timeout=60)
            stats = entity_write_stats[entity_type]
            written = stats.get('total_written', 0)
            log_info(f"[方案B] {entity_type} 写入线程已停止，共写入 {written:,} 条数据")
        
        total_duration = (datetime.now() - start_time).total_seconds()
        
        # 统计结果
        log_info(f"[方案B]\n{'='*60}")
        log_info(f"[方案B] 同步完成（方案B：按实体类型分组，共享写入线程）")
        log_info(f"[方案B] {'='*60}")
        log_info(f"[方案B] 总耗时: {total_duration:.2f} 秒")
        
        # 汇总统计
        total_read = 0
        total_written = 0
        for entity_type in entity_types:
            stats = entity_write_stats[entity_type]
            total_written += stats['total_written']
            for project_id in project_ids:
                project_result = read_results.get(project_id, {}).get(entity_type, {})
                if project_result.get('success'):
                    total_read += project_result.get('count', 0)
        
        log_info(f"[方案B] 总读取: {total_read:,} 条")
        log_info(f"[方案B] 总写入: {total_written:,} 条")
        
        # 构建统计信息（用于主程序显示）
        import sys
        is_clear_mode = '--clear' in sys.argv
        
        entity_sync_stats = {}
        for entity_type in entity_types:
            stats = entity_write_stats[entity_type]
            total_read_for_entity = 0
            for project_id in project_ids:
                project_result = read_results.get(project_id, {}).get(entity_type, {})
                if project_result.get('success'):
                    total_read_for_entity += project_result.get('count', 0)
            
            if is_clear_mode:
                # 清空模式：所有数据都是新增
                entity_sync_stats[entity_type] = {
                    'added': total_read_for_entity,
                    'updated': 0,
                    'deleted': 0,
                    'total_from_api': total_read_for_entity,
                    'total_in_db_before': 0
                }
            else:
                # 增量模式：无法计算（需要预先查询，会降低性能）
                entity_sync_stats[entity_type] = {
                    'added': 0,
                    'updated': 0,
                    'deleted': 0,
                    'total_from_api': total_read_for_entity,
                    'total_in_db_before': 0
                }
        
        # 记录同步时间到p6_sync_logs表（用于下次增量同步）
        completed_at = datetime.now(timezone.utc)
        try:
            from app.p6_sync.models.sync_log import P6SyncLog, SyncStatus, SyncEntityType
            from app.database import SessionLocal
            
            record_db = SessionLocal()
            try:
                entity_type_map = {
                    'eps': SyncEntityType.EPS,
                    'project': SyncEntityType.PROJECT,
                    'wbs': SyncEntityType.WBS,
                    'activity': SyncEntityType.ACTIVITY,
                    'activity_code': SyncEntityType.ACTIVITY_CODE,
                    'activity_code_assignment': SyncEntityType.ACTIVITY_CODE_ASSIGNMENT,
                    'resource': SyncEntityType.RESOURCE,
                    'resource_assignment': SyncEntityType.RESOURCE_ASSIGNMENT,
                }
                
                # 为每个项目、每个实体类型创建同步日志
                # 需要从P6连接中获取project_object_id，但由于每个项目使用独立的连接，这里暂时设为None
                # 实际使用时，可以通过查询p6_projects表获取
                for project_id in project_ids:
                    project_result = read_results.get(project_id, {})
                    # 尝试从p6_projects表获取project_object_id
                    project_object_id = None
                    try:
                        from app.p6_sync.models.project import P6Project
                        project_record = record_db.query(P6Project).filter(P6Project.project_id == project_id).first()
                        if project_record:
                            project_object_id = project_record.object_id
                    except Exception as e:
                        log_error(f"[方案B] ⚠️ 获取项目 {project_id} 的ObjectId失败: {e}")
                    
                    for entity_type in entity_types:
                        sync_entity_type = entity_type_map.get(entity_type.lower())
                        if not sync_entity_type:
                            continue
                        
                        entity_result = project_result.get(entity_type, {})
                        if entity_result.get('success', False):
                            try:
                                sync_stat = entity_sync_stats.get(entity_type, {})
                                sync_log = P6SyncLog(
                                    sync_type=sync_entity_type,
                                    sync_status=SyncStatus.COMPLETED,
                                    project_id=project_id,
                                    project_object_id=project_object_id,
                                    total_count=entity_result.get('count', 0),
                                    created_count=sync_stat.get('added', 0),
                                    updated_count=sync_stat.get('updated', 0),
                                    skipped_count=0,
                                    error_count=0,
                                    started_at=start_time,
                                    completed_at=completed_at,
                                    duration_seconds=int(total_duration)
                                )
                                record_db.add(sync_log)
                                completed_at_system = utc_to_system(completed_at)
                                log_info(f"[方案B] ✓ 已记录 {project_id}/{entity_type} 同步日志（完成时间: {completed_at_system.strftime('%Y-%m-%d %H:%M:%S')}）")
                            except Exception as e:
                                log_error(f"[方案B] ⚠️ 记录 {project_id}/{entity_type} 同步日志失败: {e}")
                
                record_db.commit()
            finally:
                record_db.close()
        except Exception as e:
            log_error(f"[方案B] ⚠️ 记录同步日志失败: {e}")
        
        return {
            "success": True,
            "total_duration": total_duration,
            "total_read": total_read,
            "total_written": total_written,
            "read_results": read_results,
            "write_stats": entity_write_stats,
            "entity_sync_stats": entity_sync_stats  # 添加统计信息
        }
    
    def _write_entity_worker_shared(
        self,
        entity_type: str,
        data_queue: Queue,
        stop_event: threading.Event,
        stats: Dict,
        completed_projects: set,
        total_projects: int,
        project_level_entities: set
    ):
        """
        共享写入线程（方案B）：处理所有项目的同一实体类型数据
        每张表只有一个写入线程，避免死锁
        """
        thread_id = threading.current_thread().ident
        log_info(f"[方案B] [写入线程{thread_id}] {entity_type} 写入线程启动（共享，处理所有项目）")
        
        # 为每个线程创建独立的数据库连接
        from app.database import engine
        thread_db = Session(bind=engine)
        
        try:
            # 根据实体类型获取对应的处理函数
            transform_func = self._get_transform_function(entity_type)
            if not transform_func:
                log_error(f"[方案B] [写入线程{thread_id}] 不支持的实体类型: {entity_type}")
                return
            
            # 获取表信息（用于最终验证）
            table_info = self._get_table_info(entity_type)
            
            # 准备批量数据
            batch_data = []
            is_project_level = entity_type.lower() in project_level_entities
            last_log_time = time.time()
            last_write_log_time = time.time()  # 用于定期输出写入进度
            last_force_write_time = time.time()  # 用于所有项目完成时的强制写入
            processed_count = 0
            
            while True:
                # 从队列获取数据
                try:
                    item = data_queue.get(timeout=1)
                    got_item = True
                except:
                    got_item = False
                    # 队列为空时，检查是否所有项目都完成了
                    # 如果所有项目都完成了，且队列为空，则退出
                    if len(completed_projects) >= total_projects:
                        # 再次确认队列为空（可能刚有数据放入）
                        queue_size = data_queue.qsize()
                        if queue_size == 0:
                            # 在退出前，先写入剩余批次数据
                            if batch_data:
                                try:
                                    log_info(f"[方案B] [{entity_type}] 退出前检测到剩余批次: {len(batch_data):,} 条，开始写入...")
                                    
                                    # 对于剩余批次，如果是 activity_code_assignment，使用查询验证
                                    from sqlalchemy import text
                                    count_before = None
                                    is_clean_rebuild = len(batch_data) > 200000
                                    if entity_type == 'activity_code_assignment':
                                        try:
                                            count_result = thread_db.execute(text(f"SELECT COUNT(*) FROM {table_info['table_name']}"))
                                            count_before = count_result.scalar()
                                        except:
                                            pass
                                    
                                    written = self._batch_insert_to_table(thread_db, entity_type, batch_data)
                                    
                                    # 验证剩余批次的实际插入数
                                    if entity_type == 'activity_code_assignment' and count_before is not None:
                                        try:
                                            count_result = thread_db.execute(text(f"SELECT COUNT(*) FROM {table_info['table_name']}"))
                                            count_after = count_result.scalar()
                                            actual_written = count_after - count_before
                                            if actual_written != written:
                                                log_info(f"[方案B] [{entity_type}] 退出前剩余批次验证：统计写入 {written:,} 条，实际插入 {actual_written:,} 条，差异 {written - actual_written:,} 条")
                                                written = actual_written  # 使用实际插入数
                                        except:
                                            pass
                                    
                                    stats['total_written'] += written
                                    log_info(f"[方案B] [{entity_type}] 退出前剩余批次写入完成: 尝试 {len(batch_data):,} 条，实际写入 {written:,} 条")
                                    batch_data = []  # 清空批次
                                except Exception as e:
                                    log_error(f"[方案B] [写入线程{thread_id}] {entity_type} 退出前写入剩余批次失败: {e}")
                                    import traceback
                                    log_error(traceback.format_exc())
                            else:
                                log_info(f"[方案B] [{entity_type}] 退出前检查：batch_data 为空，无需写入剩余批次")
                            log_info(f"[方案B] [{entity_type}] 写入完成，退出")
                            break
                        # 队列不为空时继续处理（不输出日志，减少噪音）
                        continue
                    
                    # 每60秒输出一次写入线程状态（从30秒改为60秒，减少日志）
                    current_time = time.time()
                    if current_time - last_log_time > 60:
                        queue_size = data_queue.qsize()
                        completed = len(completed_projects)
                        log_info(f"[方案B] [{entity_type}] 等待数据（队列:{queue_size:,}，项目:{completed}/{total_projects}）")
                        last_log_time = current_time
                    
                    if stop_event.is_set():
                        break
                    continue
                
                # 检查是否是项目完成标记
                if isinstance(item, dict) and item.get('__project_done__'):
                    project_id = item['__project_done__']
                    completed_projects.add(project_id)
                    # 精简：只在最后一个项目完成时输出日志
                    if len(completed_projects) >= total_projects:
                        log_info(f"[方案B] [{entity_type}] 所有项目读取完成（{total_projects}个）")
                    data_queue.task_done()
                    
                    # 检查是否所有项目都完成了
                    if len(completed_projects) >= total_projects:
                        queue_size = data_queue.qsize()
                        if queue_size > 0:
                            log_info(f"[方案B] [{entity_type}] 所有项目完成，处理剩余{queue_size:,}条数据")
                        # 继续处理，直到队列为空
                        # 注意：这里不立即退出，而是继续处理队列中的剩余数据
                        # 队列为空时会在下一次循环中退出
                    continue
                
                # 检查是否是结束标记（兼容旧格式）
                if isinstance(item, dict) and item.get('__done__'):
                    data_queue.task_done()
                    # 只有在所有项目完成且队列为空时才退出
                    if len(completed_projects) >= total_projects and data_queue.empty():
                        break
                    continue
                
                # 处理数据
                try:
                    json_data = item.get('json_data')
                    if not json_data:
                        data_queue.task_done()
                        continue
                    
                    # 从队列数据中提取project_id和project_object_id
                    # _read_entity_worker已经将这些信息放入队列
                    project_id = item.get('project_id')
                    project_object_id = item.get('project_object_id')
                    
                    # 如果队列中没有，尝试从json_data中提取（兼容旧格式）
                    if not project_object_id and is_project_level:
                        project_object_id = safe_get(json_data, 'ProjectObjectId')
                    
                    transformed = transform_func(json_data, project_id, project_object_id)
                    if transformed:
                        batch_data.append(transformed)
                        # 记录object_id用于统计
                        object_id = transformed.get('object_id')
                        if object_id:
                            stats['api_object_ids'].add(object_id)
                    else:
                        # 转换失败（缺少必需字段等）
                        stats['transform_failed'] += 1
                    
                    processed_count += 1
                    
                    # 根据实体类型调整批次大小（使用 LOAD DATA LOCAL INFILE，批次大小统一为 500,000）
                    batch_size = 500000  # 统一批次大小：50万条/批次（LOAD DATA LOCAL INFILE 模式）
                    
                    # 优化：减少日志频率到180秒（3分钟），降低I/O开销
                    current_time = time.time()
                    if current_time - last_write_log_time > 180:  # 每3分钟输出一次
                        queue_size = data_queue.qsize()
                        log_info(f"[方案B] [{entity_type}] 处理中（队列:{queue_size:,}，已写:{stats['total_written']:,}，批次:{len(batch_data):,}）")
                        last_write_log_time = current_time
                    
                    # 如果所有项目都完成了，即使批次不够大，也要定期写入剩余数据
                    all_projects_done = len(completed_projects) >= total_projects
                    should_force_write = False
                    if all_projects_done and len(batch_data) > 0:
                        # 所有项目完成时，如果批次有数据但不够大，每30秒强制写入一次
                        if current_time - last_force_write_time > 30:
                            queue_size = data_queue.qsize()
                            log_info(f"[方案B] [{entity_type}] 所有项目完成，强制写入剩余批次: {len(batch_data):,} 条（队列:{queue_size:,}）")
                            should_force_write = True
                            last_force_write_time = current_time
                    
                    # 达到批次大小时，批量写入
                    if len(batch_data) >= batch_size or should_force_write:
                        queue_size_before = data_queue.qsize()
                        batch_size_actual = len(batch_data)
                        
                        # 对于 activity_code_assignment，不需要检测冲突（object_id 都是 0，插入后会更新为 id）
                        # 对于其他实体类型，检测重复的 object_id
                        if entity_type != 'activity_code_assignment':
                            object_id_set = set()
                            duplicate_count = 0
                            for data in batch_data:
                                obj_id = data.get('object_id')
                                if obj_id in object_id_set:
                                    duplicate_count += 1
                                else:
                                    object_id_set.add(obj_id)
                            
                            if duplicate_count > 0:
                                log_info(f"[方案B] [{entity_type}] 警告：批次内发现 {duplicate_count:,} 个重复的 object_id（REPLACE INTO 会覆盖之前的记录）")
                        
                        try:
                            write_start = time.time()
                            
                            written = self._batch_insert_to_table(
                                thread_db, entity_type, batch_data
                            )
                            
                            write_duration = time.time() - write_start
                            stats['total_written'] += written
                            
                            # 如果实际写入数小于尝试数，输出警告
                            if written < batch_size_actual and batch_size_actual > 10000:
                                log_info(f"[方案B] [{entity_type}] 警告：尝试写入 {batch_size_actual:,} 条，实际写入 {written:,} 条，差异 {batch_size_actual - written:,} 条（可能因数据验证失败或哈希冲突被跳过）")
                            
                            batch_data = []  # 清空批次
                            last_log_time = time.time()  # 更新日志时间
                            last_write_log_time = time.time()  # 更新写入日志时间
                            last_force_write_time = time.time()  # 更新强制写入时间
                            
                            queue_size_after = data_queue.qsize()
                            # 计算写入速度（条/秒）
                            write_speed = batch_size_actual / write_duration if write_duration > 0 else 0
                            # 精简日志：显示写入速度和关键信息
                            log_info(f"[方案B] [{entity_type}] 写入{batch_size_actual:,}条，耗时{write_duration:.1f}秒（{write_speed:,.0f}条/秒），队列剩余{queue_size_after:,}，总计{stats['total_written']:,}")
                        except Exception as e:
                            log_error(f"[方案B] [写入线程{thread_id}] {entity_type} 批量写入失败: {e}")
                            import traceback
                            log_error(traceback.format_exc())
                            # 清空批次，避免重复错误
                            batch_data = []
                            stats['errors'].append(str(e))
                    
                    data_queue.task_done()
                    
                except Exception as e:
                    log_error(f"[方案B] [写入线程{thread_id}] {entity_type} 处理数据失败: {e}")
                    stats['errors'].append(str(e))
                    data_queue.task_done()
            
            # 退出循环前，写入剩余数据
            # 注意：只有在所有项目完成且队列为空时才执行到这里
            # 注意：如果在上面的 break 前已经写入，这里 batch_data 应该为空
            if batch_data:
                # 对于 activity_code_assignment，不需要检测冲突（object_id 都是 0，插入后会更新为 id）
                # 对于其他实体类型，检测重复的 object_id
                if entity_type != 'activity_code_assignment':
                    object_id_set = set()
                    duplicate_count = 0
                    for data in batch_data:
                        obj_id = data.get('object_id')
                        if obj_id in object_id_set:
                            duplicate_count += 1
                        else:
                            object_id_set.add(obj_id)
                    
                    if duplicate_count > 0:
                        log_info(f"[方案B] [{entity_type}] 警告：剩余批次内发现 {duplicate_count:,} 个重复的 object_id")
                
                try:
                    # 对于剩余批次，如果是清空重建模式且是 activity_code_assignment，也使用查询验证
                    from sqlalchemy import text
                    count_before = None
                    is_clean_rebuild = len(batch_data) > 200000
                    if is_clean_rebuild and entity_type == 'activity_code_assignment':
                        try:
                            count_result = thread_db.execute(text(f"SELECT COUNT(*) FROM {table_info['table_name']}"))
                            count_before = count_result.scalar()
                        except:
                            pass
                    
                    # 对于剩余批次，如果是清空重建模式，也查询写入前后的记录数
                    if not is_clean_rebuild and entity_type == 'activity_code_assignment':
                        try:
                            count_result = thread_db.execute(text(f"SELECT COUNT(*) FROM {table_info['table_name']}"))
                            count_before = count_result.scalar()
                        except:
                            pass
                    
                    written = self._batch_insert_to_table(thread_db, entity_type, batch_data)
                    
                    # 验证剩余批次的实际插入数
                    if entity_type == 'activity_code_assignment' and count_before is not None:
                        try:
                            count_result = thread_db.execute(text(f"SELECT COUNT(*) FROM {table_info['table_name']}"))
                            count_after = count_result.scalar()
                            actual_written = count_after - count_before
                            if actual_written != written:
                                log_info(f"[方案B] [{entity_type}] 剩余批次验证：统计写入 {written:,} 条，实际插入 {actual_written:,} 条，差异 {written - actual_written:,} 条")
                                written = actual_written  # 使用实际插入数
                        except:
                            pass
                    
                    stats['total_written'] += written
                    log_info(f"[方案B] [{entity_type}] 写入剩余批次: {len(batch_data):,} 条（尝试），实际写入 {written:,} 条")
                except Exception as e:
                    log_error(f"[方案B] [写入线程{thread_id}] {entity_type} 写入剩余批次失败: {e}")
                    import traceback
                    log_error(traceback.format_exc())
                    stats['errors'].append(str(e))
            
        finally:
            # 最终验证：查询实际记录数（仅对超大表，且清空重建模式下）
            import sys
            is_clear_mode = '--clear' in sys.argv
            if table_info and entity_type == 'activity_code_assignment' and stats['total_written'] > 100000 and is_clear_mode:
                try:
                    from sqlalchemy import text
                    count_result = thread_db.execute(text(f"SELECT COUNT(*) FROM {table_info['table_name']}"))
                    actual_count = count_result.scalar()
                    if actual_count != stats['total_written']:
                        log_info(f"[方案B] [写入线程{thread_id}] {entity_type} 验证：统计写入 {stats['total_written']:,} 条，实际数据库记录 {actual_count:,} 条，差异 {stats['total_written'] - actual_count:,} 条（可能因数据验证失败被跳过）")
                        # 更新为实际写入数
                        stats['total_written'] = actual_count
                except Exception as e:
                    log_error(f"[方案B] [写入线程{thread_id}] {entity_type} 验证实际记录数失败: {e}")
            
            thread_db.close()
            transform_failed = stats.get('transform_failed', 0)
            if transform_failed > 0:
                log_info(f"[方案B] [写入线程{thread_id}] {entity_type} 写入线程完成，共写入 {stats['total_written']:,} 条数据，转换失败 {transform_failed:,} 条（缺少必需字段）")
            else:
                log_info(f"[方案B] [写入线程{thread_id}] {entity_type} 写入线程完成，共写入 {stats['total_written']:,} 条数据")
    
    def _read_activity_code_assignment_composite_keys(
        self,
        project_id: Optional[str],
        project_object_id: Optional[int],
        filters: Optional[str] = None,
        log_prefix: str = ""
    ) -> set:
        """
        读取ActivityCodeAssignment的组合键列表（用于删除检测）
        组合键：activity_object_id + project_object_id + activity_code_type_object_id + activity_code_object_id
        
        Args:
            project_id: 项目ID
            project_object_id: 项目ObjectId
            filters: Filter字符串（可选，用于项目过滤）
            log_prefix: 日志前缀
            
        Returns:
            组合键集合，每个元素是 (activity_object_id, project_object_id, activity_code_type_object_id, activity_code_object_id) 的元组
        """
        try:
            # 获取P6数据
            api_object = self._get_api_object('activity_code_assignment')
            if not api_object:
                log_error(f"{log_prefix} 无法获取ActivityCodeAssignment API对象")
                return set()
            
            # 只读取组合键所需的4个字段
            fields = ['ActivityObjectId', 'ProjectObjectId', 'ActivityCodeTypeObjectId', 'ActivityCodeObjectId']
            
            # 构建项目过滤条件（activity_code_assignment是项目级实体）
            actual_filters = filters
            if project_object_id:
                project_filter = f"ProjectObjectId :eq: {project_object_id}"
                if filters:
                    actual_filters = f"{project_filter} :and: {filters}"
                else:
                    actual_filters = project_filter
                log_info(f"{log_prefix} 使用项目过滤: {actual_filters}")
            
            try:
                # 优化：直接使用API调用（效率更高，Filter在服务器端生效）
                session = self.p6_service.app.eppmSession.session
                prefix = self.p6_service.app.eppmSession.prefix
                endpoint_value = api_object.endpointValue
                url = f"{prefix}/{endpoint_value}"
                
                # 构建请求参数（使用标准Filter格式）
                params = {"Fields": ','.join(fields)}
                if actual_filters:
                    params["Filter"] = actual_filters
                
                log_info(f"{log_prefix} 直接调用P6 API（优化路径），Filter: {actual_filters}")
                
                # 直接调用API
                response = session.get(url=url, params=params, timeout=300)
                if response.status_code != 200:
                    error_text = response.text[:500] if response.text else ""
                    log_error(f"{log_prefix} 直接API调用失败 ({response.status_code}): {error_text}")
                    raise Exception(f"API调用失败: {response.status_code}")
                
                # 解析响应
                try:
                    p6_data_list = response.json()
                    if isinstance(p6_data_list, dict):
                        p6_data_list = p6_data_list.get("data", [])
                    elif not isinstance(p6_data_list, list):
                        p6_data_list = json.loads(response.text) if isinstance(response.text, str) else []
                        if isinstance(p6_data_list, dict):
                            p6_data_list = p6_data_list.get("data", [])
                    log_info(f"{log_prefix} 直接API调用成功: {len(p6_data_list) if isinstance(p6_data_list, list) else 0} 条")
                except Exception as parse_error:
                    log_error(f"{log_prefix} 解析API响应失败: {parse_error}")
                    raise
                
                # 提取组合键
                composite_keys = set()
                if isinstance(p6_data_list, dict):
                    p6_data_list = [p6_data_list] if p6_data_list else []
                
                if not isinstance(p6_data_list, list):
                    p6_data_list = []
                
                for data in p6_data_list:
                    if isinstance(data, dict):
                        activity_object_id = safe_get(data, 'ActivityObjectId')
                        project_object_id_val = safe_get(data, 'ProjectObjectId') or project_object_id
                        activity_code_type_object_id = safe_get(data, 'ActivityCodeTypeObjectId')
                        activity_code_object_id = safe_get(data, 'ActivityCodeObjectId')
                        
                        # 确保所有字段都存在
                        if activity_object_id and project_object_id_val and activity_code_type_object_id and activity_code_object_id:
                            try:
                                # 转换为整数并构建组合键元组
                                composite_key = (
                                    int(activity_object_id),
                                    int(project_object_id_val),
                                    int(activity_code_type_object_id),
                                    int(activity_code_object_id)
                                )
                                composite_keys.add(composite_key)
                            except (ValueError, TypeError):
                                log_error(f"{log_prefix} 无法转换组合键字段为整数: activity_object_id={activity_object_id}, project_object_id={project_object_id_val}, activity_code_type_object_id={activity_code_type_object_id}, activity_code_object_id={activity_code_object_id}")
                                continue
                
                return composite_keys
            except Exception as e:
                log_error(f"{log_prefix} 读取ActivityCodeAssignment组合键失败: {e}")
                return set()
        except Exception as e:
            log_error(f"{log_prefix} 读取ActivityCodeAssignment组合键异常: {e}")
            return set()
    
    def _read_entity_object_ids_only(
        self,
        entity_type: str,
        project_id: Optional[str],
        project_object_id: Optional[int],
        filters: Optional[str] = None,
        log_prefix: str = ""
    ) -> set:
        """
        只读取实体类型的ObjectId列表（用于删除检测）
        只读取ObjectId字段，数据量很小，速度很快
        
        Args:
            entity_type: 实体类型
            project_id: 项目ID
            project_object_id: 项目ObjectId
            filters: Filter字符串（可选，用于项目过滤）
            log_prefix: 日志前缀
            
        Returns:
            object_id集合
        """
        try:
            # 获取P6数据
            api_object = self._get_api_object(entity_type)
            if not api_object:
                log_error(f"{log_prefix} 不支持的实体类型: {entity_type}")
                return set()
            
            # 只读取ObjectId字段
            fields = ['ObjectId']
            
            # 构建项目过滤条件（如果是项目级实体）
            project_level_entities = {'wbs', 'activity', 'activity_code_assignment', 'resource_assignment'}
            is_project_level = entity_type.lower() in project_level_entities
            
            # 如果提供了project_object_id且是项目级实体，构建项目过滤
            actual_filters = filters
            if is_project_level:
                if project_object_id:
                    project_filter = f"ProjectObjectId :eq: {project_object_id}"
                    if filters:
                        actual_filters = f"{project_filter} :and: {filters}"
                    else:
                        actual_filters = project_filter
                    log_info(f"{log_prefix} 使用项目过滤: {actual_filters} (project_object_id={project_object_id})")
                else:
                    log_error(f"{log_prefix} ⚠️ 项目级实体 {entity_type} 缺少 project_object_id，无法过滤！project_id={project_id}")
            
            try:
                # EPS使用特殊方法（返回列表）
                if entity_type.lower() == 'eps':
                    p6_data_list = api_object() if callable(api_object) else api_object
                else:
                    # 优化：对于项目级实体且提供了Filter，直接使用API调用（效率更高）
                    # 测试结果显示：直接API调用+Filter比Primavera库方法快10倍
                    if is_project_level and actual_filters:
                        # 直接使用API调用，确保Filter在服务器端生效，效率最高
                        session = self.p6_service.app.eppmSession.session
                        prefix = self.p6_service.app.eppmSession.prefix
                        endpoint_value = api_object.endpointValue
                        url = f"{prefix}/{endpoint_value}"
                        
                        # 构建请求参数（使用标准Filter格式：带空格的操作符）
                        params = {"Fields": ','.join(fields)}
                        if actual_filters:
                            params["Filter"] = actual_filters
                        
                        log_info(f"{log_prefix} 直接调用P6 API（优化路径），Filter: {actual_filters}")
                        
                        # 直接调用API
                        response = session.get(url=url, params=params, timeout=300)
                        if response.status_code == 200:
                            try:
                                p6_data_list = response.json()
                                if isinstance(p6_data_list, dict):
                                    # API可能返回 {"data": [...]} 格式
                                    p6_data_list = p6_data_list.get("data", [])
                                elif not isinstance(p6_data_list, list):
                                    # 如果不是列表，尝试解析为列表
                                    p6_data_list = json.loads(response.text) if isinstance(response.text, str) else []
                                    if isinstance(p6_data_list, dict):
                                        p6_data_list = p6_data_list.get("data", [])
                                log_info(f"{log_prefix} 直接API调用成功: {len(p6_data_list) if isinstance(p6_data_list, list) else 0} 条")
                            except Exception as parse_error:
                                log_error(f"{log_prefix} 解析API响应失败: {parse_error}")
                                raise
                        else:
                            # API调用失败
                            error_text = response.text[:500] if response.text else ""
                            log_error(f"{log_prefix} 直接API调用失败 ({response.status_code}): {error_text}")
                            raise Exception(f"API调用失败: {response.status_code}")
                    else:
                        # 对于全局实体或没有Filter的情况，尝试Primavera库方法
                        try:
                            if actual_filters:
                                log_info(f"{log_prefix} 使用Primavera库read方法，Filter: {actual_filters}")
                                p6_data_list = api_object.read(fields=fields, filters=actual_filters)
                            else:
                                p6_data_list = api_object.read(fields=fields)
                        except Exception as lib_error:
                            # Primavera库方法失败，回退到直接API调用
                            log_info(f"{log_prefix} Primavera库方法失败: {lib_error}，使用直接API调用")
                            session = self.p6_service.app.eppmSession.session
                            prefix = self.p6_service.app.eppmSession.prefix
                            endpoint_value = api_object.endpointValue
                            url = f"{prefix}/{endpoint_value}"
                            
                            params = {"Fields": ','.join(fields)}
                            if actual_filters:
                                params["Filter"] = actual_filters
                            
                            log_info(f"{log_prefix} 直接调用P6 API，Filter: {actual_filters if actual_filters else '(无)'}")
                            
                            response = session.get(url=url, params=params, timeout=300)
                            if response.status_code == 200:
                                try:
                                    p6_data_list = response.json()
                                    if isinstance(p6_data_list, dict):
                                        p6_data_list = p6_data_list.get("data", [])
                                    elif not isinstance(p6_data_list, list):
                                        p6_data_list = json.loads(response.text) if isinstance(response.text, str) else []
                                        if isinstance(p6_data_list, dict):
                                            p6_data_list = p6_data_list.get("data", [])
                                    log_info(f"{log_prefix} 直接API调用成功: {len(p6_data_list) if isinstance(p6_data_list, list) else 0} 条")
                                except Exception as parse_error:
                                    log_error(f"{log_prefix} 解析API响应失败: {parse_error}")
                                    raise
                            else:
                                error_text = response.text[:500] if response.text else ""
                                log_error(f"{log_prefix} 直接API调用失败 ({response.status_code}): {error_text}")
                                raise Exception(f"API调用失败: {response.status_code}")
                
                # 提取ObjectId
                object_ids = set()
                if isinstance(p6_data_list, dict):
                    p6_data_list = [p6_data_list] if p6_data_list else []
                
                if not isinstance(p6_data_list, list):
                    p6_data_list = []
                
                for data in p6_data_list:
                    if isinstance(data, dict):
                        obj_id = safe_get(data, 'ObjectId')
                        if obj_id:
                            # 确保转换为整数，与数据库中的object_id类型一致
                            try:
                                object_ids.add(int(obj_id))
                            except (ValueError, TypeError):
                                log_error(f"{log_prefix} 无法转换ObjectId为整数: {obj_id}")
                                continue
                
                return object_ids
            except Exception as e:
                log_error(f"{log_prefix} 读取{entity_type}的ObjectId失败: {e}")
                return set()
        except Exception as e:
            log_error(f"{log_prefix} 读取{entity_type}的ObjectId异常: {e}")
            return set()
    
    def _read_entity_worker(
        self,
        entity_type: str,
        project_id: Optional[str],
        project_object_id: Optional[int],
        fields: Optional[List[str]],
        data_queue: Queue,
        log_prefix: str = "",
        filters: Optional[str] = None
    ) -> Dict:
        """
        读取实体数据的worker（生产者）
        
        Args:
            entity_type: 实体类型
            project_id: 项目ID
            project_object_id: 项目ObjectId
            fields: 字段列表
            data_queue: 数据队列
            log_prefix: 日志前缀
            filters: Filter字符串（用于增量同步，例如：LastUpdateDate:gt:'2024-01-01 00:00:00'）
        """
        thread_id = threading.current_thread().ident
        try:
            log_info(f"{log_prefix} [线程{thread_id}] 开始读取 {entity_type} 数据...")
            if filters:
                log_info(f"{log_prefix} [线程{thread_id}] 使用增量同步Filter: {filters}")
            read_start = datetime.now()
            
            # 获取默认字段
            if not fields:
                fields = self._get_default_fields(entity_type)
                log_info(f"{log_prefix} [线程{thread_id}] {entity_type} 使用默认字段列表（{len(fields)}个字段）")
            
            # 获取P6数据
            api_object = self._get_api_object(entity_type)
            if not api_object:
                return {
                    "success": False,
                    "error": f"不支持的实体类型: {entity_type}",
                    "count": 0
                }
            
            try:
                # EPS使用特殊方法（返回列表）
                if entity_type.lower() == 'eps':
                    p6_data_list = api_object() if callable(api_object) else api_object
                else:
                    # 关键修复：Primavera库的read方法忽略了filters参数（有TODO注释）
                    # 我们需要直接调用P6 API，确保Filter在服务器端生效
                    if filters:
                        # 全局实体（可能不支持某些Filter，需要特殊处理）
                        global_entities = {'eps', 'project', 'activity_code', 'resource'}
                        is_global_entity = entity_type.lower() in global_entities
                        
                        try:
                            # 直接调用P6 API，绕过Primavera库的bug
                            session = self.p6_service.app.eppmSession.session
                            prefix = self.p6_service.app.eppmSession.prefix
                            endpoint_value = api_object.endpointValue
                            url = f"{prefix}/{endpoint_value}"
                            
                            # 构建请求参数
                            if fields:
                                params = {"Fields": ','.join(fields)}
                            else:
                                # 如果没有指定字段，获取默认字段
                                if not fields:
                                    fields = self._get_default_fields(entity_type)
                                params = {"Fields": ','.join(fields)}
                            
                            # 添加Filter参数（关键：确保Filter生效）
                            # 注意：_build_incremental_filter已经正确处理了全局实体
                            params["Filter"] = filters
                            
                            log_info(f"{log_prefix} [线程{thread_id}] {entity_type} 直接调用P6 API，Filter: {filters}")
                            
                            # 直接调用API
                            response = session.get(url=url, params=params, timeout=300)
                            if response.status_code != 200:
                                # Filter失败，回退到使用Primavera库的方法（虽然不支持Filter，但至少可以工作）
                                error_text = response.text[:500] if response.text else ""
                                log_info(f"{log_prefix} [线程{thread_id}] {entity_type} Filter失败（可能不支持LastUpdateDate过滤），回退到Primavera库方法。错误: {response.status_code}, {error_text}")
                                log_info(f"{log_prefix} [线程{thread_id}] {entity_type} 开始使用Primavera库读取（无Filter，可能较慢）...")
                                read_start_time = time.time()
                                if fields:
                                    p6_data_list = api_object.read(fields=fields)
                                else:
                                    p6_data_list = api_object.read()
                                read_duration = time.time() - read_start_time
                                log_info(f"{log_prefix} [线程{thread_id}] {entity_type} Primavera库读取完成: {len(p6_data_list)} 条，耗时: {read_duration:.2f} 秒")
                            else:
                                p6_data_list = json.loads(response.text)
                                log_info(f"{log_prefix} [线程{thread_id}] {entity_type} 直接API调用成功: {len(p6_data_list)} 条")
                        except Exception as api_error:
                            # API调用失败，回退到使用Primavera库的方法
                            error_str = str(api_error)
                            if "400" in error_str or "P6 API调用失败" in error_str:
                                log_info(f"{log_prefix} [线程{thread_id}] {entity_type} 直接API调用失败，回退到Primavera库方法: {error_str[:200]}")
                                log_info(f"{log_prefix} [线程{thread_id}] {entity_type} 开始使用Primavera库读取（无Filter，可能较慢）...")
                                read_start_time = time.time()
                                if fields:
                                    p6_data_list = api_object.read(fields=fields)
                                else:
                                    p6_data_list = api_object.read()
                                read_duration = time.time() - read_start_time
                                log_info(f"{log_prefix} [线程{thread_id}] {entity_type} Primavera库读取完成: {len(p6_data_list)} 条，耗时: {read_duration:.2f} 秒")
                            else:
                                raise
                    else:
                        # 如果没有Filter，使用Primavera库的方法（性能可能稍好）
                        if fields:
                            p6_data_list = api_object.read(fields=fields)
                        else:
                            p6_data_list = api_object.read()
            except Exception as e:
                error_msg = str(e)
                if "Connection has been recycled" in error_msg or "timeout" in error_msg.lower():
                    log_error(f"{log_prefix} [线程{thread_id}] {entity_type} 数据库连接超时")
                    return {
                        "success": False,
                        "error": f"数据库连接超时: {error_msg[:200]}",
                        "count": 0
                    }
                raise
            
            # 处理返回数据
            if isinstance(p6_data_list, dict):
                if 'message' in p6_data_list:
                    return {
                        "success": False,
                        "error": p6_data_list.get('message'),
                        "count": 0
                    }
                p6_data_list = [p6_data_list] if p6_data_list else []
            
            if not isinstance(p6_data_list, list):
                p6_data_list = []
            
            read_duration = (datetime.now() - read_start).total_seconds()
            log_info(f"{log_prefix} [线程{thread_id}] {entity_type} 从API读取完成: {len(p6_data_list)} 条，耗时: {read_duration:.2f} 秒")
            
            # 流式处理：边过滤边放入队列
            count = 0
            filtered_count = 0
            log_info(f"{log_prefix} [线程{thread_id}] {entity_type} 开始流式处理数据...")
            
            # 调试：对于resource_assignment，打印第一条数据的字段
            debug_printed = False
            
            for idx, data in enumerate(p6_data_list):
                if not isinstance(data, dict):
                    continue
                
                # 调试：打印第一条resource_assignment数据的字段（仅一次）
                if entity_type.lower() == 'resource_assignment' and not debug_printed and idx == 0:
                    available_keys = list(data.keys())
                    log_info(f"{log_prefix} [线程{thread_id}] ResourceAssignment 第一条数据字段: {', '.join(sorted(available_keys))}")
                    log_info(f"{log_prefix} [线程{thread_id}] ResourceAssignment 第一条数据示例: ObjectId={data.get('ObjectId')}, RoleObjectId={data.get('RoleObjectId')}, 所有字段={dict(list(data.items())[:10])}")
                    debug_printed = True
                
                # 如果指定了项目，进行过滤
                if project_object_id:
                    p6_project_object_id = safe_get(data, 'ProjectObjectId')
                    try:
                        p6_project_object_id = int(p6_project_object_id) if p6_project_object_id else None
                        project_object_id_int = int(project_object_id) if project_object_id else None
                        if p6_project_object_id != project_object_id_int:
                            filtered_count += 1
                            continue
                    except (ValueError, TypeError):
                        pass
                
                # 将原始JSON数据放入队列（写入线程会在内存中处理）
                # 包含project_id和project_object_id信息，以便写入线程使用
                # 使用超时避免队列满时永久阻塞
                item = {
                    'json_data': data,
                    'project_id': project_id,  # 添加project_id
                    'project_object_id': project_object_id  # 添加project_object_id
                }
                
                # 放入队列（如果队列有大小限制，使用超时避免永久阻塞）
                # 对于无界队列，直接put即可
                try:
                    if data_queue.maxsize == 0:
                        # 无界队列，直接put
                        data_queue.put(item)
                    else:
                        # 有界队列，使用超时
                        data_queue.put(item, timeout=10)
                except:
                    # 如果超时，记录警告并重试（最多重试3次）
                    retry_count = 0
                    while retry_count < 3:
                        try:
                            data_queue.put(item, timeout=10)
                            break
                        except:
                            retry_count += 1
                            queue_size = data_queue.qsize()
                            log_info(f"{log_prefix} [线程{thread_id}] {entity_type} 队列可能已满（当前大小: {queue_size}/{data_queue.maxsize}），重试 {retry_count}/3...")
                            if retry_count >= 3:
                                log_error(f"{log_prefix} [线程{thread_id}] {entity_type} 队列满，无法放入数据，跳过该条数据")
                                continue
                
                count += 1
                
                # 每处理10万条输出一次进度
                if count % 100000 == 0:
                    queue_size = data_queue.qsize()
                    log_info(f"{log_prefix} [线程{thread_id}] {entity_type} 已处理 {count} / {len(p6_data_list)} 条（队列大小: {queue_size}）")
            
            if filtered_count > 0:
                log_info(f"{log_prefix} [线程{thread_id}] {entity_type} 过滤后保留 {count} 条（过滤掉 {filtered_count} 条）")
            
            log_info(f"{log_prefix} [线程{thread_id}] {entity_type} 处理完成，共 {count} 条数据放入队列")
            
            # 发送结束标记
            data_queue.put({'__done__': True})
            
            return {
                "success": True,
                "count": count,
                "filtered_count": filtered_count,
                "read_duration": read_duration
            }
            
        except Exception as e:
            thread_id = threading.current_thread().ident
            log_error(f"{log_prefix} [线程{thread_id}] 读取 {entity_type} 失败: {e}")
            import traceback
            log_error(traceback.format_exc())
            data_queue.put({'__done__': True})  # 即使失败也发送结束标记
            return {
                "success": False,
                "error": str(e),
                "count": 0
            }
    
    def _write_entity_worker(
        self,
        db: Session,
        entity_type: str,
        data_queue: Queue,
        stop_event: threading.Event,
        stats: Dict,
        project_id: Optional[str],
        project_object_id: Optional[int],
        log_prefix: str = ""
    ):
        """写入特定实体类型数据的worker（消费者）- 直接写入正式表"""
        thread_id = threading.current_thread().ident
        log_info(f"{log_prefix} [写入线程{thread_id}] {entity_type} 写入线程启动")
        
        # 为每个线程创建独立的数据库连接（避免并发冲突）
        from app.database import engine
        thread_db = Session(bind=engine)
        
        try:
            # 根据实体类型获取对应的处理函数
            transform_func = self._get_transform_function(entity_type)
            if not transform_func:
                log_error(f"{log_prefix} [写入线程{thread_id}] 不支持的实体类型: {entity_type}")
                return
            
            # 准备批量数据
            batch_data = []
            
            while True:
                # 从队列获取数据
                try:
                    item = data_queue.get(timeout=1)
                except:
                    if stop_event.is_set():
                        break
                    continue
                
                # 检查是否是结束标记
                if isinstance(item, dict) and item.get('__done__'):
                    data_queue.task_done()
                    # 继续处理，直到队列为空
                    if data_queue.empty():
                        break
                    continue
                
                # 在内存中处理JSON，转换为数据库记录
                try:
                    json_data = item['json_data']
                    transformed = transform_func(json_data, project_id, project_object_id)
                    if transformed:
                        batch_data.append(transformed)
                        # 记录object_id用于统计
                        object_id = transformed.get('object_id')
                        if object_id:
                            stats['api_object_ids'].add(object_id)
                    
                    # 达到批次大小时，批量写入
                    if len(batch_data) >= self.write_batch_size:
                        written = self._batch_insert_to_table(
                            thread_db, entity_type, batch_data
                        )
                        stats['total_written'] += written
                        batch_data = []  # 清空批次
                        
                        if stats['total_written'] % 50000 == 0:
                            log_info(f"{log_prefix} [写入线程{thread_id}] {entity_type} 已写入 {stats['total_written']} 条数据")
                    
                    data_queue.task_done()
                    
                except Exception as e:
                    log_error(f"{log_prefix} [写入线程{thread_id}] {entity_type} 处理数据失败: {e}")
                    stats['errors'].append(str(e))
                    data_queue.task_done()
            
            # 写入剩余数据
            if batch_data:
                # 检测剩余批次内重复的 object_id
                object_id_set = set()
                duplicate_count = 0
                for data in batch_data:
                    obj_id = data.get('object_id')
                    if obj_id in object_id_set:
                        duplicate_count += 1
                    else:
                        object_id_set.add(obj_id)
                
                if duplicate_count > 0:
                    log_info(f"[方案B] [{entity_type}] 警告：剩余批次内发现 {duplicate_count:,} 个重复的 object_id（可能由哈希冲突导致）")
                
                written = self._batch_insert_to_table(thread_db, entity_type, batch_data)
                stats['total_written'] += written
                
                if written < len(batch_data) and len(batch_data) > 10000:
                    log_info(f"[方案B] [{entity_type}] 警告：剩余批次尝试写入 {len(batch_data):,} 条，实际写入 {written:,} 条，差异 {len(batch_data) - written:,} 条")
                
                # 记录剩余批次中的object_id
                for data in batch_data:
                    object_id = data.get('object_id')
                    if object_id:
                        stats['api_object_ids'].add(object_id)
            
        finally:
            thread_db.close()
            log_info(f"{log_prefix} [写入线程{thread_id}] {entity_type} 写入线程完成，共写入 {stats['total_written']} 条数据")
    
    def _get_transform_function(self, entity_type: str):
        """获取实体类型的转换函数"""
        entity_type_lower = entity_type.lower()
        
        transform_map = {
            'eps': self._transform_eps,
            'project': self._transform_project,
            'wbs': self._transform_wbs,
            'activity': self._transform_activity,
            'activity_code': self._transform_activity_code,
            'activity_code_assignment': self._transform_activity_code_assignment,
            'resource': self._transform_resource,
            'resource_assignment': self._transform_resource_assignment,
        }
        
        return transform_map.get(entity_type_lower)
    
    def _transform_activity_code_assignment(
        self,
        json_data: Dict,
        project_id: Optional[str],
        project_object_id: Optional[int]
    ) -> Optional[Dict]:
        """转换ActivityCodeAssignment数据"""
        try:
            activity_object_id = safe_get(json_data, 'ActivityObjectId')
            activity_code_object_id = safe_get(json_data, 'ActivityCodeObjectId')
            
            if not activity_object_id or not activity_code_object_id:
                return None
            
            # object_id 将在插入后设置为自增主键 id（自然编号）
            # 插入时先设置为 0，插入后批量更新为 id
            # 这样可以完全避免哈希冲突，使用数据库的自然编号
            
            from app.p6_sync.utils import parse_date
            
            return {
                'object_id': 0,  # 临时值，插入后会被更新为 id
                'activity_object_id': activity_object_id,
                'activity_id': safe_get(json_data, 'ActivityId'),
                'activity_name': safe_get(json_data, 'ActivityName'),
                'project_object_id': safe_get(json_data, 'ProjectObjectId') or project_object_id,
                'project_id': project_id,
                'activity_code_type_object_id': safe_get(json_data, 'ActivityCodeTypeObjectId'),
                'activity_code_type_name': safe_get(json_data, 'ActivityCodeTypeName'),
                'activity_code_type_scope': safe_get(json_data, 'ActivityCodeTypeScope'),
                'activity_code_object_id': activity_code_object_id,
                'activity_code_value': safe_get(json_data, 'ActivityCodeValue'),
                'activity_code_description': safe_get(json_data, 'ActivityCodeDescription'),
                'p6_create_date': parse_date(safe_get(json_data, 'CreateDate')),
                'p6_last_update_date': parse_date(safe_get(json_data, 'LastUpdateDate')),
                'is_active': True,
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc),
                'last_sync_at': datetime.now(timezone.utc)
            }
        except Exception as e:
            log_error(f"转换ActivityCodeAssignment数据失败: {e}")
            return None
    
    def _transform_activity(
        self,
        json_data: Dict,
        project_id: Optional[str],
        project_object_id: Optional[int]
    ) -> Optional[Dict]:
        """转换Activity数据"""
        try:
            object_id = safe_get(json_data, 'ObjectId')
            if not object_id:
                return None
            
            from app.p6_sync.utils import parse_date, parse_boolean, parse_numeric
            
            # 直接从API获取WBS信息
            return {
                'object_id': int(object_id),
                'activity_id': safe_get(json_data, 'Id'),
                'name': safe_get(json_data, 'Name'),  # Activity模型使用name字段
                'project_object_id': safe_get(json_data, 'ProjectObjectId') or project_object_id,
                'project_id': safe_get(json_data, 'ProjectId') or project_id,
                'wbs_object_id': safe_get(json_data, 'WBSObjectId'),
                'wbs_id': safe_get(json_data, 'WBSCode'),  # 直接从API获取WBSCode作为wbs_id
                'wbs_code': safe_get(json_data, 'WBSCode'),
                'wbs_path': safe_get(json_data, 'WBSPath'),  # 从API获取WBSPath
                'start_date': parse_date(safe_get(json_data, 'StartDate')),
                'finish_date': parse_date(safe_get(json_data, 'FinishDate')),
                'planned_start_date': parse_date(safe_get(json_data, 'PlannedStartDate')),
                'planned_finish_date': parse_date(safe_get(json_data, 'PlannedFinishDate')),
                'actual_start_date': parse_date(safe_get(json_data, 'ActualStartDate')),
                'actual_finish_date': parse_date(safe_get(json_data, 'ActualFinishDate')),
                'baseline1_start_date': parse_date(safe_get(json_data, 'Baseline1StartDate')),
                'baseline1_finish_date': parse_date(safe_get(json_data, 'Baseline1FinishDate')),
                'baseline1_duration': parse_numeric(safe_get(json_data, 'Baseline1Duration')),
                'planned_duration': parse_numeric(safe_get(json_data, 'PlannedDuration')),
                'actual_duration': parse_numeric(safe_get(json_data, 'ActualDuration')),
                'at_completion_duration': parse_numeric(safe_get(json_data, 'AtCompletionDuration')),
                'data_date': parse_date(safe_get(json_data, 'DataDate')),
                'status_code': safe_get(json_data, 'StatusCode'),
                'type': safe_get(json_data, 'Type'),
                'is_critical': parse_boolean(safe_get(json_data, 'IsCritical')),
                'calendar_object_id': safe_get(json_data, 'CalendarObjectId'),
                'p6_create_date': parse_date(safe_get(json_data, 'CreateDate')),
                'p6_last_update_date': parse_date(safe_get(json_data, 'LastUpdateDate')),
                'is_active': True,
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc),
                'last_sync_at': datetime.now(timezone.utc)
            }
        except Exception as e:
            log_error(f"转换Activity数据失败: {e}")
            return None
    
    def _transform_resource_assignment(
        self,
        json_data: Dict,
        project_id: Optional[str],
        project_object_id: Optional[int]
    ) -> Optional[Dict]:
        """转换ResourceAssignment数据"""
        try:
            object_id = safe_get(json_data, 'ObjectId')
            if not object_id:
                return None
            
            # RoleObjectId在API规范中是必需的，但实际数据中可能为空
            # 如果为空，允许为NULL（数据库中允许为NULL）
            role_object_id = safe_get(json_data, 'RoleObjectId')
            
            # 如果字段不存在或值为空，设置为None（允许为NULL）
            if role_object_id is None or role_object_id == '':
                role_object_id = None
                # 仅记录前几条，避免日志过多
                if not hasattr(self, '_ra_null_role_count'):
                    self._ra_null_role_count = 0
                if self._ra_null_role_count < 3:
                    log_info(f"ResourceAssignment {object_id} 的 RoleObjectId 为空，将保存为NULL（这是正常的，实际数据中很多记录没有Role）")
                    self._ra_null_role_count += 1
            else:
                try:
                    role_object_id = int(role_object_id)
                except (ValueError, TypeError):
                    log_error(f"ResourceAssignment {object_id} 的 RoleObjectId 无效: {role_object_id}，将保存为NULL")
                    role_object_id = None
            
            
            from app.p6_sync.utils import parse_numeric, parse_date
            
            return {
                'object_id': int(object_id),
                'activity_object_id': safe_get(json_data, 'ActivityObjectId'),
                'activity_id': safe_get(json_data, 'ActivityId'),
                'activity_name': safe_get(json_data, 'ActivityName'),
                'resource_object_id': safe_get(json_data, 'ResourceObjectId'),
                'resource_id': safe_get(json_data, 'ResourceId'),
                'resource_name': safe_get(json_data, 'ResourceName'),
                'resource_type': safe_get(json_data, 'ResourceType'),
                'role_object_id': role_object_id,  # 允许为NULL（实际数据中可能为空）
                'project_object_id': safe_get(json_data, 'ProjectObjectId') or project_object_id,
                'project_id': safe_get(json_data, 'ProjectId') or project_id,
                'planned_units': parse_numeric(safe_get(json_data, 'PlannedUnits')),
                'actual_units': parse_numeric(safe_get(json_data, 'ActualUnits')),
                'remaining_units': parse_numeric(safe_get(json_data, 'RemainingUnits')),
                'at_completion_units': parse_numeric(safe_get(json_data, 'AtCompletionUnits')),
                'p6_create_date': parse_date(safe_get(json_data, 'CreateDate')),
                'p6_last_update_date': parse_date(safe_get(json_data, 'LastUpdateDate')),
                'is_active': True,
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc),
                'last_sync_at': datetime.now(timezone.utc)
            }
        except Exception as e:
            log_error(f"转换ResourceAssignment数据失败: {e}")
            return None
    
    def _transform_eps(
        self,
        json_data: Dict,
        project_id: Optional[str],
        project_object_id: Optional[int]
    ) -> Optional[Dict]:
        """转换EPS数据"""
        try:
            object_id = safe_get(json_data, 'ObjectId')
            if not object_id:
                return None
            
            return {
                'object_id': int(object_id),
                'eps_id': safe_get(json_data, 'Id'),
                'name': safe_get(json_data, 'Name'),
                'parent_object_id': safe_get(json_data, 'ParentObjectId'),
                'parent_eps_id': safe_get(json_data, 'ParentId'),
                'parent_eps_name': safe_get(json_data, 'ParentName'),
                'obs_object_id': safe_get(json_data, 'OBSObjectId'),
                'obs_name': safe_get(json_data, 'OBSName'),
                'is_active': True,
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc),
                'last_sync_at': datetime.now(timezone.utc)
            }
        except Exception as e:
            log_error(f"转换EPS数据失败: {e}")
            return None
    
    def _transform_project(
        self,
        json_data: Dict,
        project_id: Optional[str],
        project_object_id: Optional[int]
    ) -> Optional[Dict]:
        """转换Project数据"""
        try:
            object_id = safe_get(json_data, 'ObjectId')
            if not object_id:
                return None
            
            from app.p6_sync.utils import parse_date
            
            return {
                'object_id': int(object_id),
                'project_id': safe_get(json_data, 'Id'),
                'name': safe_get(json_data, 'Name'),
                'parent_eps_object_id': safe_get(json_data, 'ParentEPSObjectId'),
                'parent_eps_id': safe_get(json_data, 'ParentEPSId'),
                'parent_eps_name': safe_get(json_data, 'ParentEPSName'),
                'status': safe_get(json_data, 'Status'),
                'start_date': parse_date(safe_get(json_data, 'StartDate')),
                'finish_date': parse_date(safe_get(json_data, 'FinishDate')),
                'p6_create_date': parse_date(safe_get(json_data, 'CreateDate')),
                'p6_last_update_date': parse_date(safe_get(json_data, 'LastUpdateDate')),
                'is_active': True,
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc),
                'last_sync_at': datetime.now(timezone.utc)
            }
        except Exception as e:
            log_error(f"转换Project数据失败: {e}")
            return None
    
    def _transform_wbs(
        self,
        json_data: Dict,
        project_id: Optional[str],
        project_object_id: Optional[int]
    ) -> Optional[Dict]:
        """转换WBS数据"""
        try:
            object_id = safe_get(json_data, 'ObjectId')
            if not object_id:
                return None
            
            from app.p6_sync.utils import parse_date
            
            # 处理可能为NULL的整数字段：将空字符串转换为None
            parent_object_id = safe_get(json_data, 'ParentObjectId')
            if parent_object_id == '':
                parent_object_id = None
            elif parent_object_id is not None:
                try:
                    parent_object_id = int(parent_object_id)
                except (ValueError, TypeError):
                    parent_object_id = None
            
            return {
                'object_id': int(object_id),
                'name': safe_get(json_data, 'Name'),
                'code': safe_get(json_data, 'Code'),
                'project_object_id': safe_get(json_data, 'ProjectObjectId') or project_object_id,
                'project_id': safe_get(json_data, 'ProjectId') or project_id,
                'parent_object_id': parent_object_id,
                'p6_create_date': parse_date(safe_get(json_data, 'CreateDate')),
                'p6_last_update_date': parse_date(safe_get(json_data, 'LastUpdateDate')),
                'is_active': True,
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc),
                'last_sync_at': datetime.now(timezone.utc)
            }
        except Exception as e:
            log_error(f"转换WBS数据失败: {e}")
            return None
    
    def _transform_activity_code(
        self,
        json_data: Dict,
        project_id: Optional[str],
        project_object_id: Optional[int]
    ) -> Optional[Dict]:
        """转换ActivityCode数据"""
        try:
            object_id = safe_get(json_data, 'ObjectId')
            if not object_id:
                return None
            
            from app.p6_sync.utils import parse_date
            
            return {
                'object_id': int(object_id),
                'code_type_object_id': safe_get(json_data, 'CodeTypeObjectId'),
                'code_type_name': safe_get(json_data, 'CodeTypeName'),
                'code_type_scope': safe_get(json_data, 'CodeTypeScope'),
                'code_value': safe_get(json_data, 'CodeValue'),
                'sequence_number': safe_get(json_data, 'SequenceNumber'),
                'description': safe_get(json_data, 'Description'),
                'p6_create_date': parse_date(safe_get(json_data, 'CreateDate')),
                'p6_last_update_date': parse_date(safe_get(json_data, 'LastUpdateDate')),
                'is_active': True,
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc),
                'last_sync_at': datetime.now(timezone.utc)
            }
        except Exception as e:
            log_error(f"转换ActivityCode数据失败: {e}")
            return None
    
    def _transform_resource(
        self,
        json_data: Dict,
        project_id: Optional[str],
        project_object_id: Optional[int]
    ) -> Optional[Dict]:
        """转换Resource数据"""
        try:
            object_id = safe_get(json_data, 'ObjectId')
            if not object_id:
                return None
            
            from app.p6_sync.utils import parse_numeric, parse_date
            
            # UnitOfMeasure字段：优先使用UnitOfMeasureAbbreviation，如果没有则使用UnitOfMeasureName
            unit_of_measure = safe_get(json_data, 'UnitOfMeasureAbbreviation') or safe_get(json_data, 'UnitOfMeasureName')
            
            return {
                'object_id': int(object_id),
                'resource_id': safe_get(json_data, 'Id'),
                'name': safe_get(json_data, 'Name'),
                'resource_type': safe_get(json_data, 'ResourceType'),
                'unit_of_measure': unit_of_measure,
                'price_per_unit': parse_numeric(safe_get(json_data, 'PricePerUnit')),
                'calendar_object_id': safe_get(json_data, 'CalendarObjectId'),
                'p6_create_date': parse_date(safe_get(json_data, 'CreateDate')),
                'p6_last_update_date': parse_date(safe_get(json_data, 'LastUpdateDate')),
                'is_active': True,
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc),
                'last_sync_at': datetime.now(timezone.utc)
            }
        except Exception as e:
            log_error(f"转换Resource数据失败: {e}")
            return None
    
    def _clean_dataframe_for_load_data(self, df, columns: List[str]):
        """
        清理 DataFrame，确保所有 NULL 值字段正确转换为 None（pandas 会写入为 \\N）
        特别是处理 decimal 字段的空字符串问题
        """
        import pandas as pd
        
        # 定义日期时间字段列表（包括新增的P6时间字段）
        datetime_columns = ['created_at', 'updated_at', 'last_sync_at', 'start_date', 'finish_date',
                          'planned_start_date', 'planned_finish_date', 'actual_start_date', 'actual_finish_date',
                          'baseline1_start_date', 'baseline1_finish_date',
                          'p6_create_date', 'p6_last_update_date', 'data_date']
        
        # 定义允许NULL的decimal字段列表（这些字段的空值必须写入为\N，不能是空字符串）
        nullable_decimal_columns = [
            'planned_duration', 'actual_duration', 'at_completion_duration', 'baseline1_duration',
            'planned_units', 'actual_units', 'remaining_units', 'at_completion_units',
            'price_per_unit', 'planned_cost', 'actual_cost', 'remaining_cost', 'at_completion_cost'
        ]
        
        # 定义允许NULL的整数字段列表
        nullable_int_columns = [
            'role_object_id', 'wbs_object_id', 'calendar_object_id',
            'parent_object_id', 'obs_object_id', 'parent_eps_object_id',
        ]
        
        # 定义所有可能为NULL的整数字段
        all_nullable_int_columns = set(nullable_int_columns)
        required_int_columns = {
            'object_id', 'activity_object_id', 'project_object_id',
            'resource_object_id', 'activity_code_object_id', 'activity_code_type_object_id',
        }
        for col in df.columns:
            if col.endswith('_object_id') and col not in required_int_columns:
                all_nullable_int_columns.add(col)
        
        # 清理每个字段
        for col in df.columns:
            if col in ['is_active', 'is_critical']:
                # 布尔类型：转换为整数
                df[col] = df[col].apply(lambda x: 1 if x is True else (0 if x is False else None))
            elif col in datetime_columns:
                # 日期时间类型：将 None/NaN/空字符串 转换为 None
                df[col] = df[col].apply(lambda x: None if (x is None or x == '' or pd.isna(x)) else x)
            elif col in all_nullable_int_columns:
                # 允许NULL的整数字段：将 None/NaN/空字符串 转换为 None
                def convert_nullable_int(x):
                    if x is None or x == '' or pd.isna(x):
                        return None
                    if isinstance(x, str) and x.strip() == '':
                        return None
                    try:
                        return int(x) if x is not None else None
                    except (ValueError, TypeError):
                        return None
                df[col] = df[col].apply(convert_nullable_int)
            elif col in nullable_decimal_columns:
                # 允许NULL的decimal字段：将 None/NaN/空字符串 转换为 None
                def convert_nullable_decimal(x):
                    if x is None or x == '' or pd.isna(x):
                        return None
                    if isinstance(x, str) and x.strip() == '':
                        return None
                    try:
                        return float(x) if x is not None else None
                    except (ValueError, TypeError):
                        return None
                df[col] = df[col].apply(convert_nullable_decimal)
            elif df[col].dtype == 'object':  # 字符串类型
                # 将 None/NaN 转换为空字符串
                df[col] = df[col].fillna('')
            else:
                # 数值类型：将 NaN/空字符串 转换为 None
                def convert_numeric(x):
                    if x is None or x == '' or pd.isna(x):
                        return None
                    if isinstance(x, str) and x.strip() == '':
                        return None
                    return x
                df[col] = df[col].apply(convert_numeric)
        
        return df
    
    def _batch_insert_to_table(
        self,
        db: Session,
        entity_type: str,
        batch_data: List[Dict]
    ) -> int:
        """
        批量插入数据到正式表（使用 LOAD DATA LOCAL INFILE）
        
        性能策略：
        1. 使用 pandas/numpy 将数据转换为 CSV
        2. 处理特殊字符转义（换行、逗号、引号等）
        3. 使用 LOAD DATA LOCAL INFILE 加载 CSV 文件（最快）
        4. MySQL会话优化 - 禁用检查
        """
        from sqlalchemy import text
        import tempfile
        import os
        import pandas as pd
        import numpy as np

        # 根据实体类型获取表名和字段
        table_info = self._get_table_info(entity_type)
        if not table_info:
            return 0

        table_name = table_info['table_name']
        columns = table_info['columns']

        # 获取原始连接
        raw_connection = db.connection().connection
        cursor = None
        temp_file_path = None

        try:
            cursor = raw_connection.cursor()
            
            # MySQL会话优化
            cursor.execute("SET SESSION unique_checks = 0")
            cursor.execute("SET SESSION foreign_key_checks = 0")
            try:
                cursor.execute("SET SESSION sql_log_bin = 0")
            except:
                pass
            cursor.execute("SET SESSION autocommit = 0")
            # 注意：local_infile 是 GLOBAL 变量，已在服务器配置，不需要在会话中设置
            
            if not batch_data:
                return 0
            
            # 判断是否是清空重建模式（通过命令行参数，而不是批次大小）
            import sys
            is_clean_rebuild = '--clear' in sys.argv
            
            # 对于大批次（>10万条），在写入前查询当前记录数（用于验证实际插入数）
            count_before = None
            if is_clean_rebuild and len(batch_data) > 100000:
                try:
                    cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                    count_before = cursor.fetchone()[0]
                    if count_before > 0:
                        log_info(f"[LOAD DATA] {entity_type} 写入前表中有 {count_before:,} 条记录（清空重建模式下应该为 0）")
                except:
                    pass
            
            # 对于 activity_code_assignment，所有记录的 object_id 都是 0（unique=True）
            # 在插入前，需要为每条记录分配临时唯一值（负数序列），避免唯一键冲突
            # 插入后批量更新为 id（自增主键）
            if entity_type == 'activity_code_assignment':
                # 为每条记录分配临时唯一值（从 -1 开始递减）
                for idx, data in enumerate(batch_data):
                    data['object_id'] = -(idx + 1)  # 使用负数作为临时唯一值
            
            # 使用 pandas 将数据转换为 DataFrame
            # 确保列顺序与 columns 一致
            data_dict = {}
            for col in columns:
                # 从每条数据中获取该字段的值，如果不存在则返回 None
                # 注意：data.get(col) 如果字段不存在会返回 None，这正是我们想要的
                data_dict[col] = [data.get(col) for data in batch_data]
            
            df = pd.DataFrame(data_dict, columns=columns)
            
            # 处理特殊字符：将 None/NaN 转换为 MySQL 的 NULL 表示（\N）
            # 使用辅助方法清理 DataFrame，确保所有 NULL 值字段正确转换
            df = self._clean_dataframe_for_load_data(df, columns)
            
            # 创建临时 CSV 文件
            temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8')
            temp_file_path = temp_file.name
            temp_file.close()
            
            # 写入 CSV 文件
            # 注意：MySQL LOAD DATA 使用 OPTIONALLY ENCLOSED BY '"' 时，双引号会被转义为两个双引号（""）
            # pandas 的 doublequote=True 正好匹配这个行为
            # 不使用 ESCAPED BY，让 MySQL 使用默认行为（双引号转义）
            # 修复：使用线程锁保护 to_csv 操作，避免 Python 3.14 多线程执行缓存问题
            import csv
            # 对于 NULL 值：
            # - 日期时间字段：使用 \N（MySQL 的 NULL 表示）
            # - 其他字段：使用空字符串（MySQL 会将其视为 NULL 或空字符串，取决于列定义）
            # 注意：pandas 的 na_rep='\\N' 会将 None 值写入为 \N，MySQL LOAD DATA 会识别为 NULL
            with self._csv_write_lock:
                df.to_csv(temp_file_path, index=False, header=False, sep=',', quotechar='"', 
                         doublequote=True, escapechar=None, na_rep='\\N', lineterminator='\n',
                         quoting=csv.QUOTE_MINIMAL)
            
            # 验证 CSV 文件行数（调试用）
            csv_line_count = 0
            try:
                with open(temp_file_path, 'r', encoding='utf-8') as f:
                    csv_line_count = sum(1 for _ in f)
                if csv_line_count != len(batch_data):
                    log_info(f"[LOAD DATA] {entity_type} CSV 文件行数验证：期望 {len(batch_data):,} 行，实际 {csv_line_count:,} 行")
            except Exception as e:
                log_error(f"[LOAD DATA] {entity_type} 验证 CSV 文件行数失败: {e}")
            
            # 判断使用 REPLACE INTO 还是 INSERT
            column_names = ', '.join(columns)
            
            # 处理 Windows 路径：将反斜杠转换为正斜杠
            # MySQL 的 LOAD DATA LOCAL INFILE 需要正斜杠
            file_path_for_sql = temp_file_path.replace('\\', '/')
            
            if is_clean_rebuild:
                # 对于 activity_code_assignment，object_id 已设置为临时唯一值（负数序列）
                # 所以可以使用普通的 INSERT（表已清空，不会有冲突）
                if entity_type == 'activity_code_assignment':
                    load_sql = f"""LOAD DATA LOCAL INFILE '{file_path_for_sql}'
INTO TABLE {table_name}
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\\n'
({column_names})"""
                    log_info(f"[LOAD DATA] {entity_type} 使用 INSERT（清空重建，object_id 使用临时唯一值），CSV 文件：{csv_line_count:,} 行")
                else:
                    # 其他实体类型使用 REPLACE INTO
                    load_sql = f"""LOAD DATA LOCAL INFILE '{file_path_for_sql}'
REPLACE INTO TABLE {table_name}
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\\n'
({column_names})"""
                    log_info(f"[LOAD DATA] {entity_type} 使用 REPLACE INTO（清空重建，确保所有数据写入），CSV 文件：{csv_line_count:,} 行")
                
                # 执行 LOAD DATA LOCAL INFILE（清空重建模式）
                try:
                    cursor.execute(load_sql)
                    raw_connection.commit()
                    log_info(f"[LOAD DATA] {entity_type} 已执行 LOAD DATA，CSV 文件：{csv_line_count:,} 行")
                except Exception as e:
                    log_error(f"[LOAD DATA] {entity_type} 执行 LOAD DATA 失败: {e}")
                    log_error(f"[LOAD DATA] {entity_type} SQL: {load_sql[:200]}...")
                    # 尝试读取 CSV 文件的前几行用于调试
                    try:
                        with open(temp_file_path, 'r', encoding='utf-8') as f:
                            first_lines = [f.readline() for _ in range(3)]
                            log_error(f"[LOAD DATA] {entity_type} CSV 文件前3行示例:\n{''.join(first_lines)}")
                    except:
                        pass
                    raise
            else:
                # 增量更新模式
                if entity_type == 'activity_code_assignment':
                    # activity_code_assignment需要基于组合键去重
                    # 1. 先查询数据库中已存在的组合键
                    # 2. 对于已存在的，使用UPDATE；对于不存在的，使用INSERT
                    
                    log_info(f"[LOAD DATA] {entity_type} 增量模式：基于组合键去重处理...")
                    
                    # 从batch_data中提取组合键
                    incoming_composite_keys = set()
                    data_by_key = {}  # 组合键 -> 数据字典
                    for data in batch_data:
                        key = (
                            data.get('activity_object_id'),
                            data.get('project_object_id'),
                            data.get('activity_code_type_object_id'),
                            data.get('activity_code_object_id')
                        )
                        if all(k is not None for k in key):
                            incoming_composite_keys.add(key)
                            data_by_key[key] = data
                    
                    if not incoming_composite_keys:
                        log_info(f"[LOAD DATA] {entity_type} 没有有效的组合键数据，跳过写入")
                        return 0
                    
                    # 查询数据库中已存在的组合键（只查询当前批次涉及的组合键）
                    # 构建IN查询条件（分批处理，避免SQL过长）
                    existing_keys = set()
                    batch_size_for_query = 1000
                    key_list = list(incoming_composite_keys)
                    
                    for i in range(0, len(key_list), batch_size_for_query):
                        batch_keys = key_list[i:i+batch_size_for_query]
                        conditions = []
                        params = []
                        for key in batch_keys:
                            conditions.append("(activity_object_id = %s AND project_object_id = %s AND activity_code_type_object_id = %s AND activity_code_object_id = %s)")
                            params.extend([key[0], key[1], key[2], key[3]])
                        
                        where_clause = " OR ".join(conditions)
                        query_sql = f"""
                            SELECT activity_object_id, project_object_id, activity_code_type_object_id, activity_code_object_id 
                            FROM {table_name} 
                            WHERE ({where_clause}) AND is_active = 1
                        """
                        cursor.execute(query_sql, params)
                        existing_rows = cursor.fetchall()
                        for row in existing_rows:
                            existing_keys.add((int(row[0]), int(row[1]), int(row[2]), int(row[3])))
                    
                    # 分离需要UPDATE和INSERT的记录（使用集合操作，很快）
                    keys_to_update = incoming_composite_keys & existing_keys
                    keys_to_insert = incoming_composite_keys - existing_keys
                    
                    log_info(f"[LOAD DATA] {entity_type} 组合键统计：总 {len(incoming_composite_keys)}, 需更新 {len(keys_to_update)}, 需插入 {len(keys_to_insert)}")
                    
                    # 批量UPDATE已存在的记录（使用临时表+JOIN UPDATE，替代逐条UPDATE）
                    if keys_to_update:
                        # 创建临时表用于批量UPDATE
                        temp_table_name = f"temp_{entity_type}_update_{int(time.time())}"
                        temp_table_columns = ', '.join(columns)
                        
                        # 创建临时表（结构与正式表相同）
                        create_temp_sql = f"""
                            CREATE TEMPORARY TABLE {temp_table_name} LIKE {table_name}
                        """
                        cursor.execute(create_temp_sql)
                        
                        # 准备UPDATE数据（只包含需要更新的记录）
                        update_data = [data_by_key[key] for key in keys_to_update]
                        
                        # 为每条记录分配临时唯一值（负数序列）
                        for idx, data in enumerate(update_data):
                            data['object_id'] = -(idx + 1)
                        
                        # 生成临时CSV文件（只包含需要UPDATE的记录）
                        update_df = pd.DataFrame(update_data, columns=columns)
                        # 清理 DataFrame，确保所有 NULL 值字段正确转换
                        update_df = self._clean_dataframe_for_load_data(update_df, columns)
                        temp_update_file = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8')
                        temp_update_file_path = temp_update_file.name
                        temp_update_file.close()
                        
                        update_df.to_csv(temp_update_file_path, index=False, header=False, sep=',', quotechar='"', 
                                       doublequote=True, escapechar=None, na_rep='\\N', lineterminator='\n',
                                       quoting=csv.QUOTE_MINIMAL)
                        
                        # 将数据加载到临时表
                        temp_update_file_path_for_sql = temp_update_file_path.replace('\\', '/')
                        load_temp_sql = f"""LOAD DATA LOCAL INFILE '{temp_update_file_path_for_sql}'
INTO TABLE {temp_table_name}
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\\n'
({temp_table_columns})"""
                        cursor.execute(load_temp_sql)
                        
                        # 构建UPDATE字段列表（排除组合键和id、object_id）
                        update_fields_list = []
                        for col in columns:
                            if col not in ['activity_object_id', 'project_object_id', 'activity_code_type_object_id', 'activity_code_object_id', 'id', 'object_id']:
                                update_fields_list.append(f"t.{col} = u.{col}")
                        
                        # 批量UPDATE（使用JOIN，一次SQL完成所有更新）
                        update_sql = f"""
                            UPDATE {table_name} t
                            JOIN {temp_table_name} u ON (
                                t.activity_object_id = u.activity_object_id AND
                                t.project_object_id = u.project_object_id AND
                                t.activity_code_type_object_id = u.activity_code_type_object_id AND
                                t.activity_code_object_id = u.activity_code_object_id
                            )
                            SET {', '.join(update_fields_list)}, t.updated_at = NOW(), t.last_sync_at = NOW()
                            WHERE t.is_active = 1
                        """
                        cursor.execute(update_sql)
                        update_count = cursor.rowcount
                        
                        # 删除临时表
                        cursor.execute(f"DROP TEMPORARY TABLE {temp_table_name}")
                        
                        # 删除临时文件
                        try:
                            if os.path.exists(temp_update_file_path):
                                os.unlink(temp_update_file_path)
                        except:
                            pass
                        
                        raw_connection.commit()
                        log_info(f"[LOAD DATA] {entity_type} 已批量更新 {update_count} 条记录（使用临时表+JOIN UPDATE）")
                    
                    # 再INSERT新记录
                    if keys_to_insert:
                        # 准备INSERT的数据
                        insert_data = [data_by_key[key] for key in keys_to_insert]
                        
                        # 为每条记录分配临时唯一值（负数序列）
                        for idx, data in enumerate(insert_data):
                            data['object_id'] = -(idx + 1)
                        
                        # 重新生成CSV文件（只包含需要INSERT的记录）
                        insert_df = pd.DataFrame([data_by_key[key] for key in keys_to_insert], columns=columns)
                        # 清理 DataFrame，确保所有 NULL 值字段正确转换
                        insert_df = self._clean_dataframe_for_load_data(insert_df, columns)
                        insert_df.to_csv(temp_file_path, index=False, header=False, sep=',', quotechar='"', 
                                       doublequote=True, escapechar=None, na_rep='\\N', lineterminator='\n',
                                       quoting=csv.QUOTE_MINIMAL)
                        
                        # 执行INSERT
                        load_sql = f"""LOAD DATA LOCAL INFILE '{file_path_for_sql}'
INTO TABLE {table_name}
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\\n'
({column_names})"""
                        cursor.execute(load_sql)
                        raw_connection.commit()
                        log_info(f"[LOAD DATA] {entity_type} 已插入 {len(keys_to_insert)} 条新记录")
                    
                    # 更新object_id = id（对于新插入的记录）
                    if keys_to_insert:
                        update_sql = f"UPDATE {table_name} SET object_id = id WHERE object_id < 0"
                        cursor.execute(update_sql)
                        raw_connection.commit()
                    
                    actual_inserted = len(keys_to_insert) + len(keys_to_update)
                else:
                    # 其他实体类型（有ObjectId）：使用 REPLACE INTO（自动处理主键冲突）
                    # REPLACE INTO 会先删除已存在的记录，然后插入新记录，性能比逐条UPDATE快很多
                    load_sql = f"""LOAD DATA LOCAL INFILE '{file_path_for_sql}'
REPLACE INTO TABLE {table_name}
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\\n'
({column_names})"""
                    
                    log_info(f"[LOAD DATA] {entity_type} 使用 REPLACE INTO（自动处理主键冲突），CSV 文件：{csv_line_count:,} 行")
                    
                    # 执行 LOAD DATA LOCAL INFILE
                    try:
                        cursor.execute(load_sql)
                        raw_connection.commit()
                        log_info(f"[LOAD DATA] {entity_type} 已执行 REPLACE INTO，CSV 文件：{csv_line_count:,} 行")
                    except Exception as e:
                        log_error(f"[LOAD DATA] {entity_type} 执行 LOAD DATA 失败: {e}")
                        log_error(f"[LOAD DATA] {entity_type} SQL: {load_sql[:200]}...")
                        # 尝试读取 CSV 文件的前几行用于调试
                        try:
                            with open(temp_file_path, 'r', encoding='utf-8') as f:
                                first_lines = [f.readline() for _ in range(3)]
                                log_error(f"[LOAD DATA] {entity_type} CSV 文件前3行示例:\n{''.join(first_lines)}")
                        except:
                            pass
                        raise
                    
                    # 对于非activity_code_assignment，使用rowcount或COUNT查询
                    try:
                        cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                        count_after = cursor.fetchone()[0]
                        if count_before is not None:
                            actual_inserted = count_after - count_before
                        else:
                            actual_inserted = len(batch_data)  # 无法准确计算，使用尝试插入数
                    except:
                        actual_inserted = len(batch_data)
            
            # 对于activity_code_assignment，如果使用了组合键去重，actual_inserted已经在上面计算了
            if entity_type != 'activity_code_assignment' or is_clean_rebuild:
                # 对于所有批次，都使用 COUNT(*) 查询来验证实际插入数（LOAD DATA 的 rowcount 不准确）
                try:
                    cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                    count_after = cursor.fetchone()[0]
                    if count_before is not None:
                        actual_inserted = count_after - count_before
                        if actual_inserted < len(batch_data):
                            log_info(f"[LOAD DATA] {entity_type} 验证：尝试插入 {len(batch_data):,} 条，实际插入 {actual_inserted:,} 条，差异 {len(batch_data) - actual_inserted:,} 条（可能因数据验证失败被跳过）")
                        elif actual_inserted > len(batch_data):
                            log_info(f"[LOAD DATA] {entity_type} 异常：尝试插入 {len(batch_data):,} 条，实际插入 {actual_inserted:,} 条（可能之前有残留数据）")
                    else:
                        # 如果无法获取写入前数量，使用写入后数量（仅第一个批次）
                        actual_inserted = count_after
                        if actual_inserted < len(batch_data):
                            log_info(f"[LOAD DATA] {entity_type} 验证：尝试插入 {len(batch_data):,} 条，实际数据库记录 {actual_inserted:,} 条，差异 {len(batch_data) - actual_inserted:,} 条")
                except Exception as e:
                    log_error(f"[LOAD DATA] {entity_type} 验证实际插入数失败: {e}")
                    # 回退到使用 rowcount（不准确，但总比没有好）
                    affected_rows = cursor.rowcount
                    actual_inserted = affected_rows if affected_rows > 0 else len(batch_data)
                    log_info(f"[LOAD DATA] {entity_type} 警告：使用 rowcount={affected_rows:,}，尝试插入 {len(batch_data):,} 条")
            
            # 对于 activity_code_assignment，插入后更新 object_id = id（自然编号）
            # 注意：只在清空重建模式下需要更新（增量模式下已经在上面处理了）
            if entity_type == 'activity_code_assignment' and is_clean_rebuild:
                try:
                    # 批量更新：将 object_id 设置为 id（自增主键）
                    # 更新所有 object_id < 0 的记录（临时负数）为 id
                    update_sql = f"UPDATE {table_name} SET object_id = id WHERE object_id < 0"
                    cursor.execute(update_sql)
                    updated_count = cursor.rowcount
                    raw_connection.commit()
                    if updated_count > 0:
                        log_info(f"[LOAD DATA] {entity_type} 已将 {updated_count:,} 条记录的 object_id 更新为 id")
                    else:
                        log_info(f"[LOAD DATA] {entity_type} 警告：没有找到需要更新的记录（object_id < 0）")
                except Exception as e:
                    log_error(f"[LOAD DATA] {entity_type} 更新 object_id = id 失败: {e}")
                    import traceback
                    log_error(traceback.format_exc())
            
            # 对于 activity_code_assignment，插入后更新 object_id = id（自然编号）
            # 注意：无论 actual_inserted 是多少，都执行更新（因为可能有数据插入但 rowcount 不准确）
            if entity_type == 'activity_code_assignment':
                try:
                    # 批量更新：将 object_id 设置为 id（自增主键）
                    # 更新所有 object_id < 0 的记录（临时负数）为 id
                    update_sql = f"UPDATE {table_name} SET object_id = id WHERE object_id < 0"
                    cursor.execute(update_sql)
                    updated_count = cursor.rowcount
                    raw_connection.commit()
                    if updated_count > 0:
                        log_info(f"[LOAD DATA] {entity_type} 已将 {updated_count:,} 条记录的 object_id 更新为 id")
                    else:
                        log_info(f"[LOAD DATA] {entity_type} 警告：没有找到需要更新的记录（object_id < 0）")
                except Exception as e:
                    log_error(f"[LOAD DATA] {entity_type} 更新 object_id = id 失败: {e}")
                    import traceback
                    log_error(traceback.format_exc())
            
            # 恢复MySQL会话设置
            cursor.execute("SET SESSION unique_checks = 1")
            cursor.execute("SET SESSION foreign_key_checks = 1")
            try:
                cursor.execute("SET SESSION sql_log_bin = 1")
            except:
                pass
            cursor.execute("SET SESSION autocommit = 1")
            
            if cursor:
                cursor.close()
            
            # 删除临时文件
            try:
                if temp_file_path and os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
            except:
                pass

            return actual_inserted

        except Exception as e:
            log_error(f"[LOAD DATA] {entity_type} 失败: {e}")
            import traceback
            log_error(traceback.format_exc())
            try:
                raw_connection.rollback()
                if cursor:
                    try:
                        cursor.execute("SET SESSION unique_checks = 1")
                        cursor.execute("SET SESSION foreign_key_checks = 1")
                        cursor.execute("SET SESSION sql_log_bin = 1")
                        cursor.execute("SET SESSION autocommit = 1")
                    except:
                        pass
            except:
                pass
            finally:
                if cursor:
                    cursor.close()
                # 删除临时文件
                try:
                    if temp_file_path and os.path.exists(temp_file_path):
                        os.unlink(temp_file_path)
                except:
                    pass
            return 0
    
    def _get_table_info(self, entity_type: str) -> Optional[Dict]:
        """获取实体类型对应的表信息"""
        entity_type_lower = entity_type.lower()
        
        table_info_map = {
            'eps': {
                'table_name': 'p6_eps',
                'primary_keys': ['object_id'],
                'columns': [
                    'object_id', 'eps_id', 'name',
                    'parent_object_id', 'parent_eps_id', 'parent_eps_name',
                    'obs_object_id', 'obs_name',
                    'p6_create_date', 'p6_last_update_date',
                    'is_active', 'created_at', 'updated_at', 'last_sync_at'
                ]
            },
            'project': {
                'table_name': 'p6_projects',
                'primary_keys': ['object_id'],
                'columns': [
                    'object_id', 'project_id', 'name',
                    'parent_eps_object_id', 'parent_eps_id', 'parent_eps_name',
                    'status', 'start_date', 'finish_date',
                    'p6_create_date', 'p6_last_update_date',
                    'is_active', 'created_at', 'updated_at', 'last_sync_at'
                ]
            },
            'wbs': {
                'table_name': 'p6_wbs',
                'primary_keys': ['object_id'],
                'columns': [
                    'object_id', 'name', 'code',
                    'project_object_id', 'project_id',
                    'parent_object_id',
                    'p6_create_date', 'p6_last_update_date',
                    'is_active', 'created_at', 'updated_at', 'last_sync_at'
                ]
            },
            'activity': {
                'table_name': 'p6_activities',
                'primary_keys': ['object_id'],
                'columns': [
                    'object_id', 'activity_id', 'name',
                    'project_object_id', 'project_id',
                    'wbs_object_id', 'wbs_id', 'wbs_code', 'wbs_path',
                    'start_date', 'finish_date',
                    'planned_start_date', 'planned_finish_date',
                    'actual_start_date', 'actual_finish_date',
                    'baseline1_start_date', 'baseline1_finish_date', 'baseline1_duration',
                    'planned_duration', 'actual_duration', 'at_completion_duration',
                    'data_date',
                    'status_code', 'type', 'is_critical', 'calendar_object_id',
                    'p6_create_date', 'p6_last_update_date',
                    'is_active', 'created_at', 'updated_at', 'last_sync_at'
                ]
            },
            'activity_code': {
                'table_name': 'p6_activity_codes',
                'primary_keys': ['object_id'],
                'columns': [
                    'object_id', 'code_type_object_id', 'code_type_name', 'code_type_scope',
                    'code_value', 'sequence_number', 'description',
                    'p6_create_date', 'p6_last_update_date',
                    'is_active', 'created_at', 'updated_at', 'last_sync_at'
                ]
            },
            'activity_code_assignment': {
                'table_name': 'p6_activity_code_assignments',
                'primary_keys': ['activity_object_id', 'activity_code_object_id'],
                'columns': [
                    'object_id', 'activity_object_id', 'activity_id', 'activity_name',
                    'project_object_id', 'project_id',
                    'activity_code_type_object_id', 'activity_code_type_name', 'activity_code_type_scope',
                    'activity_code_object_id', 'activity_code_value', 'activity_code_description',
                    'p6_create_date', 'p6_last_update_date',
                    'is_active', 'created_at', 'updated_at', 'last_sync_at'
                ]
            },
            'resource': {
                'table_name': 'p6_resources',
                'primary_keys': ['object_id'],
                'columns': [
                    'object_id', 'resource_id', 'name', 'resource_type',
                    'unit_of_measure', 'price_per_unit', 'calendar_object_id',
                    'p6_create_date', 'p6_last_update_date',
                    'is_active', 'created_at', 'updated_at', 'last_sync_at'
                ]
            },
            'resource_assignment': {
                'table_name': 'p6_resource_assignments',
                'primary_keys': ['object_id'],
                'columns': [
                    'object_id', 'activity_object_id', 'activity_id', 'activity_name',
                    'resource_object_id', 'resource_id', 'resource_name', 'resource_type',
                    'role_object_id', 'project_object_id', 'project_id',
                    'planned_units', 'actual_units', 'remaining_units', 'at_completion_units',
                    'p6_create_date', 'p6_last_update_date',
                    'is_active', 'created_at', 'updated_at', 'last_sync_at'
                ]
            }
        }
        
        return table_info_map.get(entity_type_lower)
    
    def _create_entity_temp_table(self, db: Session, temp_table_name: str, table_info: Dict):
        """创建实体类型的临时表（根据表信息）- 使用Session"""
        from sqlalchemy import text
        
        try:
            db.execute(text(f"DROP TEMPORARY TABLE IF EXISTS {temp_table_name}"))
            db.commit()
        except:
            pass
        
        columns = table_info['columns']
        primary_keys = table_info['primary_keys']
        
        # 根据列名推断类型（简化处理，实际应该根据模型定义）
        column_defs = []
        for col in columns:
            if col in ['object_id', 'activity_object_id', 'project_object_id', 'wbs_object_id', 
                      'activity_code_object_id', 'activity_code_type_object_id',
                      'resource_object_id', 'calendar_object_id']:
                column_defs.append(f"{col} INT")
            elif col == 'role_object_id':
                # role_object_id 允许为 NULL
                column_defs.append(f"{col} INT NULL")
            elif col in ['is_active', 'is_critical']:
                column_defs.append(f"{col} BOOLEAN DEFAULT TRUE")
            elif col in ['created_at', 'updated_at', 'last_sync_at', 'start_date', 'finish_date',
                        'planned_start_date', 'planned_finish_date', 'actual_start_date', 'actual_finish_date',
                        'p6_create_date', 'p6_last_update_date', 'data_date']:
                column_defs.append(f"{col} DATETIME")
            elif col in ['planned_duration', 'actual_duration', 'at_completion_duration', 'baseline1_duration',
                        'planned_units', 'actual_units', 'remaining_units', 'at_completion_units']:
                column_defs.append(f"{col} DECIMAL(20, 6)")
            elif col in ['activity_id', 'project_id', 'wbs_code', 'wbs_id', 'status_code', 'type',
                        'activity_code_type_name', 'activity_code_type_scope', 'activity_code_value',
                        'resource_id', 'resource_type']:
                column_defs.append(f"{col} VARCHAR(200)")
            elif col in ['activity_name', 'resource_name', 'wbs_path']:
                column_defs.append(f"{col} TEXT")
            else:
                column_defs.append(f"{col} TEXT")
        
        primary_key_def = f"PRIMARY KEY ({', '.join(primary_keys)})"
        
        create_sql = f"""
        CREATE TEMPORARY TABLE {temp_table_name} (
            {', '.join(column_defs)},
            {primary_key_def}
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """
        
        db.execute(text(create_sql))
        db.commit()
    
    def _create_entity_temp_table_raw(self, raw_connection, temp_table_name: str, table_info: Dict):
        """创建实体类型的临时表（根据表信息）- 使用原始连接"""
        columns = table_info['columns']
        primary_keys = table_info['primary_keys']
        
        # 根据列名推断类型（简化处理，实际应该根据模型定义）
        column_defs = []
        for col in columns:
            if col in ['object_id', 'activity_object_id', 'project_object_id', 'wbs_object_id', 
                      'activity_code_object_id', 'activity_code_type_object_id',
                      'resource_object_id', 'calendar_object_id']:
                column_defs.append(f"{col} INT")
            elif col == 'role_object_id':
                # role_object_id 允许为 NULL
                column_defs.append(f"{col} INT NULL")
            elif col in ['is_active', 'is_critical']:
                column_defs.append(f"{col} BOOLEAN DEFAULT TRUE")
            elif col in ['created_at', 'updated_at', 'last_sync_at', 'start_date', 'finish_date',
                        'planned_start_date', 'planned_finish_date', 'actual_start_date', 'actual_finish_date',
                        'p6_create_date', 'p6_last_update_date', 'data_date']:
                column_defs.append(f"{col} DATETIME")
            elif col in ['planned_duration', 'actual_duration', 'at_completion_duration', 'baseline1_duration',
                        'planned_units', 'actual_units', 'remaining_units', 'at_completion_units']:
                column_defs.append(f"{col} DECIMAL(20, 6)")
            elif col in ['activity_id', 'project_id', 'wbs_code', 'wbs_id', 'status_code', 'type',
                        'activity_code_type_name', 'activity_code_type_scope', 'activity_code_value',
                        'resource_id', 'resource_type']:
                column_defs.append(f"{col} VARCHAR(200)")
            elif col in ['activity_name', 'resource_name', 'wbs_path']:
                column_defs.append(f"{col} TEXT")
            else:
                column_defs.append(f"{col} TEXT")
        
        primary_key_def = f"PRIMARY KEY ({', '.join(primary_keys)})"
        
        create_sql = f"""
        CREATE TEMPORARY TABLE {temp_table_name} (
            {', '.join(column_defs)},
            {primary_key_def}
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """
        
        try:
            drop_cursor = raw_connection.cursor()
            drop_cursor.execute(f"DROP TEMPORARY TABLE IF EXISTS {temp_table_name}")
            raw_connection.commit()
            drop_cursor.close()
        except:
            pass
        
        create_cursor = raw_connection.cursor()
        create_cursor.execute(create_sql)
        raw_connection.commit()
        create_cursor.close()
    
    def _get_api_object(self, entity_type: str):
        """获取P6 API对象"""
        entity_type_lower = entity_type.lower()
        
        api_map = {
            'eps': self.p6_service.get_eps,  # EPS使用特殊方法
            'project': self.p6_service.app.project,
            'wbs': self.p6_service.app.wbs,
            'activity': self.p6_service.app.activity,
            'activity_code': self.p6_service.app.activityCode,
            'activity_code_assignment': self.p6_service.app.activityCodeAssignment,
            'resource': self.p6_service.app.resource,
            'resource_assignment': self.p6_service.app.resourceAssignment,
        }
        
        return api_map.get(entity_type_lower)
    
    def _get_default_fields(self, entity_type: str) -> List[str]:
        """获取默认字段列表"""
        entity_type_lower = entity_type.lower()
        
        fields_map = {
            'eps': [
                'ObjectId', 'Id', 'Name', 'ParentObjectId', 'ParentId', 'ParentName',
                'OBSObjectId', 'OBSName'
            ],
            'project': [
                'ObjectId', 'Id', 'Name', 'ParentEPSObjectId', 'ParentEPSId', 'ParentEPSName',
                'Status', 'StartDate', 'FinishDate'
            ],
            'wbs': [
                'ObjectId', 'Name', 'Code', 'ProjectObjectId', 'ProjectId', 'ParentObjectId',
                'CreateDate', 'LastUpdateDate'  # 添加P6的时间字段，用于增量同步
            ],
            'activity': [
                'ObjectId', 'Id', 'Name', 'ProjectObjectId', 'ProjectId',
                'WBSObjectId', 'WBSCode', 'WBSPath', 'WBSName', 'WBSNamePath',
                'StartDate', 'FinishDate',
                'PlannedStartDate', 'PlannedFinishDate', 'ActualStartDate', 'ActualFinishDate',
                'Baseline1StartDate', 'Baseline1FinishDate', 'Baseline1Duration',
                'PlannedDuration', 'ActualDuration', 'AtCompletionDuration',
                'StatusCode', 'Type', 'IsCritical', 'CalendarObjectId',
                'DataDate', 'CreateDate', 'LastUpdateDate'  # 添加P6的时间字段和DataDate
            ],
            'activity_code': [
                'ObjectId', 'CodeTypeObjectId', 'CodeTypeName', 'CodeTypeScope',
                'CodeValue', 'SequenceNumber', 'Description'
            ],
            'activity_code_assignment': [
                'ActivityObjectId', 'ActivityCodeObjectId',
                'ActivityCodeTypeObjectId', 'ActivityCodeTypeName', 'ActivityCodeTypeScope',
                'ActivityCodeValue', 'ActivityCodeDescription',
                'ProjectObjectId', 'ActivityId', 'ActivityName', 'ProjectId',
                'CreateDate', 'LastUpdateDate'  # 添加P6的时间字段，用于增量同步
            ],
            'resource': [
                'ObjectId', 'Id', 'Name', 'ResourceType',
                'UnitOfMeasureAbbreviation', 'UnitOfMeasureName', 'UnitOfMeasureObjectId',
                'PricePerUnit', 'CalendarObjectId'
            ],
            'resource_assignment': [
                'ObjectId', 'ActivityObjectId', 'ResourceObjectId', 'RoleObjectId',
                'ProjectObjectId', 'ActivityId', 'ActivityName',
                'ResourceId', 'ResourceName', 'ResourceType',
                'ProjectId', 'PlannedUnits', 'ActualUnits', 'RemainingUnits', 'AtCompletionUnits',
                'CreateDate', 'LastUpdateDate'  # 添加P6的时间字段，用于增量同步
            ],
            'project': [
                'ObjectId', 'Id', 'Name', 'ParentEPSObjectId', 'ParentEPSId', 'ParentEPSName',
                'Status', 'StartDate', 'FinishDate',
                'CreateDate', 'LastUpdateDate'  # 添加P6的时间字段，用于增量同步
            ],
            'activity_code': [
                'ObjectId', 'CodeTypeObjectId', 'CodeTypeName', 'CodeTypeScope',
                'CodeValue', 'SequenceNumber', 'Description',
                'CreateDate', 'LastUpdateDate'  # 添加P6的时间字段，用于增量同步
            ],
            'resource': [
                'ObjectId', 'Id', 'Name', 'ResourceType',
                'UnitOfMeasureAbbreviation', 'UnitOfMeasureName', 'UnitOfMeasureObjectId',
                'PricePerUnit', 'CalendarObjectId',
                'CreateDate', 'LastUpdateDate'  # 添加P6的时间字段，用于增量同步
            ],
            'eps': [
                'ObjectId', 'Id', 'Name', 'ParentObjectId', 'ParentId', 'ParentName',
                'OBSObjectId', 'OBSName',
                'CreateDate', 'LastUpdateDate'  # 添加P6的时间字段，用于增量同步
            ]
        }
        
        return fields_map.get(entity_type_lower, [])


# ============================================================================
# 以下是从 clear_and_sync_all_p6_data.py 整合的函数
# ============================================================================

# 所有P6相关的表名（按依赖顺序，先删除有外键的表）
P6_TABLES = [
    'p6_activity_code_assignments',  # 依赖activity和activity_code
    'p6_resource_assignments',        # 依赖activity和resource
    'p6_activities',                  # 依赖project和wbs
    'p6_wbs',                         # 依赖project
    'p6_activity_codes',
    'p6_resources',
    'p6_projects',                    # 依赖eps
    'p6_eps',
    'p6_sync_logs',                   # 日志表，可以清空
    'p6_raw_data',                    # 如果存在的话（旧方案的表）
]


def clear_all_p6_tables(db: Session):
    """
    清空所有P6相关的数据表
    
    Args:
        db: 数据库会话
    
    Returns:
        清空结果字典
    """
    logger.info(f"\n{'#'*60}")
    logger.info("开始清空所有P6数据表...")
    logger.info(f"{'#'*60}\n")
    
    results = {}
    total_deleted = 0
    
    try:
        # 对于大表清空，先设置MySQL会话超时参数（避免30秒超时）
        logger.info("优化：设置MySQL会话超时参数（避免30秒超时）...")
        try:
            # 设置会话级别的超时参数（单位：秒）
            # wait_timeout: 非交互式连接的超时时间
            # interactive_timeout: 交互式连接的超时时间
            # net_read_timeout: 读取超时
            # net_write_timeout: 写入超时
            from sqlalchemy import text
            db.execute(text("SET SESSION wait_timeout = 3600"))  # 1小时
            db.execute(text("SET SESSION interactive_timeout = 3600"))  # 1小时
            db.execute(text("SET SESSION net_read_timeout = 3600"))  # 1小时
            db.execute(text("SET SESSION net_write_timeout = 3600"))  # 1小时
            db.commit()
            logger.info("  ✓ 已设置会话超时参数为3600秒（1小时）")
        except Exception as e:
            logger.warning(f"无法设置会话超时参数: {e}，可能会遇到30秒超时问题")
        
        # 对于大表清空，先禁用外键检查可以大幅提升速度
        logger.info("优化：禁用外键检查以加速大表清空...")
        try:
            from sqlalchemy import text
            db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
            db.commit()
            fk_checks_disabled = True
        except Exception as e:
            logger.warning(f"无法禁用外键检查: {e}，将使用标准方式清空")
            fk_checks_disabled = False
        
        for table_name in P6_TABLES:
            try:
                # 检查表是否存在
                from sqlalchemy import text
                check_sql = text(f"SHOW TABLES LIKE '{table_name}'")
                result = db.execute(check_sql).fetchone()
                
                if not result:
                    logger.warning(f"⚠️  表 {table_name} 不存在，跳过")
                    results[table_name] = {
                        "success": True,
                        "deleted": 0,
                        "message": "表不存在"
                    }
                    continue
                
                # 优化：跳过COUNT(*)检查，直接清空（大幅提升性能）
                # 对于大表重建场景，我们知道表不为空，直接清空即可
                # 这样可以节省COUNT(*)的时间，特别是对于超大表
                
                # 清空表策略：直接使用TRUNCATE TABLE（跳过COUNT检查以提升性能）
                # TRUNCATE比DELETE快，且会重置AUTO_INCREMENT
                logger.info(f"正在清空 {table_name}...")
                start_time = datetime.now()
                
                # 对于超大表，先尝试清理阻塞的查询（基于表名判断）
                # 大表通常是activity_code_assignments, resource_assignments, activities等
                is_large_table = table_name in ['p6_activity_code_assignments', 'p6_resource_assignments', 'p6_activities']
                if is_large_table:
                    logger.info(f"  超大表检测，先清理可能阻塞的查询...")
                    max_retries = 3
                    for retry in range(max_retries):
                        try:
                            # 查找所有相关查询（包括Sleep状态的，可能持有锁）
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
                                logger.warning(f"    尝试 {retry+1}/{max_retries}: 发现 {len(blocking_queries)} 个相关查询，强制杀死...")
                                killed_count = 0
                                for q in blocking_queries:
                                    query_id = q[0]
                                    try:
                                        db.execute(text(f"KILL {query_id}"))
                                        db.commit()
                                        killed_count += 1
                                    except:
                                        try:
                                            db.execute(text(f"KILL QUERY {query_id}"))
                                            db.commit()
                                            killed_count += 1
                                        except:
                                            pass
                                
                                if killed_count > 0:
                                    logger.info(f"      已杀死 {killed_count} 个查询，等待锁释放...")
                                    time.sleep(2)
                                else:
                                    break
                            else:
                                logger.info(f"    ✓ 没有发现阻塞的查询")
                                break
                        except Exception as e:
                            logger.warning(f"    检查阻塞查询失败: {e}，继续...")
                    
                    # 等待锁释放
                    time.sleep(1)
                
                # 统一使用TRUNCATE TABLE清空表
                try:
                    from sqlalchemy import text
                    truncate_sql = text(f"TRUNCATE TABLE {table_name}")
                    db.execute(truncate_sql)
                    db.commit()
                    logger.info(f"  ✓ 使用TRUNCATE TABLE清空成功")
                except Exception as truncate_error:
                    logger.warning(f"  TRUNCATE失败: {truncate_error}，尝试使用DELETE清空...")
                    db.rollback()
                    
                    # 回退方案：使用DELETE（对于有外键约束的表，TRUNCATE可能失败）
                    try:
                        from sqlalchemy import text
                        delete_sql = text(f"DELETE FROM {table_name}")
                        db.execute(delete_sql)
                        db.commit()
                        logger.info(f"  ✓ 使用DELETE清空成功（回退方案）")
                    except Exception as delete_error:
                        logger.error(f"  ❌ DELETE也失败: {delete_error}")
                        logger.error(f"  表可能仍被锁定，建议：")
                        logger.error(f"    1. 运行: python scripts\\kill_long_queries.py --min-seconds 1")
                        logger.error(f"    2. 等待几分钟后重试")
                        logger.error(f"    3. 或手动在MySQL中检查表锁状态")
                        db.rollback()
                        raise
                
                elapsed = (datetime.now() - start_time).total_seconds()
                logger.info(f"✓ {table_name}: 已清空（耗时: {elapsed:.2f}秒）")

                # 不再统计删除的记录数（跳过COUNT检查以提升性能）
                results[table_name] = {
                    "success": True,
                    "deleted": 0  # 未知，但已清空
                }
                
            except Exception as e:
                logger.error(f"❌ 清空表 {table_name} 失败: {e}")
                db.rollback()
                results[table_name] = {
                    "success": False,
                    "error": str(e)
                }
        
        # 重新启用外键检查
        if fk_checks_disabled:
            try:
                logger.info("\n重新启用外键检查...")
                from sqlalchemy import text
                db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
                db.commit()
                logger.info("✓ 外键检查已重新启用")
            except Exception as e:
                logger.warning(f"重新启用外键检查失败: {e}")
        
        logger.info(f"\n{'='*60}")
        logger.info("清空完成")
        logger.info(f"{'='*60}")
        logger.info(f"已清空所有P6数据表（跳过记录数统计以提升性能）")
        
        return {
            "success": True,
            "total_deleted": total_deleted,
            "table_results": results
        }
        
    except Exception as e:
        logger.error(f"清空过程发生异常: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e)
        }


def sync_single_project_entities(
    project_id: str,
    entity_types: List[str],
    db: Optional[Session] = None
) -> Dict:
    """
    同步单个项目的实体数据（使用独立的P6连接，支持并发）
    
    Args:
        project_id: 项目ID
        entity_types: 要同步的实体类型列表
        db: 数据库会话（可选，如果不提供则创建新连接）
    
    Returns:
        同步结果字典，包含 project_id 字段用于标识
    """
    # 为每个线程创建独立的数据库连接（线程安全）
    if db is None:
        from app.database import SessionLocal
        thread_db = SessionLocal()
        should_close = True
    else:
        thread_db = db
        should_close = False
    
    try:
        logger.info(f"[项目 {project_id}] 开始同步，使用独立的P6连接...")
        
        # 关键：为每个线程创建独立的P6连接，避免竞争条件
        from app.services.p6_sync_service import P6SyncService
        p6_service = P6SyncService()
        if not p6_service.app:
            error_msg = "P6连接失败"
            logger.error(f"[项目 {project_id}] ❌ {error_msg}")
            return {
                "success": False,
                "error": error_msg,
                "project_id": project_id
            }
        
        # 创建同步服务（使用独立的P6连接）
        sync_service = RawDataSyncServiceDirect(p6_service=p6_service)
        
        project_start_time = datetime.now()
        
        # 同步项目级别的实体
        project_entities_result = sync_service.sync_multiple_entities_direct(
            entity_types=entity_types,
            project_id=project_id,
            fields_map=None,
            db=thread_db
        )
        
        project_duration = (datetime.now() - project_start_time).total_seconds()
        
        # 添加项目ID到结果中
        project_entities_result['project_id'] = project_id
        
        if project_entities_result.get('success'):
            total_count = project_entities_result.get('total_count', 0)
            written_count = project_entities_result.get('written_count', 0)
            logger.info(f"[项目 {project_id}] ✓ 同步完成: 读取 {total_count:,} 条，写入 {written_count:,} 条，耗时 {project_duration:.2f} 秒")
        else:
            logger.error(f"[项目 {project_id}] ❌ 同步失败: {project_entities_result.get('error', 'Unknown error')}")
        
        return project_entities_result
        
    except Exception as e:
        logger.error(f"[项目 {project_id}] ❌ 同步异常: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "project_id": project_id
        }
    finally:
        if should_close:
            thread_db.close()


def sync_all_p6_entities(
    project_id: Optional[str] = None, 
    project_ids: Optional[list] = None,
    max_workers: Optional[int] = None
):
    """
    一次性同步所有P6实体数据
    
    Args:
        project_id: 单个项目ID（可选，已废弃，使用project_ids）
        project_ids: 项目ID列表（可选，如果提供则只同步这些项目的数据）
        max_workers: 最大并发数（可选，默认等于项目数，最大不超过5）
    
    Returns:
        同步结果字典
    """
    # 处理参数：兼容旧的project_id参数
    if project_id and not project_ids:
        project_ids = [project_id]
    
    logger.info(f"\n{'#'*60}")
    logger.info("开始一次性同步所有P6实体数据")
    if project_ids:
        logger.info(f"✅ 指定项目ID列表: {', '.join(project_ids)} ({len(project_ids)} 个项目)")
    else:
        logger.warning(f"⚠️  未指定项目ID列表，将同步所有项目的数据")
    logger.info(f"{'#'*60}\n")
    
    from app.database import SessionLocal
    db = SessionLocal()
    
    try:
        # 初始化P6服务
        from app.services.p6_sync_service import P6SyncService
        p6_service = P6SyncService()
        if not p6_service.app:
            logger.error("❌ P6连接失败")
            return {
                "success": False,
                "error": "P6连接失败"
            }
        
        logger.info("✅ P6连接成功")
        
        # 创建同步服务
        sync_service = RawDataSyncServiceDirect(p6_service=p6_service)
        
        # 先同步EPS、Project、ActivityCode和Resource（全局实体，只需要同步一次）
        # 注意：ActivityCode有Global/EPS/Project三种作用域，但数据存储在全局，应该全局同步
        # 注意：Resource是全局的，不是项目级别的
        # 使用sync_multiple_entities_direct保持返回结构一致性，便于统计
        logger.info("步骤1: 同步EPS、Project、ActivityCode和Resource（全局实体）...")
        global_entity_types = ['eps', 'project', 'activity_code', 'resource']
        global_sync_result = sync_service.sync_multiple_entities_direct(
            entity_types=global_entity_types,
            project_id=None,  # 全局实体不需要项目ID
            fields_map=None,
            db=db
        )
        
        # 检查全局实体同步是否成功
        if not global_sync_result or not global_sync_result.get('success'):
            error_msg = global_sync_result.get('error', 'Unknown error') if global_sync_result else '同步结果为空'
            logger.error(f"❌ 全局实体同步失败: {error_msg}")
            return {
                "success": False,
                "error": f"全局实体同步失败: {error_msg}"
            }
        
        # 提取各全局实体的结果（保持与旧代码兼容）
        def build_entity_result(entity_type: str, global_sync_result: Dict) -> Dict:
            """
            构建实体结果字典，统一格式便于统计
            
            Args:
                entity_type: 实体类型（如 'eps', 'project'）
                global_sync_result: 全局同步结果字典
            
            Returns:
                包含count、written_count和entity_sync_stats的结果字典
            """
            entity_result = global_sync_result.get('entity_results', {}).get(entity_type, {})
            return {
                'count': entity_result.get('count', 0),
                'written_count': global_sync_result.get('entity_write_stats', {}).get(entity_type, {}).get('total_written', 0),
                'entity_sync_stats': {
                    entity_type: global_sync_result.get('entity_sync_stats', {}).get(entity_type, {})
                }
            }
        
        eps_result = global_sync_result.get('entity_results', {}).get('eps', {})
        project_result = global_sync_result.get('entity_results', {}).get('project', {})
        activity_code_result = global_sync_result.get('entity_results', {}).get('activity_code', {})
        resource_result = global_sync_result.get('entity_results', {}).get('resource', {})
        
        # 使用公共函数构建结果，减少代码重复
        eps_result_full = build_entity_result('eps', global_sync_result)
        project_result_full = build_entity_result('project', global_sync_result)
        activity_code_result_full = build_entity_result('activity_code', global_sync_result)
        resource_result_full = build_entity_result('resource', global_sync_result)
        
        logger.info(f"✓ EPS同步完成: {eps_result_full.get('count', 0)} 条")
        logger.info(f"✓ Project同步完成: {project_result_full.get('count', 0)} 条")
        logger.info(f"✓ ActivityCode同步完成: {activity_code_result_full.get('count', 0)} 条")
        logger.info(f"✓ Resource同步完成: {resource_result_full.get('count', 0)} 条")
        
        # 确定要同步的项目列表
        if project_ids and len(project_ids) > 0:
            # 使用指定的项目ID列表
            target_project_ids = project_ids
            logger.info(f"\n✅ 将同步 {len(target_project_ids)} 个指定项目的数据: {', '.join(target_project_ids)}")
        else:
            # 获取所有项目ID
            from app.p6_sync.models.project import P6Project
            projects = db.query(P6Project).all()
            target_project_ids = [p.project_id for p in projects if p.project_id]
            logger.warning(f"\n⚠️  未指定项目ID列表，找到 {len(target_project_ids)} 个项目，将同步所有项目的数据")
        
        if not target_project_ids:
            logger.warning("⚠️  没有找到需要同步的项目")
            return {
                "success": True,
                "results": {
                    'eps': eps_result_full,
                    'project': project_result_full,
                    'activity_code': activity_code_result_full,
                    'resource': resource_result_full
                },
                "message": "没有找到需要同步的项目"
            }
        
        # 同步其他实体（这些实体需要项目ID）
        # 注意：activity_code和resource已经在步骤1中全局同步了，这里不再同步
        entity_types = [
            'wbs',
            'activity',
            'activity_code_assignment',
            'resource_assignment'
        ]
        
        # 为每个项目同步这些实体
        all_results = {
            'eps': eps_result_full,
            'project': project_result_full,
            'activity_code': activity_code_result_full,
            'resource': resource_result_full
        }
        
        # 确定并发数
        if max_workers is None:
            # 默认：项目数，但不超过5（避免P6服务器过载）
            max_workers = min(len(target_project_ids), 5)
        else:
            max_workers = min(max_workers, len(target_project_ids), 5)  # 最大不超过5
        
        logger.info(f"\n{'='*60}")
        logger.info(f"开始并发同步 {len(target_project_ids)} 个项目（并发数: {max_workers}）")
        logger.info(f"{'='*60}\n")
        
        total_start_time = datetime.now()
        
        # 方案B：使用共享写入线程架构，避免死锁
        # 所有项目共享每个实体类型的队列和写入线程
        logger.info(f"使用方案B：按实体类型分组，所有项目共享写入线程（避免死锁）")
        projects_result = sync_service.sync_multiple_projects_entities_direct(
            project_ids=target_project_ids,
            entity_types=entity_types,
            fields_map=None,
            max_workers=max_workers
        )
        
        # 将结果转换为与旧格式兼容的格式
        if projects_result.get('success'):
            read_results = projects_result.get('read_results', {})
            write_stats = projects_result.get('write_stats', {})
            sync_stats = projects_result.get('entity_sync_stats', {})
            
            for pid in target_project_ids:
                project_result = read_results.get(pid, {})
                # 构造与旧格式兼容的结果
                entity_results = {}
                for entity_type in entity_types:
                    entity_results[entity_type] = project_result.get(entity_type, {})
                
                all_results[f'project_{pid}'] = {
                    "success": True,
                    "project_id": pid,
                    "total_count": sum(r.get('count', 0) for r in entity_results.values() if r.get('success')),
                    "written_count": sum(stats.get('total_written', 0) for stats in write_stats.values()),
                    "entity_results": entity_results,
                    "entity_write_stats": write_stats,
                    "entity_sync_stats": sync_stats  # 添加统计信息
                }
        else:
            # 如果失败，为每个项目创建失败结果
            for pid in target_project_ids:
                all_results[f'project_{pid}'] = {
                    "success": False,
                    "error": projects_result.get('error', 'Unknown error'),
                    "project_id": pid
                }
        
        total_duration = (datetime.now() - total_start_time).total_seconds()
        
        # 汇总统计
        logger.info(f"\n{'='*60}")
        logger.info("同步汇总")
        logger.info(f"{'='*60}")
        logger.info(f"处理项目数: {len(target_project_ids)}")
        logger.info(f"总耗时: {total_duration:.2f} 秒")
        
        # 统计各实体类型的总数（包括全局实体和项目级别实体）
        entity_totals = {}
        
        # 先统计全局实体
        global_entities = ['eps', 'project', 'activity_code', 'resource']
        for entity_type in global_entities:
            result = all_results.get(entity_type, {})
            if isinstance(result, dict):
                # 如果是同步结果字典
                read_count = result.get('count', 0)
                # 使用实际的写入数量（从written_count字段获取）
                written_count = result.get('written_count', 0)
            else:
                read_count = 0
                written_count = 0
            entity_totals[entity_type] = {'read': read_count, 'written': written_count}
        
        # 再统计项目级别实体
        # 读取数量：按项目累加（每个项目读取的数据不同）
        for pid in target_project_ids:
            project_result = all_results.get(f'project_{pid}', {})
            entity_results = project_result.get('entity_results', {})
            for entity_type in entity_types:
                if entity_type not in entity_totals:
                    entity_totals[entity_type] = {'read': 0, 'written': 0}
                entity_result = entity_results.get(entity_type, {})
                entity_totals[entity_type]['read'] += entity_result.get('count', 0)
        
        # 写入数量：从方案B的write_stats获取（已按实体类型汇总，不是按项目）
        # 注意：projects_result在作用域内，因为是在上面定义的
        if projects_result and projects_result.get('success'):
            write_stats = projects_result.get('write_stats', {})
            for entity_type in entity_types:
                if entity_type not in entity_totals:
                    entity_totals[entity_type] = {'read': 0, 'written': 0}
                entity_stats = write_stats.get(entity_type, {})
                entity_totals[entity_type]['written'] = entity_stats.get('total_written', 0)
        
        # 汇总增删改统计
        total_added = 0
        total_updated = 0
        total_deleted = 0
        total_before = 0  # 同步前的总记录数
        
        # 从全局实体结果中提取增删改统计
        for entity_type in global_entities:
            result = all_results.get(entity_type, {})
            if isinstance(result, dict):
                # 从entity_sync_stats字典中获取该实体类型的统计
                sync_stats = result.get('entity_sync_stats', {}).get(entity_type, {})
                if sync_stats:
                    total_added += sync_stats.get('added', 0)
                    total_updated += sync_stats.get('updated', 0)
                    total_deleted += sync_stats.get('deleted', 0)
                    total_before += sync_stats.get('total_in_db_before', 0)
        
        # 从项目级别实体结果中提取增删改统计
        # 方案B中统计是按实体类型汇总的，不是按项目，所以直接从projects_result获取
        if projects_result and projects_result.get('success'):
            entity_sync_stats = projects_result.get('entity_sync_stats', {})
            for entity_type in entity_types:
                sync_stat = entity_sync_stats.get(entity_type, {})
                total_added += sync_stat.get('added', 0)
                total_updated += sync_stat.get('updated', 0)
                total_deleted += sync_stat.get('deleted', 0)
                total_before += sync_stat.get('total_in_db_before', 0)
        
        logger.info(f"\n增删改总计:")
        if total_before > 0:
            added_pct = (total_added / total_before * 100) if total_before > 0 else 0
            updated_pct = (total_updated / total_before * 100) if total_before > 0 else 0
            deleted_pct = (total_deleted / total_before * 100) if total_before > 0 else 0
            logger.info(f"  新增: {total_added:,} 条 ({added_pct:.2f}%)")
            logger.info(f"  更新: {total_updated:,} 条 ({updated_pct:.2f}%)")
            logger.info(f"  删除: {total_deleted:,} 条 ({deleted_pct:.2f}%)（标记为is_active=0）")
            logger.info(f"  同步前总记录数: {total_before:,} 条")
        else:
            logger.info(f"  新增: {total_added:,} 条")
            logger.info(f"  更新: {total_updated:,} 条")
            logger.info(f"  删除: {total_deleted:,} 条（标记为is_active=0）")
        
        logger.info(f"\n各实体类型总计:")
        # 先显示全局实体
        logger.info(f"全局实体:")
        for entity_type in global_entities:
            result = all_results.get(entity_type, {})
            if isinstance(result, dict):
                sync_stats = result.get('entity_sync_stats', {}).get(entity_type, {})
                read_count = result.get('count', 0)
                written_count = result.get('written_count', 0)
                added = sync_stats.get('added', 0) if sync_stats else 0
                updated = sync_stats.get('updated', 0) if sync_stats else 0
                deleted = sync_stats.get('deleted', 0) if sync_stats else 0
                before_count = sync_stats.get('total_in_db_before', 0) if sync_stats else 0
                
                # 计算百分比
                if before_count > 0:
                    added_pct = (added / before_count * 100) if before_count > 0 else 0
                    updated_pct = (updated / before_count * 100) if before_count > 0 else 0
                    deleted_pct = (deleted / before_count * 100) if before_count > 0 else 0
                    logger.info(f"   {entity_type}: 读取 {read_count:,} 条，写入 {written_count:,} 条，新增 {added:,} ({added_pct:.2f}%)，更新 {updated:,} ({updated_pct:.2f}%)，删除 {deleted:,} ({deleted_pct:.2f}%)")
                else:
                    logger.info(f"   {entity_type}: 读取 {read_count:,} 条，写入 {written_count:,} 条，新增 {added:,} 条，更新 {updated:,} 条，删除 {deleted:,} 条")
            else:
                logger.info(f"   {entity_type}: 读取 0 条")
        # 再显示项目级别实体
        logger.info(f"项目级别实体:")
        for entity_type in entity_types:
            totals = entity_totals.get(entity_type, {'read': 0, 'written': 0})
            
            # 从方案B的结果中直接获取统计（已按实体类型汇总，不是按项目）
            # 方案B中所有项目共享写入线程，统计是按实体类型汇总的
            if projects_result and projects_result.get('success'):
                entity_sync_stats = projects_result.get('entity_sync_stats', {})
                sync_stat = entity_sync_stats.get(entity_type, {})
            else:
                sync_stat = {}
            
            entity_added = sync_stat.get('added', 0)
            entity_updated = sync_stat.get('updated', 0)
            entity_deleted = sync_stat.get('deleted', 0)
            entity_before = sync_stat.get('total_in_db_before', 0)
            
            # 计算百分比
            if entity_before > 0:
                added_pct = (entity_added / entity_before * 100) if entity_before > 0 else 0
                updated_pct = (entity_updated / entity_before * 100) if entity_before > 0 else 0
                deleted_pct = (entity_deleted / entity_before * 100) if entity_before > 0 else 0
                logger.info(f"   {entity_type}: 读取 {totals['read']:,} 条，写入 {totals['written']:,} 条，新增 {entity_added:,} ({added_pct:.2f}%)，更新 {entity_updated:,} ({updated_pct:.2f}%)，删除 {entity_deleted:,} ({deleted_pct:.2f}%)")
            else:
                logger.info(f"   {entity_type}: 读取 {totals['read']:,} 条，写入 {totals['written']:,} 条，新增 {entity_added:,} 条，更新 {entity_updated:,} 条，删除 {entity_deleted:,} 条")
        
        return {
            "success": True,
            "results": all_results,
            "total_projects": len(target_project_ids),
            "total_duration": total_duration,
            "entity_totals": entity_totals
        }
        
        # 以下代码已废弃（保留以防万一）
        if False:
            pass
        
    except Exception as e:
        logger.error(f"❌ 同步异常: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e)
        }
    finally:
        db.close()


def main():
    """主函数：同步所有P6实体数据（默认增量更新，生产环境模式）"""
    import argparse
    
    # 立即输出，确认脚本已启动
    print("正在启动P6数据同步脚本...", flush=True)
    
    # 配置日志（确保有输出）
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        force=True
    )
    
    print("日志配置完成，开始解析参数...", flush=True)
    
    parser = argparse.ArgumentParser(description='同步所有P6实体数据（默认增量更新，生产环境模式）')
    parser.add_argument('--project-id', type=str, help='单个项目ID（可选，已废弃，使用--project-ids）')
    parser.add_argument('--project-ids', type=str, nargs='+', help='项目ID列表（可选，例如: --project-ids UIOPRJ ECUPRJ PELPRJ）')
    parser.add_argument('--clear', action='store_true', help='清空所有表后重新同步（调试模式，默认：增量更新）')
    parser.add_argument('--max-workers', type=int, default=None, help='最大并发数（默认：项目数，最大5。例如: --max-workers 3）')
    args = parser.parse_args()
    
    print(f"参数解析完成: project_ids={args.project_ids}, clear={args.clear}, max_workers={args.max_workers}", flush=True)
    
    # 处理项目ID参数
    project_ids = None
    if args.project_ids:
        project_ids = args.project_ids
    elif args.project_id:
        project_ids = [args.project_id]
    
    print("正在连接数据库...", flush=True)
    from app.database import SessionLocal
    db = SessionLocal()
    print("数据库连接成功", flush=True)
    
    try:
        # 步骤1: 清空所有表（仅在--clear模式下）
        if args.clear:
            logger.info("⚠️  调试模式：将清空所有P6数据表后重新同步")
            clear_result = clear_all_p6_tables(db)
            if not clear_result.get('success'):
                logger.error("清空表失败，终止执行")
                return
            logger.info("\n等待3秒后开始同步...")
            time.sleep(3)
        else:
            logger.info("✅ 生产模式：增量更新（使用ON DUPLICATE KEY UPDATE）")
            logger.info("   如需清空表后重新同步，请使用 --clear 参数")
        
        # 步骤2: 同步所有数据（支持并发）
        sync_result = sync_all_p6_entities(project_ids=project_ids, max_workers=args.max_workers)
        
        if sync_result.get('success'):
            logger.info("\n" + "="*60)
            logger.info("✅ 所有操作完成！")
            logger.info("="*60)
        else:
            logger.error("\n" + "="*60)
            logger.error("❌ 同步失败")
            logger.error("="*60)
            
    except KeyboardInterrupt:
        logger.warning("\n用户中断操作")
    except Exception as e:
        logger.error(f"执行异常: {e}", exc_info=True)
    finally:
        db.close()


if __name__ == "__main__":
    main()