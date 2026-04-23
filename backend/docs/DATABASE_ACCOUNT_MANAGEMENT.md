# 数据库账号管理与权限控制完整指南

## 概述

本系统采用**基于角色的数据库访问控制**，结合**HashiCorp Vault 密钥管理**和**应用层权限过滤**，实现安全、灵活的数据库访问管理。

### 核心架构

1. **数据库层**：为每个角色创建专属数据库账号（最小权限原则）
2. **密钥管理层**：使用 HashiCorp Vault 管理数据库账号密码（业界标准）
3. **应用层**：通过 `PermissionService` 实现细粒度数据隔离（权限空值机制）

---

## 第一部分：数据库账号配置

### 1.1 账号创建

执行 SQL 脚本创建角色数据库账号：

```bash
mysql -u root -p < database/create_role_accounts.sql
```

**重要**：执行前请修改脚本中的密码（当前为 `cc7@1234`，生产环境必须修改！）

### 1.2 角色账号列表

| 角色名称        | 数据库账号                   | 权限范围                                              | 说明                                              |
| --------------- | ---------------------------- | ----------------------------------------------------- | ------------------------------------------------- |
| 计划经理        | `role_planning_manager`    | 可读写 `projectcontrols`，只读 `proecomcontrol`   | 包含 DDL 权限（CREATE, INDEX, ALTER, REFERENCES） |
| 系统管理员      | `role_system_admin`        | 所有权限（`projectcontrols` 和 `proecomcontrol`） | 类似 root，但仅限这两个数据库                     |
| 计划主管        | `role_planning_supervisor` | 可读写 `projectcontrols`，只读 `proecomcontrol`   | 包含 DDL 权限                                     |
| Planner（所有） | `role_planner`             | 可读写 `projectcontrols`，只读 `proecomcontrol`   | 所有 Planner 角色共用此账号，包含 DDL 权限        |

**注意**：所有 Planner 角色（C01Planner、C19Planner 等）共用 `role_planner` 数据库账号，数据隔离通过应用层权限实现。

### 1.3 权限说明

#### 必需权限

所有账号都需要以下权限：

- `SELECT, INSERT, UPDATE, DELETE` - 基本 DML 操作
- `CREATE, INDEX, ALTER, REFERENCES` - DDL 操作（支持应用启动时的表创建和索引创建）

**为什么需要 DDL 权限？**

1. 应用启动时执行 `Base.metadata.create_all(bind=engine)`，可能需要创建表
2. 模型中的索引定义（`__table_args__` 中的 `Index`）需要 `CREATE INDEX` 权限
3. 外键约束需要 `REFERENCES` 权限
4. 作为安全边界，避免权限不足导致的错误

**安全考虑**：

- ✅ 权限限制在特定数据库（`gcc.projectcontrols` 和 `gcc.proecomcontrol`）
- ✅ 不能创建/删除数据库
- ✅ 不能访问其他数据库
- ✅ 不能授予权限（GRANT）
- ✅ 应用层权限过滤提供额外的安全层

### 1.4 权限验证

```sql
-- 查看账号权限
SHOW GRANTS FOR 'role_planner'@'%';
SHOW GRANTS FOR 'role_planning_manager'@'%';

-- 应该看到：
-- GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER, REFERENCES ON `gcc`.`projectcontrols`.* TO `role_planner`@`%`
-- GRANT SELECT ON `gcc`.`proecomcontrol`.* TO `role_planner`@`%`
```

### 1.5 权限修复

如果发现权限不足，执行修复脚本：

```bash
mysql -u root -p < database/fix_planner_permissions.sql
```

---

## 第二部分：HashiCorp Vault 密钥管理（推荐方案）

### 2.1 为什么使用 Vault？

- ✅ **业界标准**：被广泛采用的密钥管理工具
- ✅ **完全免费**：开源版本功能完整，无任何限制
- ✅ **满足合规**：完全符合 PCI DSS、HIPAA、SOC 2、ISO 27001 等合规要求
- ✅ **完整审计**：详细的访问和操作日志，满足审计要求
- ✅ **自动轮换**：支持自动密码轮换策略
- ✅ **加密存储**：所有密码都加密存储

### 2.2 快速开始（5分钟）

#### 步骤 1：下载并安装 Vault

访问 https://releases.hashicorp.com/vault/ 下载 Windows 版本，解压 `vault.exe` 到 `C:\vault`。

#### 步骤 2：启动 Vault（开发模式测试）

```powershell
cd C:\vault
.\vault.exe server -dev
```

**保存显示的 Root Token**（例如：`s.xxxxxxxxxxxxxxxxxxxxxxx`）

保持这个窗口运行。

#### 步骤 3：运行设置脚本

在另一个 PowerShell 窗口中：

```powershell
cd C:\Projects\ProjectControls\backend
.\scripts\setup_vault.ps1
```

脚本会：

- 验证 Vault 连接
- 启用 KV v2 存储引擎
- 安全地提示输入每个角色的密码（密码不显示在屏幕上）
- 将密码存储到 Vault
- 验证存储结果

#### 步骤 4：配置应用环境变量

```powershell
# 以管理员身份运行
[System.Environment]::SetEnvironmentVariable('VAULT_ADDR', 'http://127.0.0.1:8200', 'Machine')
[System.Environment]::SetEnvironmentVariable('VAULT_TOKEN', 's.xxxxxxxxxxxxxxxxxxxxxxx', 'Machine')  # 使用保存的 Root Token
```

#### 步骤 5：启动应用并验证

```powershell
cd C:\Projects\ProjectControls\backend
.\myenv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8200
```

查看日志，应该看到：

```
INFO: 检测到 Vault 配置 (VAULT_ADDR=http://127.0.0.1:8200)，使用 Vault 模式（业界标准，满足合规要求）
INFO: 成功连接到 Vault (http://127.0.0.1:8200)
```

### 2.3 生产环境配置

**完整的生产环境配置指南**：请查看 `backend/docs/VAULT_INTEGRATION.md`

**关键步骤**：

1. 使用配置文件启动 Vault（非开发模式）
2. 初始化 Vault 并保存 Unseal Keys
3. 创建应用专用的 Token（不要使用 Root Token）
4. 将 Vault 注册为 Windows 服务
5. 配置自动解封（可选）
6. 启用 TLS（推荐）

### 2.4 Vault 路径结构

应用使用的 Vault 路径结构：

```
secret/data/db-roles/
  ├── planning_manager/
  │   └── data: { username: "role_planning_manager", password: "..." }
  ├── system_admin/
  │   └── data: { username: "role_system_admin", password: "..." }
  ├── planning_supervisor/
  │   └── data: { username: "role_planning_supervisor", password: "..." }
  └── planner/
      └── data: { username: "role_planner", password: "..." }
```

### 2.5 备选方案：环境变量（不推荐）

如果暂时无法使用 Vault，可以使用环境变量作为临时方案：

**Windows Server**：

```powershell
[System.Environment]::SetEnvironmentVariable('ROLE_PLANNING_MANAGER_PASSWORD', 'your_password', 'Machine')
[System.Environment]::SetEnvironmentVariable('ROLE_PLANNER_PASSWORD', 'your_password', 'Machine')
```

**注意**：环境变量方案是折中方案，可能无法满足严格的合规审计要求。建议尽快迁移到 Vault。

---

## 第三部分：应用层权限隔离（权限空值机制）

### 3.1 核心原理

所有 Planner 角色共用同一个数据库账号（`role_planner`），但通过**应用层的权限过滤机制**实现数据隔离。

**权限空值机制**：

- 权限字段为 **NULL（空值）** = 该维度**无限制**（全权限）
- 权限字段**有值** = 该维度**有限制**（只能访问匹配的数据）

### 3.2 权限字段说明

权限范围字段（`PermissionScope`）：

- `scope`: SCOPE 维度（例如：C01、C19）
- `block`: Block 维度（最小单位，精确匹配）
- `discipline`: 专业维度
- `work_package`: 工作包维度
- `project`, `subproject`, `train`, `unit`, `main_block`, `quarter`, `simple_block`, `facility_id`, `resource_id`: 其他维度

### 3.3 数据隔离实现

在 API 端点中，使用 `PermissionService.filter_by_permission()` 自动过滤数据：

```python
@router.get("/mpdb")
def get_mpdb_entries(
    current_user: User = Depends(require_permission("daily_report:read")),
    db: Session = Depends(get_db)
):
    query = db.query(MPDB)
  
    # 根据用户权限自动过滤数据
    query = PermissionService.filter_by_permission(
        db, current_user, query, "daily_report:read",
        {
            "scope": "scope",
            "block": "block",
            "discipline": "discipline",
            "work_package": "work_package"
        }
    )
  
    return query.all()
```

**工作原理**：

1. `PermissionService` 查询 `user_permissions` 和 `role_permissions` 表
2. 根据权限字段构建 WHERE 条件
3. 自动添加到 SQL 查询中

**示例**：

- C01Planner 用户查询时：自动添加 `WHERE scope = 'C01'`
- C19Planner 用户查询时：自动添加 `WHERE scope = 'C19'`

虽然使用同一个数据库账号，但应用层会自动添加不同的过滤条件，实现数据隔离。

### 3.4 权限配置示例

为 C01Planner 配置权限：

```sql
-- 假设 C01Planner 角色 ID 是 5，daily_report:read 权限 ID 是 1
INSERT INTO role_permissions (
    role_id, permission_id, scope, block, discipline, work_package, ...
) VALUES (
    5, 1, 'C01', NULL, NULL, NULL, ...
);
```

结果：C01Planner 只能访问 `scope = 'C01'` 的数据，但可以访问 C01 下的所有 block、discipline、work_package。

### 3.5 层级关系支持

- **Subproject 层级**：如果权限有 `subproject`，数据可以是相同的 `subproject`、属于该 `subproject` 的 `facility_id` 或 `block`
- **Facility 层级**：如果权限有 `facility_id`，数据可以是相同的 `facility_id` 或属于该 `facility` 的 `block`
- **Work Package 层级**：如果权限有 `work_package`，数据可以是相同的 `work_package` 或属于该 `work_package` 的 `resource_id`（通过 `rsc_defines` 表映射）

---

## 第四部分：新增角色流程

### 4.1 快速流程（方案1：共用账号）

使用自动化脚本：

```powershell
cd C:\Projects\ProjectControls\backend
.\scripts\add_new_role_complete.ps1 -RoleName "C20Planner" -Scope "C20"
```

或者使用 SQL 脚本：

```bash
# 1. 修改脚本中的角色名称和描述
# 编辑 backend/scripts/add_new_role.sql，修改：
#   SET @role_name = 'C20Planner';
#   SET @role_description = 'C20计划，负责计划管理与日报填报。';

# 2. 执行脚本
mysql -u root -p projectcontrols < backend/scripts/add_new_role.sql
```

### 4.2 手动流程

#### 步骤 1：创建角色

```sql
INSERT INTO roles (name, description, is_active) 
VALUES ('C20Planner', 'C20计划，负责计划管理与日报填报。', 1);
```

#### 步骤 2：配置权限

```sql
-- 获取角色 ID 和权限 ID
SELECT @role_id := id FROM roles WHERE name = 'C20Planner';
SELECT @perm_read := id FROM permissions WHERE code = 'daily_report:read';
SELECT @perm_create := id FROM permissions WHERE code = 'daily_report:create';
SELECT @perm_update := id FROM permissions WHERE code = 'daily_report:update';
SELECT @perm_planning := id FROM permissions WHERE code = 'planning:read';

-- 配置权限（scope = 'C20'，其他字段为 NULL 表示无限制）
INSERT INTO role_permissions (role_id, permission_id, scope, block, discipline, work_package, ...)
VALUES 
    (@role_id, @perm_read, 'C20', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (@role_id, @perm_create, 'C20', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (@role_id, @perm_update, 'C20', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (@role_id, @perm_planning, 'C20', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
```

#### 步骤 3：为用户分配角色

```sql
INSERT INTO user_roles (user_id, role_id) 
SELECT 用户ID, id FROM roles WHERE name = 'C20Planner';
```

#### 步骤 4：验证

```sql
-- 验证角色和权限
SELECT 
    r.name AS role_name,
    p.code AS permission_code,
    rp.scope,
    rp.block
FROM roles r
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE r.name = 'C20Planner';

-- 验证用户角色关联
SELECT u.username, r.name 
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE r.name = 'C20Planner';
```

**完成！** 无需配置数据库账号（所有 Planner 共用 `role_planner` 账号）。

---

## 第五部分：权限验证与故障排查

### 5.1 权限验证清单

- [ ] 数据库账号已创建：`SELECT User FROM mysql.user WHERE User LIKE 'role_%'`
- [ ] 账号权限正确：`SHOW GRANTS FOR 'role_planner'@'%'`
- [ ] Vault 连接正常：查看应用日志，确认 `INFO: 成功连接到 Vault`
- [ ] 角色已创建：`SELECT * FROM roles WHERE name = 'C20Planner'`
- [ ] 权限已配置：`SELECT * FROM role_permissions WHERE role_id = ?`
- [ ] 用户已关联角色：`SELECT * FROM user_roles WHERE user_id = ?`
- [ ] 应用日志无错误：查看应用启动日志

### 5.2 常见问题

#### 问题 1：应用启动失败，提示权限不足

**症状**：

```
Access denied for user 'role_planner'@'%' to database 'projectcontrols'
Access denied; you need the CREATE privilege
```

**解决方案**：

1. 检查账号权限：`SHOW GRANTS FOR 'role_planner'@'%'`
2. 如果权限不足，执行修复脚本：`mysql -u root -p < database/fix_planner_permissions.sql`

#### 问题 2：Vault 连接失败

**症状**：

```
ERROR: 无法连接到 Vault
ERROR: Vault 认证失败
```

**解决方案**：

1. 检查 Vault 服务是否运行：`Get-Service Vault`（如果注册为服务）
2. 检查环境变量：`$env:VAULT_ADDR` 和 `$env:VAULT_TOKEN`
3. 测试连接：`vault status`
4. 验证 Token：确保 Token 有效且未过期

#### 问题 3：用户登录后无法访问数据

**可能原因**：

1. 用户没有分配角色
2. 角色没有配置权限
3. 权限范围配置错误

**解决方案**：

1. 检查用户角色：`SELECT * FROM user_roles WHERE user_id = ?`
2. 检查角色权限：`SELECT * FROM role_permissions WHERE role_id = ?`
3. 检查权限范围：确认 `scope`、`block` 等字段配置正确
4. 查看应用日志：确认 `PermissionService.filter_by_permission` 是否正确执行

#### 问题 4：权限过滤不生效

**检查**：

1. API 是否使用了 `PermissionService.filter_by_permission()`（**必须使用**）
2. 权限字段映射是否正确（`scope_field_mapping`）
3. 数据库账号是否使用正确的角色账号连接

**重要**：所有查询必须通过 `PermissionService.filter_by_permission()` 过滤，否则可能泄露数据。

#### 问题 5：环境变量未生效

**解决方案**：

1. 确认环境变量名称正确（大小写敏感）
2. 重启应用服务（环境变量更改后必须重启）
3. 如果使用 Windows 服务：`Restart-Service ProjectControlsAPI`
4. 如果手动启动：关闭 PowerShell 窗口，重新打开并启动应用

---

## 第六部分：角色-数据库账号映射

### 6.1 映射逻辑

在 `backend/app/config.py` 的 `get_role_database_url()` 方法中：

```python
# 固定角色映射
role_mapping = {
    '计划经理': 'PLANNING_MANAGER',
    '系统管理员': 'SYSTEM_ADMIN',
    '计划主管': 'PLANNING_SUPERVISOR',
}

# 所有 Planner 角色（C01Planner, C19Planner, Planner 等）
# 共用 role_planner 数据库账号
if role_name.endswith('Planner') or role_name == 'Planner':
    role_key = 'PLANNER'  # 映射到 role_planner 账号
```

**工作流程**：

1. 用户登录 → `get_current_user` 获取用户信息
2. 提取用户的主要角色 → 设置到 `current_role_context`
3. 后续 `get_db()` 调用 → 从 `current_role_context` 获取角色
4. 根据角色映射获取数据库 URL → 使用 Vault 或环境变量获取密码
5. 创建/获取对应的数据库连接

### 6.2 映射表

| 平台角色名称 | 内部角色 Key            | 数据库账号                   | Vault 路径                                   |
| ------------ | ----------------------- | ---------------------------- | -------------------------------------------- |
| 计划经理     | `PLANNING_MANAGER`    | `role_planning_manager`    | `secret/data/db-roles/planning_manager`    |
| 系统管理员   | `SYSTEM_ADMIN`        | `role_system_admin`        | `secret/data/db-roles/system_admin`        |
| 计划主管     | `PLANNING_SUPERVISOR` | `role_planning_supervisor` | `secret/data/db-roles/planning_supervisor` |
| C01Planner   | `PLANNER`             | `role_planner`             | `secret/data/db-roles/planner`             |
| C19Planner   | `PLANNER`             | `role_planner`             | `secret/data/db-roles/planner`             |
| Planner      | `PLANNER`             | `role_planner`             | `secret/data/db-roles/planner`             |

**注意**：所有以 `Planner` 结尾的角色都映射到 `PLANNER` key，使用 `role_planner` 数据库账号。

---

## 第七部分：安全最佳实践

### 7.1 数据库账号权限

- ✅ **最小权限原则**：只授予必要的权限
- ✅ **限制数据库范围**：只能访问 `gcc.projectcontrols` 和 `gcc.proecomcontrol`
- ✅ **不授予危险权限**：DROP、GRANT、FILE、SUPER 等
- ✅ **定期审查权限**：定期检查账号权限是否符合需求

### 7.2 密钥管理

- ✅ **使用 HashiCorp Vault**：生产环境推荐方案
- ✅ **不使用 Root Token 运行应用**：创建专用的应用 Token
- ✅ **定期轮换 Token**：设置 Token TTL，定期更新
- ✅ **使用最小权限策略**：只授予应用必需的权限

### 7.3 应用层权限

- ✅ **必须使用 PermissionService**：所有查询必须通过权限过滤
- ✅ **权限字段为空值 = 全权限**：理解权限空值机制
- ✅ **定期审查权限配置**：确保权限配置符合业务需求
- ✅ **启用审计日志**：记录权限变更和访问日志

### 7.4 监控和审计

- ✅ **监控 Vault 服务状态**：确保服务正常运行
- ✅ **监控数据库连接**：监控连接池使用情况
- ✅ **启用 MySQL 审计日志**：记录数据库操作
- ✅ **记录应用日志**：记录角色切换和权限检查

---

## 相关文件

### SQL 脚本

- `database/create_role_accounts.sql` - 创建角色数据库账号（方案1：共用账号）
- `database/fix_planner_permissions.sql` - 修复权限脚本

### 自动化脚本

- `backend/scripts/add_new_role.sql` - 新增角色 SQL 脚本（方案1）
- `backend/scripts/add_new_role_complete.ps1` - 新增角色 PowerShell 自动化脚本
- `backend/scripts/setup_vault.ps1` - Vault 设置脚本
- `backend/scripts/verify_windows_secrets.ps1` - 验证 Windows 环境变量脚本

### 代码文件

- `backend/app/config.py` - 配置管理（角色映射）
- `backend/app/database.py` - 数据库连接管理（动态连接选择）
- `backend/app/dependencies.py` - 依赖注入（角色上下文设置）
- `backend/app/services/secret_manager.py` - 密钥管理（Vault/环境变量/加密文件）
- `backend/app/services/permission_service.py` - 权限服务（应用层数据过滤）

### 文档

- `backend/docs/VAULT_INTEGRATION.md` - Vault 完整集成指南（生产环境）
- `backend/docs/VAULT_QUICKSTART.md` - Vault 5分钟快速开始（开发/测试环境）
- `backend/docs/DEPLOYMENT_SECRETS.md` - Vault 部署快速参考

---

## 总结

### 当前实现的方案

1. **数据库账号**：方案1（所有 Planner 共用 `role_planner` 账号）
2. **密钥管理**：HashiCorp Vault（业界标准，满足合规要求）
3. **数据隔离**：应用层权限过滤（权限空值机制）

### 优势

- ✅ **简化管理**：只需要一个 `role_planner` 账号
- ✅ **灵活控制**：应用层权限支持细粒度控制
- ✅ **满足合规**：HashiCorp Vault 符合各种合规要求
- ✅ **统一机制**：所有角色使用相同的权限机制

### 关键点

- **权限空值机制**：字段为 NULL = 无限制，有值 = 有限制
- **必须使用 PermissionService**：所有查询必须通过权限过滤
- **Vault 是标准做法**：满足审计要求，推荐用于生产环境

---

**最后更新**：2026-01-XX
**维护者**：系统管理员
