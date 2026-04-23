"""
生产环境启动脚本
使用 Gunicorn 运行 FastAPI 应用
"""
import subprocess
import sys
import os

# 确保环境变量已加载
from app.database import load_env_with_fallback

if not os.getenv('DATABASE_URL'):
    load_env_with_fallback()

if __name__ == "__main__":
    # 检查gunicorn是否安装
    try:
        import gunicorn
    except ImportError:
        print("错误: 未安装 gunicorn")
        print("请运行: pip install gunicorn")
        sys.exit(1)
    
    # 使用gunicorn启动应用
    # 配置文件路径
    config_file = os.path.join(os.path.dirname(__file__), "gunicorn_config.py")
    
    # 构建命令
    cmd = [
        "gunicorn",
        "app.main:app",
        "-c", config_file
    ]
    
    # 执行命令
    try:
        subprocess.run(cmd, check=True)
    except KeyboardInterrupt:
        print("\n服务器已停止")
    except subprocess.CalledProcessError as e:
        print(f"启动失败: {e}")
        sys.exit(1)

