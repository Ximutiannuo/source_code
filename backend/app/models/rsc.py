"""
RSC_Define 工作包资源定义数据模型
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, Numeric, Boolean
from app.database import Base
from datetime import datetime, timezone
from app.utils.timezone import now as system_now


class RSCDefine(Base):
    """工作包资源定义表"""
    __tablename__ = "rsc_defines"

    id = Column(Integer, primary_key=True, index=True)
    work_package = Column(String(50), index=True, comment="工作包")
    wpkg_description = Column(String(255), comment="工作包描述")
    resource_id = Column(String(100), index=True, comment="资源ID")
    resource_id_name = Column(String(255), index=True, comment="资源ID名称")
    uom = Column(String(50), comment="单位")
    norms = Column(Numeric(18, 2), comment="标准")
    norms_mp = Column(Numeric(18, 2), comment="标准人力")
    norms_mp_20251103 = Column(Numeric(18, 2), comment="标准人力(20251103)")
    bcc_kq_code = Column(String(100), comment="BCC.KQ.CODE")
    kq = Column(String(100), comment="KQ")
    cn_wk_report = Column(String(50), comment="CN_WK Report")
    rfi_a = Column(Text, comment="RFI (A)")
    rfi_b = Column(Text, comment="RFI (B)")
    rfi_c = Column(Text, comment="RFI (C)")
    remarks = Column(Text, comment="备注")
    is_active = Column(Boolean, default=True, comment="是否激活")
    created_at = Column(DateTime, default=system_now)
    updated_at = Column(DateTime, default=system_now, onupdate=system_now)

