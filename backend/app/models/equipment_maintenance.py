from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, Index
from sqlalchemy.orm import relationship

from app.database import Base
from app.utils.timezone import now as system_now


class EquipmentMaintenance(Base):
    """设备维保记录表"""
    __tablename__ = "equipment_maintenances"

    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id", ondelete="CASCADE"), nullable=False, index=True)

    maintenance_type = Column(String(50), default="PLANNED", comment="PLANNED, BREAKDOWN, INSPECTION")
    description = Column(Text, nullable=True, comment="维保描述")
    operator_name = Column(String(100), nullable=True, comment="执行人")
    start_time = Column(DateTime, nullable=True, comment="开始时间")
    end_time = Column(DateTime, nullable=True, comment="结束时间")
    downtime_minutes = Column(Integer, default=0, comment="停机时长(分钟)")
    cost = Column(Integer, default=0, comment="维保费用(分)")
    status = Column(String(50), default="COMPLETED", comment="PLANNED, IN_PROGRESS, COMPLETED")
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=system_now)

    equipment = relationship("Equipment")

    __table_args__ = (
        Index("idx_equip_maint_equipment", "equipment_id"),
        Index("idx_equip_maint_type", "maintenance_type"),
    )
