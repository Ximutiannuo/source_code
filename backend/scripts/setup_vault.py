#!/usr/bin/env python3
"""
HashiCorp Vault 设置脚本
用于将数据库角色密码存储到 Vault
"""
import argparse
import os
import sys
import getpass
import hvac

# 角色配置， Ext-Query用户不在vault中注册。
ROLES = [
    {'key': 'planning_manager', 'name': '计划经理 (Planning Manager)', 'username': 'role_planning_manager'},
    {'key': 'system_admin', 'name': '系统管理员 (System Admin)', 'username': 'role_system_admin'},
    {'key': 'planning_supervisor', 'name': '计划主管 (Planning Supervisor)', 'username': 'role_planning_supervisor'},
    {'key': 'planner', 'name': 'Planner', 'username': 'role_planner'},
    {'key': 'guest', 'name': '访客 (Guest)', 'username': 'role_guest'},
    {'key': 'qaqc', 'name': '质量管理（QAQC）', 'username': 'role_qaqc'},
    {'key': 'qaqc_supervisor', 'name': '质量主管（QAQC）', 'username': 'role_qaqc_supervisor'},
    {'key': 'construction', 'name': "施工管理（Construction）", 'username':'role_construction'},
    {'key': 'construction_supervisor', 'name': "施工主管（Construction）", 'username':'role_construction_supervisor'},
    {'key': 'procurement', 'name': "采购管理（Procurement）", 'username':'role_procurement'},
    {'key': 'procurement_supervisor', 'name': "采购主管（Procurement）", 'username':'role_procurement_supervisor'}
]

def main():
    parser = argparse.ArgumentParser(description="将数据库角色密码存储到 Vault")
    parser.add_argument("-f", "--force", action="store_true", help="强制重新设置所有角色密码（覆盖已存在的）")
    args = parser.parse_args()

    print("=== HashiCorp Vault 设置脚本 ===\n")

    # 获取 Vault 配置
    vault_addr = os.environ.get('VAULT_ADDR', 'http://127.0.0.1:8200')
    vault_token = os.environ.get('VAULT_TOKEN')
    
    if not vault_token:
        print("错误: 未设置 VAULT_TOKEN 环境变量")
        print("请先设置: $env:VAULT_TOKEN = 'your-token'")
        sys.exit(1)
    
    print(f"Vault 地址: {vault_addr}\n")
    
    # 连接 Vault
    try:
        client = hvac.Client(url=vault_addr, token=vault_token)
        
        # 验证连接
        if not client.is_authenticated():
            print("错误: Vault 认证失败，请检查 VAULT_TOKEN")
            sys.exit(1)
        
        print("✓ 成功连接到 Vault\n")
    except Exception as e:
        print(f"错误: 无法连接到 Vault: {e}")
        sys.exit(1)
    
    # 检查并启用 KV v2 存储引擎
    try:
        secrets = client.sys.list_mounted_secrets_engines()
        if 'secret/' not in secrets.get('data', {}):
            print("启用 KV v2 存储引擎...")
            client.sys.enable_secrets_engine(
                backend_type='kv',
                path='secret',
                options={'version': '2'}
            )
            print("✓ KV v2 存储引擎已启用\n")
        else:
            print("✓ KV 存储引擎已存在\n")
    except Exception as e:
        print(f"错误: 启用 KV 存储引擎失败: {e}")
        sys.exit(1)
    
    # 检查哪些角色已在 Vault 中（--force 时全部重新设置）
    def role_exists_in_vault(c, role_key):
        try:
            c.secrets.kv.v2.read_secret_version(path=f"db-roles/{role_key}", raise_on_deleted_version=True)
            return True
        except Exception:
            return False

    if args.force:
        roles_to_setup = list(ROLES)
        print("已使用 --force，将重新设置所有角色的密码。\n")
    else:
        roles_to_setup = [r for r in ROLES if not role_exists_in_vault(client, r['key'])]

    for role in ROLES:
        if role in roles_to_setup:
            print(f"[{role['name']}] 需输入密码" + (" (覆盖)" if args.force else " (尚未在 Vault 中)"))
        else:
            print(f"[{role['name']}] 已在 Vault 中，跳过（不修改）")
    print()
    if not roles_to_setup:
        print("所有角色均已存在于 Vault，无需输入。")
        print("若要重新设置密码，请使用: python setup_vault.py --force\n=== 完成 ===")
        return

    # 对 roles_to_setup 中的角色提示输入密码
    print("=== 输入以下角色数据库账号密码（将写入 Vault）===\n")
    secrets_data = {}
    for role in roles_to_setup:
        print(f"[{role['name']}]")
        password = getpass.getpass(f"  请输入密码 (密码将安全存储到 Vault，不会显示在屏幕上): ")
        
        if not password:
            print("  警告: 密码为空，跳过此角色")
            continue
        
        secrets_data[role['key']] = {
            'username': role['username'],
            'password': password
        }
        print("  ✓ 密码已记录（未显示）\n")
    
    # 存储密码到 Vault（仅新输入的）
    print("=== 存储密码到 Vault ===\n")
    
    for role in roles_to_setup:
        role_key = role['key']
        if role_key not in secrets_data:
            continue
        
        vault_path = f"secret/data/db-roles/{role_key}"
        data = secrets_data[role_key]
        
        print(f"存储 {role['name']} 到 {vault_path}...")
        
        try:
            client.secrets.kv.v2.create_or_update_secret(
                path=f"db-roles/{role_key}",
                secret={
                    'username': data['username'],
                    'password': data['password']
                }
            )
            print(f"  ✓ 成功存储\n")
        except Exception as e:
            print(f"  ✗ 存储失败: {e}\n")
    
    # 验证存储
    print("=== 验证存储的密码 ===\n")
    
    for role in ROLES:
        vault_path = f"secret/data/db-roles/{role['key']}"
        
        try:
            secret = client.secrets.kv.v2.read_secret_version(path=f"db-roles/{role['key']}", raise_on_deleted_version=True)
            data = secret['data']['data']
            print(f"[{role['name']}]")
            print(f"  路径: {vault_path}")
            print(f"  用户名: {data['username']}")
            print(f"  密码: {'*' * len(data['password'])} (已隐藏)")
            print()
        except Exception as e:
            print(f"[{role['name']}] ✗ 读取失败: {e}\n")
    
    print("=== 完成 ===")

if __name__ == '__main__':
    main()
