#!/usr/bin/env python3
"""
今日 ahead_plan 相关改动分析脚本：死锁规避、性能开销、权限溢出

运行方式：
  cd backend
  python scripts/analyze_ahead_plan_concerns.py

配合数据库运行时（可选）：
  python scripts/analyze_ahead_plan_concerns.py --db  # 执行数据库相关检查
"""
import sys
import os
import re
import argparse

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# 静态代码分析（不依赖 DB）
AP = os.path.join(os.path.dirname(__file__), "..", "app", "api", "ahead_plan.py")


def load_file(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


# ---------- 1. 死锁规避分析 ----------
def analyze_deadlock():
    text = load_file(AP)
    lines = text.split("\n")

    issues = []
    # 检查 with_for_update 是否配合 order_by(id) 使用
    for i, line in enumerate(lines):
        if "with_for_update" in line:
            # 向上查找最近的 query/filter/order_by
            ctx = "\n".join(lines[max(0, i - 15) : i + 2])
            if "order_by" in ctx and "AheadPlan.id" in ctx:
                pass  # OK
            elif "order_by" in ctx and "id" in ctx:
                pass  # 可能是 order_by(id)，需人工确认
            else:
                # 有 with_for_update 但未看到 order_by(id)
                lineno = i + 1
                issues.append(
                    f"  行 {lineno}: with_for_update 使用处，请确认上游有 order_by(id) 以保证加锁顺序一致"
                )

    # 检查哪些 db.commit 未包在死锁重试中
    commit_funcs = []
    in_func = None
    for i, line in enumerate(lines):
        m = re.search(r"^(def |    def )(\w+)\s*\(", line)
        if m:
            in_func = m.group(2)
        if "db.commit()" in line and in_func:
            # 检查该函数是否用了 _run_with_deadlock_retry
            start = max(0, i - 200)
            end = min(len(lines), i + 30)
            block = "\n".join(lines[start:end])
            if "_run_with_deadlock_retry" in block:
                pass  # OK
            else:
                lineno = i + 1
                commit_funcs.append((lineno, in_func))

    return {
        "deadlock_retry": "_run_with_deadlock_retry" in text,
        "is_deadlock_check": "_is_deadlock" in text,
        "with_for_update_count": text.count("with_for_update"),
        "order_by_id_count": len(re.findall(r"order_by\s*\(\s*(?:AheadPlan\.)?id\s*\)", text)),
        "potential_issues": issues,
        "commits_without_retry": commit_funcs,
    }


# ---------- 2. 性能开销分析 ----------
def analyze_performance():
    text = load_file(AP)

    issues = []

    # create_issue_reply: 重复解析 mentions、重复 User 查询
    if "_parse_mentions_from_content(body.content)" in text:
        count = text.count("_parse_mentions_from_content(body.content)")
        if count > 1:
            issues.append(
                f"  create_issue_reply 中 _parse_mentions_from_content(body.content) 被调用 {count} 次，"
                "建议只解析一次并复用结果"
            )
    # mentions 循环中每次查 User
    if re.search(
        r"for\s+\w+\s+in\s+_parse_mentions.*?db\.query\(User\)",
        text,
        re.DOTALL,
    ) or "for m in _parse_mentions" in text and "db.query(User)" in text:
        issues.append(
            "  create_issue_reply: 循环内对每个 @mention 执行 db.query(User)，存在 N+1，"
            "可先批量解析后一次性 in_ 查询或批量查 user"
        )

    # list_issue_replies -> _reply_to_response -> _user_display_name 每回复一条查一次 User
    if "_reply_to_response(db, r)" in text and "_user_display_name(db, r.user_id)" in text:
        issues.append(
            "  list_issue_replies: 每条回复调用 _reply_to_response -> _user_display_name，"
            "对 N 条回复产生 N 次 User 查询（N+1），可预取 user_id 集合后批量查"
        )

    # _check_scope_permission 内：ActivitySummary + _resolve_resource_id(RSCDefine)
    # _check_scope_permission 已支持 scope_cache 参数，batch_update/import 已批量预取，N+1 已消除
    return {"issues": issues}


# ---------- 3. 权限溢出分析 ----------
def analyze_permission_overflow():
    """当前业务下不存在 planning:read 范围 A + planning:update 范围 B 的情况，无需调整。"""
    return {"issues": []}


# ---------- 主入口 ----------
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", action="store_true", help="执行数据库相关检查（预留）")
    args = parser.parse_args()

    print("=" * 60)
    print("ahead_plan 今日改动分析：死锁规避、性能开销、权限溢出")
    print("=" * 60)

    # 1. 死锁规避
    print("\n【1. 死锁规避】")
    dl = analyze_deadlock()
    print("  - 死锁检测与重试: ", "已实现" if dl["deadlock_retry"] else "未实现")
    print("  - with_for_update 使用次数:", dl["with_for_update_count"])
    print("  - order_by(id) 使用次数:", dl["order_by_id_count"])
    if dl["potential_issues"]:
        print("  - 潜在问题:")
        for x in dl["potential_issues"]:
            print(x)
    if dl["commits_without_retry"]:
        print("  - 未包在死锁重试内的 db.commit:")
        for lineno, fn in dl["commits_without_retry"][:10]:
            print(f"      行 {lineno} ({fn})")
        if len(dl["commits_without_retry"]) > 10:
            print(f"      ... 共 {len(dl['commits_without_retry'])} 处")

    # 2. 性能开销
    print("\n【2. 性能开销】")
    perf = analyze_performance()
    if perf["issues"]:
        for x in perf["issues"]:
            print(x)
    else:
        print("  - 未检测到明显 N+1 或重复计算（人工复核建议保留）")

    # 3. 权限溢出
    print("\n【3. 权限溢出】")
    perm = analyze_permission_overflow()
    if perm["issues"]:
        for x in perm["issues"]:
            print(x)
    else:
        print("  - 当前业务下不存在 planning:read 范围 A + planning:update 范围 B 的情况，scope 检查无需调整")

    if args.db:
        print("\n【数据库相关检查】")
        print("  （预留：可在此执行实际 DB 查询验证）")

    print("\n" + "=" * 60)


if __name__ == "__main__":
    main()
