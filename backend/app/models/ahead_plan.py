from sqlalchemy import Column, Integer, String, Date, Float, ForeignKey, Boolean
from app.database import Base

class AheadPlan(Base):
    __tablename__ = "ahead_plans"
    id = Column(Integer, primary_key=True, index=True)
    activity_id = Column(String(100), index=True)
    week_ending_date = Column(Date, index=True)
    planned_quantity = Column(Float, default=0)
    actual_quantity = Column(Float, default=0)
    is_completed = Column(Boolean, default=False)
