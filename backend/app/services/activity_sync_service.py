"""
作业清单同步服务
"""
from sqlalchemy.orm import Session
from sqlalchemy import func, text
import requests
from decimal import Decimal
from app.models.activity_summary import ActivitySummary
from app.models.report import MPDB, VFACTDB
from app.models.activity_status import ActivityStatusRecord
from app.models.volume_control import VolumeControl
from app.utils.db import retry_on_deadlock
from datetime import datetime, date
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)


import time
import requests
from sqlalchemy.exc import OperationalError

class ActivitySyncService:
    """作业清单同步服务类"""
    
    @staticmethod
    def _check_maintenance_mode() -> bool:
        """检查系统是否处于还原维护模式"""
        try:
            # 访问 system_admin 暴露的维护状态接口
            response = requests.get("http://127.0.0.1:8001/api/system/maintenance-status", timeout=2)
            if response.status_code == 200:
                return response.json().get("is_restoring", False)
        except:
            pass # 接口不可用时默认不阻塞
        return False

    @staticmethod
    def check_activity_locked(db: Session, activity_id: str):
        """
        检查单条作业是否锁定（保留此方法兼容单条操作）
        """
        if not activity_id:
            return

        status_record = db.query(ActivityStatusRecord).filter(
            ActivityStatusRecord.activity_id == activity_id
        ).first()

        if status_record and status_record.status == 'Completed':
            from fastapi import HTTPException
            raise HTTPException(
                status_code=403, 
                detail=f"作业 {activity_id} 已确认完成并锁定，禁止更新数据。如需修改请先在计划管理中重新打开该作业。"
            )

    @staticmethod
    def get_locked_activities(db: Session, activity_ids: List[str]) -> set:
        """
        批量获取已锁定的作业 ID 集合
        """
        if not activity_ids:
            return set()
        
        # 过滤掉空值
        activity_ids = [aid for aid in activity_ids if aid]
        if not activity_ids:
            return set()

        # 一次性查出所有已完成的作业 ID
        # 分批查询，防止 IN 子句过大（超过 1000 可能触发数据库限制）
        locked_set = set()
        for i in range(0, len(activity_ids), 1000):
            batch = activity_ids[i:i + 1000]
            locked = db.query(ActivityStatusRecord.activity_id).filter(
                ActivityStatusRecord.activity_id.in_(batch),
                ActivityStatusRecord.status == 'Completed'
            ).all()
            for r in locked:
                locked_set.add(r[0])
        
        return locked_set

    @staticmethod
    def complete_activity(db: Session, activity_id: str, confirmed_by: int, remarks: Optional[str] = None, patch_to_100: bool = False) -> Dict:
        """
        手动确认作业完成
        1. 验证完成比例（必须 >= 99.5%）
        2. 如果补齐，修正 VFACTDB 最后一条记录
        3. 计算实际完成日期 (MAX(date) from MPDB/VFACTDB)
        4. 更新状态记录
        """
        from app.utils.timezone import now as system_now
        from fastapi import HTTPException
        
        # 1. 获取作业及工程量信息
        activity = db.query(ActivitySummary).filter(ActivitySummary.activity_id == activity_id).first()
        if not activity:
            return {"success": False, "error": f"作业 {activity_id} 不存在"}

        # 获取预估总量
        from app.models.volume_control_quantity import VolumeControlQuantity
        vcq = db.query(VolumeControlQuantity).filter(VolumeControlQuantity.activity_id == activity_id).first()
        estimated_total = Decimal(str(vcq.estimated_total or 0)) if vcq else Decimal('0')
        completed = Decimal(str(activity.completed or 0))

        # 2. 校验完成比例
        if estimated_total > 0:
            # 使用 Decimal 进行比例计算，避免精度丢失
            ratio = completed / estimated_total
            threshold = Decimal('0.995')
            one_hundred = Decimal('1.0')
            
            if ratio < threshold:
                raise HTTPException(
                    status_code=400,
                    detail=f"作业 {activity_id} 完成比例仅为 {(ratio * 100).quantize(Decimal('0.01'))}%，未达到 99.5% 的强制关闭阈值。请继续填报数据或修正预估总量。"
                )
            
            # 如果在 99.5% - 100% 之间且请求补齐
            if ratio < one_hundred and patch_to_100:
                diff = estimated_total - completed
                # 寻找最后一条 VFACTDB 记录（按日期降序，ID降序）
                last_vfact = db.query(VFACTDB).filter(VFACTDB.activity_id == activity_id).order_by(VFACTDB.date.desc(), VFACTDB.id.desc()).first()
                if last_vfact:
                    last_vfact.achieved = Decimal(str(last_vfact.achieved or 0)) + diff
                    # VFACTDB 无 remarks 字段，用 update_method 记录补齐原因
                    last_vfact.update_method = "auto-adjusted to 100%"
                    # 更新 activity_summary 的缓存值
                    activity.completed = estimated_total
                    if activity.spe_mhrs and activity.spe_mhrs > 0:
                        activity.actual_manhour = Decimal(str(activity.spe_mhrs)) * estimated_total
                    db.flush()
                    if not remarks:
                        remarks = f"补齐量差 {diff.normalize():f} 并确认完成"
        else:
            # 如果预估总量为 0，但有完成量，允许直接关闭，不执行补齐
            if not remarks and completed > 0:
                remarks = f"预估总量为0，按实际完成量 {completed.normalize():f} 确认完成"

        # 3. 计算实际完成日期
        vfact_max = db.query(func.max(VFACTDB.date)).filter(VFACTDB.activity_id == activity_id).scalar()
        mp_max = db.query(func.max(MPDB.date)).filter(MPDB.activity_id == activity_id).scalar()
        
        dates = [d for d in [vfact_max, mp_max] if d is not None]
        finish_date = max(dates) if dates else system_now().date()

        # 4. 更新状态
        status_record = db.query(ActivityStatusRecord).filter(ActivityStatusRecord.activity_id == activity_id).first()
        if not status_record:
            status_record = ActivityStatusRecord(activity_id=activity_id)
            db.add(status_record)
        
        status_record.status = 'Completed'
        status_record.actual_finish_date = finish_date
        status_record.confirmed_by = confirmed_by
        status_record.confirmed_at = system_now()
        status_record.remarks = remarks
        
        activity.system_status = 'Completed'
        activity.actual_finish_date = finish_date
        
        try:
            db.commit()
            return {
                "success": True, 
                "activity_id": activity_id, 
                "status": "Completed", 
                "actual_finish_date": finish_date
            }
        except Exception as e:
            db.rollback()
            return {"success": False, "error": str(e)}

    @staticmethod
    def reopen_activity(db: Session, activity_id: str) -> Dict:
        """
        重新打开作业（解除锁定）
        智能识别状态：如果有数据则为 In Progress，无数据则为 Not Started
        """
        # 1. 获取作业信息
        activity = db.query(ActivitySummary).filter(ActivitySummary.activity_id == activity_id).first()
        if not activity:
            return {"success": False, "error": f"作业 {activity_id} 不存在"}

        # 2. 智能判断状态
        # 只要有完成量或实际工时，重新打开后就是 In Progress，否则就是 Not Started
        new_status = 'In Progress' if (activity.completed and activity.completed > 0) or (activity.actual_manhour and activity.actual_manhour > 0) else 'Not Started'

        # 3. 更新状态记录
        status_record = db.query(ActivityStatusRecord).filter(ActivityStatusRecord.activity_id == activity_id).first()
        if status_record:
            status_record.status = new_status
            status_record.actual_finish_date = None
            # 不清除确认人信息，留作审计，但更新备注
            status_record.remarks = f"已重新打开为 {new_status} (于 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')})"
        
        # 4. 同步更新汇总表
        activity.system_status = new_status
        activity.actual_finish_date = None
        
        try:
            db.commit()
            return {"success": True, "activity_id": activity_id, "status": new_status}
        except Exception as e:
            db.rollback()
            return {"success": False, "error": str(e)}

    @staticmethod
    @retry_on_deadlock(max_retries=3)
    def update_activity_from_reports(db: Session, activity_id: str) -> Dict:
        """
        根据日报数据更新作业的汇总数据（已重构为使用 DataRefreshService）
        """
        if not activity_id:
            return {"success": True, "message": "跳过空作业ID"}
            
        # 检查维护模式
        if ActivitySyncService._check_maintenance_mode():
            logger.warning(f"System is in maintenance (restore in progress). Skipping sync for {activity_id}")
            return {"success": False, "error": "系统维护中，暂停同步"}

        from app.services.data_refresh_service import DataRefreshService
        result = DataRefreshService.refresh_all_for_activity(db, activity_id)
        
        if result.get("success"):
            db.commit()
            return {
                "success": True,
                "activity_id": activity_id,
                "updated_fields": [
                    "actual_start_date",
                    "actual_finish_date",
                    "completed",
                    "actual_manhour",
                    "actual_weight_factor",
                    "system_status"
                ]
            }
        else:
            db.rollback()
            return result
    
    @staticmethod
    @retry_on_deadlock(max_retries=3)
    def update_activity_from_vfactdb(db: Session, activity_id: str, updated_by: Optional[int] = None) -> Dict:
        """
        从 VFACTDB 更新汇总数据（已重构为使用 DataRefreshService）
        """
        from app.services.data_refresh_service import DataRefreshService
        result = DataRefreshService.refresh_all_for_activity(db, activity_id, updated_by)
        if result.get("success"):
            db.commit()
            return {
                "success": True,
                "activity_id": activity_id,
                "updated_fields": ["completed", "actual_manhour"]
            }
        else:
            db.rollback()
            return result
    
    @staticmethod
    def batch_update_activities_from_reports(
        db: Session,
        activity_ids: List[str] = None
    ) -> Dict:
        """
        批量根据日报数据更新作业的实际开始和完成日期
        
        Args:
            db: 数据库会话
            activity_ids: 作业ID列表，如果为None则更新所有有日报记录的作业
            
        Returns:
            更新结果
        """
        try:
            if activity_ids is None:
                # 获取所有有MPDB记录的activity_id
                activity_ids_res = db.query(MPDB.activity_id).distinct().all()
                activity_ids = [res[0] for res in activity_ids_res if res[0]]
            
            updated_count = 0
            for activity_id in activity_ids:
                res = ActivitySyncService.update_activity_from_reports(db, activity_id)
                if res.get("success"):
                    updated_count += 1
                
                # 每100个作业提交一次
                if updated_count % 100 == 0:
                    db.commit()
            
            db.commit()
            return {
                "success": True,
                "total": len(activity_ids),
                "updated": updated_count
            }
        except Exception as e:
            logger.error(f"批量更新作业数据时出错: {e}")
            db.rollback()
            return {
                "success": False,
                "error": str(e)
            }
    
    @staticmethod
    @retry_on_deadlock(max_retries=3)
    def sync_activity_summary_from_vcq(db: Session, activity_id: str) -> Dict:
        """
        根据 volume_control_quantity 表同步更新 activity_summary 表的 key_qty
        并重新计算人工时和权重因子
        
        Args:
            db: 数据库会话
            activity_id: 作业ID
            
        Returns:
            更新结果
        """
        if not activity_id:
            return {"success": False, "error": "作业ID不能为空"}
            
        try:
            from app.models.volume_control_quantity import VolumeControlQuantity
            from app.services.activity_calculation_service import ActivityCalculationService
            
            # 1. 锁定 activity_summary 行，防止并发冲突
            activity = db.query(ActivitySummary).filter(
                ActivitySummary.activity_id == activity_id
            ).with_for_update().first()
            
            if not activity:
                return {"success": False, "error": f"作业 {activity_id} 不存在"}
                
            # 2. 获取 VolumeControlQuantity 数据
            vcq = db.query(VolumeControlQuantity).filter(
                VolumeControlQuantity.activity_id == activity_id
            ).first()
            
            if not vcq:
                return {"success": False, "error": f"作业 {activity_id} 的工程量记录不存在"}
                
            # 3. 同步 key_qty
            activity.key_qty = vcq.estimated_total
            
            # 4. 重新计算人工时和权重因子
            # 使用 commit=False，由本方法统一 commit
            ActivityCalculationService.calculate_and_update_activity(db, activity, commit=False)
            
            db.commit()
            # 重新获取最新的记录
            db.refresh(activity)
            
            return {
                "success": True,
                "activity_id": activity_id,
                "key_qty": float(activity.key_qty) if activity.key_qty else 0,
                "calculated_mhrs": float(activity.calculated_mhrs) if activity.calculated_mhrs else 0
            }
            
        except Exception as e:
            logger.error(f"同步 activity_summary 时出错: {e}")
            db.rollback()
            return {"success": False, "error": str(e)}

    @staticmethod
    def batch_sync_activity_summary_from_vcq(db: Session, activity_ids: List[str]) -> Dict:
        """
        批量高效同步（已重构为使用 DataRefreshService 的高性能批量模式）
        """
        from app.services.data_refresh_service import DataRefreshService
        result = DataRefreshService.batch_refresh_activities(db, activity_ids)
        if result.get("success"):
            db.commit()
        return result
