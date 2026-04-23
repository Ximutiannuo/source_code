# PowerShell 脚本：生成强随机 SECRET_KEY
# 使用方法: .\generate_secret_key.ps1

# 生成64字符的强随机密钥
$secretKey = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})

# 使用更安全的方法：使用 .NET 的加密随机数生成器
Add-Type -AssemblyName System.Security
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$secretKey = [System.BitConverter]::ToString($bytes).Replace("-", "").ToLower()

Write-Host "=" * 70 -ForegroundColor Green
Write-Host "生成的 SECRET_KEY (64字符):" -ForegroundColor Green
Write-Host "=" * 70 -ForegroundColor Green
Write-Host $secretKey -ForegroundColor Yellow
Write-Host "=" * 70 -ForegroundColor Green
Write-Host ""
Write-Host "使用方法:" -ForegroundColor Cyan
Write-Host "1. 复制上面的 SECRET_KEY"
Write-Host "2. 打开 backend\.env 文件"
Write-Host "3. 找到或添加以下行:"
Write-Host "   SECRET_KEY=$secretKey" -ForegroundColor Yellow
Write-Host ""
Write-Host "注意:" -ForegroundColor Red
Write-Host "- 请妥善保管此密钥，不要泄露给他人"
Write-Host "- 如果密钥泄露，请立即更换并重新生成所有用户的令牌"
Write-Host "- 生产环境必须使用强随机密钥，不要使用默认值"
Write-Host "=" * 70 -ForegroundColor Green

# 尝试复制到剪贴板
try {
    $secretKey | Set-Clipboard
    Write-Host ""
    Write-Host "✓ 已自动复制到剪贴板！" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "提示: 可以手动复制上面的密钥" -ForegroundColor Yellow
}
