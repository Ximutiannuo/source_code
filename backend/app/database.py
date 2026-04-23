"""
数据库配置和连接
支持基于角色的动态数据库连接
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from typing import Dict, Optional
import os
import threading
import urllib.parse
from contextvars import ContextVar
from dotenv import load_dotenv

# 当前请求的角色上下文
current_role_context: ContextVar[Optional[str]] = ContextVar('current_role', default=None)

def load_env_with_fallback():
    """尝试用多种编码加载 .env 文件"""
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

# 自动加载环境变量
load_env_with_fallback()

# 默认引擎（延迟初始化）
_default_engine = None
_engine_lock = threading.Lock()

def get_default_engine():
    global _default_engine
    if _default_engine is None:
        with _engine_lock:
            if _default_engine is None:
                url = os.getenv("DATABASE_URL")
                if not url:
                    try:
                        from app.services.secret_manager import get_secret_manager
                        from app.config import settings
                        sm = get_secret_manager()
                        user = sm.get_role_username("SYSTEM_ADMIN")
                        pwd = sm.get_role_password("SYSTEM_ADMIN")
                        if user and pwd:
                            host = os.getenv("DB_HOST", "10.78.44.17")
                            url = f"mysql+pymysql://{user}:{urllib.parse.quote_plus(pwd)}@{host}:{settings.DB_PORT}/{settings.DB_NAME}?charset=utf8mb4"
                    except Exception:
                        pass
                
                if not url:
                    if os.getenv("ENV") == "production":
                        raise RuntimeError(
                            "生产环境未配置数据库凭据：未设置 DATABASE_URL，且无法从 Vault 读取 secret/db-roles/system_admin。"
                            "请执行：1) 用 root token 运行 backend/scripts/setup_vault.py 写入各角色密码；"
                            "2) 确保 Start-All-Services.ps1 使用的 VAULT_TOKEN 有权限读取 db-roles/*；3) 重启 ProjectControlsBackend 服务。"
                        )
                    url = "mysql+pymysql://root:password@localhost:3306/projectcontrols?charset=utf8mb4"

                # 200+ 并发用户时需足够连接：每 worker 约 pool_size+max_overflow；总连接数 ≈ workers*(pool_size+max_overflow)
                # 请确保 MySQL max_connections >= 该值（建议 >= 500，200 人同时用时推荐 800+）
                # read_timeout / write_timeout：单条查询若超时，pymysql 会抛 OperationalError(2013)
                # 并立即释放连接，避免一条慢查询长期霸占连接、耗尽连接池导致全服务卡死。
                # pool_timeout=30：连接池满时最多等 30 s，超时快速报错而非无限挂起。
                # read_timeout=600：ahead_plan 等大表跨多周查询耗时可能超 180s。
                # init_command：每条新连接建立后自动设置会话级 net_write_timeout/net_read_timeout，
                # 覆盖 MySQL 服务端全局默认值（通常 60s），防止服务端主动断开慢查询连接 (2013)。
                _default_engine = create_engine(
                    url,
                    pool_pre_ping=True,
                    pool_recycle=3600,
                    pool_size=40,
                    max_overflow=60,
                    pool_timeout=30,
                    connect_args={
                        "local_infile": 1,
                        "connect_timeout": 10,
                        "read_timeout": 600,
                        "write_timeout": 120,
                        "init_command": (
                            "SET SESSION net_write_timeout=600, "
                            "net_read_timeout=600"
                        ),
                    },
                )
    return _default_engine

# 基础模型
Base = declarative_base()

# --- 这里是关键：定义所有被其他模块引用的变量名 ---

# 使用 lambda 或简单函数封装，确保调用时才触发初始化
def SessionLocal(**kwargs):
    factory = sessionmaker(autocommit=False, autoflush=False, bind=get_default_engine())
    return factory(**kwargs)

# 某些模块可能直接导入了 DefaultSessionLocal
DefaultSessionLocal = SessionLocal

# 某些模块可能需要访问 engine 属性
class EngineProxy:
    def __getattr__(self, name):
        return getattr(get_default_engine(), name)
    def __repr__(self):
        return repr(get_default_engine())

engine = EngineProxy()
default_engine = engine

# 缓存角色引擎
_role_engines = {}
_engines_lock = threading.Lock()
_role_sessionmakers = {}
_sessionmakers_lock = threading.Lock()

def get_engine_for_role(role_name: Optional[str] = None):
    if not role_name:
        return get_default_engine()
    
    if role_name in _role_engines:
        return _role_engines[role_name]
    
    from app.config import settings
    url = settings.get_role_database_url(role_name)
    
    if not url:
        return get_default_engine()
    
    with _engines_lock:
        if role_name not in _role_engines:
            _role_engines[role_name] = create_engine(
                url,
                pool_pre_ping=True,
                pool_recycle=3600,
                pool_size=20,
                max_overflow=30,
                pool_timeout=30,
                connect_args={
                    "connect_timeout": 10,
                    "read_timeout": 600,
                    "write_timeout": 120,
                    "init_command": (
                        "SET SESSION net_write_timeout=600, "
                        "net_read_timeout=600"
                    ),
                },
            )
    return _role_engines[role_name]

def get_db() -> Session:
    role_name = current_role_context.get()
    role_engine = get_engine_for_role(role_name)
    
    with _sessionmakers_lock:
        if role_name not in _role_sessionmakers:
            _role_sessionmakers[role_name] = sessionmaker(autocommit=False, autoflush=False, bind=role_engine)
        factory = _role_sessionmakers[role_name]
    
    db = factory()
    try:
        yield db
    finally:
        db.close()

def get_db_for_role(role_name: str):
    role_engine = get_engine_for_role(role_name)
    factory = sessionmaker(autocommit=False, autoflush=False, bind=role_engine)
    db = factory()
    try:
        yield db
    finally:
        db.close()
