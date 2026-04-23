"""
P6同步配置模型
"""
from sqlalchemy import Column, Integer, String, Boolean, JSON, DateTime, Text
from app.database import Base
from datetime import datetime, timezone


class P6SyncConfig(Base):
    """P6同步配置"""
    __tablename__ = "p6_sync_config"
    
    # 主键
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # 项目选择配置
    default_project_ids = Column(JSON, comment="默认项目ID列表，JSON格式：['ECUPRJ', 'PELPRJ', ...]")
    
    # 同步实体选项
    global_entities = Column(JSON, comment="全局实体列表，JSON格式：['eps', 'project', 'activity_code', 'resource']")
    project_entities = Column(JSON, comment="项目实体列表，JSON格式：['wbs', 'activity', 'activity_code_assignment', 'resource_assignment']")
    
    # 同步设置
    auto_sync_enabled = Column(Boolean, default=False, comment="是否启用自动同步")
    sync_interval_minutes = Column(Integer, default=5, comment="同步间隔（分钟）")
    
    # 删除检测设置
    delete_detection_enabled = Column(Boolean, default=True, comment="是否启用删除检测")
    delete_detection_time = Column(String(10), default="02:00", comment="删除检测执行时间（HH:mm格式）")
    
    # 系统字段
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), comment="创建时间")
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), comment="更新时间")
    created_by = Column(String(100), comment="创建人")
    updated_by = Column(String(100), comment="更新人")
    
    def __repr__(self):
        return f"<P6SyncConfig(id={self.id}, auto_sync={self.auto_sync_enabled})>"
    
    def to_dict(self):
        """转换为字典"""
        return {
            "id": self.id,
            "default_project_ids": self.default_project_ids or [],
            "global_entities": self.global_entities or [],
            "project_entities": self.project_entities or [],
            "auto_sync_enabled": self.auto_sync_enabled,
            "sync_interval_minutes": self.sync_interval_minutes,
            "delete_detection_enabled": self.delete_detection_enabled,
            "delete_detection_time": self.delete_detection_time,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": self.created_by,
            "updated_by": self.updated_by,
        }

