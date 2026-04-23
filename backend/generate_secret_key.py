"""
生成强随机 SECRET_KEY 脚本
用于 JWT 令牌签名和验证

使用方法:
    python generate_secret_key.py

或者直接运行并复制输出:
    python generate_secret_key.py | clip  # Windows
    python generate_secret_key.py | pbcopy  # Mac
"""
import secrets
import sys


def generate_secret_key(length: int = 64) -> str:
    """
    生成强随机 SECRET_KEY
    
    Args:
        length: 密钥长度（默认64字符，推荐32-64字符）
    
    Returns:
        十六进制格式的随机字符串
    """
    # 使用 secrets 模块生成加密安全的随机字符串
    # 生成足够的随机字节，然后转换为十六进制字符串
    random_bytes = secrets.token_bytes(length // 2)  # 每个十六进制字符代表4位，所以除以2
    secret_key = random_bytes.hex()
    
    # 如果长度是奇数，截取到指定长度
    if len(secret_key) > length:
        secret_key = secret_key[:length]
    
    return secret_key


def main():
    """主函数"""
    # 生成64字符的强随机密钥（推荐长度）
    secret_key = generate_secret_key(64)
    
    print("=" * 70)
    print("生成的 SECRET_KEY (64字符):")
    print("=" * 70)
    print(secret_key)
    print("=" * 70)
    print()
    print("使用方法:")
    print("1. 复制上面的 SECRET_KEY")
    print("2. 打开 backend/.env 文件")
    print("3. 找到或添加以下行:")
    print(f"   SECRET_KEY={secret_key}")
    print()
    print("注意:")
    print("- 请妥善保管此密钥，不要泄露给他人")
    print("- 如果密钥泄露，请立即更换并重新生成所有用户的令牌")
    print("- 生产环境必须使用强随机密钥，不要使用默认值")
    print("=" * 70)
    
    # 如果是在 Windows 上，尝试自动复制到剪贴板
    if sys.platform == "win32":
        try:
            import pyperclip
            pyperclip.copy(secret_key)
            print("\n✓ 已自动复制到剪贴板！")
        except ImportError:
            print("\n提示: 安装 pyperclip 可以自动复制到剪贴板")
            print("      pip install pyperclip")
        except Exception:
            pass  # 如果复制失败，忽略错误


if __name__ == "__main__":
    main()
