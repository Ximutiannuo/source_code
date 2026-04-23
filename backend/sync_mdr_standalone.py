import sys
import os
import time
import logging
from datetime import datetime

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger("sync_mdr_standalone")

# 脚本在 backend 目录下，直接将当前目录添加到路径即可
current_dir = os.path.abspath(os.path.dirname(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# 加载环境变量 (.env 就在当前目录)
from dotenv import load_dotenv
load_dotenv(os.path.join(current_dir, ".env"))

# 导入服务逻辑
try:
    from app.services.mdr_sync_service import MDRSyncService
    from app.database import default_engine
    from sqlalchemy import text
except ImportError as e:
    logger.error(f"导入失败: {e}")
    logger.error("请确保在 backend 目录下运行。")
    sys.exit(1)

def run_sync():
    logger.info("="*50)
    logger.info(f"MDR 独立同步脚本启动: {datetime.now()}")
    logger.info("="*50)
    
    start_time = time.time()
    
    try:
        # 执行同步
        result = MDRSyncService.sync_mdr_data()
        
        if result.get("success"):
            duration = time.time() - start_time
            logger.info("\n" + "="*50)
            logger.info(f"✅ 同步成功!")
            logger.info(f"总记录数: {result.get('count'):,}")
            logger.info(f"总耗时: {duration:.2f} 秒")
            logger.info("="*50)
        else:
            logger.error(f"\n❌ 同步失败: {result.get('error')}")
            
    except KeyboardInterrupt:
        logger.warning("\n⚠️ 用户手动中断同步。")
    except Exception as e:
        logger.error(f"\n异常退出: {e}", exc_info=True)

if __name__ == "__main__":
    run_sync()
