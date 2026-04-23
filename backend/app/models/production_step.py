from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import relationship

from app.database import Base
from app.utils.timezone import now as system_now


class ProductionStep(Base):
    """生产工序表，记录制造订单在工序级的执行状态。"""

    __tablename__ = "production_steps"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("manufacturing_orders.id", ondelete="CASCADE"), nullable=False, index=True)

    step_code = Column(String(50), nullable=False, comment="工序代码，例如 CUT/WELD/ASSY")
    name = Column(String(200), nullable=False, comment="工序名称")
    sort_order = Column(Integer, default=0, comment="执行顺序")

    target_qty = Column(Numeric(18, 2), default=0, comment="目标数量")
    completed_qty = Column(Numeric(18, 2), default=0, comment="累计合格推进数量")
    planned_work_hours = Column(Numeric(18, 2), default=0, comment="标准工时")
    setup_hours = Column(Numeric(18, 2), default=0, comment="准备工时")

    # PLANNED, READY, IN_PROGRESS, QC, COMPLETED, BLOCKED
    status = Column(String(50), default="PLANNED", index=True)

    workstation_id = Column(
        Integer,
        ForeignKey("equipment.id", ondelete="SET NULL"),
        nullable=True,
        comment="分配的工位或设备",
    )

    created_at = Column(DateTime, default=system_now)
    updated_at = Column(DateTime, default=system_now, onupdate=system_now)

    order = relationship("ManufacturingOrder", back_populates="steps")
    reports = relationship("WorkReport", back_populates="step", cascade="all, delete-orphan")
    quality_checks = relationship("StepQualityCheck", back_populates="step", cascade="all, delete-orphan")
    equipment = relationship("Equipment")

    @property
    def workstation_name(self):
        if not self.equipment:
            return None
        return self.equipment.workstation or self.equipment.name

    __table_args__ = (
        Index("idx_prod_step_order", "order_id"),
        Index("idx_prod_step_status", "status"),
    )
