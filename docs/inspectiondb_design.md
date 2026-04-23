# inspectiondb 设计说明（验收日报接口）

## 一、定位与策略

- **业务现状**：业务同事目前无法提供每条 RFI 对应的 inspection quantity，但领导希望先打通「验收日报」能力，为后续项目留接口，本项目也可能用上。
- **实现策略**：
  - **volume_control_inspection**：**保持现有更新模式不变**（手工/现有方式维护 rfi_completed_a/b/c），不接收来自 inspectiondb 的同步。
  - **新建 inspectiondb 表**：先打通逻辑链路（建表、日报管理里增加验收日报录入、API 与列表），**quantity 在 inspectiondb 中保留但暂不参与联动**（不往 volume_control_inspection 汇总）。
  - **日报管理**：增加「验收日报」入口，数据写入 inspectiondb，为日后「按 RFI 提供 quantity 并联动汇总」预留接口。

## 二、inspectiondb 表结构（修正版）utf8mb4_unicode_ci

### 2.1 日期与 RFI 标识

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT PK | 主键 |
| rfi_id | VARCHAR | RFI 编号（如 GCC-CC7-UIO-ADD3-WS-RFI-99237） |
| rfi_issue_date | DATE | RFI 发布日期（台账 Issue Date） |
| rfi_inspection_date | DATETIME | 验收日期+时间（台账 Inspection Date + Time） |

### 2.2 与 vfactdb 对齐的维度（可选，便于后续汇总与筛选）

| 字段 | 类型 | 说明 |
|------|------|------|
| activity_id | VARCHAR(100), FK activity_summary | 作业 ID（可为空，验收时未绑作业也可先录） |
| scope | VARCHAR | 范围/材料类别（与 contractor 不重复存储不同含义） |
| project | VARCHAR(50) | 项目（如 CC7） |
| subproject | VARCHAR(50) | 子项目 |
| implement_phase | VARCHAR(50) | 实施阶段 |
| train | VARCHAR(50) | 机组 |
| unit | VARCHAR(50) | 装置（如 UIO, LAO, WH） |
| block | VARCHAR(50) | 区块 |
| quarter | VARCHAR(50) | 季度 |
| main_block | VARCHAR(50) | 主区块 |
| title | TEXT | 标题/图号（如 16400-41） |
| rfi_description | TEXT | RFI/验收简要描述 |
| discipline | VARCHAR(50) | 专业（如 WS, CI, EL） |
| work_package | VARCHAR(50) | 工作包（如 ADD3） |

### 2.3 台账 Type of work → 图纸多选

| 字段 | 类型 | 说明 |
|------|------|------|
| matched_drawing_number | JSON | 对应台账「Type of work」，**1 对多选**。可从 `ext_eng_db_current` 抓取，结构可包含且不限于：`document_number`, `document_title`, `dwg_status`, `document_type`, `calculated_block`, `marka_code`, `discipline`, `facility` 等；允许超出 ext_eng_db_current 的字段以便扩展。示例：`[{"document_number":"xxx","document_title":"yyy"}, ...]` |

### 2.4 验收业务字段（与台账一致）

| 字段 | 类型 | 说明 |
|------|------|------|
| itp_no | VARCHAR | ITP 编号（检验试验计划） |
| inspection_type | VARCHAR | 验收类型（如 ACC） |
| ground_of_works | VARCHAR | 工作依据编码（如 3.1, 4.5）；**该编码用于与 rsc_defines.rfi_a / rfi_b / rfi_c 匹配**，确定本条是否参与 A/B/C 聚合（后续联动时用） |
| inspection_conclusion | TEXT | 验收结论 |
| comments | TEXT | 评论 |
| fixing_problems_details | TEXT | 问题整改说明（fixing problems） |
| verification_date | DATE | 验证日期 |
| qc_inspector | VARCHAR | 质检员（QC Inspector） |
| contractor | VARCHAR | 承包商（如 C15, C7）；与 scope 不重复（分别存储） |
| note | TEXT | 备注（台账 Notes） |
| request_no | VARCHAR | 申请编号（№ заявки） |

### 2.5 数量与聚合标记（暂不联动）

| 字段 | 类型 | 说明 |
|------|------|------|
| rfi_quantity | NUMERIC(38,20) | 本条验收数量。**仅存于 inspectiondb，当前不参与向 volume_control_inspection 的同步** |
| is_key_rfi_aggregation | BOOLEAN | 是否用于 A/B/C 聚合（由 ground_of_works 与 rsc_defines.rfi_a/b/c 匹配结果决定）。当前仅存储，不参与汇总逻辑 |

### 2.6 审计与系统

| 字段 | 类型 | 说明 |
|------|------|------|
| created_at | DATETIME | 记录创建时间 |
| updated_at | DATETIME | 最后修改时间 |
| updated_by | INT FK users | 最后修改人 |
| updated_method | VARCHAR(50) | 修改方式：e.g. inspection_daily_report, manual_edit, excel_import |
| is_system_sync | BOOLEAN | 是否系统同步写入 |

---

## 三、与 rsc_defines 的匹配关系（预留）

- **ground_of_works** 存编码（如 3.1, 4.5）。
- 后续若启用联动：通过 work_package 关联 **rsc_defines**，用 ground_of_works 与 **rsc_defines.rfi_a / rfi_b / rfi_c** 匹配，决定本条是否计入 rfi_completed_a/b/c 以及计入哪一槽位。
- 当前阶段：仅落库，不参与 volume_control_inspection 的更新。

---

## 四、数据流（当前阶段）

1. **录入**：日报管理 → 验收日报 → 写入 **inspectiondb**（含 rfi_quantity、ground_of_works 等）。
2. **volume_control_inspection**：仍按现有方式维护，**不读 inspectiondb**。
3. **inspectiondb**：支持列表、筛选、导出；quantity 与 is_key_rfi_aggregation 仅存储，不做汇总。

后续若业务能提供每条 RFI 的 quantity 并确认规则：再增加「从 inspectiondb 按 activity_id + ground_of_works↔rfi_a/b/c 汇总到 volume_control_inspection」的刷新逻辑，并可视情况改为 volume_control_inspection 以汇总为主。

---

## 五、实施要点小结

| 项 | 说明 |
|----|------|
| volume_control_inspection | 保留现有更新模式，不同步自 inspectiondb |
| inspectiondb | 新建表，结构按上文；quantity 保留，暂不联动 |
| 日报管理 | 增加「验收日报」入口，数据写入 inspectiondb |
| date 拆分 | 使用 rfi_issue_date + rfi_inspection_date（含时间） |
| Type of work | 用 matched_drawing_number（JSON，1 对多选），可抓取 ext_eng_db_current 并可扩展字段 |
| ground_of_works | 存编码，用于与 rsc_defines.rfi_a/b/c 匹配（后续联动用） |
| contractor / scope | 均保留，不重复同一语义 |

本文档可作为建表、验收日报 API 与前端表单设计的依据；实现时先打通链路，quantity 暂不同步到 volume_control_inspection。
