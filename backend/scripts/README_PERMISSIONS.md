# 权限系统说明

本文档描述项目中的权限定义、与菜单/接口的对应关系，以及初始化与分配方式。权限定义以 `backend/scripts/init_permissions.py` 为准。

---

## 初始化权限

在项目根目录执行以下命令，将默认权限定义写入数据库（仅创建不存在的权限，已存在的会跳过）：

```bash
python backend/scripts/init_permissions.py
```

**说明**：脚本只创建权限**定义**，不会自动分配给任何用户或角色。分配需在「账号管理」/「权限管理」中操作。

### 查看角色权限分配

按角色查看各角色的权限及 scope/subproject 限制，可执行：

```bash
python backend/scripts/list_role_permissions.py --md
```

生成的 `role_permissions_report.md` 列出所有角色及其权限分配情况。

### QAQC / Construction 角色批量配置

QAQC 与 CONSTRUCTION 相关角色使用固定权限模板，可用脚本一次性配置（不覆盖已有权限，只补缺）：

```bash
# 为所有名称含 QAQC 或 Construction 的角色按模板配置
python backend/scripts/init_qaqc_construction_permissions.py

# 仅处理指定角色
python backend/scripts/init_qaqc_construction_permissions.py --roles C01QAQC C02Construction

# 试运行
python backend/scripts/init_qaqc_construction_permissions.py --dry-run
```

- **C\*** 账号（分包商）：范围用 **scope**（如 C01QAQC → scope=C01）。
- **ECU / PEL / UIO** 账号（项目部）：范围用 **subproject**（如 ECUQAQC → subproject=ECU）。
- 模板定义见脚本内 `QAQC_PERMISSION_CODES` 与 `CONSTRUCTION_PERMISSION_CODES`。

### 专项计划问题协作（planning 全权限）

专项计划「需要解决的问题」功能（提出、回复、解决、评分）需要 planning:read/create/update/delete。可为所有角色补齐缺失的 planning 权限：

```bash
python backend/scripts/init_permissions_for_aheadplan.py
# --roles 指定角色；--dry-run 试运行
```

- 若角色已有某 planning 权限（任意 scope/subproject），该权限不再新增。
- 新增权限继承该角色已有 planning 权限的 scope/subproject；若无则全范围。

---

## 前端页面所需权限一览

每个前端页面（菜单项）执行各类操作时分别需要哪些权限；以下均支持 scope/subproject 范围限制（除特别说明外）。

### 计划管理

| 前端页面 | 路径 | 查看 | 修改（增/改/删） | 说明 |
|----------|------|------|------------------|------|
| 总体计划管理 | `/activities-advanced` | `planning:read` | - | 作业清单高级查询、筛选 |
| 专项计划管理 | `/ahead-plan` | `planning:read` | `planning:create` / `update` / `delete` | 月滚动/三月滚动计划、需要解决的问题；25 日后仅系统管理员可改 |

### 日报填报

| 前端页面 | 路径 | 查看 | 修改 | 说明 |
|----------|------|------|------|------|
| 人力日报 | `/daily-report-management` | `planning:read` | `planning:read` + `daily_report:create`；工程量列还需 `*_volume:create` | 加载活动列表需 planning:read；保存需 daily_report:create |
| 工程量日报 | `/daily-report-volume` | `planning:read` | 同上 | 填报模板、提交同日报填报 |
| 验收日报 | `/inspectiondb` | `inspection_db:read` | `inspection_db:create` / `update` / `delete` | 前端 ProtectedRoute 需 `inspection_db:read` |

### 数据管理

| 前端页面 | 路径 | 查看 | 修改 | 说明 |
|----------|------|------|------|------|
| 作业清单 | `/activities` | `planning:read` | `daily_report:create` | 确认完成、重新打开、批量关闭需 daily_report:create |
| 工程量清单 | `/volumecontrollist` | `construction_volume:read`、`acceptance_volume:read`、`abd_volume:read`、`ovr_volume:read` | 对应 `*_volume:update` | 按工程量类型分别控制 |
| 人力数据 | `/mpdb` | `daily_report:read` | `daily_report:create` / `update` / `delete` | 与日报 reports API 一致 |
| 工程量数据 | `/vfactdb` | `daily_report:read` | `daily_report:create` / `update` / `delete` | 同上 |
| 工效分析 | `/productivity-analysis` | （无单独权限） | - | 依赖其他页面的数据权限 |
| 数据恢复控制台 | `/system-admin` | - | 仅**超级管理员**或 `role_system_admin` | 菜单仅上述用户可见 |

### 系统管理（菜单按权限显示）

| 前端页面 | 路径 | 查看 | 修改 | 说明 |
|----------|------|------|------|------|
| EPS 管理 | `/p6` | `p6_resource:read` 或 `p6_database:read` | `p6_resource:update` / `sync` | 菜单需 P6 读权限 |
| WBS 管理 | `/wbs` | 同上 | 同上 | |
| 作业分类码 | `/activity-codes` | 同上 | 同上 | |
| 资源管理 | `/resource-management` | 同上 | 同上 | |
| 工作包管理 | `/work-package-management` | 同上 | 仅**系统管理员**（见下） | 增删改需 system:admin |
| 工作步骤管理 | `/work-step-management` | 同上 | 同上 | |
| P6 同步配置 | `/p6-config` | `p6_sync:read` | `p6_sync:update` / `delete` / `sync` | 前端 ProtectedRoute 需 `p6_sync:read` |
| 主项清单管理 | `/facility-management` | `facility:read` | `facility:create` / `update` / `delete` | |
| 验收程序 | `/acceptance-procedure` | `acceptance_procedure:read` | - | 前端 ProtectedRoute 需该权限 |
| 日报提交状态管理 | `/daily-report-status` | `daily_report:read` | `daily_report:update` | |
| 账号管理 | `/account-management` | 仅**超级管理员** | 需 `user:*` / `permission:*` | 菜单仅 superuser 可见 |

### 外链管理

| 前端页面 | 路径 | 查看 | 修改 | 说明 |
|----------|------|------|------|------|
| 诺德焊接数据库管理 | `/external-data/welding` | `welding_data:read` | `welding_data:config:*` / `welding_data:sync` | 前端 ProtectedRoute 需 `welding_data:read` |
| 外部 MDR 设计管理 | `/external-data/mdr` | `system:admin` | - | 前端 ProtectedRoute 需 `system:admin` |

### 其他 UI 元素

| 功能 | 所需权限 | 说明 |
|------|----------|------|
| 专项计划问题通知铃铛 | `planning:read` | 头部导航栏显示「需要解决的问题」未读数量 |

---

## 系统管理员与工作包管理

### 谁算「系统管理员」

- **超级管理员**：用户表 `is_superuser = true`，拥有所有权限，无需在权限表中分配。
- **内置管理员账号**：用户名为 `role_system_admin` 的账号。
- **通过权限授予**：拥有 `system:admin` 权限的用户（需先执行 `init_permissions.py` 创建该权限，再在账号管理中分配）。

### 工作包管理

- **查看**：与「资源管理」「工作步骤管理」等一致，拥有 `p6_resource:read` 或 `p6_database:read` 即可看到「工作包管理」菜单并打开页面查看、筛选、刷新列表。接口 GET `/api/rsc/`、`/api/rsc/list` 不校验管理员。
- **新增 / 编辑 / 删除**：
  - **后端**：仅系统管理员可调用 POST/PUT/DELETE `/api/rsc/*`（依赖 `get_current_system_admin`，即上述三类管理员）。
  - **前端**：仅当用户为超级管理员或拥有 `system:admin` 时，才显示「新增」按钮和表格中的「编辑」「删除」。所有写操作均有二次确认弹窗。

因此：未执行 `init_permissions.py` 时，只要账号是超级管理员或 `role_system_admin`，仍可正常进行工作包增删改；若需让**其他角色**通过权限获得工作包编辑能力，需先初始化并分配 `system:admin`。

---

## 权限代码与页面对应关系

以下列出各权限代码的含义及主要涉及的前端页面。

### 计划管理 `planning:*`

| 权限代码 | 含义 | 主要页面 |
|----------|------|----------|
| `planning:read` | 查看作业/活动、专项计划、日报模板中的活动列表 | 总体计划管理、专项计划管理、作业清单、人力/工程量日报 |
| `planning:create` | 创建专项计划、导入计划、新建需要解决的问题 | 专项计划管理 |
| `planning:update` | 更新计划、审批/批准、更新问题、问题回复 | 专项计划管理 |
| `planning:delete` | 删除计划、删除问题 | 专项计划管理 |

### 日报管理 `daily_report:*`

| 权限代码 | 含义 | 主要页面 |
|----------|------|----------|
| `daily_report:read` | 查看日报模板与记录、MPDB/VFACTDB 列表、填报状态、导出 | 人力日报、工程量日报、人力数据、工程量数据、日报提交状态管理 |
| `daily_report:create` | 提交人力/工程量日报、按周分配、导入、作业确认完成/重新打开 | 人力日报、工程量日报、作业清单、人力/工程量数据 |
| `daily_report:update` | 更新日报记录、批量调整、必填 scope 配置 | 人力日报、工程量日报、日报提交状态管理 |
| `daily_report:delete` | 删除人力/工程量日报记录 | 人力日报、工程量日报 |

### 工程量 `*_volume:*`

| 权限代码 | 含义 | 主要页面 |
|----------|------|----------|
| `construction_volume:read` / `update` | 施工工程量 | 工程量清单、人力/工程量日报（工程量列） |
| `acceptance_volume:read` / `update` | 验收工程量 | 工程量清单、人力/工程量日报 |
| `abd_volume:read` / `update` | ABD 工程量 | 工程量清单 |
| `ovr_volume:read` / `update` | OVR 工程量 | 工程量清单 |

### 验收

| 权限代码 | 含义 | 主要页面 |
|----------|------|----------|
| `inspection_db:read` / `create` / `update` / `delete` | 验收日报 | 验收日报 |
| `acceptance_procedure:read` | 验收程序列表与导出 | 验收程序 |

### P6 与系统框架

| 权限代码 | 含义 | 主要页面 |
|----------|------|----------|
| `p6_resource:read` / `p6_database:read` | 查看 EPS/WBS/作业分类码/资源/工作步骤/工作包 | EPS 管理、WBS 管理、作业分类码、资源管理、工作包管理、工作步骤管理 |
| `p6_resource:update` / `sync` | 更新/同步 P6 数据 | EPS 管理、资源管理等 |
| `p6_sync:read` / `update` / `delete` / `sync` | P6 同步配置 | P6 同步配置 |
| `facility:read` / `create` / `update` / `delete` | 主项清单 | 主项清单管理 |
| `system:admin` | 工作包增删改、MDR、部分管理员功能 | 工作包管理、外部 MDR 设计管理 |

### 用户与权限

| 权限代码 | 含义 | 主要页面 |
|----------|------|----------|
| `user:read` / `create` / `update` / `delete` | 用户管理 | 账号管理（需 superuser 或权限） |
| `permission:read` / `assign` / `revoke` | 权限管理 | 账号管理 |

### 焊接数据

| 权限代码 | 含义 | 主要页面 |
|----------|------|----------|
| `welding_data:read` | 查看焊接数据 | 诺德焊接数据库管理 |
| `welding_data:config:read` / `create` / `update` / `delete` | 焊接数据配置 | 诺德焊接数据库管理 |
| `welding_data:sync` | 焊接数据同步 | 诺德焊接数据库管理 |

### 范围限制（scope）

日报、计划、工程量、验收等权限支持 scope：若权限记录带 scope，则仅能操作该 scope 的数据；scope 为空表示全范围。

> 完整权限定义以 `init_permissions.py` 为准；`exhibition_report:*` 等展报相关权限在此略过。

---

## 权限分配

- 在「账号管理」中为用户直接分配权限，或通过角色间接分配。
- 可为权限设置 scope 等范围限制（视具体权限类型而定）。
- 超级管理员无需分配即拥有全部权限；工作包等写操作后端仍以「系统管理员」身份校验（超级管理员或 `role_system_admin` 或具备相应接口权限）。

---

## 使用建议

- **分包商用户**：分配 `planning:read` + `daily_report:create` 及对应 scope，用于作业清单查看及日报填报；工程量日报还需 `*_volume:create`。
- **计划/日报管理人员**：分配 `planning:*` + `daily_report:*`（全范围）查看和管理计划与日报。
- **专项计划填报**：分配 `planning:read` + `planning:create`（及 update/delete 视需），可按 scope 限制。
- **验收填报**：分配 `inspection_db:read` + `inspection_db:create`（及可选 update/delete），可按需设置 scope。
- **验收程序查阅**：分配 `acceptance_procedure:read`。
- **工作包仅查看**：分配 `p6_resource:read` 或 `p6_database:read`，与资源管理、工作步骤等一致。
- **工作包增删改**：使用超级管理员或 `role_system_admin` 账号；或执行 `init_permissions.py` 后为指定角色分配 `system:admin`。
- **管理员**：超级管理员自动拥有所有权限；其他管理员账号可通过角色绑定 `system:admin` 等权限。
