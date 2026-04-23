import logging
import sys
import os
from datetime import datetime, timedelta, timezone

def setup_logging(level=logging.INFO):
    """
    配置统一的日志格式，解决 Windows 环境下的编码和 ANSI 乱码问题
    """
    # 强制设置 sys.stdout 和 sys.stderr 编码为 utf-8，解决 Windows 下的编码问题
    if sys.platform == "win32":
        try:
            # 重新配置标准输出和错误流，确保支持 UTF-8
            import io
            if isinstance(sys.stdout, io.TextIOWrapper):
                sys.stdout.reconfigure(encoding='utf-8')
            if isinstance(sys.stderr, io.TextIOWrapper):
                sys.stderr.reconfigure(encoding='utf-8')
        except (AttributeError, Exception):
            pass

    # 定义简短的日志格式
    # 格式: [等级] 时间 - 消息
    log_format = "[%(levelname)s] %(asctime)s - %(message)s"
    date_format = "%Y-%m-%d %H:%M:%S"

    # 设置时区为 GMT+3
    tz = timezone(timedelta(hours=3))

    def custom_time_converter(timestamp):
        return datetime.fromtimestamp(timestamp, tz=tz).timetuple()

    # 清除现有的处理程序
    root_logger = logging.getLogger()
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # 创建格式化程序
    formatter = logging.Formatter(log_format, date_format)
    formatter.converter = custom_time_converter

    # 创建标准输出处理程序
    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setFormatter(formatter)
    
    # 创建标准错误处理程序
    stderr_handler = logging.StreamHandler(sys.stderr)
    stderr_handler.setFormatter(formatter)
    stderr_handler.setLevel(logging.ERROR)

    # 配置根日志器
    root_logger.setLevel(level)
    root_logger.addHandler(stdout_handler)
    root_logger.addHandler(stderr_handler)

    # 将 Uvicorn 的日志重定向到 stdout，避免生命周期 INFO（如 "Uvicorn running on...", "Received SIGINT"）进入 service_stderr.log
    for uvicorn_name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        uv_log = logging.getLogger(uvicorn_name)
        for h in uv_log.handlers[:]:
            uv_log.removeHandler(h)
        uv_log.setLevel(logging.WARNING if "error" in uvicorn_name or "access" in uvicorn_name else logging.INFO)
        uv_log.addHandler(stdout_handler)

    # 抑制其他过于嘈杂的库日志
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("passlib").setLevel(logging.ERROR)
    logging.getLogger("jose").setLevel(logging.ERROR)
    logging.getLogger("fsspec").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)

    return root_logger
