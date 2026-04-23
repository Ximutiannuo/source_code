# HashiCorp Vault 设置脚本（Windows Server）
# 此脚本用于初始化 Vault 并存储角色数据库账号密码

param(
    [string]$VaultAddr = "http://127.0.0.1:8200",
    [string]$VaultToken = $null
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "=== HashiCorp Vault 设置脚本 ===" -ForegroundColor Green
Write-Host ""

# 检查 Vault 是否安装
$vaultCmd = Get-Command vault -ErrorAction SilentlyContinue
if (-not $vaultCmd) {
    Write-Host "[ERROR] Vault 未安装或未添加到 PATH" -ForegroundColor Red
    Write-Host "请从 https://releases.hashicorp.com/vault/ 下载并安装 Vault" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "[OK] 检测到 Vault 命令: $($vaultCmd.Source)" -ForegroundColor Green
Write-Host ""

# 设置 Vault 地址
$env:VAULT_ADDR = $VaultAddr
Write-Host "Vault 地址: $VaultAddr" -ForegroundColor Cyan

# 如果没有提供 Token，尝试从环境变量读取
if (-not $VaultToken) {
    $VaultToken = [System.Environment]::GetEnvironmentVariable('VAULT_TOKEN', 'Machine')
    if (-not $VaultToken) {
        $VaultToken = [System.Environment]::GetEnvironmentVariable('VAULT_TOKEN', 'User')
    }
    if (-not $VaultToken) {
        $VaultToken = $env:VAULT_TOKEN
    }
}

if (-not $VaultToken) {
    Write-Host "[WARN] 未提供 VAULT_TOKEN" -ForegroundColor Yellow
    Write-Host "如果 Vault 处于开发模式，请在另一个终端窗口查看 root token" -ForegroundColor Yellow
    Write-Host "或者通过参数提供: -VaultToken 'your-token'" -ForegroundColor Yellow
    Write-Host ""
    $VaultToken = Read-Host "请输入 Vault Token（如果 Vault 在开发模式，查看启动日志中的 root token）"
}

$env:VAULT_TOKEN = $VaultToken

# 测试连接
Write-Host ""
Write-Host "测试 Vault 连接..." -ForegroundColor Cyan
try {
    $status = vault status 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Vault 连接失败"
    }
    Write-Host "[OK] Vault 连接成功" -ForegroundColor Green
    Write-Host $status -ForegroundColor Gray
} catch {
    Write-Host "[ERROR] 无法连接到 Vault: $_" -ForegroundColor Red
    Write-Host "请确保：" -ForegroundColor Yellow
    Write-Host "  1. Vault 服务正在运行" -ForegroundColor Yellow
    Write-Host "  2. VAULT_ADDR 和 VAULT_TOKEN 配置正确" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# 检查并启用 KV v2 存储引擎
Write-Host "检查 KV 存储引擎..." -ForegroundColor Cyan
try {
    $secrets = vault secrets list 2>&1 | Out-String
    if ($secrets -notmatch "secret/") {
        Write-Host "启用 KV v2 存储引擎..." -ForegroundColor Yellow
        vault secrets enable -path=secret kv-v2 2>&1 | Out-Null
        Write-Host "[OK] KV v2 存储引擎已启用" -ForegroundColor Green
    } else {
        Write-Host "[OK] KV 存储引擎已存在" -ForegroundColor Green
    }
} catch {
    Write-Host "[ERROR] 启用 KV 存储引擎失败: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 提示用户输入角色密码
Write-Host "=== 输入角色数据库账号密码 ===" -ForegroundColor Green
Write-Host ""

$roles = @(
    @{Key = 'planning_manager'; Name = '计划经理 (Planning Manager)'; Username = 'role_planning_manager'},
    @{Key = 'system_admin'; Name = '系统管理员 (System Admin)'; Username = 'role_system_admin'},
    @{Key = 'planning_supervisor'; Name = '计划主管 (Planning Supervisor)'; Username = 'role_planning_supervisor'},
    @{Key = 'planner'; Name = 'Planner'; Username = 'role_planner'}
)

$secretsData = @{}

foreach ($role in $roles) {
    Write-Host "[$($role.Name)]" -ForegroundColor Cyan
    $password = Read-Host "  请输入密码 (密码将安全存储到 Vault，不会显示在屏幕上)" -AsSecureString
    
    # 将 SecureString 转换为普通字符串
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
    $plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    
    $secretsData[$role.Key] = @{
        username = $role.Username
        password = $plainPassword
    }
    
    Write-Host "  [OK] 密码已记录（未显示）" -ForegroundColor Green
    Write-Host ""
}

# 存储密码到 Vault
Write-Host "=== 存储密码到 Vault ===" -ForegroundColor Green
Write-Host ""

foreach ($role in $roles) {
    $roleKey = $role.Key
    $data = $secretsData[$roleKey]
    $vaultPath = "secret/data/db-roles/$roleKey"
    
    Write-Host "存储 $($role.Name) 到 $vaultPath..." -ForegroundColor Cyan
    
    try {
        # 使用 vault kv put 命令
        $username = $data.username
        $password = $data.password
        
        # 转义特殊字符
        $password = $password -replace '"', '\"'
        
        $result = vault kv put $vaultPath username="$username" password="$password" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  [OK] 成功存储" -ForegroundColor Green
        } else {
            throw "存储失败: $result"
        }
    } catch {
        Write-Host "  [ERROR] 存储失败: $_" -ForegroundColor Red
    }
}

Write-Host ""

# 验证存储
Write-Host "=== 验证存储的密码 ===" -ForegroundColor Green
Write-Host ""

foreach ($role in $roles) {
    $vaultPath = "secret/data/db-roles/$($role.Key)"
    
    try {
        $result = vault kv get -format=json $vaultPath 2>&1 | ConvertFrom-Json
        if ($result.data.data.username) {
            Write-Host "[$($role.Name)]" -ForegroundColor Cyan
            Write-Host "  用户名: $($result.data.data.username)" -ForegroundColor Green
            Write-Host "  密码: [已存储，长度: $($result.data.data.password.Length)]" -ForegroundColor Green
        } else {
            Write-Host "[$($role.Name)] [WARN] 未找到数据" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "[$($role.Name)] [ERROR] 验证失败: $_" -ForegroundColor Red
    }
    Write-Host ""
}

Write-Host "=== 完成 ===" -ForegroundColor Green
Write-Host ""
Write-Host "下一步操作：" -ForegroundColor Yellow
Write-Host "1. 设置环境变量 VAULT_ADDR 和 VAULT_TOKEN（如果需要）" -ForegroundColor White
Write-Host "2. 重启应用服务，使应用能够连接到 Vault" -ForegroundColor White
Write-Host "3. 查看应用日志，确认成功从 Vault 读取密码" -ForegroundColor White
Write-Host ""
Write-Host "设置系统环境变量（可选）：" -ForegroundColor Yellow
Write-Host "  [System.Environment]::SetEnvironmentVariable('VAULT_ADDR', '$VaultAddr', 'Machine')" -ForegroundColor Cyan
Write-Host "  [System.Environment]::SetEnvironmentVariable('VAULT_TOKEN', 'your-token', 'Machine')" -ForegroundColor Cyan
Write-Host ""
