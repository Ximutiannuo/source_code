"""
P6 Activity 模型
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Numeric, Text, Index, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime, timezone


class P6Activity(Base):
    """P6作业实体"""
    __tablename__ = "p6_activities"
    
    # 主键
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # P6字段
    object_id = Column(Integer, unique=True, nullable=False, index=True, comment="P6 ObjectId")
    activity_id = Column(String(100), unique=True, nullable=False, index=True, comment="Activity ID")
    name = Column(Text, comment="Activity Name")
    type = Column(String(50), comment="Activity Type")
    status_code = Column(String(50), index=True, comment="Status Code")
    
    # 项目关联
    project_object_id = Column(Integer, index=True, nullable=False, comment="Project ObjectId")
    project_id = Column(String(100), index=True, comment="Project ID")
    
    # WBS关联
    wbs_object_id = Column(Integer, index=True, comment="WBS ObjectId")
    wbs_id = Column(String(100), comment="WBS ID")
    wbs_code = Column(String(100), index=True, comment="WBS Code")
    wbs_path = Column(String(1000), comment="WBS Path (long)")  # 注意：字段太长，无法创建索引
    
    # 日期信息
    start_date = Column(DateTime, comment="Start Date")
    finish_date = Column(DateTime, comment="Finish Date")
    planned_start_date = Column(DateTime, comment="Planned Start Date")
    planned_finish_date = Column(DateTime, comment="Planned Finish Date")
    actual_start_date = Column(DateTime, comment="Actual Start Date")
    actual_finish_date = Column(DateTime, comment="Actual Finish Date")
    
    # 基线信息
    baseline1_start_date = Column(DateTime, comment="Baseline1 Start Date")
    baseline1_finish_date = Column(DateTime, comment="Baseline1 Finish Date")
    baseline1_duration = Column(Numeric(18, 2), comment="Baseline1 Duration")
    
    # 工期信息
    planned_duration = Column(Numeric(18, 2), comment="Planned Duration")
    actual_duration = Column(Numeric(18, 2), comment="Actual Duration")
    at_completion_duration = Column(Numeric(18, 2), comment="At Completion Duration")
    
    # 数据日期
    data_date = Column(DateTime, comment="Data Date")
    
    # 关键路径
    is_critical = Column(Boolean, default=False, comment="Is Critical")
    is_longest_path = Column(Boolean, default=False, comment="Is Longest Path")
    
    # 其他信息
    calendar_object_id = Column(Integer, comment="Calendar ObjectId")
    # 注意：Activity在openapi.json中没有Description字段
    
    # P6时间字段（用于增量同步）
    p6_create_date = Column(DateTime, index=True, comment="P6 CreateDate（记录创建时间）")
    p6_last_update_date = Column(DateTime, index=True, comment="P6 LastUpdateDate（记录最后更新时间，用于增量同步）")
    
    # 系统字段
    is_active = Column(Boolean, default=True, comment="是否激活")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    last_sync_at = Column(DateTime, comment="最后同步时间")
    
    # 关系
    project = relationship(
        "P6Project", 
        foreign_keys=[project_object_id], 
        back_populates="activities",
        primaryjoin="P6Activity.project_object_id == P6Project.object_id"
    )
    wbs = relationship(
        "P6WBS", 
        foreign_keys=[wbs_object_id], 
        back_populates="activities",
        primaryjoin="P6Activity.wbs_object_id == P6WBS.object_id"
    )
    activity_code_assignments = relationship(
        "P6ActivityCodeAssignment", 
        back_populates="activity", 
        foreign_keys="[P6ActivityCodeAssignment.activity_object_id]",
        primaryjoin="P6Activity.object_id == P6ActivityCodeAssignment.activity_object_id"
    )
    resource_assignments = relationship(
        "P6ResourceAssignment", 
        back_populates="activity", 
        foreign_keys="[P6ResourceAssignment.activity_object_id]",
        primaryjoin="P6Activity.object_id == P6ResourceAssignment.activity_object_id"
    )
    
    __table_args__ = (
        Index('idx_activity_object_id', 'object_id'),
        Index('idx_activity_id', 'activity_id'),
        Index('idx_activity_project', 'project_object_id'),
        Index('idx_activity_wbs', 'wbs_object_id'),
        Index('idx_activity_status', 'status_code'),
        Index('idx_activity_wbs_code', 'wbs_code'),
        # 注意：wbs_path字段太长（1000字符），无法创建索引
        # 如需查询，可以通过wbs_code或wbs_object_id来查询
    )
    
    def __repr__(self):
        return f"<P6Activity(id={self.activity_id}, name={self.name[:50] if self.name else None})>"
