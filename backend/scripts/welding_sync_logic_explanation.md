# WeldingList 到 VFACTDB 数据转换逻辑说明

## 概述
将 PRECOMCONTROL 数据库的 WeldingList 表数据转换为 VFACTDB 格式，用于 PI04 和 PI05 的完成量数据。

## 处理流程

### 第一步：从 WeldingList 读取原始数据

**SQL 查询条件：**
```sql
SELECT 
    DrawingNumber,
    Block,
    ConstContractor,
    WeldJoint,
    JointTypeFS,
    WeldDate,
    Size
FROM WeldingList
WHERE WeldDate IS NOT NULL
AND WeldJoint IS NOT NULL
AND WeldJoint NOT LIKE '%CW%'      -- 排除包含CW的
AND WeldJoint NOT LIKE '%R%'       -- 排除包含R的
AND JointTypeFS IN ('S', 'F')     -- 只要S和F
AND (IsDeleted IS NULL OR IsDeleted = 0)
```

### 第二步：数据筛选和转换

对每条记录进行以下处理：

1. **Marka筛选**
   - 从 `DrawingNumber` 提取 Marka（如 "GCC-AFT-DDD-13220-00-5200-TKM-ISO-00001" → "TKM"）
   - 检查 Marka 是否在 `welding_marka_codes` 表中
   - 如果不在，跳过该记录

2. **Block提取**
   - 优先使用 `WeldingList.Block`（格式：`____-_____-__`，如 "1307-12100-21"）
   - 如果格式不正确，从 `DrawingNumber` 中提取
   - 如果提取失败，跳过该记录

3. **Scope映射**
   - 通过 `welding_constcontractor_mappings` 表将 `ConstContractor` 映射到 `Scope`
   - 如果映射表中没有，使用 `ConstContractor` 本身作为 `Scope`

4. **Work Package确定**
   - `JointTypeFS = 'S'` → `work_package = 'PI04'`
   - `JointTypeFS = 'F'` → `work_package = 'PI05'`

5. **日期处理**
   - 使用 `WeldDate` 作为记录的日期
   - 转换为 date 对象

6. **数值处理**
   - `Size` 转换为 float 类型

### 第三步：数据分组聚合

按以下维度分组：
- `weld_date`（WeldDate）
- `block`（提取的Block）
- `marka`（提取的Marka）
- `scope`（映射后的Scope）
- `work_package`（PI04或PI05）

对每组数据：
- **sum(Size)** 作为 `achieved`（完成量）

### 第四步：匹配 Activity ID

通过 `activity_summary.title` 匹配 `activity_id`：

**匹配模式：**
- `title` 格式：`"... (block-marka-scope)"` 或 `"... (block-marka-PI-scope)"`
- 例如：`"Deethanization equipment site: Piping Shop Prefabrication(1307-12100-21-PI-TKM)"`
- 匹配条件：`block-marka-scope` 或 `block-marka-PI-scope`
- 同时验证 `activity_summary.scope` 和 `activity_summary.work_package` 是否匹配

**匹配逻辑：**
1. 查询 `work_package` 匹配的所有活动
2. 检查 `title` 中是否包含 `(block-marka-scope)` 模式
3. 验证 `scope` 是否匹配
4. 返回匹配的 `activity_id`

### 第五步：创建 VFACTDB 记录

使用匹配到的 `activity_id` 和 `activity_summary` 中的信息创建 VFACTDB 记录：

```python
VFACTDB(
    date=weld_date,                    # 来自 WeldDate
    activity_id=activity.activity_id,  # 通过title匹配得到
    scope=scope,                       # 从ConstContractor映射
    project=activity.project,          # 从activity_summary获取
    subproject=activity.subproject,    # 从activity_summary获取
    implement_phase=activity.implement_phase,
    train=activity.train,
    unit=activity.unit,
    block=activity.block or block,     # 优先使用activity的block
    quarter=activity.quarter,
    main_block=activity.main_block,
    title=activity.title,
    work_step_description='',          # WeldingList没有此字段
    discipline=activity.discipline,
    work_package=work_package,         # PI04 或 PI05
    achieved=sum(Size)                 # 分组聚合后的Size总和
)
```

## 特殊处理

### 非标准图纸
- 如果 `DrawingNumber` 在 `welding_non_standard_drawings` 表中
- 使用表中的 `activity_id` 和 `joint_type_fs` 直接匹配
- 跳过 Block 和 Marka 提取步骤

### 数据同步策略
- **删除策略**：删除所有现有的 PI04 和 PI05 数据（所有日期）
- **插入策略**：插入新处理的数据
- **事务保证**：整个过程在一个事务中，失败时回滚

## 使用方法

### API调用
```bash
POST /api/reports/vfactdb/sync-welding?target_date=2024-01-01
```

### 前端调用
在 VFACTDB 页面点击"同步PI04/PI05"按钮

### 定时任务（待实现）
可以配置定时任务每天自动同步前一天的数据

## 数据流图

```
WeldingList (PRECOMCONTROL)
    ↓
[筛选：WeldJoint不含CW/R，JointTypeFS=S/F，Marka在配置表中]
    ↓
[提取：Block, Marka, Scope映射]
    ↓
[分组聚合：按(date, block, marka, scope, work_package)分组，sum(Size)]
    ↓
[匹配Activity：通过activity_summary.title匹配activity_id]
    ↓
[创建VFACTDB记录：使用activity信息填充字段]
    ↓
VFACTDB (主数据库)
```

## 注意事项

1. **数据完整性**：如果找不到匹配的 `activity_id`，该记录会被跳过并记录警告
2. **性能考虑**：大量数据时，建议按日期范围分批同步
3. **数据一致性**：同步时会删除所有PI04/PI05数据，确保数据一致性
4. **配置依赖**：需要先配置好 `welding_marka_codes`、`welding_constcontractor_mappings` 和 `welding_non_standard_drawings` 表

