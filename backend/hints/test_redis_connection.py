"""
测试Redis连接
"""
import sys
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from app.services.cache_service import get_cache_service

def test_redis():
    """测试Redis连接"""
    print("=" * 60)
    print("测试Redis连接")
    print("=" * 60)
    
    cache_service = get_cache_service()
    
    # 尝试连接（通过get_client触发）
    print("\n1. 尝试连接Redis...")
    client = cache_service._get_client()
    
    if cache_service.is_enabled():
        print("✅ Redis连接成功！")
        print(f"   状态: 已启用")
        
        # 测试基本操作
        print("\n2. 测试缓存操作...")
        test_key = "test:connection"
        test_value = {"message": "Hello Redis!", "timestamp": "2024-01-01"}
        
        # 设置缓存
        if cache_service.set(test_key, test_value, ttl=60):
            print("   ✅ 设置缓存成功")
        else:
            print("   ❌ 设置缓存失败")
            return
        
        # 获取缓存
        result = cache_service.get(test_key)
        if result:
            print(f"   ✅ 获取缓存成功: {result}")
        else:
            print("   ❌ 获取缓存失败")
            return
        
        # 删除测试缓存
        cache_service.delete(test_key)
        print("   ✅ 删除测试缓存成功")
        
        print("\n" + "=" * 60)
        print("✅ Redis测试通过！缓存功能已就绪")
        print("=" * 60)
    else:
        print("❌ Redis连接失败！")
        print("   请检查：")
        print("   1. Redis服务是否运行（docker ps 或检查Docker Desktop）")
        print("   2. Redis端口是否为6379")
        print("   3. 防火墙是否阻止连接")
        print("\n   如果Redis未安装，系统会自动禁用缓存，但不会影响其他功能。")
        return False
    
    return True

if __name__ == "__main__":
    success = test_redis()
    sys.exit(0 if success else 1)

