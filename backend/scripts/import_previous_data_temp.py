"""
临时导入历史数据脚本 - 仅导入 MPDB 和 VFACTDB
设定 update_method='daily_report', is_system_sync=0, 并根据 SCOPE 匹配 updated_by
"""
import sys
import os
import argparse
from pathlib import Path
from datetime import datetime, timezone
from decimal import Decimal
from collections import defaultdict
import traceback
import csv
import tempfile
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import text

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from app.database import SessionLocal, engine
from app.models.report import MPDB, VFACTDB
from app.models.user import User, Role
from app.models.workstep import WorkStepDefine
from app.utils.russian_transliteration import clean_text

def clean_value(value):
    """清理值，处理NaN和空值"""
    if pd.isna(value):
        return None
    s = str(value).strip()
    return s if s != "" else None

# 旧的 clean_text 函数逻辑 (用于识别哪些数据被错误清洗了)
RUSSIAN_TO_LATIN = {
    'А': 'A', 'а': 'a', 'Б': 'B', 'б': 'b', 'В': 'V', 'в': 'v', 'Г': 'G', 'г': 'g',
    'Д': 'D', 'д': 'd', 'Е': 'E', 'е': 'e', 'Ё': 'Yo', 'ё': 'yo', 'Ж': 'Zh', 'ж': 'zh',
    'З': 'Z', 'з': 'z', 'И': 'I', 'и': 'i', 'Й': 'Y', 'й': 'y', 'К': 'K', 'к': 'k',
    'Л': 'L', 'л': 'l', 'М': 'M', 'м': 'm', 'Н': 'N', 'н': 'n', 'О': 'O', 'о': 'o',
    'П': 'P', 'п': 'p', 'Р': 'R', 'р': 'r', 'С': 'S', 'с': 's', 'Т': 'T', 'т': 't',
    'У': 'U', 'у': 'u', 'Ф': 'F', 'ф': 'f', 'Х': 'Kh', 'х': 'kh', 'Ц': 'Ts', 'ц': 'ts',
    'Ч': 'Ch', 'ч': 'ch', 'Ш': 'Sh', 'ш': 'sh', 'Щ': 'Shch', 'щ': 'shch', 'Ъ': '', 'ъ': '',
    'Ы': 'Y', 'ы': 'y', 'Ь': '', 'ь': '', 'Э': 'E', 'э': 'e', 'Ю': 'Yu', 'ю': 'yu',
    'Я': 'Ya', 'я': 'ya',
}

def clean_text_old(text_str: str) -> str:
    if not text_str: return text_str
    import re
    text_str = ''.join(RUSSIAN_TO_LATIN.get(char, char) for char in text_str)
    # 旧逻辑：移除了 / 和 &
    text_str = re.sub(r'[^\w\s\-.,;:()\[\]{}]', '', text_str)
    text_str = re.sub(r'\s+', ' ', text_str).strip()
    return text_str

# 全局 SCOPE -> User ID 映射缓存
_scope_user_cache = {}
# 工作步骤描述修复映射 (work_package, cleaned_desc) -> original_desc
_work_step_fix_map = {}

def load_work_step_fix_map(db: Session):
    """加载工作步骤描述修复映射"""
    global _work_step_fix_map
    defines = db.query(WorkStepDefine).all()
    for d in defines:
        if not d.work_step_description: continue
        cleaned = clean_text_old(d.work_step_description)
        if cleaned != d.work_step_description:
            _work_step_fix_map[(d.work_package, cleaned)] = d.work_step_description
    print(f"  加载了 {len(_work_step_fix_map)} 条工作步骤描述修复映射")

def get_user_id_for_scope(db: Session, scope: str):
    """根据 SCOPE 获取对应的用户 ID，如果没有则返回 1 (系统管理员)"""
    if not scope:
        return 1
    
    if scope in _scope_user_cache:
        return _scope_user_cache[scope]
    
    # 1. 尝试查找以 [SCOPE]Planner 命名的用户
    username = f"{scope}Planner"
    user = db.query(User).filter(User.username == username).first()
    if user:
        _scope_user_cache[scope] = user.id
        return user.id
    
    # 2. 尝试查找拥有该 SCOPE 权限的角色下的用户
    # 注意：这里简化处理，只找第一个匹配的用户
    try:
        from app.models.user import RolePermission
        user = db.query(User).join(User.roles).join(Role.permissions).filter(
            text("role_permissions.scope = :scope")
        ).params(scope=scope).first()
        if user:
            _scope_user_cache[scope] = user.id
            return user.id
    except:
        pass
        
    # 默认返回 1
    _scope_user_cache[scope] = 1
    return 1

def import_mpdb_from_excel(file_path: str, db: Session, chunk_size: int = 10000, use_csv: bool = True):
    """从Excel文件导入MPDB数据"""
    print(f"\n正在导入 (TEMP): {file_path}")
    print(f"  模式: REPLACE, update_method=daily_report, is_system_sync=0")
    
    # 清空 MPDB 表
    print(f"  清空 MPDB 表...")
    try:
        db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
        db.execute(text("TRUNCATE TABLE mpdb"))
        db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"  ✗ 清空表失败: {str(e)}")
        return
    
    try:
        excel_file = pd.ExcelFile(file_path, engine='openpyxl')
        target_sheet = 'DB'
        if target_sheet not in excel_file.sheet_names:
            target_sheet = excel_file.sheet_names[0]
        
        # 预读取以确定列
        df_sample = pd.read_excel(excel_file, sheet_name=target_sheet, nrows=1)
        main_block_col = next((c for c in df_sample.columns if str(c).strip().lower() in ['main_block', 'main block']), None)
        dtype_dict = {main_block_col: str} if main_block_col else {}
        
        if use_csv:
            csv_file = tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv', encoding='utf-8', newline='')
            csv_path = csv_file.name
            csv_file.close()
            
            try:
                df_full = pd.read_excel(excel_file, sheet_name=target_sheet, dtype=dtype_dict)
                if main_block_col:
                    df_full[main_block_col] = df_full[main_block_col].astype(str).replace(['nan', 'None', 'NaN', '<NA>', 'NaT'], '')
                df_full.to_csv(csv_path, index=False, encoding='utf-8', quoting=csv.QUOTE_MINIMAL, escapechar='\\')
                
                total_imported = 0
                for chunk in pd.read_csv(csv_path, chunksize=chunk_size, encoding='utf-8', quoting=csv.QUOTE_MINIMAL, escapechar='\\'):
                    imported = _import_mpdb_chunk(chunk, db)
                    total_imported += imported
                    db.commit()
                    print(f"    已导入 {total_imported} 行...")
                
                os.unlink(csv_path)
            except Exception as e:
                if os.path.exists(csv_path): os.unlink(csv_path)
                raise e
        else:
            df_full = pd.read_excel(excel_file, sheet_name=target_sheet, dtype=dtype_dict)
            total_imported = 0
            for start_idx in range(0, len(df_full), chunk_size):
                chunk = df_full.iloc[start_idx:start_idx+chunk_size]
                imported = _import_mpdb_chunk(chunk, db)
                total_imported += imported
                db.commit()
                print(f"    已导入 {total_imported} 行...")
        
        # 移除低效的逐个同步逻辑，全量导入时不建议使用
        print(f"  ✓ MPDB 导入完成: {total_imported} 条")
        print(f"  提示：全量导入后，建议使用专门的 SQL 脚本统一更新作业汇总状态。")
                
        # print(f"  正在触发 MPDB 日期范围同步...")
        # from app.services.activity_sync_service import ActivitySyncService
        # affected_activities = db.query(MPDB.activity_id).distinct().all()
        # ... 略过几万次循环 ...
    except Exception as e:
        db.rollback()
        print(f"  ✗ 导入失败: {str(e)}")
        traceback.print_exc()

def _import_mpdb_chunk(chunk: pd.DataFrame, db: Session):
    column_mapping = {
        'date': ['Date', 'DATE', '日期'],
        'activity_id': ['Activity_ID', 'Activity ID', 'ACTIVITY_ID', 'ActivityID'],
        'gcc_scope': ['GCC_Scope', 'GCC Scope', 'GCC_SCOPE'],
        'typeof_mp': ['Typeof_MP', 'Typeof MP', 'TypeofMP'],
        'manpower': ['Manpower', 'MANPOWER', '人力'],
        'machinery': ['Machinery', 'MACHINERY', '机械'],
        'gcc_project': ['GCC_Project', 'GCC Project', 'GCC_PROJECT'],
        'gcc_subproject': ['GCC_Sub-project', 'GCC Sub-project', 'GCC_Subproject'],
        'gcc_phase': ['GCC_Phase', 'GCC Phase', 'GCC_PHASE'],
        'gcc_train': ['GCC_Train', 'GCC Train', 'GCC_TRAIN'],
        'gcc_unit': ['GCC_Unit', 'GCC Unit', 'GCC_UNIT'],
        'gcc_block': ['GCC_Block', 'GCC Block', 'GCC_BLOCK'],
        'bcc_quarter': ['!BCC_Quarter', 'BCC_Quarter', 'BCC Quarter'],
        'main_block': ['Main_Block', 'Main Block', 'MAIN_BLOCK'],
        'activity_description': ['Activity Description', 'Activity_Description', 'ActivityDescription'],
        'gcc_discipline': ['GCC_Discipline', 'GCC Discipline', 'GCC_DISCIPLINE'],
        'gcc_workpackage': ['GCC_Workpackage', 'GCC Workpackage', 'GCC_WORKPACKAGE'],
        'remarks': ['Remarks', 'REMARKS', '备注'],
    }
    
    actual_columns = {}
    for key, names in column_mapping.items():
        for col in chunk.columns:
            # 增强匹配：去掉引号和空格
            clean_col = str(col).strip().replace('"', '').replace("'", "")
            if clean_col in names:
                actual_columns[key] = col
                break
    
    def get_decimal_value(val):
        if pd.isna(val):
            return Decimal('0')
        try:
            s = str(val).replace(',', '').strip()
            if s.lower() in ['nan', 'none', '']:
                return Decimal('0')
            return Decimal(s)
        except:
            return Decimal('0')

    records = []
    for index, row in chunk.iterrows():
        # 核心检查：如果找不到日期列，说明匹配逻辑有问题
        date_col = actual_columns.get('date')
        if not date_col:
            continue
            
        date_val = row.get(date_col)
        if pd.isna(date_val):
            continue
            
        try:
            date_obj = pd.to_datetime(date_val).date()
        except:
            continue
            
        scope = clean_value(row.get(actual_columns.get('gcc_scope')))
        
        record = {
            'date': date_obj,
            'activity_id': clean_value(row.get(actual_columns.get('activity_id'))),
            'scope': scope,
            'typeof_mp': clean_value(row.get(actual_columns.get('typeof_mp'))) or 'Direct',
            'manpower': get_decimal_value(row.get(actual_columns.get('manpower'))),
            'machinery': get_decimal_value(row.get(actual_columns.get('machinery'))),
            'project': clean_value(row.get(actual_columns.get('gcc_project'))),
            'subproject': clean_value(row.get(actual_columns.get('gcc_subproject'))),
            'implement_phase': clean_value(row.get(actual_columns.get('gcc_phase'))),
            'train': clean_value(row.get(actual_columns.get('gcc_train'))),
            'unit': clean_value(row.get(actual_columns.get('gcc_unit'))),
            'block': clean_value(row.get(actual_columns.get('gcc_block'))),
            'quarter': clean_value(row.get(actual_columns.get('bcc_quarter'))),
            'main_block': clean_value(row.get(actual_columns.get('main_block'))),
            'title': clean_text(clean_value(row.get(actual_columns.get('activity_description')))),
            'discipline': clean_value(row.get(actual_columns.get('gcc_discipline'))),
            'work_package': clean_value(row.get(actual_columns.get('gcc_workpackage'))),
            'remarks': clean_value(row.get(actual_columns.get('remarks'))),
            'update_method': 'daily_report',
            'updated_by': get_user_id_for_scope(db, scope)
        }
        records.append(record)
        
    if records:
        db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
        db.bulk_insert_mappings(MPDB, records)
        db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
    return len(records)

def import_vfactdb_from_excel(file_path: str, db: Session, chunk_size: int = 10000, use_csv: bool = True):
    """从Excel文件导入VFACTDB数据"""
    print(f"\n正在导入 (TEMP): {file_path}")
    print(f"  模式: REPLACE, update_method=daily_report, is_system_sync=0")
    
    print(f"  清空 VFACTDB 表...")
    try:
        db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
        db.execute(text("TRUNCATE TABLE vfactdb"))
        db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"  ✗ 清空表失败: {str(e)}")
        return

    try:
        excel_file = pd.ExcelFile(file_path, engine='openpyxl')
        target_sheet = 'DB'
        if target_sheet not in excel_file.sheet_names:
            target_sheet = excel_file.sheet_names[0]
            
        # 找到 achieved 列的实际名称以保留精度
        df_sample = pd.read_excel(excel_file, sheet_name=target_sheet, nrows=1)
        achieved_col = next((c for c in df_sample.columns if str(c).strip().lower() in ['achieved', '完成量']), None)
        
        def str_converter(x):
            if pd.isna(x): return '0'
            if isinstance(x, (int, float)):
                if isinstance(x, int): return str(x)
                s = repr(x)
                if 'e' in s.lower(): return f"{x:.15f}".rstrip('0').rstrip('.')
                return s
            return str(x)
        
        converters = {achieved_col: str_converter} if achieved_col else {}
            
        if use_csv:
            csv_file = tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv', encoding='utf-8', newline='')
            csv_path = csv_file.name
            csv_file.close()
            
            try:
                df_full = pd.read_excel(excel_file, sheet_name=target_sheet, converters=converters)
                df_full.to_csv(csv_path, index=False, encoding='utf-8', quoting=csv.QUOTE_MINIMAL, escapechar='\\')
                
                total_imported = 0
                # 读取时也指定为字符串
                dtype_dict = {achieved_col: str} if achieved_col else {}
                for chunk in pd.read_csv(csv_path, chunksize=chunk_size, dtype=dtype_dict, quoting=csv.QUOTE_MINIMAL, escapechar='\\'):
                    imported = _import_vfactdb_chunk(chunk, db)
                    total_imported += imported
                    db.commit()
                    print(f"    已导入 {total_imported} 行...")
                os.unlink(csv_path)
            except Exception as e:
                if os.path.exists(csv_path): os.unlink(csv_path)
                raise e
        else:
            df_full = pd.read_excel(excel_file, sheet_name=target_sheet, converters=converters)
            total_imported = 0
            for start_idx in range(0, len(df_full), chunk_size):
                chunk = df_full.iloc[start_idx:start_idx+chunk_size]
                imported = _import_vfactdb_chunk(chunk, db)
                total_imported += imported
                db.commit()
                print(f"    已导入 {total_imported} 行...")
        
        # 移除低效的逐个同步逻辑，全量导入时不建议使用
        print(f"  ✓ VFACTDB 导入完成: {total_imported} 条")
        print(f"  提示：全量导入后，建议使用专门的 SQL 脚本统一更新作业汇总状态。")

        # print(f"  正在触发 Volume Control 和 Activity Summary 汇总同步...")
        # ... 略过几万次循环 ...
    except Exception as e:
        db.rollback()
        print(f"  ✗ 导入失败: {str(e)}")
        traceback.print_exc()

def _import_vfactdb_chunk(chunk: pd.DataFrame, db: Session):
    column_mapping = {
        'date': ['Date', 'DATE', '日期'],
        'activity_id': ['Activity_ID', 'Activity ID', 'ACTIVITY_ID', 'ActivityID'],
        'gcc_scope': ['GCC_Scope', 'GCC Scope', 'GCC_SCOPE'],
        'gcc_project': ['GCC_Project', 'GCC Project', 'GCC_PROJECT'],
        'gcc_subproject': ['GCC_Sub-project', 'GCC Sub-project', 'GCC_Subproject'],
        'gcc_phase': ['GCC_Phase', 'GCC Phase', 'GCC_PHASE'],
        'gcc_train': ['GCC_Train', 'GCC Train', 'GCC_TRAIN'],
        'gcc_unit': ['GCC_Unit', 'GCC Unit', 'GCC_UNIT'],
        'gcc_block': ['GCC_Block', 'GCC Block', 'GCC_BLOCK'],
        'bcc_quarter': ['!BCC_Quarter', 'BCC_Quarter', 'BCC Quarter'],
        'main_block': ['Main_Block', 'Main Block', 'MAIN_BLOCK'],
        'gcc_description': ['GCC_Description', 'GCC Description', 'GCC_DESCRIPTION'],
        'type_of_work': ['Type of Work', 'Type_of_Work', 'TypeOfWork'],
        'gcc_discipline': ['GCC_Discipline', 'GCC Discipline', 'GCC_DISCIPLINE'],
        'gcc_workpackage': ['GCC_Workpackage', 'GCC Workpackage', 'GCC_WORKPACKAGE'],
        'achieved': ['Achieved', 'ACHIEVED', '完成量'],
    }
    
    actual_columns = {}
    for key, names in column_mapping.items():
        for col in chunk.columns:
            if str(col).strip() in names:
                actual_columns[key] = col
                break
                
    records = []
    for _, row in chunk.iterrows():
        try:
            date_val = row.get(actual_columns.get('date'))
            if pd.isna(date_val): continue
            try:
                date_obj = pd.to_datetime(date_val).date()
            except: continue
            
            scope = clean_value(row.get(actual_columns.get('gcc_scope')))
            work_package = clean_value(row.get(actual_columns.get('gcc_workpackage')))
            work_step_desc = clean_value(row.get(actual_columns.get('type_of_work')))
            
            # 修复工作步骤描述 (针对可能被错误清洗的情况)
            if work_package and work_step_desc:
                if (work_package, work_step_desc) in _work_step_fix_map:
                    work_step_desc = _work_step_fix_map[(work_package, work_step_desc)]
            
            def get_decimal_value(val):
                if pd.isna(val):
                    return Decimal('0')
                try:
                    s = str(val).replace(',', '').strip()
                    if s.lower() in ['nan', 'none', '']:
                        return Decimal('0')
                    return Decimal(s)
                except:
                    return Decimal('0')
            
            record = {
                'date': date_obj,
                'activity_id': clean_value(row.get(actual_columns.get('activity_id'))),
                'scope': scope,
                'project': clean_value(row.get(actual_columns.get('gcc_project'))),
                'subproject': clean_value(row.get(actual_columns.get('gcc_subproject'))),
                'implement_phase': clean_value(row.get(actual_columns.get('gcc_phase'))),
                'train': clean_value(row.get(actual_columns.get('gcc_train'))),
                'unit': clean_value(row.get(actual_columns.get('gcc_unit'))),
                'block': clean_value(row.get(actual_columns.get('gcc_block'))),
                'quarter': clean_value(row.get(actual_columns.get('bcc_quarter'))),
                'main_block': clean_value(row.get(actual_columns.get('main_block'))),
                'title': clean_text(clean_value(row.get(actual_columns.get('gcc_description')))),
                'work_step_description': work_step_desc,
                'discipline': clean_value(row.get(actual_columns.get('gcc_discipline'))),
                'work_package': work_package,
                'achieved': get_decimal_value(row.get(actual_columns.get('achieved'))),
                'is_system_sync': False,
                'update_method': 'daily_report',
                'updated_by': get_user_id_for_scope(db, scope)
            }
            records.append(record)
        except: continue
        
    if records:
        db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
        db.bulk_insert_mappings(VFACTDB, records)
        db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
    return len(records)

def main():
    data_dir = project_root / "original system" / "previous data"
    db = SessionLocal()
    try:
        # 加载修复映射
        load_work_step_fix_map(db)
        
        # MPDB
        mp_file = data_dir / "GCC-OPG-PLAN-REPORT-MP.xlsm"
        if mp_file.exists():
            import_mpdb_from_excel(str(mp_file), db)
        
        # VFACTDB
        vfact_file = data_dir / "GCC-OPG-PLAN-REPORT-VFACT.xlsm"
        if vfact_file.exists():
            import_vfactdb_from_excel(str(vfact_file), db)
            
        print("\n所有导入任务已完成！")
    finally:
        db.close()

if __name__ == "__main__":
    main()
