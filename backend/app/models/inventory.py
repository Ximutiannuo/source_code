import uuid

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base
from app.utils.timezone import now as system_now


def build_transaction_no() -> str:
    return f"MTX-{uuid.uuid4().hex[:12].upper()}"


class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True, index=True)
    location = Column(String(255), nullable=True)
    warehouse_type = Column(String(20), default="PHYSICAL", index=True)
    status = Column(String(20), default="ACTIVE", index=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=system_now)
    updated_at = Column(DateTime, default=system_now, onupdate=system_now)

    inventory_balances = relationship(
        "InventoryBalance",
        back_populates="warehouse",
        cascade="all, delete-orphan",
        order_by="InventoryBalance.id",
    )
    material_transactions = relationship(
        "MaterialTransaction",
        back_populates="warehouse",
        order_by="MaterialTransaction.operated_at",
    )


class InventoryBalance(Base):
    __tablename__ = "inventory_balances"
    __table_args__ = (
        UniqueConstraint("warehouse_id", "material_id", name="uq_inventory_balance_warehouse_material"),
    )

    id = Column(Integer, primary_key=True, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False, index=True)
    material_id = Column(Integer, ForeignKey("materials.id", ondelete="CASCADE"), nullable=False, index=True)
    current_qty = Column(Float, default=0)
    frozen_qty = Column(Float, default=0)
    available_qty = Column(Float, default=0)
    in_transit_qty = Column(Float, default=0)
    consumed_qty = Column(Float, default=0)
    unit_cost = Column(Float, default=0)
    inventory_amount = Column(Float, default=0)
    frozen_amount = Column(Float, default=0)
    last_transaction_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=system_now)
    updated_at = Column(DateTime, default=system_now, onupdate=system_now)

    warehouse = relationship("Warehouse", back_populates="inventory_balances")
    material = relationship("Material", back_populates="inventory_balances")


class MaterialTransaction(Base):
    __tablename__ = "material_transactions"

    id = Column(Integer, primary_key=True, index=True)
    transaction_no = Column(String(50), nullable=False, unique=True, index=True, default=build_transaction_no)
    transaction_type = Column(String(20), nullable=False, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="SET NULL"), nullable=True, index=True)
    procurement_request_id = Column(
        Integer,
        ForeignKey("procurement_requests.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    work_package_code = Column(String(100), nullable=True, index=True)
    material_id = Column(Integer, ForeignKey("materials.id", ondelete="SET NULL"), nullable=True, index=True)
    quantity = Column(Float, default=0)
    unit_price = Column(Float, default=0)
    total_price = Column(Float, default=0)
    tax_rate = Column(Float, default=0)
    fee_rate = Column(Float, default=0)
    currency = Column(String(10), default="CNY")
    operated_at = Column(DateTime, default=system_now, index=True)
    operator_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    operator_name = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=system_now)

    warehouse = relationship("Warehouse", back_populates="material_transactions")
    procurement_request = relationship("ProcurementRequest", back_populates="material_transactions")
    material = relationship("Material", back_populates="material_transactions")
    operator = relationship("User", foreign_keys=[operator_id])
