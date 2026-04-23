# P6同步模块

## 概述

`p6_sync` 模块提供了完整的P6数据同步功能，包含所有P6实体的模型和同步服务。

## 模块结构

```
p6_sync/
├── __init__.py                 # 模块导出
├── utils.py                    # 工具函数（parse_date, parse_boolean等）
├── models/                     # P6实体模型
│   ├── __init__.py
│   ├── eps.py                  # EPS模型
│   ├── project.py              # Project模型
│   ├── wbs.py                  # WBS模型
│   ├── activity.py             # Activity模型
│   ├── activity_code.py        # ActivityCode模型
│   ├── activity_code_assignment.py  # ActivityCodeAssignment模型
│   ├── resource.py             # Resource模型
│   ├── resource_assignment.py  # ResourceAssignment模型
│   └── sync_log.py             # 同步日志模型
└── services/                   # 同步服务
    ├── __init__.py
    ├── base_sync.py            # 基础同步服务抽象类
    ├── sync_service.py         # 主同步服务（协调所有实体）
    ├── eps_sync.py             # EPS同步服务
    ├── project_sync.py         # Project同步服务
    ├── wbs_sync.py             # WBS同步服务 ✅
    ├── activity_sync.py        # Activity同步服务 ✅
    ├── activity_code_sync.py   # ActivityCode同步服务 ✅
    ├── activity_code_assignment_sync.py  # ActivityCodeAssignment同步服务 ✅
    ├── resource_sync.py        # Resource同步服务 ✅
    └── resource_assignment_sync.py  # ResourceAssignment同步服务 ✅
```

## 实体模型

### 已实现的模型

1. **P6EPS** - EPS（企业项目结构）
2. **P6Project** - 项目
3. **P6WBS** - WBS（工作分解结构）
4. **P6Activity** - 作业
5. **P6ActivityCode** - 作业代码类型
6. **P6ActivityCodeAssignment** - 作业代码分配
7. **P6Resource** - 资源
8. **P6ResourceAssignment** - 资源分配
9. **P6SyncLog** - 同步日志

## 同步服务

### 主同步服务

`P6FullSyncService` 协调所有P6实体的同步，并集成计算服务。

**使用示例：**

```python
from app.p6_sync import P6FullSyncService
from app.database import SessionLocal

db = SessionLocal()
sync_service = P6FullSyncService()

# 同步项目的所有实体
result = sync_service.sync_all_entities(
    project_id="UIOPRJ",
    sync_mode="full",
    db=db,
    entities=['eps', 'project', 'activity', 'activity_code_assignment']
)

# 或只同步作业数据（包括计算）
result = sync_service.sync_project_activities(
    project_id="UIOPRJ",
    sync_mode="full",
    db=db
)
```

### 单个实体同步服务

每个实体都有独立的同步服务：

- `EPSSyncService` - 同步EPS
- `ProjectSyncService` - 同步Project
- `ActivitySyncService` - 同步Activity
- 其他服务待实现...

**使用示例：**

```python
from app.p6_sync.services import ActivitySyncService
from app.database import SessionLocal

db = SessionLocal()
activity_sync = ActivitySyncService()

result = activity_sync.sync_from_p6(
    project_id="UIOPRJ",
    sync_mode="full",
    db=db
)
```

## 数据流程

```
P6 REST API 
  → 临时表（p6_*表）
    → 数据转换和验证
      → 目标表（Activity表）
        → 算法计算（人工时、权重）
          → Activity List
```

## 同步模式

- **full**: 全量同步（删除后重新导入）
- **incremental**: 增量同步（只同步新增/修改的）

## 计算服务集成

同步完成后，会自动调用 `ActivityCalculationService` 计算：
- 人工时（man_hours）
- 权重因子（weight_factor）

## 已实现功能

1. ✅ EPS同步 - 已完成
2. ✅ Project同步 - 已完成
3. ✅ WBS同步 - 已完成
4. ✅ Activity同步 - 已完成
5. ✅ ActivityCode同步 - 已完成
6. ✅ ActivityCodeAssignment同步 - 已完成
7. ✅ Resource同步 - 已完成
8. ✅ ResourceAssignment同步 - 已完成

## 可扩展性

### 注册新的实体同步服务

主同步服务使用注册机制，支持动态添加新的实体同步服务：

```python
from app.p6_sync.services.sync_service import P6FullSyncService
from app.p6_sync.services.base_sync import BaseSyncService
from app.p6_sync.models.sync_log import SyncEntityType

class CustomEntitySyncService(BaseSyncService):
    """自定义实体同步服务"""
    
    def __init__(self, p6_service=None):
        super().__init__(p6_service)
        self.entity_type = SyncEntityType.CUSTOM  # 需要在SyncEntityType中添加
    
    def sync_from_p6(self, project_id=None, project_object_id=None, sync_mode="full", db=None):
        # 实现同步逻辑
        pass
    
    def _fetch_p6_data(self, project_id=None, project_object_id=None):
        # 实现数据获取逻辑
        pass
    
    def _transform_p6_data(self, p6_data):
        # 实现数据转换逻辑
        pass
    
    def _save_to_database(self, transformed_data, sync_mode, db):
        # 实现数据保存逻辑
        pass

# 注册新的同步服务
P6FullSyncService.register_entity_service('custom_entity', CustomEntitySyncService)

# 使用
sync_service = P6FullSyncService()
result = sync_service.sync_all_entities(
    project_id="UIOPRJ",
    entities=['custom_entity']  # 新注册的实体
)
```

## 下一步工作

1. ✅ 实现所有实体的同步服务 - 已完成
2. ⏳ 创建API端点用于触发同步 - 待实现
3. ⏳ 添加增量同步逻辑（使用LastUpdateDate） - 待实现
4. ⏳ 创建定时任务（APScheduler） - 待实现
5. ⏳ 添加数据验证层 - 待实现
6. ⏳ 优化批量处理性能 - 待实现

## 架构特点

### 1. 可扩展性
- 使用注册机制，支持动态添加新的实体同步服务
- 所有同步服务继承自`BaseSyncService`，统一接口
- 主同步服务自动发现并调用已注册的服务

### 2. 统一的数据流程
所有实体同步服务遵循相同的数据流程：
```
P6 API → _fetch_p6_data() → _transform_p6_data() → _save_to_database()
```

### 3. 完整的日志记录
- 每个同步操作都会创建`P6SyncLog`记录
- 记录同步状态、统计信息、错误信息等

### 4. 错误处理
- 每个步骤都有异常处理
- 失败时记录详细错误信息
- 支持部分成功（部分记录失败不影响其他记录）
