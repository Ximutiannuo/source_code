# 快速清理大日志文件脚本
# 用于紧急清理过大的日志文件（不轮转，直接清空）
# 用法: .\scripts\clean_large_logs.ps1 [-ServiceName "ProjectControlsBackend"] [-MinSizeMB 100]

[CmdletBinding()]
param(
    [int]$MinSizeMB = 100,  # 只清理大于此大小的日志文件（MB）
    [string]$ServiceName = "ProjectControlsBackend",
    [string]$LogsDir = "c:\Projects\ProjectControls\logs"
)

$ErrorActionPreference = "Stop"

function Write-Info([string]$Message) { Write-Host $Message -ForegroundColor Gray }
function Write-Warn([string]$Message) { Write-Host $Message -ForegroundColor Yellow }
function Write-Ok([string]$Message) { Write-Host $Message -ForegroundColor Green }
function Write-Err([string]$Message) { Write-Host $Message -ForegroundColor Red }

# 检查日志目录
if (-not (Test-Path $LogsDir)) {
    Write-Err "日志目录不存在: $LogsDir"
    exit 1
}

$minSizeBytes = $MinSizeMB * 1024 * 1024
$totalFreed = 0

Write-Warn "警告: 此脚本将清空大于 $MinSizeMB MB 的日志文件！"
$confirm = Read-Host "是否继续？(y/N)"
if ($confirm -ne 'y' -and $confirm -ne 'Y') {
    Write-Info "已取消"
    exit 0
}

Write-Info ""
Write-Info "开始清理大日志文件..."
Write-Info "最小清理大小: $MinSizeMB MB"
Write-Info "日志目录: $LogsDir"
Write-Info ""

# 日志文件列表
$logFiles = @(
    "service_stdout.log",
    "service_stderr.log",
    "sync_stdout.log",
    "sync_stderr.log",
    "gunicorn_access.log",
    "gunicorn_error.log"
)

foreach ($logFile in $logFiles) {
    $logPath = Join-Path $LogsDir $logFile
    
    if (-not (Test-Path $logPath)) {
        continue
    }
    
    $fileInfo = Get-Item $logPath
    $fileSizeMB = [math]::Round($fileInfo.Length / 1MB, 2)
    
    if ($fileInfo.Length -gt $minSizeBytes) {
        Write-Warn "清理文件: $logFile (大小: $fileSizeMB MB)"
        
        # 检查服务是否运行
        $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
        $serviceWasRunning = $false
        
        if ($service -and $service.Status -eq "Running") {
            Write-Info "  停止服务以安全清理日志..."
            Stop-Service -Name $ServiceName -Force
            $serviceWasRunning = $true
            Start-Sleep -Seconds 2
        }
        
        try {
            # 备份最后1000行（如果有用的话）
            $backupPath = Join-Path $LogsDir "$logFile.backup"
            if ($fileInfo.Length -gt 0) {
                Get-Content $logPath -Tail 1000 | Set-Content $backupPath -Encoding UTF8
                Write-Info "  已备份最后1000行到: $logFile.backup"
            }
            
            # 清空文件
            "" | Set-Content $logPath -Encoding UTF8
            Write-Ok "  已清空文件"
            
            $totalFreed += $fileInfo.Length
            
            # 如果服务之前正在运行，重新启动
            if ($serviceWasRunning) {
                Write-Info "  重新启动服务..."
                Start-Service -Name $ServiceName
                Start-Sleep -Seconds 2
                if ((Get-Service -Name $ServiceName).Status -eq "Running") {
                    Write-Ok "  服务已重新启动"
                } else {
                    Write-Warn "  警告: 服务可能未能正常启动，请检查"
                }
            }
        } catch {
            Write-Err "  清理失败: $_"
            # 如果服务之前正在运行，尝试重新启动
            if ($serviceWasRunning) {
                try {
                    Start-Service -Name $ServiceName
                } catch {
                    Write-Err "  无法重新启动服务: $_"
                }
            }
        }
    } else {
        Write-Info "跳过文件: $logFile (大小: $fileSizeMB MB，小于阈值)"
    }
}

# 显示结果
Write-Info ""
$totalFreedMB = [math]::Round($totalFreed / 1MB, 2)
if ($totalFreed -gt 0) {
    Write-Ok "清理完成！释放空间: $totalFreedMB MB"
} else {
    Write-Info "没有需要清理的大文件"
}
