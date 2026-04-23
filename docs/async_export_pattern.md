# 大规模数据异步导出模式 (Async Export Pattern)

## 1. 核心问题
在处理海量数据（如 10 万行以上）的导出任务时，传统的同步模式（Request -> Processing -> Response）存在两个致命缺陷：
1.  **504 Gateway Timeout**：网关（如 Nginx）通常有 60 秒超时限制。生成大型 Excel 可能需要数分钟，导致连接被强制切断。
2.  **OOM (内存溢出)**：一次性加载几十万行数据到内存并构建 Excel 对象树会消耗数 GB 内存，极易导致服务器崩溃。

## 2. 解决方案：异步 + 轮询 (Async & Polling)
该模式将长耗时任务拆分为“提交”、“查询”、“下载”三个阶段，实现“先领号，后排队，好了叫我”的机制。

### 架构图示
1.  **前端**：`POST /export` (带筛选条件) -> 获取 `task_id`。
2.  **后端**：立即返回 `task_id`，同时在 `BackgroundTasks` 中启动导出线程。
3.  **前端**：定时（如每 3s）请求 `GET /status/{task_id}`，获取 `status` 和 `progress`。
4.  **后端**：导出完成后，将文件存入物理临时目录，并将任务状态更新为 `completed`。
5.  **前端**：检测到 `completed`，调用 `GET /download/{task_id}` 获取文件流并触发浏览器下载。

## 3. 实现细节

### A. 后端性能优化 (Python/FastAPI)
1.  **流式数据库查询**：
    *   使用 `execution_options(stream_results=True)`。
    *   使用 `.yield_per(batch_size)`。
    *   *作用*：确保 Python 进程内存中永远只保留几千行数据，而不是几十万行。
2.  **Excel 写保护模式**：
    *   使用 `openpyxl.Workbook(write_only=True)`。
    *   *作用*：数据像流一样直接写入磁盘，不构建复杂的内存对象模型。
3.  **精简列查询**：
    *   使用 `.with_entities(Model.col1, Model.col2)` 或 `JOIN` 优化。
    *   *作用*：减少不必要的字段传输。

### B. 前端处理逻辑 (React/TypeScript)
1.  **轮询管理**：
    *   使用 `setInterval` 或递归 `setTimeout`。
    *   **必须**在组件卸载（`useEffect` cleanup）时清除定时器，防止内存泄漏。
2.  **文件下载**：
    *   使用 `axios` 设置 `responseType: 'blob'`。
    *   通过 `window.URL.createObjectURL` 创建临时下载链接并模拟点击。

## 4. 示例代码结构

### 后端 (API)
```python
@router.post("/export")
def start_export(request: FilterRequest, background_tasks: BackgroundTasks):
    task_id = str(uuid.uuid4())
    background_tasks.add_task(_worker, task_id, request.filters)
    return {"task_id": task_id}

def _worker(task_id, filters):
    # 1. 状态设为 processing
    # 2. openpyxl.Workbook(write_only=True)
    # 3. db.query().yield_per(5000)
    # 4. 循环写入 + 更新进度
    # 5. 存盘并设为 completed
```

### 前端 (Polling)
```typescript
const handleExport = async () => {
  const { task_id } = await api.post('/export', filters);
  const timer = setInterval(async () => {
    const res = await api.get(`/status/${task_id}`);
    if (act.status === 'completed') {
       clearInterval(timer);
       const blob = await api.get(`/download/${task_id}`, { responseType: 'blob' });
       // trigger download...
    }
  }, 3000);
};
```

## 5. 适用场景
*   作业清单全量导出。
*   历史日报汇总导出。
*   大规模数据同步/计算任务。
*   任何执行时间可能超过 30 秒的操作。
