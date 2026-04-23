"""
P6同步日志模型
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, Enum, Index
from app.database import Base
from datetime import datetime, timezone
import enum


class SyncStatus(enum.Enum):
    """同步状态枚举"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class SyncEntityType(enum.Enum):
    """同步实体类型枚举"""
    EPS = "eps"
    PROJECT = "project"
    WBS = "wbs"
    ACTIVITY = "activity"
    ACTIVITY_CODE = "activity_code"
    ACTIVITY_CODE_ASSIGNMENT = "activity_code_assignment"
    RESOURCE = "resource"
    RESOURCE_ASSIGNMENT = "resource_assignment"
    ALL = "all"


class P6SyncLog(Base):
    """P6同步日志"""
    __tablename__ = "p6_sync_logs"
    
    # 主键
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # 同步信息
    sync_type = Column(Enum(SyncEntityType), nullable=False, comment="同步实体类型")
    sync_status = Column(Enum(SyncStatus), default=SyncStatus.PENDING, comment="同步状态")
    project_id = Column(String(100), index=True, comment="项目ID（如果适用）")
    project_object_id = Column(Integer, comment="项目ObjectId（如果适用）")
    
    # 统计信息
    total_count = Column(Integer, default=0, comment="总记录数")
    created_count = Column(Integer, default=0, comment="新建记录数")
    updated_count = Column(Integer, default=0, comment="更新记录数")
    skipped_count = Column(Integer, default=0, comment="跳过记录数")
    error_count = Column(Integer, default=0, comment="错误记录数")
    
    # 时间信息
    started_at = Column(DateTime, comment="开始时间")
    completed_at = Column(DateTime, comment="完成时间")
    duration_seconds = Column(Integer, comment="耗时（秒）")
    
    # 错误信息
    error_message = Column(Text, comment="错误消息")
    error_details = Column(Text, comment="错误详情（JSON格式）")
    
    # 系统字段
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    __table_args__ = (
        Index('idx_sync_log_status', 'sync_status'),
        Index('idx_sync_log_type', 'sync_type'),
        Index('idx_sync_log_project', 'project_id'),
        Index('idx_sync_log_created', 'created_at'),
    )
    
    def __repr__(self):
        return f"<P6SyncLog(id={self.id}, type={self.sync_type.value}, status={self.sync_status.value})>"
