# HMD 相关 API 性能优化建议

## 零、评分刷新机制说明

### 延迟展示（已实现）

- 提出人确认评分（关闭问题）时，会写入 `issue_rating`，并设置 `visible_after = 关闭时间 + 随机(6~24) 小时`
- 所有 HMD 相关接口（feedback-marquee、feedback-rankings、responsible-summary、问题列表中的评分等）均按条件过滤：`visible_after IS NULL OR visible_after <= NOW()`
- 即：责任人需在 6~24 小时后才能看到该条评分，实现「延迟展示」以降低即时情绪反馈

### 批量展示（每 5 条一批，已实现）

- 为避免单条评分刷新时暴露「哪一题被差评」，HMD 展示仅按 **每 5 条一批** 刷新
- 规则：对每个责任人，按 `visible_after` 排序，仅计入前 `floor(N/5)*5` 条；满 5 条才释放一批
- 实现：`_get_released_rating_ids_for_hmd(db)` 返回可展示的 `issue_rating.id` 集合，feedback-rankings、feedback-marquee、responsible-summary 均基于该集合过滤

### 批量确认（写入）

- `POST /ahead-plan/issues/batch-confirm` 支持一次性提交多条问题的评分并结案

### 前端刷新

- 我的反馈汇总（HMD）：Modal 打开时拉取一次，无轮询；切换「整体/同部门」时重新请求
- 问题列表：AheadPlanIssueModal 内每 5 秒轮询，以在责任人关闭后提出方尽快看到可评价状态
- 首页协作好评弹幕/排名：随 Dashboard 首次加载，无独立轮询

---

## 一、问题诊断：N+1 查询

`_issue_to_response(db, row, current_user)` 被 `list_my_issues`、`list_ahead_plan_issues`、`issues` 等接口在**循环中调用**，每次调用内部执行多轮 DB 查询：

| 调用点 | 每行查询数 | 说明 |
|--------|-----------|------|
| `_user_display_name(db, row.raised_by)` | 1 | 提出人姓名 |
| `_user_display_name(db, row.resolved_by)` | 1 | 解决人姓名 |
| `_user_display_name(db, row.responsible_user_id)` | 1 | 责任人姓名 |
| `_user_display_name(db, row.confirmed_by)` | 1 | 确认人姓名 |
| `AheadPlanIssueReply` 查 solution | 1 | 解决方案内容 |
| `User` + `Department` 查 raising_dept_code | 2 | 提出人部门 |
| `IssueRating` 查评分 | 1 | 评分数据 |
| **合计** | **约 8 次/行** | - |

若返回 50 条问题，单次请求约 **400 次** DB 查询，是主要性能瓶颈。

---

## 二、优化方案

### 1. 批量预取 + 改造 `_issue_to_response`（优先级最高）

在调用 `_issue_to_response` 前，先批量查询并传入缓存，避免循环内再查 DB：

1. **用户姓名**：收集所有 `raised_by`、`resolved_by`、`responsible_user_id`、`confirmed_by`，一次 `User.id.in_(...)` 查完，得到 `user_names: dict[int, str]`
2. **解决方案**：收集所有 `issue_id`，一次 `AheadPlanIssueReply` 查询 `reply_type='solution'`，按 `issue_id` 建字典
3. **提出人部门**：从上述 User 结果中取出 `department_id`，再批量查 Department
4. **评分**：收集所有 `issue_id`，一次 `IssueRating` 查询，按 `issue_id` 建字典

新增 `_issues_to_responses_batch(db, rows, current_user, user_names, solutions, raising_dept, ratings)`，或给 `_issue_to_response` 增加可选参数传入这些缓存。

### 2. 涉及接口

- `list_my_issues`：先查 issues，再批量预取，最后一次性构建响应
- `list_ahead_plan_issues`：同上
- `list_issues_by_group`（按组展开）：同上
- `list_my_mentioned_issues`：同上

### 3. 索引检查

建议确认并补齐索引（如缺失则创建）：

```sql
-- issue_rating
CREATE INDEX idx_issue_rating_issue_id ON issue_rating(issue_id);
CREATE INDEX idx_issue_rating_confirmed_at ON issue_rating(confirmed_at DESC);

-- ahead_plan_issue_reply
CREATE INDEX idx_issue_reply_issue_type ON ahead_plan_issue_reply(issue_id, reply_type);

-- ahead_plan_issue
-- 已有 idx_ahead_plan_issue_activity_type
-- 已有 idx_ahead_plan_issue_responsible
```

### 4. feedback-marquee 优化（可选）

当前实现已较简洁（JOIN + 一次批量 user_names），若仍偏慢，可考虑：

- 对首页弹幕做 Redis / 内存缓存，TTL 约 5 分钟
- 仅展示近期数据，限制 `confirmed_at` 范围

### 5. responsible-summary 优化（可选）

当前为单次聚合查询，本身结构合理。如数据量变大，可加索引：

```sql
CREATE INDEX idx_issue_rating_visible_after ON issue_rating(visible_after);
```

---

## 三、预期效果

| 优化项 | 当前（估算） | 优化后（估算） |
|--------|-------------|----------------|
| 单次 list_my_issues（50 条） | ~400 次查询 | ~5–8 次查询 |
| 平均延迟 | ~2s | ~200–500ms |
| P95 延迟 | ~6s | ~1s 内 |

---

## 四、实施顺序建议

1. **第一步**：改造 `_issue_to_response` 支持批量预取（或新增 batch 版本），并让 `list_my_issues`、`list_ahead_plan_issues` 使用
2. **第二步**：检查并添加必要索引
3. **第三步**：对 `feedback-marquee` 做缓存（可选）

---

## 五、快速验证

优化后可用压测脚本复测：

```bash
python backend/scripts/hmd_load_test.py --no-verify-ssl
```

关注 `my-issues` 和 `issues` 的 avg/p95/p99 是否显著下降。
