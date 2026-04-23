"""
诊断后端启动阻塞问题
逐步导入模块，找出阻塞点
"""
import time
import sys

print("=" * 60)
print("诊断后端启动阻塞问题")
print("=" * 60)
print()

# 记录每个步骤的时间
start_time = time.time()

def step(name, func):
    """执行一个步骤并记录时间"""
    step_start = time.time()
    print(f"[{time.time() - start_time:.2f}s] {name}...", end=" ", flush=True)
    
    # 添加进度提示
    import threading
    import sys
    
    def print_progress():
        """每2秒打印一次进度点"""
        elapsed = 0
        while elapsed < 30:  # 最多等待30秒
            time.sleep(2)
            elapsed = time.time() - step_start
            if elapsed < 30:
                print(".", end="", flush=True)
    
    progress_thread = threading.Thread(target=print_progress, daemon=True)
    progress_thread.start()
    
    try:
        func()
        elapsed = time.time() - step_start
        # 停止进度提示
        if elapsed > 1.0:
            print(f"\n⚠️ {elapsed:.2f}秒")
        else:
            print(f"✓ {elapsed:.2f}秒")
        return True
    except Exception as e:
        elapsed = time.time() - step_start
        print(f"\n❌ {elapsed:.2f}秒 - 错误: {str(e)[:50]}")
        import traceback
        traceback.print_exc()
        return False

# 步骤 1: 基础库
print("【步骤 1: 基础库】")
step("导入 FastAPI", lambda: __import__("fastapi"))
step("导入 SQLAlchemy", lambda: __import__("sqlalchemy"))
step("导入 pydantic", lambda: __import__("pydantic"))
print()

# 步骤 2: 数据库配置
print("【步骤 2: 数据库配置】")
step("导入 app.database", lambda: __import__("app.database"))
print()

# 步骤 3: 模型导入
print("【步骤 3: 模型导入】")
step("导入 app.models.activity_summary", lambda: __import__("app.models.activity_summary"))
step("导入 app.models.report", lambda: __import__("app.models.report"))
step("导入 app.models.user", lambda: __import__("app.models.user"))
print()

# 步骤 4: 服务模块
print("【步骤 4: 服务模块】")
step("导入 app.services.cache_service", lambda: __import__("app.services.cache_service"))
step("导入 app.services.p6_sync_service", lambda: __import__("app.services.p6_sync_service"))
print()

# 步骤 5: API 模块（按 main.py 顺序）
print("【步骤 5: API 模块 - 第一批】")
step("导入 app.api.wbs", lambda: __import__("app.api.wbs"))
step("导入 app.api.activities", lambda: __import__("app.api.activities"))
step("导入 app.api.reports", lambda: __import__("app.api.reports"))
step("导入 app.api.auth", lambda: __import__("app.api.auth"))
step("导入 app.api.users", lambda: __import__("app.api.users"))
print()

print("【步骤 6: API 模块 - 可能阻塞的】")
print("注意：如果某个导入超过10秒，可能是阻塞点")
print()

# 先单独测试 pandas 导入
print("  6.1 单独测试 pandas 导入...", end=" ", flush=True)
pandas_start = time.time()
try:
    import pandas as pd
    pandas_elapsed = time.time() - pandas_start
    if pandas_elapsed > 5.0:
        print(f"⚠️ {pandas_elapsed:.2f}秒（很慢！可能是阻塞点）")
    elif pandas_elapsed > 1.0:
        print(f"⚠️ {pandas_elapsed:.2f}秒（较慢）")
    else:
        print(f"✓ {pandas_elapsed:.2f}秒")
except Exception as e:
    pandas_elapsed = time.time() - pandas_start
    print(f"❌ {pandas_elapsed:.2f}秒 - {str(e)[:50]}")
    print("  ⚠️ pandas 导入失败，这可能是阻塞的原因！")
print()

# 测试 import_api
print("  6.2 测试导入 app.api.import_api...")
print("      （如果这里卡住超过10秒，说明 import_api 模块导入时阻塞）")
step("导入 app.api.import_api", lambda: __import__("app.api.import_api"))
print()

print("  6.3 测试其他可能阻塞的模块：")
step("导入 app.api.daily_reports", lambda: __import__("app.api.daily_reports"))
step("导入 app.api.daily_report_fill", lambda: __import__("app.api.daily_report_fill"))
step("导入 app.api.daily_report_management", lambda: __import__("app.api.daily_report_management"))
print()

print("【步骤 7: 其他 API 模块】")
step("导入 app.api.dashboard", lambda: __import__("app.api.dashboard"))
step("导入 app.api.summary", lambda: __import__("app.api.summary"))
print()

# 步骤 8: 导入 main
print("【步骤 8: 导入 main 模块】")
step("导入 app.main", lambda: __import__("app.main"))
print()

total_time = time.time() - start_time
print("=" * 60)
print(f"总耗时: {total_time:.2f}秒")
print("=" * 60)
print()
print("如果某个步骤耗时超过 5 秒，那就是阻塞点！")

