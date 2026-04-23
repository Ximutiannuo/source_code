# 新增角色完整流程脚本（PowerShell）
# 用于快速添加新的 Planner 角色
# 
# 使用方法：
# .\add_new_role_complete.ps1 -RoleName "C20Planner" -RoleDescription "C20计划，负责计划管理与日报填报。" -Scope "C20"
# 
# 注意：所有 Planner 角色共用 role_planner 数据库账号
# 数据隔离通过应用层的 PermissionService.filter_by_permission() 实现

param(
    [Parameter(Mandatory=$true)]
    [string]$RoleName,
    
    [Parameter(Mandatory=$false)]
    [string]$RoleDescription = "",
    
    [Parameter(Mandatory=$false)]
    [string]$Scope = "",
    
    [Parameter(Mandatory=$false)]
    [string]$DbHost = "localhost",
    
    [Parameter(Mandatory=$false)]
    [int]$DbPort = 3306,
    
    [Parameter(Mandatory=$false)]
    [string]$DbName = "projectcontrols",
    
    [Parameter(Mandatory=$false)]
    [string]$DbUser = "root",
    
    [Parameter(Mandatory=$false)]
    [string]$DbPassword = ""
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "=== 新增角色完整流程脚本 ===" -ForegroundColor Green
Write-Host ""

# 验证参数
if (-not $RoleDescription) {
    $RoleDescription = "$RoleName 计划，负责计划管理与日报填报。"
}

if (-not $Scope) {
    $Scope = $RoleName -replace 'Planner$', ''
}

Write-Host "配置信息：" -ForegroundColor Cyan
Write-Host "  角色名称: $RoleName" -ForegroundColor White
Write-Host "  角色描述: $RoleDescription" -ForegroundColor White
Write-Host "  权限范围 (scope): $Scope" -ForegroundColor White
Write-Host "  数据库: $DbUser@$DbHost:$DbPort/$DbName" -ForegroundColor White
Write-Host ""

# 获取数据库密码
if (-not $DbPassword) {
    $securePassword = Read-Host "请输入 MySQL root 密码" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $DbPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}

# 构建 MySQL 连接字符串
$mysqlCmd = "mysql"
$mysqlArgs = @(
    "-h", $DbHost,
    "-P", $DbPort.ToString(),
    "-u", $DbUser,
    "-p$DbPassword",
    $DbName,
    "-e"
)

# 步骤 1：检查角色是否已存在
Write-Host "步骤 1: 检查角色是否已存在..." -ForegroundColor Cyan
$checkRoleSQL = "SELECT id, name, description FROM roles WHERE name = '$RoleName';"
$checkResult = & $mysqlCmd $mysqlArgs $checkRoleSQL 2>&1

if ($LASTEXITCODE -eq 0 -and $checkResult -match $RoleName) {
    Write-Host "  [WARN] 角色已存在，将更新描述" -ForegroundColor Yellow
    $roleExists = $true
} else {
    Write-Host "  [OK] 角色不存在，将创建新角色" -ForegroundColor Green
    $roleExists = $false
}

# 步骤 2：创建或更新角色
Write-Host ""
Write-Host "步骤 2: 创建/更新角色..." -ForegroundColor Cyan

$createRoleSQL = @"
INSERT INTO roles (name, description, is_active) 
VALUES ('$RoleName', '$RoleDescription', 1)
ON DUPLICATE KEY UPDATE 
    description = '$RoleDescription',
    is_active = 1;
"@

$result = & $mysqlCmd $mysqlArgs $createRoleSQL 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] 角色创建/更新成功" -ForegroundColor Green
} else {
    Write-Host "  [ERROR] 角色创建失败: $result" -ForegroundColor Red
    exit 1
}

# 步骤 3：获取角色 ID
Write-Host ""
Write-Host "步骤 3: 获取角色 ID..." -ForegroundColor Cyan

$getRoleIdSQL = "SELECT id FROM roles WHERE name = '$RoleName';"
$roleIdResult = & $mysqlCmd $mysqlArgs $getRoleIdSQL 2>&1 | Select-Object -Skip 1 | Select-Object -First 1
$roleId = $roleIdResult.Trim()

if (-not $roleId -or -not ([int]::TryParse($roleId, [ref]$null))) {
    Write-Host "  [ERROR] 无法获取角色 ID" -ForegroundColor Red
    exit 1
}

Write-Host "  [OK] 角色 ID: $roleId" -ForegroundColor Green

# 步骤 4：获取权限 ID
Write-Host ""
Write-Host "步骤 4: 获取权限 ID..." -ForegroundColor Cyan

$permissions = @(
    @{Code = 'daily_report:read'; Name = 'daily_report:read'},
    @{Code = 'daily_report:create'; Name = 'daily_report:create'},
    @{Code = 'daily_report:update'; Name = 'daily_report:update'},
    @{Code = 'planning:read'; Name = 'planning:read'}
)

$permissionIds = @{}
foreach ($perm in $permissions) {
    $getPermIdSQL = "SELECT id FROM permissions WHERE code = '$($perm.Code)' LIMIT 1;"
    $permIdResult = & $mysqlCmd $mysqlArgs $getPermIdSQL 2>&1 | Select-Object -Skip 1 | Select-Object -First 1
    $permId = $permIdResult.Trim()
    
    if ($permId -and [int]::TryParse($permId, [ref]$null)) {
        $permissionIds[$perm.Code] = $permId
        Write-Host "  [OK] $($perm.Code): ID = $permId" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] 权限 '$($perm.Code)' 不存在，将跳过" -ForegroundColor Yellow
    }
}

# 步骤 5：配置角色权限
Write-Host ""
Write-Host "步骤 5: 配置角色权限 (scope = '$Scope')..." -ForegroundColor Cyan

foreach ($permCode in $permissionIds.Keys) {
    $permId = $permissionIds[$permCode]
    
    $insertPermSQL = @"
INSERT INTO role_permissions (
    role_id, permission_id, scope, block, discipline, work_package,
    project, subproject, train, unit, main_block, quarter, simple_block, facility_id, resource_id
) VALUES (
    $roleId, $permId, '$Scope', NULL, NULL, NULL,
    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
) ON DUPLICATE KEY UPDATE scope = '$Scope';
"@
    
    $result = & $mysqlCmd $mysqlArgs $insertPermSQL 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] 已配置权限: $permCode" -ForegroundColor Green
    } else {
        Write-Host "  [ERROR] 配置权限失败 ($permCode): $result" -ForegroundColor Red
    }
}

# 步骤 6：验证配置
Write-Host ""
Write-Host "步骤 6: 验证配置..." -ForegroundColor Cyan

$verifySQL = @"
SELECT 
    r.name AS role_name,
    p.code AS permission_code,
    rp.scope,
    rp.block,
    rp.discipline
FROM roles r
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE r.name = '$RoleName';
"@

$verifyResult = & $mysqlCmd $mysqlArgs $verifySQL 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] 权限配置验证成功" -ForegroundColor Green
    Write-Host ""
    Write-Host $verifyResult -ForegroundColor Gray
} else {
    Write-Host "  [WARN] 验证查询失败: $verifyResult" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== 完成 ===" -ForegroundColor Green
Write-Host ""
Write-Host "下一步操作：" -ForegroundColor Yellow
Write-Host "1. 将用户关联到新角色：" -ForegroundColor White
Write-Host "   INSERT INTO user_roles (user_id, role_id) VALUES (用户ID, $roleId);" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. 验证用户角色关联：" -ForegroundColor White
Write-Host "   SELECT u.username, r.name FROM users u JOIN user_roles ur ON u.id = ur.user_id JOIN roles r ON ur.role_id = r.id WHERE r.name = '$RoleName';" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. 测试应用：使用新角色的用户登录，验证权限是否正常" -ForegroundColor White
Write-Host ""
Write-Host "注意：所有 Planner 角色共用 role_planner 数据库账号" -ForegroundColor Gray
Write-Host "数据隔离通过应用层的 PermissionService.filter_by_permission() 实现" -ForegroundColor Gray
Write-Host ""
Write-Host "详细文档：backend/docs/DATABASE_ACCOUNT_MANAGEMENT.md" -ForegroundColor Cyan
Write-Host ""
