"""
主项子项清单数据模型
根据 Facility_List.xlsx 的列结构重建
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Index, ForeignKey
from app.database import Base
from datetime import datetime, timezone
from app.utils.timezone import now as system_now


class Facility(Base):
    """主项子项清单（Facility List）"""
    __tablename__ = "facilities"

    id = Column(Integer, primary_key=True, index=True)
    
    # 核心字段（对应 Excel 列名）
    block = Column(String(100), index=True, comment="Block")
    project = Column(String(100), index=True, comment="Project")
    subproject = Column(String(100), index=True, comment="Sub-project")
    train = Column(String(100), index=True, comment="Train")
    unit = Column(String(100), index=True, comment="Unit")
    main_block = Column(String(100), index=True, comment="Main_Block")
    descriptions = Column(Text, comment="Descriptions")
    simple_block = Column(String(100), index=True, comment="Simple Block")
    quarter = Column(String(100), comment="Quarter")
    start_up_sequence = Column(String(100), comment="启动序列")
    title_type = Column(String(100), comment="Title Type")
    # 装置类型（关联 facility_types，用于生成逻辑关系表）
    facility_type_id = Column(Integer, ForeignKey("facility_types.id", ondelete="SET NULL"), nullable=True, index=True, comment="装置类型ID")

    # 系统字段
    is_active = Column(Boolean, default=True, comment="是否激活")
    created_at = Column(DateTime, default=system_now)
    updated_at = Column(DateTime, default=system_now, onupdate=system_now)

    __table_args__ = (
        Index('idx_facility_block', 'block'),
        Index('idx_facility_project', 'project'),
        Index('idx_facility_unit', 'unit'),
        Index('idx_facility_main_block', 'main_block'),
    )
