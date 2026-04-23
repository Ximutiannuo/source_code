# ahead_plan 今日改动分析：死锁规避、性能开销、权限溢出

## 1. 死锁规避

### 现有机制

- **死锁检测**：`_is_deadlock(exc)` 识别 MySQL 错误码 1213
- **重试封装**：`_run_with_deadlock_retry(fn, max_retries=3)` 遇死锁自动重试
- **加锁顺序**：批量操作使用 `order_by(AheadPlan.id).with_for_update()` 保证按 id 升序加锁

### 已应用死锁重试的接口

- `batch_review_approve`（批量审核/批准）
- `batch_update_ahead_plan`（批量更新）
- `batch_delete_ahead_plan`（批量删除）

### 潜在问题

| 位置 | 说明 | 建议 |
|------|------|------|
| `create_issue_reply` | 直接 `db.commit()`，未包在 `_run_with_deadlock_retry` 内 | 若该表与 AheadPlan 等有锁竞争，可考虑加上重试 |
| `create_issue` / `update_issue` / `delete_issue` | 同样直接 commit | 同左 |
| 单条 `update_ahead_plan` / `delete_ahead_plan` | 单行更新，死锁概率较低 | 通常可接受 |

### 验证方式

```bash
cd backend
python scripts/analyze_ahead_plan_concerns.py
```

---

## 2. 性能开销

### create_issue_reply 中的问题

1. **重复解析**：`_parse_mentions_from_content(body.content)` 被调用 2 次（一次用于收集 notify_user_ids，一次用于计算 mentioned_users）
2. **N+1 查询**：每个 @mention 单独执行 `db.query(User).filter(User.username == m)` 和 `db.query(User).filter(User.full_name == m)`

### list_issue_replies 中的问题

- 每条回复调用 `_reply_to_response` → `_user_display_name(db, r.user_id)`，对 N 条回复产生 N 次 User 查询（N+1）

### _check_scope_permission 中的问题（已优化）

- 原问题：每次调用 1) 查 ActivitySummary 2) 查 RSCDefine，在 batch 循环内产生 2N 次额外查询
- 已实现 `_batch_fetch_scope_for_activities` + `scope_cache` 参数，将 2N 次降为 2 次（ActivitySummary 批量 + RSCDefine 批量）
- 已应用于：`batch_update_ahead_plan`、`_process_import_records`、`import_ahead_plan_batch`

### 其它优化建议

| 问题 | 建议 |
|------|------|
| 重复解析 mentions | 只调用一次 `mentions = _parse_mentions_from_content(body.content)`，复用 |
| @mention 的 User 查询 | 对 mentions 去重后，`db.query(User).filter(or_(User.username.in_(names), User.full_name.in_(names)))` 一次性查询 |
| list_issue_replies 的 user 名称 | 先收集 `user_ids`，`users = db.query(User).filter(User.id.in_(user_ids)).all()`，构建 `{id: name}` 再填充 |
| batch 内的 _check_scope_permission | 预取 `activity_id -> scope` 映射，或在批量操作前先过滤 allowed activity_ids，循环内不再逐行检查 |

---

## 3. 权限溢出

当前业务下不存在「用户同时拥有 planning:read 范围 A 与 planning:update 范围 B」的情况，无需调整 scope 校验逻辑。

---

## 分析脚本使用

```bash
cd backend
python scripts/analyze_ahead_plan_concerns.py
python scripts/analyze_ahead_plan_concerns.py --db  # 预留：数据库相关检查
```

脚本会输出上述三类的静态分析结果，便于快速定位问题。
