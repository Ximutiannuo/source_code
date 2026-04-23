"""
数据库字段名迁移检查脚本

检查所有表的字段名是否符合 column_names_mapping.md 的要求：
1. 检查字段名是否正确重命名
2. 检查外键约束是否正确
3. 检查索引是否正确创建
"""

import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import text
from app.database import engine, SessionLocal
from datetime import datetime

# 期望的字段映射（表名 -> {旧字段名: 新字段名}）
EXPECTED_MAPPINGS = {
    'activities': {
        'act_id': 'activity_id',
        'act_description': 'title',
    },
    'mpdb': {
        'gcc_block': 'block',
        'gcc_scope': 'scope',
        'gcc_discipline': 'discipline',
        'gcc_workpackage': 'work_package',
        'gcc_project': 'project',
        'gcc_subproject': 'subproject',
        'gcc_phase': 'implement_phase',
        'gcc_train': 'train',
        'gcc_unit': 'unit',
        'bcc_quarter': 'quarter',
        'activity_description': 'title',
    },
    'vfactdb': {
        'gcc_block': 'block',
        'gcc_scope': 'scope',
        'gcc_discipline': 'discipline',
        'gcc_workpackage': 'work_package',
        'gcc_project': 'project',
        'gcc_subproject': 'subproject',
        'gcc_phase': 'implement_phase',
        'gcc_train': 'train',
        'gcc_unit': 'unit',
        'bcc_quarter': 'quarter',
        'gcc_description': 'title',
    },
    'activity_summary': {
        'workpackage': 'work_package',
        'subproject_code': 'subproject',
        'phase': 'implement_phase',
        'bcc_work_package': 'contract_phase',
        'bcc_quarter': 'quarter',
        'gcc_simpblk': 'simple_block',
        'bcc_startup_sequence': 'start_up_sequence',
    },
    'facilities': {
        'subproject_code': 'subproject',
        'bcc_quarter': 'quarter',
        'bcc_startup_sequence': 'start_up_sequence',
    },
}

# 期望的外键约束
EXPECTED_FOREIGN_KEYS = [
    ('mpdb', 'activity_id', 'activities', 'activity_id'),
    ('vfactdb', 'activity_id', 'activities', 'activity_id'),
    ('volume_controls', 'activity_id', 'activities', 'activity_id'),
]

# 期望的索引
EXPECTED_INDEXES = [
    ('activities', 'idx_activities_activity_id', ['activity_id']),
    ('mpdb', 'idx_mpdb_date_activity_id', ['date', 'activity_id']),
    ('mpdb', 'idx_mpdb_block', ['block']),
    ('mpdb', 'idx_mpdb_discipline', ['discipline']),
    ('mpdb', 'idx_mpdb_work_package', ['work_package']),
    ('vfactdb', 'idx_vfactdb_date_activity_id', ['date', 'activity_id']),
    ('vfactdb', 'idx_vfactdb_block', ['block']),
    ('vfactdb', 'idx_vfactdb_discipline', ['discipline']),
    ('vfactdb', 'idx_vfactdb_work_package', ['work_package']),
    ('activity_summary', 'idx_activity_summary_subproject', ['subproject']),
    ('activity_summary', 'idx_activity_summary_work_package', ['work_package']),
    ('facilities', 'idx_facilities_subproject', ['subproject']),
]

def get_table_columns(db, table_name):
    """获取表的所有字段"""
    sql = f"""
    SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = '{table_name}'
    ORDER BY ORDINAL_POSITION
    """
    result = db.execute(text(sql)).fetchall()
    return {row[0]: {'type': row[1], 'full_type': row[2], 'nullable': row[3], 'key': row[4]} for row in result}

def check_field_renames(db):
    """检查字段重命名"""
    print("\n" + "=" * 60)
    print("检查字段重命名")
    print("=" * 60)
    
    all_passed = True
    
    for table_name, mappings in EXPECTED_MAPPINGS.items():
        print(f"\n检查表: {table_name}")
        columns = get_table_columns(db, table_name)
        
        if not columns:
            print(f"  [错误] 表 {table_name} 不存在或无法访问")
            all_passed = False
            continue
        
        for old_field, new_field in mappings.items():
            # 检查旧字段是否还存在
            if old_field in columns:
                print(f"  [失败] 旧字段 {old_field} 仍然存在，应该重命名为 {new_field}")
                all_passed = False
            # 检查新字段是否存在
            elif new_field not in columns:
                print(f"  [失败] 新字段 {new_field} 不存在（应该从 {old_field} 重命名）")
                all_passed = False
            else:
                print(f"  [通过] {old_field} -> {new_field}")
    
    return all_passed

def check_foreign_keys(db):
    """检查外键约束"""
    print("\n" + "=" * 60)
    print("检查外键约束")
    print("=" * 60)
    
    all_passed = True
    
    for table_name, column_name, ref_table, ref_column in EXPECTED_FOREIGN_KEYS:
        sql = f"""
        SELECT 
            CONSTRAINT_NAME,
            REFERENCED_TABLE_NAME,
            REFERENCED_COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = '{table_name}'
        AND COLUMN_NAME = '{column_name}'
        AND REFERENCED_TABLE_NAME IS NOT NULL
        """
        result = db.execute(text(sql)).fetchall()
        
        if not result:
            print(f"  [失败] {table_name}.{column_name} 没有外键约束")
            all_passed = False
        else:
            found = False
            for row in result:
                if row[1] == ref_table and row[2] == ref_column:
                    print(f"  [通过] {table_name}.{column_name} -> {ref_table}.{ref_column} ({row[0]})")
                    found = True
                    break
            if not found:
                print(f"  [失败] {table_name}.{column_name} 外键引用不正确")
                print(f"         期望: {ref_table}.{ref_column}")
                print(f"         实际: {result[0][1]}.{result[0][2]}")
                all_passed = False
    
    return all_passed

def check_indexes(db):
    """检查索引"""
    print("\n" + "=" * 60)
    print("检查索引")
    print("=" * 60)
    
    all_passed = True
    
    for table_name, index_name, columns in EXPECTED_INDEXES:
        sql = f"""
        SELECT 
            INDEX_NAME,
            GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) as COLUMNS
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = '{table_name}'
        AND INDEX_NAME = '{index_name}'
        GROUP BY INDEX_NAME
        """
        result = db.execute(text(sql)).fetchone()
        
        if not result:
            print(f"  [失败] 索引 {table_name}.{index_name} 不存在")
            all_passed = False
        else:
            actual_columns = set(result[1].split(','))
            expected_columns = set(columns)
            if actual_columns == expected_columns:
                print(f"  [通过] {table_name}.{index_name} ({', '.join(columns)})")
            else:
                print(f"  [失败] {table_name}.{index_name} 列不匹配")
                print(f"         期望: {', '.join(expected_columns)}")
                print(f"         实际: {', '.join(actual_columns)}")
                all_passed = False
    
    return all_passed

def check_old_fields_removed(db):
    """检查旧字段是否已完全移除"""
    print("\n" + "=" * 60)
    print("检查旧字段是否已移除")
    print("=" * 60)
    
    all_passed = True
    
    # 检查所有表，确保没有遗留的旧字段名
    old_field_patterns = [
        'gcc_', 'bcc_', 'act_id', 'act_description', 
        'workpackage', 'subproject_code', 'bcc_startup_sequence'
    ]
    
    sql = """
    SELECT TABLE_NAME, COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND (
        COLUMN_NAME LIKE 'gcc_%' 
        OR COLUMN_NAME LIKE 'bcc_%'
        OR COLUMN_NAME = 'act_id'
        OR COLUMN_NAME = 'act_description'
        OR COLUMN_NAME = 'workpackage'
        OR COLUMN_NAME = 'subproject_code'
    )
    AND TABLE_NAME IN ('activities', 'mpdb', 'vfactdb', 'activity_summary', 'facilities')
    ORDER BY TABLE_NAME, COLUMN_NAME
    """
    
    result = db.execute(text(sql)).fetchall()
    
    if result:
        print("  [警告] 发现以下可能遗留的旧字段:")
        for table_name, column_name in result:
            # 检查是否在允许保留的字段列表中
            allowed_old_fields = ['bcc_kq_code', 'bcc_startup_sequence']  # 这些字段可能在其他表中
            if column_name not in allowed_old_fields:
                print(f"    {table_name}.{column_name}")
                all_passed = False
        if all_passed:
            print("  [通过] 所有检查的字段都已正确迁移")
    else:
        print("  [通过] 没有发现遗留的旧字段")
    
    return all_passed

def check_table_structure(db):
    """检查表结构完整性"""
    print("\n" + "=" * 60)
    print("检查表结构完整性")
    print("=" * 60)
    
    tables_to_check = ['activities', 'mpdb', 'vfactdb', 'activity_summary', 'facilities', 'volume_controls']
    all_passed = True
    
    for table_name in tables_to_check:
        columns = get_table_columns(db, table_name)
        if not columns:
            print(f"  [失败] 表 {table_name} 不存在")
            all_passed = False
        else:
            # 检查关键字段是否存在
            key_fields = {
                'activities': ['id', 'activity_id', 'title', 'contract_phase'],
                'mpdb': ['id', 'activity_id', 'scope', 'block', 'discipline', 'work_package', 'implement_phase', 'quarter', 'title'],
                'vfactdb': ['id', 'activity_id', 'scope', 'block', 'discipline', 'work_package', 'implement_phase', 'quarter', 'title'],
                'activity_summary': ['id', 'activity_id', 'work_package', 'subproject', 'implement_phase', 'contract_phase', 'quarter', 'simple_block', 'start_up_sequence'],
                'facilities': ['id', 'subproject', 'quarter', 'start_up_sequence'],
                'volume_controls': ['id', 'activity_id'],
            }
            
            required_fields = key_fields.get(table_name, [])
            missing_fields = [f for f in required_fields if f not in columns]
            
            if missing_fields:
                print(f"  [失败] 表 {table_name} 缺少字段: {', '.join(missing_fields)}")
                all_passed = False
            else:
                print(f"  [通过] 表 {table_name} 结构完整 ({len(columns)} 个字段)")
    
    return all_passed

def main():
    """主函数"""
    print("=" * 60)
    print("数据库字段名迁移检查")
    print("=" * 60)
    print(f"检查时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    db = SessionLocal()
    
    try:
        results = {}
        
        # 1. 检查字段重命名
        results['字段重命名'] = check_field_renames(db)
        
        # 2. 检查外键约束
        results['外键约束'] = check_foreign_keys(db)
        
        # 3. 检查索引
        results['索引'] = check_indexes(db)
        
        # 4. 检查旧字段是否移除
        results['旧字段移除'] = check_old_fields_removed(db)
        
        # 5. 检查表结构完整性
        results['表结构完整性'] = check_table_structure(db)
        
        # 汇总结果
        print("\n" + "=" * 60)
        print("检查结果汇总")
        print("=" * 60)
        
        all_passed = True
        for check_name, passed in results.items():
            status = "[通过]" if passed else "[失败]"
            print(f"{status} {check_name}")
            if not passed:
                all_passed = False
        
        print("\n" + "=" * 60)
        if all_passed:
            print("所有检查通过！数据库迁移成功完成。")
        else:
            print("部分检查未通过，请查看上述详细信息。")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n检查过程出错: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    main()

