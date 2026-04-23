# MDR同步任务启动指南

## 概述

MDR（Material Data Record）同步任务用于将 `ENG.ENGDB` 数据库中的数据同步到 `projectcontrols.ext_eng_db_current` 表中。

## 同步机制

### 数据流程
1. **源表**: `ENG.ENGDB` (外部数据库)
2. **目标表**: `projectcontrols.ext_eng_db_current` (当前周数据)
3. **历史表**: `projectcontrols.ext_eng_db_previous` (上周数据备份)

### 同步过程
1. 备份当前数据到 `ext_eng_db_previous` 表
2. 清空 `ext_eng_db_current` 表
3. 从 `ENG.ENGDB` 分批同步数据（每批10万条）
4. 执行聚合分析，生成统计报告

### 同步特点
- **分批处理**: 每批处理10万条记录，防止锁表
- **ID范围同步**: 使用ID范围查询，提升性能
- **进度跟踪**: 实时更新 `mdr_sync_log` 表记录进度
- **自动恢复**: 如果检测到异常中断的同步，会自动标记为失败

## 启动方式

### 方式1: 通过API接口（推荐）

**接口地址**: `POST /api/external-data/mdr/sync-trigger`

**权限要求**: 需要 `system:admin` 权限

**执行方式**: **后台任务执行** - API会立即返回，同步在后台进行

**使用示例**:

```bash
# 使用curl
curl -X POST "https://10.78.44.3:8443/api/external-data/mdr/sync-trigger" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# 使用PowerShell
$headers = @{
    "Authorization" = "Bearer YOUR_TOKEN"
    "Content-Type" = "application/json"
}
Invoke-RestMethod -Uri "https://10.78.44.3:8443/api/external-data/mdr/sync-trigger" `
    -Method POST -Headers $headers
```

**返回响应**:
```json
{
  "success": true,
  "message": "MDR同步任务已启动，正在后台处理中...",
  "note": "同步可能需要10-17分钟，请通过 /mdr/sync-status 接口查询进度"
}
```

**前端调用**:
前端页面 `MDRDesignManagement.tsx` 中已有同步按钮（"Refresh Data"），点击即可触发。系统会立即返回"同步已在后台启动"的提示。

**重要说明**:
- API调用会立即返回，不会等待同步完成
- 同步任务在后台执行，通常需要10-17分钟
- 可以通过 `/mdr/sync-status` 接口或检查脚本实时查看同步进度
- 同步开始后，会在 `mdr_sync_log` 表中创建状态为 `running` 的记录

### 方式2: 通过独立Python脚本

**脚本路径**: `backend/sync_mdr_standalone.py`

**执行方式**:
```powershell
cd c:\Projects\ProjectControls\backend
python sync_mdr_standalone.py
```

**特点**:
- 直接执行，不依赖API服务
- 输出详细的同步日志
- 适合调试和手动执行

### 方式3: 自动定时调度

**调度配置**: `backend/app/p6_sync/scheduler.py`

**执行时间**: 每周四 22:00 自动执行

**配置代码**:
```python
scheduler.add_job(
    MDRSyncService.sync_mdr_data,
    trigger=CronTrigger(day_of_week='thu', hour=22, minute=0),
    id='mdr_weekly_sync',
    name='MDR设计数据周同步',
    replace_existing=True
)
```

## 检查同步状态

### 方式1: 通过API接口

**接口地址**: `GET /api/external-data/mdr/sync-status`

**返回信息**:
- `status`: 同步状态 (running/success/failed)
- `sync_time`: 同步开始时间
- `total_count`: 总记录数
- `processed_count`: 已处理记录数
- `message`: 同步消息
- `duration_seconds`: 耗时（秒）

### 方式2: 使用检查脚本

**脚本路径**: `backend/scripts/check_mdr_sync_status.py`

**执行方式**:
```powershell
cd c:\Projects\ProjectControls\backend
python scripts\check_mdr_sync_status.py
```

**输出信息**:
- 是否有正在运行的同步任务
- 最近的10条同步记录
- 最新同步状态分析
- 数据表统计信息

### 方式3: 直接查询数据库

```sql
-- 查看最近的同步记录
SELECT * FROM mdr_sync_log 
ORDER BY sync_time DESC 
LIMIT 10;

-- 查看正在运行的同步
SELECT * FROM mdr_sync_log 
WHERE status = 'running';

-- 查看数据表记录数
SELECT COUNT(*) FROM ext_eng_db_current;
SELECT COUNT(*) FROM ext_eng_db_previous;
SELECT COUNT(*) FROM ENG.ENGDB;
```

## 同步状态说明

### 状态值
- **running**: 正在运行中
- **success**: 同步成功完成
- **failed**: 同步失败

### 常见问题

1. **同步卡在running状态**
   - 可能原因：进程异常退出，但状态未更新
   - 解决方法：下次同步启动时会自动将旧的running状态标记为failed

2. **同步失败 - 锁等待超时**
   - 可能原因：数据库表被其他进程锁定
   - 解决方法：等待其他操作完成，或重启数据库连接

3. **同步失败 - 日期格式错误**
   - 可能原因：源表中存在 '0000-00-00' 日期值
   - 解决方法：代码已使用 `NULLIF(Dates, '0000-00-00')` 处理

4. **同步失败 - 主键冲突**
   - 可能原因：同步过程中表未清空
   - 解决方法：确保同步前正确执行了 `TRUNCATE ext_eng_db_current`

## 性能指标

根据历史记录：
- **数据量**: 约337万条记录
- **同步耗时**: 约600-1000秒（10-17分钟）
- **处理速度**: 约3000-5000条/秒

## 注意事项

1. **同步期间避免操作**: 同步过程中避免手动修改相关表
2. **定期检查**: 建议每周检查一次同步状态
3. **备份数据**: 同步前会自动备份到 `ext_eng_db_previous` 表
4. **权限要求**: API方式需要系统管理员权限
5. **网络连接**: 确保能访问源数据库 `ENG.ENGDB`

## 相关文件

- 同步服务: `backend/app/services/mdr_sync_service.py`
- API接口: `backend/app/api/external_data.py` (第441-445行)
- 独立脚本: `backend/sync_mdr_standalone.py`
- 调度配置: `backend/app/p6_sync/scheduler.py` (第263-272行)
- 检查脚本: `backend/scripts/check_mdr_sync_status.py`
- 数据库表结构: `database/mdr_design_tables.sql`
