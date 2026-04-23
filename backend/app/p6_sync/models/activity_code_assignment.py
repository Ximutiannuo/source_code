"""
P6 Activity Code Assignment 模型
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, Index, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime, timezone


class P6ActivityCodeAssignment(Base):
    """P6作业代码分配实体"""
    __tablename__ = "p6_activity_code_assignments"
    
    # 主键
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # P6字段
    # 注意：ActivityCodeAssignment在openapi.json中没有ObjectId字段，使用组合键作为唯一标识
    object_id = Column(Integer, unique=True, nullable=False, index=True, comment="P6 ObjectId（如果没有则使用hash值）")
    
    # 作业关联
    activity_object_id = Column(Integer, index=True, nullable=False, comment="Activity ObjectId")
    activity_id = Column(String(100), index=True, comment="Activity ID")
    activity_name = Column(Text, comment="Activity Name")
    
    # 项目关联
    project_object_id = Column(Integer, index=True, comment="Project ObjectId")
    project_id = Column(String(100), comment="Project ID")
    
    # 代码类型关联
    activity_code_type_object_id = Column(Integer, index=True, nullable=False, comment="Activity Code Type ObjectId")
    activity_code_type_name = Column(String(200), index=True, comment="Activity Code Type Name")
    activity_code_type_scope = Column(String(50), comment="Activity Code Type Scope")
    
    # 代码值关联（实际分配的代码值对象）
    activity_code_object_id = Column(Integer, index=True, nullable=False, comment="Activity Code ObjectId")
    # 注意：ActivityCodeAssignment在openapi.json中有ActivityCodeObjectId字段（实际分配的代码值对象ID）
    
    # 代码值
    activity_code_value = Column(String(200), index=True, comment="Activity Code Value")
    activity_code_description = Column(Text, comment="Activity Code Description")
    
    # P6时间字段（用于增量同步）
    p6_create_date = Column(DateTime, index=True, comment="P6 CreateDate（记录创建时间）")
    p6_last_update_date = Column(DateTime, index=True, comment="P6 LastUpdateDate（记录最后更新时间，用于增量同步）")
    
    # 系统字段
    is_active = Column(Boolean, default=True, comment="是否激活")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    last_sync_at = Column(DateTime, comment="最后同步时间")
    
    # 关系
    activity = relationship(
        "P6Activity", 
        foreign_keys=[activity_object_id], 
        back_populates="activity_code_assignments",
        primaryjoin="P6ActivityCodeAssignment.activity_object_id == P6Activity.object_id"
    )
    activity_code = relationship(
        "P6ActivityCode", 
        foreign_keys=[activity_code_object_id], 
        back_populates="code_assignments",
        primaryjoin="P6ActivityCodeAssignment.activity_code_object_id == P6ActivityCode.object_id"
        # 注意：应该使用ActivityCodeObjectId关联到ActivityCode，不是ActivityCodeTypeObjectId
    )
    
    __table_args__ = (
        Index('idx_aca_object_id', 'object_id'),
        Index('idx_aca_activity', 'activity_object_id'),
        Index('idx_aca_code_type', 'activity_code_type_object_id'),
        Index('idx_aca_code_object', 'activity_code_object_id'),
        Index('idx_aca_code_value', 'activity_code_value'),
        Index('idx_aca_code_type_name', 'activity_code_type_name'),
    )
    
    def __repr__(self):
        return f"<P6ActivityCodeAssignment(activity={self.activity_id}, code_type={self.activity_code_type_name}, value={self.activity_code_value})>"
