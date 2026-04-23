#!/usr/bin/env python3
"""
测试 Vault 连接和密码读取
"""
import os
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# 设置环境变量
os.environ['VAULT_ADDR'] = 'http://127.0.0.1:8200'
os.environ['VAULT_TOKEN'] = 'hvs.CAESIHSvQuDtGmMCttBKk2Ns1DT8FrYM4S0_sj8aCKOYm4tOGh4KHGh2cy52bXRzVlRIalBjRDh3bGxFU0NSbERTeXY'

# 导入 SecretManager
from app.services.secret_manager import get_secret_manager

print("=== 测试 Vault 连接和密码读取 ===\n")

# 获取 SecretManager 实例（会触发初始化）
sm = get_secret_manager()

print(f"密钥源: {sm.source}")
print(f"Vault 客户端: {sm._vault_client is not None}\n")

# 测试读取密码
roles = ['PLANNING_MANAGER', 'SYSTEM_ADMIN', 'PLANNING_SUPERVISOR', 'PLANNER']

for role in roles:
    username = sm.get_role_username(role)
    password = sm.get_role_password(role)
    
    print(f"[{role}]")
    print(f"  用户名: {username}")
    print(f"  密码: {'***' if password else 'None'}")
    if password:
        print(f"  密码长度: {len(password)}")
        print(f"  密码值: {password}")  # 显示实际密码值用于调试
    print()

# 测试构建数据库 URL
print("\n=== 测试数据库 URL 构建 ===")
from app.config import settings
from urllib.parse import quote_plus

role_name = '计划经理'
db_url = settings.get_role_database_url(role_name)
if db_url:
    # 隐藏密码显示
    import re
    db_url_safe = re.sub(r':([^:@]+)@', ':****@', db_url)
    print(f"角色: {role_name}")
    print(f"数据库 URL: {db_url_safe}")
    print(f"完整 URL (包含密码): {db_url}")
else:
    print(f"角色 {role_name} 的数据库 URL 为 None")
