# 首页：关键里程碑与 DDD 说明

## 关键里程碑清单维护方式

**当前实现**：关键里程碑在**前端写死**（`frontend/src/pages/Dashboard.tsx` 中写死一组合成数据：年份、月份、标签、状态等），无后端数据源。

**可选维护方式**：

1. **脚本/配置导入**
   - 在库中建表（如 `key_milestones`），由定时脚本或一次性脚本从 Excel/CSV/配置文件导入，前端通过 API 读取。
   - 适合：里程碑由计划部门批量维护、更新频率不高。

2. **前端运维界面**
   - 在管理后台增加「关键里程碑」维护页，对同一张表做增删改查，前端首页只读展示。
   - 适合：需要业务人员随时在系统里改里程碑。

若采用**数据库表 + API**，可新增表结构示例：

```sql
-- 可选：关键里程碑表（运维/脚本维护）
CREATE TABLE IF NOT EXISTS key_milestones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  year VARCHAR(8) NOT NULL,
  month VARCHAR(16) NOT NULL,
  label VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL COMMENT 'done|delayed|future',
  sort_order INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

后端提供 `GET /api/dashboard/key-milestones` 返回列表，前端首页将当前写死的数据改为从该 API 拉取即可。

---

## DDD 数量（首页「DDD 数量」卡片）

数据来源：**数据库 `ext_eng_db_current`**（由 MDR 同步从 ENG.ENGDB 同步而来）。

**约定**：所有类型均排除 `dwg_status = 'CANCELLED'` 与 `dwg_status = 'SUPERSEDED'`；`document_number` 非空。

| 指标 | 计算规则 |
|------|----------|
| **Total** | distinct `document_number` |
| **IFR** | distinct `document_number`，且 `type_of_document` = IFR，`type_of_dates` = "First Issued for Review IFR. Actual"，`dates` 不为空 |
| **IFC** | distinct `document_number`，且 `type_of_document` = IFC，`type_of_dates` = "Date of Document with issue purpose IFH, IFD, IFP, IFU, IFC, IFI. Actual"（或双空格版本），`dates` 不为空 |
| **IFC-A** | distinct `document_number`，且 `type_of_document` = AFC，`type_of_dates` = "Review date of Customer LET IFH, IFD, IFP, IFU, IFC"，`dates` 不为空，`review_code` = A |
| **MAC** | 同上排除规则，且 `package IS NOT NULL` 且 `package LIKE '%MAC%'`。展示为 **IFC-A / Total**（即该 package 子集下的 IFC-A 数 / Total 数）。 |
| **KITSO** | 同上排除规则，且 `package = 'KITSO'`（全大写、精确匹配）。展示为 **IFC-A / Total**。 |

接口：`GET /api/dashboard/ddd-stats`，返回 `{ total, ifr, ifc, ifc_a, mac_total, mac_ifc_a, kisto_total, kisto_ifc_a }`。

**性能（约 300 万行 ext_eng_db_current）**：接口**只读缓存表 `ddd_stats_cache`**（单行），不做实时聚合，避免 504。  
- 建表与初始化：执行 `database/ddd_stats_cache.sql`。  
- 缓存刷新：**MDR 同步完成后自动执行**（`_run_ddd_stats_cache`），无需单独调用。  
- 加速刷新（可选）：执行 `database/migrations/add_ext_eng_db_current_ddd_indexes.sql`，为聚合查询加索引以缩短刷新时间。

---

## 首页其他数据来源

- **已开工**：从 **2020-4-30** 起算至当前日期的天数，由 `GET /api/dashboard/home-stats` 的 `started_days` 提供。
- **进度**：来自 **Progress Curves（S 曲线）** 的全局累计进度（截止日 actual），由 `home-stats.cumulative_progress` 或 `GET /api/dashboard/progress/curve/summary` 的全局行 `actual` 提供。
