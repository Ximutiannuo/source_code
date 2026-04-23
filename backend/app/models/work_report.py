from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Numeric, Text, Index
from sqlalchemy.orm import relationship
from app.database import Base
from app.utils.timezone import now as system_now

class WorkReport(Base):
    """报工记录表 - 记录工序的实际产出量"""
    __tablename__ = "work_reports"

    id = Column(Integer, primary_key=True, index=True)
    step_id = Column(Integer, ForeignKey("production_steps.id", ondelete="CASCADE"), nullable=False, index=True)
    operator_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # 报工数据
    quantity = Column(Numeric(18, 2), nullable=False, comment="报工数量")
    scrap_qty = Column(Numeric(18, 2), default=0, comment="废品数量")
    work_hours = Column(Numeric(18, 2), default=0, comment="本次实际工时")
    downtime_minutes = Column(Integer, default=0, comment="停机分钟")

    # 状态与备注
    report_type = Column(String(50), default="MANUAL", comment="MANUAL, SCANNED, IOT")
    remarks = Column(Text, nullable=True)
    
    # 时间戳
    report_time = Column(DateTime, default=system_now, index=True)
    created_at = Column(DateTime, default=system_now)

    # 关系
    step = relationship("ProductionStep", back_populates="reports")
    operator = relationship("User")

    @property
    def operator_name(self):
        if not self.operator:
            return None
        return self.operator.full_name or self.operator.username

    __table_args__ = (
        Index("idx_work_report_step", "step_id"),
        Index("idx_work_report_time", "report_time"),
    )
