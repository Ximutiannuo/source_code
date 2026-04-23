# Windows Server 服务安装脚本
# 用于将 ProjectControls API 安装为 Windows 服务
# 需要管理员权限运行

param(
    [string]$NssmPath = "C:\nssm\win64",
    [string]$ServiceName = "ProjectControlsAPI",
    [string]$AppPath = "C:\Projects\ProjectControls\backend",
    [string]$PythonPath = "C:\Projects\ProjectControls\backend\myenv\Scripts\python.exe",
    [string]$Port = "8200"
)

# 检查管理员权限
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "错误：此脚本需要管理员权限运行" -ForegroundColor Red
    Write-Host "请右键点击 PowerShell，选择'以管理员身份运行'" -ForegroundColor Yellow
    exit 1
}

# 检查 NSSM 是否存在
$nssmExe = Join-Path $NssmPath "nssm.exe"
if (-not (Test-Path $nssmExe)) {
    Write-Host "错误：找不到 NSSM，请先下载并解压到 $NssmPath" -ForegroundColor Red
    Write-Host "下载地址：https://nssm.cc/download" -ForegroundColor Yellow
    exit 1
}

# 检查应用路径
if (-not (Test-Path $AppPath)) {
    Write-Host "错误：应用路径不存在：$AppPath" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $PythonPath)) {
    Write-Host "错误：Python 路径不存在：$PythonPath" -ForegroundColor Red
    exit 1
}

Write-Host "开始安装 Windows 服务..." -ForegroundColor Green

# 检查服务是否已存在
$existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existingService) {
    Write-Host "警告：服务 $ServiceName 已存在" -ForegroundColor Yellow
    $response = Read-Host "是否删除现有服务？(y/N)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        Stop-Service -Name $ServiceName -ErrorAction SilentlyContinue
        & $nssmExe remove $ServiceName confirm
        Start-Sleep -Seconds 2
    } else {
        Write-Host "已取消安装" -ForegroundColor Yellow
        exit 0
    }
}

# 安装服务
Write-Host "正在安装服务..." -ForegroundColor Green
& $nssmExe install $ServiceName $PythonPath `
    "-m uvicorn app.main:app --host 0.0.0.0 --port $Port"

# 设置工作目录
& $nssmExe set $ServiceName AppDirectory $AppPath

# 设置服务描述
& $nssmExe set $ServiceName Description "ProjectControls FastAPI Application - 计划管理系统API服务"

# 设置启动类型为自动
& $nssmExe set $ServiceName Start SERVICE_AUTO_START

# 设置失败后自动重启
& $nssmExe set $ServiceName AppExit Default Restart
& $nssmExe set $ServiceName AppRestartDelay 5000

# 提示用户设置环境变量
Write-Host "`n请在 NSSM 界面中设置环境变量：" -ForegroundColor Yellow
Write-Host "1. 运行：$nssmExe edit $ServiceName" -ForegroundColor Cyan
Write-Host "2. 在 'Environment' 标签页添加以下环境变量：" -ForegroundColor Cyan
Write-Host "   ROLE_PLANNING_MANAGER_USERNAME=role_planning_manager" -ForegroundColor White
Write-Host "   ROLE_PLANNING_MANAGER_PASSWORD=你的密码" -ForegroundColor White
Write-Host "   ROLE_SYSTEM_ADMIN_USERNAME=role_system_admin" -ForegroundColor White
Write-Host "   ROLE_SYSTEM_ADMIN_PASSWORD=你的密码" -ForegroundColor White
Write-Host "   ROLE_PLANNING_SUPERVISOR_USERNAME=role_planning_supervisor" -ForegroundColor White
Write-Host "   ROLE_PLANNING_SUPERVISOR_PASSWORD=你的密码" -ForegroundColor White
Write-Host "   ROLE_PLANNER_USERNAME=role_planner" -ForegroundColor White
Write-Host "   ROLE_PLANNER_PASSWORD=你的密码" -ForegroundColor White
Write-Host "`n或者使用命令行设置（一行一个）：" -ForegroundColor Yellow
Write-Host "`$nssmExe = '$nssmExe'" -ForegroundColor Cyan
Write-Host "`$ServiceName = '$ServiceName'" -ForegroundColor Cyan
Write-Host '& $nssmExe set $ServiceName AppEnvironmentExtra "ROLE_PLANNING_MANAGER_PASSWORD=你的密码" "ROLE_SYSTEM_ADMIN_PASSWORD=你的密码" ...' -ForegroundColor Cyan

# 询问是否现在设置
$setNow = Read-Host "`n是否现在通过命令行设置环境变量？(y/N)"
if ($setNow -eq 'y' -or $setNow -eq 'Y') {
    Write-Host "`n请输入角色密码（不会显示在屏幕上）：" -ForegroundColor Yellow
    
    $planningManagerPwd = Read-Host "计划经理密码" -AsSecureString
    $systemAdminPwd = Read-Host "系统管理员密码" -AsSecureString
    $planningSupervisorPwd = Read-Host "计划主管密码" -AsSecureString
    $plannerPwd = Read-Host "Planner密码" -AsSecureString
    
    # 转换 SecureString 为普通字符串
    function Convert-SecureStringToString {
        param([SecureString]$SecureString)
        $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureString)
        try {
            return [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
        } finally {
            [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
        }
    }
    
    $planningManagerPwdStr = Convert-SecureStringToString $planningManagerPwd
    $systemAdminPwdStr = Convert-SecureStringToString $systemAdminPwd
    $planningSupervisorPwdStr = Convert-SecureStringToString $planningSupervisorPwd
    $plannerPwdStr = Convert-SecureStringToString $plannerPwd
    
    # 设置环境变量
    & $nssmExe set $ServiceName AppEnvironmentExtra `
        "ROLE_PLANNING_MANAGER_USERNAME=role_planning_manager" `
        "ROLE_PLANNING_MANAGER_PASSWORD=$planningManagerPwdStr" `
        "ROLE_SYSTEM_ADMIN_USERNAME=role_system_admin" `
        "ROLE_SYSTEM_ADMIN_PASSWORD=$systemAdminPwdStr" `
        "ROLE_PLANNING_SUPERVISOR_USERNAME=role_planning_supervisor" `
        "ROLE_PLANNING_SUPERVISOR_PASSWORD=$planningSupervisorPwdStr" `
        "ROLE_PLANNER_USERNAME=role_planner" `
        "ROLE_PLANNER_PASSWORD=$plannerPwdStr"
    
    Write-Host "环境变量已设置" -ForegroundColor Green
}

Write-Host "`n服务安装完成！" -ForegroundColor Green
Write-Host "可以使用以下命令管理服务：" -ForegroundColor Cyan
Write-Host "  启动：Start-Service $ServiceName" -ForegroundColor White
Write-Host "  停止：Stop-Service $ServiceName" -ForegroundColor White
Write-Host "  重启：Restart-Service $ServiceName" -ForegroundColor White
Write-Host "  查看状态：Get-Service $ServiceName" -ForegroundColor White
Write-Host "  查看日志：Get-EventLog -LogName Application -Source NSSM -Newest 50" -ForegroundColor White
