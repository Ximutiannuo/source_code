from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from app.database import Base
from app.utils.timezone import now as system_now


class ProcurementRequest(Base):
    __tablename__ = "procurement_requests"

    id = Column(Integer, primary_key=True, index=True)
    request_no = Column(String(50), unique=True, index=True, nullable=False)
    title = Column(String(200), nullable=False)
    source_scope = Column(String(20), default="GLOBAL")
    source_order_id = Column(
        Integer,
        ForeignKey("manufacturing_orders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status = Column(String(30), default="DRAFT", index=True)
    urgency_level = Column(String(20), default="MEDIUM")
    total_items = Column(Integer, default=0)
    suggested_purchase_qty_total = Column(Float, default=0)
    requester_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    requester_name = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=system_now)
    updated_at = Column(DateTime, default=system_now, onupdate=system_now)

    requester = relationship("User", foreign_keys=[requester_id])
    source_order = relationship("ManufacturingOrder", foreign_keys=[source_order_id])
    items = relationship(
        "ProcurementRequestItem",
        back_populates="request",
        cascade="all, delete-orphan",
        order_by="ProcurementRequestItem.id",
    )

    @property
    def source_order_number(self):
        if not self.source_order:
            return None
        return self.source_order.order_number


class ProcurementRequestItem(Base):
    __tablename__ = "procurement_request_items"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(
        Integer,
        ForeignKey("procurement_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    material_code = Column(String(50), index=True, nullable=False)
    material_name = Column(String(200), nullable=False)
    unit = Column(String(20), nullable=True)
    material_type = Column(String(50), nullable=True)
    material_category = Column(String(100), nullable=True)
    readiness_status = Column(String(20), nullable=True)
    shortage_reason = Column(String(100), nullable=True)
    procurement_mode = Column(String(100), nullable=True)
    suggested_action = Column(String(50), nullable=True)
    urgency_level = Column(String(20), nullable=True)
    requested_qty = Column(Float, default=0)
    shortage_qty = Column(Float, default=0)
    shortage_with_safety_qty = Column(Float, default=0)
    current_stock = Column(Float, default=0)
    reserved_stock = Column(Float, default=0)
    incoming_stock = Column(Float, default=0)
    net_available_qty = Column(Float, default=0)
    safety_stock = Column(Float, default=0)
    lead_time_days = Column(Integer, default=0)
    earliest_due_date = Column(DateTime, nullable=True)
    suggested_order_date = Column(DateTime, nullable=True)
    impacted_order_count = Column(Integer, default=0)
    impacted_orders = Column(JSON, nullable=True)
    planning_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=system_now)
    updated_at = Column(DateTime, default=system_now, onupdate=system_now)

    request = relationship("ProcurementRequest", back_populates="items")
