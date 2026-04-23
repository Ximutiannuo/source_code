"""
测试 WeldingList 到 VFACTDB 的数据转换逻辑
用于验证处理逻辑是否正确
"""
import sys
from pathlib import Path
from datetime import date, timedelta

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from app.database import SessionLocal
from app.services.welding_sync_service import WeldingSyncService
from app.models.report import VFACTDB
from sqlalchemy import func

def test_welding_sync_logic():
    """测试焊接数据同步逻辑"""
    db = SessionLocal()
    
    try:
        print("="*60)
        print("WeldingList 到 VFACTDB 数据转换逻辑测试")
        print("="*60)
        
        # 1. 检查配置数据
        print("\n1. 检查配置数据...")
        from app.models.welding_config import WeldingMarkaCode, WeldingConstContractorMapping, WeldingNonStandardDrawing
        
        marka_count = db.query(func.count(WeldingMarkaCode.id)).scalar()
        mapping_count = db.query(func.count(WeldingConstContractorMapping.id)).scalar()
        non_standard_count = db.query(func.count(WeldingNonStandardDrawing.id)).scalar()
        
        print(f"  ✓ Marka代码配置: {marka_count} 条")
        print(f"  ✓ ConstContractor映射: {mapping_count} 条")
        print(f"  ✓ 非标准图纸: {non_standard_count} 条")
        
        if marka_count == 0:
            print("  ⚠️  警告：Marka代码配置为空，可能无法正确筛选数据")
        if mapping_count == 0:
            print("  ⚠️  警告：ConstContractor映射为空，将使用ConstContractor本身作为Scope")
        
        # 2. 测试读取WeldingList数据（不实际同步）
        print("\n2. 测试读取WeldingList数据...")
        welding_sync_service = WeldingSyncService(db=db)
        
        # 测试读取全部时间段的数据（不传日期参数）
        print(f"  测试模式: 全部时间段（所有数据）")
        print(f"  开始时间: {date.today()}")
        
        import time
        start_time = time.time()
        
        # 先测试原始查询有多少条记录
        print("\n  2.1 测试原始查询...")
        from app.database_precomcontrol import PrecomcontrolSessionLocal
        from sqlalchemy import text
        precomcontrol_db = PrecomcontrolSessionLocal()
        try:
            raw_query = text("""
                SELECT COUNT(*) 
                FROM WeldingList
                WHERE WeldDate IS NOT NULL
                AND WeldJoint IS NOT NULL
                AND WeldJoint NOT LIKE '%CW%'
                AND WeldJoint NOT LIKE '%R%'
                AND JointTypeFS IN ('S', 'F')
                AND (IsDeleted IS NULL OR IsDeleted = 0)
            """)
            raw_count = precomcontrol_db.execute(raw_query).scalar()
            print(f"    ✓ 原始记录数（符合基本筛选条件）: {raw_count:,} 条")
        finally:
            precomcontrol_db.close()
        
        print("\n  2.2 开始处理数据（这可能需要较长时间）...")
        read_result = welding_sync_service._read_welding_list_data()
        # read_result是字典，包含welding_data和unprocessed_drawings
        welding_data = read_result.get('welding_data', [])
        unprocessed_drawings = read_result.get('unprocessed_drawings', [])
        
        elapsed_time = time.time() - start_time
        print(f"\n  ✓ 处理完成，耗时: {elapsed_time:.2f} 秒")
        print(f"  ✓ 读取到 {len(welding_data):,} 条处理后的数据")
        
        if len(welding_data) > 0:
            print("\n  示例数据（前3条）：")
            for i, item in enumerate(welding_data[:3], 1):
                print(f"    {i}. 日期={item['weld_date']}, Block={item['block']}, Marka={item['marka']}, "
                      f"Scope={item['scope']}, WorkPackage={item['work_package']}, Achieved={item['achieved']}")
        
        # 3. 测试Activity匹配
        print("\n3. 测试Activity匹配...")
        if len(welding_data) > 0:
            test_item = welding_data[0]
            activity = welding_sync_service._match_activity_by_title(
                db,
                test_item['block'],
                test_item['marka'],
                test_item['scope'],
                test_item['work_package']
            )
            
            if activity:
                print(f"  ✓ 成功匹配Activity: {activity.activity_id}")
                print(f"    Title: {activity.title}")
            else:
                print(f"  ⚠️  未找到匹配的Activity")
                print(f"    查找条件: block={test_item['block']}, marka={test_item['marka']}, "
                      f"scope={test_item['scope']}, work_package={test_item['work_package']}")
        
        # 4. 统计当前VFACTDB中的PI04/PI05数据
        print("\n4. 统计当前VFACTDB中的PI04/PI05数据...")
        pi04_count = db.query(func.count(VFACTDB.id)).filter(VFACTDB.work_package == 'PI04').scalar()
        pi05_count = db.query(func.count(VFACTDB.id)).filter(VFACTDB.work_package == 'PI05').scalar()
        
        print(f"  ✓ PI04记录数: {pi04_count}")
        print(f"  ✓ PI05记录数: {pi05_count}")
        print(f"  ✓ 总计: {pi04_count + pi05_count}")
        
        # 5. 无法处理的图纸统计
        if unprocessed_drawings:
            print(f"\n5. 无法处理的图纸统计...")
            print(f"  ⚠️  无法处理的图纸数量: {len(unprocessed_drawings)}")
            # 按原因分组统计
            by_reason = {}
            for item in unprocessed_drawings:
                reason = item.get('reason', '未知原因')
                by_reason[reason] = by_reason.get(reason, 0) + 1
            print(f"  按原因分组:")
            for reason, count in sorted(by_reason.items(), key=lambda x: x[1], reverse=True)[:10]:
                print(f"    - {reason}: {count} 条")
        
        # 6. 数据分组统计
        print("\n6. 数据分组统计...")
        if len(welding_data) > 0:
            by_date = {}
            by_work_package = {'PI04': 0, 'PI05': 0}
            by_scope = {}
            
            for item in welding_data:
                # 按日期统计
                date_str = item['weld_date'].isoformat()
                by_date[date_str] = by_date.get(date_str, 0) + 1
                
                # 按work_package统计
                by_work_package[item['work_package']] += 1
                
                # 按scope统计
                scope = item['scope']
                by_scope[scope] = by_scope.get(scope, 0) + 1
            
            print(f"  按日期分布（前5个日期）：")
            for date_str, count in sorted(by_date.items(), key=lambda x: x[1], reverse=True)[:5]:
                print(f"    {date_str}: {count} 条")
            
            print(f"  按WorkPackage分布：")
            for wp, count in by_work_package.items():
                print(f"    {wp}: {count} 条")
            
            print(f"  按Scope分布（前5个）：")
            for scope, count in sorted(by_scope.items(), key=lambda x: x[1], reverse=True)[:5]:
                print(f"    {scope}: {count} 条")
        
        print("\n" + "="*60)
        print("测试完成！")
        print("="*60)
        print("\n如果要实际同步数据，请调用：")
        print("  POST /api/reports/vfactdb/sync-welding")
        print("或在前端点击'同步PI04/PI05'按钮")
        
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_welding_sync_logic()

