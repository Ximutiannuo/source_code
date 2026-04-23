from sqlalchemy import Column, String, Integer, ForeignKey, Boolean, DateTime, Float, Text
from sqlalchemy.orm import relationship
from app.database import Base

class Material(Base):
    __tablename__ = "materials"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False, comment="物料编码")
    name = Column(String(200), nullable=False, comment="物料名称")
    specification = Column(String(200), comment="规格型号")
    category = Column(String(100), comment="物料分类")
    unit = Column(String(20), comment="单位")
    safety_stock = Column(Integer, default=0, comment="安全库存")
    current_stock = Column(Float, default=0, comment="现有库存")
    reserved_stock = Column(Float, default=0, comment="已预留库存")
    incoming_stock = Column(Float, default=0, comment="在途库存")
    lead_time_days = Column(Integer, default=0, comment="采购前置期(天)")
    drawing_no = Column(String(100), index=True, comment="图号")
    revision = Column(String(20), default="A", comment="版本/版次")
    material_type = Column(String(50), comment="物料类型: RAW, STD, SUB, FINISHED")
    description = Column(Text, comment="描述")

class BOMHeader(Base):
    __tablename__ = "bom_headers"
    id = Column(Integer, primary_key=True, index=True)
    product_code = Column(String(50), index=True, nullable=False, comment="产成品编码")
    version = Column(String(20), default="v1.0", comment="BOM版本")
    bom_type = Column(String(20), default="EBOM", comment="EBOM or PBOM")
    status = Column(String(20), default="DRAFT", comment="DRAFT, RELEASED, ARCHIVED")
    description = Column(String(255), comment="描述")
    is_active = Column(Boolean, default=True, comment="是否启用")
    effective_date = Column(DateTime, comment="生效日期")
    expiry_date = Column(DateTime, comment="失效日期")

class BOMItem(Base):
    __tablename__ = "bom_items"
    id = Column(Integer, primary_key=True, index=True)
    header_id = Column(Integer, ForeignKey("bom_headers.id", ondelete="CASCADE"), nullable=False)
    parent_item_code = Column(String(50), comment="父级编码")
    child_item_code = Column(String(50), nullable=False, comment="子级编码")
    quantity = Column(Float, default=1.0, comment="用量")
    component_type = Column(String(50), comment="组件类型: KEY, NORMAL")
    routing_link = Column(String(100), comment="关联初步工艺路径ID/Key")
    
    header = relationship("BOMHeader")
