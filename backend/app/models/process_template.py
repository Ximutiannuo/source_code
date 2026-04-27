"""
工序逻辑关系库模型
- ProcessTemplate: 工艺路线模板（供制造使用）
- TemplateActivity: 模板内工序/步骤
"""
from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Index
from app.database import Base
from app.utils.timezone import now as system_now


class ProcessTemplate(Base):
    """工艺路线模板表"""
    __tablename__ = "process_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, comment="模板名称")
    description = Column(String(500), nullable=True, comment="模板描述")
    created_at = Column(DateTime, default=system_now)
    updated_at = Column(DateTime, default=system_now, onupdate=system_now)


class TemplateActivity(Base):
    """模板内工序/步骤：用于标准工艺路线设定"""
    __tablename__ = "template_activities"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("process_templates.id", ondelete="CASCADE"), nullable=False, index=True)
    step_code = Column(String(100), nullable=False, index=True, comment="工序代码")
    label = Column(String(255), nullable=True, comment="工序名称")
    standard_hours = Column(Numeric(10, 2), default=8, comment="标准工时")
    setup_hours = Column(Numeric(10, 2), default=0, comment="准备工时")
    sort_order = Column(Integer, default=0, comment="工序顺序")
    created_at = Column(DateTime, default=system_now)
    updated_at = Column(DateTime, default=system_now, onupdate=system_now)

    __table_args__ = (Index("idx_template_activities_template_id", "template_id"),)
