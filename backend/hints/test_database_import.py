"""
测试 app.database 导入是否阻塞
"""
import time
import sys

print("测试 app.database 导入...")
start = time.time()

try:
    print("开始导入 app.database...")
    from app.database import engine, Base
    elapsed = time.time() - start
    print(f"✓ 导入成功，耗时: {elapsed:.2f}秒")
    
    # 测试 engine 是否立即连接
    print("\n测试 engine 连接...")
    start2 = time.time()
    try:
        with engine.connect() as conn:
            result = conn.execute("SELECT 1")
            result.fetchone()
        elapsed2 = time.time() - start2
        print(f"✓ 连接成功，耗时: {elapsed2:.2f}秒")
    except Exception as e:
        elapsed2 = time.time() - start2
        print(f"❌ 连接失败，耗时: {elapsed2:.2f}秒 - {e}")
        
except Exception as e:
    elapsed = time.time() - start
    print(f"❌ 导入失败，耗时: {elapsed:.2f}秒 - {e}")
    import traceback
    traceback.print_exc()

