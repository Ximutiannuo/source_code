from sqlalchemy import Column, Integer, String, Float
from app.database import Base

class VolumeControlAsbuilt(Base):
    __tablename__ = "volume_control_asbuilt"
    id = Column(Integer, primary_key=True, index=True)
    activity_id = Column(String(100), index=True)
    asbuilt_quantity = Column(Float, default=0)
