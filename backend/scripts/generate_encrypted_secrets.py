#!/usr/bin/env python3
"""
生成加密的密钥配置文件（备选方案）
仅在无法使用环境变量注入时使用

使用方法：
    python scripts/generate_encrypted_secrets.py

生成的文件：
    - config/.secrets.key: 加密密钥（必须保密，文件权限600）
    - config/secrets.encrypted: 加密后的配置文件
"""
import os
import sys
import json
from pathlib import Path
from cryptography.fernet import Fernet

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

def generate_key():
    """生成新的加密密钥"""
    return Fernet.generate_key()

def encrypt_secrets(secrets: dict, key: bytes) -> bytes:
    """加密密钥字典"""
    fernet = Fernet(key)
    json_data = json.dumps(secrets, ensure_ascii=False, indent=2)
    encrypted_data = fernet.encrypt(json_data.encode('utf-8'))
    return encrypted_data

def main():
    """主函数"""
    # 创建 config 目录
    config_dir = project_root / 'config'
    config_dir.mkdir(exist_ok=True)
    
    key_file = config_dir / '.secrets.key'
    encrypted_file = config_dir / 'secrets.encrypted'
    
    # 检查是否已存在密钥文件
    if key_file.exists():
        print(f"⚠️  警告：密钥文件已存在: {key_file}")
        response = input("是否覆盖现有密钥文件？这将导致旧的加密文件无法解密 (y/N): ")
        if response.lower() != 'y':
            print("已取消操作")
            return
        # 使用现有密钥
        with open(key_file, 'rb') as f:
            key = f.read()
        print(f"使用现有密钥: {key_file}")
    else:
        # 生成新密钥
        key = generate_key()
        with open(key_file, 'wb') as f:
            f.write(key)
        os.chmod(key_file, 0o600)  # 设置文件权限为 600（仅所有者可读写）
        print(f"✅ 已生成新密钥: {key_file}")
        print(f"   文件权限: 600 (仅所有者可读写)")
    
    # 从用户输入获取密钥（不显示在屏幕上）
    print("\n请输入角色数据库账号密码（密码不会显示在屏幕上）：")
    
    secrets = {}
    
    roles = [
        ('PLANNING_MANAGER', '计划经理'),
        ('SYSTEM_ADMIN', '系统管理员'),
        ('PLANNING_SUPERVISOR', '计划主管'),
        ('PLANNER', 'Planner'),
    ]
    
    for role_key, role_name in roles:
        username_key = f"ROLE_{role_key}_USERNAME"
        password_key = f"ROLE_{role_key}_PASSWORD"
        
        # 用户名（有默认值）
        username_default = f"role_{role_key.lower()}"
        username = input(f"{role_name} - 用户名 [{username_default}]: ").strip() or username_default
        secrets[username_key] = username
        
        # 密码（隐藏输入）
        import getpass
        password = getpass.getpass(f"{role_name} - 密码: ")
        if not password:
            print(f"⚠️  警告：{role_name} 密码为空，跳过")
            continue
        secrets[password_key] = password
    
    # 加密并保存
    encrypted_data = encrypt_secrets(secrets, key)
    with open(encrypted_file, 'wb') as f:
        f.write(encrypted_data)
    os.chmod(encrypted_file, 0o600)  # 设置文件权限为 600
    
    print(f"\n✅ 已生成加密配置文件: {encrypted_file}")
    print(f"   文件权限: 600 (仅所有者可读写)")
    print(f"\n⚠️  重要提示：")
    print(f"   1. 密钥文件 ({key_file}) 必须保密，不要提交到版本控制")
    print(f"   2. 备份时请确保密钥文件和加密文件都备份")
    print(f"   3. 建议在生产环境使用环境变量注入（不存储在文件中）")
    print(f"   4. 将此文件加入 .gitignore")

if __name__ == '__main__':
    main()
