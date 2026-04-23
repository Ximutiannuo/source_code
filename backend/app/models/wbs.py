"""
WBS相关数据模型
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime, timezone
from app.utils.timezone import now as system_now


class WBSNode(Base):
    """WBS节点"""
    __tablename__ = "wbs_nodes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(100), unique=True, index=True, comment="WBS编码")
    name = Column(String(255), comment="节点名称")
    level = Column(Integer, comment="层级：1-Project, 2-Sub-project, 3-Phase, 4-Train, 5-Unit, 6-Block, 7-Discipline")
    parent_id = Column(Integer, ForeignKey("wbs_nodes.id"), nullable=True, comment="父节点ID")
    project = Column(String(50), comment="项目")
    subproject = Column(String(50), comment="子项目")
    phase = Column(String(50), comment="阶段")
    train = Column(String(50), comment="Train")
    unit = Column(String(50), comment="Unit")
    block = Column(String(50), comment="Block")
    discipline = Column(String(50), comment="专业")
    description = Column(Text, comment="描述")
    sort_order = Column(Integer, default=0, comment="排序")
    created_at = Column(DateTime, default=system_now)
    updated_at = Column(DateTime, default=system_now, onupdate=system_now)

    # 关系
    children = relationship("WBSNode", backref="parent", remote_side=[id])
    diagrams = relationship("WBSDiagram", back_populates="wbs_node")


class WBSDiagram(Base):
    """WBS图表配置"""
    __tablename__ = "wbs_diagrams"

    id = Column(Integer, primary_key=True, index=True)
    wbs_node_id = Column(Integer, ForeignKey("wbs_nodes.id"), comment="WBS节点ID")
    diagram_type = Column(String(50), comment="图表类型")
    layout_config = Column(JSON, comment="布局配置")
    style_config = Column(JSON, comment="样式配置")
    created_at = Column(DateTime, default=system_now)
    updated_at = Column(DateTime, default=system_now, onupdate=system_now)

    # 关系
    wbs_node = relationship("WBSNode", back_populates="diagrams")

