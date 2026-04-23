# HashiCorp Vault 集成方案（业界标准，完全免费）

## ✅ 为什么选择 Vault？

- ✅ **业界标准**：被广泛采用的密钥管理工具
- ✅ **完全免费**：开源版本功能完整，无任何限制
- ✅ **满足合规**：完全符合 PCI DSS、HIPAA、SOC 2、ISO 27001 等合规要求
- ✅ **完整审计**：详细的访问和操作日志，满足审计要求
- ✅ **自动轮换**：支持自动密码轮换策略
- ✅ **加密存储**：所有密码都加密存储
- ✅ **细粒度访问控制**：基于策略的访问控制（RBAC）

## 📋 完整实施指南（Windows Server）

### 🚀 快速开始

如果您无法直接访问 HashiCorp 官网，可以使用我们提供的自动安装脚本：

```powershell
# 进入脚本目录
cd C:\Projects\ProjectControls\backend\scripts

# 方式1：使用自动安装脚本（会尝试多个下载源）
.\install_vault.ps1

# 方式2：指定版本
.\install_vault.ps1 -Version "1.21.2"

# 方式3：使用代理
.\install_vault.ps1 -ProxyUrl "http://proxy.example.com:8080"

# 方式4：使用 Chocolatey（如果已安装）
.\install_vault.ps1 -UseChocolatey

# 方式5：使用 Scoop（如果已安装）
.\install_vault.ps1 -UseScoop
```

### 步骤 1：下载和安装 Vault

#### 方式1：使用 Chocolatey 安装（推荐，国内友好）

```powershell
# 1. 安装 Chocolatey（如果还没有）
# 以管理员身份运行 PowerShell，执行：
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# 2. 使用 Chocolatey 安装 Vault
choco install vault -y

# 3. 验证安装
vault version
```

**优点**：自动处理 PATH，版本管理简单，国内访问相对稳定

#### 方式2：使用 Scoop 安装

```powershell
# 1. 安装 Scoop（如果还没有）
# 以管理员身份运行 PowerShell，执行：
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex

# 2. 使用 Scoop 安装 Vault
scoop install vault

# 3. 验证安装
vault version
```

#### 方式3：通过代理服务器下载

如果您有可用的代理服务器：

```powershell
# 1. 设置代理环境变量（临时）
$env:HTTP_PROXY = "http://proxy.example.com:8080"
$env:HTTPS_PROXY = "http://proxy.example.com:8080"

# 2. 使用 PowerShell 下载最新版本
# 先获取最新版本号
$latestVersion = "1.21.2"  # 替换为实际最新版本

# 3. 下载 Windows 64位版本
$downloadUrl = "https://releases.hashicorp.com/vault/$latestVersion/vault_${latestVersion}_windows_amd64.zip"
$outputPath = "$env:TEMP\vault.zip"
Invoke-WebRequest -Uri $downloadUrl -OutFile $outputPath -Proxy $env:HTTP_PROXY

# 4. 解压到 C:\vault
New-Item -ItemType Directory -Path "C:\vault" -Force
Expand-Archive -Path $outputPath -DestinationPath "C:\vault" -Force

# 5. 添加到系统 PATH
[System.Environment]::SetEnvironmentVariable('PATH', "$env:PATH;C:\vault", 'Machine')

# 6. 刷新环境变量（重新打开 PowerShell）
# 验证安装
vault version
```

#### 方式4：使用国内镜像或替代下载源

##### 选项A：使用 GitHub Releases（如果可以访问）

```powershell
# HashiCorp 在 GitHub 也发布：https://github.com/hashicorp/vault/releases
# 下载地址格式：https://github.com/hashicorp/vault/releases/download/v{VERSION}/vault_{VERSION}_windows_amd64.zip

$version = "1.21.2"  # 替换为实际最新版本
$downloadUrl = "https://github.com/hashicorp/vault/releases/download/v$version/vault_${version}_windows_amd64.zip"
$outputPath = "$env:TEMP\vault.zip"

Invoke-WebRequest -Uri $downloadUrl -OutFile $outputPath

# 解压到 C:\vault
New-Item -ItemType Directory -Path "C:\vault" -Force
Expand-Archive -Path $outputPath -DestinationPath "C:\vault" -Force

# 添加到系统 PATH
[System.Environment]::SetEnvironmentVariable('PATH', "$env:PATH;C:\vault", 'Machine')
```

##### 选项B：手动下载（通过其他设备）

如果可以通过其他设备访问官网：

1. **在其他设备上访问** `https://releases.hashicorp.com/vault/`
2. **下载** 最新版本的 Windows 64位版本（例如：`vault_1.21.2_windows_amd64.zip`）
3. **传输到目标服务器**（通过 U盘、网络共享等）
4. **在目标服务器上解压**：

```powershell
# 假设下载文件在 D:\Downloads\vault_1.21.2_windows_amd64.zip
$zipPath = "D:\Downloads\vault_1.21.2_windows_amd64.zip"  # 修改为实际路径

# 解压到 C:\vault
New-Item -ItemType Directory -Path "C:\vault" -Force
Expand-Archive -Path $zipPath -DestinationPath "C:\vault" -Force

# 添加到系统 PATH
[System.Environment]::SetEnvironmentVariable('PATH', "$env:PATH;C:\vault", 'Machine')

# 验证安装
vault version
```

##### 选项C：使用第三方镜像站

一些社区维护的镜像站可能提供 Vault 下载：
- 清华大学开源软件镜像站（如果提供）
- 阿里云镜像（如果提供）
- 其他企业内网镜像

#### 方式5：使用下载脚本（自动化）

创建一个 PowerShell 脚本来自动下载和安装：

```powershell
# 保存为 install-vault.ps1

param(
    [string]$Version = "1.21.2",
    [string]$InstallPath = "C:\vault",
    [string]$ProxyUrl = $null
)

Write-Host "正在安装 Vault $Version..." -ForegroundColor Green

# 设置代理（如果提供）
if ($ProxyUrl) {
    $env:HTTP_PROXY = $ProxyUrl
    $env:HTTPS_PROXY = $ProxyUrl
    Write-Host "使用代理: $ProxyUrl" -ForegroundColor Yellow
}

# 创建安装目录
New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null

# 尝试多个下载源
$sources = @(
    "https://releases.hashicorp.com/vault/$Version/vault_${Version}_windows_amd64.zip",
    "https://github.com/hashicorp/vault/releases/download/v$Version/vault_${Version}_windows_amd64.zip"
)

$zipPath = "$env:TEMP\vault_${Version}_windows_amd64.zip"
$downloaded = $false

foreach ($url in $sources) {
    try {
        Write-Host "尝试从 $url 下载..." -ForegroundColor Cyan
        Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing -ErrorAction Stop
        $downloaded = $true
        Write-Host "下载成功！" -ForegroundColor Green
        break
    } catch {
        Write-Host "下载失败: $_" -ForegroundColor Red
        continue
    }
}

if (-not $downloaded) {
    Write-Host "所有下载源均失败，请手动下载或使用其他方式安装" -ForegroundColor Red
    exit 1
}

# 解压
Write-Host "正在解压..." -ForegroundColor Cyan
Expand-Archive -Path $zipPath -DestinationPath $InstallPath -Force

# 添加到 PATH
$currentPath = [System.Environment]::GetEnvironmentVariable('PATH', 'Machine')
if ($currentPath -notlike "*$InstallPath*") {
    [System.Environment]::SetEnvironmentVariable('PATH', "$currentPath;$InstallPath", 'Machine')
    Write-Host "已添加到系统 PATH" -ForegroundColor Green
}

# 验证安装
Write-Host "验证安装..." -ForegroundColor Cyan
$env:PATH = [System.Environment]::GetEnvironmentVariable('PATH', 'Machine')
& "$InstallPath\vault.exe" version

Write-Host "安装完成！" -ForegroundColor Green
Write-Host "如果 vault version 命令失败，请重新打开 PowerShell 窗口" -ForegroundColor Yellow

# 清理临时文件
Remove-Item $zipPath -Force
```

**使用方法**：

```powershell
# 基本使用
.\install-vault.ps1

# 指定版本
.\install-vault.ps1 -Version "1.21.2"

# 使用代理
.\install-vault.ps1 -Version "1.21.2" -ProxyUrl "http://proxy.example.com:8080"

# 指定安装路径
.\install-vault.ps1 -InstallPath "D:\tools\vault"
```

### 步骤 2：配置 Vault（生产环境）

#### 创建 Vault 配置文件

创建 `C:\vault\config.hcl`：

```hcl
# Vault 配置文件（生产环境）

# 存储后端：使用文件系统（生产环境建议使用 Consul 或其他分布式存储）
storage "file" {
  path = "C:/vault/data"
}

# 监听器配置
listener "tcp" {
  address     = "127.0.0.1:8200"
  tls_disable = 1  # 生产环境应该启用 TLS，使用 TLS 证书
  # tls_cert_file = "C:/vault/tls/vault.crt"
  # tls_key_file  = "C:/vault/tls/vault.key"
}

# API 地址
api_addr = "http://127.0.0.1:8200"
cluster_addr = "https://127.0.0.1:8201"

# 日志级别
log_level = "INFO"
log_file = "C:/vault/logs/vault.log"
```

#### 创建必要的目录

```powershell
# 创建数据目录
New-Item -ItemType Directory -Path "C:\vault\data" -Force

# 创建日志目录
New-Item -ItemType Directory -Path "C:\vault\logs" -Force
```

### 步骤 3：启动 Vault

#### 开发模式（仅用于测试）

```powershell
# 开发模式（仅用于测试和学习）
# 会自动提供 root token，不要用于生产环境
vault server -dev
```

**注意**：开发模式启动后，会显示 `Root Token`，请保存好这个 token。

#### 生产模式（使用配置文件）

```powershell
# 方式1：使用 PowerShell 启动（前台运行，用于测试）
vault server -config=C:\vault\config.hcl

# 方式2：使用 NSSM 注册为 Windows 服务（推荐用于生产环境）
# 见下面的"将 Vault 注册为 Windows 服务"部分
```

### 步骤 4：初始化 Vault（仅生产模式需要）

如果使用生产模式（非 `-dev`），需要初始化：

```powershell
# 设置 Vault 地址
$env:VAULT_ADDR = "http://127.0.0.1:8200"

# 初始化 Vault（只执行一次）
vault operator init

# 输出示例：
# Unseal Key 1: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Unseal Key 2: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Unseal Key 3: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Unseal Key 4: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Unseal Key 5: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Initial Root Token: s.xxxxxxxxxxxxxxxxxxxxxxx
```

**⚠️ 重要**：
- 保存所有 5 个 Unseal Keys 和 Initial Root Token
- 这些信息一旦丢失，将无法恢复 Vault 中的数据
- 建议将 Unseal Keys 存储在安全的离线位置

#### 解封 Vault（每次启动后需要）

```powershell
# Vault 启动后默认处于封存状态，需要解封才能使用
# 需要提供至少 3 个 Unseal Keys

vault operator unseal <Unseal Key 1>
vault operator unseal <Unseal Key 2>
vault operator unseal <Unseal Key 3>

# 验证状态
vault status
```

### 步骤 5：启用 KV v2 存储引擎并存储密码

#### 启用 KV v2 存储引擎

```powershell
# 设置 Vault 地址和 Token
$env:VAULT_ADDR = "http://127.0.0.1:8200"
$env:VAULT_TOKEN = "<你的 Root Token>"  # 开发模式从启动日志中获取

# 启用 KV v2 存储引擎
vault secrets enable -path=secret kv-v2

# 验证
vault secrets list
```

#### 使用自动化脚本存储密码（推荐）

使用提供的 PowerShell 脚本：

```powershell
cd C:\Projects\ProjectControls\backend
.\scripts\setup_vault.ps1 -VaultAddr "http://127.0.0.1:8200"
```

脚本会：
1. 验证 Vault 连接
2. 检查并启用 KV v2 存储引擎
3. 安全地提示输入每个角色的密码（密码不会显示在屏幕上）
4. 将密码存储到 Vault
5. 验证存储结果

#### 手动存储密码（备选）

```powershell
# 设置 Vault 地址和 Token
$env:VAULT_ADDR = "http://127.0.0.1:8200"
$env:VAULT_TOKEN = "<你的 Root Token>"

# 存储角色密码
vault kv put secret/db-roles/planning_manager username=role_planning_manager password=your_password_here
vault kv put secret/db-roles/system_admin username=role_system_admin password=your_password_here
vault kv put secret/db-roles/planning_supervisor username=role_planning_supervisor password=your_password_here
vault kv put secret/db-roles/planner username=role_planner password=your_password_here
```

### 步骤 6：创建应用专用的 Vault Token（生产环境推荐）

为了安全，不应该使用 Root Token 运行应用。应该创建一个专用的 Token：

```powershell
# 1. 创建策略文件（限制应用只能读取特定的密钥路径）
# 创建 C:\vault\policies\app-policy.hcl

# app-policy.hcl 内容：
path "secret/data/db-roles/*" {
  capabilities = ["read"]
}

# 2. 写入策略
vault policy write app-policy C:\vault\policies\app-policy.hcl

# 3. 创建应用专用的 Token（使用刚才创建的策略）
vault token create -policy=app-policy -ttl=0

# 输出示例：
# Key                  Value
# ---                  -----
# token                s.xxxxxxxxxxxxxxxxxxxxxxx
# token_accessor       xxxxxxxxxxxxxxxxxxxxxxxx
# token_duration       0s
# token_renewable      false
# token_policies       ["app-policy" "default"]
# identity_policies    []
# policies             ["app-policy" "default"]
```

**保存这个 Token**，这是应用要使用的 Token，不是 Root Token。

### 步骤 7：配置应用连接到 Vault

#### 安装 Python 依赖

```bash
cd C:\Projects\ProjectControls\backend
pip install hvac
```

或者如果使用虚拟环境：

```bash
.\myenv\Scripts\pip.exe install hvac
```

依赖已添加到 `requirements.txt`，重新安装依赖即可：

```bash
.\myenv\Scripts\pip.exe install -r requirements.txt
```

#### 设置环境变量

**方式1：系统级环境变量（推荐）**

```powershell
# 以管理员身份运行 PowerShell
[System.Environment]::SetEnvironmentVariable('VAULT_ADDR', 'http://127.0.0.1:8200', 'Machine')
[System.Environment]::SetEnvironmentVariable('VAULT_TOKEN', 's.xxxxxxxxxxxxxxxxxxxxxxx', 'Machine')  # 使用应用专用的 Token，不是 Root Token
```

**方式2：在 NSSM 服务配置中设置（如果使用 NSSM）**

```powershell
nssm set ProjectControlsAPI AppEnvironmentExtra "VAULT_ADDR=http://127.0.0.1:8200" "VAULT_TOKEN=s.xxxxxxxxxxxxxxxxxxxxxxx"
```

#### 验证应用配置

启动应用后，查看日志，应该看到：

```
INFO: 检测到 Vault 配置 (VAULT_ADDR=http://127.0.0.1:8200)，使用 Vault 模式（业界标准，满足合规要求）
INFO: 成功连接到 Vault (http://127.0.0.1:8200)
```

### 步骤 8：将 Vault 注册为 Windows 服务（生产环境推荐）

#### 使用 NSSM 注册 Vault 服务

```powershell
# 1. 下载 NSSM（如果还没有）：https://nssm.cc/download
# 解压到 C:\nssm

# 2. 注册 Vault 服务
cd C:\nssm\win64
.\nssm.exe install Vault

# 在 NSSM 界面中配置：
# - Path: C:\vault\vault.exe
# - Startup directory: C:\vault
# - Arguments: server -config=C:\vault\config.hcl

# 或使用命令行配置（推荐）
.\nssm.exe set Vault Application "C:\vault\vault.exe"
.\nssm.exe set Vault AppDirectory "C:\vault"
.\nssm.exe set Vault AppParameters "server -config=C:\vault\config.hcl"
.\nssm.exe set Vault DisplayName "HashiCorp Vault"
.\nssm.exe set Vault Description "HashiCorp Vault - 密钥管理服务"

# 3. 设置自动启动
.\nssm.exe set Vault Start SERVICE_AUTO_START

# 4. 启动服务
.\nssm.exe start Vault

# 5. 验证服务状态
Get-Service Vault
```

**注意**：Vault 服务启动后，需要手动解封（见步骤 4）。

#### 自动解封 Vault（可选）

可以通过脚本实现自动解封，但需要安全地存储 Unseal Keys。建议使用 Vault 的 Auto-unseal 功能或手动解封。

### 步骤 9：验证集成

#### 验证 Vault 存储

```powershell
$env:VAULT_ADDR = "http://127.0.0.1:8200"
$env:VAULT_TOKEN = "<你的 Token>"

# 查看所有存储的角色
vault kv list secret/db-roles

# 查看特定角色的信息（不显示密码）
vault kv get secret/db-roles/planning_manager

# 查看完整信息（包括密码，谨慎使用）
vault kv get -field=password secret/db-roles/planning_manager
```

#### 验证应用连接

1. **启动应用**并查看日志
2. **尝试用户登录**，验证数据库连接
3. **检查日志**确认使用 Vault 模式：

```
INFO: 检测到 Vault 配置 (VAULT_ADDR=http://127.0.0.1:8200)，使用 Vault 模式
INFO: 成功连接到 Vault (http://127.0.0.1:8200)
```

## 🔒 安全最佳实践

### 1. Token 管理

- ✅ **不要使用 Root Token 运行应用**：创建专用的应用 Token
- ✅ **定期轮换 Token**：设置 Token TTL，定期更新
- ✅ **使用最小权限策略**：只授予应用必需的权限
- ✅ **安全存储 Token**：通过环境变量或 Windows 凭据管理器，不要硬编码

### 2. 生产环境配置

- ✅ **启用 TLS**：使用 HTTPS 连接 Vault
- ✅ **使用专用存储后端**：生产环境使用 Consul 或其他分布式存储，而不是文件系统
- ✅ **配置防火墙**：限制对 Vault 端口的访问
- ✅ **启用审计日志**：记录所有 Vault 操作

### 3. 备份和恢复

- ✅ **备份 Unseal Keys**：存储在安全的离线位置
- ✅ **定期备份 Vault 数据**：备份 `C:\vault\data` 目录
- ✅ **测试恢复流程**：确保能够从备份恢复

### 4. 监控和告警

- ✅ **监控 Vault 服务状态**：确保服务正常运行
- ✅ **监控 Vault 日志**：检查异常访问
- ✅ **设置告警**：Vault 服务异常时及时通知

## 🔄 密码轮换

### 手动轮换

```powershell
# 1. 更新 MySQL 用户密码
mysql -u root -p
ALTER USER 'role_planning_manager'@'%' IDENTIFIED BY 'new_password';
FLUSH PRIVILEGES;

# 2. 更新 Vault 中的密码
$env:VAULT_ADDR = "http://127.0.0.1:8200"
$env:VAULT_TOKEN = "<你的 Token>"
vault kv put secret/db-roles/planning_manager username=role_planning_manager password=new_password

# 3. 清除应用缓存（如果需要）
# 应用会在下次请求时自动从 Vault 获取新密码
```

### 自动轮换（高级功能）

可以使用 Vault 的数据库动态密码功能，自动生成和轮换密码。需要配置 Vault 的数据库密钥引擎。

## 📊 Vault 路径结构

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

## 🐛 故障排查

### 问题1：无法连接到 Vault

**检查**：
- Vault 服务是否正在运行：`Get-Service Vault`
- Vault 地址是否正确：`$env:VAULT_ADDR`
- 防火墙是否阻止端口 8200
- Vault 是否已解封：`vault status`

### 问题2：认证失败

**检查**：
- Token 是否正确：`$env:VAULT_TOKEN`
- Token 是否过期（如果设置了 TTL）
- Token 是否有权限访问路径

### 问题3：无法读取密钥

**检查**：
- 密钥路径是否正确：`secret/data/db-roles/{role_name}`
- Token 策略是否授予读取权限
- 密钥是否存在：`vault kv get secret/db-roles/{role_name}`

### 问题4：应用仍然使用环境变量模式

**检查**：
- `VAULT_ADDR` 和 `VAULT_TOKEN` 环境变量是否设置
- 应用是否重启（环境变量更改后需要重启）
- 查看应用日志确认检测到的密钥源

## 📚 参考资源

- [HashiCorp Vault 官方文档](https://www.vaultproject.io/docs)
- [Vault Windows 部署指南](https://learn.hashicorp.com/tutorials/vault/getting-started-install)
- [Vault 安全最佳实践](https://www.vaultproject.io/docs/concepts/seal-unseal)
- [Vault 审计日志](https://www.vaultproject.io/docs/audit)

## ✅ 实施检查清单

- [ ] Vault 已下载并安装
- [ ] Vault 配置文件已创建（生产环境）
- [ ] Vault 服务已启动
- [ ] Vault 已初始化（生产环境）
- [ ] Vault 已解封（生产环境）
- [ ] KV v2 存储引擎已启用
- [ ] 所有角色密码已存储到 Vault
- [ ] 应用专用 Token 已创建（生产环境推荐）
- [ ] 环境变量 `VAULT_ADDR` 和 `VAULT_TOKEN` 已设置
- [ ] Python 依赖 `hvac` 已安装
- [ ] 应用已重启并验证使用 Vault 模式
- [ ] Vault 已注册为 Windows 服务（生产环境推荐）
- [ ] 备份策略已制定（Unseal Keys 和数据）
- [ ] 监控和告警已配置

---

**恭喜！** 您已经成功实施了业界标准的密钥管理方案。Vault 将为您提供企业级的安全性和合规性保障。
