"""
用户偏好设置数据模型
用于存储用户的界面配置（如作业清单的栏位配置、分组方式等）
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime, timezone
from app.utils.timezone import now as system_now


class UserPreference(Base):
    """用户偏好设置表"""
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete='CASCADE'), nullable=False, index=True, comment="用户ID")
    preference_type = Column(String(100), nullable=False, index=True, comment="偏好类型（如：activity_list_columns, activity_list_grouping等）")
    preference_key = Column(String(100), nullable=True, index=True, comment="偏好键（用于区分同一类型的多个配置）")
    preference_value = Column(JSON, nullable=True, comment="偏好值（JSON格式）")
    created_at = Column(DateTime, default=system_now, comment="创建时间")
    updated_at = Column(DateTime, default=system_now, onupdate=system_now, comment="更新时间")
    
    # 关系
    user = relationship("User", lazy="selectin")

