-- =============================================================================
-- S 曲线缓存验证与测试 SQL（dashboard_s_curve_cache）
-- 1. 曲线正确性：抽样看单调性、数值范围
-- 2. 全局 Plan / Forecast / Actual（截止某日或最新一日）
-- 3. EN / PR / CT 的 Plan / Forecast / Actual
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 曲线正确性：全局曲线抽样（按日期有序，cum_* 应单调递增）
-- -----------------------------------------------------------------------------
SELECT
    date,
    cum_plan_wf   AS plan_pct,
    cum_actual_wf AS actual_pct,
    cum_forecast_wf AS forecast_pct
FROM dashboard_s_curve_cache
WHERE filter_key = ''
ORDER BY date
LIMIT 50;

-- 可选：看最后几条，确认曲线收尾
SELECT
    date,
    cum_plan_wf   AS plan_pct,
    cum_actual_wf AS actual_pct,
    cum_forecast_wf AS forecast_pct
FROM dashboard_s_curve_cache
WHERE filter_key = ''
ORDER BY date DESC
LIMIT 20;


-- -----------------------------------------------------------------------------
-- 2. 全局 Plan / Forecast / Actual（截止今日的累计百分比）
--    取每个 filter_key 下 date <= 今日 的最近一条记录
-- -----------------------------------------------------------------------------
-- 2a. 仅全局（filter_key = ''）
SELECT
    filter_key,
    date          AS as_of_date,
    cum_plan_wf   AS plan,
    cum_forecast_wf AS forecast,
    cum_actual_wf AS actual
FROM dashboard_s_curve_cache c
WHERE filter_key = ''
  AND date = (
    SELECT MAX(date)
    FROM dashboard_s_curve_cache
    WHERE filter_key = ''
      AND date <= CURDATE()
  );

-- 2b. 若今日无数据，用全表该 filter_key 的最大 date（“最新一日”）
SELECT
    c.filter_key,
    c.date        AS as_of_date,
    c.cum_plan_wf AS plan,
    c.cum_forecast_wf AS forecast,
    c.cum_actual_wf AS actual
FROM dashboard_s_curve_cache c
INNER JOIN (
    SELECT filter_key, MAX(date) AS max_date
    FROM dashboard_s_curve_cache
    WHERE filter_key = ''
    GROUP BY filter_key
) t ON c.filter_key = t.filter_key AND c.date = t.max_date;


-- -----------------------------------------------------------------------------
-- 3. EN / PR / CT 的 Plan / Forecast / Actual / Variance（截止今日或最新一日，Variance = Actual - Forecast（滞后为负））
-- -----------------------------------------------------------------------------
SELECT
    c.filter_key,
    c.implement_phase,
    c.date            AS as_of_date,
    c.cum_plan_wf     AS plan,
    c.cum_forecast_wf AS forecast,
    c.cum_actual_wf   AS actual,
    ROUND(c.cum_actual_wf - c.cum_forecast_wf, 4) AS variance
FROM dashboard_s_curve_cache c
INNER JOIN (
    SELECT filter_key, MAX(date) AS max_date
    FROM dashboard_s_curve_cache
    WHERE filter_key IN ('implement_phase=EN', 'implement_phase=PR', 'implement_phase=CT')
      AND date <= CURDATE()
    GROUP BY filter_key
) t ON c.filter_key = t.filter_key AND c.date = t.max_date
ORDER BY c.filter_key;

-- 若上面无结果，用“该 filter_key 全表最大 date”
SELECT
    c.filter_key,
    c.implement_phase,
    c.date            AS as_of_date,
    c.cum_plan_wf     AS plan,
    c.cum_forecast_wf AS forecast,
    c.cum_actual_wf   AS actual,
    ROUND(c.cum_actual_wf - c.cum_forecast_wf, 4) AS variance
FROM dashboard_s_curve_cache c
INNER JOIN (
    SELECT filter_key, MAX(date) AS max_date
    FROM dashboard_s_curve_cache
    WHERE filter_key IN ('implement_phase=EN', 'implement_phase=PR', 'implement_phase=CT')
    GROUP BY filter_key
) t ON c.filter_key = t.filter_key AND c.date = t.max_date
ORDER BY c.filter_key;


-- -----------------------------------------------------------------------------
-- 4. 一次性：全局 + EN/PR/CT 的 Plan / Forecast / Actual / Variance（统一“截止今日”）
--    Variance = Actual - Forecast（滞后为负）
-- -----------------------------------------------------------------------------
SELECT
    c.filter_key,
    c.implement_phase,
    c.date            AS as_of_date,
    c.cum_plan_wf     AS plan,
    c.cum_forecast_wf AS forecast,
    c.cum_actual_wf   AS actual,
    ROUND(c.cum_actual_wf - c.cum_forecast_wf, 4) AS variance
FROM dashboard_s_curve_cache c
INNER JOIN (
    SELECT filter_key, MAX(date) AS max_date
    FROM dashboard_s_curve_cache
    WHERE filter_key IN ('', 'implement_phase=EN', 'implement_phase=PR', 'implement_phase=CT')
      AND date <= CURDATE()
    GROUP BY filter_key
) t ON c.filter_key = t.filter_key AND c.date = t.max_date
ORDER BY CASE WHEN c.filter_key = '' THEN 0 ELSE 1 END, c.filter_key;


-- -----------------------------------------------------------------------------
-- 5. 曲线抽样：EN / PR / CT 各取前 20 条（验证按 phase 的曲线形状）
-- -----------------------------------------------------------------------------
SELECT
    filter_key,
    implement_phase,
    date,
    cum_plan_wf   AS plan_pct,
    cum_actual_wf AS actual_pct,
    cum_forecast_wf AS forecast_pct
FROM dashboard_s_curve_cache
WHERE filter_key IN ('implement_phase=EN', 'implement_phase=PR', 'implement_phase=CT')
ORDER BY filter_key, date
LIMIT 60;


-- =============================================================================
-- 6. 上一表（E/P/C = EN/PR/CT）：Plan / Forecast / Actual / Variance（Variance = Actual - Forecast（滞后为负））
-- =============================================================================
SELECT
    c.filter_key,
    c.implement_phase AS gcc_name,
    c.date            AS as_of_date,
    c.cum_plan_wf     AS plan,
    c.cum_forecast_wf AS forecast,
    c.cum_actual_wf   AS actual,
    ROUND(c.cum_actual_wf - c.cum_forecast_wf, 4) AS variance
FROM dashboard_s_curve_cache c
INNER JOIN (
    SELECT filter_key, MAX(date) AS max_date
    FROM dashboard_s_curve_cache
    WHERE filter_key IN ('implement_phase=EN', 'implement_phase=PR', 'implement_phase=CT')
      AND date <= CURDATE()
    GROUP BY filter_key
) t ON c.filter_key = t.filter_key AND c.date = t.max_date
ORDER BY c.filter_key;


-- =============================================================================
-- 7. GCC 表（Add1 / Add2 / Add2.1）：Plan / Forecast / Actual / Variance（Variance = Actual - Forecast（滞后为负））
-- =============================================================================

-- 7a. 所有 contract_phase 切片：截止今日的 Plan、Forecast、Actual、Variance（来自缓存）
SELECT
    c.filter_key,
    c.contract_phase  AS gcc_name,
    c.date            AS as_of_date,
    c.cum_plan_wf     AS plan,
    c.cum_forecast_wf AS forecast,
    c.cum_actual_wf   AS actual,
    ROUND(c.cum_actual_wf - c.cum_forecast_wf, 4) AS variance
FROM dashboard_s_curve_cache c
INNER JOIN (
    SELECT filter_key, MAX(date) AS max_date
    FROM dashboard_s_curve_cache
    WHERE filter_key LIKE 'contract_phase=%'
      AND date <= CURDATE()
    GROUP BY filter_key
) t ON c.filter_key = t.filter_key AND c.date = t.max_date
ORDER BY c.contract_phase;

-- 若上面无数据（无 date<=今天），用各 slice 全表最大 date：
SELECT
    c.filter_key,
    c.contract_phase  AS gcc_name,
    c.date            AS as_of_date,
    c.cum_plan_wf     AS plan,
    c.cum_forecast_wf AS forecast,
    c.cum_actual_wf   AS actual,
    ROUND(c.cum_actual_wf - c.cum_forecast_wf, 4) AS variance
FROM dashboard_s_curve_cache c
INNER JOIN (
    SELECT filter_key, MAX(date) AS max_date
    FROM dashboard_s_curve_cache
    WHERE filter_key LIKE 'contract_phase=%'
    GROUP BY filter_key
) t ON c.filter_key = t.filter_key AND c.date = t.max_date
ORDER BY c.contract_phase;


-- 7b. Weight：按 contract_phase 的权重占比（来自 activity_summary.weight_factor）
SELECT
    contract_phase AS gcc_name,
    ROUND(SUM(weight_factor), 4) AS total_weight_factor,
    ROUND(100 * SUM(weight_factor) / NULLIF((SELECT SUM(weight_factor) FROM activity_summary WHERE contract_phase IS NOT NULL AND contract_phase <> ''), 0), 2) AS weight_pct
FROM activity_summary
WHERE contract_phase IS NOT NULL AND contract_phase <> ''
GROUP BY contract_phase
ORDER BY contract_phase;


-- 7c. 合并：GCC 表应有的一行（Plan/Forecast/Actual/Variance 来自缓存，Weight 来自 activity_summary）
SELECT
    a.gcc_name,
    CONCAT(a.weight_pct, '%') AS weight,
    CONCAT(ROUND(b.plan, 2), '%') AS plan,
    CONCAT(ROUND(b.forecast, 2), '%') AS forecast,
    CONCAT(ROUND(b.actual, 2), '%') AS actual,
    CONCAT(ROUND(b.variance, 2), '%') AS variance
FROM (
    SELECT
        contract_phase AS gcc_name,
        ROUND(100 * SUM(weight_factor) / NULLIF((SELECT SUM(weight_factor) FROM activity_summary WHERE contract_phase IS NOT NULL AND contract_phase <> ''), 0), 2) AS weight_pct
    FROM activity_summary
    WHERE contract_phase IS NOT NULL AND contract_phase <> ''
    GROUP BY contract_phase
) a
LEFT JOIN (
    SELECT
        c.contract_phase AS gcc_name,
        c.cum_plan_wf AS plan,
        c.cum_forecast_wf AS forecast,
        c.cum_actual_wf AS actual,
        ROUND(c.cum_actual_wf - c.cum_forecast_wf, 4) AS variance
    FROM dashboard_s_curve_cache c
    INNER JOIN (
        SELECT filter_key, MAX(date) AS max_date
        FROM dashboard_s_curve_cache
        WHERE filter_key LIKE 'contract_phase=%' AND date <= CURDATE()
        GROUP BY filter_key
    ) t ON c.filter_key = t.filter_key AND c.date = t.max_date
) b ON a.gcc_name = b.gcc_name
ORDER BY a.gcc_name;
