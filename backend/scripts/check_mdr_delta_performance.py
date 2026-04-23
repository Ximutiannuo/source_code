"""
检查MDR Delta Cache计算的性能问题
诊断是否有必要的索引，以及查询是否卡住
"""
import sys
from pathlib import Path
from datetime import datetime

# 添加路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from app.database import default_engine
from sqlalchemy import text

def check_delta_performance():
    """检查Delta Cache计算的性能问题"""
    print("=" * 80)
    print("MDR Delta Cache 性能诊断")
    print("=" * 80)
    print()
    
    with default_engine.connect() as conn:
        # 1. 检查表记录数
        print("1. 检查数据表记录数")
        print("-" * 80)
        try:
            curr_result = conn.execute(text("SELECT COUNT(*) FROM ext_eng_db_current"))
            curr_count = curr_result.scalar()
            print(f"   ext_eng_db_current: {curr_count:,} 条记录")
            
            prev_result = conn.execute(text("SELECT COUNT(*) FROM ext_eng_db_previous"))
            prev_count = prev_result.scalar()
            print(f"   ext_eng_db_previous: {prev_count:,} 条记录")
            
            if curr_count > 1000000:
                print(f"   ⚠️  警告: 当前表有 {curr_count:,} 条记录，JOIN操作可能会很慢")
        except Exception as e:
            print(f"   ❌ 查询失败: {e}")
        
        print()
        
        # 2. 检查索引
        print("2. 检查必要的索引")
        print("-" * 80)
        
        required_indexes = [
            ("ext_eng_db_current", "idx_doc_type", "(document_number, type_of_dates(50))"),
            ("ext_eng_db_previous", "idx_doc_type", "(document_number, type_of_dates(50))"),
            ("ext_eng_db_current", "idx_document_number", "(document_number)"),
            ("ext_eng_db_previous", "idx_document_number", "(document_number)"),
        ]
        
        missing_indexes = []
        for table, idx_name, cols in required_indexes:
            try:
                result = conn.execute(text("""
                    SELECT COUNT(*) as cnt FROM information_schema.statistics 
                    WHERE table_schema = DATABASE() 
                    AND table_name = :table_name
                    AND index_name = :idx_name
                """), {"table_name": table, "idx_name": idx_name})
                exists = result.scalar() > 0
                
                if exists:
                    print(f"   ✅ {table}.{idx_name} 存在")
                else:
                    print(f"   ❌ {table}.{idx_name} 缺失 (需要: {cols})")
                    missing_indexes.append((table, idx_name, cols))
            except Exception as e:
                print(f"   ⚠️  检查 {table}.{idx_name} 时出错: {e}")
        
        print()
        
        # 3. 检查是否有正在运行的查询
        print("3. 检查是否有正在运行的查询")
        print("-" * 80)
        try:
            result = conn.execute(text("""
                SELECT 
                    id, user, host, db, command, time, state, info
                FROM information_schema.processlist
                WHERE command != 'Sleep' 
                AND db = DATABASE()
                AND (info LIKE '%mdr_delta_cache%' OR info LIKE '%ext_eng_db%')
                ORDER BY time DESC
            """))
            processes = result.fetchall()
            
            if processes:
                print(f"   ⚠️  发现 {len(processes)} 个相关查询正在运行:")
                for p in processes:
                    print(f"      - ID: {p[0]}, 用户: {p[1]}, 运行时间: {p[5]}秒")
                    print(f"        状态: {p[6]}")
                    if p[7]:
                        print(f"        SQL: {p[7][:200]}")
            else:
                print("   ✅ 当前没有相关查询在运行")
        except Exception as e:
            print(f"   ⚠️  检查进程列表失败: {e}")
        
        print()
        
        # 4. 检查同步状态
        print("4. 检查MDR同步状态")
        print("-" * 80)
        try:
            result = conn.execute(text("""
                SELECT id, sync_time, status, message, processed_count, total_count
                FROM mdr_sync_log
                WHERE status = 'running'
                ORDER BY sync_time DESC
                LIMIT 1
            """))
            running = result.fetchone()
            
            if running:
                print(f"   ⏳ 发现正在运行的同步任务:")
                print(f"      - ID: {running[0]}")
                print(f"      - 开始时间: {running[1]}")
                print(f"      - 消息: {running[3]}")
                if running[4] and running[5]:
                    progress = (running[4] / running[5] * 100) if running[5] > 0 else 0
                    print(f"      - 进度: {running[4]:,} / {running[5]:,} ({progress:.1f}%)")
                
                # 计算运行时长
                if running[1]:
                    if isinstance(running[1], str):
                        start_time = datetime.fromisoformat(running[1].replace('Z', '+00:00'))
                    else:
                        start_time = running[1]
                    
                    now = datetime.now()
                    if hasattr(start_time, 'replace'):
                        start_time = start_time.replace(tzinfo=None)
                    time_diff = now - start_time
                    
                    hours = time_diff.seconds // 3600
                    minutes = (time_diff.seconds % 3600) // 60
                    
                    if time_diff.days > 0:
                        print(f"      - 已运行: {time_diff.days} 天 {hours} 小时 {minutes} 分钟")
                    elif hours > 0:
                        print(f"      - 已运行: {hours} 小时 {minutes} 分钟")
                    else:
                        print(f"      - 已运行: {minutes} 分钟")
                    
                    # 如果运行超过30分钟且消息是Delta Cache，可能卡住了
                    if time_diff.total_seconds() > 1800 and 'Delta Cache' in str(running[3]):
                        print(f"      ⚠️  警告: Delta Cache 计算已运行超过30分钟，可能卡住了！")
            else:
                print("   ✅ 当前没有正在运行的同步任务")
        except Exception as e:
            print(f"   ⚠️  检查同步状态失败: {e}")
        
        print()
        
        # 5. 建议
        print("5. 建议")
        print("-" * 80)
        if missing_indexes:
            print("   ❌ 缺少必要的索引，这会导致Delta Cache计算非常慢！")
            print("   建议运行以下命令添加索引:")
            print("   python backend/scripts/optimize_mdr_indexes.py")
            print()
        
        if curr_count and curr_count > 1000000:
            print("   ⚠️  数据量很大，Delta Cache计算可能需要较长时间（5-15分钟）")
            print("   如果卡住超过30分钟，建议:")
            print("   1. 检查是否有数据库锁")
            print("   2. 运行 optimize_mdr_indexes.py 添加索引")
            print("   3. 如果仍然卡住，可能需要重启同步任务")
        
        print()
        print("=" * 80)

if __name__ == "__main__":
    try:
        check_delta_performance()
    except Exception as e:
        print(f"❌ 诊断失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
