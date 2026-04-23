# 将 DeepSeek API Key 写入 Vault
# 使用方法：.\vault_set_deepseek_api_key.ps1
# 或带参数：.\vault_set_deepseek_api_key.ps1 -ApiKey "sk-xxx"
# 需要 VAULT_ADDR 和 VAULT_TOKEN 环境变量，且 token 有 secret/app-config 的 write 权限

param(
    [string]$ApiKey = ""
)

if (-not $ApiKey) {
    $ApiKey = Read-Host -Prompt "请输入 DeepSeek API Key (将写入 Vault secret/app-config)"
}

if (-not $ApiKey) {
    Write-Host 'Error: API Key required.' -ForegroundColor Red
    exit 1
}

$vaultExe = "C:\vault\vault.exe"
if (-not (Test-Path $vaultExe)) {
    $vaultExe = "vault"
}

# vault kv patch 会合并新字段，不会覆盖已有的 secret_key
& $vaultExe kv patch secret/app-config deepseek_api_key=$ApiKey

if ($LASTEXITCODE -eq 0) {
    Write-Host 'OK: deepseek_api_key written to Vault secret/app-config' -ForegroundColor Green
    Write-Host 'Restart backend service to take effect.' -ForegroundColor Yellow
} else {
    Write-Host 'Write failed. If app-config not exists, run:' -ForegroundColor Red
    Write-Host '  vault kv put secret/app-config secret_key=YOUR_JWT_SECRET' -ForegroundColor Gray
    Write-Host ('  vault kv patch secret/app-config deepseek_api_key=' + $ApiKey) -ForegroundColor Gray
    exit 1
}
