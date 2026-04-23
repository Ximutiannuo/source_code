from sqlalchemy import Column, String, Integer, DateTime, Text
from sqlalchemy.orm import relationship
from app.database import Base
from app.utils.timezone import now as system_now

class Equipment(Base):
    __tablename__ = "equipment"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=False)
    model_number = Column(String(100))
    workstation = Column(String(100))
    status = Column(String(50), default="ACTIVE", comment="ACTIVE, MAINTENANCE, OFFLINE")

    # 扩展字段
    department = Column(String(100), nullable=True, comment="所属部门")
    location = Column(String(200), nullable=True, comment="安装位置")
    purchase_date = Column(DateTime, nullable=True, comment="采购日期")
    last_maintenance_date = Column(DateTime, nullable=True, comment="上次保养日期")
    next_maintenance_date = Column(DateTime, nullable=True, comment="下次保养日期")
    maintenance_cycle_days = Column(Integer, default=0, comment="保养周期(天)")
    description = Column(Text, nullable=True, comment="设备描述")
    created_at = Column(DateTime, default=system_now)

    maintenances = relationship("EquipmentMaintenance", back_populates="equipment", cascade="all, delete-orphan")
