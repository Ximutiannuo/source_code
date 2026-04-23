"""
S 曲线缓存与 GlobalFilter 维度工具
用于构建 filter_key、生成 activity_summary WHERE 子句
维度列与 activity_summary / rsc_defines 列名一致，便于直接从源表取数
"""
import re
from typing import Dict, List, Optional, Any

# activity_summary 列名（用于 JOIN 时加表别名）
_ACT_COLS = [
    "implement_phase", "contract_phase", "subproject", "train", "unit",
    "simple_block", "main_block", "block", "quarter", "scope", "discipline",
    "type", "work_package",
]

# 全量预聚合时按「单维度」批量扫表，每维度只扫一次大表（与缓存表维度列一致）
DIMENSION_COLUMNS_FOR_REFRESH = [
    "subproject", "train", "unit", "simple_block", "main_block", "block",
    "quarter", "scope", "discipline", "implement_phase", "contract_phase",
    "type", "work_package",
]

# 维度列：与 activity_summary / rsc_defines 列名一致
_DIM_COLUMNS = [
    "subproject", "train", "unit", "simple_block", "main_block", "block",
    "quarter", "scope", "discipline", "implement_phase", "contract_phase",
    "type", "work_package", "resource_id_name", "bcc_kq_code", "kq", "cn_wk_report"
]
# API/前端传入 type 时可能用 activity_type 作为 key
_FILTER_KEY_ALIASES: Dict[str, List[str]] = {
    "type": ["type", "activity_type"],
}


def _get_filter_value(filters: Optional[Dict[str, Any]], dim_col: str) -> Any:
    """从 filters 取值，支持 API/前端的多种 key 写法"""
    if not filters:
        return None
    aliases = _FILTER_KEY_ALIASES.get(dim_col, [dim_col])
    for k in aliases:
        v = filters.get(k)
        if v is not None:
            return v
    return None


def _norm_arr(v: Any) -> Optional[List[str]]:
    """归一化为排序后的非空字符串列表"""
    if v is None:
        return None
    if isinstance(v, str):
        v = [x.strip() for x in v.split(",") if x.strip()]
    if isinstance(v, (list, tuple)):
        arr = [str(x).strip() for x in v if x is not None and str(x).strip()]
        return sorted(arr) if arr else None
    return None


def _sql_escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace("'", "''")


def build_filter_key(filters: Optional[Dict[str, Any]]) -> str:
    """
    从 GlobalFilter 状态构建确定性 filter_key
    空/全为 None 时返回 ''（表示全局）
    """
    if not filters:
        return ""
    parts = []
    for k in sorted(_DIM_COLUMNS):
        v = _get_filter_value(filters, k)
        arr = _norm_arr(v)
        if arr:
            parts.append(f"{k}={','.join(arr)}")
    return "|".join(parts) if parts else ""


def filters_to_cache_columns(filters: Optional[Dict[str, Any]]) -> Dict[str, Optional[str]]:
    """将 filters 转为缓存表维度列值（列名与 activity_summary/rsc_defines 一致）"""
    out: Dict[str, Optional[str]] = {}
    for k in _DIM_COLUMNS:
        v = _get_filter_value(filters, k)
        arr = _norm_arr(v)
        out[k] = ",".join(arr) if arr else None
    return out


def build_act_where_sql(filters: Optional[Dict[str, Any]], base: str = "contract") -> str:
    """
    构建 activity_summary 的 WHERE 子句（含 base 条件）
    base: 'contract' 用于 Period Budget, 'implement' 用于 Total Budget 分母
    返回可直接嵌入 IN (SELECT activity_id FROM activity_summary WHERE ...) 的片段
    """
    if base == "implement":
        conds = ["implement_phase IS NOT NULL", "implement_phase <> ''"]
    else:
        conds = ["contract_phase IS NOT NULL", "contract_phase <> ''"]
    if not filters:
        return " AND ".join(conds)

    # activity_summary 列名（维度与源表一致，部分需从 API/前端别名读取）
    for col in ["subproject", "train", "unit", "simple_block", "main_block", "block",
                "quarter", "scope", "discipline", "implement_phase", "contract_phase",
                "type", "work_package"]:
        v = _get_filter_value(filters, col)
        arr = _norm_arr(v)
        if not arr:
            continue
        escaped = [_sql_escape(x) for x in arr]
        if len(escaped) == 1:
            conds.append(f"{col} = '{escaped[0]}'")
        else:
            in_vals = ",".join("'{}'".format(e) for e in escaped)
            conds.append(f"{col} IN ({in_vals})")
    return " AND ".join(conds)


def act_where_with_alias(where_clause: str, alias: str) -> str:
    """给 WHERE 子句中的列名添加表别名"""
    if not where_clause:
        return ""
    out = where_clause
    for col in _ACT_COLS:
        # 简单正则替换：确保是独立单词
        out = re.sub(rf'\b{col}\b', f"{alias}.{col}", out)
    return out
