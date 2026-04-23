"""
装置类型：变电站、管廊、棚式结构、设备框架结构、厂房等
用于工序逻辑模板的归类与分配。
"""
from sqlalchemy import Column, Integer, String, DateTime, Index
from app.database import Base
from app.utils.timezone import now as system_now


class FacilityType(Base):
    """装置类型表"""
    __tablename__ = "facility_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True, comment="类型名称，如：变电站、管廊、棚式结构")
    sort_order = Column(Integer, default=0, comment="排序")
    created_at = Column(DateTime, default=system_now)
    updated_at = Column(DateTime, default=system_now, onupdate=system_now)

    __table_args__ = (Index("idx_facility_types_name", "name"),)
