# is_system_sync 字段影响分析

## 概述

为 VFACTDB 表添加了 `is_system_sync` 字段用于区分系统同步数据和用户提交数据。本文档说明该字段对现有功能的影响。

## 字段特性

- **字段名**: `is_system_sync`
- **类型**: `BOOLEAN`
- **默认值**: `FALSE`
- **可空**: `NOT NULL`
- **索引**: 已创建索引 `idx_vfactdb_is_system_sync`

## 对现有功能的影响分析

### ✅ 1. 日报填报（用户手动提交）

**影响**: ✅ **无影响**

- **创建接口**: `POST /api/reports/vfactdb`
- **处理**: 自动设置为 `is_system_sync = False`
- **代码位置**: `backend/app/api/reports.py:385`
- **说明**: 用户通过界面提交的日报会自动标记为用户提交，不影响现有逻辑

### ✅ 2. 数据导入（Excel导入）

**影响**: ✅ **无影响**

- **导入接口**: `POST /api/import/vfactdb/excel`
- **处理**: 自动设置为 `is_system_sync = False`
- **代码位置**: `backend/app/api/import_api.py:192`
- **说明**: 通过Excel导入的数据会被标记为用户提交，因为这是用户主动导入的操作

### ✅ 3. 数据更新

**影响**: ✅ **无影响**

- **更新接口**: `PUT /api/reports/vfactdb/{entry_id}`
- **处理**: 更新时保持原有的 `is_system_sync` 值不变
- **代码位置**: `backend/app/api/reports.py:647-650`
- **说明**: 更新操作不会改变数据来源标识，系统同步的数据更新后仍然是系统同步，用户提交的数据更新后仍然是用户提交

### ✅ 4. 数据查询

**影响**: ✅ **无影响**

- **查询接口**: `GET /api/reports/vfactdb`
- **处理**: 
  - `VFACTDBResponse` 模型使用 `from_attributes = True`，会自动包含所有字段
  - 但当前响应中手动构建了字典，**不包含 `is_system_sync` 字段**
  - 这是**有意为之**，因为前端不需要知道这个字段
- **说明**: 查询返回的数据格式不变，前端代码无需修改

### ✅ 5. 数据导出

**影响**: ✅ **无影响**

- **导出功能**: 通过查询接口获取数据后导出
- **处理**: 由于查询接口不返回 `is_system_sync` 字段，导出文件不会包含此列
- **说明**: 导出功能完全不受影响，导出的Excel文件格式不变

### ✅ 6. 周报分发

**影响**: ✅ **无影响**

- **分发接口**: `POST /api/reports/vfactdb/weekly-distribute`
- **处理**: 自动设置为 `is_system_sync = False`
- **代码位置**: `backend/app/api/reports.py:1316`
- **说明**: 周报分发是用户操作，标记为用户提交

### ✅ 7. 批量调整

**影响**: ✅ **无影响**

- **调整接口**: `POST /api/reports/vfactdb/batch-adjust`
- **处理**: 使用更新接口的逻辑，保持原有 `is_system_sync` 值
- **说明**: 批量调整不会改变数据来源标识

## 前端影响

### ✅ 前端类型定义

**影响**: ✅ **无影响**

- **文件**: `frontend/src/types/report.ts`
- **说明**: `VFACTDBEntry` 和 `VFACTDBResponse` 接口中**不包含** `is_system_sync` 字段
- **原因**: 这是后端内部使用的字段，前端不需要知道

### ✅ 前端组件

**影响**: ✅ **无影响**

- **日报填报组件**: 不受影响，因为创建时后端自动设置
- **导入组件**: 不受影响，因为导入时后端自动设置
- **表格显示**: 不受影响，因为查询接口不返回此字段

## 数据库兼容性

### ✅ 现有数据

- **迁移脚本**: `backend/scripts/add_vfactdb_is_system_sync_field.py`
- **处理**: 
  - 所有现有数据默认设置为 `FALSE`（用户提交）
  - 所有 `PI04` 和 `PI05` 数据被标记为 `TRUE`（系统同步）
- **说明**: 迁移后，现有数据都有明确的标识

### ✅ 新数据

- **默认值**: `FALSE`
- **说明**: 如果创建时没有显式设置，会自动使用默认值 `FALSE`

## 总结

### ✅ 不会受影响的功能

1. ✅ 日报填报（用户手动提交）
2. ✅ Excel导入功能
3. ✅ 数据更新功能
4. ✅ 数据查询功能
5. ✅ 数据导出功能
6. ✅ 周报分发功能
7. ✅ 批量调整功能
8. ✅ 前端所有组件和类型定义

### ⚠️ 需要注意的地方

1. **判断分包商提交日报时**: 必须添加 `is_system_sync = False` 条件，排除系统同步数据
2. **查询系统同步数据时**: 使用 `is_system_sync = True` 条件
3. **前端不需要修改**: 因为查询接口不返回此字段

## 相关文件

- 模型定义: `backend/app/models/report.py`
- API接口: `backend/app/api/reports.py`
- 导入功能: `backend/app/api/import_api.py`
- 迁移脚本: `backend/scripts/add_vfactdb_is_system_sync_field.py`

