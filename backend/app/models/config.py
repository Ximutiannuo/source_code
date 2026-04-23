"""
系统配置数据模型
用于存储可配置的系统参数
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, Numeric, Boolean
from app.database import Base
from datetime import datetime, timezone
from app.utils.timezone import now as system_now


class SystemConfig(Base):
    """系统配置表"""
    __tablename__ = "system_configs"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, index=True, comment="配置键")
    value = Column(Text, comment="配置值")
    value_type = Column(String(50), default="string", comment="值类型：string, number, decimal, boolean")
    description = Column(Text, comment="配置说明")
    category = Column(String(50), index=True, comment="配置分类：calculation, ui, system等")
    is_active = Column(Boolean, default=True, comment="是否激活")
    created_at = Column(DateTime, default=system_now)
    updated_at = Column(DateTime, default=system_now, onupdate=system_now)

