"""
AI 助手用户提问记录 - 用于收集真实问法，优化 Function Calling
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, Index
from app.database import Base
from app.utils.timezone import now as system_now


class AIAssistantQueryLog(Base):
    """AI 助手提问记录表"""
    __tablename__ = "ai_assistant_query_log"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False, comment="用户ID")
    username = Column(String(100), comment="用户名（冗余，便于导出分析）")
    question = Column(Text, nullable=False, comment="用户提问原文")
    reply = Column(Text, comment="AI 回复原文，便于优化")
    tools_called = Column(Text, comment="JSON：系统调用的函数及参数，如 [{\"name\":\"query_daily_achieved\",\"arguments\":{...}}]")
    feedback = Column(String(20), comment="用户反馈：like/dislike")
    created_at = Column(DateTime, default=system_now, index=True, comment="提问时间")

    __table_args__ = (
        Index("idx_ai_query_log_created_at", "created_at"),
    )
