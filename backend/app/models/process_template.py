"""
工序逻辑关系库模型
- ProcessTemplate: 工序模板（按工作包绑定，含预估量范围、最小人数）
- TemplateActivityLink: 模板内工序逻辑关系（前驱-后继）
规则通过 work_package 关联 rsc_defines，供第二步「动态适配引擎」使用。
"""
from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Index
from app.database import Base
from app.utils.timezone import now as system_now


class ProcessTemplate(Base):
    """工序模板表：绑定到工作包，含适用工程量范围与最小人数"""
    __tablename__ = "process_templates"

    id = Column(Integer, primary_key=True, index=True)
    # 装置类型（选装置类型后建模板，一个类型一个模板）
    facility_type_id = Column(Integer, ForeignKey("facility_types.id", ondelete="CASCADE"), nullable=True, index=True, comment="装置类型ID")
    facility_id = Column(Integer, ForeignKey("facilities.id", ondelete="CASCADE"), nullable=True, index=True, comment="装置ID（旧，保留兼容）")
    work_package = Column(String(100), index=True, nullable=True, comment="工作包（按工作包配置时使用）")
    name = Column(String(255), nullable=False, comment="模板名称")
    applicable_qty_min = Column(Numeric(18, 2), nullable=True, comment="适用预估总量下限")
    applicable_qty_max = Column(Numeric(18, 2), nullable=True, comment="适用预估总量上限")
    min_required_workers = Column(Integer, nullable=True, comment="最小要求人数")
    max_allowed_workers = Column(Integer, nullable=True, comment="该规模下最多允许人数（阈值表）")
    suggested_min_days = Column(Integer, nullable=True, comment="建议工期下限（天）")
    suggested_max_days = Column(Integer, nullable=True, comment="建议工期上限（天）")
    created_at = Column(DateTime, default=system_now)
    updated_at = Column(DateTime, default=system_now, onupdate=system_now)

    __table_args__ = (
        Index("idx_process_templates_work_package", "work_package"),
        Index("idx_process_templates_facility_id", "facility_id"),
        Index("idx_process_templates_facility_type_id", "facility_type_id"),
    )


class TemplateActivity(Base):
    """模板内工序/工作包行：用于左表+甘特，含计划工期"""
    __tablename__ = "template_activities"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("process_templates.id", ondelete="CASCADE"), nullable=False, index=True)
    activity_key = Column(String(100), nullable=False, index=True, comment="工序键，如 work_package 或 activity_id")
    label = Column(String(255), nullable=True, comment="显示名称")
    planned_duration = Column(Numeric(10, 2), default=1, comment="计划工期(天)")
    standard_hours = Column(Numeric(10, 2), default=8, comment="标准工时")
    setup_hours = Column(Numeric(10, 2), default=0, comment="准备工时")
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=system_now)
    updated_at = Column(DateTime, default=system_now, onupdate=system_now)

    __table_args__ = (Index("idx_template_activities_template_id", "template_id"),)


class TemplateActivityLink(Base):
    """模板工序逻辑关系表：描述模板内工序的前驱-后继关系"""
    __tablename__ = "template_activity_links"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("process_templates.id", ondelete="CASCADE"), nullable=False, index=True, comment="工序模板ID")
    # 工序标识：可与 activity_summary 对应（按业务用 activity_id 或 activity_code）
    predecessor_activity_id = Column(String(100), nullable=False, index=True, comment="前驱工序 activity_id")
    successor_activity_id = Column(String(100), nullable=False, index=True, comment="后继工序 activity_id")
    link_type = Column(String(10), default="FS", comment="逻辑关系类型：FS/SS/FF/SF")
    lag_days = Column(Numeric(10, 2), default=0, comment="滞后天数")
    sort_order = Column(Integer, default=0, comment="同模板内排序")
    created_at = Column(DateTime, default=system_now)
    updated_at = Column(DateTime, default=system_now, onupdate=system_now)

    __table_args__ = (
        Index("idx_template_activity_links_template_id", "template_id"),
    )
