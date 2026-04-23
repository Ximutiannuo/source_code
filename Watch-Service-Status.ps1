# ProjectControls - Service Status Watchdog
# 1) Monitors Backend, Sync Worker, Backup, Nginx; restarts any stopped.
# 2) HTTP health check on Backend /health; if down/timeout -> full restart (catches hung process).
# ASCII only for Windows PowerShell compatibility.
# Usage:
#   Watch-Service-Status.ps1                 # Loop every 60s
#   Watch-Service-Status.ps1 -Once           # Single check (for Task Scheduler)
#   Watch-Service-Status.ps1 -IntervalSeconds 120

param(
    [switch]$Once,
    [int]$IntervalSeconds = 60
)

$NssmPath = "C:\nssm\win64\nssm.exe"
$LogDir = "C:\Projects\ProjectControls\logs"
$LogFile = Join-Path $LogDir "watchdog.log"
$BackendHealthUrl = "http://127.0.0.1:8001/health"
$HealthCheckTimeoutSec = 10
$RestartCooldownSec = 180
$LastRestartFile = Join-Path $LogDir "watchdog_last_restart.txt"
$ServiceStderrLog = Join-Path $LogDir "service_stderr.log"
$ServiceStdoutLog = Join-Path $LogDir "service_stdout.log"
$StderrTailLines = 8
$LogFallbackFile = Join-Path $LogDir "watchdog_fallback.log"

$Services = @(
    "ProjectControlsBackend",
    "ProjectControlsSyncWorker",
    "ProjectControlsBackup",
    "Nginx"
)

function Assert-Admin {
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Write-Error "ERROR: Run as Administrator."
        exit 1
    }
}

function Write-WatchdogLog {
    param([string]$Message, [string]$Level = "INFO")
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] [$Level] $Message"
    Write-Host $line
    $logPath = $LogDir
    if (-not (Test-Path $logPath)) { New-Item -ItemType Directory -Path $logPath -Force | Out-Null }
    try {
        Add-Content -Path $LogFile -Value $line -Encoding UTF8 -ErrorAction Stop
    } catch {
        try {
            Add-Content -Path $LogFallbackFile -Value $line -Encoding UTF8 -ErrorAction Stop
        } catch {
            $err = $_.Exception.Message
            try { Add-Content -Path (Join-Path $env:TEMP "watchdog_fallback.log") -Value "[$ts] [WARN] Primary log failed: $err | $line" -Encoding UTF8 -ErrorAction SilentlyContinue } catch { }
        }
    }
}

function Get-ServiceStatus {
    $result = @{}
    foreach ($name in $Services) {
        $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
        $result[$name] = if ($svc) { $svc.Status.ToString() } else { "NotFound" }
    }
    return $result
}

function Start-ServiceViaNssm {
    param([string]$Name)
    if (Test-Path $NssmPath) {
        & $NssmPath start $Name 2>$null
        return $LASTEXITCODE -eq 0
    }
    try {
        Start-Service -Name $Name -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

function Get-HealthCheckResult {
    try {
        $r = Invoke-WebRequest -Uri $BackendHealthUrl -UseBasicParsing -TimeoutSec $HealthCheckTimeoutSec -ErrorAction Stop
        if ($r.StatusCode -eq 200) {
            return @{ Ok = $true; Reason = $null }
        }
        return @{ Ok = $false; Reason = "HTTP $($r.StatusCode)" }
    } catch {
        $ex = $_.Exception
        $msg = if ($ex.Message) { $ex.Message.Trim() } else { "Unknown" }
        $reason = "Unknown"
        if ($msg -match "timed out|timeout|Timeout") { $reason = "Timeout (${HealthCheckTimeoutSec}s)" }
        elseif ($msg -match "refused|actively refused") { $reason = "Connection refused (backend not listening?)" }
        elseif ($msg -match "reset|closed|aborted|10054|10053") { $reason = "Connection reset or closed" }
        elseif ($msg -match "name could not be resolved|DNS") { $reason = "DNS resolution failed" }
        else {
            $code = $null
            try {
                $resp = $ex.Response
                if (-not $resp -and $ex.InnerException) { $resp = $ex.InnerException.Response }
                if ($resp) { $code = [int]$resp.StatusCode }
            } catch { }
            if ($null -ne $code -and $code -ge 400) { $reason = "HTTP $code" }
            else { $reason = $msg }
        }
        return @{ Ok = $false; Reason = $reason }
    }
}

function Get-RecentStderrTail {
    $path = $ServiceStderrLog
    if (-not (Test-Path $path)) { return $null }
    try {
        $lines = Get-Content -Path $path -Tail $StderrTailLines -Encoding Default -ErrorAction SilentlyContinue
        if (-not $lines) { return $null }
        return ($lines | ForEach-Object { $_.Replace("`r", "").Replace("`n", " ") }) -join " | "
    } catch {
        return $null
    }
}

function Get-UnixTimestamp {
    $epoch = [datetime]'1970-01-01'
    return [int]((Get-Date).ToUniversalTime() - $epoch).TotalSeconds
}

function Invoke-FullRestart {
    $restartScript = Join-Path $PSScriptRoot "Restart-All-Services.ps1"
    if (-not (Test-Path $restartScript)) { $restartScript = "C:\Projects\ProjectControls\Restart-All-Services.ps1" }
    Write-WatchdogLog "Executing full restart: $restartScript" -Level "RESTART"
    [System.IO.File]::WriteAllText($LastRestartFile, (Get-UnixTimestamp).ToString())
    & $restartScript
}

function Test-RestartCooldown {
    if (-not (Test-Path $LastRestartFile)) { return $false }
    $last = 0
    [int]::TryParse((Get-Content $LastRestartFile -Raw -ErrorAction SilentlyContinue).Trim(), [ref]$last) | Out-Null
    $elapsed = (Get-UnixTimestamp) - $last
    return $elapsed -lt $RestartCooldownSec
}

function Invoke-SingleCheck {
    Write-WatchdogLog "Watchdog run started."
    $status = Get-ServiceStatus
    $stopped = @()
    foreach ($name in $Services) {
        $s = $status[$name]
        if ($s -eq "Stopped" -or $s -eq "NotFound") { $stopped += $name }
    }

    if ($stopped.Count -gt 0) {
        Write-WatchdogLog "Detected stopped/ missing: $($stopped -join ', '). Auto-restarting." -Level "RESTART"
        foreach ($name in $stopped) {
            Write-WatchdogLog "Starting $name..."
            $ok = Start-ServiceViaNssm -Name $name
            if ($ok) { Write-WatchdogLog "Started $name." -Level "OK" } else { Write-WatchdogLog "Failed to start $name." -Level "ERROR" }
        }
        return
    }

    if (Test-RestartCooldown) {
        Write-WatchdogLog "All services running (cooldown ${RestartCooldownSec}s, health check skipped)."
        return
    }
    $health = Get-HealthCheckResult
    if (-not $health.Ok) {
        Write-WatchdogLog "Backend /health unreachable. Reason: $($health.Reason). Forcing full restart." -Level "RESTART"
        $tail = Get-RecentStderrTail
        if ($tail) {
            $tailLog = "Recent service_stderr (last $StderrTailLines): $tail"
            if ($tailLog.Length -gt 500) { $tailLog = $tailLog.Substring(0, 497) + "..." }
            Write-WatchdogLog $tailLog -Level "DIAG"
        }
        Invoke-FullRestart
        return
    }

    Write-WatchdogLog "All services running; backend health OK."
}

Assert-Admin

if ($Once) {
    Invoke-SingleCheck
    exit 0
}

Write-WatchdogLog "Watchdog started. Interval=${IntervalSeconds}s. Services: $($Services -join ', ')."
while ($true) {
    Invoke-SingleCheck
    Start-Sleep -Seconds $IntervalSeconds
}
