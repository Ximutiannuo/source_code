"""
直接测试导入时间 - 不使用超时机制，直接测试
如果某个模块卡住，按 Ctrl+C 中断，然后继续下一个
"""
import time
import sys

def test_import_direct(module_name, description=""):
    """直接测试导入时间"""
    print(f"测试: {description or module_name}...", end=" ", flush=True)
    start = time.time()
    
    try:
        __import__(module_name)
        elapsed = time.time() - start
        
        status = "✓"
        if elapsed > 1.0:
            status = "⚠️"
        if elapsed > 3.0:
            status = "❌"
        if elapsed > 5.0:
            status = "🔴"
        print(f"{status} {elapsed:.3f}秒")
        return elapsed
        
    except KeyboardInterrupt:
        elapsed = time.time() - start
        print(f"\n⚠️  用户中断（已用时: {elapsed:.1f}秒）")
        raise
    except Exception as e:
        elapsed = time.time() - start
        print(f"❌ 错误: {str(e)[:80]}")
        return None

print("=" * 60)
print("直接测试模块导入时间")
print("提示: 如果某个模块卡住，按 Ctrl+C 中断，然后继续")
print("=" * 60)
print()

# 基础库
print("【基础库】")
modules = [
    ("sqlalchemy", "SQLAlchemy"),
    ("pandas", "pandas ⚠️ 可能较慢"),
    ("numpy", "numpy"),
    ("openpyxl", "openpyxl"),
    ("fastapi", "FastAPI"),
    ("pydantic", "Pydantic"),
]

for module, desc in modules:
    try:
        test_import_direct(module, desc)
    except KeyboardInterrupt:
        print(f"\n跳过 {desc}，继续下一个...")
        continue
    except Exception as e:
        print(f"测试 {desc} 时发生异常: {e}")
        continue

print()

# 数据库配置
print("【数据库配置】")
try:
    test_import_direct("app.database", "app.database")
except KeyboardInterrupt:
    print("\n跳过数据库配置测试")
except Exception as e:
    print(f"测试数据库配置时出错: {e}")

print()

# 模型
print("【模型导入】")
model_modules = [
    ("app.models.activity_summary", "ActivitySummary"),
    ("app.models.report", "report (MPDB/VFACTDB)"),
    ("app.models.user", "User"),
    ("app.models.welding_sync_log", "WeldingSyncLog"),
]

for module, desc in model_modules:
    try:
        test_import_direct(module, desc)
    except KeyboardInterrupt:
        print(f"\n跳过 {desc}，继续下一个...")
        continue
    except Exception as e:
        print(f"测试 {desc} 时出错: {e}")
        continue

print()

# API 模块 - 已知可能阻塞的
print("【API 模块 - 已知可能阻塞的】")
api_modules = [
    ("app.api.import_api", "import_api"),
    ("app.api.daily_reports", "daily_reports"),
    ("app.api.daily_report_fill", "daily_report_fill"),
    ("app.api.daily_report_management", "daily_report_management"),
]

for module, desc in api_modules:
    try:
        test_import_direct(module, desc)
    except KeyboardInterrupt:
        print(f"\n跳过 {desc}，继续下一个...")
        continue
    except Exception as e:
        print(f"测试 {desc} 时出错: {e}")
        continue

print()
print("=" * 60)
print("测试完成")
print("=" * 60)
print()
print("说明:")
print("  ✓ = 正常 (< 1秒)")
print("  ⚠️ = 较慢 (1-3秒)")
print("  ❌ = 很慢 (3-5秒)")
print("  🔴 = 非常慢 (> 5秒)")

