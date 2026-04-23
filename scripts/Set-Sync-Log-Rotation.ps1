# 为 ProjectControls Sync Worker 设置日志轮转（每 3 天或达到 100MB 时）
# 已注册服务的用户可直接运行此脚本更新配置，无需重新注册服务
# 需管理员权限

$SyncService = "ProjectControlsSyncWorker"
$NssmPath = "C:\nssm\win64\nssm.exe"

function Assert-Admin {
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Pincipal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Write-Host "ERROR: 请以管理员身份运行此脚本。" -ForegroundColor Red
        exit 1
    }
}

Assert-Admin

if (-not (Get-Service $SyncService -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: 未找到服务 $SyncService，请先运行 Register-Sync-Service.ps1 注册服务。" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $NssmPath)) {
    Write-Host "ERROR: 未找到 NSSM: $NssmPath" -ForegroundColor Red
    exit 1
}

Write-Host "=== 设置 Sync Worker 日志轮转（每 3 天 / 100MB）===" -ForegroundColor Cyan
& $NssmPath set $SyncService AppRotateFiles 1
& $NssmPath set $SyncService AppRotateOnline 1
& $NssmPath set $SyncService AppRotateSeconds 259200   # 3 天 = 259200 秒
& $NssmPath set $SyncService AppRotateBytes 104857600  # 100MB，防止 3 天内过大
Write-Host "OK: 日志轮转已启用。sync_stdout.log / sync_stderr.log 将每 3 天或达到 100MB 时自动轮转。" -ForegroundColor Green
Write-Host "注意: 轮转后会产生 .old 备份文件，可定期手动删除 logs\*.old 以释放空间。" -ForegroundColor Gray
