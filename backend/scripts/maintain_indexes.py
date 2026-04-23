"""
索引维护脚本
用于定期维护索引（更新统计信息、检查碎片等）
"""
import sys
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from sqlalchemy import text
from app.database import SessionLocal
import traceback


def analyze_tables():
    """更新表统计信息（帮助查询优化器选择更好的执行计划）"""
    db = SessionLocal()
    
    try:
        print("=" * 60)
        print("更新表统计信息")
        print("=" * 60)
        print("\n这会帮助查询优化器选择更好的执行计划，提升查询性能。")
        print("建议每月运行一次。\n")
        
        tables = ['vfactdb', 'mpdb', 'activities', 'volume_controls', 'rsc_defines', 'facilities']
        
        for table in tables:
            try:
                print(f"分析表 {table}...")
                db.execute(text(f"ANALYZE TABLE {table}"))
                db.commit()
                print(f"  ✓ {table} 统计信息已更新")
            except Exception as e:
                print(f"  ⚠️ {table} 分析失败: {e}")
        
        print("\n" + "=" * 60)
        print("统计信息更新完成")
        print("=" * 60)
        return True
        
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        print(f"详细信息: {traceback.format_exc()}")
        return False
    finally:
        db.close()


def check_index_usage():
    """检查索引使用情况"""
    db = SessionLocal()
    
    try:
        print("=" * 60)
        print("检查索引使用情况")
        print("=" * 60)
        
        # 检查 vfactdb 索引
        print("\nVFACTDB 索引：")
        indexes = db.execute(text("SHOW INDEX FROM vfactdb")).fetchall()
        for idx in indexes:
            print(f"  - {idx[2]} ({idx[4]})")
        
        # 检查 mpdb 索引
        print("\nMPDB 索引：")
        indexes = db.execute(text("SHOW INDEX FROM mpdb")).fetchall()
        for idx in indexes:
            print(f"  - {idx[2]} ({idx[4]})")
        
        # 测试索引是否被使用
        print("\n测试索引使用情况：")
        print("  测试 VFACTDB 聚合查询...")
        explain_result = db.execute(text("""
            EXPLAIN SELECT activity_id, SUM(achieved) 
            FROM vfactdb 
            WHERE activity_id IS NOT NULL 
            GROUP BY activity_id
            LIMIT 1
        """)).fetchall()
        
        if explain_result:
            key = explain_result[0][4] if len(explain_result[0]) > 4 else None
            if key:
                print(f"  ✓ 使用了索引: {key}")
            else:
                print("  ⚠️ 未使用索引（可能需要检查）")
        
        print("\n测试 MPDB 聚合查询...")
        explain_result = db.execute(text("""
            EXPLAIN SELECT activity_id, SUM(manpower), MIN(date), MAX(date)
            FROM mpdb 
            WHERE activity_id IS NOT NULL 
            GROUP BY activity_id
            LIMIT 1
        """)).fetchall()
        
        if explain_result:
            key = explain_result[0][4] if len(explain_result[0]) > 4 else None
            if key:
                print(f"  ✓ 使用了索引: {key}")
            else:
                print("  ⚠️ 未使用索引（可能需要检查）")
        
        print("\n" + "=" * 60)
        return True
        
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        print(f"详细信息: {traceback.format_exc()}")
        return False
    finally:
        db.close()


def check_table_fragmentation():
    """检查表碎片情况"""
    db = SessionLocal()
    
    try:
        print("=" * 60)
        print("检查表碎片情况")
        print("=" * 60)
        
        tables = ['vfactdb', 'mpdb', 'activities']
        
        for table in tables:
            try:
                status = db.execute(text(f"SHOW TABLE STATUS LIKE '{table}'")).fetchone()
                if status:
                    data_length = status[6] or 0  # Data_length
                    data_free = status[8] or 0    # Data_free
                    data_length_mb = data_length / 1024 / 1024
                    data_free_mb = data_free / 1024 / 1024
                    
                    if data_length > 0:
                        fragmentation_rate = (data_free / data_length) * 100
                        print(f"\n{table}:")
                        print(f"  数据大小: {data_length_mb:.2f} MB")
                        print(f"  碎片大小: {data_free_mb:.2f} MB")
                        print(f"  碎片率: {fragmentation_rate:.2f}%")
                        
                        if fragmentation_rate > 30:
                            print(f"  ⚠️ 碎片率较高，建议运行: OPTIMIZE TABLE {table};")
                        else:
                            print(f"  ✓ 碎片率正常")
            except Exception as e:
                print(f"  ⚠️ 检查 {table} 失败: {e}")
        
        print("\n" + "=" * 60)
        return True
        
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        print(f"详细信息: {traceback.format_exc()}")
        return False
    finally:
        db.close()


def optimize_tables():
    """优化表（重建索引，消除碎片）"""
    db = SessionLocal()
    
    try:
        print("=" * 60)
        print("优化表（重建索引，消除碎片）")
        print("=" * 60)
        print("\n⚠️ 注意：")
        print("1. 这会锁定表，可能需要较长时间")
        print("2. 建议在低峰期运行")
        print("3. 对于大表（百万级），可能需要几分钟到几十分钟")
        print("\n")
        
        confirm = input("确认要继续吗？(yes/no): ")
        if confirm.lower() != 'yes':
            print("已取消")
            return False
        
        tables = ['vfactdb', 'mpdb', 'activities']
        
        for table in tables:
            try:
                print(f"\n优化表 {table}...")
                print("  这可能需要一些时间，请耐心等待...")
                db.execute(text(f"OPTIMIZE TABLE {table}"))
                db.commit()
                print(f"  ✓ {table} 优化完成")
            except Exception as e:
                print(f"  ⚠️ {table} 优化失败: {e}")
        
        print("\n" + "=" * 60)
        print("表优化完成")
        print("=" * 60)
        return True
        
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        print(f"详细信息: {traceback.format_exc()}")
        return False
    finally:
        db.close()


def main():
    """主菜单"""
    import argparse
    
    parser = argparse.ArgumentParser(description="索引维护工具")
    parser.add_argument(
        'action',
        choices=['analyze', 'check', 'fragmentation', 'optimize', 'all'],
        help='执行的操作'
    )
    
    args = parser.parse_args()
    
    if args.action == 'analyze':
        analyze_tables()
    elif args.action == 'check':
        check_index_usage()
    elif args.action == 'fragmentation':
        check_table_fragmentation()
    elif args.action == 'optimize':
        optimize_tables()
    elif args.action == 'all':
        print("执行所有维护操作...\n")
        check_index_usage()
        print("\n")
        check_table_fragmentation()
        print("\n")
        analyze_tables()


if __name__ == "__main__":
    if len(sys.argv) == 1:
        print("=" * 60)
        print("索引维护工具")
        print("=" * 60)
        print("\n使用方法：")
        print("  python scripts/maintain_indexes.py analyze        # 更新统计信息（推荐每月运行）")
        print("  python scripts/maintain_indexes.py check          # 检查索引使用情况")
        print("  python scripts/maintain_indexes.py fragmentation # 检查表碎片")
        print("  python scripts/maintain_indexes.py optimize       # 优化表（重建索引，消除碎片）")
        print("  python scripts/maintain_indexes.py all            # 执行所有检查")
        print("\n")
        sys.exit(0)
    
    main()

