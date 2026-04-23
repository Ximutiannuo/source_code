"""
P6同步调度器独立服务
独立运行，不依赖主后端服务
"""
import sys
import os
from pathlib import Path

# 设置项目路径
current_file = Path(__file__).resolve()
backend_dir = current_file.parent
project_root = backend_dir.parent

if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# 加载环境变量
# 注意：必须无条件加载 .env 文件，以确保所有环境变量（如 P6_SYNC_PROJECT_IDS）都被读取
from dotenv import load_dotenv

# 尝试从多个位置加载 .env 文件
env_paths = [
    os.path.join(backend_dir, '.env'),  # backend/.env
    os.path.join(project_root, '.env'),  # 项目根目录/.env
]

env_loaded = False
for env_path in env_paths:
    abs_env_path = os.path.abspath(env_path)
    if os.path.exists(abs_env_path):
        # 尝试用多种编码加载
        encodings = ['utf-8', 'gbk', 'gb2312', 'latin-1', 'cp1252']
        for encoding in encodings:
            try:
                load_dotenv(dotenv_path=abs_env_path, encoding=encoding, override=False)
                env_loaded = True
                print(f"✅ 已从 {abs_env_path} 加载环境变量")
                break
            except (UnicodeDecodeError, UnicodeError):
                continue
            except Exception:
                continue
        if env_loaded:
            break

if not env_loaded:
    # 如果指定路径都找不到，尝试默认方式
    try:
        load_dotenv()
    except:
        pass

import logging
import signal
import time
import json
from datetime import datetime, timezone
from app.p6_sync.scheduler import start_scheduler, stop_scheduler, get_scheduler_status
from app.utils.logging import setup_logging

# 配置日志
setup_logging(level=logging.INFO)
logger = logging.getLogger(__name__)

# 全局变量，用于优雅关闭
scheduler_running = True

# 心跳文件路径（使用系统临时目录）
import tempfile
heartbeat_file = Path(tempfile.gettempdir()) / "p6_scheduler_heartbeat.json"

def update_heartbeat():
    """更新心跳文件，表示调度器正在运行（任务状态由调度器任务直接更新）"""
    try:
        # 读取现有心跳文件，保留任务状态和jobs（任务状态由调度器任务直接更新）
        existing_task_status = {
            "delete_detection_running": False,
            "incremental_sync_running": False,
            "reset_sync_running": False,
            "status": {
                "delete_detection": {"running": False, "started_at": None, "pid": None},
                "incremental_sync": {"running": False, "started_at": None, "pid": None},
                "reset_sync": {"running": False, "started_at": None, "pid": None}
            }
        }
        existing_jobs = []
        
        if heartbeat_file.exists():
            try:
                with open(heartbeat_file, 'r', encoding='utf-8') as f:
                    existing_data = json.load(f)
                    if 'task_status' in existing_data:
                        existing_task_status = existing_data['task_status']
                    if 'jobs' in existing_data:
                        existing_jobs = existing_data['jobs']
            except Exception:
                pass  # 如果读取失败，使用默认值
        
        # 获取当前调度器的 jobs 信息
        try:
            from app.p6_sync.scheduler import get_scheduler
            scheduler = get_scheduler()
            if scheduler and scheduler.running:
                jobs = []
                for job in scheduler.get_jobs():
                    jobs.append({
                        "id": job.id,
                        "name": job.name,
                        "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None
                    })
                existing_jobs = jobs
        except Exception as e:
            logger.debug(f"获取调度器jobs失败: {e}")
        
        # 只更新基本心跳信息，保留任务状态和jobs（由调度器任务直接更新）
        heartbeat_data = {
            "running": True,
            "last_update": datetime.now(timezone.utc).isoformat(),
            "pid": os.getpid(),
            "task_status": existing_task_status,  # 保留现有任务状态
            "jobs": existing_jobs  # 包含jobs信息
        }
        with open(heartbeat_file, 'w', encoding='utf-8') as f:
            json.dump(heartbeat_data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        # 心跳更新失败不应该影响主程序运行
        logger.debug(f"更新心跳文件失败: {e}")

def cleanup_heartbeat():
    """清理心跳文件"""
    try:
        if heartbeat_file.exists():
            heartbeat_file.unlink()
    except Exception as e:
        logger.debug(f"清理心跳文件失败: {e}")

def signal_handler(signum, frame):
    """处理退出信号"""
    global scheduler_running
    print("\n收到退出信号，正在停止...")
    scheduler_running = False

def main():
    """主函数"""
    global scheduler_running
    
    # 注册信号处理器
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # 从环境变量读取项目ID列表
    project_ids_str = os.getenv('P6_SYNC_PROJECT_IDS', '')
    project_ids = None
    if project_ids_str:
        project_ids = [pid.strip() for pid in project_ids_str.split(',') if pid.strip()]
        logger.info(f"从环境变量读取项目ID列表: {project_ids}")
    else:
        logger.info("未设置 P6_SYNC_PROJECT_IDS，将同步所有项目")
    
    try:
        # 启动调度器
        logger.info("=" * 60)
        logger.info("P6同步调度器服务启动")
        logger.info("=" * 60)
        start_scheduler(project_ids=project_ids)
        
        # 保持运行
        logger.info("调度器已启动，按 Ctrl+C 停止...")
        
        # 初始化心跳文件
        update_heartbeat()
        logger.info(f"心跳文件已初始化: {heartbeat_file}")
        last_heartbeat_time = time.time()
        heartbeat_interval = 30  # 每30秒更新一次心跳
        
        while scheduler_running:
            time.sleep(1)
            
            # 定期更新心跳文件
            current_time = time.time()
            if current_time - last_heartbeat_time >= heartbeat_interval:
                update_heartbeat()
                last_heartbeat_time = current_time
    
    except KeyboardInterrupt:
        logger.info("收到键盘中断信号 (KeyboardInterrupt)")
        scheduler_running = False
    except Exception as e:
        logger.error(f"调度器服务异常: {e}", exc_info=True)
        scheduler_running = False
    finally:
        logger.info("正在停止调度器...")
        try:
            stop_scheduler()
        except Exception as e:
            logger.error(f"停止调度器时出错: {e}")
        try:
            cleanup_heartbeat()  # 清理心跳文件
        except Exception as e:
            logger.debug(f"清理心跳文件时出错: {e}")
        logger.info("调度器服务已停止")

if __name__ == "__main__":
    main()

