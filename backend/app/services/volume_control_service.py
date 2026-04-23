"""
VolumeControl 服务层
处理字段更新和历史记录
"""
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import Dict, Optional, Any
from datetime import datetime, timezone
from app.models.volume_control_quantity import VolumeControlQuantity, VolumeControlQuantityHistory
from app.utils.timezone import now as system_now
from app.utils.db import retry_on_deadlock
from app.models.volume_control_inspection import VolumeControlInspection, VolumeControlInspectionHistory
from app.models.volume_control_asbuilt import VolumeControlAsbuilt, VolumeControlAsbuiltHistory
from app.models.volume_control_payment import VolumeControlPayment, VolumeControlPaymentHistory


import time
from sqlalchemy.exc import OperationalError

class VolumeControlService:
    """VolumeControl服务类"""
    
    @staticmethod
    def update_quantity_field(
        db: Session,
        activity_id: str,
        field_name: str,
        new_value: Optional[float],
        updated_by: int,
        remarks: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        更新工程量及完工信息表的字段
        
        Args:
            db: 数据库会话
            activity_id: 作业ID
            field_name: 字段名
            new_value: 新值
            updated_by: 修改人ID
            remarks: 备注
            
        Returns:
            更新结果
        """
        # 获取或创建记录
        quantity = db.query(VolumeControlQuantity).filter(
            VolumeControlQuantity.activity_id == activity_id
        ).first()
        
        if not quantity:
            quantity = VolumeControlQuantity(activity_id=activity_id)
            db.add(quantity)
            db.flush()
        
        # 获取旧值
        old_value = getattr(quantity, field_name, None)
        
        # 如果值没有变化，不更新
        if old_value == new_value:
            return {
                "success": True,
                "message": "值未变化，无需更新",
                "data": quantity
            }
        
        # 更新字段值
        setattr(quantity, field_name, new_value)
        
        # 更新修改信息
        updated_at = system_now()
        setattr(quantity, f"{field_name}_updated_at", updated_at)
        setattr(quantity, f"{field_name}_updated_by", updated_by)
        
        # 创建历史记录
        history = VolumeControlQuantityHistory(
            activity_id=activity_id,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            updated_at=updated_at,
            updated_by=updated_by,
            remarks=remarks
        )
        db.add(history)
        
        db.commit()
        db.refresh(quantity)
        
        # 如果更新的是预估总量，同步更新 activity_summary 表的 key_qty 并重新计算人工时和权重
        if field_name == 'estimated_total':
            try:
                from app.services.activity_sync_service import ActivitySyncService
                ActivitySyncService.sync_activity_summary_from_vcq(db, activity_id)
            except Exception as e:
                # 同步失败不影响主表更新，记录日志即可
                import logging
                logging.getLogger(__name__).error(f"同步 activity_summary 失败: {e}")
        
        return {
            "success": True,
            "message": "更新成功",
            "data": quantity
        }
    
    @staticmethod
    def update_inspection_field(
        db: Session,
        activity_id: str,
        field_name: str,
        new_value: Optional[float],
        updated_by: int,
        remarks: Optional[str] = None
    ) -> Dict[str, Any]:
        """更新验收相关信息表的字段"""
        inspection = db.query(VolumeControlInspection).filter(
            VolumeControlInspection.activity_id == activity_id
        ).first()
        
        if not inspection:
            inspection = VolumeControlInspection(activity_id=activity_id)
            db.add(inspection)
            db.flush()
        
        old_value = getattr(inspection, field_name, None)
        
        if old_value == new_value:
            return {
                "success": True,
                "message": "值未变化，无需更新",
                "data": inspection
            }
        
        setattr(inspection, field_name, new_value)
        updated_at = system_now()
        setattr(inspection, f"{field_name}_updated_at", updated_at)
        setattr(inspection, f"{field_name}_updated_by", updated_by)
        
        history = VolumeControlInspectionHistory(
            activity_id=activity_id,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            updated_at=updated_at,
            updated_by=updated_by,
            remarks=remarks
        )
        db.add(history)
        
        db.commit()
        db.refresh(inspection)
        
        return {
            "success": True,
            "message": "更新成功",
            "data": inspection
        }
    
    @staticmethod
    def update_asbuilt_field(
        db: Session,
        activity_id: str,
        field_name: str,
        new_value: Optional[float],
        updated_by: int,
        remarks: Optional[str] = None
    ) -> Dict[str, Any]:
        """更新竣工资料相关信息表的字段"""
        asbuilt = db.query(VolumeControlAsbuilt).filter(
            VolumeControlAsbuilt.activity_id == activity_id
        ).first()
        
        if not asbuilt:
            asbuilt = VolumeControlAsbuilt(activity_id=activity_id)
            db.add(asbuilt)
            db.flush()
        
        old_value = getattr(asbuilt, field_name, None)
        
        if old_value == new_value:
            return {
                "success": True,
                "message": "值未变化，无需更新",
                "data": asbuilt
            }
        
        setattr(asbuilt, field_name, new_value)
        updated_at = system_now()
        setattr(asbuilt, f"{field_name}_updated_at", updated_at)
        setattr(asbuilt, f"{field_name}_updated_by", updated_by)
        
        history = VolumeControlAsbuiltHistory(
            activity_id=activity_id,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            updated_at=updated_at,
            updated_by=updated_by,
            remarks=remarks
        )
        db.add(history)
        
        db.commit()
        db.refresh(asbuilt)
        
        return {
            "success": True,
            "message": "更新成功",
            "data": asbuilt
        }
    
    @staticmethod
    def update_payment_field(
        db: Session,
        activity_id: str,
        field_name: str,
        new_value: Optional[float],
        updated_by: int,
        remarks: Optional[str] = None
    ) -> Dict[str, Any]:
        """更新收款相关信息表的字段"""
        payment = db.query(VolumeControlPayment).filter(
            VolumeControlPayment.activity_id == activity_id
        ).first()
        
        if not payment:
            payment = VolumeControlPayment(activity_id=activity_id)
            db.add(payment)
            db.flush()
        
        old_value = getattr(payment, field_name, None)
        
        if old_value == new_value:
            return {
                "success": True,
                "message": "值未变化，无需更新",
                "data": payment
            }
        
        setattr(payment, field_name, new_value)
        updated_at = system_now()
        setattr(payment, f"{field_name}_updated_at", updated_at)
        setattr(payment, f"{field_name}_updated_by", updated_by)
        
        history = VolumeControlPaymentHistory(
            activity_id=activity_id,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            updated_at=updated_at,
            updated_by=updated_by,
            remarks=remarks
        )
        db.add(history)
        
        db.commit()
        db.refresh(payment)
        
        return {
            "success": True,
            "message": "更新成功",
            "data": payment
        }
    
    @staticmethod
    def update_responsible(
        db: Session,
        activity_id: str,
        table_type: str,  # 'quantity', 'inspection', 'asbuilt', 'payment'
        responsible_user_id: Optional[int],
        updated_by: int,
        remarks: Optional[str] = None
    ) -> Dict[str, Any]:
        """更新责任人"""
        table_map = {
            'quantity': VolumeControlQuantity,
            'inspection': VolumeControlInspection,
            'asbuilt': VolumeControlAsbuilt,
            'payment': VolumeControlPayment,
        }
        
        history_map = {
            'quantity': VolumeControlQuantityHistory,
            'inspection': VolumeControlInspectionHistory,
            'asbuilt': VolumeControlAsbuiltHistory,
            'payment': VolumeControlPaymentHistory,
        }
        
        Model = table_map.get(table_type)
        HistoryModel = history_map.get(table_type)
        
        if not Model or not HistoryModel:
            return {
                "success": False,
                "message": f"无效的表类型: {table_type}"
            }
        
        record = db.query(Model).filter(
            Model.activity_id == activity_id
        ).first()
        
        if not record:
            record = Model(activity_id=activity_id)
            db.add(record)
            db.flush()
        
        old_value = record.responsible_user_id
        
        if old_value == responsible_user_id:
            return {
                "success": True,
                "message": "责任人未变化，无需更新",
                "data": record
            }
        
        record.responsible_user_id = responsible_user_id
        updated_at = system_now()
        record.responsible_updated_at = updated_at
        record.responsible_updated_by = updated_by
        
        # 创建历史记录
        history = HistoryModel(
            activity_id=activity_id,
            field_name='responsible_user_id',
            old_value=float(old_value) if old_value else None,
            new_value=float(responsible_user_id) if responsible_user_id else None,
            updated_at=updated_at,
            updated_by=updated_by,
            remarks=remarks
        )
        db.add(history)
        
        db.commit()
        db.refresh(record)
        
        return {
            "success": True,
            "message": "责任人更新成功",
            "data": record
        }
    
    @staticmethod
    def get_field_history(
        db: Session,
        activity_id: str,
        table_type: str,
        field_name: Optional[str] = None
    ) -> list:
        """获取字段历史记录"""
        history_map = {
            'quantity': VolumeControlQuantityHistory,
            'inspection': VolumeControlInspectionHistory,
            'asbuilt': VolumeControlAsbuiltHistory,
            'payment': VolumeControlPaymentHistory,
        }
        
        HistoryModel = history_map.get(table_type)
        if not HistoryModel:
            return []
        
        query = db.query(HistoryModel).filter(
            HistoryModel.activity_id == activity_id
        )
        
        if field_name:
            query = query.filter(HistoryModel.field_name == field_name)
        
        return query.order_by(HistoryModel.updated_at.desc()).all()
    
    @staticmethod
    @retry_on_deadlock(max_retries=3)
    def update_construction_completed_from_vfactdb(
        db: Session,
        activity_id: str,
        updated_by: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        从VFACTDB汇总数据自动更新construction_completed字段（已重构为使用 DataRefreshService）
        """
        from app.services.data_refresh_service import DataRefreshService
        result = DataRefreshService.refresh_all_for_activity(db, activity_id, updated_by)
        if result.get("success"):
            db.commit()
            # 兼容旧的返回值格式
            from app.models.volume_control_quantity import VolumeControlQuantity
            quantity = db.query(VolumeControlQuantity).filter(VolumeControlQuantity.activity_id == activity_id).first()
            return {
                "success": True,
                "message": "construction_completed更新成功",
                "data": quantity,
                "total_achieved": result.get("completed")
            }
        else:
            db.rollback()
            return result

