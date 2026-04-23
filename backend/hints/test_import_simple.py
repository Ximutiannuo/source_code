"""
简化版导入测试脚本 - 逐个测试，如果超过5秒就跳过
使用更简单直接的方法，避免线程问题
"""
import time
import sys
import signal

TIMEOUT = 5.0

class TimeoutException(Exception):
    pass

def timeout_handler(signum, frame):
    raise TimeoutException("导入超时")

def test_import_simple(module_name, description=""):
    """简单测试导入时间，带超时"""
    print(f"测试: {description or module_name}...", end=" ", flush=True)
    start = time.time()
    
    # 设置超时信号（仅限 Unix 系统，Windows 不支持）
    if sys.platform != 'win32':
        signal.signal(signal.SIGALRM, timeout_handler)
        signal.alarm(int(TIMEOUT))
    
    try:
        __import__(module_name)
        
        if sys.platform != 'win32':
            signal.alarm(0)  # 取消超时
        
        elapsed = time.time() - start
        
        if elapsed > TIMEOUT:
            print(f"⏭️ 超过{TIMEOUT}秒")
            return False
        
        status = "✓"
        if elapsed > 1.0:
            status = "⚠️"
        if elapsed > 3.0:
            status = "❌"
        print(f"{status} {elapsed:.3f}秒")
        return True
        
    except TimeoutException:
        if sys.platform != 'win32':
            signal.alarm(0)
        elapsed = time.time() - start
        print(f"⏭️ 超过{TIMEOUT}秒（实际: {elapsed:.1f}秒）")
        return False
    except KeyboardInterrupt:
        if sys.platform != 'win32':
            signal.alarm(0)
        print("\n用户中断")
        raise
    except Exception as e:
        if sys.platform != 'win32':
            signal.alarm(0)
        elapsed = time.time() - start
        if elapsed > TIMEOUT:
            print(f"⏭️ 超过{TIMEOUT}秒")
        else:
            print(f"❌ 错误: {str(e)[:50]}")
        return False

print("=" * 60)
print("简化版模块导入测试（超过5秒自动跳过）")
print("=" * 60)
print()

# 基础库
print("【基础库】")
modules = [
    ("sqlalchemy", "SQLAlchemy"),
    ("pandas", "pandas"),
    ("numpy", "numpy"),
    ("openpyxl", "openpyxl"),
    ("fastapi", "FastAPI"),
    ("pydantic", "Pydantic"),
]

for module, desc in modules:
    try:
        # 对于可能阻塞的模块，先检查是否已安装
        if module == "pandas":
            print(f"\n注意: pandas 导入可能较慢，如果超过{TIMEOUT}秒将跳过...")
        test_import_simple(module, desc)
    except KeyboardInterrupt:
        print("\n测试中断")
        break
    except Exception as e:
        print(f"测试 {desc} 时发生异常: {e}")
        continue
    finally:
        # 确保清理
        if sys.platform != 'win32':
            try:
                signal.alarm(0)
            except:
                pass

print()

# 数据库配置
print("【数据库配置】")
try:
    test_import_simple("app.database", "app.database")
except Exception as e:
    print(f"测试数据库配置时出错: {e}")

print()

# 模型
print("【模型导入】")
model_modules = [
    ("app.models.activity_summary", "ActivitySummary"),
    ("app.models.report", "report"),
    ("app.models.user", "User"),
    ("app.models.welding_sync_log", "WeldingSyncLog"),
]

for module, desc in model_modules:
    try:
        test_import_simple(module, desc)
    except Exception as e:
        print(f"测试 {desc} 时出错: {e}")
        continue

print()

# API 模块 - 只测试已知可能阻塞的
print("【API 模块 - 已知可能阻塞的】")
api_modules = [
    ("app.api.import_api", "import_api"),
    ("app.api.daily_reports", "daily_reports"),
    ("app.api.daily_report_fill", "daily_report_fill"),
    ("app.api.daily_report_management", "daily_report_management"),
]

for module, desc in api_modules:
    try:
        test_import_simple(module, desc)
    except Exception as e:
        print(f"测试 {desc} 时出错: {e}")
        continue

print()
print("=" * 60)
print("测试完成")
print("=" * 60)

