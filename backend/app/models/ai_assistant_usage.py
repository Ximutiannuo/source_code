"""
AI 助手每日用量记录 - 用于限流（每用户每天 20 次）
"""
from sqlalchemy import Column, Integer, Date, Index
from app.database import Base


class AIAssistantUsage(Base):
    """AI 助手每日用量表"""
    __tablename__ = "ai_assistant_usage"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False, comment="用户ID")
    usage_date = Column(Date, index=True, nullable=False, comment="使用日期")
    count = Column(Integer, default=0, nullable=False, comment="当日已使用次数")

    __table_args__ = (
        Index("idx_ai_assistant_usage_user_date", "user_id", "usage_date", unique=True),
    )
