# ProjectControls - Register Watchdog Scheduled Task
# Runs Watch-Service-Status.ps1 every minute to detect forcibly closed services and auto-restart.
# ASCII only. Run as Administrator.

$TaskName = "ProjectControlsWatchdog"
$ScriptPath = "C:\Projects\ProjectControls\Watch-Service-Status.ps1"
$WorkDir = "C:\Projects\ProjectControls"
$PsExe = (Get-Command powershell.exe).Source

function Assert-Admin {
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Write-Host "ERROR: Run as Administrator." -ForegroundColor Red
        exit 1
    }
}

Assert-Admin

$action = New-ScheduledTaskAction -Execute $PsExe -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`" -Once" -WorkingDirectory $WorkDir
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration (New-TimeSpan -Days 3650)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null

Write-Host "OK: Watchdog task registered. Runs every 1 min. Log: logs\watchdog.log" -ForegroundColor Green
