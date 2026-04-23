"""
Activity 业务服务层
实现业务规则约束
"""
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.activity_summary import ActivitySummary
from app.models.volume_control import VolumeControl
from app.models.report import MPDB, VFACTDB
from app.models.rsc import RSCDefine
from typing import Optional, List, Tuple
from fastapi import HTTPException


class ActivityService:
    """Activity 业务服务"""
    
    @staticmethod
    def can_delete_activity(db: Session, activity_id: str) -> Tuple[bool, str]:
        """
        检查是否可以删除 Activity
        
        业务规则：
        - MPDB 和 VFACTDB 中不能存在该 activity_id 的记录（事实表，不能丢失数据）
        
        Returns:
            (是否可以删除, 错误信息)
        """
        # 检查 MPDB 中是否存在该 activity_id
        mpdb_count = db.query(func.count(MPDB.id)).filter(
            MPDB.activity_id == activity_id
        ).scalar() or 0
        
        if mpdb_count > 0:
            return False, f"无法删除：MPDB 中存在 {mpdb_count} 条该活动的记录（事实表数据不能丢失）"
        
        # 检查 VFACTDB 中是否存在该 activity_id
        vfactdb_count = db.query(func.count(VFACTDB.id)).filter(
            VFACTDB.activity_id == activity_id
        ).scalar() or 0
        
        if vfactdb_count > 0:
            return False, f"无法删除：VFACTDB 中存在 {vfactdb_count} 条该活动的记录（事实表数据不能丢失）"
        
        return True, ""
    
    @staticmethod
    def delete_activity(db: Session, activity_id: str) -> bool:
        """
        删除 Activity（带业务规则检查）
        
        业务规则：
        1. 必须先删除 MPDB 和 VFACTDB 中的相关记录
        2. 删除 Activity 时，自动删除关联的 VolumeControl
        """
        activity = db.query(ActivitySummary).filter(ActivitySummary.activity_id == activity_id).first()
        if not activity:
            raise HTTPException(status_code=404, detail="Activity not found")
        
        # 检查是否可以删除
        can_delete, error_msg = ActivityService.can_delete_activity(db, activity_id)
        if not can_delete:
            raise HTTPException(status_code=400, detail=error_msg)
        
        # 删除关联的 VolumeControl（一对一关系）
        volume_control = db.query(VolumeControl).filter(
            VolumeControl.activity_id == activity_id
        ).first()
        if volume_control:
            db.delete(volume_control)
        
        # 删除 Activity
        db.delete(activity)
        db.commit()
        
        return True
    
    @staticmethod
    def create_activity_with_volume_control(
        db: Session,
        activity_data: dict,
        volume_control_data: Optional[dict] = None
    ) -> ActivitySummary:
        """
        创建 ActivitySummary 并自动创建关联的 VolumeControl
        
        注意：ActivitySummary 是只读汇总表，通常通过刷新脚本生成
        此方法仅用于特殊情况下的手动创建
        
        业务规则：
        - VolumeControl 只能通过 ActivitySummary 创建，不能独立创建
        """
        # 创建 ActivitySummary
        activity = ActivitySummary(**activity_data)
        db.add(activity)
        db.flush()  # 获取 activity.id
        
        # 自动创建 VolumeControl
        if volume_control_data is None:
            volume_control_data = {}
        
        volume_control = VolumeControl(
            activity_id=activity.activity_id,
            **volume_control_data
        )
        db.add(volume_control)
        
        db.commit()
        db.refresh(activity)
        
        return activity
    
    @staticmethod
    def update_volume_control(
        db: Session,
        activity_id: str,
        volume_control_data: dict
    ) -> VolumeControl:
        """
        更新 VolumeControl（只能修改，不能新增/删除）
        
        业务规则：
        - VolumeControl 只能修改信息，不能独立新增/删除
        - 如果不存在，自动创建（与 Activity 保持同步）
        """
        volume_control = db.query(VolumeControl).filter(
            VolumeControl.activity_id == activity_id
        ).first()
        
        if not volume_control:
            # 如果不存在，自动创建（保持同步）
            volume_control = VolumeControl(activity_id=activity_id, **volume_control_data)
            db.add(volume_control)
        else:
            # 更新现有记录
            for key, value in volume_control_data.items():
                setattr(volume_control, key, value)
        
        db.commit()
        db.refresh(volume_control)
        
        return volume_control


class RSCDefineService:
    """RSCDefine 业务服务"""
    
    @staticmethod
    def can_delete_rsc_define(db: Session, work_package: str) -> Tuple[bool, str]:
        """
        检查是否可以删除 RSCDefine
        
        业务规则：
        - Activity 表中不能存在该 work_package 的记录
        """
        activity_count = db.query(func.count(ActivitySummary.id)).filter(
            ActivitySummary.work_package == work_package
        ).scalar() or 0
        
        if activity_count > 0:
            return False, f"无法删除：ActivitySummary 中存在 {activity_count} 条使用该工作包的记录"
        
        return True, ""
    
    @staticmethod
    def delete_rsc_define(db: Session, rsc_define_id: int) -> bool:
        """
        删除 RSCDefine（带业务规则检查）
        """
        rsc_define = db.query(RSCDefine).filter(RSCDefine.id == rsc_define_id).first()
        if not rsc_define:
            raise HTTPException(status_code=404, detail="RSCDefine not found")
        
        # 检查是否可以删除
        can_delete, error_msg = RSCDefineService.can_delete_rsc_define(
            db, rsc_define.work_package
        )
        if not can_delete:
            raise HTTPException(status_code=400, detail=error_msg)
        
        db.delete(rsc_define)
        db.commit()
        
        return True

