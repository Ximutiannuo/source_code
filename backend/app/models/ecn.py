from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base
from app.utils.timezone import now as system_now

class ECNHeader(Base):
    """工程变更单 (Engineering Change Notice)"""
    __tablename__ = "ecn_headers"

    id = Column(Integer, primary_key=True, index=True)
    ecn_no = Column(String(50), unique=True, index=True, nullable=False, comment="变更单号")
    change_type = Column(String(50), comment="变更类型: DESIGN, PROCESS, MATERIAL")
    reason = Column(Text, comment="变更原因")
    description = Column(Text, comment="变更描述")
    status = Column(String(20), default="DRAFT", comment="DRAFT, REVIEWING, APPROVED, EXECUTED, CANCELLED")
    
    creator_id = Column(Integer, comment="创建者用户ID")
    approver_id = Column(Integer, comment="批准者用户ID")
    
    created_at = Column(DateTime, default=system_now)
    updated_at = Column(DateTime, default=system_now, onupdate=system_now)

class ECNImpact(Base):
    """ECN 变更影响范围明细"""
    __tablename__ = "ecn_impacts"

    id = Column(Integer, primary_key=True, index=True)
    ecn_header_id = Column(Integer, ForeignKey("ecn_headers.id", ondelete="CASCADE"), nullable=False)
    
    impact_type = Column(String(50), comment="影响对象类型: BOM, MATERIAL")
    impact_entity_id = Column(String(100), comment="具体影响的实体ID (如 product_code 或 material_code)")
    
    change_detail = Column(JSON, comment="更变细节描述 (JSON 格式)")
    
    header = relationship("ECNHeader")
