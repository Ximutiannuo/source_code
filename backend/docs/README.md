# ProjectControls 文档索引

## 📚 核心文档

### 数据库账号管理与权限控制（主要文档）

**📘 [`DATABASE_ACCOUNT_MANAGEMENT.md`](./DATABASE_ACCOUNT_MANAGEMENT.md)**

这是**主要的、完整的**数据库账号管理和权限控制指南，包含：

1. **数据库账号配置** - 创建账号、权限设置、权限验证
2. **HashiCorp Vault 密钥管理** - 业界标准的密钥管理方案
3. **应用层权限隔离** - 权限空值机制详解
4. **新增角色流程** - 快速添加新角色的完整流程
5. **权限验证与故障排查** - 常见问题和解决方案
6. **角色-数据库账号映射** - 映射逻辑说明
7. **安全最佳实践** - 权限、密钥、监控、审计

---

## 📘 专题文档

### HashiCorp Vault 配置

- **`VAULT_INTEGRATION.md`** - Vault 完整集成指南（生产环境）
- **`VAULT_QUICKSTART.md`** - Vault 5分钟快速开始（开发/测试环境）
- **`DEPLOYMENT_SECRETS.md`** - Vault 部署快速参考

---

## 🚀 快速导航

| 需求 | 查看文档 |
|------|---------|
| **了解完整的数据库账号管理** | `DATABASE_ACCOUNT_MANAGEMENT.md` |
| **配置数据库账号和权限** | `DATABASE_ACCOUNT_MANAGEMENT.md` 第一部分 |
| **设置 HashiCorp Vault（快速测试）** | `VAULT_QUICKSTART.md` |
| **设置 HashiCorp Vault（生产环境）** | `VAULT_INTEGRATION.md` |
| **理解权限隔离机制** | `DATABASE_ACCOUNT_MANAGEMENT.md` 第三部分 |
| **添加新的 Planner 角色** | `DATABASE_ACCOUNT_MANAGEMENT.md` 第四部分，或使用 `backend/scripts/add_new_role_complete.ps1` |
| **排查权限或连接问题** | `DATABASE_ACCOUNT_MANAGEMENT.md` 第五部分 |

---

## 相关脚本

### SQL 脚本
- `database/create_role_accounts.sql` - 创建角色数据库账号
- `database/fix_planner_permissions.sql` - 修复权限脚本

### 自动化脚本
- `backend/scripts/add_new_role.sql` - 新增角色 SQL 脚本
- `backend/scripts/add_new_role_complete.ps1` - 新增角色 PowerShell 自动化脚本
- `backend/scripts/setup_vault.ps1` - Vault 设置脚本
- `backend/scripts/verify_windows_secrets.ps1` - 验证 Windows 环境变量脚本

---

## 当前实施方案

- ✅ **数据库账号**：所有 Planner 角色共用 `role_planner` 账号
- ✅ **密钥管理**：HashiCorp Vault（业界标准，满足合规要求）
- ✅ **数据隔离**：应用层权限过滤（权限空值机制）

详细说明请参考 [`DATABASE_ACCOUNT_MANAGEMENT.md`](./DATABASE_ACCOUNT_MANAGEMENT.md)。

---

**最后更新**：2025-01-XX
