# ProjectControls - Start Sync Worker Service
# Encoding: UTF-8 with BOM

$SyncService = "ProjectControlsSyncWorker"
$NssmPath = "C:\nssm\win64\nssm.exe"

function Assert-Admin {
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Write-Host "ERROR: Please run this script as Administrator." -ForegroundColor Red
        exit 1
    }
}

Assert-Admin

Write-Host "=== Starting ProjectControls Sync Worker ===" -ForegroundColor Cyan

# 1. 濞夈劌鍙?Vault 閸戭厽宓?
$vaultAddr = $env:VAULT_ADDR
$vaultToken = $env:VAULT_TOKEN

if (-not $vaultAddr -or -not $vaultToken) {
    Write-Host "ERROR: VAULT_ADDR or VAULT_TOKEN not set in current session." -ForegroundColor Red
    exit 1
}

Write-Host "Injecting Vault credentials..." -ForegroundColor Yellow
$secretKey = & C:\vault\vault.exe kv get -field=secret_key secret/app-config

$envList = @(
    "VAULT_ADDR=$vaultAddr",
    "VAULT_TOKEN=$vaultToken",
    "SECRET_KEY=$secretKey",
    "DB_HOST=10.78.44.17",
    "DB_NAME=projectcontrols",
    "ENV=production",
    "PYTHONUTF8=1"
)
$envString = $envList -join "`n"
cmd /c "`"$NssmPath`" set $SyncService AppEnvironmentExtra `"$envString`""

# 2. 閸氼垰濮╅張宥呭
if (Get-Service $SyncService -ErrorAction SilentlyContinue) {
    Write-Host "Starting service..." -ForegroundColor Yellow
    Start-Service $SyncService -ErrorAction SilentlyContinue
    
    Start-Sleep -Seconds 3
    $svc = Get-Service $SyncService
    if ($svc.Status -eq "Running") {
        Write-Host "OK: Sync Worker is running." -ForegroundColor Green
    } else {
        Write-Host "ERROR: Sync Worker failed to start. Check logs\sync_stderr.log" -ForegroundColor Red
    }
} else {
    Write-Host "ERROR: Service not registered. Run Register-Sync-Service.ps1 first." -ForegroundColor Red
}



