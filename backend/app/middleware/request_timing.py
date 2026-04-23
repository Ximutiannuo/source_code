"""
API 请求耗时监控中间件

当请求耗时超过阈值时记录 WARNING，便于在假死发生后从 service_stdout.log 定位是哪个 API 卡住。
同时记录 DB 连接池状态，帮助判断是否为连接池耗尽。

环境变量：SLOW_REQUEST_THRESHOLD=3.0（秒）
"""
import logging
import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)

# 慢请求阈值（秒），超过则打 WARNING
SLOW_REQUEST_THRESHOLD = float(__import__("os").getenv("SLOW_REQUEST_THRESHOLD", "3.0"))

# 排除健康检查等噪音
SKIP_PATHS = {"/", "/health", "/api/health"}


class RequestTimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        if path in SKIP_PATHS:
            return await call_next(request)

        start = time.perf_counter()
        try:
            response = await call_next(request)
            elapsed = time.perf_counter() - start
            if elapsed >= SLOW_REQUEST_THRESHOLD:
                # 附加连接池状态，便于判断是否连接池耗尽
                pool_info = _get_pool_info()
                logger.warning(
                    "慢请求 [%.2fs] %s %s → %d | 连接池: %s",
                    elapsed,
                    request.method,
                    path,
                    response.status_code,
                    pool_info,
                )
            return response
        except Exception as e:
            elapsed = time.perf_counter() - start
            logger.error(
                "请求异常 [%.2fs] %s %s: %s",
                elapsed,
                request.method,
                path,
                str(e),
                exc_info=True,
            )
            raise


def _get_pool_info() -> str:
    """获取默认引擎连接池状态，不阻塞主流程"""
    try:
        from app.database import get_default_engine
        return get_default_engine().pool.status()
    except Exception:
        return "N/A"
