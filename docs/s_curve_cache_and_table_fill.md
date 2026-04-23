# S 曲线缓存与进度表动态值填回说明

## 1. create_s_curve_cache_table 程序做什么

- **脚本位置**: `backend/scripts/create_s_curve_cache_table.py`
- **作用**:
  - 创建/重建表 `dashboard_s_curve_cache`（主键 `(filter_key, date)`）
  - 表里存的是**按日预聚合的累计百分比**：`cum_plan_wf`、`cum_actual_wf`、`cum_forecast_wf`
  - 支持 GlobalFilter 维度（subproject、train、unit、implement_phase 等），`filter_key=''` 表示**全局**

### 表结构要点

| 列 | 含义 |
|----|------|
| filter_key | 维度组合键，空串 = 全局 |
| date | 日期 |
| cum_plan_wf | 累计计划 WF% |
| cum_actual_wf | 累计实际 WF% |
| cum_forecast_wf | 累计预测 WF% |
| 其他 | subproject, train, unit, ... 等维度列 |

### 常用命令

```bash
# 仅建表+索引
python scripts/create_s_curve_cache_table.py

# 建表 + 首次刷新缓存（建议部署后至少跑一次）
python scripts/create_s_curve_cache_table.py --refresh

# 表结构升级时：先删表再建
python scripts/create_s_curve_cache_table.py --recreate
```

---

## 2. 动态值从哪里来、怎么填进表

**填表逻辑在 `DashboardService.refresh_s_curve_cache()`**（`backend/app/services/dashboard_service.py`），不在建表脚本里。

流程简述：

1. **分母常量**：从 `activity_summary` 算总工时、总 WF 等；从 `budgeted_db`/`atcompletion_db` 算总计划/总预测。
2. **按日聚合**：
   - Plan：`budgeted_db`（resource_id='GCC_WF'）按 date 汇总
   - Forecast：`atcompletion_db`（resource_id='GCC_WF'）按 date 汇总
   - Actual：`vfactdb`（换算成工时）+ `owf_db`（actual_units）按 date 汇总，再按公式折算成 WF
3. **按日累计**：对每个日期做累计和，再除以分母得到**累计百分比**。
4. **写入缓存**：按 `(filter_key, date)` 插入/更新 `dashboard_s_curve_cache`。

因此：**“把动态的值填回这个表” = 执行一次（或定时执行）`refresh_s_curve_cache()`**，数据就会从源表进入 `dashboard_s_curve_cache`。

---

## 3. 界面上“表”的数据从哪里读

前端 **Progress Curves** 卡片里有两个表：

### 3.1 上面一张表（Total：E / P / C / Total 行）

- **接口**: `GET /dashboard/progress/summary` → `get_progress_summary()`
- **Total 行**（Plan / Forecast / Actual / Balance）：
  - **优先**从 S 曲线缓存读：`_get_overall_from_s_curve_cache()` 取 `filter_key=''` 的**最新 2 行**（最新一行给出 cutoff 日期和总计划/总实际/总预测，两行可算 growth）。
  - 若缓存为空，则用 `budgeted_db` / `atcompletion_db` / `vfactdb` / `owf_db` 实时算总体。
- **E / P / C 行**：
  - **不从缓存读**，是 `get_progress_summary()` 里用 `activity_summary` + 上述源表按 `implement_phase`（EN→E, PR→P, CT→C）实时算的 weight、plan、actual、forecast、balance。

### 3.2 曲线图（Plan / Forecast / Actual 三条线）

- **接口**: `GET /dashboard/progress/curve` → `get_s_curve_data(filters)`
- **数据来源**: 直接从 `dashboard_s_curve_cache` 按 `filter_key` 查所有日期行，返回 `date, cum_plan_wf, cum_actual_wf, cum_forecast_wf`。

### 3.3 下面一张表（Phase：Add.1、Add.2(2.1) 等）

- 同样来自 `get_progress_summary()` 的 `phases`，按 `contract_phase` 从源表实时计算，**不读 S 曲线缓存**。

---

## 4. 如何保证“表里有动态值”

1. **确保缓存表存在**  
   运行一次：`python scripts/create_s_curve_cache_table.py`（或 `--recreate` 若改过表结构）。

2. **至少执行一次全局刷新**  
   - 方式一：`python scripts/create_s_curve_cache_table.py --refresh`  
   - 方式二：调用接口 `POST /dashboard/progress/curve/refresh`（后台异步刷新，刷新的是 `filter_key=''` 的全局缓存）

3. **定时刷新（已配置）**  
   - `backend/app/p6_sync/scheduler.py` 里已有“每小时 30 分”执行 `refresh_s_curve_cache()`（不传 filters，即刷新全局）。  
   - 只要调度器在跑，全局缓存会定期更新，曲线和 Total 行的动态值就会跟着更新。

4. **若表格仍为 “—”**  
   - 检查是否曾成功执行过上述刷新（查日志或库里 `dashboard_s_curve_cache` 是否有 `filter_key=''` 的数据）。  
   - 检查 `GET /dashboard/progress/summary` 是否返回错误或 `actual`/`epc` 为空（如无 EN/PR/CT 数据则 E/P/C 可能为空）。  
   - 若为带筛选的曲线/表格，需在刷新时传入对应 filters，或由前端在请求曲线时带 query 参数，后端会按 `filter_key` 读缓存；若该 key 从未刷新，则需扩展刷新逻辑为该 key 也执行一次 `refresh_s_curve_cache(filters)`。

---

## 5. 小结

| 内容 | 数据来源 | 如何有动态值 |
|------|----------|--------------|
| 曲线图 Plan/Forecast/Actual | `dashboard_s_curve_cache` | 执行 `refresh_s_curve_cache()`（全局或带 filters） |
| Total 行 Plan/Forecast/Actual/Balance | 优先 `dashboard_s_curve_cache`（全局最新 2 行） | 同上，保证全局缓存已刷新 |
| E / P / C 行 | 源表实时计算 | 保证 `activity_summary` 及 budgeted/atcompletion/vfact/owf 有数据 |
| Phase 表 | 源表实时计算 | 同上 |

**结论**：理解 `create_s_curve_cache_table` 只是建表；真正“把动态值填回表里”的是 `refresh_s_curve_cache()`。部署后建议执行一次 `--refresh` 或调用刷新接口，并保持调度器运行，表格和曲线就会显示最新动态值。
