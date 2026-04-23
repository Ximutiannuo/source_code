"""
活动人工时和权重因子计算服务
根据宏代码 a_genActivityList_c.bas 的逻辑实现
"""
from sqlalchemy.orm import Session
from sqlalchemy import func
from decimal import Decimal
from typing import Optional
from app.models.activity_summary import ActivitySummary
from app.models.volume_control import VolumeControl
from app.models.rsc import RSCDefine
from app.models.report import VFACTDB, MPDB


class ActivityCalculationService:
    """活动计算服务"""
    
    # 默认配置参数（后续可以从配置表读取）
    DEFAULT_HOURS_PER_DAY = Decimal('10')  # 人工天转人工时系数（10小时/天）
    DEFAULT_WEIGHT_FACTOR_BASE = Decimal('254137500')  # 权重因子基数（分配给施工的权重）
    
    # 配置键常量
    CONFIG_KEY_HOURS_PER_DAY = "calculation.hours_per_day"
    CONFIG_KEY_WEIGHT_FACTOR_BASE = "calculation.weight_factor_base"
    
    @classmethod
    def get_config_value(cls, db: Session, config_key: str, default_value: Decimal) -> Decimal:
        """
        从系统配置表获取配置值
        
        Args:
            db: 数据库会话
            config_key: 配置键
            default_value: 默认值
            
        Returns:
            配置值（Decimal）
        """
        try:
            from app.models.config import SystemConfig
            config = db.query(SystemConfig).filter(
                SystemConfig.key == config_key,
                SystemConfig.is_active == True
            ).first()
            
            if config and config.value:
                if config.value_type == "decimal" or config.value_type == "number":
                    return Decimal(str(config.value))
                else:
                    return Decimal(str(config.value))
            else:
                return default_value
        except Exception:
            # 如果读取配置失败，返回默认值
            return default_value
    
    @classmethod
    def calculate_man_hours(
        cls,
        db: Session,
        activity: ActivitySummary,
        hours_per_day: Optional[Decimal] = None,
        use_config: bool = True
    ) -> Decimal:
        """
        计算活动的总人工时
        
        逻辑：
        1. 从 VolumeControl 获取 keyqty (estimated_total)
        2. 从 RSCDefine 获取 unit_manhour (norms_mp) 和 uom
        3. 总人工时 = unit_manhour * keyqty
        
        Args:
            db: 数据库会话
            activity: 活动对象
            hours_per_day: 人工天转人工时系数，默认 10
            
        Returns:
            总人工时（Decimal）
        """
        if hours_per_day is None:
            if use_config:
                hours_per_day = cls.get_config_value(
                    db, cls.CONFIG_KEY_HOURS_PER_DAY, cls.DEFAULT_HOURS_PER_DAY
                )
            else:
                hours_per_day = cls.DEFAULT_HOURS_PER_DAY
        
        # 1. 优先获取 VolumeControlQuantity 的 estimated_total，其次是旧的 VolumeControl
        from app.models.volume_control_quantity import VolumeControlQuantity
        
        vcq = db.query(VolumeControlQuantity).filter(
            VolumeControlQuantity.activity_id == activity.activity_id
        ).first()
        
        if vcq and vcq.estimated_total is not None:
            keyqty = Decimal(str(vcq.estimated_total))
        else:
            volume_control = db.query(VolumeControl).filter(
                VolumeControl.activity_id == activity.activity_id
            ).first()
            if not volume_control or not volume_control.estimated_total:
                return Decimal('0')
            keyqty = Decimal(str(volume_control.estimated_total))
        
        # 2. 获取 RSCDefine 的 unit_manhour (norms_mp)
        rsc_define = db.query(RSCDefine).filter(
            RSCDefine.work_package == activity.work_package,
            RSCDefine.is_active == True
        ).first()
        
        if not rsc_define or not rsc_define.norms_mp:
            return Decimal('0')
        
        unit_manhour = Decimal(str(rsc_define.norms_mp))
        
        # 3. 计算总人工时 = unit_manhour * keyqty
        total_man_hours = unit_manhour * keyqty
        
        # 4. 特殊处理 PI08 工作包
        if activity.work_package == "PI08":
            # 根据宏代码：PI08 的人工时 = 相同 simple_block 的 PI05 工作包总人工时 * 0.3
            # 需要从 Facility 表获取 simple_block
            from app.models.facility import Facility
            
            facility = db.query(Facility).filter(
                Facility.block == activity.block,
                Facility.is_active == True
            ).first()
            
            if facility and facility.simple_block:
                # 查找相同 simple_block 的 PI05 工作包的总人工时
                pi05_activities = db.query(ActivitySummary).join(
                    Facility, ActivitySummary.block == Facility.block
                ).filter(
                    Facility.simple_block == facility.simple_block,
                    ActivitySummary.work_package == "PI05"
                ).all()
                
                pi05_total_man_hours = Decimal('0')
                for pi05_activity in pi05_activities:
                    pi05_man_hours = cls.calculate_man_hours(db, pi05_activity, hours_per_day)
                    pi05_total_man_hours += pi05_man_hours
                
                # PI08 人工时 = PI05 总人工时 * 0.3
                total_man_hours = pi05_total_man_hours * Decimal('0.3')
        
        return total_man_hours
    
    @classmethod
    def calculate_weight_factor(
        cls,
        db: Session,
        activity: ActivitySummary,
        man_hours: Decimal,
        project_total_man_hours: Optional[Decimal] = None,
        weight_factor_base: Optional[Decimal] = None,
        use_config: bool = True
    ) -> Decimal:
        """
        计算活动的权重因子值
        
        逻辑：
        1. 按 project 分组，计算项目总人工时
        2. 权重因子百分比 = 该活动人工时 / 项目总人工时
        3. 权重因子值 = 权重因子百分比 * weight_factor_base
        
        Args:
            db: 数据库会话
            activity: 活动对象
            man_hours: 该活动的总人工时
            project_total_man_hours: 项目总人工时（如果提供，则使用；否则重新计算）
            weight_factor_base: 权重因子基数，默认 254137500
            
        Returns:
            权重因子值（Decimal）
        """
        if weight_factor_base is None:
            if use_config:
                weight_factor_base = cls.get_config_value(
                    db, cls.CONFIG_KEY_WEIGHT_FACTOR_BASE, cls.DEFAULT_WEIGHT_FACTOR_BASE
                )
            else:
                weight_factor_base = cls.DEFAULT_WEIGHT_FACTOR_BASE
        
        if man_hours == 0:
            return Decimal('0')
        
        # 1. 获取项目总人工时
        if project_total_man_hours is None:
            # 从 Facility 表通过 block 关联获取 project
            from app.models.facility import Facility
            
            facility = db.query(Facility).filter(
                Facility.block == activity.block,
                Facility.is_active == True
            ).first()
            
            # 使用 SQL 聚合计算总人工时，而不是在 Python 中遍历
            # 逻辑：SUM(rsc.norms_mp * COALESCE(vcq.estimated_total, vc.estimated_total))
            from app.models.volume_control_quantity import VolumeControlQuantity
            from app.models.volume_control import VolumeControl
            
            query = db.query(
                func.sum(
                    RSCDefine.norms_mp * func.coalesce(
                        VolumeControlQuantity.estimated_total,
                        VolumeControl.estimated_total,
                        0
                    )
                )
            ).join(
                ActivitySummary, ActivitySummary.work_package == RSCDefine.work_package
            ).outerjoin(
                VolumeControlQuantity, ActivitySummary.activity_id == VolumeControlQuantity.activity_id
            ).outerjoin(
                VolumeControl, ActivitySummary.activity_id == VolumeControl.activity_id
            ).filter(
                RSCDefine.is_active == True
            )
            
            if facility and facility.project:
                # 按 project 过滤
                query = query.join(
                    Facility, ActivitySummary.block == Facility.block
                ).filter(
                    Facility.project == facility.project,
                    Facility.is_active == True
                )
            
            total_project_man_hours = Decimal(str(query.scalar() or 0))
        else:
            total_project_man_hours = project_total_man_hours
        
        if total_project_man_hours == 0:
            return Decimal('0')
        
        # 2. 计算权重因子百分比
        weight_factor_percentage = man_hours / total_project_man_hours
        
        # 3. 计算权重因子值
        weight_factor_value = weight_factor_percentage * weight_factor_base
        
        return weight_factor_value
    
    @classmethod
    def calculate_actual_weight_factor(
        cls,
        db: Session,
        activity: ActivitySummary,
        actual_man_hours: Decimal,
        project_total_man_hours: Optional[Decimal] = None,
        weight_factor_base: Optional[Decimal] = None,
        use_config: bool = True
    ) -> Decimal:
        """
        计算活动的实际权重因子值（基于实际完成工时）
        
        逻辑（参考 VBA 代码）：
        1. actual_mhrs = (1/spe_mhrs) * completed * 10 = completed / spe_mhrs * 10
        2. actual_weight_factor = actual_mhrs / calculated_mhrs * 254137500
        
        注意：这是针对每个活动单独计算的，不需要按项目分组。
        
        Args:
            db: 数据库会话
            activity: 活动对象
            actual_man_hours: 该活动的实际完成人工时（spe_mhrs * completed，未乘以10）
                            注意：此参数在当前实现中不再使用，改为直接从 activity 计算
            project_total_man_hours: 项目总人工时（不再使用，保留以兼容旧代码）
            weight_factor_base: 权重因子基数，默认 254137500
            
        Returns:
            实际权重因子值（Decimal）
        """
        if weight_factor_base is None:
            if use_config:
                weight_factor_base = cls.get_config_value(
                    db, cls.CONFIG_KEY_WEIGHT_FACTOR_BASE, cls.DEFAULT_WEIGHT_FACTOR_BASE
                )
            else:
                weight_factor_base = cls.DEFAULT_WEIGHT_FACTOR_BASE
        
        # 检查必要字段
        if not activity.spe_mhrs or activity.spe_mhrs == 0:
            return Decimal('0')
        
        if not activity.completed or activity.completed == 0:
            return Decimal('0')
        
        if not activity.calculated_mhrs or activity.calculated_mhrs == 0:
            return Decimal('0')
        
        # 1. 计算 actual_mhrs = completed / spe_mhrs * 10
        actual_mhrs = (Decimal(str(activity.completed)) / Decimal(str(activity.spe_mhrs))) * Decimal('10')
        
        # 2. 计算 actual_weight_factor = actual_mhrs / calculated_mhrs * 254137500
        calculated_mhrs = Decimal(str(activity.calculated_mhrs))
        actual_weight_factor_value = (actual_mhrs / calculated_mhrs) * weight_factor_base
        
        return actual_weight_factor_value
    
    @classmethod
    def calculate_and_update_activity(
        cls,
        db: Session,
        activity: ActivitySummary,
        hours_per_day: Optional[Decimal] = None,
        weight_factor_base: Optional[Decimal] = None,
        project_total_man_hours: Optional[Decimal] = None,
        commit: bool = True
    ) -> ActivitySummary:
        """
        计算并更新活动的 man_hours 和 weight_factor
        
        Args:
            db: 数据库会话
            activity: 活动对象
            hours_per_day: 人工天转人工时系数
            weight_factor_base: 权重因子基数
            project_total_man_hours: 项目总人工时（如果提供，则使用；否则重新计算）
            commit: 是否提交事务 (默认为 True)
            
        Returns:
            更新后的活动对象
        """
        # 计算人工时
        man_hours = cls.calculate_man_hours(db, activity, hours_per_day)
        activity.calculated_mhrs = man_hours
        
        # 计算权重因子
        weight_factor = cls.calculate_weight_factor(
            db, activity, man_hours, project_total_man_hours, weight_factor_base
        )
        activity.weight_factor = weight_factor
        
        # 计算实际权重因子（基于实际完成工时）
        # actual_manhour = spe_mhrs * completed（从 activity_sync_service.py 第69行可以看到）
        actual_man_hours = Decimal('0')
        if activity.spe_mhrs and activity.completed:
            actual_man_hours = Decimal(str(activity.spe_mhrs)) * Decimal(str(activity.completed))
        
        actual_weight_factor = cls.calculate_actual_weight_factor(
            db, activity, actual_man_hours, project_total_man_hours, weight_factor_base
        )
        activity.actual_weight_factor = actual_weight_factor
        
        if commit:
            db.commit()
            db.refresh(activity)
        else:
            db.flush()
        
        return activity
    
    @classmethod
    def calculate_and_update_all_activities(
        cls,
        db: Session,
        hours_per_day: Optional[Decimal] = None,
        weight_factor_base: Optional[Decimal] = None
    ) -> dict:
        """
        计算并更新所有活动的 man_hours 和 weight_factor
        
        分两步进行：
        1. 先计算所有活动的 man_hours（不依赖其他活动）
        2. 再计算所有活动的 weight_factor（需要知道项目总人工时）
        
        Args:
            db: 数据库会话
            hours_per_day: 人工天转人工时系数
            weight_factor_base: 权重因子基数
            
        Returns:
            统计信息字典
        """
        activities = db.query(ActivitySummary).all()
        
        # 第一步：计算所有活动的 man_hours
        man_hours_map = {}
        for activity in activities:
            try:
                man_hours = cls.calculate_man_hours(db, activity, hours_per_day)
                man_hours_map[activity.id] = man_hours
                activity.calculated_mhrs = man_hours
            except Exception as e:
                print(f"Error calculating man_hours for activity {activity.activity_id}: {e}")
                man_hours_map[activity.id] = Decimal('0')
        
        db.commit()
        
        # 第二步：按 project 分组计算总人工时，然后计算权重因子
        from app.models.facility import Facility
        from collections import defaultdict
        
        # 按 project 分组计算总人工时
        project_man_hours = defaultdict(Decimal)
        for activity in activities:
            facility = db.query(Facility).filter(
                Facility.block == activity.block,
                Facility.is_active == True
            ).first()
            
            project_key = facility.project if facility and facility.project else "DEFAULT"
            project_man_hours[project_key] += man_hours_map[activity.id]
        
        # 计算权重因子
        updated_count = 0
        error_count = 0
        
        for activity in activities:
            try:
                facility = db.query(Facility).filter(
                    Facility.block == activity.block,
                    Facility.is_active == True
                ).first()
                
                project_key = facility.project if facility and facility.project else "DEFAULT"
                project_total = project_man_hours[project_key]
                
                weight_factor = cls.calculate_weight_factor(
                    db, activity, man_hours_map[activity.id], 
                    project_total, weight_factor_base
                )
                activity.weight_factor = weight_factor
                
                # 计算实际权重因子
                actual_man_hours = Decimal('0')
                if activity.spe_mhrs and activity.completed:
                    actual_man_hours = Decimal(str(activity.spe_mhrs)) * Decimal(str(activity.completed))
                
                actual_weight_factor = cls.calculate_actual_weight_factor(
                    db, activity, actual_man_hours, project_total, weight_factor_base
                )
                activity.actual_weight_factor = actual_weight_factor
                
                updated_count += 1
            except Exception as e:
                error_count += 1
                print(f"Error calculating weight_factor for activity {activity.activity_id}: {e}")
        
        db.commit()
        
        return {
            "total": len(activities),
            "updated": updated_count,
            "errors": error_count
        }

