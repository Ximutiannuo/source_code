"""
清除Redis缓存脚本
用于清除activity_detail相关的缓存
"""
import sys
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from app.services.cache_service import get_cache_service


def clear_activity_detail_cache():
    """清除activity_detail相关的缓存"""
    cache_service = get_cache_service()
    
    if not cache_service.is_enabled():
        print("⚠️ Redis缓存未启用，无需清除")
        return
    
    print("=" * 60)
    print("清除activity_detail缓存")
    print("=" * 60)
    
    # 清除activity_detail相关的缓存
    pattern = "activity_detail:*"
    deleted_count = cache_service.delete_pattern(pattern)
    
    print(f"\n✓ 已清除 {deleted_count} 个匹配 '{pattern}' 的缓存")
    
    # 也清除筛选器缓存
    pattern2 = "activity_detail_filters"
    cache_service.delete(pattern2)
    print(f"✓ 已清除筛选器缓存")
    
    print("\n" + "=" * 60)
    print("缓存清除完成")
    print("=" * 60)


def clear_all_cache():
    """清除所有缓存"""
    cache_service = get_cache_service()
    
    if not cache_service.is_enabled():
        print("⚠️ Redis缓存未启用，无需清除")
        return
    
    print("=" * 60)
    print("清除所有缓存")
    print("=" * 60)
    
    deleted_count = cache_service.delete_pattern("*")
    
    print(f"\n✓ 已清除所有缓存（{deleted_count} 个）")
    print("=" * 60)


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="清除Redis缓存")
    parser.add_argument(
        '--all',
        action='store_true',
        help='清除所有缓存（默认只清除activity_detail相关缓存）'
    )
    
    args = parser.parse_args()
    
    if args.all:
        clear_all_cache()
    else:
        clear_activity_detail_cache()

