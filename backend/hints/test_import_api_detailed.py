"""
详细测试 import_api 的导入过程
"""
import time
import sys

print("=" * 60)
print("详细测试 import_api 导入过程")
print("=" * 60)
print()

start_time = time.time()

def test_import(name, module_name):
    """测试导入并记录时间"""
    step_start = time.time()
    print(f"[{time.time() - start_time:.2f}s] {name}...", end=" ", flush=True)
    try:
        __import__(module_name)
        elapsed = time.time() - step_start
        print(f"✓ {elapsed:.2f}秒")
        return True
    except Exception as e:
        elapsed = time.time() - step_start
        print(f"❌ {elapsed:.2f}秒 - {str(e)[:50]}")
        return False

# 逐步测试 import_api 的依赖
print("【测试 import_api 的依赖】")
test_import("1. FastAPI", "fastapi")
test_import("2. SQLAlchemy", "sqlalchemy")
test_import("3. app.database", "app.database")
test_import("4. app.utils.russian_transliteration", "app.utils.russian_transliteration")
test_import("5. app.models.report", "app.models.report")
print()

print("【测试 import_api 本身】")
print("注意：如果这里阻塞，说明 import_api 模块本身有问题")
test_import("6. app.api.import_api", "app.api.import_api")
print()

total_time = time.time() - start_time
print("=" * 60)
print(f"总耗时: {total_time:.2f}秒")
print("=" * 60)

