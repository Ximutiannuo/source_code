# ProjectControls - Stop All Services
# ASCII only to ensure compatibility with Windows PowerShell encoding

$NssmPath = "C:\nssm\win64\nssm.exe"

Write-Host "=== Stopping ProjectControls Services === " -ForegroundColor Cyan

# 1. Stop Backup Scheduler
Write-Host "Stopping Backup Scheduler (ProjectControlsBackup)..." -ForegroundColor Yellow
& $NssmPath stop ProjectControlsBackup
if ($LASTEXITCODE -eq 0) { Write-Host "OK: Backup Scheduler stopped." -ForegroundColor Green }

# 2. Stop Sync Worker
Write-Host "Stopping Sync Worker (ProjectControlsSyncWorker)..." -ForegroundColor Yellow
& $NssmPath stop ProjectControlsSyncWorker
if ($LASTEXITCODE -eq 0) { Write-Host "OK: Sync Worker stopped." -ForegroundColor Green }

# 3. Stop Backend
Write-Host "Stopping Backend (ProjectControlsBackend)..." -ForegroundColor Yellow
& $NssmPath stop ProjectControlsBackend
if ($LASTEXITCODE -eq 0) { Write-Host "OK: Backend service stopped." -ForegroundColor Green }

# 4. Stop Nginx
Write-Host "Stopping Nginx (Nginx)..." -ForegroundColor Yellow
& $NssmPath stop Nginx
if ($LASTEXITCODE -eq 0) { Write-Host "OK: Nginx service stopped." -ForegroundColor Green }

# 5. Clean up residual processes
Write-Host "Cleaning up residual processes..." -ForegroundColor Gray
Get-Process | Where-Object { $_.ProcessName -eq "python" -or $_.ProcessName -eq "nginx" } | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "=== All Services Stopped ===" -ForegroundColor Cyan
