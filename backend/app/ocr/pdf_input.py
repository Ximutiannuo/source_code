"""
PDF 输入处理：优先从 PDF 提取文本与表格（抓取元素），失败则提供页面图像供 OCR。
"""
import io
import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# 可提取文本的最小长度，低于此值视为扫描件，走 OCR
PDF_EXTRACT_MIN_TEXT_LEN = 80


def extract_from_pdf(contents: bytes) -> Optional[Dict[str, Any]]:
    """
    从 PDF 中提取文本与表格（适用于电子版 PDF，非扫描件）。
    返回 None 表示提取失败或内容过少（建议走 OCR）。
    成功时返回:
      - full_text: 全文
      - tables: List[List[List[str]]] 每页的表格列表的列表（先按页再按表）
      - blocks: List[dict] 带 box 的文本块，便于与 OCR 结果格式一致
      - page_count: 页数
    """
    try:
        import pdfplumber
    except ImportError:
        logger.warning("pdfplumber 未安装，无法从 PDF 提取文本")
        return None

    try:
        pdf = pdfplumber.open(io.BytesIO(contents))
        page_count = len(pdf.pages)
        all_text_parts: List[str] = []
        all_tables: List[List[List[str]]] = []
        blocks: List[dict] = []

        for page in pdf.pages:
            # 提取页面文本（保留顺序）
            text = page.extract_text()
            if text and text.strip():
                all_text_parts.append(text.strip())

            # 单词级 bbox，用于构造 blocks（与 OCR 的 box 格式一致：[[x0,y0],[x1,y0],[x1,y1],[x0,y1]]）
            words = page.extract_words(keep_blank_chars=False, x_tolerance=2, y_tolerance=2)
            for w in words:
                x0, top, x1, bottom = w.get("x0"), w.get("top"), w.get("x1"), w.get("bottom")
                if x0 is None or top is None:
                    continue
                if x1 is None:
                    x1 = x0 + 10
                if bottom is None:
                    bottom = top + 10
                box = [[float(x0), float(top)], [float(x1), float(top)], [float(x1), float(bottom)], [float(x0), float(bottom)]]
                blocks.append({"text": (w.get("text") or "").strip(), "confidence": 1.0, "box": box})

            # 表格
            tables = page.extract_tables()
            if tables:
                for t in tables:
                    if t and any(cell and str(cell).strip() for row in t for cell in row):
                        # 统一为 List[List[str]]
                        rows = [[str(cell or "").strip() for cell in row] for row in t]
                        all_tables.append(rows)

        pdf.close()

        full_text = "\n\n".join(all_text_parts).strip()
        if len(full_text) < PDF_EXTRACT_MIN_TEXT_LEN and not all_tables:
            return None

        return {
            "full_text": full_text,
            "tables": all_tables,
            "blocks": blocks,
            "page_count": page_count,
        }
    except Exception as e:
        logger.warning("PDF 提取失败，将回退 OCR: %s", e)
        return None


def pdf_pages_to_images(contents: bytes, max_pages: int = 20, dpi: int = 150) -> List[Any]:
    """
    将 PDF 每页渲染为图像（numpy BGR），用于扫描版 PDF 的 OCR。
    返回 List[np.ndarray]，每页一个。
    """
    try:
        import fitz
        import numpy as np
    except ImportError:
        logger.warning("pymupdf (fitz) 未安装，无法将 PDF 转为图像")
        return []

    try:
        doc = fitz.open(stream=contents, filetype="pdf")
        images = []
        for i in range(min(len(doc), max_pages)):
            page = doc[i]
            mat = fitz.Matrix(dpi / 72.0, dpi / 72.0)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            if pix.n == 4:
                # RGBA -> RGB
                img = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, 4))
                img = img[:, :, :3]
            else:
                img = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, pix.n))
            if img.shape[2] == 3:
                # OpenCV 使用 BGR
                img = np.ascontiguousarray(img[:, :, ::-1])
            images.append(img)
        doc.close()
        return images
    except Exception as e:
        logger.warning("PDF 转图像失败: %s", e)
        return []
