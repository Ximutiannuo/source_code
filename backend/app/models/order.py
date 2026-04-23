from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base
from app.utils.timezone import now as system_now

class ManufacturingOrder(Base):
    __tablename__ = "manufacturing_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(100), unique=True, index=True, nullable=False, comment="订单编号")
    customer_name = Column(String(200), comment="客户名称")
    product_name = Column(String(200), comment="产品名称")
    
    # 计划关联
    bom_id = Column(Integer, ForeignKey("bom_headers.id", ondelete="SET NULL"), nullable=True)
    process_template_id = Column(Integer, ForeignKey("process_templates.id", ondelete="SET NULL"), nullable=True)
    
    quantity = Column(Integer, default=1, comment="订单数量")
    due_date = Column(DateTime, comment="交货日期")
    priority = Column(Integer, default=3, comment="优先级")
    
    # 状态: PLANNED, RELEASED, IN_PROGRESS, QC, COMPLETED, CANCELLED
    status = Column(String(50), default="PLANNED", index=True)
    
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=system_now)

    # 关系
    bom = relationship("BOMHeader")
    process_template = relationship("ProcessTemplate")
    steps = relationship("ProductionStep", back_populates="order", cascade="all, delete-orphan", order_by="ProductionStep.sort_order")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("manufacturing_orders.id", ondelete="CASCADE"), nullable=False)
    bom_id = Column(Integer, ForeignKey("bom_headers.id", ondelete="SET NULL"), nullable=True)
    quantity = Column(Integer, default=1)
    
    order = relationship("ManufacturingOrder", back_populates="items")
    bom = relationship("BOMHeader")
