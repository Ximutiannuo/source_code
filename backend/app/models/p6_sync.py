"""
P6同步相关数据模型
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, Enum
from app.database import Base
from datetime import datetime, timezone
from app.utils.timezone import now as system_now
import enum


class SyncStatus(str, enum.Enum):
    """同步状态"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUCCESS = "success"
    FAILED = "failed"


class P6SyncLog(Base):
    """P6同步日志（旧版本，已废弃，请使用app.p6_sync.models.sync_log.P6SyncLog）"""
    __tablename__ = "p6_sync_logs_old"  # 重命名表名以避免冲突

    id = Column(Integer, primary_key=True, index=True)
    sync_type = Column(String(50), comment="同步类型：activities-作业, schedule-进度")
    status = Column(Enum(SyncStatus), default=SyncStatus.PENDING, comment="状态")
    start_time = Column(DateTime, default=system_now, comment="开始时间")
    end_time = Column(DateTime, nullable=True, comment="结束时间")
    records_synced = Column(Integer, default=0, comment="同步记录数")
    error_message = Column(Text, nullable=True, comment="错误信息")
    sync_config = Column(JSON, nullable=True, comment="同步配置")
    created_at = Column(DateTime, default=system_now)

