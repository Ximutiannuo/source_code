# ProjectControls 开发模式防火墙配置脚本
# 允许端口 3000（前端）和 8200（后端）从网络访问
#
# 使用方法（以管理员身份运行）:
#   .\setup-dev-firewall.ps1

[CmdletBinding()]
param(
    [switch]$Remove = $false  # 如果设置，则删除防火墙规则
)

function Write-Info([string]$Message) { Write-Host $Message -ForegroundColor Gray }
function Write-Warn([string]$Message) { Write-Host $Message -ForegroundColor Yellow }
function Write-Ok([string]$Message) { Write-Host $Message -ForegroundColor Green }
function Write-Err([string]$Message) { Write-Host $Message -ForegroundColor Red }

# 检查管理员权限
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Err "错误: 请以管理员身份运行此脚本"
    Write-Info "右键点击 PowerShell → 以管理员身份运行"
    exit 1
}

Write-Info "=========================================="
Write-Info "ProjectControls 开发模式防火墙配置"
Write-Info "=========================================="
Write-Output ""

$rules = @(
    @{
        Name = "ProjectControls Frontend Dev (Port 3000)"
        DisplayName = "ProjectControls Frontend Dev"
        Port = 3000
        Description = "允许从网络访问前端开发服务器（端口 3000）"
    },
    @{
        Name = "ProjectControls Backend Dev (Port 8200)"
        DisplayName = "ProjectControls Backend Dev"
        Port = 8200
        Description = "允许从网络访问后端开发服务器（端口 8200）"
    }
)

if ($Remove) {
    Write-Warn "正在删除防火墙规则..."
    foreach ($rule in $rules) {
        $existing = Get-NetFirewallRule -DisplayName $rule.DisplayName -ErrorAction SilentlyContinue
        if ($existing) {
            try {
                Remove-NetFirewallRule -DisplayName $rule.DisplayName -ErrorAction Stop
                Write-Ok "已删除规则: $($rule.DisplayName)"
            } catch {
                Write-Err "删除规则失败: $($rule.DisplayName) - $_"
            }
        } else {
            Write-Info "规则不存在: $($rule.DisplayName)"
        }
    }
    Write-Output ""
    Write-Ok "防火墙规则删除完成！"
} else {
    Write-Warn "正在创建防火墙规则..."
    foreach ($rule in $rules) {
        $existing = Get-NetFirewallRule -DisplayName $rule.DisplayName -ErrorAction SilentlyContinue
        if ($existing) {
            Write-Info "规则已存在: $($rule.DisplayName)"
        } else {
            try {
                New-NetFirewallRule `
                    -DisplayName $rule.DisplayName `
                    -Name $rule.Name `
                    -Description $rule.Description `
                    -Direction Inbound `
                    -LocalPort $rule.Port `
                    -Protocol TCP `
                    -Action Allow `
                    -Profile Domain,Private,Public `
                    -ErrorAction Stop
                Write-Ok "已创建规则: $($rule.DisplayName) (端口 $($rule.Port))"
            } catch {
                Write-Err "创建规则失败: $($rule.DisplayName) - $_"
            }
        }
    }
    Write-Output ""
    Write-Ok "防火墙规则配置完成！"
    Write-Output ""
    Write-Info "现在可以从其他电脑访问开发服务器了"
    Write-Info "访问地址: http://<服务器IP>:3000"
    Write-Info ""
    Write-Info "提示:"
    Write-Info "  - 要删除这些规则，运行: .\setup-dev-firewall.ps1 -Remove"
    Write-Info "  - 规则只影响开发模式，不影响生产环境"
}

Write-Output ""
