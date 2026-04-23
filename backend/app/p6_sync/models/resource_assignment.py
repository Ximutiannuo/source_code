"""
P6 Resource Assignment 模型
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Numeric, Text, Index, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime, timezone


class P6ResourceAssignment(Base):
    """P6资源分配实体"""
    __tablename__ = "p6_resource_assignments"
    
    # 主键
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # P6字段
    object_id = Column(Integer, unique=True, nullable=False, index=True, comment="P6 ObjectId")
    
    # 作业关联
    activity_object_id = Column(Integer, index=True, nullable=False, comment="Activity ObjectId")
    activity_id = Column(String(100), index=True, comment="Activity ID")
    activity_name = Column(Text, comment="Activity Name")
    
    # 资源关联
    resource_object_id = Column(Integer, index=True, nullable=False, comment="Resource ObjectId")
    resource_id = Column(String(100), index=True, comment="Resource ID")
    resource_name = Column(String(500), comment="Resource Name")
    resource_type = Column(String(50), comment="Resource Type")
    
    # 项目关联
    project_object_id = Column(Integer, index=True, comment="Project ObjectId")
    project_id = Column(String(100), comment="Project ID")
    
    # 分配数量
    planned_units = Column(Numeric(18, 2), comment="Planned Units")
    actual_units = Column(Numeric(18, 2), comment="Actual Units")
    remaining_units = Column(Numeric(18, 2), comment="Remaining Units")
    at_completion_units = Column(Numeric(18, 2), comment="At Completion Units")
    
    # 成本信息
    planned_cost = Column(Numeric(18, 2), comment="Planned Cost")
    actual_cost = Column(Numeric(18, 2), comment="Actual Cost")
    remaining_cost = Column(Numeric(18, 2), comment="Remaining Cost")
    at_completion_cost = Column(Numeric(18, 2), comment="At Completion Cost")
    
    # 角色关联（注意：实际数据中RoleObjectId可能为空，虽然API规范说是必需的）
    role_object_id = Column(Integer, index=True, nullable=True, comment="Role ObjectId（可能为空）")
    role_id = Column(String(100), comment="Role ID")
    role_name = Column(String(500), comment="Role Name")
    
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
        back_populates="resource_assignments",
        primaryjoin="P6ResourceAssignment.activity_object_id == P6Activity.object_id"
    )
    resource = relationship(
        "P6Resource", 
        foreign_keys=[resource_object_id], 
        back_populates="resource_assignments",
        primaryjoin="P6ResourceAssignment.resource_object_id == P6Resource.object_id"
    )
    
    __table_args__ = (
        Index('idx_ra_object_id', 'object_id'),
        Index('idx_ra_activity', 'activity_object_id'),
        Index('idx_ra_resource', 'resource_object_id'),
        Index('idx_ra_project', 'project_object_id'),
        Index('idx_ra_role', 'role_object_id'),
    )
    
    def __repr__(self):
        return f"<P6ResourceAssignment(activity={self.activity_id}, resource={self.resource_id})>"
