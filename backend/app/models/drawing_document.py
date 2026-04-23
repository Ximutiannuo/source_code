from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.database import Base


class DrawingDocument(Base):
    __tablename__ = "drawing_documents"

    id = Column(Integer, primary_key=True, index=True)
    document_number = Column(String(100), index=True, nullable=False, comment="Document or drawing number")
    document_name = Column(String(255), nullable=False, comment="Document name")
    document_type = Column(String(50), default="CAD", index=True, comment="CAD, SOLIDWORKS, PDF, DXF, STEP")
    source_type = Column(String(50), default="DESIGN_DOC", index=True, comment="DESIGN_DOC, OCR_IMPORTED, MANUAL")
    status = Column(String(30), default="RELEASED", index=True, comment="DRAFT, RELEASED, ARCHIVED")

    version = Column(String(50), comment="Document version")
    revision = Column(String(50), comment="Revision")
    discipline = Column(String(100), index=True, comment="Discipline")
    cad_software = Column(String(50), comment="CAD software name")
    tags = Column(String(255), comment="Comma separated tags")
    description = Column(Text, comment="Description")

    product_code = Column(String(50), index=True, comment="Linked product code")
    material_id = Column(Integer, ForeignKey("materials.id", ondelete="SET NULL"), index=True)
    material_code = Column(String(50), index=True, comment="Linked material code")
    bom_header_id = Column(Integer, ForeignKey("bom_headers.id", ondelete="SET NULL"), index=True)

    file_name = Column(String(255), nullable=False, comment="Original file name")
    file_ext = Column(String(50), comment="File extension")
    mime_type = Column(String(100), comment="Mime type")
    file_size = Column(BigInteger, default=0, comment="File size in bytes")
    file_path = Column(String(500), nullable=False, comment="Relative storage path")
    source_relative_path = Column(String(500), index=True, comment="Relative path within imported CAD directory")

    ocr_status = Column(String(30), default="NONE", index=True, comment="NONE, PROCESSED, FAILED")
    ocr_text = Column(Text, comment="OCR extracted full text")

    uploader_name = Column(String(100), comment="Uploader")
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    material = relationship("Material")
    bom_header = relationship("BOMHeader")
    bom_items = relationship("BOMItem", back_populates="drawing_document")
