"""
作业状态控制模型 - 独立于 activity_summary 刷新逻辑
用于持久化存储用户手动确认的完成状态和日期
"""
from sqlalchemy import Column, Integer, String, DateTime, Date, ForeignKey, Index
from app.database import Base
from app.utils.timezone import now as system_now

class ActivityStatusRecord(Base):
    """作业状态控制表（真值来源）"""
    __tablename__ = "activity_status_records"

    # 使用 activity_id 作为主键，确保一个作业只有一条状态记录
    activity_id = Column(String(100), primary_key=True, index=True, comment="作业ID")
    
    # 系统确认状态：'Not Started', 'In Progress', 'Completed'
    status = Column(String(50), default='Not Started', index=True, comment="本系统内的确认状态")
    
    # 确认完成时的实际日期（计算得出）
    actual_finish_date = Column(Date, nullable=True, comment="用户确认的实际完成日期")
    
    # 审计信息
    confirmed_by = Column(Integer, ForeignKey("users.id"), nullable=True, comment="确认人ID")
    confirmed_at = Column(DateTime, nullable=True, comment="确认操作时间")
    
    # 备注（如：确认完成时的完工比例）
    remarks = Column(String(255), nullable=True, comment="确认备注")

    updated_at = Column(DateTime, default=system_now, onupdate=system_now)

    __table_args__ = (
        Index('idx_asr_status', 'status'),
        {'mysql_engine': 'InnoDB', 'mysql_charset': 'utf8mb4', 'mysql_collate': 'utf8mb4_unicode_ci'},
    )
