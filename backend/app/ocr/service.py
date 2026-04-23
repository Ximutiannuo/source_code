"""
OCR 服务 - 全 Mobile 高精度版
配置：V5 Mobile 检测 + V5 Mobile 识别，虚拟机友好，在保证精度的前提下兼顾速度。
取消 Server 版（虚拟机过慢、精度提升有限）。
排版：按阅读顺序排序文本块，按行拼接，减少乱序与多余换行。
"""
import logging
import os
import re
import threading
from typing import Dict, List, Optional, Union, Any, Tuple
from pathlib import Path
import numpy as np
import cv2

logger = logging.getLogger(__name__)

# 同行判定：两行中心 Y 相差小于该比例（相对行高）视为同一行
ROW_OVERLAP_RATIO = 0.6
# 先处理：回车/换行被 OCR 识别成的字符，统一替换为 \n，保留段落结构
# 含 ~（常被误识为回车）、↩ ↵ ⏎ 等
LINE_BREAK_CHARS = {"~", "↩", "↵", "⏎", "↲"}

# 最后去噪：纯噪声符号，在换行替换之后再做移除（不参与换行语义）
NOISE_CHARS = {
    "←", "→", "↑", "↓", "↔", "⇒", "⇐", "►", "◄", "▼", "▲",
    "<", ">",
    "¶", "¬", "¤", "·", "§", "†", "‡", "※", "☞", "⚓",
}

# 并发控制，保护虚拟机 CPU
MAX_CONCURRENT_TASKS = 2
_concurrency_semaphore = threading.Semaphore(MAX_CONCURRENT_TASKS)
_init_lock = threading.Lock()

MODEL_DIR = Path(__file__).parent / "models"
_ocr_engines: Dict[str, Any] = {}


def _box_center(box: List[List[float]]) -> Tuple[float, float]:
    """取四边形框的中心 (cx, cy)"""
    if not box or len(box) < 4:
        return (0.0, 0.0)
    xs = [p[0] for p in box]
    ys = [p[1] for p in box]
    return (float(sum(xs) / len(xs)), float(sum(ys) / len(ys)))


def _box_height(box: List[List[float]]) -> float:
    """取框的近似行高"""
    if not box or len(box) < 4:
        return 20.0
    ys = [p[1] for p in box]
    return float(max(ys) - min(ys))


def _box_top(box: List[List[float]]) -> float:
    """取框顶部 Y（较小值）"""
    if not box:
        return 0.0
    return float(min(p[1] for p in box))


def _box_bottom(box: List[List[float]]) -> float:
    """取框底部 Y（较大值）"""
    if not box:
        return 0.0
    return float(max(p[1] for p in box))


def _reading_order_sort(blocks: List[dict]) -> List[dict]:
    """按阅读顺序排序：先按行（Y）分组，同行内按 X 从左到右。"""
    if not blocks:
        return []
    centers = [_box_center(b.get("box") or []) for b in blocks]
    heights = [_box_height(b.get("box") or []) for b in blocks]
    median_h = float(np.median(heights)) if heights else 20.0
    row_threshold = max(median_h * ROW_OVERLAP_RATIO, 8.0)

    # 按中心 Y 排序，再按 Y 分组为行
    indexed = list(zip(blocks, centers))
    indexed.sort(key=lambda x: (x[1][1], x[1][0]))
    rows: List[List[dict]] = []
    for b, (cx, cy) in indexed:
        if not rows:
            rows.append([b])
            continue
        last_cy = _box_center(rows[-1][0].get("box") or [])[1]
        if abs(cy - last_cy) <= row_threshold:
            rows[-1].append(b)
        else:
            rows.append([b])

    # 同行内按 X 排序
    for row in rows:
        row.sort(key=lambda x: _box_center(x.get("box") or [])[0])
    out = []
    for row in rows:
        out.extend(row)
    return out


def _clean_block_text(text: str, strip_noise: bool = True) -> str:
    """先将回车/换行符（如 ~、↩）替换为 \\n，再在最后去除噪声符号，并规整空格（保留换行）。"""
    if not text or not isinstance(text, str):
        return ""
    s = text.strip()
    # 1) 先处理换行：回车/换行被识成的字符统一变为 \n
    for c in LINE_BREAK_CHARS:
        s = s.replace(c, "\n")
    # 2) 最后去噪
    if strip_noise:
        for c in NOISE_CHARS:
            s = s.replace(c, "")
    # 3) 规整空格，保留换行（只合并行内连续空格）
    lines = [re.sub(r" +", " ", line).strip() for line in s.split("\n")]
    s = "\n".join(lines).strip()
    return s


# 行间距大于 median_h * 该比例时视为段落间隔，输出 \n\n
PARAGRAPH_GAP_RATIO = 1.2


def blocks_to_full_text(blocks: List[dict], lang: str = "ch", enable_noise_filter: bool = True) -> str:
    """将已按阅读顺序排序的 blocks 按行拼接为全文。同行用空格（西文/俄文）或无缝（中文）连接。
    行与行之间若垂直间隙较大则输出 \\n\\n，形成自然段落。"""
    if not blocks:
        return ""
    centers = [_box_center(b.get("box") or []) for b in blocks]
    heights = [_box_height(b.get("box") or []) for b in blocks]
    median_h = float(np.median(heights)) if heights else 20.0
    row_threshold = max(median_h * ROW_OVERLAP_RATIO, 8.0)

    rows_blocks: List[List[dict]] = []
    current_row_blocks: List[dict] = []
    last_cy = None
    for b, (cx, cy) in zip(blocks, centers):
        if last_cy is None:
            current_row_blocks.append(b)
            last_cy = cy
        elif abs(cy - last_cy) <= row_threshold:
            current_row_blocks.append(b)
        else:
            if current_row_blocks:
                rows_blocks.append(current_row_blocks)
            current_row_blocks = [b]
            last_cy = cy
    if current_row_blocks:
        rows_blocks.append(current_row_blocks)

    def join_line(parts: List[str]) -> str:
        if not parts:
            return ""
        if lang == "ch":
            return "".join(parts).strip()
        out = []
        for p in parts:
            if not p:
                continue
            if out and out[-1].endswith("-") and p and not p[0].isspace():
                out[-1] = out[-1][:-1].rstrip()
            out.append(p)
        return " ".join(out).strip()

    row_bounds: List[Tuple[float, float]] = []
    for row_blocks in rows_blocks:
        boxes = [b.get("box") or [] for b in row_blocks]
        if not boxes:
            row_bounds.append((0.0, 0.0))
        else:
            row_bounds.append((min(_box_top(bb) for bb in boxes), max(_box_bottom(bb) for bb in boxes)))

    lines = [
        join_line([_clean_block_text(b.get("text") or "", strip_noise=enable_noise_filter) for b in row_blocks])
        for row_blocks in rows_blocks
    ]
    lines = [ln for ln in lines if ln]
    if not lines:
        return ""
    if len(lines) == 1:
        return lines[0]
    parts = [lines[0]]
    for i in range(1, len(lines)):
        gap = row_bounds[i][0] - row_bounds[i - 1][1]
        sep = "\n\n" if gap > median_h * PARAGRAPH_GAP_RATIO else "\n"
        parts.append(sep)
        parts.append(lines[i])
    return "".join(parts)


def get_ocr_service(lang: str = "ch", model_type: str = "mobile") -> Any:
    """获取 OCR 引擎 - 全 Mobile 链路，兼顾速度与精度"""
    global _ocr_engines
    cache_key = f"{lang}_stable"

    with _init_lock:
        if cache_key not in _ocr_engines:
            try:
                from rapidocr_onnxruntime import RapidOCR

                # 高精度参数：大边长 + 适中阈值，利于手写与小字
                kwargs = {
                    "det_limit_side_len": 960,  # 大图不虚化
                    "det_thresh": 0.3,
                    "box_thresh": 0.5,
                    "unclip_ratio": 1.6,        # 框略宽，避免裁掉笔锋
                }

                # 1. 检测模型：V5 Mobile（虚拟机友好，精度足够）
                det_mobile = MODEL_DIR / "ch_PP-OCRv5_mobile_det.onnx"
                if det_mobile.exists():
                    kwargs["det_model_path"] = str(det_mobile)
                    logger.info("检测引擎：V5 Mobile")

                # 2. 识别模型：V5 Mobile（手写体表现最佳）
                # 英俄(en_ru)用俄文模型，中俄(ch_ru)用中文模型，以兼顾混合排版
                rec_model = None
                if lang in ("ru", "en_ru"):
                    rec_model = MODEL_DIR / "ru_PP-OCRv5_rec_mobile_infer.onnx"
                elif lang == "en":
                    rec_model = MODEL_DIR / "en_PP-OCRv5_rec_mobile_infer.onnx"
                elif lang in ("ch", "ch_ru"):
                    rec_model = MODEL_DIR / "ch_PP-OCRv5_rec_mobile_infer.onnx"
                else:
                    rec_model = MODEL_DIR / "ch_PP-OCRv5_rec_mobile_infer.onnx"

                if rec_model and rec_model.exists():
                    kwargs["rec_model_path"] = str(rec_model)
                    logger.info(f"识别引擎：V5 Mobile [{rec_model.name}]")

                _ocr_engines[cache_key] = RapidOCR(**kwargs)
                logger.info("OCR 全 Mobile 引擎初始化完成")
            except Exception as e:
                logger.error(f"引擎初始化失败: {e}")
                raise
    return _ocr_engines[cache_key]

def recognize(
    image: Any, lang: str = "ch", model_type: str = "mobile", enable_noise_filter: bool = True
) -> List[dict]:
    """全图高精度识别（全 Mobile 引擎）。enable_noise_filter 为 False 时不移除 NOISE_CHARS。"""
    with _concurrency_semaphore:
        engine = get_ocr_service(lang=lang)
        img = _load_image(image)
        if img is None: return []
        
        try:
            result, _ = engine(img)
            output = []
            if result:
                for res in result:
                    box, text, confidence = res
                    output.append({
                        "text": _clean_block_text(text, strip_noise=enable_noise_filter) if text else "",
                        "confidence": float(confidence),
                        "box": [[float(p[0]), float(p[1])] for p in box]
                    })
            return _reading_order_sort(output)
        except Exception as e:
            logger.error(f"识别异常: {e}")
            return []

def _blocks_to_table_rows(blocks: List[dict], row_threshold: float = 20.0) -> List[List[str]]:
    """
    将识别块按 Y 坐标分组为行，再按列边界对齐到统一列，避免错列。
    优先用首行（表头）推断列边界；再用多行 X 聚类得到更稳定的列中心，减少内容丢失。
    """
    if not blocks:
        return []
    sorted_blocks = sorted(
        blocks,
        key=lambda b: (b.get("box") or [[0, 0]])[0][1] if (b.get("box") or []) else 0,
    )
    rows_blocks: List[List[dict]] = []
    current_row: List[dict] = [sorted_blocks[0]]
    current_y = (sorted_blocks[0].get("box") or [[0, 0]])[0][1] if sorted_blocks[0].get("box") else 0

    for i in range(1, len(sorted_blocks)):
        b = sorted_blocks[i]
        box = b.get("box") or []
        y = box[0][1] if len(box) >= 1 else 0
        if abs(y - current_y) <= row_threshold:
            current_row.append(b)
        else:
            current_row.sort(key=lambda x: _box_center(x.get("box") or [])[0])
            rows_blocks.append(current_row)
            current_row = [b]
            current_y = y
    if current_row:
        current_row.sort(key=lambda x: _box_center(x.get("box") or [])[0])
        rows_blocks.append(current_row)

    if not rows_blocks:
        return []

    # 1) 优先用首行（表头）推断列数，首行通常每列一块、结构清晰
    first_row = rows_blocks[0]
    max_row = max(rows_blocks, key=len)
    col_count = len(first_row) if len(first_row) >= 4 else len(max_row)
    col_count = max(col_count, 1)

    # 2) 多行 X 聚类：收集前若干行的块中心 X，按最大间隔切分为 col_count 列，得到稳定列中心
    sample_rows = rows_blocks[: min(6, len(rows_blocks))]
    all_x = sorted([_box_center(b.get("box") or [])[0] for row in sample_rows for b in row])
    if len(all_x) < col_count:
        ref_centers = sorted([_box_center(b.get("box") or [])[0] for b in max_row])[:col_count]
        while len(ref_centers) < col_count:
            ref_centers.append(ref_centers[-1] + 50 if ref_centers else 0)
    else:
        # 找 col_count-1 个最大间隔，作为列间分界
        gaps = [(all_x[i + 1] - all_x[i], i) for i in range(len(all_x) - 1)]
        gaps.sort(key=lambda g: -g[0])
        split_indices = sorted([g[1] + 1 for g in gaps[: col_count - 1]])
        split_indices = [0] + split_indices + [len(all_x)]
        ref_centers = [
            float(np.mean(all_x[split_indices[k] : split_indices[k + 1]]))
            for k in range(col_count)
        ]
        ref_centers.sort()

    # 列边界：相邻列中心的中点
    boundaries = [ref_centers[0] - 200]
    for i in range(col_count - 1):
        boundaries.append((ref_centers[i] + ref_centers[i + 1]) / 2)
    boundaries.append(ref_centers[-1] + 200)

    def _block_to_col_idx(b: dict) -> int:
        cx = _box_center(b.get("box") or [])[0]
        for k in range(col_count):
            if boundaries[k] <= cx < boundaries[k + 1]:
                return k
        return min(col_count - 1, max(0, int(np.searchsorted(ref_centers, cx))))

    table = []
    for row_blocks in rows_blocks:
        cells: List[List[str]] = [[] for _ in range(col_count)]
        for b in row_blocks:
            k = _block_to_col_idx(b)
            text = (b.get("text") or "").strip()
            if text:
                cells[k].append(text)
        row = [" ".join(c).strip() if c else "" for c in cells]
        table.append(row)
    return table


def _table_to_markdown(rows: List[List[str]]) -> str:
    """将二维表格转为 Markdown 表格字符串。"""
    if not rows:
        return ""
    # 表头 + 分隔行 + 数据行
    lines = []
    for i, row in enumerate(rows):
        escaped = [str(c).replace("|", "\\|") for c in row]
        lines.append("| " + " | ".join(escaped) + " |")
        if i == 0:
            lines.append("| " + " | ".join(["---"] * len(row)) + " |")
    return "\n".join(lines)


def recognize_structure(image: Any, enable_noise_filter: bool = True) -> dict:
    """结构化识别：全图 OCR 后按行分组为表格，保证右侧识别结果以表格展示。"""
    items = recognize(image, lang="ch", enable_noise_filter=enable_noise_filter)
    if not items:
        return {"markdown": "", "tables": []}
    table = _blocks_to_table_rows(items)
    markdown = _table_to_markdown(table)
    return {"markdown": markdown, "tables": [table]}


def _load_image_for_grid(image: Any) -> Optional[np.ndarray]:
    """加载图像供网格检测使用（与 recognize 一致）。"""
    return _load_image(image)


def recognize_bordered_table(
    image: Any,
    lang: str = "ru",
    enable_noise_filter: bool = True,
    line_merge_threshold: float = 8,
) -> dict:
    """
    带边框表格识别：先检测网格线得到行列边界，再 OCR，最后将文本块分配到单元格，
    实现从识别到表格式的完美匹配。适合规则、带边框的表格（如俄语/英语技术规格表）。

    返回:
      - tables: [[[cell_text, ...], ...]] 二维表（列表的列表）
      - markdown: 表格的 Markdown 表示
      - merges: [(r0, c0, r1, c1), ...] 合并单元格范围（0-based，含首含尾），用于导出 Excel
      - grid_detected: 是否成功检测到网格（若为 False 则回退为按行分组，无 merges）
    """
    from app.ocr.table_grid import (
        detect_grid_lines,
        build_cell_rects,
        assign_blocks_to_cells,
        detect_merged_cells,
        infer_grid_from_blocks,
    )

    img = _load_image_for_grid(image)
    if img is None:
        return {"markdown": "", "tables": [], "merges": [], "grid_detected": False}

    with _concurrency_semaphore:
        # 1) 检测网格线
        try:
            row_edges, col_edges = detect_grid_lines(img, line_merge_threshold=line_merge_threshold)
        except Exception as e:
            logger.warning(f"网格线检测异常，回退为按行分组: {e}")
            data = recognize_structure(image, enable_noise_filter=enable_noise_filter)
            data["merges"] = []
            data["grid_detected"] = False
            return data

        row_count = len(row_edges) - 1
        col_count = len(col_edges) - 1

        # 2) OCR（支持俄语/英语/中文）
        items = recognize(image, lang=lang, enable_noise_filter=enable_noise_filter)

        # 若线检测仅得到外框（2 行 2 列），尝试基于 OCR 块位置推断网格
        if (row_count < 2 or col_count < 2) and items:
            h, w = img.shape[:2]
            row_edges, col_edges = infer_grid_from_blocks(
                items, h, w, line_merge_threshold=line_merge_threshold
            )
            row_count = len(row_edges) - 1
            col_count = len(col_edges) - 1
            if row_count >= 2 and col_count >= 2:
                logger.info("线检测失败，基于内容推断网格成功")

        # 仍无效则回退为按行分组
        if row_count < 2 or col_count < 2:
            logger.info("网格行列数过少，回退为按行分组")
            data = recognize_structure(image, enable_noise_filter=enable_noise_filter)
            data["merges"] = []
            data["grid_detected"] = False
            return data
        if not items:
            return {
                "markdown": "",
                "tables": [],
                "merges": [],
                "grid_detected": True,
            }

        # 3) 构建单元格矩形并分配文本
        cell_rects = build_cell_rects(row_edges, col_edges)
        table = assign_blocks_to_cells(items, cell_rects, row_count, col_count)
        merges = detect_merged_cells(row_edges, col_edges, cell_rects, items)

        # 4) Markdown
        markdown = _table_to_markdown(table)

    return {
        "markdown": markdown,
        "tables": [table],
        "merges": merges,
        "grid_detected": True,
    }

def recognize_as_plain_text(
    image: Any, lang: str = "ch", sep: str = "\n", enable_noise_filter: bool = True
) -> str:
    """纯文本输出，与 full_text 同一套排版逻辑；sep 为行间分隔符。"""
    items = recognize(image, lang=lang, enable_noise_filter=enable_noise_filter)
    return blocks_to_full_text(items, lang=lang, enable_noise_filter=enable_noise_filter).replace("\n", sep)

def _load_image(image: Any) -> np.ndarray:
    if isinstance(image, (str, Path)): return cv2.imread(str(image))
    if isinstance(image, bytes): return cv2.imdecode(np.frombuffer(image, np.uint8), cv2.IMREAD_COLOR)
    if isinstance(image, np.ndarray): return image
    return None
