# ProjectControls - Restart All Services
# ASCII only to ensure compatibility with Windows PowerShell encoding

Write-Host "=== Executing Full Restart Process ===" -ForegroundColor Cyan

# Execute Stop
& "$PSScriptRoot\Stop-All-Services.ps1"

Write-Host "Waiting for resources to release (3s)..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# Execute Start
& "$PSScriptRoot\Start-All-Services.ps1"

Write-Host "=== Restart Process Completed ===" -ForegroundColor Cyan
