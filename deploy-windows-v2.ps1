# ProjectControls Windows deployment script (v2)
# ASCII only to ensure compatibility with Windows PowerShell encoding
# Note: Run as Administrator
[CmdletBinding()]
param(
    [string]$ProjectPath = $PSScriptRoot,
    [string]$NginxPath = "C:\nginx",
    [string]$NssmPath = "C:\nssm\win64",
    [switch]$SkipFrontend = $false,
    [switch]$SkipNginx = $false,
    [switch]$SkipServices = $false,
    [switch]$SkipFirewall = $false,
    [string]$BackendServiceName = "ProjectControlsBackend",
    [string]$NginxServiceName = "Nginx"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Refresh PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

function Write-Info([string]$Message) { Write-Host $Message -ForegroundColor Gray }
function Write-Warn([string]$Message) { Write-Host $Message -ForegroundColor Yellow }
function Write-Ok([string]$Message) { Write-Host $Message -ForegroundColor Green }
function Write-Err([string]$Message) { Write-Host $Message -ForegroundColor Red }

function Assert-Admin {
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Write-Err "ERROR: Please run this script as Administrator."
        exit 1
    }
}

function Assert-Exists([string]$Path, [string]$MessageIfMissing) {
    if (-not (Test-Path $Path)) {
        Write-Err $MessageIfMissing
        exit 1
    }
}

function Ensure-Dir([string]$Path) {
    if (-not (Test-Path $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Step([string]$Title, [scriptblock]$Body) {
    Write-Warn "`n--- $Title ---"
    & $Body
}

function Invoke-NativeCmd {
    param([Parameter(Mandatory=$true)][string]$CommandLine)
    $outputLines = & cmd.exe /c $CommandLine 2>&1
    foreach ($line in $outputLines) {
        Write-Host $line
    }
    return [int]$LASTEXITCODE
}

function Ensure-PythonVenv {
    param([string]$ProjectRoot)
    $venvDir = Join-Path $ProjectRoot "myenv"
    $pythonExe = Join-Path $venvDir "Scripts\python.exe"
    $pipExe = Join-Path $venvDir "Scripts\pip.exe"

    if (-not (Test-Path $venvDir)) {
        Write-Info "Creating Python venv: myenv"
        $exitCode = Invoke-NativeCmd -CommandLine "python -m venv `"$venvDir`""
        if ($exitCode -ne 0) {
            Write-Err "ERROR: venv creation failed (exit=$exitCode)"
            exit 1
        }
    }
    return [pscustomobject]@{ VenvDir = $venvDir; PythonExe = $pythonExe; PipExe = $pipExe }
}

function Install-Backend {
    param([string]$ProjectRoot)
    $backendDir = Join-Path $ProjectRoot "backend"
    $logsDir = Join-Path $ProjectRoot "logs"
    Ensure-Dir $logsDir
    $venv = Ensure-PythonVenv -ProjectRoot $ProjectRoot

    Push-Location $backendDir
    try {
        Write-Info "Installing backend dependencies..."
        Invoke-NativeCmd -CommandLine "`"$($venv.PythonExe)`" -m pip install --upgrade pip"
        Invoke-NativeCmd -CommandLine "`"$($venv.PipExe)`" install -r requirements.txt"
    } finally {
        Pop-Location
    }

    return [pscustomobject]@{ BackendDir = $backendDir; LogsDir = $logsDir; PythonExe = $venv.PythonExe }
}

function Install-Frontend {
    param([string]$ProjectRoot)
    $frontendDir = Join-Path $ProjectRoot "frontend"
    Push-Location $frontendDir
    try {
        Write-Info "Building frontend..."
        if (-not (Test-Path "node_modules")) { npm install --no-audit }
        npm run build
        Assert-Exists "dist" "ERROR: Frontend build failed, dist directory not found."
    } finally {
        Pop-Location
    }
}

function Setup-Services {
    param($BackendInfo, $NssmRoot, $BackendSvc, $NginxRoot, $NginxSvc)
    $nssmExe = Join-Path $NssmRoot "nssm.exe"
    Assert-Exists $nssmExe "Cannot find nssm.exe"

    # Backend service
    if (Get-Service $BackendSvc -ErrorAction SilentlyContinue) {
        Stop-Service $BackendSvc -Force -ErrorAction SilentlyContinue
        & $nssmExe remove $BackendSvc confirm | Out-Null
    }

    Write-Info "Installing backend service: $BackendSvc"
    # workers 8; ensure MySQL max_connections >= 1024
    & $nssmExe install $BackendSvc $($BackendInfo.PythonExe) "-m uvicorn app.main:app --host 127.0.0.1 --port 8001 --workers 8" | Out-Null
    & $nssmExe set $BackendSvc AppDirectory $($BackendInfo.BackendDir) | Out-Null
    & $nssmExe set $BackendSvc AppStdout "$(Join-Path $BackendInfo.LogsDir 'service_stdout.log')" | Out-Null
    & $nssmExe set $BackendSvc AppStderr "$(Join-Path $BackendInfo.LogsDir 'service_stderr.log')" | Out-Null
    & $nssmExe set $BackendSvc Start SERVICE_AUTO_START | Out-Null

    # Vault injection
    if ($env:VAULT_ADDR -and $env:VAULT_TOKEN) {
        try {
            $secretKey = & C:\vault\vault.exe kv get -field=secret_key secret/app-config
            if ($LASTEXITCODE -eq 0) {
                & $nssmExe set $BackendSvc AppEnvironmentExtra "SECRET_KEY=$secretKey"
                Write-Ok "SECRET_KEY injected from Vault"
            }
        } catch { Write-Warn "Cannot get secret from Vault" }
    }

    Start-Service $BackendSvc
    Write-Ok "Backend service started (port 8001)"
}

Assert-Admin
Step "1. Check project" { Assert-Exists $ProjectPath "Project path does not exist." }
Step "2. Install backend" { $global:backendInfo = Install-Backend -ProjectRoot $ProjectPath }
if (-not $SkipFrontend) { Step "3. Build frontend" { Install-Frontend -ProjectRoot $ProjectPath } }
if (-not $SkipServices) { Step "4. Configure services" { Setup-Services -BackendInfo $global:backendInfo -NssmRoot $NssmPath -BackendSvc $BackendServiceName -NginxRoot $NginxPath -NginxSvc $NginxServiceName } }
Step "5. Health check" {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:8001/health" -TimeoutSec 5 -UseBasicParsing
        Write-Ok "Health check OK (HTTP $($resp.StatusCode))"
    } catch { Write-Warn "Health check failed, check logs\service_stderr.log" }
}

Write-Ok "`nDeployment complete."
