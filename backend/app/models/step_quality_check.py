from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Numeric, Text, Index
from sqlalchemy.orm import relationship

from app.database import Base
from app.utils.timezone import now as system_now


class StepQualityCheck(Base):
    """工序级质检记录，承接过站、返工和不良闭环。"""

    __tablename__ = "step_quality_checks"

    id = Column(Integer, primary_key=True, index=True)
    step_id = Column(Integer, ForeignKey("production_steps.id", ondelete="CASCADE"), nullable=False, index=True)
    inspector_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    check_type = Column(String(50), default="IPQC", comment="IPQC, FQC, OQC")
    result = Column(String(50), nullable=False, comment="PASS, FAIL, REWORK, HOLD")
    checked_qty = Column(Numeric(18, 2), default=0, comment="本次检验数量")
    defect_qty = Column(Numeric(18, 2), default=0, comment="不良数量")
    rework_qty = Column(Numeric(18, 2), default=0, comment="返工数量")
    remarks = Column(Text, nullable=True)
    checked_at = Column(DateTime, default=system_now, index=True)
    created_at = Column(DateTime, default=system_now)

    step = relationship("ProductionStep", back_populates="quality_checks")
    inspector = relationship("User")

    @property
    def inspector_name(self):
        if not self.inspector:
            return None
        return self.inspector.full_name or self.inspector.username

    __table_args__ = (
        Index("idx_step_quality_checks_step", "step_id"),
        Index("idx_step_quality_checks_result", "result"),
        Index("idx_step_quality_checks_time", "checked_at"),
    )
