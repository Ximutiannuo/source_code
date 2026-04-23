"""
检查MDR同步状态脚本
查询数据库中的mdr_sync_log表，查看最近的同步记录
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

def check_mdr_sync_status():
    """检查MDR同步状态"""
    print("=" * 80)
    print("MDR同步状态检查")
    print("=" * 80)
    print()
    
    with default_engine.connect() as conn:
        # 0. 首先检查是否有正在运行的同步
        print("=" * 80)
        print("检查是否有正在运行的同步")
        print("=" * 80)
        
        running_result = conn.execute(text("""
            SELECT 
                id,
                sync_time,
                status,
                total_count,
                processed_count,
                message
            FROM mdr_sync_log
            WHERE status = 'running'
            ORDER BY sync_time DESC
        """))
        
        running_records = running_result.fetchall()
        
        if running_records:
            print(f"⚠️  发现 {len(running_records)} 个正在运行的同步任务：\n")
            for record in running_records:
                print(f"  【运行中的同步 #{record[0]}】")
                print(f"    开始时间: {record[1]}")
                print(f"    总记录数: {record[3]:,}" if record[3] else "    总记录数: N/A")
                print(f"    已处理数: {record[4]:,}" if record[4] is not None else "    已处理数: N/A")
                if record[3] and record[4] is not None:
                    progress = (record[4] / record[3] * 100) if record[3] > 0 else 0
                    print(f"    进度: {progress:.1f}%")
                print(f"    消息: {record[5]}" if record[5] else "    消息: N/A")
                
                # 计算运行时长
                if record[1]:
                    if isinstance(record[1], str):
                        start_time = datetime.fromisoformat(record[1].replace('Z', '+00:00'))
                    elif hasattr(record[1], 'replace'):
                        start_time = record[1].replace(tzinfo=None)
                    else:
                        start_time = record[1]
                    
                    now = datetime.now()
                    if hasattr(start_time, 'replace'):
                        start_time = start_time.replace(tzinfo=None)
                    time_diff = now - start_time
                    
                    hours = time_diff.seconds // 3600
                    minutes = (time_diff.seconds % 3600) // 60
                    seconds = time_diff.seconds % 60
                    
                    if time_diff.days > 0:
                        print(f"    已运行: {time_diff.days} 天 {hours} 小时 {minutes} 分钟")
                    elif hours > 0:
                        print(f"    已运行: {hours} 小时 {minutes} 分钟 {seconds} 秒")
                    else:
                        print(f"    已运行: {minutes} 分钟 {seconds} 秒")
                print()
        else:
            print("✅ 当前没有正在运行的同步任务\n")
        
        print()
        
        # 1. 查询最近的同步记录
        result = conn.execute(text("""
            SELECT 
                id,
                sync_time,
                status,
                total_count,
                processed_count,
                message,
                duration_seconds
            FROM mdr_sync_log
            ORDER BY sync_time DESC
            LIMIT 10
        """))
        
        records = result.fetchall()
        
        if not records:
            print("❌ 未找到任何同步记录")
            print("   说明：可能从未执行过MDR同步")
            return
        
        print(f"找到 {len(records)} 条最近的同步记录：\n")
        
        for i, record in enumerate(records, 1):
            print(f"【记录 #{i}】")
            print(f"  同步ID: {record[0]}")
            print(f"  同步时间: {record[1]}")
            print(f"  状态: {record[2]}")
            print(f"  总记录数: {record[3]:,}" if record[3] else "  总记录数: N/A")
            print(f"  已处理数: {record[4]:,}" if record[4] is not None else "  已处理数: N/A")
            print(f"  耗时: {record[6]} 秒" if record[6] else "  耗时: N/A")
            print(f"  消息: {record[5]}" if record[5] else "  消息: N/A")
            print()
        
        # 2. 检查最新记录的状态
        latest = records[0]
        status = latest[2]
        sync_time = latest[1]
        
        print("=" * 80)
        print("最新同步状态分析")
        print("=" * 80)
        
        if status == 'success':
            print("✅ 最新同步状态: 成功")
            if latest[4] is not None and latest[3] is not None:
                progress = (latest[4] / latest[3] * 100) if latest[3] > 0 else 0
                print(f"   进度: {latest[4]:,} / {latest[3]:,} ({progress:.1f}%)")
            if latest[6]:
                print(f"   耗时: {latest[6]} 秒")
        elif status == 'running':
            print("⏳ 最新同步状态: 正在运行中")
            if latest[4] is not None and latest[3] is not None:
                progress = (latest[4] / latest[3] * 100) if latest[3] > 0 else 0
                print(f"   进度: {latest[4]:,} / {latest[3]:,} ({progress:.1f}%)")
        elif status == 'failed':
            print("❌ 最新同步状态: 失败")
            if latest[5]:
                print(f"   错误信息: {latest[5]}")
        else:
            print(f"⚠️  最新同步状态: {status} (未知状态)")
        
        # 计算距离现在的时间
        if sync_time:
            if isinstance(sync_time, str):
                sync_time = datetime.fromisoformat(sync_time.replace('Z', '+00:00'))
            elif hasattr(sync_time, 'replace'):
                sync_time = sync_time.replace(tzinfo=None)
            
            now = datetime.now()
            time_diff = now - sync_time
            
            days = time_diff.days
            hours = time_diff.seconds // 3600
            minutes = (time_diff.seconds % 3600) // 60
            
            print(f"   同步时间: {sync_time}")
            if days > 0:
                print(f"   距离现在: {days} 天 {hours} 小时 {minutes} 分钟")
            elif hours > 0:
                print(f"   距离现在: {hours} 小时 {minutes} 分钟")
            else:
                print(f"   距离现在: {minutes} 分钟")
        
        # 3. 检查数据表记录数
        print()
        print("=" * 80)
        print("数据表统计")
        print("=" * 80)
        
        try:
            # 检查当前表
            curr_result = conn.execute(text("SELECT COUNT(*) FROM ext_eng_db_current"))
            curr_count = curr_result.scalar()
            print(f"ext_eng_db_current (当前周数据): {curr_count:,} 条记录")
            
            # 检查历史表
            prev_result = conn.execute(text("SELECT COUNT(*) FROM ext_eng_db_previous"))
            prev_count = prev_result.scalar()
            print(f"ext_eng_db_previous (上周数据): {prev_count:,} 条记录")
            
            # 检查源表（如果可访问）
            try:
                source_result = conn.execute(text("SELECT COUNT(*) FROM ENG.ENGDB"))
                source_count = source_result.scalar()
                print(f"ENG.ENGDB (源表): {source_count:,} 条记录")
                
                if curr_count != source_count:
                    diff = abs(source_count - curr_count)
                    print(f"⚠️  警告: 当前表与源表记录数不一致，相差 {diff:,} 条")
                else:
                    print("✅ 当前表与源表记录数一致")
            except Exception as e:
                print(f"⚠️  无法访问源表 ENG.ENGDB: {e}")
            
        except Exception as e:
            print(f"❌ 查询数据表统计失败: {e}")
        
        print()
        print("=" * 80)

if __name__ == "__main__":
    try:
        check_mdr_sync_status()
    except Exception as e:
        print(f"❌ 检查失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
