Write-Host "========================================="
Write-Host "     Restarting Manufacturing Platform   "
Write-Host "========================================="

$scriptDir = $PSScriptRoot

Write-Host "1. Stopping services..."
& "$scriptDir\Stop-All-Services.ps1"

Start-Sleep -Seconds 2

Write-Host "`n2. Starting services..."
& "$scriptDir\Start-All-Services.ps1"

Write-Host "========================================="
Write-Host "          Restart Complete!              "
Write-Host "========================================="
