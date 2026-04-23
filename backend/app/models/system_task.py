from sqlalchemy import Column, Integer, String, DateTime, Boolean
from app.database import Base
from app.utils.timezone import now as system_now

class SystemTaskLock(Base):
    """系统任务锁，用于处理并发冲突避让机制"""
    __tablename__ = "system_task_locks"

    id = Column(Integer, primary_key=True, index=True)
    task_name = Column(String(100), unique=True, nullable=False, comment="任务名称")
    is_active = Column(Boolean, default=False, comment="是否正在运行")
    last_active_at = Column(DateTime, default=system_now, onupdate=system_now, comment="最后活跃时间")
    updated_by = Column(String(100), nullable=True, comment="更新人/进程")
    remarks = Column(String(255), nullable=True, comment="备注")

    def __repr__(self):
        return f"<SystemTaskLock(task_name='{self.task_name}', is_active={self.is_active})>"
