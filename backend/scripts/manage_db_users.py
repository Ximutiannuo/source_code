#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据库用户管理工具
功能：
1. 修改 MySQL 用户密码
2. 同步修改 Vault 中的密码
3. 修改用户权限
4. 验证连接
"""
import sys
import os
from pathlib import Path
import logging
import argparse

# 设置 Windows 控制台编码
if sys.platform == 'win32':
    try:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    except:
        pass

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('db_users_management.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# 角色配置
ROLES = [
    ('role_planning_manager', 'PLANNING_MANAGER', 'planning_manager'),
    ('role_system_admin', 'SYSTEM_ADMIN', 'system_admin'),
    ('role_planning_supervisor', 'PLANNING_SUPERVISOR', 'planning_supervisor'),
    ('role_planner', 'PLANNER', 'planner'),
]


def get_db_connection():
    """获取数据库连接"""
    import pymysql
    from dotenv import load_dotenv
    
    env_path = os.path.join(backend_dir, '.env')
    load_dotenv(env_path)
    
    db_url = os.getenv('DATABASE_URL', '')
    import re
    match = re.search(r'@([^:]+):(\d+)/', db_url)
    if match:
        db_host = match.group(1)
        db_port = int(match.group(2))
    else:
        db_host = 'localhost'
        db_port = 3306
    
    match = re.search(r'://([^:]+):([^@]+)@', db_url)
    if match:
        root_user = match.group(1)
        root_pass = match.group(2)
    else:
        root_user = 'root'
        root_pass = input("请输入 MySQL root 密码: ").strip()
    
    return pymysql.connect(
        host=db_host,
        port=db_port,
        user=root_user,
        password=root_pass,
        charset='utf8mb4',
        connect_timeout=10
    ), db_host, db_port


def get_vault_client():
    """获取 Vault 客户端"""
    import hvac
    
    os.environ['VAULT_ADDR'] = os.getenv('VAULT_ADDR', 'http://127.0.0.1:8200')
    os.environ['VAULT_TOKEN'] = os.getenv('VAULT_TOKEN', '')
    
    if not os.environ['VAULT_TOKEN']:
        raise ValueError("VAULT_TOKEN 未设置，请设置环境变量或在 .env 文件中配置")
    
    client = hvac.Client(url=os.environ['VAULT_ADDR'], token=os.environ['VAULT_TOKEN'])
    
    if not client.is_authenticated():
        raise ValueError("Vault 认证失败，请检查 VAULT_TOKEN")
    
    return client


def update_mysql_password(cursor, role_name, password, host='both'):
    """更新 MySQL 用户密码"""
    hosts = ['localhost', '%'] if host == 'both' else [host]
    success_count = 0
    
    for h in hosts:
        try:
            cursor.execute(f"ALTER USER '{role_name}'@'{h}' IDENTIFIED BY '{password}'")
            logger.info(f"{role_name}@{h}: 密码更新成功")
            success_count += 1
        except Exception as e:
            logger.error(f"{role_name}@{h}: 密码更新失败 - {e}")
            # 如果用户不存在，尝试创建
            if 'does not exist' in str(e) or 'Unknown user' in str(e):
                try:
                    cursor.execute(f"CREATE USER '{role_name}'@'{h}' IDENTIFIED BY '{password}'")
                    logger.info(f"{role_name}@{h}: 用户创建成功")
                    success_count += 1
                except Exception as e2:
                    logger.error(f"{role_name}@{h}: 创建用户失败 - {e2}")
    
    return success_count


def update_vault_password(vault_client, vault_role, username, password):
    """更新 Vault 中的密码"""
    vault_path = f'db-roles/{vault_role}'
    
    try:
        # 尝试 KV v2
        try:
            vault_client.secrets.kv.v2.create_or_update_secret(
                mount_point='secret',
                path=vault_path,
                secret={
                    'username': username,
                    'password': password
                }
            )
            logger.info(f"Vault {vault_path}: 密码更新成功 (KV v2)")
            return True
        except Exception as e1:
            # 尝试 KV v1
            try:
                vault_client.secrets.kv.v1.create_or_update_secret(
                    mount_point='secret',
                    path=vault_path,
                    secret={
                        'username': username,
                        'password': password
                    }
                )
                logger.info(f"Vault {vault_path}: 密码更新成功 (KV v1)")
                return True
            except Exception as e2:
                logger.error(f"Vault {vault_path}: 更新失败 - KV v2: {e1}, KV v1: {e2}")
                return False
    except Exception as e:
        logger.error(f"Vault {vault_path}: 更新失败 - {e}")
        return False


def grant_permissions(cursor, role_name, host='both'):
    """授予用户权限"""
    hosts = ['localhost', '%'] if host == 'both' else [host]
    success_count = 0
    
    for h in hosts:
        try:
            # 授予 projectcontrols 数据库权限
            cursor.execute(f"""
                GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP 
                ON projectcontrols.* TO '{role_name}'@'{h}'
            """)
            logger.info(f"{role_name}@{h}: projectcontrols 权限已授予")
            success_count += 1
            
            # 授予 proecomcontrol 数据库权限（如果需要）
            try:
                cursor.execute(f"""
                    GRANT SELECT, INSERT, UPDATE, DELETE 
                    ON proecomcontrol.* TO '{role_name}'@'{h}'
                """)
                logger.info(f"{role_name}@{h}: proecomcontrol 权限已授予")
            except Exception as e:
                if 'Unknown database' not in str(e):
                    logger.warning(f"{role_name}@{h}: proecomcontrol 权限授予失败 - {e}")
        except Exception as e:
            logger.error(f"{role_name}@{h}: 权限授予失败 - {e}")
    
    return success_count


def verify_connection(db_host, db_port, username, password):
    """验证数据库连接"""
    import pymysql
    
    try:
        conn = pymysql.connect(
            host=db_host,
            port=db_port,
            user=username,
            password=password,
            database='projectcontrols',
            charset='utf8mb4',
            connect_timeout=10
        )
        # 测试查询
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"{username}: 连接验证失败 - {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description='数据库用户管理工具')
    parser.add_argument('action', choices=['update-password', 'update-permissions', 'sync-vault', 'verify', 'all'],
                       help='操作类型')
    parser.add_argument('--password', type=str, help='新密码（用于 update-password）')
    parser.add_argument('--role', type=str, help='指定角色（可选，不指定则处理所有角色）')
    parser.add_argument('--skip-vault', action='store_true', help='跳过 Vault 更新')
    parser.add_argument('--skip-mysql', action='store_true', help='跳过 MySQL 更新')
    
    args = parser.parse_args()
    
    print("=" * 80)
    print("数据库用户管理工具")
    print("=" * 80)
    print()
    
    # 获取数据库连接
    if not args.skip_mysql:
        try:
            root_conn, db_host, db_port = get_db_connection()
            cursor = root_conn.cursor()
            print(f"[OK] MySQL 连接成功 ({db_host}:{db_port})")
        except Exception as e:
            print(f"[ERROR] MySQL 连接失败: {e}")
            if args.action in ['update-password', 'update-permissions', 'all']:
                sys.exit(1)
            root_conn = None
            cursor = None
            db_host = None
            db_port = None
    else:
        root_conn = None
        cursor = None
        db_host = None
        db_port = None
    
    # 获取 Vault 客户端
    vault_client = None
    if not args.skip_vault and args.action in ['sync-vault', 'all']:
        try:
            vault_client = get_vault_client()
            print(f"[OK] Vault 连接成功")
        except Exception as e:
            print(f"[ERROR] Vault 连接失败: {e}")
            if args.action == 'sync-vault':
                sys.exit(1)
    
    print()
    
    # 过滤角色
    roles_to_process = ROLES
    if args.role:
        roles_to_process = [r for r in ROLES if args.role.lower() in r[0].lower() or args.role.lower() in r[1].lower()]
        if not roles_to_process:
            print(f"[ERROR] 未找到角色: {args.role}")
            sys.exit(1)
    
    # 执行操作
    if args.action == 'update-password' or args.action == 'all':
        if not args.password:
            print("[ERROR] 更新密码需要提供 --password 参数")
            sys.exit(1)
        
        print(f"[操作] 更新密码为: {args.password}")
        print()
        
        for role_name, role_key, vault_role in roles_to_process:
            print(f"处理 {role_name}...")
            
            # 更新 MySQL 密码
            if not args.skip_mysql:
                update_mysql_password(cursor, role_name, args.password)
            
            # 更新 Vault 密码
            if not args.skip_vault and vault_client:
                update_vault_password(vault_client, vault_role, role_name, args.password)
            
            print()
        
        if not args.skip_mysql:
            cursor.execute("FLUSH PRIVILEGES")
            root_conn.commit()
            print("[OK] 权限已刷新")
            print()
    
    if args.action == 'update-permissions' or args.action == 'all':
        print("[操作] 更新权限")
        print()
        
        for role_name, role_key, vault_role in roles_to_process:
            print(f"处理 {role_name}...")
            grant_permissions(cursor, role_name)
            print()
        
        cursor.execute("FLUSH PRIVILEGES")
        root_conn.commit()
        print("[OK] 权限已刷新")
        print()
    
    if args.action == 'sync-vault':
        print("[操作] 同步 Vault 密码")
        print()
        
        if not args.password:
            print("[ERROR] 同步 Vault 需要提供 --password 参数")
            sys.exit(1)
        
        for role_name, role_key, vault_role in roles_to_process:
            print(f"处理 {role_name}...")
            update_vault_password(vault_client, vault_role, role_name, args.password)
            print()
    
    if args.action == 'verify' or args.action == 'all':
        print("[操作] 验证连接")
        print()
        
        os.environ['VAULT_ADDR'] = os.getenv('VAULT_ADDR', 'http://127.0.0.1:8200')
        os.environ['VAULT_TOKEN'] = os.getenv('VAULT_TOKEN', '')
        
        from app.services.secret_manager import get_secret_manager
        sm = get_secret_manager()
        
        all_ok = True
        for role_name, role_key, vault_role in roles_to_process:
            username = sm.get_role_username(role_key)
            password = sm.get_role_password(role_key)
            
            if not password:
                print(f"  [ERROR] {role_name}: 无法从 SecretManager 获取密码")
                all_ok = False
                continue
            
            if verify_connection(db_host, db_port, username, password):
                print(f"  [OK] {role_name}: 连接成功")
            else:
                print(f"  [ERROR] {role_name}: 连接失败")
                all_ok = False
        
        print()
        if all_ok:
            print("[OK] 所有连接验证通过!")
        else:
            print("[ERROR] 部分连接验证失败")
    
    if root_conn:
        cursor.close()
        root_conn.close()
    
    print()
    print("详细日志已保存到: db_users_management.log")
    print()


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n[INFO] 用户中断")
        sys.exit(0)
    except Exception as e:
        logger.error(f"操作失败: {e}", exc_info=True)
        print(f"[ERROR] 操作失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
