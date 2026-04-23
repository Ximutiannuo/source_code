#!/usr/bin/env python3
"""
MySQL 慢查询日志分析脚本

用于在假死/卡顿发生后，从慢查询日志中定位导致问题的 SQL。
MySQL 需已启用慢查询日志：slow_query_log=ON, long_query_time=2（或更低）

用法：
  # 分析指定时间段的慢查询（如假死发生时段 22:55-22:58）
  python analyze_slow_query_log.py --log /path/to/mysql-slow.log --since "2026-02-23 22:55" --until "2026-02-23 22:58"

  # 若慢查询在 MySQL 服务器上，可先拷贝再分析：
  scp user@10.78.44.17:/home/mysql/mysql-slow.log ./mysql-slow.log
  python analyze_slow_query_log.py --log mysql-slow.log --since "2026-02-23 22:55" --until "2026-02-23 22:58"

  # 直接在 MySQL 服务器上执行（解析最近 100 条）：
  python analyze_slow_query_log.py --log /home/mysql/mysql-slow.log -n 100

  # 仅统计，不打印完整 SQL
  python analyze_slow_query_log.py --log mysql-slow.log --since "2026-02-23 22:55" --summary-only
"""
import argparse
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple

# 默认慢查询日志路径（MySQL 服务器上常见位置）
DEFAULT_SLOW_LOG = "/home/mysql/mysql-slow.log"


def parse_slow_log_entries(content: str) -> List[dict]:
    """
    解析 MySQL 慢查询日志，返回条目列表。
    每一条目包含：time, query_time, lock_time, rows_sent, rows_examined, sql, user_host
    """
    entries = []
    current = None
    # Time 行格式: # Time: 2026-02-23T19:55:00.123456Z 或 2026-02-23T19:55:00.123456
    time_re = re.compile(r"# Time: (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?)")
    query_re = re.compile(r"# Query_time: ([\d.]+)\s+Lock_time: ([\d.]+)\s+Rows_sent: (\d+)\s+Rows_examined: (\d+)")
    user_re = re.compile(r"# User@Host: (.+)")

    lines = content.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        # 新条目通常以 # Time: 开始
        m = time_re.search(line)
        if m:
            if current and current.get("sql"):
                entries.append(current)
            ts_str = m.group(1)
            try:
                if "." in ts_str:
                    dt = datetime.strptime(ts_str[:19], "%Y-%m-%dT%H:%M:%S")
                else:
                    dt = datetime.strptime(ts_str, "%Y-%m-%dT%H:%M:%S")
            except ValueError:
                dt = None
            current = {"time": dt, "time_raw": ts_str, "query_time": 0, "lock_time": 0, "rows_sent": 0, "rows_examined": 0, "sql": "", "user_host": ""}
            i += 1
            continue

        if current is not None:
            qm = query_re.search(line)
            if qm:
                current["query_time"] = float(qm.group(1))
                current["lock_time"] = float(qm.group(2))
                current["rows_sent"] = int(qm.group(3))
                current["rows_examined"] = int(qm.group(4))
            um = user_re.search(line)
            if um:
                current["user_host"] = um.group(1).strip()

            # SQL 在 # User@Host 或 # Query_time 之后，直到下一个 # Time 或空块
            if line.strip() and not line.startswith("#") and not line.startswith("use ") and not line.startswith("SET "):
                sql_lines = []
                while i < len(lines) and lines[i].strip() and (not lines[i].strip().startswith("#") or "Time:" not in lines[i]):
                    sql_lines.append(lines[i])
                    i += 1
                current["sql"] = "\n".join(sql_lines).strip()
                if current["sql"]:
                    entries.append(current)
                    current = None
                continue
        i += 1

    if current and current.get("sql"):
        entries.append(current)
    return entries


def filter_by_time(entries: List[dict], since: Optional[datetime], until: Optional[datetime]) -> List[dict]:
    out = []
    for e in entries:
        t = e.get("time")
        if t is None:
            out.append(e)
            continue
        if since and t < since:
            continue
        if until and t > until:
            continue
        out.append(e)
    return out


def main():
    ap = argparse.ArgumentParser(description="分析 MySQL 慢查询日志，定位假死时段的慢 SQL")
    ap.add_argument("--log", "-l", default=DEFAULT_SLOW_LOG, help=f"慢查询日志路径，默认 {DEFAULT_SLOW_LOG}")
    ap.add_argument("--since", "-s", help="起始时间，如 '2026-02-23 22:55'")
    ap.add_argument("--until", "-u", help="结束时间，如 '2026-02-23 22:58'")
    ap.add_argument("-n", type=int, default=0, help="最多输出条目数，0 表示全部")
    ap.add_argument("--summary-only", action="store_true", help="仅输出汇总统计，不打印完整 SQL")
    args = ap.parse_args()

    log_path = Path(args.log)
    if not log_path.exists():
        print(f"错误: 日志文件不存在: {log_path}", file=sys.stderr)
        print("提示: 若慢查询在 MySQL 服务器上，可先拷贝：", file=sys.stderr)
        print("  scp user@<mysql_host>:/home/mysql/mysql-slow.log ./mysql-slow.log", file=sys.stderr)
        sys.exit(1)

    content = log_path.read_text(encoding="utf-8", errors="replace")
    entries = parse_slow_log_entries(content)

    since_dt = None
    until_dt = None
    if args.since:
        try:
            since_dt = datetime.strptime(args.since.strip(), "%Y-%m-%d %H:%M")
        except ValueError:
            print(f"错误: --since 格式应为 'YYYY-MM-DD HH:MM'，例如 '2026-02-23 22:55'", file=sys.stderr)
            sys.exit(1)
    if args.until:
        try:
            until_dt = datetime.strptime(args.until.strip(), "%Y-%m-%d %H:%M")
        except ValueError:
            print(f"错误: --until 格式应为 'YYYY-MM-DD HH:MM'", file=sys.stderr)
            sys.exit(1)

    if since_dt or until_dt:
        entries = filter_by_time(entries, since_dt, until_dt)

    # 按 Query_time 降序
    entries.sort(key=lambda e: e.get("query_time", 0), reverse=True)

    if args.n > 0:
        entries = entries[: args.n]

    print(f"共找到 {len(entries)} 条慢查询" + (f"（时间范围: {args.since} ~ {args.until}）" if args.since or args.until else ""))
    print("=" * 80)

    if args.summary_only:
        # 汇总：按 SQL 前 80 字符分组统计
        from collections import defaultdict
        groups = defaultdict(lambda: {"count": 0, "total_time": 0, "max_time": 0})
        for e in entries:
            k = (e.get("sql") or "")[:120].replace("\n", " ").strip() or "(empty)"
            groups[k]["count"] += 1
            groups[k]["total_time"] += e.get("query_time", 0)
            groups[k]["max_time"] = max(groups[k]["max_time"], e.get("query_time", 0))
        for k, v in sorted(groups.items(), key=lambda x: -x[1]["total_time"])[:20]:
            print(f"出现 {v['count']} 次, 总耗时 {v['total_time']:.2f}s, 最大 {v['max_time']:.2f}s")
            print(f"  {k}...")
            print()
        return

    for i, e in enumerate(entries, 1):
        print(f"\n--- 慢查询 #{i} ---")
        print(f"时间: {e.get('time_raw', e.get('time', 'N/A'))}")
        print(f"Query_time: {e.get('query_time', 0):.3f}s  Lock_time: {e.get('lock_time', 0):.3f}s")
        print(f"Rows_sent: {e.get('rows_sent', 0)}  Rows_examined: {e.get('rows_examined', 0)}")
        if e.get("user_host"):
            print(f"User@Host: {e['user_host']}")
        sql = (e.get("sql") or "").strip()
        if sql:
            # 限制单条 SQL 显示长度
            if len(sql) > 2000:
                print(f"SQL (前 2000 字符):\n{sql[:2000]}\n...(truncated)")
            else:
                print(f"SQL:\n{sql}")
        print()


if __name__ == "__main__":
    main()
