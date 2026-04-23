from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False, comment="Material code")
    name = Column(String(200), nullable=False, comment="Material name")
    specification = Column(String(200), comment="Specification/model")
    category = Column(String(100), comment="Material category")
    unit = Column(String(20), comment="Unit of measure")
    safety_stock = Column(Integer, default=0, comment="Safety stock")
    current_stock = Column(Float, default=0, comment="On-hand stock")
    reserved_stock = Column(Float, default=0, comment="Reserved stock")
    incoming_stock = Column(Float, default=0, comment="In-transit stock")
    lead_time_days = Column(Integer, default=0, comment="Lead time in days")
    drawing_no = Column(String(100), index=True, comment="Drawing number")
    revision = Column(String(20), default="A", comment="Revision")
    material_type = Column(String(50), comment="RAW, STD, SUB, FINISHED")
    description = Column(Text, comment="Description")

    inventory_balances = relationship("InventoryBalance", back_populates="material")
    material_transactions = relationship("MaterialTransaction", back_populates="material")
    procurement_items = relationship("ProcurementRequestItem", back_populates="material")


class BOMHeader(Base):
    __tablename__ = "bom_headers"

    id = Column(Integer, primary_key=True, index=True)
    product_code = Column(String(50), index=True, nullable=False, comment="Finished product code")
    version = Column(String(20), default="v1.0", comment="BOM version")
    bom_type = Column(String(20), default="EBOM", comment="EBOM, PBOM, MBOM")
    status = Column(String(20), default="DRAFT", comment="DRAFT, RELEASED, ARCHIVED")
    description = Column(String(255), comment="Description")
    is_active = Column(Boolean, default=True, comment="Whether current version is active")
    effective_date = Column(DateTime, comment="Effective date")
    expiry_date = Column(DateTime, comment="Expiry date")

    product_family = Column(String(100), index=True, comment="Product family")
    business_unit = Column(String(100), index=True, comment="Business unit")
    project_code = Column(String(100), index=True, comment="Project or order family code")
    plant_code = Column(String(50), index=True, comment="Plant/workshop code")
    discipline = Column(String(100), index=True, comment="Mechanical discipline or domain")
    source_system = Column(String(50), default="MANUAL", index=True, comment="MANUAL, CAD, SOLIDWORKS")
    source_file = Column(String(255), comment="Origin CAD file or external document")
    sync_status = Column(String(30), default="MANUAL", index=True, comment="MANUAL, PENDING, SYNCED, FAILED")
    cad_document_no = Column(String(100), comment="CAD/SolidWorks document number")
    released_by = Column(String(100), comment="Released by")
    last_synced_at = Column(DateTime, comment="Last synchronized timestamp")

    items = relationship(
        "BOMItem",
        back_populates="header",
        cascade="all, delete-orphan",
        order_by="BOMItem.find_number",
    )


class BOMItem(Base):
    __tablename__ = "bom_items"

    id = Column(Integer, primary_key=True, index=True)
    header_id = Column(Integer, ForeignKey("bom_headers.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_item_code = Column(String(50), comment="Parent item code")
    child_item_code = Column(String(50), nullable=False, index=True, comment="Child item code")
    quantity = Column(Float, default=1.0, comment="Required quantity")
    component_type = Column(String(50), comment="KEY, NORMAL, OPTIONAL")
    routing_link = Column(String(100), comment="Associated routing or operation")

    find_number = Column(String(50), comment="Find number / line number")
    item_level = Column(Integer, default=1, comment="Hierarchy level")
    item_category = Column(String(100), comment="Purchased, fabricated, standard, assembly")
    procurement_type = Column(String(50), comment="MAKE, BUY, OUTSOURCE")
    loss_rate = Column(Float, default=0, comment="Loss or scrap rate")
    unit_price = Column(Float, default=0, comment="Estimated unit price")
    total_price = Column(Float, default=0, comment="Extended total price")
    source_reference = Column(String(255), comment="CAD feature or source reference")

    header = relationship("BOMHeader", back_populates="items")
