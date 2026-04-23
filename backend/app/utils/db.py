import time
import functools
import logging
import random
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def _format_query(q, max_len=200):
    if q is None:
        return "[NULL]"
    s = str(q).strip().replace("\n", " ").replace("\r", "")
    return (s[:max_len] + "...") if len(s) > max_len else s


def get_lock_diagnostics(engine):
    """
    查询当前 MySQL 锁等待与阻塞信息，用于 1205/1213 时诊断。
    使用独立连接查询，不依赖当前失败的事务。
    返回多行字符串，便于写入日志。
    """
    lines = []
    try:
        with engine.connect() as conn:
            version = conn.execute(text("SELECT VERSION()")).scalar()
            is_mysql8 = int(str(version).split(".")[0]) >= 8
    except Exception as e:
        return f"[无法获取版本] {e}"

    # 1) 锁等待 / 阻塞关系
    try:
        if is_mysql8:
            q = text("""
                SELECT
                    r.trx_id AS waiting_trx_id,
                    r.trx_mysql_thread_id AS waiting_thread,
                    r.trx_query AS waiting_query,
                    TIMESTAMPDIFF(SECOND, r.trx_started, NOW()) AS waiting_sec,
                    b.trx_mysql_thread_id AS blocking_thread,
                    b.trx_query AS blocking_query,
                    TIMESTAMPDIFF(SECOND, b.trx_started, NOW()) AS blocking_sec,
                    pl_waiting.USER AS waiting_user,
                    pl_blocking.USER AS blocking_user,
                    pl_blocking.HOST AS blocking_host
                FROM performance_schema.data_lock_waits w
                INNER JOIN information_schema.innodb_trx r ON w.REQUESTING_ENGINE_TRANSACTION_ID = r.trx_id
                INNER JOIN information_schema.innodb_trx b ON w.BLOCKING_ENGINE_TRANSACTION_ID = b.trx_id
                LEFT JOIN information_schema.processlist pl_waiting ON r.trx_mysql_thread_id = pl_waiting.ID
                LEFT JOIN information_schema.processlist pl_blocking ON b.trx_mysql_thread_id = pl_blocking.ID
                ORDER BY waiting_sec DESC
            """)
        else:
            q = text("""
                SELECT
                    r.trx_id AS waiting_trx_id,
                    r.trx_mysql_thread_id AS waiting_thread,
                    r.trx_query AS waiting_query,
                    TIMESTAMPDIFF(SECOND, r.trx_started, NOW()) AS waiting_sec,
                    b.trx_mysql_thread_id AS blocking_thread,
                    b.trx_query AS blocking_query,
                    TIMESTAMPDIFF(SECOND, b.trx_started, NOW()) AS blocking_sec,
                    pl_waiting.USER AS waiting_user,
                    pl_blocking.USER AS blocking_user,
                    pl_blocking.HOST AS blocking_host
                FROM information_schema.innodb_trx r
                INNER JOIN information_schema.innodb_lock_waits w ON r.trx_id = w.requesting_trx_id
                INNER JOIN information_schema.innodb_trx b ON w.blocking_trx_id = b.trx_id
                LEFT JOIN information_schema.processlist pl_waiting ON r.trx_mysql_thread_id = pl_waiting.ID
                LEFT JOIN information_schema.processlist pl_blocking ON b.trx_mysql_thread_id = pl_blocking.ID
                ORDER BY waiting_sec DESC
            """)
        with engine.connect() as conn:
            rows = conn.execute(q).fetchall()
    except Exception as e:
        if "1142" in str(e) or "SELECT command denied" in str(e) or "PROCESS" in str(e):
            lines.append("[锁诊断] 当前用户无 performance_schema/processlist 权限，无法列出阻塞关系。")
            lines.append("  建议: GRANT SELECT ON performance_schema.* TO 'role'@'%'; GRANT PROCESS ON *.* TO 'role'@'%';")
        else:
            lines.append(f"[锁诊断] 查询锁等待失败: {e}")
        rows = []

    if rows:
        lines.append("[锁诊断] 当前锁等待/阻塞关系（谁在等、谁在占）:")
        for i, row in enumerate(rows, 1):
            r = row._mapping if hasattr(row, "_mapping") else row
            lines.append(f"  --- 关系 #{i} ---")
            lines.append(f"  等待线程: {r.get('waiting_thread')} (用户: {r.get('waiting_user')}), 已等: {r.get('waiting_sec')} 秒")
            lines.append(f"  等待中的 SQL: {_format_query(r.get('waiting_query'), 300)}")
            lines.append(f"  阻塞线程: {r.get('blocking_thread')} (用户: {r.get('blocking_user')}@{r.get('blocking_host')}), 已持锁: {r.get('blocking_sec')} 秒")
            lines.append(f"  阻塞方当前 SQL: {_format_query(r.get('blocking_query'), 300)}")
        lines.append("")
    elif not lines:
        lines.append("[锁诊断] 未查到锁等待记录（可能超时后阻塞方已结束，或权限不足）。")

    # 2) 长时间运行的事务/查询（可能与 activity_summary 相关）
    try:
        q2 = text("""
            SELECT ID AS thread_id, USER, HOST, DB, COMMAND, TIME AS run_sec, STATE, INFO AS query_text
            FROM information_schema.processlist
            WHERE DB = DATABASE() AND TIME >= 5 AND COMMAND NOT IN ('Sleep', 'Daemon')
            ORDER BY TIME DESC
            LIMIT 10
        """)
        with engine.connect() as conn:
            long_rows = conn.execute(q2).fetchall()
    except Exception as e2:
        if "1227" in str(e2) or "PROCESS" in str(e2):
            lines.append("[锁诊断] 无 PROCESS 权限，无法列出长时间查询。")
        else:
            lines.append(f"[锁诊断] 查询长时间进程失败: {e2}")
        long_rows = []

    if long_rows:
        lines.append("[锁诊断] 当前长时间运行查询（>=5 秒）:")
        for row in long_rows:
            r = row._mapping if hasattr(row, "_mapping") else row
            lines.append(f"  线程 {r.get('thread_id')} | 用户 {r.get('USER')}@{r.get('HOST')} | 运行 {r.get('run_sec')} 秒 | {r.get('STATE')}")
            lines.append(f"    SQL: {_format_query(r.get('query_text'), 400)}")
        lines.append("")

    # 3) MySQL 8 可选的 data_locks 表（涉及的表/索引）
    if is_mysql8 and not any("权限" in ln or "无 " in ln for ln in lines):
        try:
            q3 = text("""
                SELECT l.OBJECT_SCHEMA, l.OBJECT_NAME, l.INDEX_NAME, l.LOCK_TYPE, l.LOCK_MODE,
                       l.ENGINE_TRANSACTION_ID, p.USER, p.HOST, p.TIME AS run_sec, LEFT(p.INFO, 500) AS query_info
                FROM performance_schema.data_locks l
                LEFT JOIN information_schema.innodb_trx t ON t.trx_id = l.ENGINE_TRANSACTION_ID
                LEFT JOIN information_schema.processlist p ON p.ID = t.trx_mysql_thread_id
                WHERE l.OBJECT_NAME IS NOT NULL
                ORDER BY l.ENGINE_TRANSACTION_ID, l.OBJECT_NAME
                LIMIT 30
            """)
            with engine.connect() as conn:
                lock_rows = conn.execute(q3).fetchall()
        except Exception as e3:
            lock_rows = []
        if lock_rows:
            lines.append("[锁诊断] 当前持有锁的对象（data_locks）:")
            for row in lock_rows:
                r = row._mapping if hasattr(row, "_mapping") else row
                lines.append(f"  表 {r.get('OBJECT_SCHEMA')}.{r.get('OBJECT_NAME')} | 索引 {r.get('INDEX_NAME')} | {r.get('LOCK_TYPE')} {r.get('LOCK_MODE')} | 事务 {r.get('ENGINE_TRANSACTION_ID')} | 用户 {r.get('USER')} 运行 {r.get('run_sec')} 秒")
                if r.get("query_info"):
                    lines.append(f"    SQL: {_format_query(r.get('query_info'), 350)}")
            lines.append("")

    return "\n".join(lines)


def log_lock_diagnostics(engine, context=""):
    """在发生 1205/1213 时调用，将锁诊断写入日志，便于排查是谁锁住了哪些对象。"""
    try:
        msg = get_lock_diagnostics(engine)
        logger.warning("[锁诊断] %s\n%s", context or "锁等待/死锁", msg)
    except Exception as e:
        logger.warning("[锁诊断] 执行诊断失败: %s", e)


def retry_on_deadlock(max_retries=3, initial_wait=0.1):
    """
    MySQL 死锁/超时重试装饰器
    
    支持自动检测参数中的 SQLAlchemy Session 并执行 rollback()。
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            retries = 0
            while retries <= max_retries:
                try:
                    return func(*args, **kwargs)
                except OperationalError as e:
                    # 1213: Deadlock found, 1205: Lock wait timeout exceeded
                    if e.orig and e.orig.args and e.orig.args[0] in (1213, 1205):
                        # 用独立连接输出锁诊断，便于排查“谁锁住了哪些”
                        db = kwargs.get('db')
                        if not db:
                            for arg in args:
                                if isinstance(arg, Session):
                                    db = arg
                                    break
                        if db:
                            try:
                                engine = db.get_bind()
                                log_lock_diagnostics(engine, f"retry_on_deadlock 检测到 Error {e.orig.args[0]}，即将重试")
                            except Exception:
                                pass
                        retries += 1
                        if retries > max_retries:
                            logger.error(f"达到最大重试次数 ({max_retries})，操作失败: {str(e)}")
                            raise
                        
                        # 尝试回滚事务
                        if db:
                            try:
                                db.rollback()
                                logger.info("检测到死锁，已回滚当前事务以准备重试")
                            except Exception as rb_err:
                                logger.error(f"回滚事务失败: {rb_err}")

                        wait_time = initial_wait * (2 ** (retries - 1)) + random.random() * 0.1
                        logger.warning(f"检测到数据库死锁/超时 (Error {e.orig.args[0]})，正在进行第 {retries} 次重试，等待 {wait_time:.2f}s...")
                        time.sleep(wait_time)
                    else:
                        raise
                except Exception as e:
                    raise
        return wrapper
    return decorator
