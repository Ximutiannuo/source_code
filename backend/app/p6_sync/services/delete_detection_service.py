"""
删除检测服务：检测P6中已删除的实体并标记为is_active=0
"""
import logging
from typing import Dict, List, Optional, Set, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

from app.p6_sync.services.raw_data_sync_direct import RawDataSyncServiceDirect
from app.p6_sync.services.task_coordinator import TaskCoordinator

logger = logging.getLogger(__name__)

def log_info(message: str):
    """立即输出的日志函数"""
    logger.info(message)
    print(f"[删除检测] {message}", flush=True)

def log_error(message: str):
    """立即输出的错误日志函数"""
    logger.error(message)
    print(f"[删除检测] ❌ {message}", flush=True)

class DeleteDetectionService:
    """删除检测服务"""
    
    def __init__(self, p6_service=None):
        """
        初始化删除检测服务
        
        Args:
            p6_service: P6服务实例（可选）
        """
        self.sync_service = RawDataSyncServiceDirect(p6_service=p6_service)
        self.coordinator = TaskCoordinator()
    
    def detect_and_mark_deleted_entities(
        self,
        project_ids: Optional[List[str]] = None,
        entity_types: Optional[List[str]] = None,
        db: Optional[Session] = None,
        max_workers: Optional[int] = None
    ) -> Dict:
        """
        检测并标记已删除的实体（使用多线程并行处理）
        
        Args:
            project_ids: 项目ID列表（可选，如果为None则检测所有项目）
            entity_types: 实体类型列表（可选，如果为None则检测所有类型）
            db: 数据库会话（可选）
            max_workers: 最大并发线程数（可选，默认等于项目数，最大5）
        
        Returns:
            检测结果字典
        """
        from app.database import SessionLocal
        
        if db is None:
            db = SessionLocal()
            should_close = True
        else:
            should_close = False
        
        try:
            # 检查是否已有删除检测在运行
            if self.coordinator.is_delete_detection_running():
                return {
                    "success": False,
                    "error": "删除检测已在运行中"
                }
            
            # 获取锁
            if not self.coordinator.acquire_delete_detection_lock(wait=False):
                return {
                    "success": False,
                    "error": "无法获取删除检测锁"
                }
            
            try:
                log_info("=" * 60)
                log_info("开始删除检测（多线程并行模式）")
                log_info("=" * 60)
                
                start_time = datetime.now()
                
                # 确定要检测的实体类型
                if entity_types is None:
                    entity_types = self.sync_service.SUPPORTED_ENTITIES
                
                # 确定要检测的项目
                if project_ids is None:
                    # 查询所有项目
                    project_ids = self._get_all_project_ids(db)
                    log_info(f"检测所有项目: {', '.join(project_ids)}")
                else:
                    log_info(f"检测指定项目: {', '.join(project_ids)}")
                
                # 按实体类型分组
                global_entities = ['eps', 'project', 'activity_code', 'resource']
                project_entities = ['wbs', 'activity', 'activity_code_assignment', 'resource_assignment']
                
                results = {}
                total_deleted = 0
                
                # 检测全局实体（并行处理）
                global_entity_types = [et for et in entity_types if et in global_entities]
                if global_entity_types:
                    log_info(f"\n检测全局实体: {', '.join(global_entity_types)}（并行处理）")
                    # 使用线程池并行处理全局实体
                    # 每个线程需要自己的数据库会话
                    def detect_global_entity(entity_type: str):
                        thread_db = SessionLocal()
                        try:
                            return self._detect_deleted_for_entity(
                                entity_type=entity_type,
                                project_id=None,
                                project_object_id=None,
                                db=thread_db
                            )
                        finally:
                            thread_db.close()
                    
                    with ThreadPoolExecutor(max_workers=len(global_entity_types)) as executor:
                        future_to_entity = {
                            executor.submit(detect_global_entity, entity_type): entity_type
                            for entity_type in global_entity_types
                        }
                        
                        for future in as_completed(future_to_entity):
                            entity_type = future_to_entity[future]
                            try:
                                result = future.result()
                                results[entity_type] = result
                                total_deleted += result.get('deleted_count', 0)
                            except Exception as e:
                                log_error(f"全局实体 {entity_type} 检测失败: {e}")
                                results[entity_type] = {
                                    "success": False,
                                    "error": str(e),
                                    "deleted_count": 0
                                }
                
                # 检测项目级实体（并行处理多个项目，每个项目内的实体类型也并行）
                project_entity_types = [et for et in entity_types if et in project_entities]
                if project_entity_types and project_ids:
                    log_info(f"\n检测项目级实体: {', '.join(project_entity_types)}（并行处理）")
                    
                    # 确定并发数
                    if max_workers is None:
                        max_workers = min(len(project_ids), 5)  # 默认不超过5个
                    else:
                        max_workers = min(max_workers, len(project_ids), 5)
                    
                    log_info(f"使用 {max_workers} 个线程并行处理 {len(project_ids)} 个项目")
                    
                    # 预先获取所有项目的ObjectId
                    project_object_id_map = {}
                    for project_id in project_ids:
                        project_object_id = self._get_project_object_id(db, project_id)
                        if project_object_id:
                            project_object_id_map[project_id] = project_object_id
                        else:
                            log_error(f"项目 {project_id} 不存在，跳过")
                    
                    # 使用线程池并行处理多个项目
                    def detect_project_entities(project_id: str):
                        """检测单个项目的所有实体类型（并行）"""
                        project_object_id = project_object_id_map.get(project_id)
                        if not project_object_id:
                            return {}
                        
                        # 每个项目线程需要自己的数据库会话
                        project_db = SessionLocal()
                        project_results = {}
                        project_total_deleted = 0
                        
                        try:
                            log_info(f"\n处理项目: {project_id}")
                            
                            # 每个项目内的实体类型也并行处理
                            def detect_project_entity(entity_type: str):
                                """检测单个项目的单个实体类型"""
                                entity_db = SessionLocal()
                                try:
                                    return self._detect_deleted_for_entity(
                                        entity_type=entity_type,
                                        project_id=project_id,
                                        project_object_id=project_object_id,
                                        db=entity_db
                                    )
                                finally:
                                    entity_db.close()
                            
                            with ThreadPoolExecutor(max_workers=len(project_entity_types)) as executor:
                                future_to_entity = {
                                    executor.submit(detect_project_entity, entity_type): entity_type
                                    for entity_type in project_entity_types
                                }
                                
                                for future in as_completed(future_to_entity):
                                    entity_type = future_to_entity[future]
                                    try:
                                        result = future.result()
                                        key = f"{entity_type}_{project_id}"
                                        project_results[key] = result
                                        project_total_deleted += result.get('deleted_count', 0)
                                    except Exception as e:
                                        log_error(f"项目 {project_id} 的实体 {entity_type} 检测失败: {e}")
                                        key = f"{entity_type}_{project_id}"
                                        project_results[key] = {
                                            "success": False,
                                            "error": str(e),
                                            "deleted_count": 0
                                        }
                        finally:
                            project_db.close()
                        
                        return project_results
                    
                    # 并行处理多个项目
                    with ThreadPoolExecutor(max_workers=max_workers) as executor:
                        future_to_project = {
                            executor.submit(detect_project_entities, project_id): project_id
                            for project_id in project_object_id_map.keys()
                        }
                        
                        for future in as_completed(future_to_project):
                            project_id = future_to_project[future]
                            try:
                                project_results = future.result()
                                results.update(project_results)
                                for result in project_results.values():
                                    total_deleted += result.get('deleted_count', 0)
                            except Exception as e:
                                log_error(f"项目 {project_id} 检测失败: {e}")
                
                duration = (datetime.now() - start_time).total_seconds()
                
                log_info("\n" + "=" * 60)
                log_info(f"删除检测完成")
                log_info(f"总耗时: {duration:.2f} 秒")
                log_info(f"总删除数: {total_deleted} 条")
                log_info("=" * 60)
                
                return {
                    "success": True,
                    "total_deleted": total_deleted,
                    "duration": duration,
                    "results": results
                }
            
            finally:
                self.coordinator.release_delete_detection_lock()
        
        except Exception as e:
            log_error(f"删除检测异常: {e}")
            import traceback
            log_error(traceback.format_exc())
            return {
                "success": False,
                "error": str(e)
            }
        
        finally:
            if should_close:
                db.close()
    
    def _detect_deleted_for_entity(
        self,
        entity_type: str,
        project_id: Optional[str],
        project_object_id: Optional[int],
        db: Session
    ) -> Dict:
        """
        检测单个实体类型的已删除记录
        
        Args:
            entity_type: 实体类型
            project_id: 项目ID（可选）
            project_object_id: 项目ObjectId（可选）
            db: 数据库会话
        
        Returns:
            检测结果字典
        """
        log_prefix = f"[{entity_type}]"
        if project_id:
            log_prefix += f"[{project_id}]"
        
        try:
            log_info(f"{log_prefix} 开始检测...")
            
            # 获取表信息
            table_info = self.sync_service._get_table_info(entity_type)
            if not table_info:
                return {
                    "success": False,
                    "error": f"无法获取表信息: {entity_type}",
                    "deleted_count": 0
                }
            
            table_name = table_info['table_name']
            
            # 特殊处理：activity_code_assignment 使用组合键
            if entity_type.lower() == 'activity_code_assignment':
                return self._detect_deleted_activity_code_assignment(
                    table_name=table_name,
                    project_id=project_id,
                    project_object_id=project_object_id,
                    db=db,
                    log_prefix=log_prefix
                )
            
            # 其他实体使用 object_id
            # 1. 从P6读取所有ObjectId
            log_info(f"{log_prefix} 从P6读取ObjectId列表...")
            p6_object_ids = self.sync_service._read_entity_object_ids_only(
                entity_type=entity_type,
                project_id=project_id,
                project_object_id=project_object_id,
                filters=None,  # 删除检测需要全量读取
                log_prefix=log_prefix
            )
            log_info(f"{log_prefix} P6中ObjectId数量: {len(p6_object_ids)}")
            
            # 2. 从数据库查询所有活跃的ObjectId
            log_info(f"{log_prefix} 从数据库查询活跃ObjectId...")
            db_object_ids = self._get_db_active_object_ids(
                table_name=table_name,
                project_id=project_id,
                db=db
            )
            log_info(f"{log_prefix} 数据库中活跃ObjectId数量: {len(db_object_ids)}")
            
            # 3. 计算差集：数据库中存在但P6中不存在的
            deleted_object_ids = db_object_ids - p6_object_ids
            deleted_count = len(deleted_object_ids)
            
            log_info(f"{log_prefix} 检测到已删除: {deleted_count} 条")
            
            # 4. 批量标记为is_active=0
            if deleted_count > 0:
                log_info(f"{log_prefix} 开始标记删除...")
                marked_count = self._mark_as_deleted(
                    table_name=table_name,
                    object_ids=deleted_object_ids,
                    project_id=project_id,
                    db=db
                )
                log_info(f"{log_prefix} 已标记删除: {marked_count} 条")
            else:
                marked_count = 0
            
            return {
                "success": True,
                "p6_object_ids_count": len(p6_object_ids),
                "db_object_ids_count": len(db_object_ids),
                "deleted_count": deleted_count,
                "marked_count": marked_count
            }
        
        except Exception as e:
            log_error(f"{log_prefix} 检测失败: {e}")
            import traceback
            log_error(traceback.format_exc())
            return {
                "success": False,
                "error": str(e),
                "deleted_count": 0
            }
    
    def _detect_deleted_activity_code_assignment(
        self,
        table_name: str,
        project_id: Optional[str],
        project_object_id: Optional[int],
        db: Session,
        log_prefix: str
    ) -> Dict:
        """
        检测activity_code_assignment的已删除记录（使用组合键）
        """
        try:
            # 1. 从P6读取所有组合键
            log_info(f"{log_prefix} 从P6读取组合键列表...")
            p6_composite_keys = self.sync_service._read_activity_code_assignment_composite_keys(
                project_id=project_id,
                project_object_id=project_object_id,
                filters=None,  # 删除检测需要全量读取
                log_prefix=log_prefix
            )
            log_info(f"{log_prefix} P6中组合键数量: {len(p6_composite_keys)}")
            
            # 2. 从数据库查询所有活跃的组合键
            log_info(f"{log_prefix} 从数据库查询活跃组合键...")
            db_composite_keys = self._get_db_active_composite_keys(
                table_name=table_name,
                project_id=project_id,
                db=db
            )
            log_info(f"{log_prefix} 数据库中活跃组合键数量: {len(db_composite_keys)}")
            
            # 3. 计算差集
            deleted_composite_keys = db_composite_keys - p6_composite_keys
            deleted_count = len(deleted_composite_keys)
            
            log_info(f"{log_prefix} 检测到已删除: {deleted_count} 条")
            
            # 4. 批量标记为is_active=0
            if deleted_count > 0:
                log_info(f"{log_prefix} 开始标记删除...")
                marked_count = self._mark_composite_keys_as_deleted(
                    table_name=table_name,
                    composite_keys=deleted_composite_keys,
                    db=db
                )
                log_info(f"{log_prefix} 已标记删除: {marked_count} 条")
            else:
                marked_count = 0
            
            return {
                "success": True,
                "p6_composite_keys_count": len(p6_composite_keys),
                "db_composite_keys_count": len(db_composite_keys),
                "deleted_count": deleted_count,
                "marked_count": marked_count
            }
        
        except Exception as e:
            log_error(f"{log_prefix} 检测失败: {e}")
            import traceback
            log_error(traceback.format_exc())
            return {
                "success": False,
                "error": str(e),
                "deleted_count": 0
            }
    
    def _get_db_active_object_ids(
        self,
        table_name: str,
        project_id: Optional[str],
        db: Session
    ) -> Set[int]:
        """从数据库查询所有活跃的ObjectId"""
        try:
            # 项目级实体需要按项目过滤
            project_level_entities = {'wbs', 'activity', 'activity_code_assignment', 'resource_assignment'}
            entity_type = None
            for et in self.sync_service.SUPPORTED_ENTITIES:
                table_info = self.sync_service._get_table_info(et)
                if table_info and table_info['table_name'] == table_name:
                    entity_type = et
                    break
            
            if entity_type and entity_type.lower() in project_level_entities and project_id:
                query = text(f"""
                    SELECT object_id
                    FROM {table_name}
                    WHERE is_active = 1 AND project_id = :project_id
                """)
                result = db.execute(query, {'project_id': project_id})
            else:
                # 全局实体
                query = text(f"""
                    SELECT object_id
                    FROM {table_name}
                    WHERE is_active = 1
                """)
                result = db.execute(query)
            
            object_ids = {row[0] for row in result if row[0] is not None}
            return object_ids
        
        except Exception as e:
            log_error(f"查询数据库ObjectId失败: {e}")
            return set()
    
    def _get_db_active_composite_keys(
        self,
        table_name: str,
        project_id: Optional[str],
        db: Session
    ) -> Set[Tuple[int, int, int, int]]:
        """从数据库查询所有活跃的组合键（activity_code_assignment）"""
        try:
            if project_id:
                query = text(f"""
                    SELECT activity_object_id, project_object_id, 
                           activity_code_type_object_id, activity_code_object_id
                    FROM {table_name}
                    WHERE is_active = 1 AND project_id = :project_id
                """)
                result = db.execute(query, {'project_id': project_id})
            else:
                query = text(f"""
                    SELECT activity_object_id, project_object_id, 
                           activity_code_type_object_id, activity_code_object_id
                    FROM {table_name}
                    WHERE is_active = 1
                """)
                result = db.execute(query)
            
            composite_keys = set()
            for row in result:
                if all(x is not None for x in row):
                    composite_keys.add(tuple(int(x) for x in row))
            
            return composite_keys
        
        except Exception as e:
            log_error(f"查询数据库组合键失败: {e}")
            return set()
    
    def _mark_as_deleted(
        self,
        table_name: str,
        object_ids: Set[int],
        project_id: Optional[str],
        db: Session
    ) -> int:
        """批量标记为is_active=0"""
        if not object_ids:
            return 0
        
        try:
            # 分批处理，避免SQL语句过长
            batch_size = 1000
            object_ids_list = list(object_ids)
            total_marked = 0
            
            for i in range(0, len(object_ids_list), batch_size):
                batch = object_ids_list[i:i+batch_size]
                placeholders = ','.join([':id' + str(j) for j in range(len(batch))])
                params = {f'id{j}': obj_id for j, obj_id in enumerate(batch)}
                
                # 项目级实体需要按项目过滤（额外保护）
                project_level_entities = {'wbs', 'activity', 'activity_code_assignment', 'resource_assignment'}
                entity_type = None
                for et in self.sync_service.SUPPORTED_ENTITIES:
                    table_info = self.sync_service._get_table_info(et)
                    if table_info and table_info['table_name'] == table_name:
                        entity_type = et
                        break
                
                if entity_type and entity_type.lower() in project_level_entities and project_id:
                    query = text(f"""
                        UPDATE {table_name}
                        SET is_active = 0, updated_at = NOW()
                        WHERE object_id IN ({placeholders}) AND project_id = :project_id
                    """)
                    params['project_id'] = project_id
                else:
                    query = text(f"""
                        UPDATE {table_name}
                        SET is_active = 0, updated_at = NOW()
                        WHERE object_id IN ({placeholders})
                    """)
                
                result = db.execute(query, params)
                marked = result.rowcount
                total_marked += marked
                db.commit()
            
            return total_marked
        
        except Exception as e:
            db.rollback()
            log_error(f"标记删除失败: {e}")
            import traceback
            log_error(traceback.format_exc())
            return 0
    
    def _mark_composite_keys_as_deleted(
        self,
        table_name: str,
        composite_keys: Set[Tuple[int, int, int, int]],
        db: Session
    ) -> int:
        """批量标记组合键为is_active=0"""
        if not composite_keys:
            return 0
        
        try:
            # 分批处理
            batch_size = 500
            composite_keys_list = list(composite_keys)
            total_marked = 0
            
            for i in range(0, len(composite_keys_list), batch_size):
                batch = composite_keys_list[i:i+batch_size]
                
                # 构建WHERE条件
                conditions = []
                params = {}
                for j, key in enumerate(batch):
                    conditions.append(
                        f"(activity_object_id = :a{j} AND project_object_id = :p{j} "
                        f"AND activity_code_type_object_id = :t{j} AND activity_code_object_id = :c{j})"
                    )
                    params[f'a{j}'] = key[0]
                    params[f'p{j}'] = key[1]
                    params[f't{j}'] = key[2]
                    params[f'c{j}'] = key[3]
                
                where_clause = ' OR '.join(conditions)
                query = text(f"""
                    UPDATE {table_name}
                    SET is_active = 0, updated_at = NOW()
                    WHERE ({where_clause}) AND is_active = 1
                """)
                
                result = db.execute(query, params)
                marked = result.rowcount
                total_marked += marked
                db.commit()
            
            return total_marked
        
        except Exception as e:
            db.rollback()
            log_error(f"标记组合键删除失败: {e}")
            import traceback
            log_error(traceback.format_exc())
            return 0
    
    def _get_all_project_ids(self, db: Session) -> List[str]:
        """获取所有项目ID"""
        try:
            query = text("SELECT DISTINCT project_id FROM p6_projects WHERE is_active = 1")
            result = db.execute(query)
            project_ids = [row[0] for row in result if row[0]]
            return project_ids
        except Exception as e:
            log_error(f"查询项目ID失败: {e}")
            return []
    
    def _get_project_object_id(self, db: Session, project_id: str) -> Optional[int]:
        """获取项目ObjectId"""
        try:
            query = text("SELECT object_id FROM p6_projects WHERE project_id = :project_id AND is_active = 1")
            result = db.execute(query, {'project_id': project_id}).first()
            return result[0] if result else None
        except Exception as e:
            log_error(f"查询项目ObjectId失败: {e}")
            return None

