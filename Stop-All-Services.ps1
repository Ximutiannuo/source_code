Write-Host "========================================="
Write-Host "      Stopping Manufacturing Platform    "
Write-Host "========================================="

$pidFile = ".services-pids.json"

if (Test-Path $pidFile) {
    Write-Host "Found $pidFile, reading PIDs..."
    $pids = Get-Content $pidFile | ConvertFrom-Json
    
    foreach ($service in $pids.psobject.properties) {
        $name = $service.Name
        $id = $service.Value
        
        Write-Host "Stopping $name (PID: $id)..."
        try {
            taskkill /PID $id /T /F 2>&1 | Out-Null
            Write-Host "Successfully stopped $name." -ForegroundColor Green
        } catch {
            Write-Host "Failed to stop $name or process already exited." -ForegroundColor Yellow
        }
    }
    
    Remove-Item $pidFile -Force
    Write-Host "Removed $pidFile."
} else {
    Write-Host "No $pidFile found. Attempting to kill processes by name..." -ForegroundColor Yellow
    
    # Try to stop Node (Frontend) and Python (Backend) processes that might be running for this project
    # Note: This is a bit aggressive and might stop other node/python processes
    Write-Host "Stopping any running uvicorn/python backend processes..."
    Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match "backend[/\\]run.py" -or $_.CommandLine -match "uvicorn" } | ForEach-Object {
        Write-Host "Stopping Python process PID: $($_.ProcessId)"
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
    
    Write-Host "Stopping any running Vite/Node frontend processes..."
    Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match "vite" } | ForEach-Object {
        Write-Host "Stopping Node process PID: $($_.ProcessId)"
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }

    Write-Host "Stopping any running Vault processes..."
    Get-Process -Name "vault" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}

Write-Host "========================================="
Write-Host "All specified services have been stopped."
Write-Host "========================================="
