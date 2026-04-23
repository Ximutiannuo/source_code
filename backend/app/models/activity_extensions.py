"""
作业扩展信息表
用于存储用户自定义字段、附件、备注等非关联性扩展内容
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, Date, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.database import Base
from app.utils.timezone import now as system_now


class ActivityExtensions(Base):
    """作业扩展信息表"""
    __tablename__ = "activity_extensions"

    id = Column(Integer, primary_key=True, index=True)
    activity_id = Column(String(100), unique=True, index=True, nullable=False, comment="ACT ID")
    
    # 用户自定义日期字段
    start_date_udf = Column(Date, comment="Start Date (UDF) - 用户自定义开始日期")
    start_date_udf_updated_at = Column(DateTime, comment="Start Date (UDF) 更新时间")
    start_date_udf_updated_by = Column(Integer, ForeignKey('users.id'), comment="Start Date (UDF) 更新人")
    
    finish_date_udf = Column(Date, comment="Finish Date (UDF) - 用户自定义完成日期")
    finish_date_udf_updated_at = Column(DateTime, comment="Finish Date (UDF) 更新时间")
    finish_date_udf_updated_by = Column(Integer, ForeignKey('users.id'), comment="Finish Date (UDF) 更新人")
    
    # 备注信息
    remarks = Column(Text, comment="备注信息")
    remarks_updated_at = Column(DateTime, comment="备注更新时间")
    remarks_updated_by = Column(Integer, ForeignKey('users.id'), comment="备注更新人")
    
    # 附件信息（JSON格式存储附件列表）
    # 格式: [{"filename": "xxx.pdf", "url": "/uploads/xxx.pdf", "uploaded_at": "2024-01-01T00:00:00", "uploaded_by": 1}]
    attachments = Column(Text, comment="附件信息（JSON格式）")
    
    # 创建和更新时间
    created_at = Column(DateTime, default=system_now, comment="创建时间")
    updated_at = Column(DateTime, default=system_now, onupdate=system_now, comment="更新时间")
    created_by = Column(Integer, ForeignKey('users.id'), comment="创建人")
    updated_by = Column(Integer, ForeignKey('users.id'), comment="最后更新人")
    
    # 关联关系
    start_date_udf_updater = relationship("User", foreign_keys=[start_date_udf_updated_by], lazy="select")
    finish_date_udf_updater = relationship("User", foreign_keys=[finish_date_udf_updated_by], lazy="select")
    remarks_updater = relationship("User", foreign_keys=[remarks_updated_by], lazy="select")
    creator = relationship("User", foreign_keys=[created_by], lazy="select")
    updater = relationship("User", foreign_keys=[updated_by], lazy="select")

    __table_args__ = (
        Index('idx_activity_extensions_activity_id', 'activity_id'),
        Index('idx_activity_extensions_start_date_udf', 'start_date_udf'),
        Index('idx_activity_extensions_finish_date_udf', 'finish_date_udf'),
    )
