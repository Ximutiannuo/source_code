"""
测试各个模块的导入时间，找出阻塞点
如果某个模块导入超过5秒，自动跳过
"""
import time
import sys
import traceback
import threading
import signal

# 超时时间（秒）
TIMEOUT = 5.0

class TimeoutError(Exception):
    pass

def timeout_handler(signum, frame):
    raise TimeoutError("导入超时")

def test_import_with_timeout(module_name, description="", timeout=TIMEOUT):
    """测试导入模块的时间，带超时机制"""
    start = time.time()
    result = {"success": False, "elapsed": 0, "error": None, "skipped": False}
    import_done = threading.Event()
    exception_occurred = threading.Event()
    thread = None
    
    def import_module():
        """在单独线程中执行导入"""
        nonlocal result
        try:
            if module_name.startswith("from "):
                # 处理 from ... import ... 的情况
                exec(module_name, globals())
            else:
                __import__(module_name)
            result["success"] = True
        except Exception as e:
            result["error"] = str(e)
            result["traceback"] = traceback.format_exc()
            exception_occurred.set()
        finally:
            import_done.set()
    
    try:
        # 创建线程执行导入
        thread = threading.Thread(target=import_module, daemon=True, name=f"Import-{module_name}")
        thread.start()
        
        # 等待完成或超时
        waited = import_done.wait(timeout=timeout)
        elapsed = time.time() - start
        
        if not waited:
            # 超时了
            result["skipped"] = True
            result["elapsed"] = timeout
            print(f"⏭️  {description or module_name}: 超过{timeout}秒，已跳过（线程可能仍在后台执行）")
            sys.stdout.flush()
            # 注意：daemon 线程会在主线程退出时自动终止
            return result
        
        # 检查结果
        if result["success"]:
            status = "✓"
            if elapsed > 1.0:
                status = "⚠️"
            if elapsed > 3.0:
                status = "❌"
            print(f"{status} {description or module_name}: {elapsed:.3f}秒")
        else:
            error_msg = result['error'][:100] if result['error'] else "未知错误"
            print(f"❌ {description or module_name}: {elapsed:.3f}秒 - 错误: {error_msg}")
            if result.get("traceback"):
                # 只打印错误的关键部分
                lines = result["traceback"].split('\n')
                for line in lines[:5]:  # 只打印前5行
                    if line.strip():
                        print(f"      {line}")
        
        sys.stdout.flush()
        return result
        
    except Exception as e:
        # 如果测试函数本身出错，也要继续
        elapsed = time.time() - start
        print(f"❌ {description or module_name}: 测试函数出错 - {str(e)[:100]}")
        sys.stdout.flush()
        return result

print("=" * 60)
print("测试模块导入时间（超过5秒自动跳过）")
print("=" * 60)
print()
sys.stdout.flush()

# 添加全局异常处理，确保脚本不会因为单个模块而退出
def safe_test_import(module_name, description=""):
    """安全地测试导入，即使出错也继续"""
    try:
        return test_import_with_timeout(module_name, description)
    except KeyboardInterrupt:
        print(f"\n⚠️  用户中断测试")
        raise
    except Exception as e:
        print(f"⚠️  测试 {description or module_name} 时发生异常: {e}")
        sys.stdout.flush()
        return None

# 1. 基础库
print("【基础库】")
sys.stdout.flush()

try:
    print("  正在测试 SQLAlchemy...", end="", flush=True)
    test_import_with_timeout("sqlalchemy", "SQLAlchemy")
except Exception as e:
    print(f"\n  测试 SQLAlchemy 时出错: {e}")
    sys.stdout.flush()

try:
    print("  正在测试 pandas...", end="", flush=True)
    test_import_with_timeout("pandas", "pandas")
except Exception as e:
    print(f"\n  测试 pandas 时出错: {e}")
    sys.stdout.flush()

try:
    print("  正在测试 numpy...", end="", flush=True)
    test_import_with_timeout("numpy", "numpy")
except Exception as e:
    print(f"\n  测试 numpy 时出错: {e}")
    sys.stdout.flush()

try:
    print("  正在测试 openpyxl...", end="", flush=True)
    test_import_with_timeout("openpyxl", "openpyxl")
except Exception as e:
    print(f"\n  测试 openpyxl 时出错: {e}")
    sys.stdout.flush()

try:
    print("  正在测试 FastAPI...", end="", flush=True)
    test_import_with_timeout("fastapi", "FastAPI")
except Exception as e:
    print(f"\n  测试 FastAPI 时出错: {e}")
    sys.stdout.flush()

try:
    print("  正在测试 Pydantic...", end="", flush=True)
    test_import_with_timeout("pydantic", "Pydantic")
except Exception as e:
    print(f"\n  测试 Pydantic 时出错: {e}")
    sys.stdout.flush()

print()
sys.stdout.flush()

# 2. 数据库配置
print("【数据库配置】")
sys.stdout.flush()
try:
    safe_test_import("app.database", "app.database (创建engine)")
except Exception as e:
    print(f"测试数据库配置时出错: {e}")
    sys.stdout.flush()
print()
sys.stdout.flush()

# 3. 模型导入
print("【模型导入】")
sys.stdout.flush()
for module, desc in [
    ("app.models.activity_summary", "ActivitySummary 模型"),
    ("app.models.report", "report 模型模块"),
    ("app.models.user", "User 模型"),
    ("app.models.welding_sync_log", "WeldingSyncLog 模型")
]:
    try:
        safe_test_import(module, desc)
    except Exception as e:
        print(f"测试 {desc} 时出错: {e}")
        sys.stdout.flush()
print()
sys.stdout.flush()

# 4. 服务模块
print("【服务模块】")
sys.stdout.flush()
for module, desc in [
    ("app.services.p6_sync_service", "P6SyncService"),
    ("app.services.cache_service", "CacheService"),
    ("app.services.daily_report_vba_replica", "DailyReportVBAReplica"),
    ("app.services.permission_service", "PermissionService")
]:
    try:
        safe_test_import(module, desc)
    except Exception as e:
        print(f"测试 {desc} 时出错: {e}")
        sys.stdout.flush()
print()
sys.stdout.flush()

# 5. API 模块（按 main.py 中的导入顺序）
api_modules_batch1 = [
    ("app.api.wbs", "wbs"),
    ("app.api.activities", "activities"),
    ("app.api.reports", "reports"),
    ("app.api.p6_sync", "p6_sync"),
    ("app.api.p6_wbs", "p6_wbs"),
    ("app.api.p6_resources", "p6_resources"),
    ("app.api.facility", "facility"),
    ("app.api.rsc", "rsc")
]

api_modules_batch2 = [
    ("app.api.volume_control", "volume_control"),
    ("app.api.volume_control_v2", "volume_control_v2"),
    ("app.api.weight", "weight"),
    ("app.api.utils", "utils"),
    ("app.api.activity_sync", "activity_sync"),
    ("app.api.activity_detail", "activity_detail"),
    ("app.api.facility_filter", "facility_filter"),
    ("app.api.cache_management", "cache_management")
]

api_modules_batch3 = [
    ("app.api.summary", "summary"),
    ("app.api.dashboard", "dashboard"),
    ("app.api.workstep", "workstep"),
    ("app.api.workstep_volume", "workstep_volume"),
    ("app.api.external_data", "external_data")
]

api_modules_batch4 = [
    ("app.api.import_api", "import_api"),
    ("app.api.daily_reports", "daily_reports"),
    ("app.api.daily_report_fill", "daily_report_fill"),
    ("app.api.daily_report_management", "daily_report_management")
]

api_modules_batch5 = [
    ("app.api.auth", "auth"),
    ("app.api.users", "users"),
    ("app.api.permissions", "permissions"),
    ("app.api.activity_codes", "activity_codes")
]

for batch_name, modules in [
    ("【API 模块 - 第一批】", api_modules_batch1),
    ("【API 模块 - 第二批】", api_modules_batch2),
    ("【API 模块 - 第三批】", api_modules_batch3),
    ("【API 模块 - 第四批（已知可能阻塞的）】", api_modules_batch4),
    ("【API 模块 - 认证和权限】", api_modules_batch5)
]:
    print(batch_name)
    sys.stdout.flush()
    for module, desc in modules:
        try:
            safe_test_import(module, desc)
        except Exception as e:
            print(f"测试 {desc} 时出错: {e}")
            sys.stdout.flush()
    print()
    sys.stdout.flush()

# 6. 检查 SQLAlchemy 元数据解析（不连接数据库）
print("【SQLAlchemy 元数据解析（不连接数据库）】")
try:
    start = time.time()
    from app.database import Base
    from app.models.report import MPDB, VFACTDB
    from app.models.activity_summary import ActivitySummary
    
    elapsed1 = time.time() - start
    print(f"✓ 导入模型: {elapsed1:.3f}秒")
    
    # 检查元数据解析（不连接数据库）
    start = time.time()
    metadata = Base.metadata
    tables = list(metadata.tables.keys())
    mpdb_table = metadata.tables.get('mpdb')
    vfactdb_table = metadata.tables.get('vfactdb')
    activity_summary_table = metadata.tables.get('activity_summary')
    elapsed2 = time.time() - start
    print(f"✓ 元数据解析: {elapsed2:.3f}秒")
    print(f"  已注册表: {len(tables)} 个")
    print(f"  MPDB表存在: {mpdb_table is not None}")
    print(f"  VFACTDB表存在: {vfactdb_table is not None}")
    print(f"  ActivitySummary表存在: {activity_summary_table is not None}")
    
    # 检查外键关系
    if mpdb_table:
        start = time.time()
        fks = list(mpdb_table.foreign_keys)
        elapsed3 = time.time() - start
        print(f"✓ MPDB外键解析: {elapsed3:.3f}秒, 外键数量: {len(fks)}")
    
    if vfactdb_table:
        start = time.time()
        fks = list(vfactdb_table.foreign_keys)
        elapsed4 = time.time() - start
        print(f"✓ VFACTDB外键解析: {elapsed4:.3f}秒, 外键数量: {len(fks)}")
except Exception as e:
    print(f"❌ 元数据解析失败: {e}")
    traceback.print_exc()
print()

# 7. 测试 main.py 的完整导入流程
print("【测试 main.py 导入流程】")
print("注意：这将模拟 main.py 的导入顺序")
try:
    start = time.time()
    
    # 模拟 main.py 的导入
    print("  1. 导入 FastAPI...")
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    
    print("  2. 导入 API 模块...")
    # 这里只测试导入，不实际执行
    import importlib
    api_modules = [
        "app.api.wbs", "app.api.activities", "app.api.reports", 
        "app.api.p6_sync", "app.api.p6_wbs", "app.api.p6_resources",
        "app.api.facility", "app.api.rsc", "app.api.volume_control",
        "app.api.volume_control_v2", "app.api.weight", "app.api.utils",
        "app.api.activity_sync", "app.api.activity_detail",
        "app.api.facility_filter", "app.api.cache_management",
        "app.api.summary", "app.api.dashboard", "app.api.workstep",
        "app.api.workstep_volume", "app.api.external_data"
    ]
    
    for module_name in api_modules:
        try:
            importlib.import_module(module_name)
        except Exception as e:
            print(f"    ⚠️ {module_name}: {e}")
    
    print("  3. 导入其他模块...")
    importlib.import_module("app.api.import_api")
    importlib.import_module("app.api.auth")
    importlib.import_module("app.api.users")
    importlib.import_module("app.api.permissions")
    importlib.import_module("app.api.daily_reports")
    importlib.import_module("app.api.activity_codes")
    importlib.import_module("app.api.daily_report_fill")
    importlib.import_module("app.api.daily_report_management")
    
    elapsed = time.time() - start
    print(f"✓ 完整导入流程: {elapsed:.3f}秒")
except Exception as e:
    elapsed = time.time() - start
    print(f"❌ 完整导入流程失败: {elapsed:.3f}秒 - {e}")
    traceback.print_exc()
print()

print("=" * 60)
print("测试完成")
print("=" * 60)
print()
print("提示：")
print("- ✓ 表示正常（< 1秒）")
print("- ⚠️ 表示较慢（1-3秒）")
print("- ❌ 表示很慢（> 3秒）")
print("- ⏭️ 表示超时跳过（> 5秒）")
