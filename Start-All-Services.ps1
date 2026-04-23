# ProjectControls - Start All Services (development mode)
# Starts the current workspace services without NSSM, Vault, or admin rights.

[CmdletBinding()]
param(
    [switch]$NoBackend,
    [switch]$NoFrontend,
    [switch]$NoScheduler,
    [switch]$OpenBrowser,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$ProjectRoot = $PSScriptRoot
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$RuntimeDir = Join-Path $ProjectRoot ".codex-logs\dev-services"
$PidFile = Join-Path $RuntimeDir "start-all-services-pids.json"

function Write-Section {
    param([string]$Message)
    Write-Host ""
    Write-Host ("=== {0} ===" -f $Message) -ForegroundColor Cyan
}

function Ensure-Directory {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Resolve-CommandPath {
    param(
        [string[]]$Candidates,
        [string]$DisplayName
    )

    foreach ($candidate in $Candidates) {
        if ([string]::IsNullOrWhiteSpace($candidate)) {
            continue
        }

        if (Test-Path $candidate) {
            return (Resolve-Path $candidate).Path
        }

        $command = Get-Command $candidate -ErrorAction SilentlyContinue
        if ($command) {
            return $command.Source
        }
    }

    throw "Unable to find $DisplayName. Checked: $($Candidates -join ', ')"
}

function Test-PortListening {
    param([int]$Port)

    try {
        $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop
        return ($connections | Measure-Object).Count -gt 0
    } catch {
        $matches = netstat -ano | Select-String -Pattern (":{0}\s+.*LISTENING" -f $Port)
        return $null -ne $matches
    }
}

function Get-PortOwnerDescription {
    param([int]$Port)

    try {
        $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | Select-Object -First 1
        if (-not $connection) {
            return $null
        }

        $processId = $connection.OwningProcess
        $processName = (Get-Process -Id $processId -ErrorAction SilentlyContinue).ProcessName
        if ($processName) {
            return "{0} (PID: {1})" -f $processName, $processId
        }

        return "PID: {0}" -f $processId
    } catch {
        return $null
    }
}

function Get-PortOwnerProcessId {
    param([int]$Port)

    try {
        $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | Select-Object -First 1
        if ($connection) {
            return [int]$connection.OwningProcess
        }
    } catch {
        return $null
    }

    return $null
}

function Wait-ForPort {
    param(
        [int]$Port,
        [int]$TimeoutSeconds = 25
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-PortListening -Port $Port) {
            return $true
        }
        Start-Sleep -Milliseconds 500
    }

    return $false
}

function Convert-ToSingleQuotedValue {
    param([string]$Value)
    return "'" + ($Value -replace "'", "''") + "'"
}

function New-EncodedCommand {
    param(
        [string]$WorkingDirectory,
        [string]$WindowTitle,
        [string]$Executable,
        [string[]]$Arguments
    )

    $argumentText = @($Arguments | ForEach-Object { Convert-ToSingleQuotedValue -Value $_ }) -join " "
    $scriptLines = @(
        '$ErrorActionPreference = "Stop"'
        "Set-Location -LiteralPath $(Convert-ToSingleQuotedValue -Value $WorkingDirectory)"
        '$Host.UI.RawUI.WindowTitle = ' + (Convert-ToSingleQuotedValue -Value $WindowTitle)
        'Write-Host ("Working directory: {0}" -f (Get-Location)) -ForegroundColor DarkGray'
        'Write-Host ("Launching: {0}" -f (' + (Convert-ToSingleQuotedValue -Value $Executable) + ' + " ' + ($Arguments -join " ") + '")) -ForegroundColor Yellow'
        "& $(Convert-ToSingleQuotedValue -Value $Executable) $argumentText"
    )

    $scriptText = $scriptLines -join [Environment]::NewLine
    $bytes = [System.Text.Encoding]::Unicode.GetBytes($scriptText)
    return [Convert]::ToBase64String($bytes)
}

function Start-ToolWindow {
    param(
        [string]$Name,
        [string]$WorkingDirectory,
        [string]$Executable,
        [string[]]$Arguments,
        [int]$Port,
        [string]$Url
    )

    if ($Port -gt 0 -and (Test-PortListening -Port $Port)) {
        $owner = Get-PortOwnerDescription -Port $Port
        $ownerPid = Get-PortOwnerProcessId -Port $Port
        if ($owner) {
            Write-Host ("[skip] {0} already appears to be running on port {1} ({2})." -f $Name, $Port, $owner) -ForegroundColor Yellow
        } else {
            Write-Host ("[skip] {0} already appears to be running on port {1}." -f $Name, $Port) -ForegroundColor Yellow
        }
        return [pscustomobject]@{
            Name = $Name
            Action = "AlreadyRunning"
            Port = $Port
            Url = $Url
            ProcessId = $ownerPid
        }
    }

    if ($DryRun) {
        Write-Host ("[dry-run] Would start {0}: {1} {2}" -f $Name, $Executable, ($Arguments -join " ")) -ForegroundColor DarkYellow
        return [pscustomobject]@{
            Name = $Name
            Action = "DryRun"
            Port = $Port
            Url = $Url
            ProcessId = $null
        }
    }

    $encodedCommand = New-EncodedCommand -WorkingDirectory $WorkingDirectory -WindowTitle ("ProjectControls - {0}" -f $Name) -Executable $Executable -Arguments $Arguments
    $process = Start-Process -FilePath "powershell.exe" -ArgumentList @(
        "-NoExit",
        "-ExecutionPolicy",
        "Bypass",
        "-EncodedCommand",
        $encodedCommand
    ) -WorkingDirectory $WorkingDirectory -PassThru

    Write-Host ("[start] {0} launched in a new PowerShell window (PID: {1})." -f $Name, $process.Id) -ForegroundColor Green

    return [pscustomobject]@{
        Name = $Name
        Action = "Started"
        Port = $Port
        Url = $Url
        ProcessId = $process.Id
    }
}

function Save-PidSnapshot {
    param([object[]]$Items)

    Ensure-Directory -Path $RuntimeDir
    $payload = [pscustomobject]@{
        generated_at = (Get-Date).ToString("s")
        project_root = $ProjectRoot
        services = $Items
    }

    $payload | ConvertTo-Json -Depth 5 | Set-Content -Path $PidFile -Encoding UTF8
}

Write-Section -Message "ProjectControls One-Click Startup"
Write-Host ("Project root: {0}" -f $ProjectRoot) -ForegroundColor Gray

Ensure-Directory -Path $RuntimeDir

$pythonExe = Resolve-CommandPath -DisplayName "Python" -Candidates @(
    (Join-Path $ProjectRoot "myenv\Scripts\python.exe"),
    (Join-Path $ProjectRoot ".venv\Scripts\python.exe"),
    "python",
    "py"
)

$npmExe = Resolve-CommandPath -DisplayName "npm" -Candidates @(
    "npm.cmd",
    "npm"
)

if (-not (Test-Path $BackendDir)) {
    throw "Backend directory not found: $BackendDir"
}

if (-not (Test-Path $FrontendDir)) {
    throw "Frontend directory not found: $FrontendDir"
}

if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
    throw "Frontend dependencies are missing. Please run 'npm install' in the frontend directory first."
}

$results = New-Object System.Collections.Generic.List[object]

Write-Section -Message "Launching Services"

if (-not $NoBackend) {
    $results.Add((Start-ToolWindow -Name "Backend" -WorkingDirectory $BackendDir -Executable $pythonExe -Arguments @("run.py") -Port 8001 -Url "http://127.0.0.1:8001/docs"))
}

if (-not $NoFrontend) {
    $results.Add((Start-ToolWindow -Name "Frontend" -WorkingDirectory $FrontendDir -Executable $npmExe -Arguments @("run", "dev") -Port 3000 -Url "http://127.0.0.1:3000"))
}

if (-not $NoScheduler) {
    $results.Add((Start-ToolWindow -Name "Scheduler" -WorkingDirectory $BackendDir -Executable $pythonExe -Arguments @("run_scheduler.py") -Port 0 -Url "background worker"))
}

if (-not $DryRun) {
    Save-PidSnapshot -Items $results
}

if (-not $DryRun) {
    Write-Section -Message "Health Checks"

    if (-not $NoBackend) {
        if (Wait-ForPort -Port 8001 -TimeoutSeconds 20) {
            Write-Host "[ok] Backend is listening on http://127.0.0.1:8001/docs" -ForegroundColor Green
        } else {
            Write-Host "[warn] Backend did not open port 8001 within 20 seconds. Check the backend window for details." -ForegroundColor Yellow
        }
    }

    if (-not $NoFrontend) {
        if (Wait-ForPort -Port 3000 -TimeoutSeconds 35) {
            Write-Host "[ok] Frontend is listening on http://127.0.0.1:3000" -ForegroundColor Green
        } else {
            Write-Host "[warn] Frontend did not open port 3000 within 35 seconds. Check the frontend window for details." -ForegroundColor Yellow
        }
    }
}

Write-Section -Message "Summary"
$results | Select-Object Name, Action, Port, Url, ProcessId | Format-Table -AutoSize
if (-not $DryRun) {
    Write-Host ("PID snapshot saved to: {0}" -f $PidFile) -ForegroundColor Gray
}

if ($OpenBrowser -and -not $DryRun -and -not $NoFrontend) {
    Start-Process "http://127.0.0.1:3000"
}
