#!/usr/bin/env python
"""
HMD 与评分系统高并发压力测试。

模拟 ~300 活跃用户并发访问 HMD 相关 API，验证性能。

用法：
  export BASE_URL=http://localhost:8000
  export TEST_USERNAME=your_user
  export TEST_PASSWORD=your_password
  python backend/scripts/hmd_load_test.py

  或指定并发数和持续时间：
  python backend/scripts/hmd_load_test.py --workers 300 --duration 60
"""
import argparse
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from threading import Lock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 加载 .env（与 backend 一致）
try:
    from dotenv import load_dotenv
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
    load_dotenv(env_path)
except ImportError:
    pass

try:
    import requests
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
except ImportError:
    print("请安装 requests: pip install requests")
    sys.exit(1)


@dataclass
class Stats:
    total: int = 0
    success: int = 0
    failed: int = 0
    latencies_ms: list = field(default_factory=list)
    _lock: Lock = field(default_factory=Lock, repr=False)

    def record(self, ok: bool, latency_ms: float):
        with self._lock:
            self.total += 1
            if ok:
                self.success += 1
            else:
                self.failed += 1
            self.latencies_ms.append(latency_ms)

    def report(self) -> dict:
        with self._lock:
            arr = sorted(self.latencies_ms)
            n = len(arr)
            if n == 0:
                return {"total": 0, "success": 0, "failed": 0, "avg_ms": 0, "p95_ms": 0, "p99_ms": 0}
            avg = sum(arr) / n
            p95 = arr[int(n * 0.95)] if n > 0 else 0
            p99 = arr[int(n * 0.99)] if n > 0 else 0
            return {
                "total": self.total,
                "success": self.success,
                "failed": self.failed,
                "avg_ms": round(avg, 2),
                "p95_ms": round(p95, 2),
                "p99_ms": round(p99, 2),
            }


def login(base_url: str, username: str, password: str, verify_ssl: bool = True) -> str | None:
    """登录并返回 access_token"""
    url = f"{base_url.rstrip('/')}/api/auth/login"
    try:
        r = requests.post(
            url,
            data={"username": username, "password": password},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10,
            verify=verify_ssl,
        )
        if r.status_code == 200:
            return r.json().get("access_token")
        print(f"  登录响应: {r.status_code} - {r.text[:200]}")
    except Exception as e:
        print(f"  登录异常: {e}")
    return None


def run_request(
    base_url: str,
    token: str,
    method: str,
    path: str,
    params: dict | None = None,
    json_body: dict | None = None,
    stats: Stats | None = None,
    verify_ssl: bool = True,
) -> bool:
    url = f"{base_url.rstrip('/')}{path}"
    headers = {"Authorization": f"Bearer {token}"}
    start = time.perf_counter()
    ok = False
    try:
        kw = {"headers": headers, "timeout": 30, "verify": verify_ssl}
        if method == "GET":
            r = requests.get(url, params=params, **kw)
        elif method == "PUT":
            r = requests.put(url, json=json_body or {}, **kw)
        elif method == "POST":
            r = requests.post(url, json=json_body or {}, **kw)
        else:
            return False
        ok = 200 <= r.status_code < 400
    except Exception:
        ok = False
    elapsed_ms = (time.perf_counter() - start) * 1000
    if stats:
        stats.record(ok, elapsed_ms)
    return ok


def worker(
    worker_id: int,
    base_url: str,
    token: str,
    duration_sec: float,
    stats_by_endpoint: dict,
    verify_ssl: bool = True,
) -> None:
    """单个 worker：持续请求 HMD 相关接口"""
    endpoints = [
        ("GET", "/api/ahead-plan/my-issues", None, None),
        ("GET", "/api/ahead-plan/feedback-marquee", {"limit": 20}, None),
        ("GET", "/api/ahead-plan/my-feedback", None, None),
        ("GET", "/api/ahead-plan/responsible-summary", None, None),
        ("GET", "/api/ahead-plan/issues", {
            "activity_id": "EC2CT2210004PI01012",
            "type_of_plan": "月滚动计划_2026-01-30~2026-02-26",
        }, None),
    ]
    end_time = time.time() + duration_sec
    idx = 0
    while time.time() < end_time:
        method, path, params, body = endpoints[idx % len(endpoints)]
        key = f"{method} {path}"
        if key not in stats_by_endpoint:
            stats_by_endpoint[key] = Stats()
        run_request(base_url, token, method, path, params, body, stats_by_endpoint[key], verify_ssl)
        idx += 1


def main():
    parser = argparse.ArgumentParser(description="HMD 高并发压力测试")
    parser.add_argument("--workers", type=int, default=300, help="并发 worker 数（模拟活跃用户）")
    parser.add_argument("--duration", type=int, default=30, help="压测持续时间（秒）")
    parser.add_argument("--base-url", type=str, default=os.getenv("BASE_URL", "http://localhost:8000"))
    parser.add_argument("--username", type=str, default=os.getenv("TEST_USERNAME"))
    parser.add_argument("--password", type=str, default=os.getenv("TEST_PASSWORD"))
    parser.add_argument("--no-verify-ssl", action="store_true", help="HTTPS 自签名证书时跳过校验")
    args = parser.parse_args()

    verify_ssl = not args.no_verify_ssl

    if not args.username or not args.password:
        print("请设置 TEST_USERNAME 和 TEST_PASSWORD 环境变量，或通过 --username/--password 指定")
        sys.exit(1)

    print(f"登录 {args.base_url} 用户 {args.username}...")
    token = login(args.base_url, args.username, args.password, verify_ssl)
    if not token:
        print("登录失败，请检查 BASE_URL、用户名和密码")
        sys.exit(1)
    print("登录成功")

    stats_by_endpoint: dict[str, Stats] = {}
    print(f"启动 {args.workers} 个 worker，持续 {args.duration} 秒...")
    start = time.perf_counter()
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = [
            ex.submit(worker, i, args.base_url, token, args.duration, stats_by_endpoint, verify_ssl)
            for i in range(args.workers)
        ]
        for f in as_completed(futures):
            try:
                f.result()
            except Exception as e:
                print(f"Worker 异常: {e}")
    elapsed = time.perf_counter() - start
    print(f"\n压测结束，总耗时 {elapsed:.1f}s\n")

    print("=" * 70)
    print("各接口统计")
    print("=" * 70)
    total_requests = 0
    total_success = 0
    for key, s in sorted(stats_by_endpoint.items(), key=lambda x: -x[1].total):
        r = s.report()
        total_requests += r["total"]
        total_success += r["success"]
        status = "OK" if r["failed"] == 0 else "有失败"
        print(f"{key}")
        print(f"  请求数: {r['total']}  成功: {r['success']}  失败: {r['failed']}  [{status}]")
        print(f"  延迟(ms): avg={r['avg_ms']}  p95={r['p95_ms']}  p99={r['p99_ms']}")
        print()
    print("=" * 70)
    print(f"总计: 请求 {total_requests} 次，成功 {total_success} 次，RPS ≈ {total_requests / elapsed:.0f}")
    print("=" * 70)


if __name__ == "__main__":
    main()
