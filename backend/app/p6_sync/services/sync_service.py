"""
P6主同步服务
协调所有P6实体的同步
使用新的RawDataSyncServiceDirect进行高效批量同步
"""
from sqlalchemy.orm import Session
from typing import Dict, List, Optional
from datetime import datetime, timezone
import logging

from app.services.activity_calculation_service import ActivityCalculationService
from app.p6_sync.models.activity import P6Activity
from app.models.activity_summary import ActivitySummary
from .raw_data_sync_direct import RawDataSyncServiceDirect

logger = logging.getLogger(__name__)


class P6FullSyncService:
    """
    P6主同步服务
    协调所有P6实体的同步，并集成计算服务
    使用RawDataSyncServiceDirect进行高效批量同步
    """
    
    def __init__(self):
        # 延迟导入避免循环导入
        from app.services.p6_sync_service import P6SyncService
        self.p6_service = P6SyncService()
        self.calculation_service = ActivityCalculationService()
        # 使用新的直接同步服务
        self.direct_sync_service = RawDataSyncServiceDirect(p6_service=self.p6_service)
    
    def sync_all_entities(
        self,
        project_id: Optional[str] = None,
        sync_mode: str = "full",
        db: Optional[Session] = None,
        entities: Optional[List[str]] = None
    ) -> Dict:
        """
        同步所有P6实体（使用新的批量直接同步服务）
        
        Args:
            project_id: 项目ID（可选，某些实体如EPS不需要）
            sync_mode: 同步模式 ("full" | "incremental") - 目前仅支持full
            db: 数据库会话
            entities: 要同步的实体列表，如果为None则同步所有实体
               可选值: ['eps', 'project', 'wbs', 'activity', 'activity_code', 
                       'activity_code_assignment', 'resource', 'resource_assignment']
        
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
            
            # 默认同步所有实体（除了EPS，EPS不需要project_id）
            if entities is None:
                if project_id:
                    entities = ['project', 'wbs', 'activity', 
                              'activity_code', 'activity_code_assignment',
                              'resource', 'resource_assignment']
                else:
                    entities = ['eps']
            
            logger.info(f"开始同步实体 (项目: {project_id}, 实体: {entities})...")
            
            # 使用新的批量直接同步服务
            sync_result = self.direct_sync_service.sync_multiple_entities_direct(
                entity_types=entities,
                project_id=project_id,
                fields_map=None,
                db=db
            )
            
            results = sync_result.get('entity_results', {})
            
            # 计算人工时和权重（如果Activity同步成功）
            if 'activity' in entities and results.get('activity', {}).get('success'):
                logger.info("计算人工时和权重...")
                calculation_result = self._calculate_manhours_and_weights(
                    project_id=project_id,
                    db=db
                )
                results['calculation'] = calculation_result
                logger.info(f"✓ 计算完成: {calculation_result}")
            
            return {
                "success": sync_result.get('success', False),
                "results": results,
                "total_count": sync_result.get('total_count', 0),
                "written_count": sync_result.get('written_count', 0),
                "total_duration": sync_result.get('total_duration', 0)
            }
            
        except Exception as e:
            logger.error(f"同步失败: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }
        finally:
            if should_close:
                db.close()
    
    def sync_project_activities(
        self,
        project_id: str,
        sync_mode: str = "full",
        db: Optional[Session] = None
    ) -> Dict:
        """
        同步项目的作业数据（包括Activity和ActivityCodeAssignment）
        并计算人工时和权重
        
        Args:
            project_id: 项目ID
            sync_mode: 同步模式（目前仅支持full）
            db: 数据库会话
        
        Returns:
            同步结果字典
        """
        return self.sync_all_entities(
            project_id=project_id,
            sync_mode=sync_mode,
            db=db,
            entities=['activity', 'activity_code_assignment']
        )
    
    def sync_single_entity(
        self,
        entity_type: str,
        project_id: Optional[str] = None,
        db: Optional[Session] = None
    ) -> Dict:
        """
        同步单个实体类型（便捷方法）
        
        Args:
            entity_type: 实体类型（如 'activity', 'activity_code_assignment'）
            project_id: 项目ID（可选）
            db: 数据库会话
        
        Returns:
            同步结果字典
        """
        return self.direct_sync_service.sync_single_entity(
            entity_type=entity_type,
            project_id=project_id,
            db=db
        )
    
    def _calculate_manhours_and_weights(
        self,
        project_id: str,
        db: Session
    ) -> Dict:
        """
        计算人工时和权重因子
        
        注意：这里需要将P6Activity数据转换为Activity表格式
        然后使用ActivityCalculationService进行计算
        
        Args:
            project_id: 项目ID
            db: 数据库会话
        
        Returns:
            计算结果字典
        """
        try:
            # 获取项目的所有P6Activity
            p6_activities = db.query(P6Activity).filter(
                P6Activity.project_id == project_id,
                P6Activity.is_active == True
            ).all()
            
            if not p6_activities:
                return {
                    "success": True,
                    "calculated": 0,
                    "message": "没有找到作业数据"
                }
            
            calculated_count = 0
            error_count = 0
            
            # 按project分组计算总人工时（用于权重计算）
            from app.models.facility import Facility
            from collections import defaultdict
            from decimal import Decimal
            
            project_man_hours = defaultdict(Decimal)
            
            # 第一步：计算所有活动的man_hours
            for p6_activity in p6_activities:
                try:
                    # 将P6Activity转换为Activity格式
                    # 注意：这里需要从P6ActivityCodeAssignment中提取scope, discipline等字段
                    # 然后创建或更新Activity记录
                    activity = self._sync_p6_activity_to_activity(p6_activity, db)
                    
                    if activity:
                        # 计算人工时
                        man_hours = self.calculation_service.calculate_man_hours(db, activity)
                        activity.man_hours = man_hours
                        
                        # 获取project（通过block关联Facility）
                        facility = db.query(Facility).filter(
                            Facility.block == activity.block,
                            Facility.is_active == True
                        ).first()
                        
                        project_key = facility.project if facility and facility.project else "DEFAULT"
                        project_man_hours[project_key] += man_hours
                        
                        calculated_count += 1
                        
                except Exception as e:
                    logger.warning(f"计算作业 {p6_activity.activity_id} 的人工时失败: {e}")
                    error_count += 1
                    continue
            
            db.commit()
            
            # 第二步：计算权重因子
            for p6_activity in p6_activities:
                try:
                    activity = db.query(ActivitySummary).filter(
                        ActivitySummary.activity_id == p6_activity.activity_id
                    ).first()
                    
                    if not activity or not activity.calculated_mhrs:
                        continue
                    
                    # 获取project
                    facility = db.query(Facility).filter(
                        Facility.block == activity.block,
                        Facility.is_active == True
                    ).first()
                    
                    project_key = facility.project if facility and facility.project else "DEFAULT"
                    project_total = project_man_hours[project_key]
                    
                    # 计算权重因子
                    weight_factor = self.calculation_service.calculate_weight_factor(
                        db, activity, Decimal(str(activity.calculated_mhrs)),
                        project_total_man_hours=project_total
                    )
                    activity.weight_factor = weight_factor
                    
                    # 计算实际权重因子（基于实际完成工时）
                    # actual_manhour = spe_mhrs * completed
                    actual_man_hours = Decimal('0')
                    if activity.spe_mhrs and activity.completed:
                        actual_man_hours = Decimal(str(activity.spe_mhrs)) * Decimal(str(activity.completed))
                    
                    if actual_man_hours > 0:
                        actual_weight_factor = self.calculation_service.calculate_actual_weight_factor(
                            db, activity, actual_man_hours, project_total_man_hours=project_total
                        )
                        activity.actual_weight_factor = actual_weight_factor
                    
                except Exception as e:
                    logger.warning(f"计算作业 {p6_activity.activity_id} 的权重失败: {e}")
                    error_count += 1
                    continue
            
            db.commit()
            
            return {
                "success": True,
                "calculated": calculated_count,
                "errors": error_count
            }
            
        except Exception as e:
            logger.error(f"计算人工时和权重失败: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }
    
    def _sync_p6_activity_to_activity(
        self,
        p6_activity: P6Activity,
        db: Session
    ) -> Optional[ActivitySummary]:
        """
        将P6Activity同步到ActivitySummary表
        
        注意：ActivitySummary 是只读汇总表，通常通过刷新脚本生成
        此方法仅用于特殊情况下的手动同步
        
        Args:
            p6_activity: P6Activity对象
            db: 数据库会话
        
        Returns:
            ActivitySummary对象
        """
        try:
            # 查找现有ActivitySummary
            activity = db.query(ActivitySummary).filter(
                ActivitySummary.activity_id == p6_activity.activity_id
            ).first()
            
            # 从P6ActivityCodeAssignment获取分类信息
            from app.p6_sync.models.activity_code_assignment import P6ActivityCodeAssignment
            
            code_assignments = db.query(P6ActivityCodeAssignment).filter(
                P6ActivityCodeAssignment.activity_object_id == p6_activity.object_id,
                P6ActivityCodeAssignment.is_active == True
            ).all()
            
            # 提取字段
            scope = None
            discipline = None
            work_package = None
            contract_phase = None
            block = None
            
            for assignment in code_assignments:
                code_type_name = assignment.activity_code_type_name
                code_value = assignment.activity_code_value
                
                if code_type_name == 'GCC_Scope':
                    scope = code_value
                elif code_type_name == 'Discipline':
                    discipline = code_value
                elif code_type_name == 'Work Package':
                    work_package = code_value
                elif code_type_name == 'Contract Phase':
                    contract_phase = code_value
                elif code_type_name == 'Block':
                    block = code_value
            
            # 准备Activity数据
            activity_data = {
                'activity_id': p6_activity.activity_id,
                'wbs': p6_activity.wbs_path or p6_activity.wbs_code,
                'title': p6_activity.name,
                'scope': scope,
                'discipline': discipline,
                'work_package': work_package,
                'contract_phase': contract_phase,
                'block': block,
            }
            
            if activity:
                # 更新
                for key, value in activity_data.items():
                    if key not in ('weight_factor', 'man_hours'):  # 这些字段通过计算获得
                        setattr(activity, key, value)
                activity.updated_at = datetime.now(timezone.utc)
            else:
                # 创建
                activity = Activity(**activity_data)
                db.add(activity)
            
            db.commit()
            db.refresh(activity)
            
            return activity
            
        except Exception as e:
            logger.warning(f"同步P6Activity到Activity失败: {e}")
            return None
