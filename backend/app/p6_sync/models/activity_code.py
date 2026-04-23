"""
P6 Activity Code 模型
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, Index
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime, timezone


class P6ActivityCode(Base):
    """P6作业代码类型实体"""
    __tablename__ = "p6_activity_codes"
    
    # 主键
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # P6字段
    object_id = Column(Integer, unique=True, nullable=False, index=True, comment="P6 ObjectId")
    # 注意：ActivityCode在openapi.json中代表的是代码值（CodeValue），不是代码类型
    code_type_object_id = Column(Integer, index=True, nullable=False, comment="Code Type ObjectId")
    code_type_name = Column(String(200), index=True, comment="Code Type Name")
    code_type_scope = Column(String(50), comment="Code Type Scope (Global/EPS/Project)")
    code_value = Column(String(200), index=True, nullable=False, comment="Code Value")
    # 注意：ActivityCode在openapi.json中没有Id字段，只有CodeValue
    sequence_number = Column(Integer, comment="Sequence Number")
    
    # 其他信息
    description = Column(Text, comment="Activity Code Description")
    # 注意：ActivityCode在openapi.json中有Description字段
    
    # P6时间字段（用于增量同步）
    p6_create_date = Column(DateTime, index=True, comment="P6 CreateDate（记录创建时间）")
    p6_last_update_date = Column(DateTime, index=True, comment="P6 LastUpdateDate（记录最后更新时间，用于增量同步）")
    
    # 系统字段
    is_active = Column(Boolean, default=True, comment="是否激活")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    last_sync_at = Column(DateTime, comment="最后同步时间")
    
    # 关系
    code_assignments = relationship(
        "P6ActivityCodeAssignment", 
        back_populates="activity_code", 
        foreign_keys="[P6ActivityCodeAssignment.activity_code_object_id]",
        primaryjoin="P6ActivityCode.object_id == P6ActivityCodeAssignment.activity_code_object_id"
        # 注意：应该使用ActivityCodeObjectId关联，不是ActivityCodeTypeObjectId
    )
    
    __table_args__ = (
        Index('idx_activity_code_object_id', 'object_id'),
        Index('idx_activity_code_type_name', 'code_type_name'),
        Index('idx_activity_code_type_scope', 'code_type_scope'),
        Index('idx_activity_code_value', 'code_value'),
    )
    
    def __repr__(self):
        return f"<P6ActivityCode(code_type={self.code_type_name}, value={self.code_value}, scope={self.code_type_scope})>"
