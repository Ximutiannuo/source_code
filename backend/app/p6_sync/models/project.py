"""
P6 Project 模型
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Numeric, Text, Index, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime, timezone


class P6Project(Base):
    """P6项目实体"""
    __tablename__ = "p6_projects"
    
    # 主键
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # P6字段
    object_id = Column(Integer, unique=True, nullable=False, index=True, comment="P6 ObjectId")
    project_id = Column(String(100), index=True, comment="Project ID")
    name = Column(String(500), comment="Project Name")
    
    # EPS关联
    parent_eps_object_id = Column(Integer, index=True, comment="Parent EPS ObjectId")
    parent_eps_id = Column(String(100), comment="Parent EPS ID")
    parent_eps_name = Column(String(500), comment="Parent EPS Name")
    
    # 项目状态
    status = Column(String(50), comment="Project Status")
    start_date = Column(DateTime, comment="Start Date")
    finish_date = Column(DateTime, comment="Finish Date")
    # 注意：Project在openapi.json中使用StartDate/FinishDate，没有PlannedStartDate/PlannedFinishDate
    # 注意：Project在openapi.json中没有ActualStartDate/ActualFinishDate
    # 注意：Project在openapi.json中没有Baseline1StartDate/Baseline1FinishDate
    
    # 其他信息
    description = Column(Text, comment="Project Description")
    # 注意：Project在openapi.json中没有CalendarObjectId字段
    
    # P6时间字段（用于增量同步）
    p6_create_date = Column(DateTime, index=True, comment="P6 CreateDate（记录创建时间）")
    p6_last_update_date = Column(DateTime, index=True, comment="P6 LastUpdateDate（记录最后更新时间，用于增量同步）")
    
    # 系统字段
    is_active = Column(Boolean, default=True, comment="是否激活")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    last_sync_at = Column(DateTime, comment="最后同步时间")
    
    # 关系
    eps = relationship(
        "P6EPS", 
        foreign_keys=[parent_eps_object_id], 
        back_populates="projects",
        primaryjoin="P6Project.parent_eps_object_id == P6EPS.object_id"
    )
    wbs_nodes = relationship(
        "P6WBS", 
        back_populates="project", 
        foreign_keys="[P6WBS.project_object_id]",
        primaryjoin="P6Project.object_id == P6WBS.project_object_id"
    )
    activities = relationship(
        "P6Activity", 
        back_populates="project", 
        foreign_keys="[P6Activity.project_object_id]",
        primaryjoin="P6Project.object_id == P6Activity.project_object_id"
    )
    
    __table_args__ = (
        Index('idx_project_object_id', 'object_id'),
        Index('idx_project_id', 'project_id'),
        Index('idx_project_eps', 'parent_eps_object_id'),
    )
    
    def __repr__(self):
        return f"<P6Project(id={self.project_id}, name={self.name})>"
