# MDR Delta Cache 性能优化总结

## 问题诊断

### 发现的问题
1. **Delta Cache 查询卡住**：查询运行超过 2 小时（7529秒），一直卡在 99%
2. **缺失索引**：`ext_eng_db_previous.idx_document_number` 索引缺失
3. **数据量大**：337万条记录的大表 JOIN 操作非常慢
4. **查询未优化**：直接对全表进行 LEFT JOIN，没有使用临时表优化

## 已完成的优化

### 1. 添加缺失的索引 ✅
- **脚本**：`fix_missing_mdr_index.py`
- **操作**：为 `ext_eng_db_previous` 表添加 `idx_document_number` 索引
- **耗时**：35.19 秒
- **效果**：优化 JOIN 查询性能

### 2. 优化 Delta Cache 查询 ✅
- **文件**：`backend/app/services/mdr_sync_service.py` 的 `_run_delta_cache` 方法
- **优化策略**：
  - 使用临时表减少 JOIN 数据量
  - 只选择需要的字段（`document_number`, `type_of_dates`, `dates` 等）
  - 过滤数据（只保留 `actual_type` 和 `plan_type`）
  - 为临时表添加索引
  - 在临时表上执行 JOIN（数据量从 337万 减少到约几十万）
- **预期性能提升**：5-10 倍

### 3. 改进错误处理和日志 ✅
- 添加详细的执行时间日志
- 自动清理临时表
- 如果临时表创建失败，回退到原查询

### 4. 前端进度显示优化 ✅
- **文件**：`frontend/src/pages/MDRDesignManagement.tsx`
- **改进**：根据预计算阶段显示不同进度（95%, 97%, 99%）

## 工具脚本

### 诊断工具
1. **`check_mdr_delta_performance.py`** - 诊断 Delta Cache 性能问题（包含检查查询状态功能）
2. **`check_mdr_sync_status.py`** - 检查 MDR 同步状态

### 修复工具
1. **`fix_missing_mdr_index.py`** - 快速添加缺失的索引
2. **`optimize_mdr_indexes.py`** - 完整的索引优化（所有必要索引）
3. **`kill_mdr_query.py`** - 终止MDR相关的卡住查询（支持指定进程ID或查找所有MDR查询）
4. **`reset_mdr_sync_status.py`** - 重置同步状态为 failed

### 通用工具（已存在）
- **`kill_long_queries.py`** - 杀死长时间运行的查询（通用工具）
- **`kill_db_locks.py`** - 清理数据库锁定进程（通用工具）

## 操作步骤

### 已完成 ✅
1. ✅ 终止卡住的查询（进程 57497）
2. ✅ 添加缺失的索引（`ext_eng_db_previous.idx_document_number`）

### 下一步操作

#### 1. 重置同步状态（可选）
如果同步状态仍显示为 `running`，运行：
```bash
python backend/scripts/reset_mdr_sync_status.py
```

#### 2. 重新运行 MDR 同步
- 通过前端界面点击 "Refresh Data" 按钮
- 或通过 API：`POST /api/external-data/mdr/sync-trigger`

#### 3. 监控同步进度
- 前端会自动显示进度（95% → 97% → 99% → 100%）
- 或运行诊断脚本：
```bash
python backend/scripts/check_mdr_sync_status.py
```

## 性能预期

### 优化前
- **Delta Cache 计算时间**：2+ 小时（甚至卡住）
- **数据量**：337万条记录全表 JOIN
- **索引**：缺少关键索引

### 优化后
- **Delta Cache 计算时间**：预计 10-20 分钟
- **数据量**：临时表约几十万条记录
- **索引**：所有必要索引已添加
- **性能提升**：5-10 倍

## 注意事项

1. **临时表空间**：优化后的查询使用临时表，需要足够的临时表空间
2. **索引维护**：如果表结构发生变化，可能需要重新运行 `optimize_mdr_indexes.py`
3. **监控**：如果下次同步仍然很慢，检查：
   - 索引是否正常
   - 临时表是否正常创建
   - 数据库性能是否正常

## 相关文件

- 同步服务：`backend/app/services/mdr_sync_service.py`
- 前端页面：`frontend/src/pages/MDRDesignManagement.tsx`
- 索引优化脚本：`backend/scripts/optimize_mdr_indexes.py`
- 诊断脚本：`backend/scripts/check_mdr_delta_performance.py`

## 总结

通过添加索引和优化查询（使用临时表），Delta Cache 计算的性能预计提升 5-10 倍，从 2+ 小时降低到 10-20 分钟。所有优化已完成，可以重新运行同步任务。
