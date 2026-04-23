"""
OCR 独立模块 - 基于 PaddleOCR

支持中英俄多语言识别，可作为通用工具使用。
后续可根据业务需求扩展具体场景（如日报识别、票据识别等）。
"""
from app.ocr.service import get_ocr_service

__all__ = ["get_ocr_service"]
