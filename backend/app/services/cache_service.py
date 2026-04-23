"""
Redis缓存服务
用于缓存查询结果，提升性能
"""
import json
import hashlib
from typing import Optional, Any, Dict
from functools import wraps
import logging

logger = logging.getLogger(__name__)

# 尝试导入redis
try:
    import redis
    from redis import Redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logger.warning("Redis not installed. Caching will be disabled.")
    Redis = None

from app.config import settings


class CacheService:
    """Redis缓存服务"""
    
    def __init__(self):
        self._client: Optional[Redis] = None
        self._enabled = False
        
    def _get_client(self) -> Optional[Redis]:
        """获取Redis客户端（延迟初始化）"""
        if not REDIS_AVAILABLE:
            return None
            
        if self._client is None:
            try:
                # 从环境变量获取Redis配置
                redis_host = getattr(settings, 'REDIS_HOST', 'localhost')
                redis_port = getattr(settings, 'REDIS_PORT', 6379)
                redis_db = getattr(settings, 'REDIS_DB', 0)
                redis_password = getattr(settings, 'REDIS_PASSWORD', None)
                
                self._client = redis.Redis(
                    host=redis_host,
                    port=redis_port,
                    db=redis_db,
                    password=redis_password,
                    decode_responses=True,  # 自动解码为字符串
                    socket_connect_timeout=5,
                    socket_timeout=5,
                )
                # 测试连接
                self._client.ping()
                self._enabled = True
                logger.info(f"✅ Redis connected successfully: {redis_host}:{redis_port}/{redis_db}")
                print(f"✅ Redis connected successfully: {redis_host}:{redis_port}/{redis_db}")
            except Exception as e:
                logger.warning(f"Redis connection failed: {e}. Caching will be disabled.")
                self._enabled = False
                self._client = None
                
        return self._client
    
    def get(self, key: str) -> Optional[Any]:
        """获取缓存值"""
        if not self._enabled:
            return None
            
        try:
            client = self._get_client()
            if not client:
                return None
                
            value = client.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            logger.warning(f"Cache get error for key {key}: {e}")
            return None
    
    def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        """设置缓存值（TTL默认5分钟）"""
        if not self._enabled:
            return False
            
        try:
            client = self._get_client()
            if not client:
                return False
                
            json_value = json.dumps(value, ensure_ascii=False, default=str)
            client.setex(key, ttl, json_value)
            return True
        except Exception as e:
            logger.warning(f"Cache set error for key {key}: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """删除缓存"""
        if not self._enabled:
            return False
            
        try:
            client = self._get_client()
            if not client:
                return False
                
            client.delete(key)
            return True
        except Exception as e:
            logger.warning(f"Cache delete error for key {key}: {e}")
            return False
    
    def delete_pattern(self, pattern: str) -> int:
        """删除匹配模式的所有缓存（例如：activity_detail:*）"""
        if not self._enabled:
            return 0
            
        try:
            client = self._get_client()
            if not client:
                return 0
                
            keys = client.keys(pattern)
            if keys:
                return client.delete(*keys)
            return 0
        except Exception as e:
            logger.warning(f"Cache delete_pattern error for pattern {pattern}: {e}")
            return 0
    
    def generate_key(self, prefix: str, **kwargs) -> str:
        """生成缓存键
        
        Args:
            prefix: 缓存键前缀（如 'activity_detail'）
            **kwargs: 用于生成键的参数（会排序后hash）
        
        Returns:
            格式: prefix:hash(params)
        """
        # 过滤None值，排序后生成hash
        params = {k: v for k, v in sorted(kwargs.items()) if v is not None}
        if not params:
            return f"{prefix}:all"
        
        # 生成参数的hash
        params_str = json.dumps(params, sort_keys=True, ensure_ascii=False, default=str)
        params_hash = hashlib.md5(params_str.encode('utf-8')).hexdigest()[:16]
        
        return f"{prefix}:{params_hash}"
    
    def is_enabled(self) -> bool:
        """检查缓存是否启用"""
        return self._enabled


# 全局缓存服务实例
_cache_service = CacheService()


def get_cache_service() -> CacheService:
    """获取缓存服务实例"""
    return _cache_service


def cached(ttl: int = 300, key_prefix: str = ""):
    """缓存装饰器
    
    Usage:
        @cached(ttl=600, key_prefix="activity_detail")
        def get_activity_details(filters):
            ...
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            cache_service = get_cache_service()
            
            # 如果缓存未启用，直接执行函数
            if not cache_service.is_enabled():
                return func(*args, **kwargs)
            
            # 生成缓存键（排除db参数，因为它是Session对象）
            cache_kwargs = {k: v for k, v in kwargs.items() if k != 'db'}
            cache_key = cache_service.generate_key(key_prefix or func.__name__, **cache_kwargs)
            
            # 尝试从缓存获取
            cached_result = cache_service.get(cache_key)
            if cached_result is not None:
                logger.debug(f"Cache hit: {cache_key}")
                return cached_result
            
            # 缓存未命中，执行函数
            logger.debug(f"Cache miss: {cache_key}")
            result = func(*args, **kwargs)
            
            # 将结果存入缓存
            cache_service.set(cache_key, result, ttl)
            
            return result
        
        return wrapper
    return decorator

