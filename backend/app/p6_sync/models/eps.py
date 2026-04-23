"""
P6 EPS (Enterprise Project Structure) 模型
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Index
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime, timezone


class P6EPS(Base):
    """P6 EPS实体"""
    __tablename__ = "p6_eps"
    
    # 主键
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # P6字段
    object_id = Column(Integer, unique=True, nullable=False, index=True, comment="P6 ObjectId")
    eps_id = Column(String(100), index=True, comment="EPS ID")
    name = Column(String(500), comment="EPS Name")
    parent_object_id = Column(Integer, index=True, comment="Parent ObjectId")
    # 注意：EPS在openapi.json中使用ParentObjectId，不是ParentEPSObjectId
    parent_eps_id = Column(String(100), comment="Parent EPS ID")
    parent_eps_name = Column(String(500), comment="Parent EPS Name")
    
    # OBS关联
    obs_object_id = Column(Integer, comment="OBS ObjectId")
    obs_name = Column(String(500), comment="OBS Name")
    
    # 层级信息
    level = Column(Integer, default=0, comment="EPS层级（从根节点开始）")
    sequence_number = Column(Integer, comment="Sequence Number")
    
    # P6时间字段（用于增量同步）
    p6_create_date = Column(DateTime, index=True, comment="P6 CreateDate（记录创建时间）")
    p6_last_update_date = Column(DateTime, index=True, comment="P6 LastUpdateDate（记录最后更新时间，用于增量同步）")
    
    # 系统字段
    is_active = Column(Boolean, default=True, comment="是否激活")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    last_sync_at = Column(DateTime, comment="最后同步时间")
    
    # 关系
    projects = relationship(
        "P6Project", 
        back_populates="eps", 
        foreign_keys="[P6Project.parent_eps_object_id]",
        primaryjoin="P6EPS.object_id == P6Project.parent_eps_object_id"
    )
    child_eps = relationship(
        "P6EPS", 
        backref="parent_eps", 
        remote_side="P6EPS.object_id",
        foreign_keys="[P6EPS.parent_object_id]",
        primaryjoin="P6EPS.object_id == P6EPS.parent_object_id"
    )
    
    __table_args__ = (
        Index('idx_eps_object_id', 'object_id'),
        Index('idx_eps_parent', 'parent_object_id'),
        Index('idx_eps_level', 'level'),
    )
    
    def __repr__(self):
        return f"<P6EPS(id={self.eps_id}, name={self.name})>"
