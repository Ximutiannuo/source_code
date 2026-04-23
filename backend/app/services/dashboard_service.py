import csv
import os
import tempfile
import threading
import pandas as pd
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional, Tuple, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import date, timedelta

from app.models.dashboard import SCurveCache
from app.database import SessionLocal
from app.services.s_curve_filter_utils import (
    build_filter_key,
    filters_to_cache_columns,
    build_act_where_sql,
    act_where_with_alias,
    DIMENSION_COLUMNS_FOR_REFRESH,
)

logger = logging.getLogger(__name__)

_TMP_PROGRESS_ACT = "_tmp_progress_act"


def _run_one_progress_query_worker(
    query_id: int,
    act_where_raw: str,
    act_where_a: str,
    is_global: bool,
    barrier: Optional[threading.Barrier],
) -> Tuple[int, Any]:
    """
    在独立连接中执行单条进度聚合查询（用于并行）。有过滤时先建临时表并插入，经 barrier 同步后再查大表，避免死锁。
    barrier 仅在有过滤时传入，确保 6 个连接都释放 activity_summary 锁后再访问 budgeted_db/atcompletion_db。
    """
    db = SessionLocal()
    try:
        if not is_global:
            db.execute(text(f"DROP TEMPORARY TABLE IF EXISTS {_TMP_PROGRESS_ACT}"))
            db.execute(text(f"CREATE TEMPORARY TABLE {_TMP_PROGRESS_ACT} (activity_id VARCHAR(100) PRIMARY KEY) ENGINE=MEMORY"))
            db.execute(text(f"INSERT INTO {_TMP_PROGRESS_ACT} SELECT activity_id FROM activity_summary WHERE {act_where_raw}"))
            if barrier is not None:
                barrier.wait()
        return _run_one_progress_query_on_session(db, query_id, act_where_a, is_global)
    finally:
        if not is_global:
            try:
                db.execute(text(f"DROP TEMPORARY TABLE IF EXISTS {_TMP_PROGRESS_ACT}"))
            except Exception:
                pass
        db.close()


def _run_one_progress_query_on_session(
    db: Session,
    query_id: int,
    act_where_a: str,
    is_global: bool,
) -> Tuple[int, Any]:
    """
    在给定会话上执行单条进度聚合查询（单连接顺序调用，避免死锁）。
    query_id: 0=t_budget, 1=t_ac, 2=plan, 3=forecast, 4=mh_val, 5=owf。
    有过滤时调用方已在本会话创建并填充 _tmp_progress_act。返回 (query_id, result)。
    """
    if query_id == 0:
        if is_global:
            v = float(db.execute(text("SELECT COALESCE(SUM(budgeted_units), 0) FROM budgeted_db WHERE resource_id = 'GCC_WF'")).scalar() or 1.0)
        else:
            v = float(db.execute(text(f"SELECT COALESCE(SUM(b.budgeted_units), 0) FROM budgeted_db b INNER JOIN {_TMP_PROGRESS_ACT} t ON b.activity_id = t.activity_id WHERE b.resource_id = 'GCC_WF'")).scalar() or 1.0)
        return (0, v)
    if query_id == 1:
        if is_global:
            v = float(db.execute(text("SELECT COALESCE(SUM(atcompletion_units), 0) FROM atcompletion_db WHERE resource_id = 'GCC_WF'")).scalar() or 1.0)
        else:
            v = float(db.execute(text(f"SELECT COALESCE(SUM(ac.atcompletion_units), 0) FROM atcompletion_db ac INNER JOIN {_TMP_PROGRESS_ACT} t ON ac.activity_id = t.activity_id WHERE ac.resource_id = 'GCC_WF'")).scalar() or 1.0)
        return (1, v)
    if query_id == 2:
        if is_global:
            sql = "SELECT date, SUM(budgeted_units) FROM budgeted_db WHERE resource_id = 'GCC_WF' GROUP BY date"
        else:
            sql = f"SELECT b.date, SUM(b.budgeted_units) FROM budgeted_db b INNER JOIN {_TMP_PROGRESS_ACT} t ON b.activity_id = t.activity_id WHERE b.resource_id = 'GCC_WF' GROUP BY b.date"
        return (2, {r[0]: float(r[1]) for r in db.execute(text(sql)) if r[0]})
    if query_id == 3:
        if is_global:
            sql = "SELECT date, SUM(atcompletion_units) FROM atcompletion_db WHERE resource_id = 'GCC_WF' GROUP BY date"
        else:
            sql = f"SELECT ac.date, SUM(ac.atcompletion_units) FROM atcompletion_db ac INNER JOIN {_TMP_PROGRESS_ACT} t ON ac.activity_id = t.activity_id WHERE ac.resource_id = 'GCC_WF' GROUP BY ac.date"
        return (3, {r[0]: float(r[1]) for r in db.execute(text(sql)) if r[0]})
    if query_id == 4:
        if is_global:
            sql = f"SELECT v.date, SUM(v.achieved / NULLIF(r.norms, 0) * 10) FROM activity_summary a STRAIGHT_JOIN vfactdb v ON a.activity_id = v.activity_id INNER JOIN (SELECT work_package, MIN(norms) as norms FROM rsc_defines WHERE norms > 0 GROUP BY work_package) r ON a.work_package = r.work_package WHERE {act_where_a} GROUP BY v.date"
        else:
            sql = f"SELECT v.date, SUM(v.achieved / NULLIF(r.norms, 0) * 10) FROM vfactdb v INNER JOIN {_TMP_PROGRESS_ACT} t ON v.activity_id = t.activity_id INNER JOIN (SELECT work_package, MIN(norms) as norms FROM rsc_defines WHERE norms > 0 GROUP BY work_package) r ON v.work_package = r.work_package GROUP BY v.date"
        return (4, {r[0]: float(r[1]) for r in db.execute(text(sql)) if r[0]})
    if query_id == 5:
        if is_global:
            sql = f"SELECT o.date, SUM(o.actual_units) FROM activity_summary a STRAIGHT_JOIN owf_db o ON a.activity_id = o.activity_id WHERE {act_where_a} GROUP BY o.date"
        else:
            sql = f"SELECT o.date, SUM(o.actual_units) FROM owf_db o INNER JOIN {_TMP_PROGRESS_ACT} t ON o.activity_id = t.activity_id GROUP BY o.date"
        return (5, {r[0]: float(r[1]) for r in db.execute(text(sql)) if r[0]})
    return (query_id, None)


# 下表 GCC 列：库存 2.1 / Add.1 / Add.3 / C，前端展示为 add.1 / add2.1 / add2.2 / add.3
_GCC_NAME_TO_DISPLAY = {
    "add.1": "add.1", "Add.1": "add.1",
    "2.1": "add2.1", "add2.1": "add2.1", "Add2.1": "add2.1",
    "c": "add2.2", "C": "add2.2", "add2.2": "add2.2", "Add2.2": "add2.2",
    "add.3": "add.3", "Add.3": "add.3",
}

def _gcc_display_name(raw: str) -> str:
    if not raw:
        return raw
    k = raw.strip()
    return _GCC_NAME_TO_DISPLAY.get(k, _GCC_NAME_TO_DISPLAY.get(k.lower(), raw))

class DashboardService:
    def __init__(self, db_session: Session):
        self.db = db_session
        self.engine = db_session.get_bind()

    def get_period_completed_wf(self):
        """
        计算 Period Completed WF
        """
        # 1. 计算 Period Completed OWF
        owf_query = "SELECT SUM(actual_units) as owf_value FROM owf_db"
        owf_df = pd.read_sql(owf_query, self.engine)
        period_completed_owf = owf_df['owf_value'].iloc[0] if not owf_df.empty and owf_df['owf_value'].iloc[0] is not None else 0
        
        # 2. 计算 PeriodIndividualManhours
        vfact_query = """
        SELECT 
            v.achieved, 
            r.norms 
        FROM vfactdb v
        JOIN activity_summary a ON v.activity_id = a.activity_id
        JOIN rsc_defines r ON a.work_package = r.work_package
        WHERE r.norms > 0
        """
        
        vfact_df = pd.read_sql(vfact_query, self.engine)
        
        if not vfact_df.empty:
            vfact_df['manhours'] = (vfact_df['achieved'] / vfact_df['norms']) * 10
            period_individual_manhours = vfact_df['manhours'].sum()
        else:
            period_individual_manhours = 0
            
        # 3. 计算 TotalManhours (from ActList / ActivitySummary)
        act_query = "SELECT SUM(calculated_mhrs) as total_manhours FROM activity_summary"
        act_df = pd.read_sql(act_query, self.engine)
        total_manhours = act_df['total_manhours'].iloc[0] if not act_df.empty and act_df['total_manhours'].iloc[0] is not None else 1 # 避免除以零
        
        if total_manhours == 0:
            total_manhours = 1

        # 4. 计算 TotalWeightFactor
        wf_query = """
        SELECT SUM(weight_factor) as total_wf 
        FROM activity_summary 
        WHERE implement_phase = 'CT' AND contract_phase = 'Add.3'
        """
        wf_df = pd.read_sql(wf_query, self.engine)
        total_weight_factor = wf_df['total_wf'].iloc[0] if not wf_df.empty and wf_df['total_wf'].iloc[0] is not None else 0
        
        # Final Calculation
        period_completed_wf_new = (period_individual_manhours / total_manhours) * total_weight_factor + period_completed_owf
        
        return {
            "period_completed_owf": float(period_completed_owf),
            "period_individual_manhours": float(period_individual_manhours),
            "total_manhours": float(total_manhours),
            "total_weight_factor": float(total_weight_factor),
            "period_completed_wf_new": float(period_completed_wf_new)
        }

    def get_period_at_completion_wf(self):
        """
        At Completion WF (预测/完工)
        """
        try:
            ac_df = pd.read_sql("""
                SELECT COALESCE(SUM(atcompletion_units), 0) as total
                FROM atcompletion_db
                WHERE resource_id = 'GCC_WF'
            """, self.engine)
            total_ac = float(ac_df['total'].iloc[0] or 0)
            return {
                "period_at_completion_wf": total_ac,
                "percentage": total_ac,
                "total_at_completion_wf": total_ac,
            }
        except Exception as e:
            logger.warning(f"get_period_at_completion_wf: {e}")
            return {"period_at_completion_wf": 0, "percentage": 0, "total_at_completion_wf": 0}

    def get_progress_summary(self):
        actual = self.get_period_completed_wf()
        forecast = self.get_period_at_completion_wf()
        
        epc_data = {
            "E": {"weight": 0.07, "plan": 99.16, "actual": 98.74, "balance": -0.42},
            "P": {"weight": 0.63, "plan": 96.58, "actual": 95.02, "balance": -1.57},
            "C": {"weight": 0.29, "plan": 54.76, "actual": 53.49, "balance": -1.27}
        }
        
        phase_data = [
            {"name": "Add1", "weight": "0.9%", "plan": "100%", "actual": "100%", "balance": "0.00%"},
            {"name": "Add2", "weight": "52.0%", "plan": "100%", "actual": "99.31%", "balance": "-0.69%"},
            {"name": "Add3", "weight": "47.1%", "plan": "66.98%", "actual": "64.78%", "balance": "-2.20%"},
        ]
        
        return {
            "actual": actual,
            "forecast": forecast,
            "epc": epc_data,
            "phases": phase_data,
            "safety": {"total_hours": 140000000, "days": 1000},
            "manpower": {"total": 12345, "change": 120}
        }

    def get_discipline_details(self):
        return {
            "E": {"ddd": 931000, "mac": 85, "KITSO": 45},
            "P": {"equipment": 85, "bulk": 72, "delivery": 65},
            "C": {"concrete": 931000, "steel": 450000},
            "PreC": {"test_packs": 12, "progress": 83.1}
        }

    def list_s_curve_slice_filters_for_refresh(self) -> List[Optional[dict]]:
        """
        枚举需要预聚合的维度组合：全局 + 各维度的每个取值（与缓存表维度列一致，仅用于兼容逐 slice 调用）。
        全量刷新请用 refresh_s_curve_cache_all（按维度批量扫表，约半小时）。
        """
        filters_list: List[Optional[dict]] = [None]
        try:
            for col in DIMENSION_COLUMNS_FOR_REFRESH:
                c = f"`{col}`" if col == "type" else col
                rows = self.db.execute(text(f"""
                    SELECT DISTINCT {c} FROM activity_summary
                    WHERE {c} IS NOT NULL AND {c} <> ''
                    ORDER BY {c}
                """)).fetchall()
                for (v,) in rows:
                    if v:
                        filters_list.append({col: v})
        except Exception as e:
            logger.warning(f"list_s_curve_slice_filters_for_refresh: {e}, 仅刷新全局")
        return filters_list

    def get_s_curve_data(self, filters: Optional[dict] = None):
        """
        S 曲线：从预聚合缓存表读取，毫秒级响应。
        """
        fk = build_filter_key(filters) if filters else ""
        rows = (
            self.db.query(SCurveCache)
            .filter(SCurveCache.filter_key == fk)
            .order_by(SCurveCache.date)
            .all()
        )
        return [
            {
                "date": r.date.strftime("%Y-%m-%d") if r.date else "",
                "cum_plan_wf": round(float(r.cum_plan_wf or 0), 4),
                "cum_actual_wf": round(float(r.cum_actual_wf or 0), 4),
                "cum_forecast_wf": round(float(r.cum_forecast_wf or 0), 4),
            }
            for r in rows
        ]

    def get_s_curve_summary(self) -> List[dict]:
        """
        截止今日（或最新一日）的 plan / forecast / actual，全局 + EN/PR/CT。
        与验证 SQL 一致，供前端 Overall Status 与 E/P/C 环使用。
        """
        sql = text("""
            SELECT c.filter_key, c.implement_phase, c.date,
                   c.cum_plan_wf, c.cum_forecast_wf, c.cum_actual_wf
            FROM dashboard_s_curve_cache c
            INNER JOIN (
                SELECT filter_key, MAX(date) AS max_date
                FROM dashboard_s_curve_cache
                WHERE filter_key IN ('', 'implement_phase=EN', 'implement_phase=PR', 'implement_phase=CT')
                  AND date <= CURDATE()
                GROUP BY filter_key
            ) t ON c.filter_key = t.filter_key AND c.date = t.max_date
            ORDER BY CASE WHEN c.filter_key = '' THEN 0 ELSE 1 END, c.filter_key
        """)
        rows = self.db.execute(sql).fetchall()
        if not rows:
            sql = text("""
                SELECT c.filter_key, c.implement_phase, c.date,
                       c.cum_plan_wf, c.cum_forecast_wf, c.cum_actual_wf
                FROM dashboard_s_curve_cache c
                INNER JOIN (
                    SELECT filter_key, MAX(date) AS max_date
                    FROM dashboard_s_curve_cache
                    WHERE filter_key IN ('', 'implement_phase=EN', 'implement_phase=PR', 'implement_phase=CT')
                    GROUP BY filter_key
                ) t ON c.filter_key = t.filter_key AND c.date = t.max_date
                ORDER BY CASE WHEN c.filter_key = '' THEN 0 ELSE 1 END, c.filter_key
            """)
            rows = self.db.execute(sql).fetchall()
        weight_sql = text("""
            SELECT implement_phase,
                   ROUND(100 * SUM(weight_factor) / NULLIF((SELECT SUM(weight_factor) FROM activity_summary WHERE implement_phase IS NOT NULL AND implement_phase <> ''), 0), 2)
            FROM activity_summary
            WHERE implement_phase IN ('EN', 'PR', 'CT') AND implement_phase IS NOT NULL AND implement_phase <> ''
            GROUP BY implement_phase
        """)
        weight_map = {r[0]: float(r[1] or 0) for r in self.db.execute(weight_sql).fetchall()}
        result = []
        for r in rows:
            as_of = r[2]
            if hasattr(as_of, "strftime"):
                as_of = as_of.strftime("%Y-%m-%d")
            plan = round(float(r[3] or 0), 4)
            forecast = round(float(r[4] or 0), 4)
            actual = round(float(r[5] or 0), 4)
            impl = r[1] or None
            item = {
                "filter_key": r[0],
                "implement_phase": impl,
                "as_of_date": as_of,
                "plan": plan,
                "forecast": forecast,
                "actual": actual,
                "variance": round(actual - forecast, 4),
            }
            if impl and impl in weight_map:
                item["weight_pct"] = weight_map[impl]
            result.append(item)
        return result

    def get_s_curve_phases_summary(self) -> List[dict]:
        """
        contract_phase（GCC 表）截止今日的 Plan / Forecast / Actual / Variance + Weight。
        Variance = Actual - Forecast（滞后为负）。供前端 GCC 表（Add1/Add2/Add2.1）展示。
        """
        sql = text("""
            SELECT c.filter_key, c.contract_phase, c.date,
                   c.cum_plan_wf, c.cum_forecast_wf, c.cum_actual_wf
            FROM dashboard_s_curve_cache c
            INNER JOIN (
                SELECT filter_key, MAX(date) AS max_date
                FROM dashboard_s_curve_cache
                WHERE filter_key LIKE 'contract_phase=%%' AND date <= CURDATE()
                GROUP BY filter_key
            ) t ON c.filter_key = t.filter_key AND c.date = t.max_date
            ORDER BY c.contract_phase
        """)
        rows = self.db.execute(sql).fetchall()
        if not rows:
            sql = text("""
                SELECT c.filter_key, c.contract_phase, c.date,
                       c.cum_plan_wf, c.cum_forecast_wf, c.cum_actual_wf
                FROM dashboard_s_curve_cache c
                INNER JOIN (
                    SELECT filter_key, MAX(date) AS max_date
                    FROM dashboard_s_curve_cache
                    WHERE filter_key LIKE 'contract_phase=%%'
                    GROUP BY filter_key
                ) t ON c.filter_key = t.filter_key AND c.date = t.max_date
                ORDER BY c.contract_phase
            """)
            rows = self.db.execute(sql).fetchall()
        weight_sql = text("""
            SELECT contract_phase,
                   ROUND(100 * SUM(weight_factor) / NULLIF((SELECT SUM(weight_factor) FROM activity_summary WHERE contract_phase IS NOT NULL AND contract_phase <> ''), 0), 2)
            FROM activity_summary
            WHERE contract_phase IS NOT NULL AND contract_phase <> ''
            GROUP BY contract_phase
        """)
        weight_map = {r[0]: float(r[1] or 0) for r in self.db.execute(weight_sql).fetchall()}
        result = []
        for r in rows:
            plan = round(float(r[3] or 0), 4)
            forecast = round(float(r[4] or 0), 4)
            actual = round(float(r[5] or 0), 4)
            gcc_name = r[1] or ""
            result.append({
                "gcc_name": gcc_name,
                "gcc_display": _gcc_display_name(gcc_name),
                "weight_pct": weight_map.get(gcc_name, 0),
                "plan": plan,
                "forecast": forecast,
                "actual": actual,
                "variance": round(actual - forecast, 4),
            })
        return result

    # 开工基准日，用于计算“已开工”天数
    PROJECT_START_DATE = date(2020, 4, 30)

    def get_home_stats(self) -> dict:
        """
        首页概览：已开工天数（从 2020-4-30 起）、累计进度（progress curve 全局 actual）。
        """
        today = date.today()
        started_days = (today - self.PROJECT_START_DATE).days
        started_days = max(0, started_days)

        summary = self.get_s_curve_summary()
        global_row = next((r for r in summary if r.get("filter_key") == ""), None)
        cumulative_progress = float(global_row.get("actual", 0) or 0) if global_row else 0.0

        return {
            "started_days": started_days,
            "cumulative_progress": round(cumulative_progress, 2),
        }

    def get_ddd_stats(self) -> dict:
        """
        DDD 数量：只读 ddd_stats_cache（1 行），不扫 ext_eng_db_current。
        缓存由 MDR 同步完成后刷新；表不存在或未刷新时返回全 0。
        """
        try:
            row = self.db.execute(text("""
                SELECT total, ifr, ifc, ifc_a, mac_total, mac_ifc_a, kisto_total, kisto_ifc_a
                FROM ddd_stats_cache WHERE id = 1
            """)).fetchone()
            if not row:
                return _empty_ddd_stats()
            return {
                "total": row[0] or 0,
                "ifr": row[1] or 0,
                "ifc": row[2] or 0,
                "ifc_a": row[3] or 0,
                "mac_total": row[4] or 0,
                "mac_ifc_a": row[5] or 0,
                "kisto_total": row[6] or 0,
                "kisto_ifc_a": row[7] or 0,
            }
        except Exception as e:
            logger.debug(f"get_ddd_stats read cache failed: {e}")
            return _empty_ddd_stats()

    def get_key_milestones(self) -> List[dict]:
        """
        关键里程碑列表。表 key_milestones 存在且有数据时返回；否则返回空列表（前端可继续使用写死数据）。
        """
        try:
            rows = self.db.execute(text("""
                SELECT year, month, label, status
                FROM key_milestones
                ORDER BY sort_order ASC, id ASC
            """)).fetchall()
            return [
                {"year": r[0] or "", "month": r[1] or "", "label": r[2] or "", "status": r[3] or "future"}
                for r in rows
            ]
        except Exception as e:
            logger.debug(f"key_milestones not available: {e}")
            return []

    def refresh_s_curve_cache(
        self,
        filters: Optional[dict] = None,
        log_progress: bool = True,
        use_load_data: bool = False,
    ) -> int:
        """
        分步聚合刷新 S 曲线缓存。
        针对 1400 万级 atcompletion_db 进行极端优化：全局模式下跳过 JOIN，过滤模式下强制连接顺序。
        """
        def _log(msg: str) -> None:
            if log_progress:
                logger.info(msg)
                print(msg, flush=True)

        fk = build_filter_key(filters) if filters else ""
        # 始终带上维度列：有筛选时写入具体值，全局时写入 None（表内维度信息完整）
        dim_cols = filters_to_cache_columns(filters)
        is_global = not filters  # 是否是全局刷新
        dim_summary = "全局" if is_global else ", ".join(f"{k}={v}" for k, v in dim_cols.items() if v)

        act_where_raw = build_act_where_sql(filters, base="contract")
        act_where_impl_raw = build_act_where_sql(filters, base="implement")
        act_where_a = act_where_with_alias(act_where_raw, "a")
        act_where_impl_a = act_where_with_alias(act_where_impl_raw, "a")
        
        try:
            _log(f"开始刷新 S 曲线缓存 [filter_key='{fk}'] 维度: {dim_summary}")

            # 1. 计算常量分母
            _log("  [1/6] 正在计算分母常量...")
            consts_sql = f"SELECT GREATEST(COALESCE(SUM(calculated_mhrs), 0), 1), COALESCE(SUM(CASE WHEN implement_phase = 'CT' AND contract_phase = 'Add.3' THEN weight_factor ELSE 0 END), 0), GREATEST(COALESCE(SUM(weight_factor), 0), 1) FROM activity_summary WHERE {act_where_raw}"
            res_consts = self.db.execute(text(consts_sql)).fetchone()
            t_mh, t_wf, t_wfi = float(res_consts[0]), float(res_consts[1]), float(res_consts[2])

            # 优化：如果是全局模式，分母总计不需要 JOIN
            if is_global:
                t_budget = float(self.db.execute(text("SELECT COALESCE(SUM(budgeted_units), 0) FROM budgeted_db WHERE resource_id = 'GCC_WF'")).scalar() or 1.0)
                t_ac = float(self.db.execute(text("SELECT COALESCE(SUM(atcompletion_units), 0) FROM atcompletion_db WHERE resource_id = 'GCC_WF'")).scalar() or 1.0)
            else:
                budget_total_sql = f"SELECT COALESCE(SUM(b.budgeted_units), 0) FROM budgeted_db b INNER JOIN activity_summary a ON b.activity_id = a.activity_id WHERE b.resource_id = 'GCC_WF' AND {act_where_impl_a}"
                t_budget = float(self.db.execute(text(budget_total_sql)).scalar() or 1.0)
                ac_total_sql = f"SELECT COALESCE(SUM(ac.atcompletion_units), 0) FROM atcompletion_db ac INNER JOIN activity_summary a ON ac.activity_id = a.activity_id WHERE ac.resource_id = 'GCC_WF' AND {act_where_impl_a}"
                t_ac = float(self.db.execute(text(ac_total_sql)).scalar() or 1.0)
            
            _log(f"    分母计算完成: Budget={t_budget}, AC={t_ac}, MH={t_mh}")

            # 2. 抓取每日聚合数据 (核心优化点：针对全局模式优化)
            _log("  [2/6] 正在聚合 Budget 每日数据...")
            if is_global:
                sql_p = "SELECT date, SUM(budgeted_units) FROM budgeted_db WHERE resource_id = 'GCC_WF' GROUP BY date"
            else:
                sql_p = f"SELECT b.date, SUM(b.budgeted_units) FROM activity_summary a STRAIGHT_JOIN budgeted_db b ON a.activity_id = b.activity_id WHERE b.resource_id = 'GCC_WF' AND {act_where_a} GROUP BY b.date"
            daily_plan = {r[0]: float(r[1]) for r in self.db.execute(text(sql_p)) if r[0]}

            _log("  [3/6] 正在聚合 Forecast 每日数据...")
            if is_global:
                sql_f = "SELECT date, SUM(atcompletion_units) FROM atcompletion_db WHERE resource_id = 'GCC_WF' GROUP BY date"
            else:
                sql_f = f"SELECT ac.date, SUM(ac.atcompletion_units) FROM activity_summary a STRAIGHT_JOIN atcompletion_db ac ON a.activity_id = ac.activity_id WHERE ac.resource_id = 'GCC_WF' AND {act_where_a} GROUP BY ac.date"
            daily_forecast = {r[0]: float(r[1]) for r in self.db.execute(text(sql_f)) if r[0]}

            _log("  [4/6] 正在聚合 Progress 数据...")
            sql_v = f"SELECT v.date, SUM(v.achieved / NULLIF(r.norms, 0) * 10) FROM activity_summary a STRAIGHT_JOIN vfactdb v ON a.activity_id = v.activity_id INNER JOIN (SELECT work_package, MIN(norms) as norms FROM rsc_defines WHERE norms > 0 GROUP BY work_package) r ON a.work_package = r.work_package WHERE {act_where_a} GROUP BY v.date"
            daily_mh_val = {r[0]: float(r[1]) for r in self.db.execute(text(sql_v)) if r[0]}

            sql_o = f"SELECT o.date, SUM(o.actual_units) FROM activity_summary a STRAIGHT_JOIN owf_db o ON a.activity_id = o.activity_id WHERE {act_where_a} GROUP BY o.date"
            daily_owf = {r[0]: float(r[1]) for r in self.db.execute(text(sql_o)) if r[0]}

            # 3. 归并计算
            _log("  [5/6] 正在计算累计百分比...")
            all_dates = sorted(set(daily_plan) | set(daily_forecast) | set(daily_mh_val) | set(daily_owf))
            if not all_dates:
                _log("! 未找到任何数据，跳过写入。")
                return 0

            cum_p = cum_f = cum_a_val = 0.0
            to_insert = []
            for d in all_dates:
                cum_p += daily_plan.get(d, 0)
                cum_f += daily_forecast.get(d, 0)
                daily_actual_val = (daily_mh_val.get(d, 0) / t_mh) * t_wf + daily_owf.get(d, 0)
                cum_a_val += daily_actual_val
                
                to_insert.append({
                    "filter_key": fk, "date": d,
                    "cum_plan_wf": round((cum_p / t_budget) * 100, 4),
                    "cum_actual_wf": round((cum_a_val / t_wfi) * 100, 4),
                    "cum_forecast_wf": round((cum_f / t_ac) * 100, 4),
                    **dim_cols
                })

            # 4. 写入缓存
            _log(f"  [6/6] 正在写入缓存表 ({len(to_insert)} 行)...")
            self.db.execute(text("DELETE FROM dashboard_s_curve_cache WHERE filter_key = :fk"), {"fk": fk})
            self.db.bulk_insert_mappings(SCurveCache, to_insert)
            self.db.commit()
            
            _log(f"✓ S 曲线缓存刷新完成: {len(to_insert)} 行")
            return len(to_insert)

        except Exception as e:
            self.db.rollback()
            logger.exception(f"refresh_s_curve_cache 失败: {e}")
            raise

    def refresh_s_curve_cache_by_dimension(
        self, dimension_column: str, log_progress: bool = True
    ) -> int:
        """
        按单维度批量刷新：对该维度每个取值只扫一次 budgeted/atcompletion/vfact/owf，
        写入该维度下所有 slice，带维度信息。用于全量刷新时控制在约半小时内。
        dimension_column 必须是 DIMENSION_COLUMNS_FOR_REFRESH 之一。
        """
        if dimension_column not in DIMENSION_COLUMNS_FOR_REFRESH:
            raise ValueError(f"dimension_column 必须是 {DIMENSION_COLUMNS_FOR_REFRESH} 之一")
        # MySQL 保留字用反引号
        dc = f"`{dimension_column}`" if dimension_column == "type" else dimension_column
        dc_a = f"a.{dc}" if dimension_column == "type" else f"a.{dimension_column}"

        def _log(msg: str) -> None:
            if log_progress:
                logger.info(msg)
                print(msg, flush=True)

        try:
            _log(f"  按维度 [{dimension_column}] 批量扫描...")
            # 1) 该维度下所有取值
            distinct = self.db.execute(text(f"""
                SELECT DISTINCT {dc_a} FROM activity_summary a
                WHERE a.contract_phase IS NOT NULL AND a.contract_phase <> ''
                  AND {dc_a} IS NOT NULL AND {dc_a} <> ''
                ORDER BY {dc_a}
            """)).fetchall()
            values = [r[0] for r in distinct if r[0]]
            if not values:
                _log(f"    无有效取值，跳过")
                return 0

            base_where = "a.contract_phase IS NOT NULL AND a.contract_phase <> ''"
            impl_where = "a.implement_phase IS NOT NULL AND a.implement_phase <> ''"

            # 2) 分母：按维度取值 GROUP BY（activity_summary）
            consts_sql = text(f"""
                SELECT {dc_a},
                    GREATEST(COALESCE(SUM(a.calculated_mhrs), 0), 1),
                    COALESCE(SUM(CASE WHEN a.implement_phase = 'CT' AND a.contract_phase = 'Add.3' THEN a.weight_factor ELSE 0 END), 0),
                    GREATEST(COALESCE(SUM(a.weight_factor), 0), 1)
                FROM activity_summary a
                WHERE {base_where} AND {dc_a} IS NOT NULL AND {dc_a} <> ''
                GROUP BY {dc_a}
            """)
            consts = {r[0]: (float(r[1]), float(r[2]), float(r[3])) for r in self.db.execute(consts_sql)}

            # 3) Budget/AC 总分母：按维度取值（JOIN 大表各一次）
            budget_tot_sql = text(f"""
                SELECT {dc_a}, COALESCE(SUM(b.budgeted_units), 0)
                FROM activity_summary a INNER JOIN budgeted_db b ON a.activity_id = b.activity_id
                WHERE b.resource_id = 'GCC_WF' AND {impl_where} AND {dc_a} IS NOT NULL AND {dc_a} <> ''
                GROUP BY {dc_a}
            """)
            ac_tot_sql = text(f"""
                SELECT {dc_a}, COALESCE(SUM(ac.atcompletion_units), 0)
                FROM activity_summary a INNER JOIN atcompletion_db ac ON a.activity_id = ac.activity_id
                WHERE ac.resource_id = 'GCC_WF' AND {impl_where} AND {dc_a} IS NOT NULL AND {dc_a} <> ''
                GROUP BY {dc_a}
            """)
            t_budget = {r[0]: float(r[1]) for r in self.db.execute(budget_tot_sql)}
            t_ac = {r[0]: float(r[1]) for r in self.db.execute(ac_tot_sql)}

            # 4) 每日数据：按 (date, 维度取值) 一次扫
            plan_sql = text(f"""
                SELECT b.date, {dc_a}, SUM(b.budgeted_units)
                FROM activity_summary a INNER JOIN budgeted_db b ON a.activity_id = b.activity_id
                WHERE b.resource_id = 'GCC_WF' AND {dc_a} IS NOT NULL AND {dc_a} <> ''
                GROUP BY b.date, {dc_a}
            """)
            fcast_sql = text(f"""
                SELECT ac.date, {dc_a}, SUM(ac.atcompletion_units)
                FROM activity_summary a INNER JOIN atcompletion_db ac ON a.activity_id = ac.activity_id
                WHERE ac.resource_id = 'GCC_WF' AND {dc_a} IS NOT NULL AND {dc_a} <> ''
                GROUP BY ac.date, {dc_a}
            """)
            daily_plan: dict = {}
            daily_forecast: dict = {}
            for r in self.db.execute(plan_sql):
                if r[0] and r[1]:
                    daily_plan.setdefault(r[1], {})[r[0]] = float(r[2])
            for r in self.db.execute(fcast_sql):
                if r[0] and r[1]:
                    daily_forecast.setdefault(r[1], {})[r[0]] = float(r[2])

            # 5) Progress 每日：vfact + owf，按 (date, 维度)
            v_sql = text(f"""
                SELECT v.date, {dc_a}, SUM(v.achieved / NULLIF(r.norms, 0) * 10)
                FROM activity_summary a
                STRAIGHT_JOIN vfactdb v ON a.activity_id = v.activity_id
                INNER JOIN (SELECT work_package, MIN(norms) as norms FROM rsc_defines WHERE norms > 0 GROUP BY work_package) r ON a.work_package = r.work_package
                WHERE {base_where} AND {dc_a} IS NOT NULL AND {dc_a} <> ''
                GROUP BY v.date, {dc_a}
            """)
            o_sql = text(f"""
                SELECT o.date, {dc_a}, SUM(o.actual_units)
                FROM activity_summary a STRAIGHT_JOIN owf_db o ON a.activity_id = o.activity_id
                WHERE {base_where} AND {dc_a} IS NOT NULL AND {dc_a} <> ''
                GROUP BY o.date, {dc_a}
            """)
            daily_mh: dict = {}
            daily_owf: dict = {}
            for r in self.db.execute(v_sql):
                if r[0] and r[1]:
                    daily_mh.setdefault(r[1], {})[r[0]] = float(r[2])
            for r in self.db.execute(o_sql):
                if r[0] and r[1]:
                    daily_owf.setdefault(r[1], {})[r[0]] = float(r[2])

            # 6) 按每个维度取值拼累计序列并写入
            to_delete_fks = [build_filter_key({dimension_column: v}) for v in values]
            for fk in to_delete_fks:
                self.db.execute(text("DELETE FROM dashboard_s_curve_cache WHERE filter_key = :fk"), {"fk": fk})
            inserted = 0
            for val in values:
                t_mh, t_wf, t_wfi = consts.get(val, (1.0, 0.0, 1.0))
                t_b = t_budget.get(val, 1.0) or 1.0
                t_a = t_ac.get(val, 1.0) or 1.0
                dp = daily_plan.get(val, {})
                df = daily_forecast.get(val, {})
                dm = daily_mh.get(val, {})
                do = daily_owf.get(val, {})
                all_dates = sorted(set(dp) | set(df) | set(dm) | set(do))
                if not all_dates:
                    continue
                dim_cols = filters_to_cache_columns({dimension_column: val})
                cum_p = cum_f = cum_a_val = 0.0
                to_insert = []
                for d in all_dates:
                    cum_p += dp.get(d, 0)
                    cum_f += df.get(d, 0)
                    daily_actual_val = (dm.get(d, 0) / t_mh) * t_wf + do.get(d, 0)
                    cum_a_val += daily_actual_val
                    to_insert.append({
                        "filter_key": build_filter_key({dimension_column: val}),
                        "date": d,
                        "cum_plan_wf": round((cum_p / t_b) * 100, 4),
                        "cum_actual_wf": round((cum_a_val / t_wfi) * 100, 4),
                        "cum_forecast_wf": round((cum_f / t_a) * 100, 4),
                        **dim_cols,
                    })
                self.db.bulk_insert_mappings(SCurveCache, to_insert)
                inserted += len(to_insert)
            self.db.commit()
            _log(f"    [{dimension_column}] 写入 {len(values)} 个 slice, 共 {inserted} 行")
            return inserted
        except Exception as e:
            self.db.rollback()
            logger.exception(f"refresh_s_curve_cache_by_dimension({dimension_column}) 失败: {e}")
            raise

    def refresh_s_curve_cache_all(self, log_progress: bool = True) -> int:
        """
        全量刷新：先刷新全局，再按「每维度批量扫表」刷新所有维度列（表内字段全覆盖），
        大表每维度只扫一次，总耗时约半小时级别。
        """
        total = 0
        if log_progress:
            logger.info("全量刷新 S 曲线缓存: 全局 + 按维度批量（每维度扫一次大表）")
            print("全量刷新 S 曲线缓存: 全局 + 按维度批量（每维度扫一次大表）", flush=True)

        _log = (lambda msg: (logger.info(msg), print(msg, flush=True))) if log_progress else (lambda msg: None)

        _log("\n--- [1/2] 全局 ---")
        total += self.refresh_s_curve_cache(filters=None, log_progress=log_progress)

        n_dims = len(DIMENSION_COLUMNS_FOR_REFRESH)
        for i, dim in enumerate(DIMENSION_COLUMNS_FOR_REFRESH):
            if log_progress:
                print(f"\n--- [2/2] 维度 ({i + 1}/{n_dims}) {dim} ---", flush=True)
            total += self.refresh_s_curve_cache_by_dimension(dim, log_progress=log_progress)

        if log_progress:
            print(f"\n✓ S 曲线缓存全量刷新完成: 共 {total} 行", flush=True)
        return total

    def get_progress_realtime(self, filters: Optional[dict], as_of_date: date) -> Optional[Dict[str, Any]]:
        """
        按任意维度组合实时聚合进度（不写缓存）。6 条大表查询并行执行。
        有过滤时用 Barrier 做两阶段：先让 6 连接都完成「临时表+从 activity_summary 插入」，再一起查大表，避免死锁。
        """
        filters = filters or {}
        act_where_raw = build_act_where_sql(filters, base="contract")
        act_where_a = act_where_with_alias(act_where_raw, "a")
        is_global = not filters
        barrier = threading.Barrier(6) if not is_global else None

        try:
            consts_sql = f"SELECT GREATEST(COALESCE(SUM(calculated_mhrs), 0), 1), COALESCE(SUM(CASE WHEN implement_phase = 'CT' AND contract_phase = 'Add.3' THEN weight_factor ELSE 0 END), 0), GREATEST(COALESCE(SUM(weight_factor), 0), 1) FROM activity_summary WHERE {act_where_raw}"
            res_consts = self.db.execute(text(consts_sql)).fetchone()
            t_mh, t_wf, t_wfi = float(res_consts[0]), float(res_consts[1]), float(res_consts[2])

            results_by_id = {}
            with ThreadPoolExecutor(max_workers=6) as executor:
                futures = {
                    executor.submit(_run_one_progress_query_worker, i, act_where_raw, act_where_a, is_global, barrier): i
                    for i in range(6)
                }
                for fut in as_completed(futures):
                    qid, value = fut.result()
                    results_by_id[qid] = value

            t_budget = results_by_id.get(0, 1.0)
            t_ac = results_by_id.get(1, 1.0)
            daily_plan = results_by_id.get(2) or {}
            daily_forecast = results_by_id.get(3) or {}
            daily_mh_val = results_by_id.get(4) or {}
            daily_owf = results_by_id.get(5) or {}

            all_dates = sorted(set(daily_plan) | set(daily_forecast) | set(daily_mh_val) | set(daily_owf))
            all_dates = [d for d in all_dates if d <= as_of_date]
            if not all_dates:
                return None
            cum_p = cum_f = cum_a_val = 0.0
            for d in all_dates:
                cum_p += daily_plan.get(d, 0)
                cum_f += daily_forecast.get(d, 0)
                daily_actual_val = (daily_mh_val.get(d, 0) / t_mh) * t_wf + daily_owf.get(d, 0)
                cum_a_val += daily_actual_val
            return {
                "date": all_dates[-1],
                "cum_plan_wf": round((cum_p / t_budget) * 100, 4),
                "cum_forecast_wf": round((cum_f / t_ac) * 100, 4),
                "cum_actual_wf": round((cum_a_val / t_wfi) * 100, 4),
            }
        except Exception as e:
            logger.exception("get_progress_realtime 失败: %s", e)
            return None

    def get_progress_period_realtime(self, filters: Optional[dict], d_start: date, d_end: date) -> Optional[Dict[str, Any]]:
        """按任意维度组合实时聚合进度增量（不写缓存）。返回 d_start～d_end 的 delta plan/forecast/actual。"""
        row_start = self.get_progress_realtime(filters, d_start - timedelta(days=1)) if d_start else None
        row_end = self.get_progress_realtime(filters, d_end) if d_end else None
        if not row_end:
            return None
        plan_start = float(row_start["cum_plan_wf"]) if row_start else 0.0
        forecast_start = float(row_start["cum_forecast_wf"]) if row_start else 0.0
        actual_start = float(row_start["cum_actual_wf"]) if row_start else 0.0
        return {
            "delta_plan_wf": round(float(row_end["cum_plan_wf"]) - plan_start, 4),
            "delta_forecast_wf": round(float(row_end["cum_forecast_wf"]) - forecast_start, 4),
            "delta_actual_wf": round(float(row_end["cum_actual_wf"]) - actual_start, 4),
        }


def _empty_ddd_stats() -> dict:
    return {
        "total": 0, "ifr": 0, "ifc": 0, "ifc_a": 0,
        "mac_total": 0, "mac_ifc_a": 0, "kisto_total": 0, "kisto_ifc_a": 0,
    }


def _ddd_aggregation_sql() -> str:
    """单次扫描 ext_eng_db_current 的聚合 SQL，供 MDR 同步刷新缓存用。"""
    return """
        SELECT
          COUNT(DISTINCT document_number) AS total,
          COUNT(DISTINCT CASE
            WHEN type_of_document = 'IFR'
             AND type_of_dates = 'First Issued for Review IFR. Actual'
             AND dates IS NOT NULL
            THEN document_number END) AS ifr,
          COUNT(DISTINCT CASE
            WHEN type_of_document = 'IFC'
             AND (type_of_dates = 'Date of Document with issue purpose IFH, IFD, IFP, IFU, IFC, IFI. Actual'
                  OR type_of_dates = 'Date of Document with issue purpose  IFH, IFD, IFP, IFU, IFC, IFI. Actual')
             AND dates IS NOT NULL
            THEN document_number END) AS ifc,
          COUNT(DISTINCT CASE
            WHEN type_of_document = 'AFC'
             AND type_of_dates = 'Review date of Customer LET IFH, IFD, IFP, IFU, IFC'
             AND dates IS NOT NULL AND review_code = 'A'
            THEN document_number END) AS ifc_a,
          COUNT(DISTINCT CASE WHEN package IS NOT NULL AND package LIKE '%MAC%' THEN document_number END) AS mac_total,
          COUNT(DISTINCT CASE
            WHEN package IS NOT NULL AND package LIKE '%MAC%'
             AND type_of_document = 'AFC'
             AND type_of_dates = 'Review date of Customer LET IFH, IFD, IFP, IFU, IFC'
             AND dates IS NOT NULL AND review_code = 'A'
            THEN document_number END) AS mac_ifc_a,
          COUNT(DISTINCT CASE WHEN package = 'KITSO' THEN document_number END) AS kisto_total,
          COUNT(DISTINCT CASE
            WHEN package = 'KITSO'
             AND type_of_document = 'AFC'
             AND type_of_dates = 'Review date of Customer LET IFH, IFD, IFP, IFU, IFC'
             AND dates IS NOT NULL AND review_code = 'A'
            THEN document_number END) AS kisto_ifc_a
        FROM ext_eng_db_current
        WHERE (dwg_status IS NULL OR (dwg_status <> 'CANCELLED' AND dwg_status <> 'SUPERSEDED'))
          AND document_number IS NOT NULL AND document_number <> ''
    """
