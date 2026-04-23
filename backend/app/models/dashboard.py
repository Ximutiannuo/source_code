"""
Dashboard 相关数据模型
"""
from sqlalchemy import Column, Integer, String, Text, Date, Numeric, Boolean, DateTime, UniqueConstraint, Index
from app.database import Base
from app.utils.timezone import now as system_now

class BudgetedDB(Base):
    """计划/预算数据表 (Time-distributed)"""
    __tablename__ = "budgeted_db"

    id = Column(Integer, primary_key=True, index=True)
    activity_id = Column(String(100), index=True, nullable=False, comment="关联 activity_summary.activity_id")
    # block 字段已移除，通过 activity_id 关联
    resource_id = Column(String(100), index=True, comment="关联 rsc_defines.resource_id")
    date = Column(Date, index=True, nullable=False, comment="数据日期")
    budgeted_units = Column(Numeric(18, 2), default=0, comment="计划工时/工程量")
    
    created_at = Column(DateTime, default=system_now)
    updated_at = Column(DateTime, default=system_now, onupdate=system_now)

    __table_args__ = (
        Index('idx_budgeted_activity_resource_date', 'activity_id', 'resource_id', 'date'),
    )

class AtCompletionDB(Base):
    """预测/完工数据表 (Time-distributed)"""
    __tablename__ = "atcompletion_db"

    id = Column(Integer, primary_key=True, index=True)
    activity_id = Column(String(100), index=True, nullable=False, comment="关联 activity_summary.activity_id")
    # block 字段已移除，通过 activity_id 关联
    resource_id = Column(String(100), index=True, comment="关联 rsc_defines.resource_id")
    date = Column(Date, index=True, nullable=False, comment="数据日期")
    atcompletion_units = Column(Numeric(18, 2), default=0, comment="预测完工工时/工程量")
    
    created_at = Column(DateTime, default=system_now)
    updated_at = Column(DateTime, default=system_now, onupdate=system_now)

    __table_args__ = (
        Index('idx_atcompletion_activity_resource_date', 'activity_id', 'resource_id', 'date'),
    )

class OWFDB(Base):
    """实际进度值表 (One Way Factor)"""
    __tablename__ = "owf_db"

    id = Column(Integer, primary_key=True, index=True)
    activity_id = Column(String(100), index=True, nullable=False, comment="关联 activity_summary.activity_id")
    resource_id = Column(String(100), index=True, comment="通常为 GCC_WF")
    date = Column(Date, index=True, nullable=False, comment="数据日期")
    actual_units = Column(Numeric(18, 2), default=0, comment="实际完成值")
    
    created_at = Column(DateTime, default=system_now)
    updated_at = Column(DateTime, default=system_now, onupdate=system_now)

class ProjectInfo(Base):
    """系统配置和项目基本信息"""
    __tablename__ = "project_info"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(50), nullable=False, comment="配置类别")
    key_name = Column(String(100), nullable=False, comment="配置键名")
    value_content = Column(Text, comment="配置值")
    description = Column(String(255), comment="描述")
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=system_now)
    updated_at = Column(DateTime, default=system_now, onupdate=system_now)

    __table_args__ = (
        UniqueConstraint('category', 'key_name', name='uk_project_info_key'),
    )

class SCurveCache(Base):
    """
    S 曲线预聚合缓存表 - 毫秒级读取，由定时任务或手动刷新
    支持 GlobalFilter 维度切片，filter_key 为空表示全局（无筛选）
    """
    __tablename__ = "dashboard_s_curve_cache"

    filter_key = Column(String(512), primary_key=True, default="", comment="维度组合键，空=全局")
    date = Column(Date, primary_key=True, comment="日期")
    cum_plan_wf = Column(Numeric(18, 4), default=0, comment="累计计划 WF%")
    cum_actual_wf = Column(Numeric(18, 4), default=0, comment="累计实际 WF%")
    cum_forecast_wf = Column(Numeric(18, 4), default=0, comment="累计预测 WF%")
    # 维度列：与 activity_summary / rsc_defines 列名一致
    subproject = Column(String(512), comment="activity_summary.subproject")
    train = Column(String(512), comment="activity_summary.train")
    unit = Column(String(512), comment="activity_summary.unit")
    simple_block = Column(String(512), comment="activity_summary.simple_block")
    main_block = Column(String(512), comment="activity_summary.main_block")
    block = Column(String(512), comment="activity_summary.block")
    quarter = Column(String(512), comment="activity_summary.quarter")
    scope = Column(String(512), comment="activity_summary.scope")
    discipline = Column(String(512), comment="activity_summary.discipline")
    implement_phase = Column(String(512), comment="activity_summary.implement_phase")
    contract_phase = Column(String(512), comment="activity_summary.contract_phase")
    type = Column(String(512), comment="activity_summary.type")
    work_package = Column(String(512), comment="activity_summary/rsc_defines.work_package")
    resource_id_name = Column(String(512), comment="rsc_defines.resource_id_name")
    bcc_kq_code = Column(String(512), comment="rsc_defines.bcc_kq_code")
    kq = Column(String(512), comment="rsc_defines.kq")
    cn_wk_report = Column(String(512), comment="rsc_defines.cn_wk_report")
    updated_at = Column(DateTime, default=system_now, onupdate=system_now, comment="刷新时间")


class ProjectImage(Base):
    """项目图片库"""
    __tablename__ = "project_images"

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(50), nullable=False, comment="关联实体类型")
    entity_id = Column(String(100), nullable=False, comment="关联实体ID")
    image_url = Column(String(255), nullable=False, comment="图片路径或URL")
    title = Column(String(100), comment="图片标题")
    description = Column(Text, comment="图片描述/备注")
    taken_at = Column(Date, comment="拍摄/上传对应日期")
    uploaded_by = Column(String(100), comment="上传者")
    
    created_at = Column(DateTime, default=system_now)

    __table_args__ = (
        Index('idx_images_entity', 'entity_type', 'entity_id'),
    )
