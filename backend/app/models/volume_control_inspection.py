from sqlalchemy import Column, Integer, String, Float
from app.database import Base

class VolumeControlInspection(Base):
    __tablename__ = "volume_control_inspection"
    id = Column(Integer, primary_key=True, index=True)
    activity_id = Column(String(100), index=True)
    inspected_quantity = Column(Float, default=0)
