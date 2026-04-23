from sqlalchemy import Column, Integer, String, Float, DateTime, Date
from app.database import Base
from app.utils.timezone import now as system_now

class MPDB(Base):
    """Manpower Fact Table Skeleton"""
    __tablename__ = "mpdb"
    id = Column(Integer, primary_key=True, index=True)
    activity_id = Column(String(100), index=True)
    date = Column(Date)
    actual_units = Column(Float, default=0)

class VFACTDB(Base):
    """Progress Fact Table Skeleton"""
    __tablename__ = "vfactdb"
    id = Column(Integer, primary_key=True, index=True)
    activity_id = Column(String(100), index=True)
    date = Column(Date)
    achieved = Column(Float, default=0)
    work_package = Column(String(100))
