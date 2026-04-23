# 快速修复MySQL锁表问题
# 使用方法：在激活虚拟环境后运行此脚本

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "检查并修复MySQL锁表问题" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# 检查MySQL状态
Write-Host "步骤1: 检查MySQL状态..." -ForegroundColor Yellow
python scripts/check_mysql_status.py

Write-Host ""
Write-Host "步骤2: 杀死长时间运行的查询（超过30秒）..." -ForegroundColor Yellow
python scripts/kill_long_queries.py --min-seconds 30

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "如果问题仍然存在，可以尝试：" -ForegroundColor Yellow
Write-Host "1. 重启MySQL服务" -ForegroundColor White
Write-Host "2. 或者等待当前操作完成" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Cyan

