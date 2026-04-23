# HashiCorp Vault 快速开始指南

这是最简化的 Vault 设置步骤，用于快速测试和开发环境。

## 🚀 5 分钟快速开始（开发/测试环境）

### 步骤 1：下载 Vault

访问 https://releases.hashicorp.com/vault/ 下载最新版本的 Windows 版本，解压 `vault.exe` 到 `C:\vault`。

### 步骤 2：启动 Vault（开发模式）

```powershell
# 打开 PowerShell，切换到 Vault 目录
cd C:\vault

# 启动开发模式（自动初始化，提供 root token）
.\vault.exe server -dev
```

**保存显示的 Root Token**，例如：
```
Root Token: s.xxxxxxxxxxxxxxxxxxxxxxx
```

**保持这个窗口运行**，不要关闭。

### 步骤 3：在另一个 PowerShell 窗口中配置

```powershell
# 设置环境变量
$env:VAULT_ADDR = "http://127.0.0.1:8200"
$env:VAULT_TOKEN = "s.xxxxxxxxxxxxxxxxxxxxxxx"  # 使用刚才保存的 Root Token

# 验证连接
vault status
```

应该看到 `Sealed: false`，表示 Vault 已就绪。

### 步骤 4：存储密码

使用自动化脚本（推荐）：

```powershell
cd C:\Projects\ProjectControls\backend
.\scripts\setup_vault.ps1
```

脚本会提示输入每个角色的密码，并自动存储到 Vault。

**或者手动存储**：

```powershell
# 启用 KV v2 存储引擎
vault secrets enable -path=secret kv-v2

# 存储密码（替换为实际密码）
vault kv put secret/db-roles/planning_manager username=role_planning_manager password=your_password
vault kv put secret/db-roles/system_admin username=role_system_admin password=your_password
vault kv put secret/db-roles/planning_supervisor username=role_planning_supervisor password=your_password
vault kv put secret/db-roles/planner username=role_planner password=your_password
```

### 步骤 5：配置应用

```powershell
# 设置系统环境变量（以管理员身份运行）
[System.Environment]::SetEnvironmentVariable('VAULT_ADDR', 'http://127.0.0.1:8200', 'Machine')
[System.Environment]::SetEnvironmentVariable('VAULT_TOKEN', 's.xxxxxxxxxxxxxxxxxxxxxxx', 'Machine')

# 安装 Python 依赖
cd C:\Projects\ProjectControls\backend
.\myenv\Scripts\pip.exe install hvac
```

### 步骤 6：启动应用并验证

```powershell
# 启动应用
cd C:\Projects\ProjectControls\backend
.\myenv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8200
```

查看启动日志，应该看到：
```
INFO: 检测到 Vault 配置 (VAULT_ADDR=http://127.0.0.1:8200)，使用 Vault 模式
INFO: 成功连接到 Vault (http://127.0.0.1:8200)
```

## ✅ 验证存储的密码

```powershell
# 查看所有角色
vault kv list secret/db-roles

# 查看特定角色（不显示密码）
vault kv get secret/db-roles/planning_manager

# 查看密码（谨慎使用）
vault kv get -field=password secret/db-roles/planning_manager
```

## 🔄 迁移到生产环境

开发环境测试成功后，请按照 `VAULT_INTEGRATION.md` 中的完整指南配置生产环境：

1. 使用配置文件启动 Vault（非开发模式）
2. 初始化 Vault 并保存 Unseal Keys
3. 创建应用专用的 Token（不要使用 Root Token）
4. 将 Vault 注册为 Windows 服务
5. 配置自动解封（可选）
6. 启用 TLS（推荐）
7. 配置备份策略

详见：`backend/docs/VAULT_INTEGRATION.md`

## ❓ 常见问题

### Q: 开发模式和生产模式有什么区别？

**A**: 
- **开发模式**：自动初始化，提供 Root Token，数据存储在内存中（重启后丢失），**仅用于测试**
- **生产模式**：需要手动初始化，使用配置文件，数据持久化，需要解封，**用于生产环境**

### Q: 我可以直接在生产环境使用开发模式吗？

**A**: **绝对不行！** 开发模式不安全，数据不持久化，只能用于测试。

### Q: Root Token 丢失了怎么办？

**A**: 
- 开发模式：重启 Vault，会生成新的 Root Token
- 生产模式：如果丢失 Root Token 和所有 Unseal Keys，**无法恢复数据**。请务必安全备份！

### Q: 如何更新密码？

**A**: 使用相同的 `vault kv put` 命令即可更新：

```powershell
vault kv put secret/db-roles/planning_manager username=role_planning_manager password=new_password
```

应用会在下次请求时自动获取新密码（SecretManager 有缓存，可能需要重启应用）。

### Q: 生产环境登录时报错 `Access denied for user 'root'@'localhost'`？

**A**: 说明后端没有从 Vault 拿到数据库角色凭据，回退到了默认的 root 账号（且密码不对）。按下面步骤处理：

1. **确认 Vault 里已有各角色密码**（尤其是 system_admin，用于默认连接）：
   ```powershell
   $env:VAULT_ADDR = "http://127.0.0.1:8200"
   $env:VAULT_TOKEN = "你的root或可读db-roles的token"
   vault kv list secret/db-roles
   vault kv get secret/db-roles/system_admin
   ```
   若没有或缺失，用 root token 运行 **`backend\scripts\setup_vault.py`**（或 `setup_vault.ps1`）按提示写入各角色密码。

2. **确认 Start-All-Services.ps1 使用的 VAULT_TOKEN 能读 db-roles**（例如用 root token 或已配置 app-policy 的 token），然后重新执行一次：
   ```powershell
   $env:VAULT_TOKEN = "你的有效token"
   .\Start-All-Services.ps1
   ```

3. **重启后端服务**，让进程重新用当前环境连接 Vault 并读取凭据：
   ```powershell
   Restart-Service ProjectControlsBackend
   ```

---

**完成！** 现在您的应用已配置为使用 Vault 管理密码。这是业界标准的做法，满足合规要求。
