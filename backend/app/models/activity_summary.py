"""
作业清单汇总表（物化视图）
用于存储预聚合的数据，提升查询性能
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, Date, Numeric, Boolean, Index
from app.database import Base
from datetime import datetime, timezone
from app.utils.timezone import now as system_now


class ActivitySummary(Base):
    """作业清单汇总表（物化视图）"""
    __tablename__ = "activity_summary"

    id = Column(Integer, primary_key=True, index=True)
    activity_id = Column(String(100), unique=True, index=True, comment="ACT ID")
    
    # 基础信息
    wbs_code = Column(String(100), index=True, comment="WBS Code")
    block = Column(String(100), index=True, comment="Block")
    title = Column(Text, comment="TITLE")
    discipline = Column(String(100), index=True, comment="Discipline")
    work_package = Column(String(100), index=True, comment="Work Package")
    scope = Column(String(100), index=True, comment="SCOPE")
    implement_phase = Column(String(100), comment="实施阶段")
    
    # Facilities信息
    project = Column(String(100), index=True, comment="Project")
    subproject = Column(String(100), index=True, comment="Sub-project")
    train = Column(String(100), index=True, comment="Train")
    unit = Column(String(100), index=True, comment="Unit")
    main_block = Column(String(100), index=True, comment="Main_Block")
    quarter = Column(String(100), index=True, comment="Quarter")
    simple_block = Column(String(100), index=True, comment="简化Block（与 facilities.simple_block 统一）")
    start_up_sequence = Column(String(100), comment="启动序列")
    
    # 工程量相关
    key_qty = Column(Numeric(18, 2), comment="KEY QTY")
    calculated_mhrs = Column(Numeric(18, 2), comment="Calculated MHrs")
    resource_id = Column(String(100), comment="Resource ID")
    spe_mhrs = Column(Numeric(18, 2), comment="SPE MHrs")
    uom = Column(String(50), comment="UoM")
    contract_phase = Column(String(100), comment="合同阶段")
    
    # 权重因子
    weight_factor = Column(Numeric(18, 2), comment="W.F")
    actual_weight_factor = Column(Numeric(18, 2), comment="Actual Weight Factor (基于实际完成工时计算)")
    
    # P6日期字段（从p6_activities获取）
    start_date = Column(Date, comment="Start Date (P6)")
    finish_date = Column(Date, comment="Finish Date (P6)")
    planned_start_date = Column(Date, comment="Planned Start Date (P6)")
    planned_finish_date = Column(Date, comment="Planned Finish Date (P6)")
    planned_duration = Column(Integer, comment="Planned Duration (P6)")
    at_completion_duration = Column(Integer, comment="At Completion Duration (P6)")
    
    # 基线数据（从p6_activities获取）
    baseline1_start_date = Column(Date, comment="Baseline1 Start Date (P6)")
    baseline1_finish_date = Column(Date, comment="Baseline1 Finish Date (P6)")
    
    # 实际数据（从MPDB/VFACTDB聚合，优先使用P6的actual_start_date/actual_finish_date）
    actual_start_date = Column(Date, index=True, comment="Actual Start Date (优先从P6获取，否则从MPDB聚合)")
    actual_finish_date = Column(Date, index=True, comment="Actual Finish Date (优先从P6获取，否则从MPDB聚合)")
    actual_duration = Column(Integer, comment="Actual Duration (优先从P6获取，否则从MPDB聚合计算)")
    completed = Column(Numeric(18, 2), comment="Completed")
    actual_manhour = Column(Numeric(18, 2), comment="Actual Manhour")
    
    # P6 数据日期
    data_date = Column(DateTime, comment="Data Date (P6)")
    
    # P6作业类型（用于区分里程碑）
    type = Column(String(50), index=True, comment="Activity Type (从P6获取，用于标识里程碑等)")
    
    # 系统确认状态：'Not Started', 'In Progress', 'Completed'
    system_status = Column(String(50), default='Not Started', index=True, comment="本系统内的确认状态")
    
    # 更新时间
    updated_at = Column(DateTime, default=system_now, onupdate=system_now, comment="更新时间")

    __table_args__ = (
        Index('idx_activity_summary_project', 'project'),
        Index('idx_activity_summary_subproject', 'subproject'),
        Index('idx_activity_summary_train', 'train'),
        Index('idx_activity_summary_unit', 'unit'),
        Index('idx_activity_summary_block', 'block'),
        Index('idx_activity_summary_main_block', 'main_block'),
        Index('idx_activity_summary_simple_block', 'simple_block'),
        Index('idx_activity_summary_quarter', 'quarter'),
        Index('idx_activity_summary_scope', 'scope'),
        Index('idx_activity_summary_discipline', 'discipline'),
        Index('idx_activity_summary_work_package', 'work_package'),
        Index('idx_activity_summary_actual_start_date', 'actual_start_date'),
        Index('idx_activity_summary_actual_finish_date', 'actual_finish_date'),
        Index('idx_activity_summary_type', 'type'),
        Index('idx_activity_summary_implement_phase', 'implement_phase'),
    )

