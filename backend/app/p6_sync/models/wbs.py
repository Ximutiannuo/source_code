"""
P6 WBS (Work Breakdown Structure) 模型
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, Index, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime, timezone


class P6WBS(Base):
    """P6 WBS节点实体"""
    __tablename__ = "p6_wbs"
    
    # 主键
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # P6字段
    object_id = Column(Integer, unique=True, nullable=False, index=True, comment="P6 ObjectId")
    name = Column(String(500), comment="WBS Name")
    code = Column(String(100), index=True, comment="WBS Code")
    # 注意：WBS在openapi.json中没有Id字段，只有Code
    # 注意：WBS在openapi.json中没有WBSPath字段（WBSPath在Activity中）
    
    # 项目关联
    project_object_id = Column(Integer, index=True, nullable=False, comment="Project ObjectId")
    project_id = Column(String(100), index=True, comment="Project ID")
    
    # 层级信息
    parent_object_id = Column(Integer, index=True, comment="Parent ObjectId")
    # 注意：WBS在openapi.json中使用ParentObjectId，不是ParentWBSObjectId
    # 注意：WBS在openapi.json中没有ParentWBSId字段
    level = Column(Integer, default=0, comment="WBS层级")
    sequence_number = Column(Integer, comment="Sequence Number")
    
    # 其他信息
    # 注意：WBS在openapi.json中没有Description字段
    
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
        back_populates="wbs_nodes",
        primaryjoin="P6WBS.project_object_id == P6Project.object_id"
    )
    parent_wbs = relationship(
        "P6WBS", 
        remote_side="P6WBS.object_id", 
        backref="child_wbs",
        foreign_keys="[P6WBS.parent_object_id]",
        primaryjoin="P6WBS.parent_object_id == P6WBS.object_id"
    )
    activities = relationship(
        "P6Activity", 
        back_populates="wbs", 
        foreign_keys="[P6Activity.wbs_object_id]",
        primaryjoin="P6WBS.object_id == P6Activity.wbs_object_id"
    )
    
    __table_args__ = (
        Index('idx_wbs_object_id', 'object_id'),
        Index('idx_wbs_project', 'project_object_id'),
        Index('idx_wbs_parent', 'parent_object_id'),
        Index('idx_wbs_code', 'code'),
        # 注意：wbs_path字段太长（1000字符），无法创建索引
        # 如需查询，可以通过wbs_code或wbs_object_id来查询
    )
    
    def __repr__(self):
        return f"<P6WBS(code={self.code}, name={self.name})>"
