# HashiCorp Vault 密钥管理部署指南

## 📚 主要文档

**完整的数据库账号管理和 Vault 配置指南**：请查看 [`DATABASE_ACCOUNT_MANAGEMENT.md`](./DATABASE_ACCOUNT_MANAGEMENT.md)

本文档仅提供 Vault 部署的快速参考。

---

## 快速开始

### 开发/测试环境（5分钟）

**详细指南**：请查看 [`VAULT_QUICKSTART.md`](./VAULT_QUICKSTART.md)

**简要步骤**：
1. 下载 Vault：https://releases.hashicorp.com/vault/
2. 启动开发模式：`vault server -dev`
3. 运行设置脚本：`.\scripts\setup_vault.ps1`
4. 配置环境变量：`VAULT_ADDR` 和 `VAULT_TOKEN`
5. 启动应用验证

### 生产环境

**完整指南**：请查看 [`VAULT_INTEGRATION.md`](./VAULT_INTEGRATION.md)

**关键步骤**：
1. 使用配置文件启动 Vault（非开发模式）
2. 初始化 Vault 并保存 Unseal Keys
3. 创建应用专用的 Token（不要使用 Root Token）
4. 将 Vault 注册为 Windows 服务
5. 配置自动解封（可选）
6. 启用 TLS（推荐）

---

## 环境变量配置（备选方案 - 不推荐）

⚠️ **注意**：此方案仅在没有条件使用 Vault 时作为临时方案。建议尽快迁移到 Vault。

**Windows Server**：
```powershell
[System.Environment]::SetEnvironmentVariable('ROLE_PLANNING_MANAGER_PASSWORD', 'your_password', 'Machine')
[System.Environment]::SetEnvironmentVariable('ROLE_PLANNER_PASSWORD', 'your_password', 'Machine')
```

详细说明请参考 [`DATABASE_ACCOUNT_MANAGEMENT.md`](./DATABASE_ACCOUNT_MANAGEMENT.md) 中的相关章节。

---

## 相关文档

- **完整指南**：`DATABASE_ACCOUNT_MANAGEMENT.md` - 数据库账号管理完整指南
- **Vault 快速开始**：`VAULT_QUICKSTART.md` - 5分钟快速测试
- **Vault 完整集成**：`VAULT_INTEGRATION.md` - 生产环境完整配置
