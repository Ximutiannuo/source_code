"""
只测试关键模块的导入时间
跳过可能阻塞的基础库（如 pandas），直接测试应用模块
"""
import time
import sys

def test_import(module_name, description=""):
    """测试导入时间"""
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
print("测试关键模块导入时间（跳过基础库）")
print("=" * 60)
print()

# 数据库配置
print("【数据库配置】")
try:
    test_import("app.database", "app.database")
except KeyboardInterrupt:
    print("\n跳过数据库配置测试")
except Exception as e:
    print(f"测试数据库配置时出错: {e}")

print()

# 模型
print("【模型导入】")
model_modules = [
    ("app.models.activity_summary", "ActivitySummary"),
    ("app.models.report", "report (MPDB/VFACTDB) ⚠️ 关键测试"),
    ("app.models.user", "User"),
]

for module, desc in model_modules:
    try:
        test_import(module, desc)
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
    ("app.api.import_api", "import_api ⚠️ 包含 pandas"),
    ("app.api.daily_reports", "daily_reports"),
    ("app.api.daily_report_fill", "daily_report_fill"),
    ("app.api.daily_report_management", "daily_report_management"),
]

for module, desc in api_modules:
    try:
        test_import(module, desc)
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

