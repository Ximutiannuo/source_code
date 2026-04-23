"""
Gunicorn 生产环境配置文件
用于多进程运行 FastAPI 应用
"""
import multiprocessing
import os

# 服务器socket
# 使用端口 8001，避免与其他系统冲突（8000 被其他服务占用，8200 是 Vault）
bind = "127.0.0.1:8001"
# 或者使用Unix socket（性能更好）
# bind = "unix:/var/run/projectcontrols/gunicorn.sock"

# 工作进程数
# 推荐公式: (2 x CPU核心数) + 1
workers = multiprocessing.cpu_count() * 2 + 1

# 工作进程类型
worker_class = "uvicorn.workers.UvicornWorker"

# 每个工作进程的线程数（如果使用threads模式）
# threads = 2

# 工作进程超时时间（秒）- AI 助手（DeepSeek + 多轮 tool + ahead_plan 查询）可超 5 分钟，需与 nginx ai-assistant 的 600s 一致
timeout = 600

# 保持连接的超时时间
keepalive = 5

# 最大并发请求数
worker_connections = 1000

# 预加载应用（节省内存，但可能导致热重载问题）
preload_app = True

# 工作进程重启前的最大请求数（防止内存泄漏）
max_requests = 1000
max_requests_jitter = 50

# 日志配置
# Windows 和 Linux 兼容的日志路径
import platform
if platform.system() == "Windows":
    # Windows 路径
    log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")
    os.makedirs(log_dir, exist_ok=True)
    accesslog = os.path.join(log_dir, "gunicorn_access.log")
    errorlog = os.path.join(log_dir, "gunicorn_error.log")
else:
    # Linux 路径
    log_dir = "/var/log/projectcontrols"
    os.makedirs(log_dir, exist_ok=True)
    accesslog = os.path.join(log_dir, "gunicorn_access.log")
    errorlog = os.path.join(log_dir, "gunicorn_error.log")

loglevel = "info"

# 进程名称
proc_name = "projectcontrols"

# 用户和组（生产环境建议使用非root用户）
# user = "www-data"
# group = "www-data"

# 临时目录
# Windows 和 Linux 兼容的临时目录
if platform.system() == "Windows":
    tmp_upload_dir = os.path.join(os.environ.get("TEMP", "C:\\temp"), "projectcontrols")
else:
    tmp_upload_dir = "/tmp"
os.makedirs(tmp_upload_dir, exist_ok=True)

# 环境变量
raw_env = [
    # 可以在这里添加环境变量
    # "ENV=production",
]

# 优雅重启
graceful_timeout = 30

# 工作进程启动前的钩子
def on_starting(server):
    """服务器启动时执行"""
    server.log.info("ProjectControls 服务器正在启动...")

def on_reload(server):
    """重载时执行"""
    server.log.info("ProjectControls 服务器正在重载...")

def when_ready(server):
    """服务器就绪时执行"""
    server.log.info("ProjectControls 服务器已就绪，开始接受连接")

def on_exit(server):
    """服务器退出时执行"""
    server.log.info("ProjectControls 服务器正在关闭...")

