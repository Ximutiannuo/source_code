"""
带边框表格的网格检测与单元格分配

流程：图像 → 形态学检测横竖线 → 聚类得到行/列边界 → 构建单元格网格 → 与 OCR 结果分配
用于实现「从识别到表的格式完美匹配」。
"""
import logging
from typing import List, Tuple, Optional, Dict, Any
import numpy as np
import cv2

logger = logging.getLogger(__name__)

# 聚类时，两条线距离小于该值（像素）视为同一条线
LINE_MERGE_THRESHOLD = 8
# 形态学核长度（相对短边比例）
KERNEL_RATIO = 0.02
MIN_KERNEL_LENGTH = 15
PROJECTION_THRESHOLD_RATIO = 0.2  # 降低可检测更细/浅色线


def _to_gray(img: np.ndarray) -> np.ndarray:
    if len(img.shape) == 3:
        return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return img.copy()


def _to_gray_binary(img: np.ndarray, use_adaptive: bool = False) -> np.ndarray:
    """转灰度并二值化，白底黑字便于线检测。"""
    gray = _to_gray(img)
    if use_adaptive:
        block = max(15, min(gray.shape[0], gray.shape[1]) // 20)
        if block % 2 == 0:
            block += 1
        return cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV, block, 5
        )
    # 若背景偏白，线是黑的：二值化后线为 0、背景 255，形态学用 0 为“线”
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    return binary


def _get_line_mask(binary: np.ndarray, kernel_len: int, horizontal: bool) -> np.ndarray:
    """形态学提取横线或竖线：kernel 与线方向垂直。"""
    if kernel_len < 3:
        kernel_len = 3
    if horizontal:
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_len, 1))
    else:
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, kernel_len))
    detected = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
    return detected


def _cluster_lines(positions: List[float], threshold: float) -> List[float]:
    """将一组坐标聚类，返回每类的代表值（取中位或均值）。"""
    if not positions:
        return []
    positions = sorted(positions)
    groups: List[List[float]] = []
    current = [positions[0]]
    for p in positions[1:]:
        if p - current[-1] <= threshold:
            current.append(p)
        else:
            groups.append(current)
            current = [p]
    groups.append(current)
    return [float(np.median(g)) for g in groups]


def _detect_lines_one_pass(
    img: np.ndarray,
    kernel_len: int,
    line_merge_threshold: float,
    use_adaptive: bool,
) -> Tuple[List[float], List[float]]:
    """单次二值化下的线检测。"""
    h, w = img.shape[:2]
    binary = _to_gray_binary(img, use_adaptive=use_adaptive)
    h_mask = _get_line_mask(binary, kernel_len, horizontal=True)
    v_mask = _get_line_mask(binary, kernel_len, horizontal=False)

    h_proj = np.sum(h_mask, axis=1)
    h_thresh = max(1, np.max(h_proj) * PROJECTION_THRESHOLD_RATIO)
    h_positions = [i for i in range(h) if h_proj[i] >= h_thresh]
    row_edges = _cluster_lines(h_positions, line_merge_threshold)

    v_proj = np.sum(v_mask, axis=0)
    v_thresh = max(1, np.max(v_proj) * PROJECTION_THRESHOLD_RATIO)
    v_positions = [j for j in range(w) if v_proj[j] >= v_thresh]
    col_edges = _cluster_lines(v_positions, line_merge_threshold)

    if len(row_edges) < 2:
        row_edges = [0.0, float(h)]
    if len(col_edges) < 2:
        col_edges = [0.0, float(w)]
    return sorted(row_edges), sorted(col_edges)


def detect_grid_lines(
    img: np.ndarray,
    line_merge_threshold: float = LINE_MERGE_THRESHOLD,
) -> Tuple[List[float], List[float]]:
    """
    检测图像中的表格网格线，返回行边界 Y 列表与列边界 X 列表（像素坐标）。
    先尝试 OTSU 二值化，若仅得到外框（无内部分隔线）则改用自适应阈值以应对浅色边框。
    """
    h, w = img.shape[:2]
    short_side = min(h, w)
    kernel_len = max(MIN_KERNEL_LENGTH, int(short_side * KERNEL_RATIO))

    row_edges, col_edges = _detect_lines_one_pass(
        img, kernel_len, line_merge_threshold, use_adaptive=False
    )
    # 若仅得到 2 行 2 列（仅外框），尝试自适应阈值（适合浅色线、有背景色表格）
    if len(row_edges) <= 3 and len(col_edges) <= 3:
        row_a, col_a = _detect_lines_one_pass(
            img, kernel_len, line_merge_threshold, use_adaptive=True
        )
        if len(row_a) > len(row_edges) or len(col_a) > len(col_edges):
            row_edges, col_edges = row_a, col_a
            logger.debug("网格检测：OTSU 仅得外框，自适应阈值得到更多线")

    return row_edges, col_edges


def build_cell_rects(
    row_edges: List[float],
    col_edges: List[float],
) -> List[Dict[str, Any]]:
    """
    由行/列边界构建单元格矩形列表。
    每个单元格: {"row": r, "col": c, "y0": y0, "y1": y1, "x0": x0, "x1": x1}
    row/col 从 0 开始。
    """
    cells = []
    for r in range(len(row_edges) - 1):
        for c in range(len(col_edges) - 1):
            cells.append({
                "row": r,
                "col": c,
                "y0": row_edges[r],
                "y1": row_edges[r + 1],
                "x0": col_edges[c],
                "x1": col_edges[c + 1],
            })
    return cells


def _box_center(box: List[List[float]]) -> Tuple[float, float]:
    if not box or len(box) < 4:
        return (0.0, 0.0)
    xs = [p[0] for p in box]
    ys = [p[1] for p in box]
    return (float(sum(xs) / len(xs)), float(sum(ys) / len(ys)))


def _box_intersection_area_ratio(
    box: List[List[float]],
    x0: float, y0: float, x1: float, y1: float,
) -> float:
    """OCR 框与矩形 (x0,y0,x1,y1) 的交集面积占 OCR 框面积的比例。"""
    if not box or len(box) < 4:
        return 0.0
    bx = [p[0] for p in box]
    by = [p[1] for p in box]
    obox = (min(bx), min(by), max(bx), max(by))
    ox0, oy0, ox1, oy1 = obox
    oa = max(0, ox1 - ox0) * max(0, oy1 - oy0)
    if oa <= 0:
        return 0.0
    ix0 = max(ox0, x0)
    iy0 = max(oy0, y0)
    ix1 = min(ox1, x1)
    iy1 = min(oy1, y1)
    ia = max(0, ix1 - ix0) * max(0, iy1 - iy0)
    return ia / oa


def assign_blocks_to_cells(
    blocks: List[dict],
    cell_rects: List[Dict[str, Any]],
    row_count: int,
    col_count: int,
    overlap_ratio_threshold: float = 0.3,
) -> List[List[str]]:
    """
    将 OCR 文本块分配到网格单元格。
    - 每个 block 有 "text" 和 "box"（四点坐标）。
    - 块与某单元格交集占块面积比例 >= overlap_ratio_threshold 则归属该单元格。
    - 若一块与多个单元格相交，取中心所在单元格；若中心不在任何单元格则取重叠最大的。
    - 同一单元格内多个块按从上到下、从左到右排序后拼接（空格或换行视内容而定）。
    返回二维表 table[row][col]。
    """
    table: List[List[List[str]]] = [
        [[] for _ in range(col_count)]
        for _ in range(row_count)
    ]
    for b in blocks:
        text = (b.get("text") or "").strip()
        if not text:
            continue
        box = b.get("box") or []
        cx, cy = _box_center(box)
        best_cell = None
        best_score = 0.0
        for cell in cell_rects:
            x0, y0 = cell["x0"], cell["y0"]
            x1, y1 = cell["x1"], cell["y1"]
            ratio = _box_intersection_area_ratio(box, x0, y0, x1, y1)
            if ratio < overlap_ratio_threshold:
                continue
            # 中心落在单元格内则优先
            in_cell = x0 <= cx <= x1 and y0 <= cy <= y1
            score = ratio + (10.0 if in_cell else 0.0)
            if score > best_score:
                best_score = score
                best_cell = cell
        if best_cell is not None:
            r, c = best_cell["row"], best_cell["col"]
            table[r][c].append((cy, cx, text))
    # 每格内按 (y, x) 排序后拼接
    out: List[List[str]] = []
    for r in range(row_count):
        row = []
        for c in range(col_count):
            parts = table[r][c]
            parts.sort(key=lambda x: (x[0], x[1]))
            cell_text = " ".join(p[2] for p in parts).strip()
            row.append(cell_text)
        out.append(row)
    return out


def detect_merged_cells(
    row_edges: List[float],
    col_edges: List[float],
    cell_rects: List[Dict[str, Any]],
    blocks: List[dict],
    overlap_ratio_threshold: float = 0.3,
) -> List[Tuple[int, int, int, int]]:
    """
    检测合并单元格：若某 OCR 块横跨多个网格单元格，则记录合并区域 (r0, c0, r1, c1)（含首含尾）。
    返回 merges: [(r0, c0, r1, c1), ...]，用于导出 Excel 等。
    """
    row_count = len(row_edges) - 1
    col_count = len(col_edges) - 1
    merges: List[Tuple[int, int, int, int]] = []
    seen_merge_key: set = set()
    for b in blocks:
        box = b.get("box") or []
        if not box or len(box) < 4:
            continue
        bx = [p[0] for p in box]
        by = [p[1] for p in box]
        x0, x1 = min(bx), max(bx)
        y0, y1 = min(by), max(by)
        # 该框覆盖的单元格范围
        c0 = 0
        for i, x in enumerate(col_edges[:-1]):
            if col_edges[i + 1] <= x0:
                c0 = i + 1
            elif x0 < col_edges[i + 1]:
                break
        c1 = c0
        for i in range(c0, col_count):
            if col_edges[i] < x1 <= col_edges[i + 1] or (i == col_count - 1 and x1 > col_edges[i]):
                c1 = i
                break
            if x1 > col_edges[i + 1]:
                c1 = i + 1
        r0 = 0
        for i, y in enumerate(row_edges[:-1]):
            if row_edges[i + 1] <= y0:
                r0 = i + 1
            elif y0 < row_edges[i + 1]:
                break
        r1 = r0
        for i in range(r0, row_count):
            if row_edges[i] < y1 <= row_edges[i + 1] or (i == row_count - 1 and y1 > row_edges[i]):
                r1 = i
                break
            if y1 > row_edges[i + 1]:
                r1 = i + 1
        if (r1 > r0 or c1 > c0) and (r0, c0, r1, c1) not in seen_merge_key:
            seen_merge_key.add((r0, c0, r1, c1))
            merges.append((r0, c0, r1, c1))
    return _resolve_overlapping_merges(merges)


def _merge_overlaps(m1: Tuple[int, int, int, int], m2: Tuple[int, int, int, int]) -> bool:
    """判断两个合并区域是否重叠（有公共单元格）。"""
    r0a, c0a, r1a, c1a = m1
    r0b, c0b, r1b, c1b = m2
    return not (r1a < r0b or r1b < r0a or c1a < c0b or c1b < c0a)


def _merge_union(m1: Tuple[int, int, int, int], m2: Tuple[int, int, int, int]) -> Tuple[int, int, int, int]:
    """返回两个合并区域的并集（最小包围矩形）。"""
    r0a, c0a, r1a, c1a = m1
    r0b, c0b, r1b, c1b = m2
    return (min(r0a, r0b), min(c0a, c0b), max(r1a, r1b), max(c1a, c1b))


def infer_grid_from_blocks(
    blocks: List[dict],
    img_h: int,
    img_w: int,
    line_merge_threshold: float = 12,
) -> Tuple[List[float], List[float]]:
    """
    当形态学线检测失败时，根据 OCR 块位置推断行列边界，作为 fallback。
    聚类块的中心 Y/X 得到行/列分界，再与图像边缘组合。
    """
    if not blocks:
        return [0.0, float(img_h)], [0.0, float(img_w)]

    ys, xs = [], []
    for b in blocks:
        box = b.get("box") or []
        if len(box) < 4:
            continue
        by = [p[1] for p in box]
        bx = [p[0] for p in box]
        ys.append((min(by) + max(by)) / 2)
        xs.append((min(bx) + max(bx)) / 2)

    if not ys or not xs:
        return [0.0, float(img_h)], [0.0, float(img_w)]

    row_centers = _cluster_lines(sorted(ys), line_merge_threshold)
    col_centers = _cluster_lines(sorted(xs), line_merge_threshold)

    # 在相邻行/列中心的中点插入边界；首尾用 0 和 图像尺寸
    row_edges = [0.0]
    for i in range(len(row_centers) - 1):
        row_edges.append((row_centers[i] + row_centers[i + 1]) / 2)
    row_edges.append(float(img_h))

    col_edges = [0.0]
    for i in range(len(col_centers) - 1):
        col_edges.append((col_centers[i] + col_centers[i + 1]) / 2)
    col_edges.append(float(img_w))

    return row_edges, col_edges


def _resolve_overlapping_merges(merges: List[Tuple[int, int, int, int]]) -> List[Tuple[int, int, int, int]]:
    """
    解决重叠的合并区域：Excel 不允许 overlapping merge，将重叠区域合并为并集。
    迭代直到无重叠。
    """
    if not merges:
        return []
    result = list(merges)
    changed = True
    while changed:
        changed = False
        for i in range(len(result)):
            for j in range(i + 1, len(result)):
                if _merge_overlaps(result[i], result[j]):
                    union = _merge_union(result[i], result[j])
                    result[i] = union
                    result.pop(j)
                    changed = True
                    break
            if changed:
                break
    return result
