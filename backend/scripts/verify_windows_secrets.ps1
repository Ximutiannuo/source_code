# Verify Windows System Environment Variables for Role Database Accounts
# Encoding: UTF-8 with BOM (for PowerShell compatibility)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "Checking role database account environment variables..." -ForegroundColor Green
Write-Host ""

$roles = @(
    @{Key = 'PLANNING_MANAGER'; Name = 'Planning Manager'},
    @{Key = 'SYSTEM_ADMIN'; Name = 'System Admin'},
    @{Key = 'PLANNING_SUPERVISOR'; Name = 'Planning Supervisor'},
    @{Key = 'PLANNER'; Name = 'Planner'}
)

$allOk = $true

foreach ($role in $roles) {
    $usernameKey = "ROLE_$($role.Key)_USERNAME"
    $passwordKey = "ROLE_$($role.Key)_PASSWORD"
    
    Write-Host "[$($role.Name)]" -ForegroundColor Cyan
    
    # Check username
    $username = [System.Environment]::GetEnvironmentVariable($usernameKey, 'Machine')
    if ($username) {
        Write-Host "  [OK] USERNAME: $username" -ForegroundColor Green
    } else {
        $defaultUsername = "role_$($role.Key.ToLower())"
        Write-Host "  [WARN] USERNAME: Not set, will use default: $defaultUsername" -ForegroundColor Yellow
    }
    
    # Check password
    $password = [System.Environment]::GetEnvironmentVariable($passwordKey, 'Machine')
    if ($password) {
        Write-Host "  [OK] PASSWORD: Set (length: $($password.Length))" -ForegroundColor Green
    } else {
        Write-Host "  [ERROR] PASSWORD: Not set" -ForegroundColor Red
        $allOk = $false
    }
    
    Write-Host ""
}

# Check user-level environment variables (may override system-level)
Write-Host "Checking user-level environment variables (may override system-level)..." -ForegroundColor Yellow
$userEnv = Get-ChildItem Env: | Where-Object { $_.Name -like 'ROLE_*' }
if ($userEnv) {
    Write-Host "  Found user-level environment variables (may override system-level):" -ForegroundColor Yellow
    $userEnv | ForEach-Object {
        Write-Host "    $($_.Name)" -ForegroundColor Yellow
    }
} else {
    Write-Host "  No user-level environment variables found" -ForegroundColor Green
}

Write-Host ""

if ($allOk) {
    Write-Host "[SUCCESS] All required passwords are set!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Note:" -ForegroundColor Yellow
    Write-Host "  1. If using Windows service, restart the service to take effect" -ForegroundColor White
    Write-Host "  2. If starting manually, close and reopen PowerShell window" -ForegroundColor White
    Write-Host "  3. Test current session environment variables:" -ForegroundColor White
    Write-Host "     Get-ChildItem Env: | Where-Object { `$_.Name -like 'ROLE_*' }" -ForegroundColor Cyan
} else {
    Write-Host "[ERROR] Some passwords are not set. Use following commands:" -ForegroundColor Red
    Write-Host ""
    Write-Host "  [System.Environment]::SetEnvironmentVariable('ROLE_PLANNING_MANAGER_PASSWORD', 'your_password', 'Machine')" -ForegroundColor Cyan
    Write-Host "  [System.Environment]::SetEnvironmentVariable('ROLE_SYSTEM_ADMIN_PASSWORD', 'your_password', 'Machine')" -ForegroundColor Cyan
    Write-Host "  [System.Environment]::SetEnvironmentVariable('ROLE_PLANNING_SUPERVISOR_PASSWORD', 'your_password', 'Machine')" -ForegroundColor Cyan
    Write-Host "  [System.Environment]::SetEnvironmentVariable('ROLE_PLANNER_PASSWORD', 'your_password', 'Machine')" -ForegroundColor Cyan
}
