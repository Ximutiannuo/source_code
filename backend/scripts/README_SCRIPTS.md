# Scripts 目录说明

本文档根据当前 `backend/scripts` 目录实际情况整理，并列出**可考虑清理的脚本**供确认后处理。

---

## 📋 脚本分类（当前保留）

### ✅ 1. 数据刷新

| 脚本 | 说明 | 状态 |
|------|------|------|
| **`refresh_activity_summary_sql.py`** ⭐ | 刷新作业清单汇总表（全量、SQL 优化，适合大数据量） | 当前使用中 |
| `fast_refresh_summary.py` | 快速同步 activity_summary 与 volume_control_quantity（全量导入后初始化用） | 备用 |

### ✅ 2. 初始化与系统设置

| 脚本 | 说明 |
|------|------|
| `init_admin_user.py` | 初始化管理员用户 |
| `init_permissions.py` | 初始化权限定义（见 README_PERMISSIONS.md） |
| `init_system_configs.py` | 初始化系统配置 |
| `init_mdr_cache.py` | 初始化 MDR 缓存 |
| `init_system_task_locks.py` | 初始化系统任务锁表 |
| `reset_admin_password.py` | 重置管理员密码 |

### ✅ 3. 权限相关（新增/常用）

| 脚本 | 说明 |
|------|------|
| `list_user_permissions.py` | 列出所有账号及权限（含 scope），支持 `--md` 输出报告 |
| `list_role_permissions.py` | 列出所有角色及权限（含 scope/subproject），支持 `--md` 输出报告 |
| `init_permissions_for_aheadplan.py` | 为所有角色补齐 planning:read/create/update/delete（见 README_PERMISSIONS.md） |
| `cleanup_unused_permissions.py` | 清理未使用的权限（先检查需解绑的引用，确认后再解绑并删除） |

### ✅ 4. 数据库维护与锁/连接

| 脚本 | 说明 |
|------|------|
| **`kill_db_locks.py`** | 清理数据库锁定进程、僵死 MDR 同步状态（**注意**：多处文档仍写 `kill_long_queries.py`，该文件已不存在，实际使用本脚本） |
| **`analyze_slow_query_log.py`** | 分析 MySQL 慢查询日志，按时间段筛选（假死发生后定位慢 SQL） |
| **`diagnose_concurrent_load.py`** | 并发负载诊断：模拟 10×2 并发压测 ahead-plan/summary、view、recommended 等，评估 DB/连接池压力 |
| `find_blocking_connections.py` | 查找阻塞连接 |
| `check_mysql_status.py` | 检查 MySQL 状态和锁表 |
| `maintain_indexes.py` | 索引维护（analyze/check/optimize 等） |
| `clear_cache.py` | 清除 Redis 缓存 |
| `quick_check_table.py` | 快速检查表状态 |

### ✅ 5. P6 同步

| 脚本 | 说明 |
|------|------|
| `create_p6_sync_tables.py` | 创建 P6 同步相关表 |
| `drop_and_recreate_p6_sync_tables.py` | 重建 P6 同步表（故障恢复） |

### ✅ 6. MDR 相关

| 脚本 | 说明 |
|------|------|
| `check_mdr_sync_status.py` | 检查 MDR 同步状态 |
| `check_mdr_sync_and_lock.py` | 检查 MDR 同步与锁 |
| `check_mdr_delta_performance.py` | MDR 增量性能检查 |
| `kill_mdr_query.py` | 结束 MDR 相关查询 |
| `reset_mdr_sync_status.py` | 重置 MDR 同步状态 |
| `add_mdr_indexes.py` / `fix_missing_mdr_index.py` | MDR 索引添加/修复 |
| `optimize_mdr_indexes.py` / `optimize_mdr_db.py` | MDR 索引/库优化 |

### ✅ 7. 数据导入

| 脚本 | 说明 |
|------|------|
| `import_previous_data.py` | 从 Excel 导入历史数据 |
| `import_p6_spreadsheet.py` | 从 P6 表格导入 |
| `import_itp_word.py` | 从 Word 导入 ITP |
| `import_worksteps.py` | 导入工作步骤 |

### ✅ 8. 其他运维/部署

| 脚本 | 说明 |
|------|------|
| `batch_create_users.py` | 批量创建用户（支持 department 列，填 department.code 或 department.name） |
| `export_users.py` | 导出用户清单到 Excel，用于配置部门 |
| `update_users_department.py` | 从配置好的 Excel 更新用户部门 |
| `migrate_add_departments_and_user_department.py` | 迁移：创建 departments 表、为 users 添加 department_id |
| `migrate_add_user_responsible_for.py` | 迁移：为 users 添加 responsible_for 列 |
| `manage_db_users.py` | 管理数据库用户 |
| `setup_vault.py` | Vault/密钥配置 |
| `generate_encrypted_secrets.py` | 生成加密密钥 |
| `deploy_ocr_multi_lang.py` | OCR 多语言部署 |
| `check_ocr_env.py` | 检查 OCR 环境 |
| `sync_vc_construction_completed.py` / `sync_yesterday_vc.py` | 工程量/施工完成同步 |
| **`rollback_volume_control_quantity_by_user_date.py`** | 按用户+日期回滚 volume_control_quantity 到该用户当日第一次修改前的状态（依赖 history 表；先不加 `--execute` 预览，再加 `--execute` 执行） |
| `export_itp_to_excel.py` / `export_table_schema_to_excel.py` | 导出 ITP/表结构到 Excel |

### ✅ 9. 迁移与一次性结构变更（保留作历史）

- 所有 **`migrate_*.py`**：数据库结构/权限等迁移，已执行仍保留参考。
- **`add_*_migration*.py`** / **`add_*.py`**（如 `add_p6_date_fields_migration.py`、`add_vfactdb_is_system_sync_field.py` 等）：一次性加字段/表，可按需归档。
- 配套 **`.sql`**（如 `migrate_vfactdb_achieved_precision.sql`、`add_p6_date_fields_migration.sql`、`enable_load_data_infile.sql`、`fix_indexes.sql` 等）：与上述迁移或运维配套，保留或与对应 .py 一起归档。

### ⚠️ 10. 废弃/危险（保留但慎用）

| 脚本 | 说明 |
|------|------|
| **`force_clear_table.py`** | 强制清空表，危险操作，已加废弃警告 |

---

## 🧹 可考虑清理的脚本/文件（待你确认）

以下按类型列出，**仅供你确认是否删除或归档**；确认前建议先搜索代码引用再决定。

### 1. 无效/临时文件（建议删除）

| 文件 | 说明 |
|------|------|
| **`Untitled`** | 仅一行文本 `kill_long_queries.py`，无实际用途，可删。 |

### 2. 临时/一次性导入脚本（确认不再需要后可删）

| 脚本 | 说明 |
|------|------|
| **`import_previous_data_temp.py`** | 仅导入 MPDB/VFACTDB 的临时脚本，若历史数据已导入且不再使用可删。 |

### 3. 测试/调试脚本（确认无引用后可删或移到 tests/）

| 脚本 | 说明 |
|------|------|
| **`test_p6_api_filter.py`** | P6 API 过滤测试 |
| **`test_update_single_file.py`** | 单文件更新测试 |
| **`test_vault_connection.py`** | Vault 连接测试 |

### 4. 一次性检查/报告（若相关迁移已完成可删）

| 文件 | 说明 |
|------|------|
| **`check_code_field_names.py`** | 检查代码中是否还有旧字段名 |
| **`check_code_field_names_report.md`** | 上述检查的报告 |
| **`final_check_report.md`** | 一次性最终检查报告 |
| **`final_check_summary.md`** | 一次性最终检查摘要 |
| **`check_column_names_migration.py`** | 列名迁移检查 |
| **`update_code_field_names.py`** | 更新代码中的字段名（若已全局替换完成可归档） |

### 5. 可能重复或可合并（确认后保留其一或合并）

| 脚本 | 说明 |
|------|------|
| **`fast_refresh_summary.py`** | 与 `refresh_activity_summary_sql.py` 功能有重叠（快速同步汇总），若只用后者可考虑删或标为“仅初始化用”。 |
| **`ensure_collation_consistency.py`** | 排序规则对齐（activity_status 等） |
| **`unify_db_collation.py`** | 统一库排序规则 |
| **`force_fix_collations.py`** | 强制统一指定表的排序规则。三者均为排序规则相关，可考虑只保留一个或合并。 |

### 6. 一次性修复/调试（执行后可归档或删）

| 脚本 | 说明 |
|------|------|
| **`fix_activity_statuses.py`** | 修复作业状态 |
| **`fix_dashboard_data.py`** | 修复仪表盘数据 |
| **`fix_vfactdb_special_chars.py`** | 修复 vfactdb 特殊字符 |
| **`fix_db_performance.py`** | 数据库性能修复建议 |
| **`debug_data_mismatch.py`** | 数据不一致调试 |
| **`locate_unmatched_vfactdb.py`** | 定位未匹配的 vfactdb |
| **`inspect_pro_db.py`** | 检查 pro 库 |

### 7. 框架/一次性同步（确认已不用可删）

| 脚本 | 说明 |
|------|------|
| **`dashboard_data_sync_framework.py`** | 仪表盘数据同步框架，若已改用其他方式同步可删。 |

### 8. SQL/文档（可选清理）

| 文件 | 说明 |
|------|------|
| **`create_optimized_indexes.sql`** | 优化索引 SQL（`create_optimized_indexes.py` 已删），若索引已由 `maintain_indexes.py` 等维护可考虑删。 |
| **`manual_drop_table.sql`** | 手动删表用，若不需要可删。 |
| **`user_permissions_report.md`** | 由 `list_user_permissions.py --md` 生成的报告，可随时重新生成，若不需要历史报告可删。 |
| **`role_permissions_report.md`** | 由 `list_role_permissions.py --md` 生成的**角色**权限报告，可按角色查看权限分配。 |

---

## 📌 关于 `kill_long_queries.py` 与 `kill_db_locks.py`

- **当前仓库中不存在 `kill_long_queries.py`**，实际用于“杀长查询/清锁”的是 **`kill_db_locks.py`**。
- 以下位置仍引用 `kill_long_queries.py`，建议统一改为 `kill_db_locks.py` 或说明“请使用 kill_db_locks.py”：
  - `refresh_activity_summary_sql.py`
  - `check_mysql_status.py`
  - `fix_db_performance.py`
  - `find_blocking_connections.py`
  - `fix_mysql_lock.ps1`
  - `raw_data_sync_direct.py`
  - `MDR_DELTA_CACHE_优化总结.md`
- 本 README 已改为以 `kill_db_locks.py` 为准。

---

## 📊 统计（约 2025-02）

- **当前 scripts 下文件总数**：约 130+（含 .py / .sql / .ps1 / .md 等）
- **已在上文“已完成的清理”中删除的脚本**：13 个（见下）
- **本次“可考虑清理”列表**：约 25+ 项（含脚本与报告/SQL），是否清理由你确认后执行。

---

## ✅ 已完成的清理（历史记录）

### 已删除的脚本（此前批次）

- `compare_refresh_performance.py`（性能对比）
- `check_table_status.py`、`kill_table_queries.py`、`check_admin_user.py`（重复功能）
- `check_activity_list_columns.py`、`check_load_data_config.py`、`analyze_activity_read_call.py`、`diagnose_p6_server.py`（一次性检查/调试）
- `create_activity_summary_table.py`、`create_optimized_indexes.py`（已集成或替代）
- `import_p6_activities_to_temp.py`、`recreate_p6_table.py`（临时/重复）

### 已更新文档

- `REFRESH_OPTIMIZATION.md` 仅保留对 `refresh_activity_summary_sql.py` 的引用
- `force_clear_table.py` 已加废弃警告

---

## 🔄 使用频率参考

| 场景 | 脚本 |
|------|------|
| 日常 | `refresh_activity_summary_sql.py`、`clear_cache.py`、`kill_db_locks.py` |
| 首次部署 | `init_admin_user.py`、`init_permissions.py`、`init_system_configs.py` |
| 权限排查 | `list_user_permissions.py`、`cleanup_unused_permissions.py`（见 README_PERMISSIONS.md） |
| 故障恢复 | `drop_and_recreate_p6_sync_tables.py`、`reset_admin_password.py` |
| 历史参考 | 所有 `migrate_*.py` 及配套 SQL |
