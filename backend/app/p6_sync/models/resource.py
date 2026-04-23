"""
P6 Resource 模型
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Numeric, Text, Index
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime, timezone


class P6Resource(Base):
    """P6资源实体"""
    __tablename__ = "p6_resources"
    
    # 主键
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # P6字段
    object_id = Column(Integer, unique=True, nullable=False, index=True, comment="P6 ObjectId")
    resource_id = Column(String(100), index=True, comment="Resource ID")
    name = Column(String(500), comment="Resource Name")
    resource_type = Column(String(50), index=True, comment="Resource Type (Labor/Material/Nonlabor)")
    
    # 注意：Resource在openapi.json中没有ProjectObjectId字段，Resource是全局的
    
    # 资源信息
    unit_of_measure = Column(String(50), comment="Unit of Measure")
    price_per_unit = Column(Numeric(18, 2), comment="Price Per Unit")
    calendar_object_id = Column(Integer, comment="Calendar ObjectId")
    
    # 其他信息
    description = Column(Text, comment="Resource Description")
    
    # P6时间字段（用于增量同步）
    p6_create_date = Column(DateTime, index=True, comment="P6 CreateDate（记录创建时间）")
    p6_last_update_date = Column(DateTime, index=True, comment="P6 LastUpdateDate（记录最后更新时间，用于增量同步）")
    
    # 系统字段
    is_active = Column(Boolean, default=True, comment="是否激活")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    last_sync_at = Column(DateTime, comment="最后同步时间")
    
    # 关系
    resource_assignments = relationship(
        "P6ResourceAssignment", 
        back_populates="resource", 
        foreign_keys="[P6ResourceAssignment.resource_object_id]",
        primaryjoin="P6Resource.object_id == P6ResourceAssignment.resource_object_id"
    )
    
    __table_args__ = (
        Index('idx_resource_object_id', 'object_id'),
        Index('idx_resource_id', 'resource_id'),
        Index('idx_resource_type', 'resource_type'),
    )
    
    def __repr__(self):
        return f"<P6Resource(id={self.resource_id}, name={self.name}, type={self.resource_type})>"
