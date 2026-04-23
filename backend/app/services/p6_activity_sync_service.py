"""
P6作业清单完整同步服务
整合数据抓取、转换、计算和更新
"""
from sqlalchemy.orm import Session
from typing import Dict, List, Optional
from datetime import datetime, timezone
import logging

from app.services.p6_sync_service import P6SyncService
from app.services.p6_activity_transform_service import P6ActivityTransformService
from app.services.activity_calculation_service import ActivityCalculationService
from app.models.activity_summary import ActivitySummary
from app.database import SessionLocal

logger = logging.getLogger(__name__)


class P6ActivitySyncService:
    """P6作业清单完整同步服务"""
    
    def __init__(self):
        self.p6_service = P6SyncService()
        self.transform_service = P6ActivityTransformService()
        self.calculation_service = ActivityCalculationService()
    
    def sync_project_activities(
        self,
        project_id: str,
        sync_mode: str = "full",
        db: Optional[Session] = None
    ) -> Dict:
        """
        同步项目的所有作业数据
        
        Args:
            project_id: P6项目ID
            sync_mode: 同步模式
                - "full": 全量同步（删除后重新导入）
                - "incremental": 增量同步（只同步新增/修改的）
            db: 数据库会话，如果为None则创建新会话
            
        Returns:
            同步结果字典
        """
        if not db:
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
            
            logger.info(f"开始同步项目 {project_id} 的作业数据（模式: {sync_mode}）")
            
            # 步骤1: 从P6获取作业数据
            logger.info("步骤1: 从P6获取作业数据...")
            p6_activities, activity_code_map = self._fetch_p6_data(project_id)
            
            if not p6_activities:
                return {
                    "success": False,
                    "error": "未获取到作业数据"
                }
            
            logger.info(f"✓ 获取到 {len(p6_activities)} 条作业数据")
            logger.info(f"✓ 获取到 {len(activity_code_map)} 个作业的ActivityCodeAssignment")
            
            # 步骤2: 转换数据格式
            logger.info("步骤2: 转换数据格式...")
            activity_data_list = self.transform_service.batch_transform(
                p6_activities,
                activity_code_map
            )
            logger.info(f"✓ 转换完成，共 {len(activity_data_list)} 条数据")
            
            # 步骤3: 同步到数据库
            logger.info("步骤3: 同步到数据库...")
            sync_result = self._sync_to_database(
                activity_data_list,
                sync_mode,
                db
            )
            
            # 步骤4: 计算人工时和权重
            logger.info("步骤4: 计算人工时和权重...")
            calculation_result = self._calculate_manhours_and_weights(
                activity_data_list,
                db
            )
            
            return {
                "success": True,
                "sync_result": sync_result,
                "calculation_result": calculation_result,
                "total_activities": len(activity_data_list)
            }
            
        except Exception as e:
            logger.error(f"同步失败: {e}")
            import traceback
            logger.error(traceback.format_exc())
            db.rollback()
            return {
                "success": False,
                "error": str(e)
            }
        finally:
            if should_close:
                db.close()
    
    def _fetch_p6_data(
        self,
        project_id: str
    ) -> tuple[List[Dict], Dict[int, List[Dict]]]:
        """
        从P6获取作业数据和ActivityCodeAssignment
        
        Returns:
            (p6_activities, activity_code_map)
        """
        # 选择项目
        self.p6_service.app.select_project(projectId=project_id)
        
        # 获取作业数据（使用优化后的字段列表）
        activity_fields = [
            'ProjectObjectId', 'ObjectId', 'WBSObjectId', 'WBSCode', 'WBSPath',
            'Id', 'Type', 'Name', 'StatusCode',
            'IsCritical', 'IsLongestPath',
            'ActualDuration', 'ActualStartDate', 'ActualFinishDate',
            'AtCompletionDuration',
            'StartDate', 'FinishDate',
            'PlannedDuration', 'PlannedStartDate', 'PlannedFinishDate',
            'Baseline1StartDate', 'Baseline1FinishDate'
        ]
        
        p6_activities = self.p6_service.app.activity.read(fields=activity_fields)
        
        if not isinstance(p6_activities, list):
            logger.error(f"获取作业数据失败: {type(p6_activities)}")
            return [], {}
        
        # 获取ActivityCodeAssignment
        code_assignment_fields = [
            'ActivityObjectId', 'ActivityId', 'ActivityName',
            'ActivityCodeTypeName', 'ActivityCodeTypeObjectId', 'ActivityCodeTypeScope',
            'ActivityCodeValue', 'ActivityCodeDescription', 'ProjectObjectId'
        ]
        
        all_code_assignments = self.p6_service.app.activityCodeAssignment.read(
            fields=code_assignment_fields
        )
        
        # 按ActivityObjectId分组
        activity_code_map = {}
        selected_object_id = self.p6_service.app.eppmSession.selectedProjectObjectId
        
        if isinstance(all_code_assignments, list):
            for assignment in all_code_assignments:
                if isinstance(assignment, dict):
                    assignment_project_id = assignment.get('ProjectObjectId')
                    if assignment_project_id == selected_object_id:
                        activity_obj_id = assignment.get('ActivityObjectId')
                        if activity_obj_id:
                            if activity_obj_id not in activity_code_map:
                                activity_code_map[activity_obj_id] = []
                            activity_code_map[activity_obj_id].append(assignment)
        
        return p6_activities, activity_code_map
    
    def _sync_to_database(
        self,
        activity_data_list: List[Dict],
        sync_mode: str,
        db: Session
    ) -> Dict:
        """
        同步数据到数据库
        
        Args:
            activity_data_list: Activity格式的数据列表
            sync_mode: 同步模式
            db: 数据库会话
        """
        created_count = 0
        updated_count = 0
        skipped_count = 0
        
        for activity_data in activity_data_list:
            activity_id = activity_data.get('activity_id')
            if not activity_id:
                skipped_count += 1
                continue
            
            # 查找现有作业
            existing = db.query(ActivitySummary).filter(
                ActivitySummary.activity_id == activity_id
            ).first()
            
            if existing:
                # 更新现有作业（注意：ActivitySummary 是只读汇总表，通常通过刷新脚本生成）
                # 排除以下字段，这些字段由系统自动计算或从日报数据更新：
                # - weight_factor, calculated_mhrs: 通过计算服务计算
                # - completed, actual_manhour: 从 VFACTDB/MPDB 日报数据实时更新
                excluded_fields = ['weight_factor', 'calculated_mhrs', 'completed', 'actual_manhour']
                for key, value in activity_data.items():
                    if key not in excluded_fields:
                        setattr(existing, key, value)
                existing.updated_at = datetime.now(timezone.utc)
                updated_count += 1
            else:
                # 创建新作业（注意：ActivitySummary 是只读汇总表，通常通过刷新脚本生成）
                new_activity = ActivitySummary(**activity_data)
                db.add(new_activity)
                created_count += 1
        
        db.commit()
        
        return {
            "created": created_count,
            "updated": updated_count,
            "skipped": skipped_count
        }
    
    def _calculate_manhours_and_weights(
        self,
        activity_data_list: List[Dict],
        db: Session
    ) -> Dict:
        """
        计算人工时和权重因子
        
        Args:
            activity_data_list: Activity格式的数据列表
            db: 数据库会话
        """
        calculated_count = 0
        error_count = 0
        
        # 按project分组计算总人工时（用于权重计算）
        # 这里简化处理，实际应该按project分组
        total_man_hours = None
        
        for activity_data in activity_data_list:
            activity_id = activity_data.get('activity_id')
            if not activity_id:
                continue
            
            activity = db.query(ActivitySummary).filter(
                ActivitySummary.activity_id == activity_id
            ).first()
            
            if not activity:
                continue
            
            try:
                # 计算人工时
                man_hours = self.calculation_service.calculate_man_hours(db, activity)
                
                # 计算权重因子
                weight_factor = self.calculation_service.calculate_weight_factor(
                    db,
                    activity,
                    man_hours,
                    project_total_man_hours=total_man_hours
                )
                
                # 更新到数据库
                activity.man_hours = float(man_hours) if man_hours else None
                activity.weight_factor = float(weight_factor) if weight_factor else None
                
                calculated_count += 1
                
            except Exception as e:
                logger.warning(f"计算作业 {activity_id} 的人工时/权重失败: {e}")
                error_count += 1
                continue
        
        db.commit()
        
        return {
            "calculated": calculated_count,
            "errors": error_count
        }
