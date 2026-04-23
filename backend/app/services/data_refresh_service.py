"""
数据刷新统一服务 - 解决数据不一致和死锁问题
"""
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from decimal import Decimal
import logging
from typing import Optional, List, Dict, Any
from app.models.activity_summary import ActivitySummary
from app.models.report import MPDB, VFACTDB
from app.models.volume_control_quantity import VolumeControlQuantity, VolumeControlQuantityHistory
from app.models.activity_status import ActivityStatusRecord
from app.utils.timezone import now as system_now
from app.utils.db import retry_on_deadlock
from datetime import date

logger = logging.getLogger(__name__)

class DataRefreshService:
    """
    统一数据刷新服务，确保 activity_summary 和 volume_control_quantity 数据一致性。
    
    设计原则：
    1. 严格锁定顺序：始终先锁定 ActivitySummary，再锁定 VolumeControlQuantity，防止死锁。
    2. 原子性：内部方法不执行 commit，由高层业务逻辑统一控制事务。
    3. 幂等性：支持重复调用，结果保持一致。
    """
    
    @staticmethod
    @retry_on_deadlock(max_retries=3)  # 引入 SKIP LOCKED 后无需过多重试
    def refresh_all_for_activity(db: Session, activity_id: str, updated_by: Optional[int] = None) -> Dict[str, Any]:
        """
        刷新作业相关的所有汇总数据（核心入口）
        优化策略：计算优先，持锁时间最小化，并使用 SKIP LOCKED 避免死等。
        """
        if not activity_id:
            return {"success": False, "error": "作业ID不能为空"}

        from app.services.system_task_service import SystemTaskService
        # 1. 第一层避让：如果有高优先级任务（日报上传等），直接跳过
        if SystemTaskService.is_any_high_priority_task_active(exclude_tasks=["activity_summary_refresh", "background_refresh"]):
            logger.info("检测到高优先级系统任务运行中，本次汇总刷新避让跳过 activity_id=%s", activity_id)
            return {"success": True, "skipped": True, "message": "检测到其他任务运行中，避让跳过"}

        try:
            # --- 第一阶段：预计算（无锁状态下进行耗时操作） ---
            
            # 计算 VFACTDB 汇总数据
            vfact_result = db.query(
                func.sum(VFACTDB.achieved).label("total_achieved"),
                func.min(VFACTDB.date).label("min_date")
            ).filter(VFACTDB.activity_id == activity_id).first()
            
            total_achieved = Decimal(str(vfact_result.total_achieved or 0))
            vfact_min_date = vfact_result.min_date
            
            # 计算 MPDB 日期
            mpdb_min_date = db.query(func.min(MPDB.date)).filter(MPDB.activity_id == activity_id).scalar()
            
            # 确定实际开始日期
            dates = [d for d in [vfact_min_date, mpdb_min_date] if d is not None]
            earliest_date = min(dates) if dates else None

            # 获取当前 Activity 基础信息用于计算 (不加锁)
            base_activity = db.query(ActivitySummary).filter(ActivitySummary.activity_id == activity_id).first()
            if not base_activity:
                logger.info(f"作业 {activity_id} 不存在，跳过。")
                return {"success": True, "message": f"作业 {activity_id} 不存在"}

            # 计算人工时、权重等耗时业务
            from app.services.activity_calculation_service import ActivityCalculationService
            man_hours = ActivityCalculationService.calculate_man_hours(db, base_activity)
            weight_factor = ActivityCalculationService.calculate_weight_factor(db, base_activity, man_hours)
            
            spe_mhrs = Decimal(str(base_activity.spe_mhrs or 0))
            actual_manhour = spe_mhrs * total_achieved
            actual_weight_factor = ActivityCalculationService.calculate_actual_weight_factor(db, base_activity, actual_manhour)

            # 查询状态
            status_record = db.query(ActivityStatusRecord).filter(ActivityStatusRecord.activity_id == activity_id).first()
            new_status = 'Not Started'
            new_finish_date = None
            if status_record and status_record.status == 'Completed':
                new_status = 'Completed'
                new_finish_date = status_record.actual_finish_date
            elif total_achieved > 0 or actual_manhour > 0:
                new_status = 'In Progress'

            # --- 第二阶段：极短持锁更新 ---
            
            # 使用 SKIP LOCKED 尝试获取锁。如果已被锁定（如批量更新中），则直接跳过，不报 1205。
            # 这确保了如果有人正在刷新这一行，我们不会去死等。
            activity = db.query(ActivitySummary).filter(
                ActivitySummary.activity_id == activity_id
            ).with_for_update(skip_locked=True).first()
            
            if not activity:
                # 再次确认是否是因为被锁定而跳过
                exists = db.query(ActivitySummary.id).filter(ActivitySummary.activity_id == activity_id).first()
                if exists:
                    logger.info(f"作业 {activity_id} 正在被其他任务处理中（已锁定），跳过本次单条刷新。")
                    return {"success": True, "skipped": True, "message": "已锁定，跳过"}
                return {"success": True, "message": "不存在"}

            # 锁定相关 VCQ (同样使用 skip_locked)
            vcq = db.query(VolumeControlQuantity).filter(
                VolumeControlQuantity.activity_id == activity_id
            ).with_for_update(skip_locked=True).first()
            
            if not vcq:
                # 如果 VCQ 被锁定（虽然概率极低），我们也跳过，避免死等
                vcq_exists = db.query(VolumeControlQuantity.id).filter(VolumeControlQuantity.activity_id == activity_id).first()
                if vcq_exists:
                    logger.info(f"作业 {activity_id} 的工程量表正在被锁定，跳过。")
                    return {"success": True, "skipped": True, "message": "VCQ已锁定"}
                
                vcq = VolumeControlQuantity(activity_id=activity_id)
                db.add(vcq)
                db.flush()
            
            # 更新字段（使用第一阶段预计算的结果）
            activity.completed = total_achieved
            activity.calculated_mhrs = man_hours
            activity.weight_factor = weight_factor
            activity.actual_manhour = actual_manhour
            activity.actual_weight_factor = actual_weight_factor
            activity.system_status = new_status
            activity.actual_finish_date = new_finish_date
            
            if earliest_date:
                if not activity.actual_start_date or earliest_date < activity.actual_start_date:
                    activity.actual_start_date = earliest_date
            elif not total_achieved and not actual_manhour:
                # 如果没有完成量也没有人工时，重置开始日期
                activity.actual_start_date = None

            # 更新 VCQ
            old_vcq_completed = vcq.construction_completed or Decimal('0')
            if old_vcq_completed != total_achieved:
                vcq.construction_completed = total_achieved
                if updated_by:
                    now = system_now()
                    vcq.construction_completed_updated_at = now
                    vcq.construction_completed_updated_by = updated_by
                    db.add(VolumeControlQuantityHistory(
                        activity_id=activity_id, field_name='construction_completed',
                        old_value=old_vcq_completed, new_value=total_achieved,
                        updated_at=now, updated_by=updated_by, remarks='[DataRefreshService] 自动汇总更新'
                    ))
            
            activity.updated_at = system_now()
            vcq.updated_at = system_now()
            db.flush()
            
            return {
                "success": True,
                "activity_id": activity_id,
                "completed": float(total_achieved),
                "system_status": activity.system_status
            }
            
        except Exception as e:
            logger.error(f"刷新作业数据失败 {activity_id}: {str(e)}", exc_info=True)
            return {"success": False, "error": str(e)}
        # 移除 finally 块中的解锁逻辑，因为单条刷新不再加锁

    @staticmethod
    @retry_on_deadlock(max_retries=5)
    def batch_refresh_activities(db: Session, activity_ids: List[str], updated_by: Optional[int] = None) -> Dict[str, Any]:
        """
        高性能批量刷新作业数据 (Set-based)
        适合 1000 条以上的规模，保持极高速度。
        """
        if not activity_ids:
            return {"success": True, "count": 0}
            
        # 过滤重复和空值
        activity_ids = list(set([aid for aid in activity_ids if aid]))
        total_count = len(activity_ids)
        
        # 分批处理，防止 SQL 过长 (每批 1000 条)
        batch_size = 1000
        for i in range(0, total_count, batch_size):
            batch = activity_ids[i:i + batch_size]
            # 排序以防止死锁
            batch.sort()
            
            # 1. 批量同步到 activity_summary (工程量、工时)
            # 这里的 SQL 逻辑整合了核心计算公式，并显式更新 updated_at
            db.execute(text("""
                UPDATE activity_summary a
                LEFT JOIN (
                    SELECT activity_id, SUM(achieved) as total FROM vfactdb WHERE activity_id IN :batch_ids GROUP BY activity_id
                ) v ON a.activity_id = v.activity_id
                SET 
                    a.completed = COALESCE(v.total, 0),
                    a.actual_manhour = COALESCE(a.spe_mhrs, 0) * COALESCE(v.total, 0),
                    a.updated_at = NOW()
                WHERE a.activity_id IN :batch_ids
            """), {"batch_ids": batch})

            # 2. 批量更新 volume_control_quantity (从 VFACTDB 汇总)
            # 2a. 先按 batch 内所有 activity_id 用 LEFT JOIN 汇总更新（含“原先有 VFACTDB、后来没有”的归零）
            #     这样在清空全部 VFACTDB 后，construction_completed 会正确变为 0
            db.execute(text("""
                UPDATE volume_control_quantity vq
                LEFT JOIN (
                    SELECT activity_id, SUM(achieved) as total
                    FROM vfactdb
                    WHERE activity_id IN :batch_ids
                    GROUP BY activity_id
                ) v ON vq.activity_id = v.activity_id
                SET
                    vq.construction_completed = COALESCE(v.total, 0),
                    vq.construction_completed_updated_at = NOW(),
                    vq.construction_completed_updated_by = :updated_by,
                    vq.updated_at = NOW()
                WHERE vq.activity_id IN :batch_ids
            """), {"batch_ids": batch, "updated_by": updated_by})
            # 2b. 对 VFACTDB 有数据的 activity_id 做 INSERT（补建缺失的 vcq 行），避免仅 2a 时漏建新行
            db.execute(text("""
                INSERT INTO volume_control_quantity (activity_id, construction_completed, construction_completed_updated_at, construction_completed_updated_by, updated_at)
                SELECT
                    v.activity_id,
                    SUM(v.achieved) as total,
                    NOW(),
                    :updated_by,
                    NOW()
                FROM vfactdb v
                WHERE v.activity_id IN :batch_ids
                GROUP BY v.activity_id
                ON DUPLICATE KEY UPDATE
                    construction_completed = VALUES(construction_completed),
                    construction_completed_updated_at = VALUES(construction_completed_updated_at),
                    construction_completed_updated_by = VALUES(construction_completed_updated_by),
                    updated_at = VALUES(updated_at)
            """), {"batch_ids": batch, "updated_by": updated_by})
            
            # 3. 批量更新日期 (actual_start_date)
            db.execute(text("""
                UPDATE activity_summary a
                LEFT JOIN (
                    SELECT activity_id, MIN(min_date) as start_date
                    FROM (
                        SELECT activity_id, MIN(date) as min_date FROM vfactdb WHERE activity_id IN :batch_ids GROUP BY activity_id
                        UNION ALL
                        SELECT activity_id, MIN(date) as min_date FROM mpdb WHERE activity_id IN :batch_ids GROUP BY activity_id
                    ) combined
                    GROUP BY activity_id
                ) t ON a.activity_id = t.activity_id
                SET a.actual_start_date = CASE 
                    WHEN a.actual_start_date IS NULL OR (t.start_date IS NOT NULL AND t.start_date < a.actual_start_date) THEN t.start_date
                    ELSE a.actual_start_date END
                WHERE a.activity_id IN :batch_ids
            """), {"batch_ids": batch})

            # 4. 批量计算权重因子和状态
            db.execute(text("""
                UPDATE activity_summary a
                SET a.actual_weight_factor = CASE 
                    WHEN COALESCE(a.spe_mhrs, 0) > 0 AND COALESCE(a.calculated_mhrs, 0) > 0 THEN 
                        (COALESCE(a.completed, 0) / a.spe_mhrs * 10.0) / a.calculated_mhrs * 254137500
                    ELSE 0 END,
                    a.system_status = CASE 
                        WHEN (SELECT status FROM activity_status_records WHERE activity_id = a.activity_id) = 'Completed' THEN 'Completed'
                        WHEN a.completed > 0 THEN 'In Progress'
                        ELSE 'Not Started' END
                WHERE a.activity_id IN :batch_ids
            """), {"batch_ids": batch})

            # 每批 commit 一次，缩短持锁时间，从根源上减少与后台 refresh 的锁冲突/死锁
            db.commit()
        
        return {
            "success": True,
            "total": total_count,
            "message": f"高性能批量刷新完成，共 {total_count} 条记录"
        }
