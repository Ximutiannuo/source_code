"""
运行 P6 数据同步和 activity_summary 计算的脚本

用法:
    # 同步所有项目
    python run_sync_and_calculate.py
    
    # 同步指定项目
    python run_sync_and_calculate.py --project-ids UIOPRJ ECUPRJ PELPRJ
    
    # 指定并发数
    python run_sync_and_calculate.py --project-ids UIOPRJ ECUPRJ --max-workers 3
    
    # 清空表后重新同步（调试模式）
    python run_sync_and_calculate.py --clear
"""
import sys
from pathlib import Path
import time
import traceback
import argparse
from datetime import datetime, timezone, timedelta
import threading

# GMT+3 时区
GMT3 = timezone(timedelta(hours=3))

# 添加项目根目录到路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

# 类型检查忽略：这些模块在运行时通过 sys.path 添加后可以导入
print(f"[INIT] 正在导入模块...")
print(f"[INIT] 导入 app.database.SessionLocal...")
from app.database import SessionLocal  # type: ignore
print(f"[INIT] ✓ SessionLocal 导入成功")

print(f"[INIT] 导入 app.p6_sync.services.raw_data_sync_direct...")
from app.p6_sync.services.raw_data_sync_direct import sync_all_p6_entities, clear_all_p6_tables  # type: ignore
print(f"[INIT] ✓ sync_all_p6_entities, clear_all_p6_tables 导入成功")

print(f"[INIT] 导入 app.p6_sync.services.delete_detection_service...")
from app.p6_sync.services.delete_detection_service import DeleteDetectionService  # type: ignore
print(f"[INIT] ✓ DeleteDetectionService 导入成功")

# 导入 refresh_activity_summary_sql 函数
# 由于 refresh_activity_summary_sql.py 在 scripts 目录下，需要直接导入
print(f"[INIT] 正在导入 refresh_activity_summary_sql 模块...")
import importlib.util
refresh_activity_summary_sql_path = project_root / "backend" / "scripts" / "refresh_activity_summary_sql.py"
if not refresh_activity_summary_sql_path.exists():
    print(f"[INIT] ❌ 错误: 找不到文件 {refresh_activity_summary_sql_path}")
    sys.exit(1)
spec = importlib.util.spec_from_file_location("refresh_activity_summary_sql", refresh_activity_summary_sql_path)
refresh_module = importlib.util.module_from_spec(spec)
print(f"[INIT] 正在执行 refresh_activity_summary_sql 模块...")
spec.loader.exec_module(refresh_module)
refresh_activity_summary_sql = refresh_module.refresh_activity_summary_sql
print(f"[INIT] ✓ refresh_activity_summary_sql 函数导入成功")
print(f"[INIT] 所有模块导入完成\n")


def log_with_timestamp(message: str, level: str = "INFO"):
    """带时间戳的日志输出（GMT+3时区）"""
    # 使用GMT+3时区
    timestamp = datetime.now(GMT3).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp} GMT+3] [{level}] {message}")


def start_heartbeat(stop_event: threading.Event, interval: int = 60):
    """启动心跳日志线程，定期输出进度信息"""
    def heartbeat():
        start_time = time.time()
        while not stop_event.is_set():
            time.sleep(interval)
            if not stop_event.is_set():
                elapsed = time.time() - start_time
                log_with_timestamp(f"⏳ 仍在运行中... (已运行 {elapsed:.0f} 秒)", "HEARTBEAT")
    
    thread = threading.Thread(target=heartbeat, daemon=True)
    thread.start()
    return thread


def main():
    """主函数：依次运行 P6 数据同步和 activity_summary 计算"""
    # 解析命令行参数
    parser = argparse.ArgumentParser(
        description='运行 P6 数据同步和 activity_summary 计算',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 同步所有项目
  python run_sync_and_calculate.py
  
  # 同步指定项目
  python run_sync_and_calculate.py --project-ids UIOPRJ ECUPRJ PELPRJ ITFPRJ TSFPRJ
  
  # 指定并发数
  python run_sync_and_calculate.py --project-ids UIOPRJ ECUPRJ --max-workers 3
  
  # 清空表后重新同步（调试模式）
  python run_sync_and_calculate.py --clear
  
  # 执行删除检测
  python run_sync_and_calculate.py --project-ids UIOPRJ ECUPRJ PELPRJ ITFPRJ TSFPRJ --detect
  
  # 执行删除检测（指定实体类型）
  python run_sync_and_calculate.py --project-ids UIOPRJ --detect --entity-types activity wbs
        """
    )
    parser.add_argument('--project-ids', type=str, nargs='+', 
                       help='项目ID列表（可选，例如: --project-ids UIOPRJ ECUPRJ PELPRJ）。如果不指定，则同步所有项目')
    parser.add_argument('--max-workers', type=int, default=None,
                       help='最大并发数（可选，默认：项目数，最大5。例如: --max-workers 3）')
    parser.add_argument('--clear', action='store_true',
                       help='清空所有P6表后重新同步（调试模式，默认：增量更新）')
    parser.add_argument('--skip-sync', action='store_true',
                       help='跳过P6数据同步，只执行activity_summary计算')
    parser.add_argument('--skip-calc', action='store_true',
                       help='跳过activity_summary计算，只执行P6数据同步')
    parser.add_argument('--detect', action='store_true',
                       help='执行删除检测（检测P6中已删除的实体并标记为is_active=0）')
    parser.add_argument('--entity-types', type=str, nargs='+', default=None,
                       help='实体类型列表（仅用于--detect，例如: --entity-types activity wbs）。如果不指定，则检测所有类型')
    
    args = parser.parse_args()
    
    # 显示参数信息
    log_with_timestamp("=" * 60, "START")
    if args.detect:
        log_with_timestamp("开始运行：P6 删除检测", "START")
    else:
        log_with_timestamp("开始运行：P6 数据同步 + activity_summary 计算", "START")
    log_with_timestamp("=" * 60, "START")
    if args.project_ids:
        log_with_timestamp(f"指定项目: {', '.join(args.project_ids)}", "CONFIG")
    else:
        log_with_timestamp("项目范围: 所有项目", "CONFIG")
    if args.max_workers:
        log_with_timestamp(f"并发数: {args.max_workers}", "CONFIG")
    if args.detect:
        log_with_timestamp("⚠️  模式: 删除检测", "CONFIG")
        if args.entity_types:
            log_with_timestamp(f"指定实体类型: {', '.join(args.entity_types)}", "CONFIG")
        else:
            log_with_timestamp("实体类型: 所有类型", "CONFIG")
    if args.clear:
        log_with_timestamp("⚠️  调试模式: 将清空所有P6数据表后重新同步", "CONFIG")
    if args.skip_sync:
        log_with_timestamp("⚠️  跳过P6数据同步", "CONFIG")
    if args.skip_calc:
        log_with_timestamp("⚠️  跳过activity_summary计算", "CONFIG")
    log_with_timestamp("=" * 60, "START")
    
    log_with_timestamp("正在初始化数据库连接...", "INIT")
    db = SessionLocal()
    log_with_timestamp("✓ 数据库连接已建立", "INIT")
    total_start_time = time.time()
    
    try:
        # 如果指定了 --detect，执行删除检测
        if args.detect:
            log_with_timestamp("\n" + "=" * 60, "STEP")
            log_with_timestamp("执行删除检测", "STEP")
            log_with_timestamp("=" * 60, "STEP")
            log_with_timestamp("⚠️  此步骤可能需要较长时间，请耐心等待...", "STEP")
            log_with_timestamp("正在调用 DeleteDetectionService.detect_and_mark_deleted_entities()...", "STEP")
            
            # 启动心跳日志
            heartbeat_stop = threading.Event()
            heartbeat_thread = start_heartbeat(heartbeat_stop, interval=120)  # 每2分钟输出一次心跳
            log_with_timestamp("✓ 心跳日志已启动（每2分钟输出一次进度）", "HEARTBEAT")
            
            try:
                # 创建删除检测服务
                service = DeleteDetectionService()
                
                # 执行删除检测
                result = service.detect_and_mark_deleted_entities(
                    project_ids=args.project_ids,
                    entity_types=args.entity_types,
                    db=db
                )
            finally:
                # 停止心跳日志
                heartbeat_stop.set()
                heartbeat_thread.join(timeout=1)
                log_with_timestamp("✓ 心跳日志已停止", "HEARTBEAT")
            
            total_time = time.time() - total_start_time
            log_with_timestamp(f"detect_and_mark_deleted_entities() 调用完成 (耗时: {total_time:.2f}秒)", "STEP")
            
            if not result.get('success'):
                log_with_timestamp(f"❌ 删除检测失败: {result.get('error', '未知错误')}", "ERROR")
                return {
                    'success': False,
                    'error': f"删除检测失败: {result.get('error', '未知错误')}"
                }
            
            # 显示结果
            log_with_timestamp("✅ 删除检测完成", "SUCCESS")
            if result.get('total_deleted'):
                log_with_timestamp(f"   - 标记删除数: {result.get('total_deleted')} 条", "INFO")
            if result.get('duration'):
                log_with_timestamp(f"   - 总耗时: {result.get('duration'):.2f}秒", "INFO")
            if result.get('results'):
                log_with_timestamp("   - 详细结果:", "INFO")
                for key, value in result.get('results', {}).items():
                    if isinstance(value, dict) and value.get('deleted_count', 0) > 0:
                        log_with_timestamp(f"     * {key}: {value.get('deleted_count')} 条", "INFO")
            
            # 总结
            log_with_timestamp("\n" + "=" * 60, "SUMMARY")
            log_with_timestamp("删除检测完成！", "SUMMARY")
            log_with_timestamp("=" * 60, "SUMMARY")
            log_with_timestamp(f"总耗时: {total_time:.2f}秒 ({total_time/60:.2f}分钟)", "SUMMARY")
            log_with_timestamp(f"标记删除数: {result.get('total_deleted', 0)} 条", "SUMMARY")
            log_with_timestamp("=" * 60, "SUMMARY")
            
            return {
                'success': True,
                'total_time': total_time,
                'total_deleted': result.get('total_deleted', 0)
            }
        
        # 如果指定了 --clear，先清空所有P6表
        if args.clear and not args.skip_sync:
            log_with_timestamp("\n" + "=" * 60, "STEP")
            log_with_timestamp("步骤 0: 清空所有P6数据表", "STEP")
            log_with_timestamp("=" * 60, "STEP")
            log_with_timestamp("正在调用 clear_all_p6_tables()...", "STEP")
            clear_start = time.time()
            clear_result = clear_all_p6_tables(db)
            clear_time = time.time() - clear_start
            log_with_timestamp(f"clear_all_p6_tables() 调用完成 (耗时: {clear_time:.2f}秒)", "STEP")
            
            if not clear_result.get('success'):
                log_with_timestamp(f"❌ 清空表失败: {clear_result.get('error', '未知错误')}", "ERROR")
                return {
                    'success': False,
                    'error': f"清空表失败: {clear_result.get('error', '未知错误')}"
                }
            log_with_timestamp("✅ 所有P6数据表已清空", "SUCCESS")
            log_with_timestamp("等待3秒后开始同步...", "WAIT")
            time.sleep(3)
            log_with_timestamp("等待完成，开始同步", "WAIT")
        
        sync_result = None
        sync_time = 0
        
        # 步骤 1: 同步 P6 数据（如果未跳过）
        if not args.skip_sync:
            log_with_timestamp("\n" + "=" * 60, "STEP")
            log_with_timestamp("步骤 1: 同步 P6 数据", "STEP")
            log_with_timestamp("=" * 60, "STEP")
            log_with_timestamp("⚠️  此步骤可能需要较长时间，请耐心等待...", "STEP")
            log_with_timestamp("正在调用 sync_all_p6_entities()...", "STEP")
            sync_start_time = time.time()
            
            # 启动心跳日志
            heartbeat_stop = threading.Event()
            heartbeat_thread = start_heartbeat(heartbeat_stop, interval=120)  # 每2分钟输出一次心跳
            log_with_timestamp("✓ 心跳日志已启动（每2分钟输出一次进度）", "HEARTBEAT")
            
            try:
                sync_result = sync_all_p6_entities(
                    project_ids=args.project_ids, 
                    max_workers=args.max_workers
                )
            finally:
                # 停止心跳日志
                heartbeat_stop.set()
                heartbeat_thread.join(timeout=1)
                log_with_timestamp("✓ 心跳日志已停止", "HEARTBEAT")
            
            sync_time = time.time() - sync_start_time
            log_with_timestamp(f"sync_all_p6_entities() 调用完成 (耗时: {sync_time:.2f}秒)", "STEP")
            
            if not sync_result.get('success'):
                log_with_timestamp(f"❌ P6 数据同步失败: {sync_result.get('error', '未知错误')}", "ERROR")
                return {
                    'success': False,
                    'error': f"P6 数据同步失败: {sync_result.get('error', '未知错误')}"
                }
            
            log_with_timestamp("✅ P6 数据同步完成", "SUCCESS")
            if sync_result.get('total_time'):
                log_with_timestamp(f"   - 总耗时: {sync_result.get('total_time'):.2f}秒", "INFO")
            if sync_result.get('projects_synced'):
                log_with_timestamp(f"   - 同步项目数: {sync_result.get('projects_synced')}", "INFO")
        else:
            log_with_timestamp("\n⚠️  跳过P6数据同步步骤", "SKIP")
        
        # 步骤 2: 计算 activity_summary（如果未跳过）
        calc_result = None
        calc_time = 0
        
        if not args.skip_calc:
            log_with_timestamp("\n" + "=" * 60, "STEP")
            log_with_timestamp("步骤 2: 计算 activity_summary", "STEP")
            log_with_timestamp("=" * 60, "STEP")
            log_with_timestamp("⚠️  此步骤可能需要较长时间，请耐心等待...", "STEP")
            log_with_timestamp("正在调用 refresh_activity_summary_sql()...", "STEP")
            calc_start_time = time.time()
            
            # 启动心跳日志
            heartbeat_stop = threading.Event()
            heartbeat_thread = start_heartbeat(heartbeat_stop, interval=60)  # 每1分钟输出一次心跳
            log_with_timestamp("✓ 心跳日志已启动（每1分钟输出一次进度）", "HEARTBEAT")
            
            try:
                calc_result = refresh_activity_summary_sql(is_clear_mode=args.clear)
            finally:
                # 停止心跳日志
                heartbeat_stop.set()
                heartbeat_thread.join(timeout=1)
                log_with_timestamp("✓ 心跳日志已停止", "HEARTBEAT")
            
            calc_time = time.time() - calc_start_time
            log_with_timestamp(f"refresh_activity_summary_sql() 调用完成 (耗时: {calc_time:.2f}秒)", "STEP")
            
            if not calc_result.get('success'):
                log_with_timestamp(f"❌ activity_summary 计算失败: {calc_result.get('error', '未知错误')}", "ERROR")
                return {
                    'success': False,
                    'error': f"activity_summary 计算失败: {calc_result.get('error', '未知错误')}"
                }
            
            log_with_timestamp("✅ activity_summary 计算完成", "SUCCESS")
        else:
            log_with_timestamp("\n⚠️  跳过activity_summary计算步骤", "SKIP")
        
        # 总结
        total_time = time.time() - total_start_time
        log_with_timestamp("\n" + "=" * 60, "SUMMARY")
        log_with_timestamp("所有操作完成！", "SUMMARY")
        log_with_timestamp("=" * 60, "SUMMARY")
        log_with_timestamp(f"总耗时: {total_time:.2f}秒 ({total_time/60:.2f}分钟)", "SUMMARY")
        if not args.skip_sync:
            log_with_timestamp(f"  - P6 数据同步: {sync_time:.2f}秒 ({sync_time/60:.2f}分钟)", "SUMMARY")
        if not args.skip_calc:
            log_with_timestamp(f"  - activity_summary 计算: {calc_time:.2f}秒 ({calc_time/60:.2f}分钟)", "SUMMARY")
        log_with_timestamp("=" * 60, "SUMMARY")
        
        return {
            'success': True,
            'total_time': total_time,
            'sync_time': sync_time,
            'calc_time': calc_time
        }
        
    except KeyboardInterrupt:
        log_with_timestamp("\n⚠️ 用户中断操作", "INTERRUPT")
        return {
            'success': False,
            'error': '用户中断'
        }
    except Exception as e:
        log_with_timestamp(f"\n❌ 执行异常: {e}", "ERROR")
        log_with_timestamp(f"详细信息: {traceback.format_exc()}", "ERROR")
        return {
            'success': False,
            'error': str(e)
        }
    finally:
        log_with_timestamp("正在关闭数据库连接...", "CLEANUP")
        db.close()
        log_with_timestamp("✓ 数据库连接已关闭", "CLEANUP")


if __name__ == "__main__":
    result = main()
    sys.exit(0 if result.get('success') else 1)

