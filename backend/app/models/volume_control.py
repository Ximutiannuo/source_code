from sqlalchemy import Column, Integer, String, Float
from app.database import Base

class VolumeControl(Base):
    __tablename__ = "volume_control"
    id = Column(Integer, primary_key=True, index=True)
    activity_id = Column(String(100), index=True)
    estimated_total = Column(Float, default=0)
