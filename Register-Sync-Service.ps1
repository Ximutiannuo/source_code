# ProjectControls - Register Sync Worker Service
# Encoding: UTF-8 with BOM

$SyncService = "ProjectControlsSyncWorker"
$NssmPath = "C:\nssm\win64\nssm.exe"
$PythonExe = "C:\Projects\ProjectControls\myenv\Scripts\python.exe"
$BackendDir = "C:\Projects\ProjectControls\backend"

function Assert-Admin {
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Write-Host "ERROR: Please run this script as Administrator." -ForegroundColor Red
        exit 1
    }
}

Assert-Admin

Write-Host "=== Registering ProjectControls Sync Worker Service ===" -ForegroundColor Cyan

if (Test-Path $NssmPath) {
    if (Get-Service $SyncService -ErrorAction SilentlyContinue) {
        Write-Host "Removing existing service..." -ForegroundColor Yellow
        Stop-Service $SyncService -Force -ErrorAction SilentlyContinue
        & $NssmPath remove $SyncService confirm | Out-Null
    }

    Write-Host "Installing service via NSSM..." -ForegroundColor Yellow
    & $NssmPath install $SyncService "$PythonExe" "run_scheduler.py"
    & $NssmPath set $SyncService AppDirectory "$BackendDir"
    & $NssmPath set $SyncService AppStdout "$(Join-Path $BackendDir '..\logs\sync_stdout.log')"
    & $NssmPath set $SyncService AppStderr "$(Join-Path $BackendDir '..\logs\sync_stderr.log')"
    # 每 3 天轮转日志，避免 sync_stdout.log 无限增长（AppRotateSeconds=259200 秒）
    & $NssmPath set $SyncService AppRotateFiles 1
    & $NssmPath set $SyncService AppRotateOnline 1
    & $NssmPath set $SyncService AppRotateSeconds 259200
    & $NssmPath set $SyncService AppRotateBytes 104857600
    & $NssmPath set $SyncService DisplayName "ProjectControls Sync Worker"
    & $NssmPath set $SyncService Description "Background scheduler for P6 and Welding Data Sync"
    & $NssmPath set $SyncService Start SERVICE_AUTO_START

    Write-Host "OK: Service registered successfully." -ForegroundColor Green
    Write-Host "You can now run Start-Sync-Service.ps1 to configure secrets and start it." -ForegroundColor Cyan
} else {
    Write-Host "ERROR: NSSM not found at $NssmPath" -ForegroundColor Red
}

