"""
重操作并发限流器

目的：防止少数用户的批量导入/导出/大查询耗尽 MySQL 连接池，影响所有其他用户。
策略：超过并发上限时立即返回 503，而非让请求排队等待（排队同样会耗尽线程和连接池）。

用法（在路由函数中）：
    from app.utils.heavy_op import import_limiter, heavy_query_limiter

    @router.post("/import/excel")
    async def import_excel(...):
        with import_limiter:
            # 原有逻辑不变
            ...
"""
import threading
import logging
from fastapi import HTTPException

logger = logging.getLogger(__name__)


class HeavyOperationLimiter:
    """
    非阻塞并发限流器。

    与 Semaphore 的区别：Semaphore 会让多余的请求排队等待，仍然消耗线程和内存；
    本限流器超限时立即返回 503，请求者可以看到明确提示，MySQL 不会受到额外压力。
    """

    def __init__(self, max_concurrent: int, operation_name: str):
        self._count = 0
        self._lock = threading.Lock()
        self._max = max_concurrent
        self._name = operation_name

    def __enter__(self):
        with self._lock:
            if self._count >= self._max:
                logger.warning(
                    "重操作限流触发: %s (当前并发 %d/%d)",
                    self._name, self._count, self._max,
                )
                raise HTTPException(
                    status_code=503,
                    detail=(
                        f"系统当前正在处理 {self._count} 个「{self._name}」任务，"
                        f"上限为 {self._max} 个并发。"
                        "请稍候片刻再重试，或联系管理员。"
                    ),
                )
            self._count += 1
            logger.debug("重操作开始: %s (当前并发 %d/%d)", self._name, self._count, self._max)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        with self._lock:
            self._count = max(0, self._count - 1)
            logger.debug("重操作结束: %s (当前并发 %d/%d)", self._name, self._count, self._max)

    def as_dependency(self):
        """
        作为 FastAPI Depends 使用，自动在请求开始时占槽、请求结束后释放。

        用法：
            @router.post("/heavy-endpoint")
            async def my_endpoint(
                ...,
                _: None = Depends(import_limiter.as_dependency),
            ):
                ...
        """
        with self._lock:
            if self._count >= self._max:
                logger.warning(
                    "重操作限流触发: %s (当前并发 %d/%d)",
                    self._name, self._count, self._max,
                )
                raise HTTPException(
                    status_code=503,
                    detail=(
                        f"系统当前已有 {self._count} 个「{self._name}」任务正在进行，"
                        f"上限为 {self._max} 个并发，请稍候再试。"
                    ),
                )
            self._count += 1
            logger.debug("重操作开始: %s (当前并发 %d/%d)", self._name, self._count, self._max)
        try:
            yield
        finally:
            with self._lock:
                self._count = max(0, self._count - 1)
                logger.debug("重操作结束: %s (当前并发 %d/%d)", self._name, self._count, self._max)

    @property
    def current(self) -> int:
        return self._count

    @property
    def max_concurrent(self) -> int:
        return self._max


# ---------------------------------------------------------------------------
# 全局限流器实例
# 服务器规格：后端 16C / 128GB RAM，MySQL 8C / 16GB（innodb_buffer_pool_size=8G）
# 调参思路：
#   import  → 瓶颈在 CPU（pandas 解析）+ MySQL 写
#   export  → 瓶颈在内存（openpyxl workbook ~150-300 MB/次）
#   query   → Python 侧轻量，瓶颈在 MySQL；多 worker 时总并发 = workers × 25
# ---------------------------------------------------------------------------

# 批量导入（Excel 上传）：读文件 → pandas → 批量写库，CPU + MySQL 写双重压力
import_limiter = HeavyOperationLimiter(max_concurrent=8, operation_name="批量导入")

# 批量导出（生成 Excel）：大查询 + 内存构建 workbook，内存压力为主
export_limiter = HeavyOperationLimiter(max_concurrent=15, operation_name="批量导出")

# 工程量清单大查询（/list /summary /list-advanced）：全表 JOIN + 聚合
heavy_query_limiter = HeavyOperationLimiter(max_concurrent=25, operation_name="大批量查询")
