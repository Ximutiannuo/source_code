"""
检查 pandas 和 numpy 的安装情况
"""
import sys
import time

print("=" * 60)
print("检查 pandas 和 numpy 安装情况")
print("=" * 60)
print()

print(f"Python 版本: {sys.version}")
print(f"Python 路径: {sys.executable}")
print()

# 检查 numpy（带超时）
print("1. 检查 numpy...")
print("   开始导入 numpy（如果超过10秒，按 Ctrl+C 中断）...", end=" ", flush=True)

import threading
import sys

numpy_imported = False
numpy_error = None
numpy_result = None

def import_numpy():
    global numpy_imported, numpy_error, numpy_result
    try:
        import numpy
        numpy_result = numpy
        numpy_imported = True
    except Exception as e:
        numpy_error = e
        numpy_imported = True

numpy_thread = threading.Thread(target=import_numpy, daemon=True)
numpy_start = time.time()
numpy_thread.start()
numpy_thread.join(timeout=10.0)  # 最多等待10秒

if numpy_thread.is_alive():
    elapsed = time.time() - numpy_start
    print(f"\n   ⚠️ numpy 导入超时（已等待 {elapsed:.1f}秒）")
    print("   ❌ numpy 导入阻塞！这可能是问题的根源。")
    print("   建议：重新安装 numpy 或检查系统依赖")
elif numpy_error:
    elapsed = time.time() - numpy_start
    print(f"\n   ❌ numpy 导入错误: {numpy_error}")
    print(f"   导入耗时: {elapsed:.2f}秒")
elif numpy_result:
    elapsed = time.time() - numpy_start
    print(f"\n   ✓ numpy 已安装")
    print(f"   版本: {numpy_result.__version__}")
    print(f"   路径: {numpy_result.__file__}")
    print(f"   导入耗时: {elapsed:.2f}秒")
else:
    elapsed = time.time() - numpy_start
    print(f"\n   ⚠️ numpy 导入未完成（耗时: {elapsed:.2f}秒）")
print()

# 检查 pandas（带超时）
print("2. 检查 pandas...")
print("   注意：如果 numpy 已阻塞，pandas 也会阻塞")
print("   开始导入 pandas（最多等待10秒）...", end=" ", flush=True)

pandas_imported = False
pandas_error = None
pandas_result = None

def import_pandas():
    global pandas_imported, pandas_error, pandas_result
    try:
        import pandas
        pandas_result = pandas
        pandas_imported = True
    except Exception as e:
        pandas_error = e
        pandas_imported = True

pandas_thread = threading.Thread(target=import_pandas, daemon=True)
pandas_start = time.time()
pandas_thread.start()
pandas_thread.join(timeout=10.0)  # 最多等待10秒

if pandas_thread.is_alive():
    elapsed = time.time() - pandas_start
    print(f"\n   ⚠️ pandas 导入超时（已等待 {elapsed:.1f}秒）")
    print("   ❌ pandas 导入阻塞！")
    print("   建议：重新安装 pandas 和 numpy")
elif pandas_error:
    elapsed = time.time() - pandas_start
    print(f"\n   ❌ pandas 导入错误: {pandas_error}")
    print(f"   导入耗时: {elapsed:.2f}秒")
elif pandas_result:
    elapsed = time.time() - pandas_start
    print(f"\n   ✓ pandas 已安装")
    print(f"   版本: {pandas_result.__version__}")
    print(f"   路径: {pandas_result.__file__}")
    print(f"   导入耗时: {elapsed:.2f}秒")
else:
    elapsed = time.time() - pandas_start
    print(f"\n   ⚠️ pandas 导入未完成（耗时: {elapsed:.2f}秒）")
print()

# 检查依赖
print("3. 检查 pandas 依赖...")
try:
    import pandas
    print("   检查 pandas 的依赖模块...")
    
    # 检查关键依赖
    deps = ['numpy', 'pytz', 'dateutil']
    for dep in deps:
        try:
            mod = __import__(dep)
            print(f"   ✓ {dep}: {mod.__version__ if hasattr(mod, '__version__') else '已安装'}")
        except:
            print(f"   ⚠️ {dep}: 未找到或有问题")
except:
    print("   无法检查依赖（pandas 未导入）")
print()

print("=" * 60)
print("检查完成")
print("=" * 60)

