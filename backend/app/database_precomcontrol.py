"""
PRECOMCONTROL数据库配置和连接
用于访问WeldingList表
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
import threading
from dotenv import load_dotenv

# 尝试用多种编码加载 .env 文件
def load_env_with_fallback():
    encodings = ['utf-8', 'gbk', 'gb2312', 'latin-1', 'cp1252']
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if not os.path.exists(env_path):
        return
    for encoding in encodings:
        try:
            with open(env_path, 'r', encoding=encoding, errors='replace') as f:
                load_dotenv(dotenv_path=env_path, override=False)
                return
        except: continue
    load_dotenv()

# 加载环境变量
load_env_with_fallback()

# PRECOMCONTROL数据库配置
_precomcontrol_engine = None
_precomcontrol_session_factory = None
_precomcontrol_lock = threading.Lock()

def get_precomcontrol_engine():
    global _precomcontrol_engine
    if _precomcontrol_engine is None:
        with _precomcontrol_lock:
            if _precomcontrol_engine is None:
                url = os.getenv("PRECOMCONTROL_DATABASE_URL")
                if not url:
                    try:
                        from app.services.secret_manager import get_secret_manager
                        sm = get_secret_manager()
                        user = sm.get_role_username("SYSTEM_ADMIN")
                        pwd = sm.get_role_password("SYSTEM_ADMIN")
                        if user and pwd:
                            from app.config import settings
                            from urllib.parse import quote_plus
                            host = os.getenv("DB_HOST", "10.78.44.17")
                            url = f"mysql+pymysql://{user}:{quote_plus(pwd)}@{host}:{settings.DB_PORT}/{settings.DB_PRECOMCONTROL_NAME}?charset=utf8mb4"
                    except: pass

                if not url:
                    url = "mysql+pymysql://root:password@localhost:3306/PRECOMCONTROL?charset=utf8mb4"

                print(f"DEBUG: Precomcontrol connecting to: {url.split('@')[-1]}")
                _precomcontrol_engine = create_engine(
                    url,
                    pool_pre_ping=True,
                    pool_recycle=3600,
                    pool_size=5,
                    max_overflow=10
                )
    return _precomcontrol_engine

# --- 这里是关键：定义兼容性变量名 ---
def PrecomcontrolSessionLocal(**kwargs):
    global _precomcontrol_session_factory
    if _precomcontrol_session_factory is None:
        _precomcontrol_session_factory = sessionmaker(autocommit=False, autoflush=False, bind=get_precomcontrol_engine())
    return _precomcontrol_session_factory(**kwargs)

def get_precomcontrol_db():
    """获取PRECOMCONTROL数据库会话"""
    db = PrecomcontrolSessionLocal()
    try:
        yield db
    finally:
        db.close()
