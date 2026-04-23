"""
部门配置表，与 ahead_plan_issue.resolving_department 及 user.department_id 共用
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from app.database import Base
from app.utils.timezone import now as system_now


class Department(Base):
    """部门配置表"""
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False, comment="部门代码，如 design, procurement")
    name = Column(String(100), nullable=False, comment="部门名称，如 设计管理部")
    is_active = Column(Boolean, default=True, comment="是否启用")
    sort_order = Column(Integer, default=0, comment="排序")
    created_at = Column(DateTime, default=system_now, comment="创建时间")
    updated_at = Column(DateTime, default=system_now, onupdate=system_now, comment="更新时间")
