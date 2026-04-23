# 焊接数据同步数据来源标识说明

## 概述

为了确保系统同步PI04/PI05数据不会影响系统判断分包商是否正常提交日报，我们在VFACTDB表中添加了 `is_system_sync` 字段来标识数据来源。

## 字段说明

### `is_system_sync` 字段

- **类型**: `BOOLEAN`
- **默认值**: `FALSE`
- **说明**: 
  - `TRUE`: 系统同步数据（从WeldingList同步的PI04/PI05数据）
  - `FALSE`: 用户手动提交的数据（分包商通过界面提交的日报）

## 数据标记规则

### 1. 系统同步数据
- **来源**: 焊接数据管理页面的"启动同步"功能
- **标记**: `is_system_sync = TRUE`
- **范围**: 仅限 `work_package` 为 `PI04` 或 `PI05` 的数据
- **代码位置**: `backend/app/services/welding_sync_service.py` 的 `_insert_welding_data_to_vfactdb` 方法

### 2. 用户提交数据
- **来源**: 用户通过日报管理界面手动创建/提交的VFACTDB数据
- **标记**: `is_system_sync = FALSE`
- **代码位置**: `backend/app/api/reports.py` 的 `create_vfactdb_entry` 方法

## 判断分包商提交日报时的注意事项

在判断分包商是否正常提交日报时，**必须排除系统同步的数据**，只统计用户手动提交的数据。

### SQL查询示例

```sql
-- 统计用户提交的日报（排除系统同步数据）
SELECT COUNT(*) 
FROM vfactdb 
WHERE date = '2024-01-01'
  AND scope = '某个分包商的Scope'
  AND is_system_sync = FALSE;  -- 只统计用户提交的数据

-- 或者使用 NOT 条件
SELECT COUNT(*) 
FROM vfactdb 
WHERE date = '2024-01-01'
  AND scope = '某个分包商的Scope'
  AND (is_system_sync = FALSE OR is_system_sync IS NULL);  -- 兼容旧数据
```

### Python/SQLAlchemy查询示例

```python
from app.models.report import VFACTDB

# 统计用户提交的日报（排除系统同步数据）
user_submitted_reports = db.query(VFACTDB).filter(
    VFACTDB.date == target_date,
    VFACTDB.scope == contractor_scope,
    VFACTDB.is_system_sync == False  # 只统计用户提交的数据
).count()

# 或者使用 is_() 方法（更安全）
user_submitted_reports = db.query(VFACTDB).filter(
    VFACTDB.date == target_date,
    VFACTDB.scope == contractor_scope,
    VFACTDB.is_system_sync.is_(False)  # 只统计用户提交的数据
).count()
```

## 迁移说明

迁移脚本 `add_vfactdb_is_system_sync_field.py` 已经：
1. 添加了 `is_system_sync` 字段
2. 为字段创建了索引（`idx_vfactdb_is_system_sync`）
3. 将现有的所有 `PI04` 和 `PI05` 数据标记为系统同步（`is_system_sync = TRUE`）

**注意**: 如果现有数据中有用户手动提交的PI04/PI05数据，需要手动调整这些记录的 `is_system_sync` 字段为 `FALSE`。

## 最佳实践

1. **查询用户提交的日报时**：始终添加 `is_system_sync = FALSE` 条件
2. **查询系统同步的数据时**：使用 `is_system_sync = TRUE` 条件
3. **查询所有数据时**：可以不添加该条件，或使用 `is_system_sync IS NULL OR is_system_sync IN (TRUE, FALSE)` 以兼容旧数据

## 相关文件

- 模型定义: `backend/app/models/report.py`
- 同步服务: `backend/app/services/welding_sync_service.py`
- API端点: `backend/app/api/reports.py`
- 迁移脚本: `backend/scripts/add_vfactdb_is_system_sync_field.py`

