"""
劳动效率（工效）分析服务
实现 DAX 公式逻辑：Period Productivity、Period Productivity w/ non-p、WeightedNorms
支持周期工效（period）和开累工效（cumulative）
预聚合缓存：productivity_cache / productivity_cache_wp，由定时任务每日刷新，优先读取
"""
import logging
from collections import defaultdict
from datetime import date, timedelta
from typing import Optional, Dict, List, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, text

from app.models.report import MPDB, VFACTDB
from app.models.rsc import RSCDefine
from app.models.activity_summary import ActivitySummary
from app.models.productivity_cache import ProductivityCache, ProductivityCacheWp
from app.services.s_curve_filter_utils import build_filter_key

logger = logging.getLogger(__name__)

# CO 工作包：非生产性人力（CO01/CO02/CO03/CO04）
CO_WORK_PACKAGES = {"CO01", "CO02", "CO03", "CO04"}
CO_NON_PRODUCTIVITY = {"CO01", "CO03", "CO04"}  # 参与 Period Non-Productivity LaborInput
PROJECT_START_DATE = date(2020, 4, 30)  # 开累工效：项目开始日期

_LOCATION_COLS = ("subproject", "train", "unit", "block", "quarter", "main_block")


def _escape_like_pattern(s: str) -> str:
    if not s:
        return s
    return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _location_filter(table_ref, loc: str):
    if not loc or not str(loc).strip():
        return True
    loc = str(loc).strip()
    esc = _escape_like_pattern(loc)
    clauses = []
    for c in _LOCATION_COLS:
        col = getattr(table_ref, c, None)
        if col is not None:
            clauses.append(or_(col == loc, col.like(f"%{esc}%", escape="\\")))
    return or_(*clauses) if clauses else True


def _apply_base_filters(q, table_ref, filters: Dict[str, Any], d_start, d_end):
    """对 MPDB 或 VFACTDB 应用基础筛选"""
    if table_ref == MPDB:
        q = q.filter(MPDB.date >= d_start, MPDB.date <= d_end)
    else:
        q = q.filter(VFACTDB.date >= d_start, VFACTDB.date <= d_end)

    t = table_ref
    
    # 1. 直接存在于 MPDB/VFACTDB 中的字段
    direct_fields = ["scope", "subproject", "train", "unit", "block", "quarter", "main_block", "work_package", "discipline", "implement_phase"]
    for f in direct_fields:
        if filters.get(f):
            q = q.filter(getattr(t, f).in_(filters[f]))

    # 2. 需要关联 ActivitySummary 的字段
    act_fields = ["contract_phase", "type", "simple_block"]
    if any(filters.get(f) for f in act_fields):
        q = q.join(ActivitySummary, t.activity_id == ActivitySummary.activity_id)
        for f in act_fields:
            if filters.get(f):
                q = q.filter(getattr(ActivitySummary, f).in_(filters[f]))

    # 3. 需要关联 RSCDefine 的字段
    rsc_fields = ["resource_id_name", "bcc_kq_code", "kq", "cn_wk_report"]
    if any(filters.get(f) for f in rsc_fields):
        q = q.join(RSCDefine, t.work_package == RSCDefine.work_package)
        for f in rsc_fields:
            if filters.get(f):
                q = q.filter(getattr(RSCDefine, f).in_(filters[f]))

    loc = filters.get("location", "").strip() if filters.get("location") else ""
    if loc:
        q = q.filter(_location_filter(t, loc))
    return q


# 工效缓存按维度批量刷新：与 S 曲线一致，仅用 MPDB/VFACTDB 直接存在的列（避免 JOIN）
PRODUCTIVITY_DIMENSION_COLUMNS = [
    "scope", "subproject", "train", "unit", "block", "quarter", "main_block",
    "discipline", "implement_phase", "work_package", "resource_id_name", "resource_id",
]

# 支持的 group_by：与维度列对应
_CACHE_SUPPORTED_GROUP_BY = {"scope", "subproject", "train", "unit", "main_block", "quarter", "work_package", "resource_id_name", "resource_id"}


def _apply_nonprod_filters(q, table_ref, filters: Dict[str, Any], d_start, d_end):
    """
    对非生产性人力应用筛选。
    只保留位置和项目阶段相关的维度，忽略资源、工作包、专业等过滤。
    这是因为非生产性人力 (CO01/CO03/CO04) 是全局或按区域存在的，不受资源切片影响。
    """
    if table_ref == MPDB:
        q = q.filter(MPDB.date >= d_start, MPDB.date <= d_end)
    else:
        q = q.filter(VFACTDB.date >= d_start, VFACTDB.date <= d_end)

    t = table_ref
    # 1. 仅保留位置相关的字段
    location_fields = ["scope", "subproject", "train", "unit", "block", "quarter", "main_block", "implement_phase"]
    for f in location_fields:
        if filters.get(f):
            q = q.filter(getattr(t, f).in_(filters[f]))

    # 2. 保留 ActivitySummary 相关的某些字段（如项目阶段）
    act_fields = ["contract_phase", "type", "simple_block"]
    if any(filters.get(f) for f in act_fields):
        q = q.join(ActivitySummary, t.activity_id == ActivitySummary.activity_id)
        for f in act_fields:
            if filters.get(f):
                q = q.filter(getattr(ActivitySummary, f).in_(filters[f]))

    # 忽略 RSCDefine 相关的字段（resource_id_name, bcc_kq_code, kq, cn_wk_report）
    # 忽略 work_package, discipline，因为 CO 工作包属于 CO 专业，若过滤 CI 则会把非生产性排除

    loc = filters.get("location", "").strip() if filters.get("location") else ""
    if loc:
        q = q.filter(_location_filter(t, loc))
    return q


def _can_use_cache(db: Session, filters: Dict, group_by: Optional[str]) -> bool:
    """是否可使用缓存：group_by 在支持列表且缓存表中存在该 filter_key+group_by 数据"""
    grp = (group_by or "").strip().lower()
    if grp in ("block", "子项"):
        grp = "block"
    elif grp in ("unit", "装置"):
        grp = "unit"
    elif grp in ("work_package", "工作包"):
        grp = "work_package"
    elif grp in ("resource_id_name", "资源"):
        grp = "resource_id_name"
    elif grp in ("resource_id", "资源id"):
        grp = "resource_id"
    elif grp in ("main_block", "主项"):
        grp = "main_block"
    elif grp in ("quarter", "区域"):
        grp = "quarter"
    if grp not in _CACHE_SUPPORTED_GROUP_BY:
        return False
    fk = build_filter_key(filters) if filters else ""
    exists = (
        db.query(ProductivityCache)
        .filter(ProductivityCache.filter_key == fk, ProductivityCache.group_by == grp)
        .limit(1)
        .first()
    )
    return exists is not None


def _get_dim_cols(group_by: str) -> tuple:
    """返回 (mpdb_col, vfactdb_col) 用于指定 group_by"""
    grp = (group_by or "scope").strip().lower()
    if grp in ("block", "子项"):
        grp = "block"
    elif grp in ("unit", "装置"):
        grp = "unit"
    elif grp in ("work_package", "工作包"):
        grp = "work_package"
    elif grp in ("resource_id_name", "资源"):
        grp = "resource_id_name"
    elif grp in ("resource_id", "资源id"):
        grp = "resource_id"
    elif grp in ("main_block", "主项"):
        grp = "main_block"
    elif grp in ("quarter", "区域"):
        grp = "quarter"
    if grp == "scope":
        return (MPDB.scope, VFACTDB.scope)
    if grp == "subproject":
        return (MPDB.subproject, VFACTDB.subproject)
    if grp == "train":
        return (MPDB.train, VFACTDB.train)
    if grp == "unit":
        return (MPDB.unit, VFACTDB.unit)
    if grp == "block":
        return (MPDB.block, VFACTDB.block)
    if grp == "main_block":
        return (MPDB.main_block, VFACTDB.main_block)
    if grp == "quarter":
        return (MPDB.quarter, VFACTDB.quarter)
    if grp == "work_package":
        return (MPDB.work_package, VFACTDB.work_package)
    if grp == "resource_id_name":
        # MPDB/VFACTDB 本身无此列，JOIN 扫表
        return (RSCDefine.resource_id_name, RSCDefine.resource_id_name)
    if grp == "resource_id":
        return (RSCDefine.resource_id, RSCDefine.resource_id)
    return (MPDB.scope, VFACTDB.scope)


def refresh_productivity_cache(
    db: Session,
    filters: Optional[Dict] = None,
    group_by: str = "scope",
    d_start: Optional[date] = None,
    d_end: Optional[date] = None,
    log_progress: bool = True,
) -> int:
    """
    刷新单 filter_key 的工效预聚合缓存。
    支持任意 filters 与 group_by（scope/subproject/train/unit/block/work_package）。
    """
    filters = filters or {}
    fk = build_filter_key(filters)
    grp_norm = (group_by or "scope").strip().lower()
    if grp_norm in ("block", "子项"):
        grp_norm = "block"
    elif grp_norm in ("unit", "装置"):
        grp_norm = "unit"
    elif grp_norm in ("work_package", "工作包"):
        grp_norm = "work_package"
    if grp_norm not in _CACHE_SUPPORTED_GROUP_BY:
        if log_progress:
            logger.info(f"跳过 refresh_productivity_cache: group_by={group_by} 不支持")
        return 0
    group_by = grp_norm
    dim_col, vf_dim = _get_dim_cols(group_by)

    d_start = d_start or PROJECT_START_DATE
    d_end = d_end or date.today()

    def _log(msg: str) -> None:
        if log_progress:
            logger.info(msg)
            print(msg, flush=True)

    try:
        _log(f"开始刷新工效缓存 [filter_key='{fk}' group_by={group_by}] 日期范围 {d_start}..{d_end}")

        # 检查是否需要 JOIN RSCDefine (如果 group_by 是 resource_id_name 或 resource_id)
        needs_rsc_join = (group_by in ("resource_id_name", "resource_id"))

        # 1. 每日 mp / achieved / mp_prod / mp_nonprod by dim_col
        mp_q = (
            db.query(MPDB.date, dim_col.label("dim_val"), func.sum(MPDB.manpower).label("mp"))
            .filter(MPDB.date >= d_start, MPDB.date <= d_end)
        )
        if needs_rsc_join:
            mp_q = mp_q.join(RSCDefine, MPDB.work_package == RSCDefine.work_package)
        mp_q = _apply_base_filters(mp_q, MPDB, filters, d_start, d_end)
        mp_q = mp_q.group_by(MPDB.date, dim_col).filter(dim_col.isnot(None), dim_col != "")
        mp_rows = mp_q.all()

        vf_q = (
            db.query(VFACTDB.date, vf_dim.label("dim_val"), func.sum(VFACTDB.achieved).label("ach"))
            .filter(VFACTDB.date >= d_start, VFACTDB.date <= d_end)
        )
        if needs_rsc_join:
            vf_q = vf_q.join(RSCDefine, VFACTDB.work_package == RSCDefine.work_package)
        vf_q = _apply_base_filters(vf_q, VFACTDB, filters, d_start, d_end)
        vf_q = vf_q.group_by(VFACTDB.date, vf_dim).filter(vf_dim.isnot(None), vf_dim != "")
        vf_rows = vf_q.all()

        mp_prod_q = (
            db.query(MPDB.date, dim_col.label("dim_val"), func.sum(MPDB.manpower).label("mp"))
            .filter(
                MPDB.date >= d_start, MPDB.date <= d_end,
                MPDB.activity_id.isnot(None), MPDB.activity_id != "",
                MPDB.work_package.notin_(CO_WORK_PACKAGES),
            )
        )
        if needs_rsc_join:
            mp_prod_q = mp_prod_q.join(RSCDefine, MPDB.work_package == RSCDefine.work_package)
        mp_prod_q = _apply_base_filters(mp_prod_q, MPDB, filters, d_start, d_end)
        mp_prod_q = mp_prod_q.group_by(MPDB.date, dim_col).filter(dim_col.isnot(None), dim_col != "")
        mp_prod_map = {(r[0], r[1]): float(r[2] or 0) for r in mp_prod_q.all()}

        mp_nonprod_q = (
            db.query(MPDB.date, dim_col.label("dim_val"), func.sum(MPDB.manpower).label("mp"))
            .filter(MPDB.date >= d_start, MPDB.date <= d_end, MPDB.work_package.in_(CO_NON_PRODUCTIVITY))
        )
        if needs_rsc_join:
            mp_nonprod_q = mp_nonprod_q.join(RSCDefine, MPDB.work_package == RSCDefine.work_package)
        mp_nonprod_q = _apply_nonprod_filters(mp_nonprod_q, MPDB, filters, d_start, d_end)
        mp_nonprod_q = mp_nonprod_q.group_by(MPDB.date, dim_col).filter(dim_col.isnot(None), dim_col != "")
        mp_nonprod_map = {(r[0], r[1]): float(r[2] or 0) for r in mp_nonprod_q.all()}

        # 2. 按 work_package 的人力
        wp_q = (
            db.query(MPDB.date, dim_col.label("dim_val"), MPDB.work_package, func.sum(MPDB.manpower).label("mp"))
            .filter(MPDB.date >= d_start, MPDB.date <= d_end)
        )
        if needs_rsc_join:
            wp_q = wp_q.join(RSCDefine, MPDB.work_package == RSCDefine.work_package)
        wp_q = _apply_base_filters(wp_q, MPDB, filters, d_start, d_end)
        wp_q = wp_q.group_by(MPDB.date, dim_col, MPDB.work_package).filter(dim_col.isnot(None), dim_col != "")
        wp_rows = wp_q.all()

        # 3. 构建 (date, dim_val) -> {mp, achieved, mp_prod, mp_nonprod}
        daily = defaultdict(lambda: {"mp": 0.0, "ach": 0.0, "mp_prod": 0.0, "mp_nonprod": 0.0})
        for d, dv, mp in mp_rows:
            if dv:
                daily[(d, dv)]["mp"] = float(mp or 0)
        for d, dv, ach in vf_rows:
            if dv:
                daily[(d, dv)]["ach"] = float(ach or 0)
        for (d, dv), mp in mp_prod_map.items():
            daily[(d, dv)]["mp_prod"] = mp
        for (d, dv), mp in mp_nonprod_map.items():
            daily[(d, dv)]["mp_nonprod"] = mp

        # 4. 删除旧缓存并写入
        db.execute(text("DELETE FROM productivity_cache WHERE filter_key = :fk AND group_by = :gb"), {"fk": fk, "gb": group_by})
        db.execute(text("DELETE FROM productivity_cache_wp WHERE filter_key = :fk AND group_by = :gb"), {"fk": fk, "gb": group_by})

        to_insert = []
        for (d, dv), v in daily.items():
            to_insert.append({
                "filter_key": fk, "date": d, "group_by": group_by, "dim_val": dv,
                "mp": round(v["mp"], 4), "achieved": round(v["ach"], 4),
                "mp_prod": round(v["mp_prod"], 4), "mp_nonprod": round(v["mp_nonprod"], 4),
            })
        if to_insert:
            db.bulk_insert_mappings(ProductivityCache, to_insert)

        wp_to_insert = []
        for d, dv, wp, mp in wp_rows:
            if dv and wp:
                wp_to_insert.append({
                    "filter_key": fk, "date": d, "group_by": group_by, "dim_val": dv,
                    "work_package": wp, "mp": round(float(mp or 0), 4),
                })
        if wp_to_insert:
            db.bulk_insert_mappings(ProductivityCacheWp, wp_to_insert)

        db.commit()
        _log(f"✓ 工效缓存刷新完成: {len(to_insert)} 行主表, {len(wp_to_insert)} 行 wp 表")
        return len(to_insert) + len(wp_to_insert)
    except Exception as e:
        db.rollback()
        logger.exception(f"refresh_productivity_cache 失败: {e}")
        raise


def refresh_productivity_cache_by_dimension(
    db: Session,
    dimension_column: str,
    group_by: str = "scope",
    d_start: Optional[date] = None,
    d_end: Optional[date] = None,
    log_progress: bool = True,
) -> int:
    """
    按单维度批量刷新工效缓存（参考 S 曲线 refresh_s_curve_cache_by_dimension）。
    - 当 dimension_column==group_by（如 scope）：一次扫描获取 (date, dim_val)，按 slice 写入。
    - 当 dimension_column!=group_by（如 subproject）：逐 slice 调用 refresh_productivity_cache。
    """
    if dimension_column not in PRODUCTIVITY_DIMENSION_COLUMNS:
        raise ValueError(f"dimension_column 须为 {PRODUCTIVITY_DIMENSION_COLUMNS} 之一")

    group_by = group_by or "scope"
    d_start = d_start or PROJECT_START_DATE
    d_end = d_end or date.today()

    def _log(msg: str) -> None:
        if log_progress:
            logger.info(msg)
            print(msg, flush=True)

    # 当 dimension_column != group_by：通过一次大查询获取该维度下所有 group_by 的值，避免 slice 循环
    if dimension_column != group_by:
        if dimension_column not in _CACHE_SUPPORTED_GROUP_BY:
            return 0
        
        filter_col, vf_filter_col = _get_dim_cols(dimension_column)
        group_col, vf_group_col = _get_dim_cols(group_by)
        needs_rsc_join = (dimension_column in ("resource_id_name", "resource_id")) or (group_by in ("resource_id_name", "resource_id"))

        _log(f"  按维度 [{dimension_column}] 批量刷新（group_by={group_by}）...")
        
        # 1. 一次性获取所有 (filter_val, group_val, date) 的聚合数据
        def _get_mp_batch():
            q = db.query(filter_col.label("f_val"), group_col.label("g_val"), MPDB.date, func.sum(MPDB.manpower).label("mp")).filter(MPDB.date >= d_start, MPDB.date <= d_end)
            if needs_rsc_join: q = q.join(RSCDefine, MPDB.work_package == RSCDefine.work_package)
            return q.group_by(filter_col, group_col, MPDB.date).filter(filter_col.isnot(None), group_col.isnot(None)).all()

        def _get_vf_batch():
            q = db.query(vf_filter_col.label("f_val"), vf_group_col.label("g_val"), VFACTDB.date, func.sum(VFACTDB.achieved).label("ach")).filter(VFACTDB.date >= d_start, VFACTDB.date <= d_end)
            if needs_rsc_join: q = q.join(RSCDefine, VFACTDB.work_package == RSCDefine.work_package)
            return q.group_by(vf_filter_col, vf_group_col, VFACTDB.date).filter(vf_filter_col.isnot(None), vf_group_col.isnot(None)).all()

        def _get_mp_prod_batch():
            q = db.query(filter_col.label("f_val"), group_col.label("g_val"), MPDB.date, func.sum(MPDB.manpower).label("mp")).filter(
                MPDB.date >= d_start, MPDB.date <= d_end, MPDB.activity_id.isnot(None), MPDB.work_package.notin_(CO_WORK_PACKAGES))
            if needs_rsc_join: q = q.join(RSCDefine, MPDB.work_package == RSCDefine.work_package)
            return q.group_by(filter_col, group_col, MPDB.date).filter(filter_col.isnot(None), group_col.isnot(None)).all()

        def _get_mp_nonprod_batch():
            q = db.query(filter_col.label("f_val"), group_col.label("g_val"), MPDB.date, func.sum(MPDB.manpower).label("mp")).filter(
                MPDB.date >= d_start, MPDB.date <= d_end, MPDB.work_package.in_(CO_NON_PRODUCTIVITY))
            if needs_rsc_join: q = q.join(RSCDefine, MPDB.work_package == RSCDefine.work_package)
            # 非生产性需特殊过滤逻辑，此处为简化 batch 处理，依然采用位置过滤逻辑的变体
            # 实际上在批量预聚合时，通常是 Single Filter，所以 f_val 即是 filter
            return q.group_by(filter_col, group_col, MPDB.date).filter(filter_col.isnot(None), group_col.isnot(None)).all()

        def _get_wp_batch():
            q = db.query(filter_col.label("f_val"), group_col.label("g_val"), MPDB.date, MPDB.work_package, func.sum(MPDB.manpower).label("mp")).filter(MPDB.date >= d_start, MPDB.date <= d_end)
            if needs_rsc_join: q = q.join(RSCDefine, MPDB.work_package == RSCDefine.work_package)
            return q.group_by(filter_col, group_col, MPDB.date, MPDB.work_package).filter(filter_col.isnot(None), group_col.isnot(None)).all()

        # 汇总到内存字典
        batch_data = defaultdict(lambda: defaultdict(lambda: {"mp": 0.0, "ach": 0.0, "mp_prod": 0.0, "mp_nonprod": 0.0}))
        batch_wp = defaultdict(list)

        for fv, gv, dt, val in _get_mp_batch(): batch_data[fv][(dt, gv)]["mp"] = float(val or 0)
        for fv, gv, dt, val in _get_vf_batch(): batch_data[fv][(dt, gv)]["ach"] = float(val or 0)
        for fv, gv, dt, val in _get_mp_prod_batch(): batch_data[fv][(dt, gv)]["mp_prod"] = float(val or 0)
        for fv, gv, dt, val in _get_mp_nonprod_batch(): batch_data[fv][(dt, gv)]["mp_nonprod"] = float(val or 0)
        for fv, gv, dt, wp, val in _get_wp_batch(): batch_wp[fv].append({"date": dt, "group_by": group_by, "dim_val": gv, "work_package": wp, "mp": float(val or 0)})

        # 写入数据库
        inserted = 0
        for f_val, daily_map in batch_data.items():
            fk = build_filter_key({dimension_column: [f_val]})
            db.execute(text("DELETE FROM productivity_cache WHERE filter_key = :fk AND group_by = :gb"), {"fk": fk, "gb": group_by})
            db.execute(text("DELETE FROM productivity_cache_wp WHERE filter_key = :fk AND group_by = :gb"), {"fk": fk, "gb": group_by})
            
            to_ins = []
            for (dt, gv), v in daily_map.items():
                to_ins.append({
                    "filter_key": fk, "date": dt, "group_by": group_by, "dim_val": gv,
                    "mp": round(v["mp"], 4), "achieved": round(v["ach"], 4),
                    "mp_prod": round(v["mp_prod"], 4), "mp_nonprod": round(v["mp_nonprod"], 4),
                })
            if to_ins:
                db.bulk_insert_mappings(ProductivityCache, to_ins)
                inserted += len(to_ins)
            
            wps = batch_wp.get(f_val, [])
            if wps:
                wp_to_ins = [{"filter_key": fk, "date": x["date"], "group_by": x["group_by"], "dim_val": x["dim_val"], "work_package": x["work_package"], "mp": round(x["mp"], 4)} for x in wps]
                db.bulk_insert_mappings(ProductivityCacheWp, wp_to_ins)
                inserted += len(wp_to_ins)
        
        db.commit()
        _log(f"    [{dimension_column}] 批量写入完成, 共 {inserted} 行")
        return inserted

    dim_col, vf_dim = _get_dim_cols(dimension_column)
    needs_rsc_join = (dimension_column in ("resource_id_name", "resource_id"))

    try:
        _log(f"  按维度 [{dimension_column}] 批量扫描工效...")
        
        mp_q = db.query(MPDB.date, dim_col.label("dim_val"), func.sum(MPDB.manpower).label("mp")).filter(MPDB.date >= d_start, MPDB.date <= d_end)
        if needs_rsc_join:
            mp_q = mp_q.join(RSCDefine, MPDB.work_package == RSCDefine.work_package)
        mp_rows = mp_q.group_by(MPDB.date, dim_col).filter(dim_col.isnot(None), dim_col != "").all()

        vf_q = db.query(VFACTDB.date, vf_dim.label("dim_val"), func.sum(VFACTDB.achieved).label("ach")).filter(VFACTDB.date >= d_start, VFACTDB.date <= d_end)
        if needs_rsc_join:
            vf_q = vf_q.join(RSCDefine, VFACTDB.work_package == RSCDefine.work_package)
        vf_rows = vf_q.group_by(VFACTDB.date, vf_dim).filter(vf_dim.isnot(None), vf_dim != "").all()

        mp_prod_q = (
            db.query(MPDB.date, dim_col.label("dim_val"), func.sum(MPDB.manpower).label("mp"))
            .filter(
                MPDB.date >= d_start, MPDB.date <= d_end,
                MPDB.activity_id.isnot(None), MPDB.activity_id != "",
                MPDB.work_package.notin_(CO_WORK_PACKAGES),
            )
        )
        if needs_rsc_join:
            mp_prod_q = mp_prod_q.join(RSCDefine, MPDB.work_package == RSCDefine.work_package)
        mp_prod_rows = mp_prod_q.group_by(MPDB.date, dim_col).filter(dim_col.isnot(None), dim_col != "").all()

        mp_nonprod_q = (
            db.query(MPDB.date, dim_col.label("dim_val"), func.sum(MPDB.manpower).label("mp"))
            .filter(MPDB.date >= d_start, MPDB.date <= d_end, MPDB.work_package.in_(CO_NON_PRODUCTIVITY))
        )
        if needs_rsc_join:
            mp_nonprod_q = mp_nonprod_q.join(RSCDefine, MPDB.work_package == RSCDefine.work_package)
        mp_nonprod_rows = mp_nonprod_q.group_by(MPDB.date, dim_col).filter(dim_col.isnot(None), dim_col != "").all()

        wp_q = (
            db.query(MPDB.date, dim_col.label("dim_val"), MPDB.work_package, func.sum(MPDB.manpower).label("mp"))
            .filter(MPDB.date >= d_start, MPDB.date <= d_end)
        )
        if needs_rsc_join:
            wp_q = wp_q.join(RSCDefine, MPDB.work_package == RSCDefine.work_package)
        wp_rows = wp_q.group_by(MPDB.date, dim_col, MPDB.work_package).filter(dim_col.isnot(None), dim_col != "").all()

        daily_by_val = defaultdict(lambda: defaultdict(lambda: {"mp": 0.0, "ach": 0.0, "mp_prod": 0.0, "mp_nonprod": 0.0}))
        wp_by_val = defaultdict(lambda: [])
        for d, dv, mp in mp_rows:
            if dv:
                daily_by_val[dv][d]["mp"] = float(mp or 0)
        for d, dv, ach in vf_rows:
            if dv:
                daily_by_val[dv][d]["ach"] = float(ach or 0)
        for d, dv, mp in mp_prod_rows:
            if dv:
                daily_by_val[dv][d]["mp_prod"] = float(mp or 0)
        for d, dv, mp in mp_nonprod_rows:
            if dv:
                daily_by_val[dv][d]["mp_nonprod"] = float(mp or 0)
        for d, dv, wp, mp in wp_rows:
            if dv and wp:
                wp_by_val[dv].append((d, wp, float(mp or 0)))

        values = sorted(daily_by_val.keys())
        to_delete_fks = [build_filter_key({dimension_column: v}) for v in values]
        for fk in to_delete_fks:
            db.execute(text("DELETE FROM productivity_cache WHERE filter_key = :fk AND group_by = :gb"), {"fk": fk, "gb": group_by})
            db.execute(text("DELETE FROM productivity_cache_wp WHERE filter_key = :fk AND group_by = :gb"), {"fk": fk, "gb": group_by})

        inserted = 0
        for val in values:
            daily = daily_by_val.get(val, {})
            if not daily:
                continue
            fk = build_filter_key({dimension_column: val})
            to_insert = []
            for d, v in daily.items():
                to_insert.append({
                    "filter_key": fk, "date": d, "group_by": group_by, "dim_val": val,
                    "mp": round(v["mp"], 4), "achieved": round(v["ach"], 4),
                    "mp_prod": round(v["mp_prod"], 4), "mp_nonprod": round(v["mp_nonprod"], 4),
                })
            if to_insert:
                db.bulk_insert_mappings(ProductivityCache, to_insert)
                inserted += len(to_insert)
            wp_list = wp_by_val.get(val, [])
            if wp_list:
                wp_to_insert = [{"filter_key": fk, "date": d, "group_by": group_by, "dim_val": val, "work_package": wp, "mp": round(mp, 4)} for d, wp, mp in wp_list]
                db.bulk_insert_mappings(ProductivityCacheWp, wp_to_insert)
                inserted += len(wp_to_insert)
        db.commit()
        _log(f"    [{dimension_column}] 写入 {len(values)} 个 slice, 共 {inserted} 行")
        return inserted
    except Exception as e:
        db.rollback()
        logger.exception(f"refresh_productivity_cache_by_dimension({dimension_column}) 失败: {e}")
        raise


def refresh_productivity_cache_all(db: Session, log_progress: bool = True) -> int:
    """
    全量刷新工效缓存：全局 + 按各维度批量（参考 S 曲线 refresh_s_curve_cache_all）。
    先刷新全局 scope，再按 scope/subproject/train/unit/block 等维度批量预聚合。
    """
    total = 0
    if log_progress:
        logger.info("开始工效缓存全量刷新: 全局 + 按维度批量")
        print("开始工效缓存全量刷新: 全局 + 按维度批量", flush=True)

    _log = (lambda msg: (logger.info(msg), print(msg, flush=True))) if log_progress else (lambda msg: None)
    _log("\n--- [1/2] 全局 scope ---")
    total += refresh_productivity_cache(db, filters=None, group_by="scope", log_progress=log_progress)

    # 只预聚合前端实际会作为“过滤项”且需要高性能响应的维度
    dims_to_refresh = ["scope", "subproject", "unit", "main_block", "resource_id_name"]
    for i, dim in enumerate(dims_to_refresh):
        if log_progress:
            print(f"\n--- [2/2] 维度 ({i + 1}/{len(dims_to_refresh)}) {dim} ---", flush=True)
        total += refresh_productivity_cache_by_dimension(db, dimension_column=dim, group_by="scope", log_progress=log_progress)

    if log_progress:
        print(f"\n✓ 工效缓存全量刷新完成: 共 {total} 行", flush=True)
    return total


def _get_productivity_analysis_from_cache(
    db: Session, d_start: date, d_end: date, filters: Dict, grp: str, include_indirect: bool = False
) -> Optional[Dict[str, Any]]:
    """从缓存读取工效分析，若缓存不完整则返回 None"""
    # 修正 filter_key 生成逻辑：确保能命中预聚合缓存
    fixed_filters = {}
    if filters:
        for k, v in filters.items():
            if k == "include_indirect": continue
            # 处理列表类型
            if isinstance(v, list):
                if len(v) == 1:
                    fixed_filters[k] = v[0]
                elif len(v) == 0:
                    continue
                else:
                    # 多选目前不支持缓存，原样保留将回退到实时查询
                    fixed_filters[k] = v
            else:
                fixed_filters[k] = v
    fk = build_filter_key(fixed_filters) if fixed_filters else ""
    
    # 1. 周期数据 (d_start to d_end)
    rows = db.query(ProductivityCache).filter(
        ProductivityCache.filter_key == fk,
        ProductivityCache.group_by == grp,
        ProductivityCache.date >= d_start,
        ProductivityCache.date <= d_end,
    ).all()
    if not rows: return None

    # 2. 开累数据汇总 (从项目开始)
    cum_rows = db.query(
        ProductivityCache.dim_val,
        func.sum(ProductivityCache.mp).label("mp"),
        func.sum(ProductivityCache.achieved).label("ach"),
        func.sum(ProductivityCache.mp_prod).label("mp_prod"),
        func.sum(ProductivityCache.mp_nonprod).label("mp_nonprod")
    ).filter(
        ProductivityCache.filter_key == fk,
        ProductivityCache.group_by == grp,
        ProductivityCache.date >= PROJECT_START_DATE,
        ProductivityCache.date <= d_end
    ).group_by(ProductivityCache.dim_val).all()
    cum_agg = {r.dim_val: {"mp": float(r.mp or 0), "ach": float(r.ach or 0), "mp_prod": float(r.mp_prod or 0), "mp_nonprod": float(r.mp_nonprod or 0)} for r in cum_rows}

    # 3. Summary 校准：直接从最全的维度 (scope) 抓取该 fk 下的总计
    all_summary_row = db.query(
        func.sum(ProductivityCache.achieved).label("ach"),
        func.sum(ProductivityCache.mp).label("mp_val"),
        func.sum(ProductivityCache.mp_nonprod).label("non")
    ).filter(
        ProductivityCache.filter_key == fk,
        ProductivityCache.group_by == "scope",
        ProductivityCache.date >= d_start,
        ProductivityCache.date <= d_end
    ).first()
    
    all_cum_row = db.query(
        func.sum(ProductivityCache.achieved).label("ach"),
        func.sum(ProductivityCache.mp).label("mp_val")
    ).filter(
        ProductivityCache.filter_key == fk,
        ProductivityCache.group_by == "scope",
        ProductivityCache.date >= PROJECT_START_DATE,
        ProductivityCache.date <= d_end
    ).first()

    # 按 dim_val 汇总周期内 mp/achieved/mp_prod/mp_nonprod
    agg = defaultdict(lambda: {"mp": 0.0, "ach": 0.0, "mp_prod": 0.0, "mp_nonprod": 0.0})
    for r in rows:
        v = agg[r.dim_val]
        v["mp"] += float(r.mp or 0)
        v["ach"] += float(r.achieved or 0)
        v["mp_prod"] += float(r.mp_prod or 0)
        v["mp_nonprod"] += float(r.mp_nonprod or 0)

    # 按 verify_indirect_labor 的全局分摊算法：labor_w = mp + (mp/prod_all)*nonprod_all
    # 当 filter 含 resource_id_name 或 work_package 时，需实时查询 prod_all、nonprod_all（全局，仅日期过滤）
    _used_global_allocation = False
    _prod_all = _nonprod_all = _cum_prod_all = _cum_nonprod_all = 0.0
    _RESOURCE_FILTER_KEYS = ("resource_id_name", "work_package")
    if any(filters.get(k) for k in _RESOURCE_FILTER_KEYS):
        _prod_all = float(
            db.query(func.sum(MPDB.manpower))
            .filter(MPDB.date >= d_start, MPDB.date <= d_end, MPDB.activity_id.isnot(None), MPDB.activity_id != "", MPDB.work_package.notin_(CO_WORK_PACKAGES))
            .scalar() or 1
        )
        _nonprod_all = float(
            db.query(func.sum(MPDB.manpower))
            .filter(MPDB.date >= d_start, MPDB.date <= d_end, MPDB.work_package.in_(CO_NON_PRODUCTIVITY))
            .scalar() or 0
        )
        _cum_prod_all = float(
            db.query(func.sum(MPDB.manpower))
            .filter(MPDB.date >= PROJECT_START_DATE, MPDB.date <= d_end, MPDB.activity_id.isnot(None), MPDB.activity_id != "", MPDB.work_package.notin_(CO_WORK_PACKAGES))
            .scalar() or 1
        )
        _cum_nonprod_all = float(
            db.query(func.sum(MPDB.manpower))
            .filter(MPDB.date >= PROJECT_START_DATE, MPDB.date <= d_end, MPDB.work_package.in_(CO_NON_PRODUCTIVITY))
            .scalar() or 0
        )
        _used_global_allocation = True

    # 周期内 weighted_norms 需要 mp by work_package
    wp_rows = (
        db.query(ProductivityCacheWp)
        .filter(
            ProductivityCacheWp.filter_key == fk,
            ProductivityCacheWp.group_by == grp,
            ProductivityCacheWp.date >= d_start,
            ProductivityCacheWp.date <= d_end,
        )
        .all()
    )
    mp_by_wp = defaultdict(lambda: 0.0)
    for r in wp_rows:
        mp_by_wp[(r.dim_val, r.work_package)] += float(r.mp or 0)

    rsc_norms = {r[0]: float(r[1] or 0) for r in db.query(RSCDefine.work_package, func.avg(RSCDefine.norms)).filter(RSCDefine.is_active == True, RSCDefine.norms > 0).group_by(RSCDefine.work_package).all()}

    items = []
    for dv in sorted(agg.keys()):
        v = agg[dv]
        mp_total = v["mp"]
        achieved = v["ach"]
        if mp_total == 0 and achieved == 0: continue
        
        # 辅助人力逻辑：verify_indirect_labor 全局分摊 labor_w = mp + (mp/prod_all)*nonprod_all
        if _used_global_allocation:
            pct = (mp_total / _prod_all) if _prod_all > 0 else 0
            allocated_nonprod = pct * _nonprod_all
            labor_w_nonp = mp_total + allocated_nonprod
        else:
            prod_mp, nonprod_mp = v["mp_prod"], v["mp_nonprod"]
            pct = (mp_total / prod_mp) if prod_mp > 0 else 0
            labor_w_nonp = (mp_total - nonprod_mp) + pct * nonprod_mp
        
        p_val = (achieved / mp_total) if mp_total > 0 else 0
        p_wp_val = (achieved / labor_w_nonp) if labor_w_nonp > 0 else 0
        
        # 标准工效计算：修正 NaN 问题
        sum_norms_mp = sum(rsc_norms.get(wp, 0) * mp_by_wp.get((dv, wp), 0) for wp in rsc_norms)
        w_norms = (sum_norms_mp / mp_total) if mp_total > 0 else 0
        
        # 开累计算（同 verify 全局分摊）
        cv = cum_agg.get(dv, {"mp": 0, "ach": 0, "mp_prod": 0, "mp_nonprod": 0})
        c_mp, c_ach = cv["mp"], cv["ach"]
        if _used_global_allocation:
            c_pct = (c_mp / _cum_prod_all) if _cum_prod_all > 0 else 0
            c_labor_w = c_mp + c_pct * _cum_nonprod_all
        else:
            c_prod, c_non = cv["mp_prod"], cv["mp_nonprod"]
            c_pct = (c_mp / c_prod) if c_prod > 0 else 0
            c_labor_w = (c_mp - c_non) + c_pct * c_non
        
        cp_val = (c_ach / c_mp) if c_mp > 0 else 0
        cp_wp_val = (c_ach / c_labor_w) if c_labor_w > 0 else 0

        items.append({
            "dim_val": dv,
            "achieved": round(achieved, 4),
            "manpower": round(mp_total, 4),
            "productivity": round(p_wp_val if include_indirect else p_val, 4),
            "productivity_wp": round(p_wp_val, 4),
            "weighted_norms": round(w_norms, 4),
            "cum_achieved": round(c_ach, 4),
            "cum_manpower": round(c_mp, 4),
            "cum_productivity": round(cp_wp_val if include_indirect else cp_val, 4),
            "cum_productivity_wp": round(cp_wp_val, 4),
        })

    # 辅助工具函数
    def _f(v):
        try:
            return float(v or 0)
        except (ValueError, TypeError):
            return 0.0

    # Summary 校准：直接从 scope 维度的全量缓存抓取，确保包含所有数据
    all_summary_row = db.query(
        func.sum(ProductivityCache.achieved).label("ach"),
        func.sum(ProductivityCache.mp).label("mp_val"),
        func.sum(ProductivityCache.mp_prod).label("prod"),
        func.sum(ProductivityCache.mp_nonprod).label("non")
    ).filter(
        ProductivityCache.filter_key == fk,
        ProductivityCache.group_by == "scope",
        ProductivityCache.date >= d_start,
        ProductivityCache.date <= d_end
    ).first()
    
    all_cum_row = db.query(
        func.sum(ProductivityCache.achieved).label("ach"),
        func.sum(ProductivityCache.mp).label("mp_val"),
        func.sum(ProductivityCache.mp_prod).label("prod"),
        func.sum(ProductivityCache.mp_nonprod).label("non")
    ).filter(
        ProductivityCache.filter_key == fk,
        ProductivityCache.group_by == "scope",
        ProductivityCache.date >= PROJECT_START_DATE,
        ProductivityCache.date <= d_end
    ).first()

    summary = {
        "achieved": round(_f(all_summary_row.ach if all_summary_row else 0), 4),
        "manpower": round(_f(all_summary_row.mp_val if all_summary_row else 0), 4),
        "cum_achieved": round(_f(all_cum_row.ach if all_cum_row else 0), 4),
        "cum_manpower": round(_f(all_cum_row.mp_val if all_cum_row else 0), 4),
    }
    
    # 周期 Summary 工效（含辅助人力公式）
    s_mp = summary["manpower"]
    s_ach = summary["achieved"]
    if _used_global_allocation:
        s_pct = (s_mp / _prod_all) if _prod_all > 0 else 0
        s_labor_w = s_mp + s_pct * _nonprod_all
    else:
        s_non = _f(all_summary_row.non if all_summary_row else 0)
        s_prod = _f(all_summary_row.prod if all_summary_row else 0)
        s_pct = (s_mp / s_prod) if s_prod > 0 else 0
        s_labor_w = (s_mp - s_non) + s_pct * s_non
    
    summary["productivity"] = round(s_ach / s_mp if s_mp > 0 else 0, 4)
    summary["productivity_wp"] = round(s_ach / s_labor_w if s_labor_w > 0 else 0, 4)
    summary["cum_productivity"] = round(summary["cum_achieved"] / summary["cum_manpower"] if summary["cum_manpower"] > 0 else 0, 4)
    
    # 开累 Summary 工效（含辅助人力公式）
    c_mp = summary["cum_manpower"]
    c_ach = summary["cum_achieved"]
    if _used_global_allocation:
        c_pct = (c_mp / _cum_prod_all) if _cum_prod_all > 0 else 0
        c_labor_w = c_mp + c_pct * _cum_nonprod_all
    else:
        c_prod = _f(all_cum_row.prod if all_cum_row else 0)
        c_non = _f(all_cum_row.non if all_cum_row else 0)
        c_pct = (c_mp / c_prod) if c_prod > 0 else 0
        c_labor_w = (c_mp - c_non) + c_pct * c_non
    summary["cum_productivity_wp"] = round(c_ach / c_labor_w if c_labor_w > 0 else 0, 4)
    
    # 标准工效：从 items 聚合
    total_mp = sum(x["manpower"] for x in items)
    sum_nw = sum(x.get("weighted_norms", 0) * x["manpower"] for x in items)
    summary["weighted_norms"] = round(sum_nw / total_mp if total_mp > 0 else 0, 4)

    return {
        "group_by": grp, "start_date": str(d_start), "end_date": str(d_end),
        "items": items, "summary": summary,
    }


def get_productivity_analysis(
    db: Session,
    start_date: date,
    end_date: date,
    filters: Optional[Dict[str, Any]] = None,
    group_by: Optional[str] = None,
) -> Dict[str, Any]:
    """
    工效分析：按可选维度分组返回完成量、人力投入、实际工效、标准工效。
    group_by: scope | block | unit | work_package
    filters: GlobalFilter 参数（scope, block, unit, subproject, train, quarter, main_block, work_package, discipline, location）
    优先从预聚合缓存读取（filter_key='' + group_by=scope），缓存未命中时回退实时查询。
    """
    filters = filters or {}
    d_start = start_date
    d_end = end_date

    grp = (group_by or "").strip().lower()
    if grp in ("block", "子项"):
        grp = "block"
    elif grp in ("unit", "装置"):
        grp = "unit"
    elif grp in ("work_package", "工作包"):
        grp = "work_package"
    grp = (grp or "scope")
    include_indirect = filters.get("include_indirect", False)
    if _can_use_cache(db, filters, grp):
        cached = _get_productivity_analysis_from_cache(db, d_start, d_end, filters, grp, include_indirect=include_indirect)
        if cached is not None:
            cached["data_source"] = "cache"  # 预聚合
            return cached

    # 回退到实时查询
    # 基础条件（用于各聚合）
    def mp_base():
        q = db.query(MPDB).filter(MPDB.date >= d_start, MPDB.date <= d_end)
        return _apply_base_filters(q, MPDB, filters, d_start, d_end)

    def vf_base():
        q = db.query(VFACTDB).filter(VFACTDB.date >= d_start, VFACTDB.date <= d_end)
        return _apply_base_filters(q, VFACTDB, filters, d_start, d_end)

    grp = (group_by or "").strip().lower()
    dim_col = None
    if grp == "scope":
        dim_col = MPDB.scope
        vf_dim = VFACTDB.scope
    elif grp == "subproject":
        dim_col = MPDB.subproject
        vf_dim = VFACTDB.subproject
    elif grp == "train":
        dim_col = MPDB.train
        vf_dim = VFACTDB.train
    elif grp in ("block", "子项"):
        dim_col = MPDB.block
        vf_dim = VFACTDB.block
    elif grp in ("unit", "装置"):
        dim_col = MPDB.unit
        vf_dim = VFACTDB.unit
    elif grp in ("work_package", "工作包"):
        dim_col = MPDB.work_package
        vf_dim = VFACTDB.work_package
    else:
        grp = None

    def _f(v):
        return float(v or 0)

    if grp and dim_col is not None:
        # 按维度分组
        mp_q = (
            db.query(dim_col.label("dim_val"), func.sum(MPDB.manpower).label("manpower"))
            .filter(MPDB.date >= d_start, MPDB.date <= d_end)
        )
        mp_q = _apply_base_filters(mp_q, MPDB, filters, d_start, d_end)
        mp_q = mp_q.group_by(dim_col).filter(dim_col.isnot(None), dim_col != "")
        mp_rows = mp_q.all()

        vf_q = (
            db.query(vf_dim.label("dim_val"), func.sum(VFACTDB.achieved).label("achieved"))
            .filter(VFACTDB.date >= d_start, VFACTDB.date <= d_end)
        )
        vf_q = _apply_base_filters(vf_q, VFACTDB, filters, d_start, d_end)
        vf_q = vf_q.group_by(vf_dim).filter(vf_dim.isnot(None), vf_dim != "")
        vf_rows = vf_q.all()

        # 生产性人力：activity_id 非空 且 discipline <> 'CO'（或 work_package 不在 CO 中）
        mp_prod_q = (
            db.query(dim_col.label("dim_val"), func.sum(MPDB.manpower).label("manpower"))
            .filter(
                MPDB.date >= d_start,
                MPDB.date <= d_end,
                MPDB.activity_id.isnot(None),
                MPDB.activity_id != "",
                MPDB.work_package.notin_(CO_WORK_PACKAGES),
            )
        )
        mp_prod_q = _apply_base_filters(mp_prod_q, MPDB, filters, d_start, d_end)
        mp_prod_q = mp_prod_q.group_by(dim_col).filter(dim_col.isnot(None), dim_col != "")
        mp_prod_rows = {r[0]: _f(r[1]) for r in mp_prod_q.all()}

        # 非生产性人力：work_package in CO01, CO03, CO04
        # 优化：对非生产性人力应用 _apply_nonprod_filters，不参与资源过滤，从而使“考虑辅助人力”能计算出非零结果
        mp_nonprod_q = (
            db.query(dim_col.label("dim_val"), func.sum(MPDB.manpower).label("manpower"))
            .filter(
                MPDB.date >= d_start,
                MPDB.date <= d_end,
                MPDB.work_package.in_(CO_NON_PRODUCTIVITY),
            )
        )
        mp_nonprod_q = _apply_nonprod_filters(mp_nonprod_q, MPDB, filters, d_start, d_end)
        mp_nonprod_q = mp_nonprod_q.group_by(dim_col).filter(dim_col.isnot(None), dim_col != "")
        mp_nonprod_rows = {r[0]: _f(r[1]) for r in mp_nonprod_q.all()}

        # RSC norms by work_package（仅当 group_by=work_package 时按工作包取 norms；否则需聚合）
        rsc_norms = {}
        if grp == "work_package":
            rsc_rows = (
                db.query(RSCDefine.work_package, func.avg(RSCDefine.norms).label("norms"))
                .filter(RSCDefine.is_active == True, RSCDefine.norms.isnot(None), RSCDefine.norms > 0)
                .group_by(RSCDefine.work_package)
                .all()
            )
            rsc_norms = {r[0]: float(r[1] or 0) for r in rsc_rows}
        else:
            rsc_rows = (
                db.query(RSCDefine.work_package, func.avg(RSCDefine.norms).label("norms"))
                .filter(RSCDefine.is_active == True, RSCDefine.norms.isnot(None), RSCDefine.norms > 0)
                .group_by(RSCDefine.work_package)
                .all()
            )
            rsc_norms = {r[0]: float(r[1] or 0) for r in rsc_rows}

        # 按 work_package 的人力（用于 weighted_norms，当 group_by 非 work_package 时需从 MPDB 取）
        mp_by_wp_q = (
            db.query(MPDB.work_package, dim_col.label("dim_val"), func.sum(MPDB.manpower).label("manpower"))
            .filter(MPDB.date >= d_start, MPDB.date <= d_end)
        )
        mp_by_wp_q = _apply_base_filters(mp_by_wp_q, MPDB, filters, d_start, d_end)
        mp_by_wp_q = mp_by_wp_q.group_by(MPDB.work_package, dim_col).filter(dim_col.isnot(None), dim_col != "")
        mp_by_wp = {}  # (dim_val, wp) -> manpower
        for wp, dv, mp in mp_by_wp_q.all():
            if dv:
                mp_by_wp[(dv, wp)] = _f(mp)

        vf_map = {r[0]: _f(r[1]) for r in vf_rows}
        _live_prod_all = _live_nonprod_all = _live_cum_prod = _live_cum_nonprod = 0.0
        if any(filters.get(k) for k in ("resource_id_name", "work_package")):
            _live_prod_all = float(db.query(func.sum(MPDB.manpower)).filter(MPDB.date >= d_start, MPDB.date <= d_end, MPDB.activity_id.isnot(None), MPDB.activity_id != "", MPDB.work_package.notin_(CO_WORK_PACKAGES)).scalar() or 1)
            _live_nonprod_all = float(db.query(func.sum(MPDB.manpower)).filter(MPDB.date >= d_start, MPDB.date <= d_end, MPDB.work_package.in_(CO_NON_PRODUCTIVITY)).scalar() or 0)
            _live_cum_prod = float(db.query(func.sum(MPDB.manpower)).filter(MPDB.date >= PROJECT_START_DATE, MPDB.date <= d_end, MPDB.activity_id.isnot(None), MPDB.activity_id != "", MPDB.work_package.notin_(CO_WORK_PACKAGES)).scalar() or 1)
            _live_cum_nonprod = float(db.query(func.sum(MPDB.manpower)).filter(MPDB.date >= PROJECT_START_DATE, MPDB.date <= d_end, MPDB.work_package.in_(CO_NON_PRODUCTIVITY)).scalar() or 0)

        items = []
        dim_vals = sorted(set(r[0] for r in mp_rows) | set(vf_map.keys()))
        for dv in dim_vals:
            if not dv:
                continue
            mp_total = next((_f(r[1]) for r in mp_rows if r[0] == dv), 0)
            achieved = vf_map.get(dv, 0)
            
            if mp_total == 0 and achieved == 0:
                continue

            if _live_prod_all > 0:
                pct = mp_total / _live_prod_all
                labor_w_nonp = mp_total + pct * _live_nonprod_all
            else:
                prod_mp = mp_prod_rows.get(dv, 0)
                nonprod_mp = mp_nonprod_rows.get(dv, 0)
                pct = (mp_total / prod_mp) if prod_mp > 0 else 0
                labor_w_nonp = (mp_total - nonprod_mp) + pct * nonprod_mp

            productivity = (achieved / mp_total) if mp_total > 0 else 0
            productivity_wp = (achieved / labor_w_nonp) if labor_w_nonp > 0 else 0

            # WeightedNorms: SUM(norms * manpower by wp) / SUM(manpower)
            sum_norms_mp = 0
            for (d, wp), mp in mp_by_wp.items():
                if d == dv and wp and rsc_norms.get(wp):
                    sum_norms_mp += rsc_norms[wp] * mp
            weighted_norms = (sum_norms_mp / mp_total) if mp_total > 0 else 0

            items.append({
                "dim_val": dv,
                "achieved": round(achieved, 4),
                "manpower": round(mp_total, 4),
                "productivity": round(productivity, 4),
                "productivity_wp": round(productivity_wp, 4),
                "weighted_norms": round(weighted_norms, 4),
            })
        # 开累：批量按维度分组查询（含 prod_mp、nonprod_mp 以计算 cum_productivity_wp）
        cum_mp_q = (
            db.query(dim_col.label("dim_val"), func.sum(MPDB.manpower).label("manpower"))
            .filter(MPDB.date >= PROJECT_START_DATE, MPDB.date <= d_end)
        )
        cum_mp_q = _apply_base_filters(cum_mp_q, MPDB, filters, PROJECT_START_DATE, d_end)
        cum_mp_q = cum_mp_q.group_by(dim_col).filter(dim_col.isnot(None), dim_col != "")
        cum_mp_map = {r[0]: _f(r[1]) for r in cum_mp_q.all()}

        cum_ach_q = (
            db.query(vf_dim.label("dim_val"), func.sum(VFACTDB.achieved).label("achieved"))
            .filter(VFACTDB.date >= PROJECT_START_DATE, VFACTDB.date <= d_end)
        )
        cum_ach_q = _apply_base_filters(cum_ach_q, VFACTDB, filters, PROJECT_START_DATE, d_end)
        cum_ach_q = cum_ach_q.group_by(vf_dim).filter(vf_dim.isnot(None), vf_dim != "")
        cum_ach_map = {r[0]: _f(r[1]) for r in cum_ach_q.all()}

        cum_prod_q = (
            db.query(dim_col.label("dim_val"), func.sum(MPDB.manpower).label("manpower"))
            .filter(
                MPDB.date >= PROJECT_START_DATE, MPDB.date <= d_end,
                MPDB.activity_id.isnot(None), MPDB.activity_id != "",
                MPDB.work_package.notin_(CO_WORK_PACKAGES),
            )
        )
        cum_prod_q = _apply_base_filters(cum_prod_q, MPDB, filters, PROJECT_START_DATE, d_end)
        cum_prod_q = cum_prod_q.group_by(dim_col).filter(dim_col.isnot(None), dim_col != "")
        cum_prod_map = {r[0]: _f(r[1]) for r in cum_prod_q.all()}

        cum_nonprod_q = (
            db.query(dim_col.label("dim_val"), func.sum(MPDB.manpower).label("manpower"))
            .filter(MPDB.date >= PROJECT_START_DATE, MPDB.date <= d_end, MPDB.work_package.in_(CO_NON_PRODUCTIVITY))
        )
        cum_nonprod_q = _apply_nonprod_filters(cum_nonprod_q, MPDB, filters, PROJECT_START_DATE, d_end)
        cum_nonprod_q = cum_nonprod_q.group_by(dim_col).filter(dim_col.isnot(None), dim_col != "")
        cum_nonprod_map = {r[0]: _f(r[1]) for r in cum_nonprod_q.all()}

        cum_map = {}
        for dv in dim_vals:
            if not dv:
                continue
            cum_mp = cum_mp_map.get(dv, 0)
            cum_ach = cum_ach_map.get(dv, 0)
            if _live_cum_prod > 0:
                cum_pct = cum_mp / _live_cum_prod
                cum_labor_w = cum_mp + cum_pct * _live_cum_nonprod
            else:
                cum_prod_mp = cum_prod_map.get(dv, 0)
                cum_nonprod_mp = cum_nonprod_map.get(dv, 0)
                cum_pct = (cum_mp / cum_prod_mp) if cum_prod_mp > 0 else 0
                cum_labor_w = (cum_mp - cum_nonprod_mp) + cum_pct * cum_nonprod_mp
            cum_map[dv] = {
                "cum_achieved": cum_ach, "cum_manpower": cum_mp,
                "cum_productivity": (cum_ach / cum_mp) if cum_mp > 0 else 0,
                "cum_productivity_wp": (cum_ach / cum_labor_w) if cum_labor_w > 0 else 0,
            }
        for it in items:
            c = cum_map.get(it["dim_val"], {})
            it["cum_achieved"] = round(c.get("cum_achieved", 0), 4)
            it["cum_manpower"] = round(c.get("cum_manpower", 0), 4)
            it["cum_productivity"] = round(c.get("cum_productivity", 0), 4)
            it["cum_productivity_wp"] = round(c.get("cum_productivity_wp", 0), 4)

        # 过滤掉没有工效展示值的维度（周期工效和开累工效均为 0 的不展示，两种算法任一>0 即展示）
        def _has_any_productivity(it):
            return (it.get("productivity") or 0) > 0 or (it.get("productivity_wp") or 0) > 0 or (it.get("cum_productivity") or 0) > 0 or (it.get("cum_productivity_wp") or 0) > 0
        items = [it for it in items if _has_any_productivity(it)]

        return {
            "group_by": grp,
            "start_date": str(d_start),
            "end_date": str(d_end),
            "items": items,
            "summary": _compute_summary_from_items(items),
            "data_source": "realtime",
        }

    # 无分组：汇总
    achieved_total = _f(
        _apply_base_filters(
            db.query(func.sum(VFACTDB.achieved)).filter(VFACTDB.date >= d_start, VFACTDB.date <= d_end),
            VFACTDB, filters, d_start, d_end
        ).scalar()
    )
    mp_total = _f(
        _apply_base_filters(
            db.query(func.sum(MPDB.manpower)).filter(MPDB.date >= d_start, MPDB.date <= d_end),
            MPDB, filters, d_start, d_end
        ).scalar()
    )
    prod_mp = _f(
        _apply_base_filters(
            db.query(func.sum(MPDB.manpower)).filter(
                MPDB.date >= d_start, MPDB.date <= d_end,
                MPDB.activity_id.isnot(None),
                MPDB.activity_id != "",
                MPDB.work_package.notin_(CO_WORK_PACKAGES),
            ),
            MPDB, filters, d_start, d_end
        ).scalar()
    )
    nonprod_mp = _f(
        _apply_nonprod_filters(
            db.query(func.sum(MPDB.manpower)).filter(
                MPDB.date >= d_start, MPDB.date <= d_end,
                MPDB.work_package.in_(CO_NON_PRODUCTIVITY),
            ),
            MPDB, filters, d_start, d_end
        ).scalar()
    )
    pct = (mp_total / prod_mp) if prod_mp > 0 else 0
    nonprod_considered = pct * nonprod_mp
    labor_w_nonp = (mp_total - nonprod_mp) + nonprod_considered
    productivity = (achieved_total / mp_total) if mp_total > 0 else 0
    productivity_wp = (achieved_total / labor_w_nonp) if labor_w_nonp > 0 else 0

    mp_wp_rows = (
        _apply_base_filters(
            db.query(MPDB.work_package, func.sum(MPDB.manpower).label("manpower")).filter(
                MPDB.date >= d_start, MPDB.date <= d_end
            ).group_by(MPDB.work_package),
            MPDB, filters, d_start, d_end
        ).all()
    )
    rsc_rows = (
        db.query(RSCDefine.work_package, func.avg(RSCDefine.norms).label("norms"))
        .filter(RSCDefine.is_active == True, RSCDefine.norms.isnot(None), RSCDefine.norms > 0)
        .group_by(RSCDefine.work_package)
        .all()
    )
    rsc_norms = {r[0]: float(r[1] or 0) for r in rsc_rows}
    sum_norms_mp = sum(rsc_norms.get(wp, 0) * _f(mp) for wp, mp in mp_wp_rows)
    weighted_norms = (sum_norms_mp / mp_total) if mp_total > 0 else 0

    # 开累工效：从项目开始到 end_date
    cum_start = PROJECT_START_DATE
    cum_achieved = _f(
        _apply_base_filters(
            db.query(func.sum(VFACTDB.achieved)).filter(
                VFACTDB.date >= cum_start, VFACTDB.date <= d_end
            ),
            VFACTDB, filters, cum_start, d_end
        ).scalar()
    )
    cum_mp = _f(
        _apply_base_filters(
            db.query(func.sum(MPDB.manpower)).filter(
                MPDB.date >= cum_start, MPDB.date <= d_end
            ),
            MPDB, filters, cum_start, d_end
        ).scalar()
    )
    cum_prod_mp = _f(
        _apply_base_filters(
            db.query(func.sum(MPDB.manpower)).filter(
                MPDB.date >= cum_start, MPDB.date <= d_end,
                MPDB.activity_id.isnot(None),
                MPDB.activity_id != "",
                MPDB.work_package.notin_(CO_WORK_PACKAGES),
            ),
            MPDB, filters, cum_start, d_end
        ).scalar()
    )
    cum_nonprod_mp = _f(
        _apply_nonprod_filters(
            db.query(func.sum(MPDB.manpower)).filter(
                MPDB.date >= cum_start, MPDB.date <= d_end,
                MPDB.work_package.in_(CO_NON_PRODUCTIVITY),
            ),
            MPDB, filters, cum_start, d_end
        ).scalar()
    )
    cum_pct = (cum_mp / cum_prod_mp) if cum_prod_mp > 0 else 0
    cum_labor_w = (cum_mp - cum_nonprod_mp) + cum_pct * cum_nonprod_mp
    cum_productivity = (cum_achieved / cum_mp) if cum_mp > 0 else 0
    cum_productivity_wp = (cum_achieved / cum_labor_w) if cum_labor_w > 0 else 0
    cum_mp_wp_rows = _apply_base_filters(
        db.query(MPDB.work_package, func.sum(MPDB.manpower).label("manpower")).filter(
            MPDB.date >= cum_start, MPDB.date <= d_end
        ).group_by(MPDB.work_package),
        MPDB, filters, cum_start, d_end
    ).all()
    cum_sum_norms = sum(rsc_norms.get(wp, 0) * _f(mp) for wp, mp in cum_mp_wp_rows)
    cum_weighted_norms = (cum_sum_norms / cum_mp) if cum_mp > 0 else 0

    return {
        "group_by": None,
        "start_date": str(d_start),
        "end_date": str(d_end),
        "summary": {
            "achieved": round(achieved_total, 4),
            "manpower": round(mp_total, 4),
            "productivity": round(productivity, 4),
            "productivity_wp": round(productivity_wp, 4),
            "weighted_norms": round(weighted_norms, 4),
            "cum_achieved": round(cum_achieved, 4),
            "cum_manpower": round(cum_mp, 4),
            "cum_productivity": round(cum_productivity, 4),
            "cum_productivity_wp": round(cum_productivity_wp, 4),
            "cum_weighted_norms": round(cum_weighted_norms, 4),
        },
        "items": [],
        "data_source": "realtime",
    }


def _get_productivity_trend_overall_from_cache(
    db: Session, d_start: date, d_end: date, filters: Dict, include_indirect: bool = False
) -> Optional[Dict[str, Any]]:
    """
    从缓存读取「总体」工效趋势：使用 group_by=scope 的数据，按周聚合所有维度为单条序列。
    用于 trend 的 overall 模式（group_by=None），与工效分析同源缓存。
    当 filter 含 resource_id_name/work_package 时，与分析一致使用全局分摊公式。
    """
    fk = build_filter_key(filters) if filters else ""
    grp = "scope"
    use_global_allocation = bool(filters.get("resource_id_name") or filters.get("work_package"))

    rows = (
        db.query(ProductivityCache)
        .filter(
            ProductivityCache.filter_key == fk,
            ProductivityCache.group_by == grp,
            ProductivityCache.date >= d_start,
            ProductivityCache.date <= d_end,
        )
        .all()
    )
    if not rows:
        return None

    _prod_all = _nonprod_all = _cum_prod_all = _cum_nonprod_all = 0.0
    if use_global_allocation and include_indirect:
        _prod_all = float(
            db.query(func.sum(MPDB.manpower))
            .filter(MPDB.date >= d_start, MPDB.date <= d_end, MPDB.activity_id.isnot(None),
                    MPDB.activity_id != "", MPDB.work_package.notin_(CO_WORK_PACKAGES))
            .scalar() or 1
        )
        _nonprod_all = float(
            db.query(func.sum(MPDB.manpower))
            .filter(MPDB.date >= d_start, MPDB.date <= d_end, MPDB.work_package.in_(CO_NON_PRODUCTIVITY))
            .scalar() or 0
        )
        _cum_prod_all = float(
            db.query(func.sum(MPDB.manpower))
            .filter(MPDB.date >= PROJECT_START_DATE, MPDB.date <= d_end, MPDB.activity_id.isnot(None),
                    MPDB.activity_id != "", MPDB.work_package.notin_(CO_WORK_PACKAGES))
            .scalar() or 1
        )
        _cum_nonprod_all = float(
            db.query(func.sum(MPDB.manpower))
            .filter(MPDB.date >= PROJECT_START_DATE, MPDB.date <= d_end, MPDB.work_package.in_(CO_NON_PRODUCTIVITY))
            .scalar() or 0
        )

    weeks_data = defaultdict(lambda: {"mp": 0.0, "ach": 0.0, "mp_prod": 0.0, "mp_nonprod": 0.0})
    for r in rows:
        w = r.date.isocalendar()
        wk = f"{w[0]}-W{w[1]:02d}"
        weeks_data[wk]["mp"] += float(r.mp or 0)
        weeks_data[wk]["ach"] += float(r.achieved or 0)
        weeks_data[wk]["mp_prod"] += float(r.mp_prod or 0)
        weeks_data[wk]["mp_nonprod"] += float(r.mp_nonprod or 0)
    weeks = sorted(weeks_data.keys())
    if not weeks:
        return None

    cum_rows = (
        db.query(ProductivityCache)
        .filter(
            ProductivityCache.filter_key == fk,
            ProductivityCache.group_by == grp,
            ProductivityCache.date >= PROJECT_START_DATE,
            ProductivityCache.date <= d_end,
        )
        .all()
    )
    cum_by_week = defaultdict(lambda: {"mp": 0.0, "ach": 0.0, "mp_prod": 0.0, "mp_nonprod": 0.0})
    for r in cum_rows:
        w = r.date.isocalendar()
        wk = f"{w[0]}-W{w[1]:02d}"
        cum_by_week[wk]["mp"] += float(r.mp or 0)
        cum_by_week[wk]["ach"] += float(r.achieved or 0)
        cum_by_week[wk]["mp_prod"] += float(r.mp_prod or 0)
        cum_by_week[wk]["mp_nonprod"] += float(r.mp_nonprod or 0)
    all_weeks_sorted = sorted(cum_by_week.keys())
    cum_mp_run, cum_ach_run = 0.0, 0.0
    cum_prod_run, cum_nonprod_run = 0.0, 0.0
    cum_productivity_by_week = {}
    cum_productivity_wp_by_week = {}
    for wk in all_weeks_sorted:
        v = cum_by_week[wk]
        cum_mp_run += v["mp"]
        cum_ach_run += v["ach"]
        cum_prod_run += v["mp_prod"]
        cum_nonprod_run += v["mp_nonprod"]
        cum_productivity_by_week[wk] = (cum_ach_run / cum_mp_run) if cum_mp_run > 0 else 0
        if use_global_allocation and include_indirect:
            pct = (cum_mp_run / _cum_prod_all) if _cum_prod_all > 0 else 0
            labor_w = cum_mp_run + pct * _cum_nonprod_all
        else:
            pct = (cum_mp_run / cum_prod_run) if cum_prod_run > 0 else 0
            labor_w = (cum_mp_run - cum_nonprod_run) + pct * cum_nonprod_run
        cum_productivity_wp_by_week[wk] = (cum_ach_run / labor_w) if labor_w > 0 else 0

    productivity = [round((weeks_data[w]["ach"] / weeks_data[w]["mp"]) if weeks_data[w]["mp"] > 0 else 0, 4) for w in weeks]
    productivity_wp = []
    for w in weeks:
        v = weeks_data[w]
        mp_tot, ach_tot = v["mp"], v["ach"]
        if use_global_allocation and include_indirect:
            pct = (mp_tot / _prod_all) if _prod_all > 0 else 0
            labor_w = mp_tot + pct * _nonprod_all
        else:
            mp_prod, mp_nonprod = v["mp_prod"], v["mp_nonprod"]
            pct = (mp_tot / mp_prod) if mp_prod > 0 else 0
            labor_w = (mp_tot - mp_nonprod) + pct * mp_nonprod
        productivity_wp.append(round((ach_tot / labor_w) if labor_w > 0 else 0, 4))
    cum_productivity = [round(cum_productivity_by_week.get(w, 0), 4) for w in weeks]
    cum_productivity_wp = [round(cum_productivity_wp_by_week.get(w, 0), 4) for w in weeks]

    achieved = [round(weeks_data[w]["ach"], 4) for w in weeks]
    manpower = [round(weeks_data[w]["mp"], 4) for w in weeks]
    # 根据 include_indirect 将选中的指标放入主字段，确保前端无需二次选择
    use_wp = include_indirect
    return {
        "weeks": weeks,
        "achieved": achieved,
        "manpower": manpower,
        "productivity": productivity_wp if use_wp else productivity,
        "cum_productivity": cum_productivity_wp if use_wp else cum_productivity,
        "productivity_wp": productivity_wp,
        "cum_productivity_wp": cum_productivity_wp,
        "group_by": None,
    }


def _get_productivity_trend_from_cache(
    db: Session, d_start: date, d_end: date, filters: Dict, grp: str,
    include_indirect: bool = False
) -> Optional[Dict[str, Any]]:
    """从缓存读取工效趋势（按周聚合，按维度分组）。include_indirect 时使用 productivity_wp 公式"""
    fk = build_filter_key(filters) if filters else ""
    rows = (
        db.query(ProductivityCache)
        .filter(
            ProductivityCache.filter_key == fk,
            ProductivityCache.group_by == grp,
            ProductivityCache.date >= d_start,
            ProductivityCache.date <= d_end,
        )
        .all()
    )
    if not rows:
        return None

    weeks_data = defaultdict(lambda: defaultdict(lambda: {"mp": 0.0, "ach": 0.0, "mp_prod": 0.0, "mp_nonprod": 0.0}))
    all_dims = set()
    for r in rows:
        w = r.date.isocalendar()
        wk = f"{w[0]}-W{w[1]:02d}"
        v = weeks_data[wk][r.dim_val]
        v["mp"] += float(r.mp or 0)
        v["ach"] += float(r.achieved or 0)
        v["mp_prod"] += float(r.mp_prod or 0)
        v["mp_nonprod"] += float(r.mp_nonprod or 0)
        all_dims.add(r.dim_val)
    weeks = sorted(weeks_data.keys())
    if not weeks:
        return None

    cum_rows = (
        db.query(ProductivityCache)
        .filter(
            ProductivityCache.filter_key == fk,
            ProductivityCache.group_by == grp,
            ProductivityCache.date >= PROJECT_START_DATE,
            ProductivityCache.date <= d_end,
        )
        .all()
    )
    cum_by_dim_date = defaultdict(lambda: {"mp": 0.0, "ach": 0.0, "mp_prod": 0.0, "mp_nonprod": 0.0})
    for r in cum_rows:
        k = (r.dim_val, r.date)
        cum_by_dim_date[k]["mp"] = float(r.mp or 0)
        cum_by_dim_date[k]["ach"] = float(r.achieved or 0)
        cum_by_dim_date[k]["mp_prod"] = float(r.mp_prod or 0)
        cum_by_dim_date[k]["mp_nonprod"] = float(r.mp_nonprod or 0)
    cum_by_dim_week = defaultdict(lambda: {"mp": 0.0, "ach": 0.0, "mp_prod": 0.0, "mp_nonprod": 0.0})
    all_weeks_set = set()
    for (dv, d), val in cum_by_dim_date.items():
        w = d.isocalendar()
        wk = f"{w[0]}-W{w[1]:02d}"
        all_weeks_set.add(wk)
        v = cum_by_dim_week[(dv, wk)]
        v["mp"] += val["mp"]
        v["ach"] += val["ach"]
        v["mp_prod"] += val["mp_prod"]
        v["mp_nonprod"] += val["mp_nonprod"]
    all_weeks_sorted = sorted(all_weeks_set)

    series = []
    cum_series = []
    for dv in sorted(list(all_dims)):
        p_list = []
        cum_list = []
        has_val = False
        cum_mp_run, cum_ach_run = 0.0, 0.0
        cum_prod_run, cum_nonprod_run = 0.0, 0.0
        cum_by_week = {}
        for wk in all_weeks_sorted:
            wk_val = cum_by_dim_week.get((dv, wk), {"mp": 0, "ach": 0, "mp_prod": 0, "mp_nonprod": 0})
            cum_mp_run += wk_val["mp"]
            cum_ach_run += wk_val["ach"]
            cum_prod_run += wk_val["mp_prod"]
            cum_nonprod_run += wk_val["mp_nonprod"]
            if include_indirect and cum_prod_run > 0:
                pct = cum_mp_run / cum_prod_run
                labor_w = (cum_mp_run - cum_nonprod_run) + pct * cum_nonprod_run
                cum_by_week[wk] = (cum_ach_run / labor_w) if labor_w > 0 else 0
            else:
                cum_by_week[wk] = (cum_ach_run / cum_mp_run) if cum_mp_run > 0 else 0
        for wk in weeks:
            d_val = weeks_data[wk].get(dv, {"mp": 0, "ach": 0, "mp_prod": 0, "mp_nonprod": 0})
            if d_val["mp"] > 0 or d_val["ach"] > 0:
                has_val = True
            if include_indirect and d_val["mp_prod"] > 0:
                pct = d_val["mp"] / d_val["mp_prod"]
                labor_w = (d_val["mp"] - d_val["mp_nonprod"]) + pct * d_val["mp_nonprod"]
                p = (d_val["ach"] / labor_w) if labor_w > 0 else 0
            else:
                p = (d_val["ach"] / d_val["mp"]) if d_val["mp"] > 0 else 0
            p_list.append(round(p, 4))
            cum_list.append(round(cum_by_week.get(wk, 0), 4))
        if has_val:
            series.append({"name": dv, "data": p_list})
            cum_series.append({"name": dv, "data": cum_list})

    return {
        "weeks": weeks,
        "series": series,
        "cum_series": cum_series,
        "group_by": grp,
    }


def get_productivity_trend(
    db: Session,
    start_date: date,
    end_date: date,
    filters: Optional[Dict[str, Any]] = None,
    group_by: Optional[str] = None,
) -> Dict[str, Any]:
    """
    工效趋势：按周返回 achieved、manpower、productivity 时间序列。
    若指定 group_by，则返回各分组的趋势；否则为总体趋势（单条序列）。
    优先从预聚合缓存读取，与工效分析同源；缓存未命中时回退实时查询。
    """
    filters = filters or {}
    d_start = start_date
    d_end = end_date

    grp = (group_by or "").strip().lower()
    if grp in ("block", "子项"):
        grp = "block"
    elif grp in ("unit", "装置"):
        grp = "unit"
    elif grp in ("work_package", "工作包"):
        grp = "work_package"

    # 总体趋势（group_by=None）：用 scope 缓存聚合为单条序列，与工效分析同源
    if not grp:
        if _can_use_cache(db, filters, "scope"):
            cached = _get_productivity_trend_overall_from_cache(
                db, d_start, d_end, filters, include_indirect=filters.get("include_indirect", False)
            )
            if cached is not None:
                cached["data_source"] = "cache"
                return cached
    else:
        if _can_use_cache(db, filters, group_by):
            cached = _get_productivity_trend_from_cache(
                db, d_start, d_end, filters, grp,
                include_indirect=filters.get("include_indirect", False)
            )
            if cached is not None:
                cached["data_source"] = "cache"
                return cached

    # 回退到实时查询
    grp = (group_by or "").strip().lower()
    dim_col = None
    if grp == "scope": dim_col = MPDB.scope; vf_dim = VFACTDB.scope
    elif grp == "subproject": dim_col = MPDB.subproject; vf_dim = VFACTDB.subproject
    elif grp == "train": dim_col = MPDB.train; vf_dim = VFACTDB.train
    elif grp in ("block", "子项"): dim_col = MPDB.block; vf_dim = VFACTDB.block
    elif grp in ("unit", "装置"): dim_col = MPDB.unit; vf_dim = VFACTDB.unit
    elif grp in ("work_package", "工作包"): dim_col = MPDB.work_package; vf_dim = VFACTDB.work_package
    else: grp = None

    include_indirect = filters.get("include_indirect", False)
    if grp and dim_col is not None:
        # 分组趋势
        mp_q = db.query(MPDB.date, dim_col.label("dim_val"), func.sum(MPDB.manpower).label("mp"))
        mp_q = _apply_base_filters(mp_q, MPDB, filters, d_start, d_end).group_by(MPDB.date, dim_col)
        mp_data = mp_q.all()

        vf_q = db.query(VFACTDB.date, vf_dim.label("dim_val"), func.sum(VFACTDB.achieved).label("ach"))
        vf_q = _apply_base_filters(vf_q, VFACTDB, filters, d_start, d_end).group_by(VFACTDB.date, vf_dim)
        vf_data = vf_q.all()

        # 整理数据：wk -> dim -> {mp, ach, mp_prod, mp_nonprod}
        weeks_data = defaultdict(lambda: defaultdict(lambda: {"mp": 0.0, "ach": 0.0, "mp_prod": 0.0, "mp_nonprod": 0.0}))
        all_dims = set()
        for d, dv, mp in mp_data:
            if not dv: continue
            w = d.isocalendar()
            wk = f"{w[0]}-W{w[1]:02d}"
            weeks_data[wk][dv]["mp"] += float(mp or 0)
            all_dims.add(dv)
        for d, dv, ach in vf_data:
            if not dv: continue
            w = d.isocalendar()
            wk = f"{w[0]}-W{w[1]:02d}"
            weeks_data[wk][dv]["ach"] += float(ach or 0)
            all_dims.add(dv)

        if include_indirect:
            mp_prod_q = db.query(MPDB.date, dim_col.label("dim_val"), func.sum(MPDB.manpower).label("mp")).filter(
                MPDB.date >= d_start, MPDB.date <= d_end,
                MPDB.activity_id.isnot(None), MPDB.activity_id != "",
                MPDB.work_package.notin_(CO_WORK_PACKAGES),
            )
            mp_prod_q = _apply_base_filters(mp_prod_q, MPDB, filters, d_start, d_end).group_by(MPDB.date, dim_col)
            for d, dv, mp in mp_prod_q.all():
                if not dv: continue
                w = d.isocalendar()
                wk = f"{w[0]}-W{w[1]:02d}"
                weeks_data[wk][dv]["mp_prod"] += float(mp or 0)
            mp_nonprod_q = db.query(MPDB.date, dim_col.label("dim_val"), func.sum(MPDB.manpower).label("mp")).filter(
                MPDB.date >= d_start, MPDB.date <= d_end,
                MPDB.work_package.in_(CO_NON_PRODUCTIVITY),
            )
            mp_nonprod_q = _apply_nonprod_filters(mp_nonprod_q, MPDB, filters, d_start, d_end).group_by(MPDB.date, dim_col)
            for d, dv, mp in mp_nonprod_q.all():
                if not dv: continue
                w = d.isocalendar()
                wk = f"{w[0]}-W{w[1]:02d}"
                weeks_data[wk][dv]["mp_nonprod"] += float(mp or 0)

        weeks = sorted(weeks_data.keys())

        # 累计工效：从项目开始日查询
        cum_mp_q = db.query(MPDB.date, dim_col.label("dim_val"), func.sum(MPDB.manpower).label("mp"))
        cum_mp_q = _apply_base_filters(cum_mp_q, MPDB, filters, PROJECT_START_DATE, d_end).group_by(MPDB.date, dim_col)
        cum_mp_data = cum_mp_q.all()
        cum_vf_q = db.query(VFACTDB.date, vf_dim.label("dim_val"), func.sum(VFACTDB.achieved).label("ach"))
        cum_vf_q = _apply_base_filters(cum_vf_q, VFACTDB, filters, PROJECT_START_DATE, d_end).group_by(VFACTDB.date, vf_dim)
        cum_vf_data = cum_vf_q.all()
        cum_by_dim_date = defaultdict(lambda: {"mp": 0.0, "ach": 0.0, "mp_prod": 0.0, "mp_nonprod": 0.0})
        for d, dv, mp in cum_mp_data:
            if not dv: continue
            cum_by_dim_date[(dv, d)]["mp"] = float(mp or 0)
        for d, dv, ach in cum_vf_data:
            if not dv: continue
            cum_by_dim_date[(dv, d)]["ach"] = float(ach or 0)
        if include_indirect:
            cum_mp_prod_q = db.query(MPDB.date, dim_col.label("dim_val"), func.sum(MPDB.manpower).label("mp")).filter(
                MPDB.date >= PROJECT_START_DATE, MPDB.date <= d_end,
                MPDB.activity_id.isnot(None), MPDB.activity_id != "",
                MPDB.work_package.notin_(CO_WORK_PACKAGES),
            )
            cum_mp_prod_q = _apply_base_filters(cum_mp_prod_q, MPDB, filters, PROJECT_START_DATE, d_end).group_by(MPDB.date, dim_col)
            for d, dv, mp in cum_mp_prod_q.all():
                if not dv: continue
                cum_by_dim_date[(dv, d)]["mp_prod"] = float(mp or 0)
            cum_mp_nonprod_q = db.query(MPDB.date, dim_col.label("dim_val"), func.sum(MPDB.manpower).label("mp")).filter(
                MPDB.date >= PROJECT_START_DATE, MPDB.date <= d_end,
                MPDB.work_package.in_(CO_NON_PRODUCTIVITY),
            )
            cum_mp_nonprod_q = _apply_nonprod_filters(cum_mp_nonprod_q, MPDB, filters, PROJECT_START_DATE, d_end).group_by(MPDB.date, dim_col)
            for d, dv, mp in cum_mp_nonprod_q.all():
                if not dv: continue
                cum_by_dim_date[(dv, d)]["mp_nonprod"] = float(mp or 0)
        cum_by_dim_week = defaultdict(lambda: {"mp": 0.0, "ach": 0.0, "mp_prod": 0.0, "mp_nonprod": 0.0})
        all_weeks_set = set()
        for (dv, d), val in cum_by_dim_date.items():
            w = d.isocalendar()
            wk = f"{w[0]}-W{w[1]:02d}"
            all_weeks_set.add(wk)
            v = cum_by_dim_week[(dv, wk)]
            v["mp"] += val["mp"]
            v["ach"] += val["ach"]
            v["mp_prod"] += val.get("mp_prod", 0)
            v["mp_nonprod"] += val.get("mp_nonprod", 0)
        all_weeks_sorted = sorted(all_weeks_set)

        series = []
        cum_series = []
        for dv in sorted(list(all_dims)):
            p_list = []
            cum_list = []
            has_val = False
            cum_mp_run, cum_ach_run = 0.0, 0.0
            cum_prod_run, cum_nonprod_run = 0.0, 0.0
            cum_by_week = {}
            for wk in all_weeks_sorted:
                wk_val = cum_by_dim_week.get((dv, wk), {"mp": 0, "ach": 0, "mp_prod": 0, "mp_nonprod": 0})
                cum_mp_run += wk_val["mp"]
                cum_ach_run += wk_val["ach"]
                cum_prod_run += wk_val.get("mp_prod", 0)
                cum_nonprod_run += wk_val.get("mp_nonprod", 0)
                if include_indirect and cum_prod_run > 0:
                    pct = cum_mp_run / cum_prod_run
                    labor_w = (cum_mp_run - cum_nonprod_run) + pct * cum_nonprod_run
                    cum_by_week[wk] = (cum_ach_run / labor_w) if labor_w > 0 else 0
                else:
                    cum_by_week[wk] = (cum_ach_run / cum_mp_run) if cum_mp_run > 0 else 0
            for wk in weeks:
                d_val = weeks_data[wk].get(dv, {"mp": 0, "ach": 0, "mp_prod": 0, "mp_nonprod": 0})
                if d_val["mp"] > 0 or d_val["ach"] > 0:
                    has_val = True
                if include_indirect and d_val.get("mp_prod", 0) > 0:
                    pct = d_val["mp"] / d_val["mp_prod"]
                    labor_w = (d_val["mp"] - d_val.get("mp_nonprod", 0)) + pct * d_val.get("mp_nonprod", 0)
                    p = (d_val["ach"] / labor_w) if labor_w > 0 else 0
                else:
                    p = (d_val["ach"] / d_val["mp"]) if d_val["mp"] > 0 else 0
                p_list.append(round(p, 4))
                cum_list.append(round(cum_by_week.get(wk, 0), 4))
            if has_val:
                series.append({"name": dv, "data": p_list})
                cum_series.append({"name": dv, "data": cum_list})
        
        return {
            "weeks": weeks,
            "series": series,
            "cum_series": cum_series,
            "group_by": grp,
            "data_source": "realtime",
        }

    # 全局汇总趋势
    dates_q = (
        db.query(MPDB.date, func.sum(MPDB.manpower).label("manpower"))
        .filter(MPDB.date >= d_start, MPDB.date <= d_end)
    )
    dates_q = _apply_base_filters(dates_q, MPDB, filters, d_start, d_end)
    dates_q = dates_q.group_by(MPDB.date).order_by(MPDB.date)
    mp_by_date = {r[0]: float(r[1] or 0) for r in dates_q.all()}

    vf_q = (
        db.query(VFACTDB.date, func.sum(VFACTDB.achieved).label("achieved"))
        .filter(VFACTDB.date >= d_start, VFACTDB.date <= d_end)
    )
    vf_q = _apply_base_filters(vf_q, VFACTDB, filters, d_start, d_end)
    vf_q = vf_q.group_by(VFACTDB.date).order_by(VFACTDB.date)
    vf_by_date = {r[0]: float(r[1] or 0) for r in vf_q.all()}

    weeks_mp = defaultdict(float)
    weeks_achieved = defaultdict(float)
    d = d_start
    while d <= d_end:
        w = d.isocalendar()
        wk = f"{w[0]}-W{w[1]:02d}"
        weeks_mp[wk] += mp_by_date.get(d, 0)
        weeks_achieved[wk] += vf_by_date.get(d, 0)
        d += timedelta(days=1)

    weeks = sorted(weeks_mp.keys())
    weeks = [w for w in weeks if weeks_mp[w] > 0 or weeks_achieved[w] > 0]

    achieved = [weeks_achieved[w] for w in weeks]
    manpower = [weeks_mp[w] for w in weeks]
    productivity = [(weeks_achieved[w] / weeks_mp[w]) if weeks_mp[w] > 0 else 0 for w in weeks]

    # 周期工效（考虑辅助人力）：需按周聚合 mp_prod、mp_nonprod
    mp_prod_q = (
        db.query(MPDB.date, func.sum(MPDB.manpower).label("mp"))
        .filter(
            MPDB.date >= d_start, MPDB.date <= d_end,
            MPDB.activity_id.isnot(None), MPDB.activity_id != "",
            MPDB.work_package.notin_(CO_WORK_PACKAGES),
        )
    )
    mp_prod_q = _apply_base_filters(mp_prod_q, MPDB, filters, d_start, d_end)
    mp_prod_by_date = {r[0]: float(r[1] or 0) for r in mp_prod_q.group_by(MPDB.date).all()}
    mp_nonprod_q = (
        db.query(MPDB.date, func.sum(MPDB.manpower).label("mp"))
        .filter(MPDB.date >= d_start, MPDB.date <= d_end, MPDB.work_package.in_(CO_NON_PRODUCTIVITY))
    )
    mp_nonprod_q = _apply_nonprod_filters(mp_nonprod_q, MPDB, filters, d_start, d_end)
    mp_nonprod_by_date = {r[0]: float(r[1] or 0) for r in mp_nonprod_q.group_by(MPDB.date).all()}
    weeks_mp_prod = defaultdict(float)
    weeks_mp_nonprod = defaultdict(float)
    d = d_start
    while d <= d_end:
        w = d.isocalendar()
        wk = f"{w[0]}-W{w[1]:02d}"
        weeks_mp_prod[wk] += mp_prod_by_date.get(d, 0)
        weeks_mp_nonprod[wk] += mp_nonprod_by_date.get(d, 0)
        d += timedelta(days=1)
    productivity_wp = []
    for w in weeks:
        mp_tot = weeks_mp[w]
        mp_prod = weeks_mp_prod.get(w, 0)
        mp_nonprod = weeks_mp_nonprod.get(w, 0)
        pct = (mp_tot / mp_prod) if mp_prod > 0 else 0
        labor_w = (mp_tot - mp_nonprod) + pct * mp_nonprod
        productivity_wp.append(round((weeks_achieved[w] / labor_w) if labor_w > 0 else 0, 4))

    # 开工累计工效：从项目开始到每周累计
    cum_mp_q = (
        db.query(MPDB.date, func.sum(MPDB.manpower).label("manpower"))
        .filter(MPDB.date >= PROJECT_START_DATE, MPDB.date <= d_end)
    )
    cum_mp_q = _apply_base_filters(cum_mp_q, MPDB, filters, PROJECT_START_DATE, d_end)
    cum_mp_q = cum_mp_q.group_by(MPDB.date).order_by(MPDB.date)
    cum_mp_by_date = {r[0]: float(r[1] or 0) for r in cum_mp_q.all()}
    cum_ach_q = (
        db.query(VFACTDB.date, func.sum(VFACTDB.achieved).label("achieved"))
        .filter(VFACTDB.date >= PROJECT_START_DATE, VFACTDB.date <= d_end)
    )
    cum_ach_q = _apply_base_filters(cum_ach_q, VFACTDB, filters, PROJECT_START_DATE, d_end)
    cum_ach_q = cum_ach_q.group_by(VFACTDB.date).order_by(VFACTDB.date)
    cum_ach_by_date = {r[0]: float(r[1] or 0) for r in cum_ach_q.all()}
    cum_by_week = {}
    cum_mp_run, cum_ach_run = 0.0, 0.0
    d = PROJECT_START_DATE
    while d <= d_end:
        cum_mp_run += cum_mp_by_date.get(d, 0)
        cum_ach_run += cum_ach_by_date.get(d, 0)
        w = d.isocalendar()
        wk = f"{w[0]}-W{w[1]:02d}"
        cum_by_week[wk] = (cum_mp_run, cum_ach_run)
        d += timedelta(days=1)
    cum_productivity = [
        round((cum_by_week[w][1] / cum_by_week[w][0]), 4) if w in cum_by_week and cum_by_week[w][0] > 0 else 0
        for w in weeks
    ]
    cum_productivity_wp = cum_productivity
    # 开累（考虑辅助人力）需 cum_prod_mp、cum_nonprod_mp 按日
    cum_prod_q = (
        db.query(MPDB.date, func.sum(MPDB.manpower).label("mp"))
        .filter(
            MPDB.date >= PROJECT_START_DATE, MPDB.date <= d_end,
            MPDB.activity_id.isnot(None), MPDB.activity_id != "",
            MPDB.work_package.notin_(CO_WORK_PACKAGES),
        )
    )
    cum_prod_q = _apply_base_filters(cum_prod_q, MPDB, filters, PROJECT_START_DATE, d_end)
    cum_prod_by_date = {r[0]: float(r[1] or 0) for r in cum_prod_q.group_by(MPDB.date).all()}
    cum_nonprod_q = (
        db.query(MPDB.date, func.sum(MPDB.manpower).label("mp"))
        .filter(MPDB.date >= PROJECT_START_DATE, MPDB.date <= d_end, MPDB.work_package.in_(CO_NON_PRODUCTIVITY))
    )
    cum_nonprod_q = _apply_nonprod_filters(cum_nonprod_q, MPDB, filters, PROJECT_START_DATE, d_end)
    cum_nonprod_by_date = {r[0]: float(r[1] or 0) for r in cum_nonprod_q.group_by(MPDB.date).all()}
    cum_mp_run2, cum_ach_run2 = 0.0, 0.0
    cum_prod_run, cum_nonprod_run = 0.0, 0.0
    cum_by_week_wp = {}
    d = PROJECT_START_DATE
    while d <= d_end:
        cum_mp_run2 += cum_mp_by_date.get(d, 0)
        cum_ach_run2 += cum_ach_by_date.get(d, 0)
        cum_prod_run += cum_prod_by_date.get(d, 0)
        cum_nonprod_run += cum_nonprod_by_date.get(d, 0)
        pct = (cum_mp_run2 / cum_prod_run) if cum_prod_run > 0 else 0
        labor_w = (cum_mp_run2 - cum_nonprod_run) + pct * cum_nonprod_run
        w = d.isocalendar()
        wk = f"{w[0]}-W{w[1]:02d}"
        cum_by_week_wp[wk] = (cum_ach_run2 / labor_w) if labor_w > 0 else 0
        d += timedelta(days=1)
    cum_productivity_wp = [round(cum_by_week_wp.get(w, 0), 4) for w in weeks]

    use_wp = filters.get("include_indirect", False)
    return {
        "weeks": weeks,
        "achieved": [round(x, 4) for x in achieved],
        "manpower": [round(x, 4) for x in manpower],
        "productivity": productivity_wp if use_wp else [round(x, 4) for x in productivity],
        "productivity_wp": productivity_wp,
        "cum_productivity": cum_productivity_wp if use_wp else cum_productivity,
        "cum_productivity_wp": cum_productivity_wp,
        "data_source": "realtime",
    }


def _compute_summary_from_items(items: List[Dict]) -> Dict:
    if not items:
        return {}
    total_achieved = sum(x["achieved"] for x in items)
    total_mp = sum(x["manpower"] for x in items)
    prod = (total_achieved / total_mp) if total_mp > 0 else 0
    total_labor_w = sum(x["achieved"] / x["productivity_wp"] for x in items if (x.get("productivity_wp") or 0) > 0)
    prod_wp = (total_achieved / total_labor_w) if total_labor_w > 0 else prod  # 无辅助分摊时退化为 prod
    sum_nw = sum((x.get("weighted_norms") or 0) * x["manpower"] for x in items)
    wn = (sum_nw / total_mp) if total_mp > 0 else 0
    out = {
        "achieved": round(total_achieved, 4),
        "manpower": round(total_mp, 4),
        "productivity": round(prod, 4),
        "productivity_wp": round(prod_wp, 4),
        "weighted_norms": round(wn, 4) if wn == wn else 0,  # 避免 NaN
    }
    if items and "cum_achieved" in items[0]:
        cum_ach = sum(x.get("cum_achieved", 0) for x in items)
        cum_mp = sum(x.get("cum_manpower", 0) for x in items)
        cum_prod = (cum_ach / cum_mp) if cum_mp > 0 else 0
        total_cum_labor_w = sum(x.get("cum_achieved", 0) / x.get("cum_productivity_wp", 1)
                             for x in items if (x.get("cum_productivity_wp") or 0) > 0)
        cum_prod_wp = (cum_ach / total_cum_labor_w) if total_cum_labor_w > 0 else cum_prod  # 无辅助分摊时退化为 cum_prod
        out["cum_achieved"] = round(cum_ach, 4)
        out["cum_manpower"] = round(cum_mp, 4)
        out["cum_productivity"] = round(cum_prod, 4)
        out["cum_productivity_wp"] = round(cum_prod_wp, 4)
    return out
