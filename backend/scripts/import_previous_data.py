"""
导入历史数据脚本
从 original system/previous data 目录导入Excel文件到数据库
"""
import sys
import os
import argparse
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy.dialects.mysql import insert
from app.database import SessionLocal, engine
from app.models.facility import Facility
from app.models.rsc import RSCDefine
from app.models.report import MPDB, VFACTDB
from app.models.volume_control import VolumeControl
from app.models.volume_control_quantity import VolumeControlQuantity
from app.models.volume_control_inspection import VolumeControlInspection
from app.models.volume_control_asbuilt import VolumeControlAsbuilt
from app.models.volume_control_payment import VolumeControlPayment
from app.models.activity_summary import ActivitySummary
from app.models.user import User, Role
from app.models.workstep import WorkStepDefine
from app.utils.russian_transliteration import clean_text
from datetime import datetime, timezone
from decimal import Decimal
from collections import defaultdict
import traceback
import csv
import tempfile
import os


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
    if _work_step_fix_map:
        print(f"  加载了 {len(_work_step_fix_map)} 条工作步骤描述修复映射")

def get_user_id_for_scope(db: Session, scope: str):
    """根据 SCOPE 获取对应的用户 ID，如果没有则返回 1 (系统管理员)"""
    if not scope:
        return 1
    
    if scope in _scope_user_cache:
        return _scope_user_cache[scope]
    
    from sqlalchemy import text
    
    # 1. 尝试查找以 [SCOPE]Planner 命名的用户
    username = f"{scope}Planner"
    user = db.query(User).filter(User.username == username).first()
    if user:
        _scope_user_cache[scope] = user.id
        return user.id
    
    # 2. 尝试查找拥有该 SCOPE 权限的角色下的用户
    try:
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


def clean_value(value):
    """清理值，处理NaN和空值"""
    if pd.isna(value):
        return None
    s = str(value).strip()
    return s if s != "" else None


def import_volume_controls_from_excel(file_path: str, db: Session):
    """从Excel文件导入VolumeControl数据（兼容新的四表结构：quantity, inspection, asbuilt, payment）"""
    print(f"\n正在导入: {file_path}")
    print(f"  模式: 新的四表结构（volume_control_quantity, volume_control_inspection, volume_control_asbuilt, volume_control_payment）")
    
    # 禁用外键检查（因为 activities 表已废弃，activity_id 可能不在 activities 表中）
    from sqlalchemy import text
    try:
        db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
    except:
        pass
    
    try:
        df = pd.read_excel(file_path, engine='openpyxl')
        print(f"  读取到 {len(df)} 行数据")
        print(f"  列名: {list(df.columns)}")
        
        imported_quantity = 0
        updated_quantity = 0
        imported_inspection = 0
        updated_inspection = 0
        imported_asbuilt = 0
        updated_asbuilt = 0
        imported_payment = 0
        updated_payment = 0
        errors = []
        
        # 列名映射：支持中英文列名
        column_mapping = {
            'activity_id': ['ACT ID', 'Activity_ID', 'Activity ID', 'ActivityID', 'activity_id'],
            # Quantity 表字段
            'estimated_total': ['预估总量（工程师根据DDD/FEED文件更新）', 'Estimated_Total', 'Estimated Total'],
            'drawing_approved_afc': ['图纸批准量AFC（工程师根据DDD文件更新）', 'Drawing_Approved_AFC', 'Drawing Approved AFC'],
            'material_arrived': ['材料到货量（工程师根据到货信息更新）', 'Material_Arrived', 'Material Arrived'],
            'available_workface': ['现有可施工工作面（工程师根据现场情况更新）', 'Available_Workface', 'Available Workface'],
            'workface_restricted_material': ['工作面受限（材料因素，工程师更新）', 'Workface_Restricted_Material', 'Workface Restricted Material'],
            'workface_restricted_site': ['工作面受限（现场因素，工程师更新）', 'Workface_Restricted_Site', 'Workface Restricted Site'],
            'construction_completed': ['施工完成（计划部通过日报更新，请勿填写）', 'Construction_Completed', 'Construction Completed'],
            # Inspection 表字段
            'rfi_completed_a': ['RFI 验收完成量（A）', 'RFI_Completed_A', 'RFI Completed A'],
            'rfi_completed_b': ['RFI 验收完成量（B）', 'RFI_Completed_B', 'RFI Completed B'],
            'rfi_completed_c': ['RFI 验收完成量（C）', 'RFI_Completed_C', 'RFI Completed C'],
            # Asbuilt 表字段
            'asbuilt_signed_r0': ['竣工资料签署量（R0）', 'Asbuilt_Signed_R0', 'Asbuilt Signed R0'],
            'asbuilt_signed_r1': ['竣工资料签署量（R1）', 'Asbuilt_Signed_R1', 'Asbuilt Signed R1'],
            # Payment 表字段
            'obp_signed': ['OBP签署量', 'OBP_Signed', 'OBP Signed'],
            # 其他字段（在新表中不存在，但保留以兼容旧数据）
            'construction_responsible': ['施工部责任人', 'Construction_Responsible', 'Construction Responsible'],
            'remarks': ['备注', '备 注', 'Remarks', 'REMARKS'],
        }
        
        # 查找实际列名
        actual_columns = {}
        for key, possible_names in column_mapping.items():
            for col_name in df.columns:
                if col_name in possible_names:
                    actual_columns[key] = col_name
                    break
        
        print(f"  找到的列映射: {actual_columns}")
        
        if 'activity_id' not in actual_columns:
            print(f"  ✗ 错误: 找不到 Activity ID 列")
            return 0, 0, ["找不到 Activity ID 列"]
        
        # 辅助函数：通过用户名查找用户ID（如果找不到则返回None）
        def get_user_id_by_name(username):
            """通过用户名查找用户ID"""
            if not username:
                return None
            user = db.query(User).filter(User.username == username).first()
            if user:
                return user.id
            # 尝试通过真实姓名查找
            user = db.query(User).filter(User.full_name == username).first()
            if user:
                return user.id
            return None
        
        for index, row in df.iterrows():
            try:
                # 获取activity_id
                activity_id_col = actual_columns['activity_id']
                activity_id = clean_value(row.get(activity_id_col))
                
                if not activity_id:
                    continue
                
                # 处理责任人（尝试转换为用户ID）
                responsible_user_id = None
                has_responsible_col = False
                if 'construction_responsible' in actual_columns:
                    has_responsible_col = True
                    responsible_name = clean_value(row.get(actual_columns['construction_responsible']))
                    if responsible_name:
                        responsible_user_id = get_user_id_by_name(responsible_name)
                        if not responsible_user_id:
                            print(f"  ⚠ 警告: 第 {index + 2} 行，无法找到责任人 '{responsible_name}' 对应的用户ID，将设为空")
                    else:
                        responsible_user_id = None
                
                # ========== 1. 处理 VolumeControlQuantity（工程量及完工信息） ==========
                quantity_data = {'activity_id': activity_id}
                quantity_fields = [
                    'estimated_total', 'drawing_approved_afc', 'material_arrived',
                    'available_workface', 'workface_restricted_material', 'workface_restricted_site',
                    'construction_completed'
                ]
                
                has_quantity_data = False
                for field in quantity_fields:
                    if field in actual_columns:
                        col_name = actual_columns[field]
                        value = row.get(col_name)
                        # 标记该列在 Excel 中存在，允许更新（即使是空值或 0）
                        has_quantity_data = True
                        if pd.notna(value):
                            try:
                                # 精度提升：使用 Decimal 替代 float 避免 precision 损失
                                quantity_data[field] = Decimal(str(value))
                            except:
                                quantity_data[field] = None
                        else:
                            quantity_data[field] = None
                
                # 如果有责任人列，添加到quantity表
                if has_responsible_col:
                    quantity_data['responsible_user_id'] = responsible_user_id
                    has_quantity_data = True
                
                # 注意：不再移除 None 值，因为用户希望导入空值（或者是 0）以覆盖数据库中的非空值
                # quantity_data = {k: v for k, v in quantity_data.items() if v is not None}
                
                if has_quantity_data:
                    existing_quantity = db.query(VolumeControlQuantity).filter(
                        VolumeControlQuantity.activity_id == activity_id
                    ).first()
                    
                    if existing_quantity:
                        for key, value in quantity_data.items():
                            if key != 'activity_id':
                                setattr(existing_quantity, key, value)
                        updated_quantity += 1
                    else:
                        # 插入新记录
                        quantity = VolumeControlQuantity(**quantity_data)
                        db.add(quantity)
                        imported_quantity += 1
                
                # ========== 2. 处理 VolumeControlInspection（验收相关信息） ==========
                inspection_data = {'activity_id': activity_id}
                inspection_fields = ['rfi_completed_a', 'rfi_completed_b', 'rfi_completed_c']
                
                has_inspection_data = False
                for field in inspection_fields:
                    if field in actual_columns:
                        col_name = actual_columns[field]
                        value = row.get(col_name)
                        # 标记该列在 Excel 中存在，允许更新
                        has_inspection_data = True
                        if pd.notna(value):
                            try:
                                # 精度提升：使用 Decimal 替代 float
                                inspection_data[field] = Decimal(str(value))
                            except:
                                inspection_data[field] = None
                        else:
                            inspection_data[field] = None
                
                # 如果有责任人列，添加到inspection表
                if has_responsible_col:
                    inspection_data['responsible_user_id'] = responsible_user_id
                    has_inspection_data = True
                
                # 注意：不再移除 None 值
                # inspection_data = {k: v for k, v in inspection_data.items() if v is not None}
                
                if has_inspection_data:
                    existing_inspection = db.query(VolumeControlInspection).filter(
                        VolumeControlInspection.activity_id == activity_id
                    ).first()
                    
                    if existing_inspection:
                        for key, value in inspection_data.items():
                            if key != 'activity_id':
                                setattr(existing_inspection, key, value)
                        updated_inspection += 1
                    else:
                        inspection = VolumeControlInspection(**inspection_data)
                        db.add(inspection)
                        imported_inspection += 1
                
                # ========== 3. 处理 VolumeControlAsbuilt（竣工资料相关信息） ==========
                asbuilt_data = {'activity_id': activity_id}
                asbuilt_fields = ['asbuilt_signed_r0', 'asbuilt_signed_r1']
                
                has_asbuilt_data = False
                for field in asbuilt_fields:
                    if field in actual_columns:
                        col_name = actual_columns[field]
                        value = row.get(col_name)
                        # 标记该列在 Excel 中存在，允许更新
                        has_asbuilt_data = True
                        if pd.notna(value):
                            try:
                                # 精度提升：使用 Decimal 替代 float
                                asbuilt_data[field] = Decimal(str(value))
                            except:
                                asbuilt_data[field] = None
                        else:
                            asbuilt_data[field] = None
                
                # 如果有责任人列，添加到asbuilt表
                if has_responsible_col:
                    asbuilt_data['responsible_user_id'] = responsible_user_id
                    has_asbuilt_data = True
                
                # 注意：不再移除 None 值
                # asbuilt_data = {k: v for k, v in asbuilt_data.items() if v is not None}
                
                if has_asbuilt_data:
                    existing_asbuilt = db.query(VolumeControlAsbuilt).filter(
                        VolumeControlAsbuilt.activity_id == activity_id
                    ).first()
                    
                    if existing_asbuilt:
                        for key, value in asbuilt_data.items():
                            if key != 'activity_id':
                                setattr(existing_asbuilt, key, value)
                        updated_asbuilt += 1
                    else:
                        asbuilt = VolumeControlAsbuilt(**asbuilt_data)
                        db.add(asbuilt)
                        imported_asbuilt += 1
                
                # ========== 4. 处理 VolumeControlPayment（收款相关信息） ==========
                payment_data = {'activity_id': activity_id}
                payment_fields = ['obp_signed']
                
                has_payment_data = False
                for field in payment_fields:
                    if field in actual_columns:
                        col_name = actual_columns[field]
                        value = row.get(col_name)
                        # 标记该列在 Excel 中存在，允许更新
                        has_payment_data = True
                        if pd.notna(value):
                            try:
                                # 精度提升：使用 Decimal 替代 float
                                payment_data[field] = Decimal(str(value))
                            except:
                                payment_data[field] = None
                        else:
                            payment_data[field] = None
                
                # 如果有责任人列，添加到payment表
                if has_responsible_col:
                    payment_data['responsible_user_id'] = responsible_user_id
                    has_payment_data = True
                
                # 注意：不再移除 None 值
                # payment_data = {k: v for k, v in payment_data.items() if v is not None}
                
                if has_payment_data:
                    existing_payment = db.query(VolumeControlPayment).filter(
                        VolumeControlPayment.activity_id == activity_id
                    ).first()
                    
                    if existing_payment:
                        for key, value in payment_data.items():
                            if key != 'activity_id':
                                setattr(existing_payment, key, value)
                        updated_payment += 1
                    else:
                        payment = VolumeControlPayment(**payment_data)
                        db.add(payment)
                        imported_payment += 1
                
            except Exception as e:
                errors.append(f"第 {index + 2} 行: {str(e)}")
                print(f"  错误 (行 {index + 2}): {str(e)}")
        
        db.commit()
        
        # 重新启用外键检查
        try:
            db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
            db.commit()
        except:
            pass
        
        # 统计汇总
        total_imported = imported_quantity + imported_inspection + imported_asbuilt + imported_payment
        total_updated = updated_quantity + updated_inspection + updated_asbuilt + updated_payment
        
        print(f"  ✓ 导入完成:")
        print(f"    - Quantity（工程量）: 导入 {imported_quantity} 条，更新 {updated_quantity} 条")
        print(f"    - Inspection（验收）: 导入 {imported_inspection} 条，更新 {updated_inspection} 条")
        print(f"    - Asbuilt（竣工资料）: 导入 {imported_asbuilt} 条，更新 {updated_asbuilt} 条")
        print(f"    - Payment（收款）: 导入 {imported_payment} 条，更新 {updated_payment} 条")
        print(f"  ✓ 总计: 导入 {total_imported} 条，更新 {total_updated} 条")
        if errors:
            print(f"  ⚠ 错误 {len(errors)} 条（显示前10个）:")
            for error in errors[:10]:
                print(f"    {error}")
            if len(errors) > 10:
                print(f"    ... 还有 {len(errors) - 10} 个错误未显示")
        
        return total_imported, total_updated, errors
        
    except Exception as e:
        db.rollback()
        # 确保重新启用外键检查
        try:
            db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
            db.commit()
        except:
            pass
        print(f"  ✗ 导入失败: {str(e)}")
        traceback.print_exc()
        return 0, 0, [str(e)]


def import_facilities_from_excel(file_path: str, db: Session):
    """从Excel文件导入Facilities数据（根据新的表结构）"""
    print(f"\n正在导入: {file_path}")
    
    try:
        # 读取Excel文件，将 main_block 列指定为字符串类型，避免被转换为数字
        # 先读取第一行来确定列名
        df_sample = pd.read_excel(file_path, engine='openpyxl', nrows=1)
        # 找到 main_block 列的实际名称
        main_block_col_name = None
        for col in df_sample.columns:
            col_str = str(col).strip()
            if col_str in ['Main_Block', 'Main Block', 'MAIN_BLOCK', 'main_block']:
                main_block_col_name = col
                break
        
        # 构建 dtype 字典，将 main_block 列指定为字符串
        dtype_dict = {}
        if main_block_col_name:
            dtype_dict[main_block_col_name] = str
        
        # 读取完整数据，main_block 列保持为字符串
        df = pd.read_excel(file_path, engine='openpyxl', dtype=dtype_dict)
        print(f"  读取到 {len(df)} 行数据")
        print(f"  列名: {list(df.columns)}")
        
        # 确保 main_block 列是字符串类型（双重保险）
        if main_block_col_name and main_block_col_name in df.columns:
            df[main_block_col_name] = df[main_block_col_name].astype(str)
            df[main_block_col_name] = df[main_block_col_name].replace(['nan', 'None', 'NaN', '<NA>', 'NaT'], '')
        
        imported = 0
        updated = 0
        errors = []
        
        # 列名映射：直接对应 Excel 列名
        column_mapping = {
            'block': ['Block', 'BLOCK', 'block', 'Block Code', 'Block_Code'],
            'project': ['Project', 'PROJECT', 'project'],
            'subproject_code': ['Sub-Project CODE', 'Sub-Project_CODE', 'Sub_Project_CODE', 'SUB_PROJECT_CODE', 'subproject_code'],
            'train': ['Train', 'TRAIN', 'train'],
            'unit': ['Unit', 'UNIT', 'unit'],
            'main_block': ['Main_Block', 'Main Block', 'MAIN_BLOCK', 'main_block'],
            'descriptions': ['Descriptions', 'DESCRIPTIONS', 'descriptions', 'Description', 'description'],
            'simple_block': ['SIMPLEBLK', 'Simple Block', 'Simple_Block', 'SIMPLE_BLOCK', 'simple_block'],
            'quarter': ['!BCC_Quarter', 'BCC_Quarter', 'BCC_QUARTER', 'bcc_quarter', 'Quarter', 'quarter'],
            'bcc_startup_sequence': ['!BCC_START-UP SEQUENCE', '!BCC_START-UP_SEQUENCE', 'BCC_START-UP SEQUENCE', 'BCC_STARTUP_SEQUENCE', 'startup_sequence'],
            'title_type': ['Title Type', 'Title_Type', 'TITLE_TYPE', 'title_type'],
        }
        
        # 查找实际列名
        actual_columns = {}
        for key, possible_names in column_mapping.items():
            for col_name in df.columns:
                col_str = str(col_name).strip()
                if col_str in possible_names:
                    actual_columns[key] = col_name
                    break
        
        print(f"  找到的列映射: {actual_columns}")
        
        # Block 是必需字段
        if 'block' not in actual_columns:
            print(f"  ✗ 错误: 找不到 Block 列")
            return 0, 0, ["找不到 Block 列"]
        
        skipped_empty_block = 0
        processed_count = 0
        
        # 先检查前几行的数据
        print(f"  [调试] 检查前3行的 Block 值:")
        for i in range(min(3, len(df))):
            row = df.iloc[i]
            block_raw = row.get(actual_columns['block'])
            block_cleaned = clean_value(block_raw)
            print(f"    第 {i + 2} 行: 原始值={block_raw} (类型: {type(block_raw)}), 清理后={block_cleaned}")
        
        for index, row in df.iterrows():
            try:
                # 获取 block（作为唯一标识）
                block_raw = row.get(actual_columns['block'])
                block = clean_value(block_raw)
                
                if not block:
                    skipped_empty_block += 1
                    if skipped_empty_block <= 5:  # 只显示前5个空 block 的调试信息
                        print(f"  [调试] 第 {index + 2} 行: Block 值为空 (原始值: {repr(block_raw)}, 类型: {type(block_raw)})")
                    continue
                
                processed_count += 1
                
                # 检查是否已存在（使用 block 作为唯一标识）
                existing = db.query(Facility).filter(Facility.block == block).first()
                
                # 准备数据字典
                data = {'block': block}
                
                # 字段名映射：Excel列名 -> 数据库字段名
                field_mapping = {
                    'subproject_code': 'subproject',  # subproject_code -> subproject
                    'bcc_startup_sequence': 'start_up_sequence',  # bcc_startup_sequence -> start_up_sequence
                }
                
                # 映射所有字段（actual_columns 的 key 就是 field 名）
                for field in actual_columns:
                    if field != 'block':  # block 已经处理过了
                        # 获取数据库字段名（如果有映射则使用映射后的名称）
                        db_field = field_mapping.get(field, field)
                        col_name = actual_columns[field]
                        value = clean_value(row.get(col_name))
                        # 只要列存在，我们就更新（即使是空值）
                        data[db_field] = value
                
                if existing:
                    # 更新现有记录
                    for key, value in data.items():
                        setattr(existing, key, value)
                    existing.updated_at = datetime.now(timezone.utc)
                    updated += 1
                else:
                    # 创建新记录
                    facility = Facility(**data)
                    db.add(facility)
                    imported += 1
                
            except Exception as e:
                errors.append(f"第 {index + 2} 行处理失败: {str(e)}")
        
        db.commit()
        print(f"  [调试] 处理统计: 总行数={len(df)}, 处理={processed_count}, 跳过空Block={skipped_empty_block}, 导入={imported}, 更新={updated}")
        if skipped_empty_block > 0:
            print(f"  ⚠ 跳过 {skipped_empty_block} 行（Block 为空）")
        if errors:
            print(f"  ⚠ 错误 {len(errors)} 条（仅显示前5个）")
            for error in errors[:5]:
                print(f"    {error}")
        print(f"  ✓ 导入 {imported} 条，更新 {updated} 条")
        return imported, updated, errors
        
    except Exception as e:
        db.rollback()
        print(f"  ✗ 导入失败: {str(e)}")
        traceback.print_exc()
        return 0, 0, [str(e)]


def import_rsc_defines_from_excel(file_path: str, db: Session):
    """从Excel文件导入RSC_Defines数据"""
    print(f"\n正在导入: {file_path}")
    
    try:
        df = pd.read_excel(file_path, engine='openpyxl')
        print(f"  读取到 {len(df)} 行数据")
        print(f"  列名: {list(df.columns)}")
        
        imported = 0
        updated = 0
        errors = []
        
        # 列名映射：支持多种可能的列名格式
        column_mapping = {
            'work_package': ['Work Package', 'Work_Package', 'WORK_PACKAGE'],
            'wpkg_description': ['WPKG Description', 'WPKG_Description', 'WPkg Description', 'WPkg_Description', 'WPKG_DESCRIPTION'],
            'resource_id': ['Resource ID', 'Resource_ID', 'RESOURCE_ID'],
            'resource_id_name': ['Resource ID Name', 'Resource_ID_Name', 'Resource_ID_Name', 'RESOURCE_ID_NAME'],
            'uom': ['UoM', 'UOM', 'uom', 'UOM'],
            'norms': ['Norms', 'NORMS'],
            'norms_mp': ['Norms_MP', 'Norms MP', 'NORMS_MP'],
            'norms_mp_20251103': ['Norms_MP_20251103', 'Norms MP 20251103', 'NORMS_MP_20251103'],
            'bcc_kq_code': ['BCC.KQ.CODE', 'BCC_KQ_CODE', 'BCC_KQ_CODE'],
            'kq': ['KQ', 'kq'],
            'cn_wk_report': ['CN_WK Report', 'CN_WK_Report', 'CN_WK_REPORT'],
            'rfi_a': ['RFI (A)', 'RFI_A', 'RFI_A'],
            'rfi_b': ['RFI (B)', 'RFI_B', 'RFI_B'],
            'rfi_c': ['RFI (C)', 'RFI_C', 'RFI_C'],
            'remarks': ['Remarks', 'REMARKS'],
        }
        
        # 查找实际列名
        actual_columns = {}
        for key, possible_names in column_mapping.items():
            for col_name in df.columns:
                col_str = str(col_name).strip()
                if col_str in possible_names:
                    actual_columns[key] = col_name
                    break
        
        print(f"  找到的列映射: {actual_columns}")
        
        for index, row in df.iterrows():
            try:
                # 获取关键字段
                work_package = None
                resource_id = None
                
                if 'work_package' in actual_columns:
                    work_package = clean_value(row.get(actual_columns['work_package']))
                if 'resource_id' in actual_columns:
                    resource_id = clean_value(row.get(actual_columns['resource_id']))
                
                if not work_package or not resource_id:
                    continue
                
                # 检查是否已存在（根据work_package和resource_id）
                existing = db.query(RSCDefine).filter(
                    RSCDefine.work_package == work_package,
                    RSCDefine.resource_id == resource_id
                ).first()
                
                # 准备数据
                data = {
                    'work_package': work_package,
                    'resource_id': resource_id,
                }
                
                # 映射所有字段
                for field in column_mapping:
                    if field in ['work_package', 'resource_id']:
                        continue  # 已经处理过了
                    if field in actual_columns:
                        col_name = actual_columns[field]
                        if field in ['norms', 'norms_mp', 'norms_mp_20251103']:
                            # 数值字段
                            value = row.get(col_name)
                            if pd.notna(value):
                                try:
                                    data[field] = float(value)
                                except:
                                    data[field] = None
                            else:
                                data[field] = None
                        else:
                            # 文本字段
                            value = clean_value(row.get(col_name))
                            # 只要列存在，我们就更新（即使是空值）
                            data[field] = value
                
                # 注意：不再移除 None 值
                # data = {k: v for k, v in data.items() if v is not None}
                
                if existing:
                    for key, value in data.items():
                        if key not in ['work_package', 'resource_id']:
                            setattr(existing, key, value)
                    updated += 1
                else:
                    rsc = RSCDefine(**data)
                    db.add(rsc)
                    imported += 1
                
            except Exception as e:
                errors.append(f"第 {index + 2} 行: {str(e)}")
                print(f"  错误 (行 {index + 2}): {str(e)}")
        
        db.commit()
        print(f"  ✓ 成功导入 {imported} 条，更新 {updated} 条")
        if errors:
            print(f"  ⚠ 错误 {len(errors)} 条")
        
        return imported, updated, errors
        
    except Exception as e:
        db.rollback()
        print(f"  ✗ 导入失败: {str(e)}")
        traceback.print_exc()
        return 0, 0, [str(e)]


def import_activities_from_excel(file_path: str, db: Session):
    """从Excel文件导入Activities数据（根据新的表结构）"""
    print(f"\n正在导入: {file_path}")
    
    try:
        # 读取Excel文件
        df = pd.read_excel(file_path, engine='openpyxl')
        print(f"  读取到 {len(df)} 行数据")
        print(f"  列名: {list(df.columns)}")
        
        imported = 0
        updated = 0
        errors = []
        
        # 列名映射：直接对应 Excel 列名
        column_mapping = {
            'wbs': ['WBS', 'wbs', 'Wbs'],
            'act_id': ['ACT ID', 'ACT_ID', 'Act ID', 'act_id'],
            'block': ['Block', 'BLOCK', 'block'],
            'act_description': ['Act Description', 'Act_Description', 'ACT_DESCRIPTION', 'act_description'],
            'scope': ['SCOPE', 'Scope', 'scope'],
            'discipline': ['Discipline', 'DISCIPLINE', 'discipline'],
            'work_package': ['Work Package', 'Work_Package', 'WORK_PACKAGE', 'work_package'],
            'contract_phase': ['Contract Phase', 'Contract_Phase', 'CONTRACT_PHASE', 'contract_phase'],
            'weight_factor': ['Weight Factor', 'Weight_Factor', 'WEIGHT_FACTOR', 'weight_factor'],
            'man_hours': ['Man Hours', 'Man_Hours', 'MAN_HOURS', 'man_hours'],
        }
        
        # 查找实际列名
        actual_columns = {}
        for key, possible_names in column_mapping.items():
            for col_name in df.columns:
                col_str = str(col_name).strip()
                if col_str in possible_names:
                    actual_columns[key] = col_name
                    break
        
        print(f"  找到的列映射: {actual_columns}")
        
        # ACT ID 是必需字段
        if 'act_id' not in actual_columns:
            print(f"  ✗ 错误: 找不到 ACT ID 列")
            return 0, 0, ["找不到 ACT ID 列"]
        
        for index, row in df.iterrows():
            try:
                # 获取 act_id（作为唯一标识）
                act_id = clean_value(row.get(actual_columns['act_id']))
                
                if not act_id:
                    continue
                
                # 检查是否已存在（使用 activity_id 作为唯一标识）
                existing = db.query(ActivitySummary).filter(ActivitySummary.activity_id == act_id).first()
                
                # 准备数据字典
                data = {'activity_id': act_id}
                
                # 字段名映射：Excel列名 -> 数据库字段名
                field_mapping = {
                    'act_description': 'title',  # act_description -> title
                    'act_id': 'activity_id',  # 已处理，这里只是记录映射
                }
                
                # 映射所有字段
                for field in actual_columns:
                    if field == 'act_id':
                        continue  # 已经处理过了
                    
                    # 获取数据库字段名（如果有映射则使用映射后的名称）
                    db_field = field_mapping.get(field, field)
                    col_name = actual_columns[field]
                    
                    if field in ['weight_factor', 'man_hours']:
                        # 数值字段
                        value = row.get(col_name)
                        if pd.notna(value):
                            try:
                                data[db_field] = float(value)
                            except:
                                data[db_field] = None
                        else:
                            data[db_field] = None
                    else:
                        # 文本字段
                        value = clean_value(row.get(col_name))
                        # 只要列存在，我们就更新（即使是空值）
                        data[db_field] = value
                
                if existing:
                    # 更新现有记录
                    for key, value in data.items():
                        setattr(existing, key, value)
                    existing.updated_at = datetime.now(timezone.utc)
                    updated += 1
                else:
                    # 创建新记录
                    activity = ActivitySummary(**data)
                    db.add(activity)
                    imported += 1
                
            except Exception as e:
                errors.append(f"第 {index + 2} 行处理失败: {str(e)}")
        
        db.commit()
        print(f"  ✓ 导入 {imported} 条，更新 {updated} 条")
        if errors:
            print(f"  ⚠ 错误 {len(errors)} 条（仅显示前5个）")
            for error in errors[:5]:
                print(f"    {error}")
        return imported, updated, errors
        
    except Exception as e:
        db.rollback()
        print(f"  ✗ 导入失败: {str(e)}")
        traceback.print_exc()
        return 0, 0, [str(e)]


def import_mpdb_from_excel(file_path: str, db: Session, chunk_size: int = 10000, use_csv: bool = True):
    """从Excel文件导入MPDB数据（支持分块处理和CSV中间格式）
    
    注意：MPDB导入采用replace模式，会先清空表再导入新数据
    
    Args:
        file_path: Excel文件路径
        db: 数据库会话
        chunk_size: 分块大小
        use_csv: 是否使用CSV中间格式
    """
    print(f"\n正在导入: {file_path}")
    print(f"  模式: REPLACE (将清空现有数据)")
    print(f"  分块大小: {chunk_size}, 使用CSV中间格式: {use_csv}")
    
    # MPDB 采用 replace 模式，先清空表（使用 TRUNCATE 更快）
    # 禁用外键检查以加速 TRUNCATE
    print(f"  清空 MPDB 表（使用 TRUNCATE，禁用外键检查）...")
    try:
        from sqlalchemy import text
        # 禁用外键检查
        db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
        # TRUNCATE 表
        db.execute(text("TRUNCATE TABLE mpdb"))
        # 重新启用外键检查
        db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
        db.commit()
        print(f"  ✓ MPDB 表已清空")
    except Exception as e:
        db.rollback()
        # 确保重新启用外键检查
        try:
            db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
            db.commit()
        except:
            pass
        print(f"  ✗ 清空表失败: {str(e)}")
        return 0, 0, [str(e)]
    
    try:
        # 只处理DB工作表（包含实际数据）
        excel_file = pd.ExcelFile(file_path, engine='openpyxl')
        print(f"  找到 {len(excel_file.sheet_names)} 个工作表: {excel_file.sheet_names}")
        
        # 只处理DB工作表
        target_sheet = 'DB'
        if target_sheet not in excel_file.sheet_names:
            print(f"  ⚠ 警告: 找不到 'DB' 工作表，尝试处理第一个工作表")
            target_sheet = excel_file.sheet_names[0]
        
        print(f"  处理工作表: {target_sheet}")
        
        # 先读取第一行来确定列名，找到 main_block 列
        df_sample = pd.read_excel(excel_file, sheet_name=target_sheet, nrows=1)
        main_block_col_name = None
        for col in df_sample.columns:
            col_str = str(col).strip()
            if col_str in ['Main_Block', 'Main Block', 'MAIN_BLOCK', 'main_block']:
                main_block_col_name = col
                break
        
        # 构建 dtype 字典，将 main_block 列指定为字符串
        dtype_dict = {}
        if main_block_col_name:
            dtype_dict[main_block_col_name] = str
        
        # 如果使用CSV中间格式，先转换
        if use_csv:
            print(f"  步骤1: 读取Excel并转换为CSV（处理特殊字符）...")
            csv_file = tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv', encoding='utf-8', newline='')
            csv_path = csv_file.name
            csv_file.close()
            
            try:
                # 一次性读取整个Excel工作表（因为read_excel不支持chunksize）
                print(f"    读取Excel文件（这可能需要一些时间）...")
                df_full = pd.read_excel(excel_file, sheet_name=target_sheet, dtype=dtype_dict)
                total_rows = len(df_full)
                print(f"    读取完成，共 {total_rows} 行")
                
                # 确保 main_block 列是字符串类型（双重保险）
                if main_block_col_name and main_block_col_name in df_full.columns:
                    df_full[main_block_col_name] = df_full[main_block_col_name].astype(str)
                    df_full[main_block_col_name] = df_full[main_block_col_name].replace(['nan', 'None', 'NaN', '<NA>', 'NaT'], '')
                
                # 写入CSV（处理特殊字符）
                print(f"    写入CSV文件...")
                df_full.to_csv(csv_path, index=False, encoding='utf-8', quoting=csv.QUOTE_MINIMAL, escapechar='\\')
                
                print(f"  步骤2: CSV文件已创建，共 {total_rows} 行")
                print(f"  步骤3: 从CSV分块导入数据...")
                
                # 从CSV分块读取并导入
                total_imported = 0
                all_errors = []
                
                for chunk_num, chunk in enumerate(pd.read_csv(csv_path, chunksize=chunk_size, encoding='utf-8', quoting=csv.QUOTE_MINIMAL, escapechar='\\'), 1):
                    print(f"    处理第 {chunk_num} 块 ({len(chunk)} 行)...", end='', flush=True)
                    
                    imported, errors = _import_mpdb_chunk(chunk, db)
                    total_imported += imported
                    all_errors.extend(errors)
                    
                    # 每块提交一次
                    db.commit()
                    
                    # 显示跳过统计
                    skip_info = []
                    for error in errors:
                        if '跳过统计' in error:
                            skip_info.append(error.replace('跳过统计: ', ''))
                    
                    if skip_info:
                        print(f" 导入 {imported} 条 (跳过: {', '.join(skip_info)})")
                    else:
                        print(f" 导入 {imported} 条")
                
                # ========== 汇总同步逻辑 (MPDB) ==========
                print(f"  正在触发 MPDB 日期范围同步...")
                from app.services.activity_sync_service import ActivitySyncService
                # 获取本次导入涉及的所有 activity_id
                affected_activities = db.query(MPDB.activity_id).distinct().all()
                total_affected = len(affected_activities)
                print(f"  发现 {total_affected} 个作业，正在同步 MPDB 开始/完成日期...")
                for i, (act_id,) in enumerate(affected_activities):
                    if not act_id: continue
                    if i % 100 == 0: print(f"    正在同步: {i}/{total_affected}...", end='\r')
                    # MPDB 的同步会更新实际开始/完成日期
                    try:
                        ActivitySyncService.update_activity_from_reports(db, act_id)
                        # 每 50 条提交一次，减少长事务占用锁的时间
                        if i % 50 == 0:
                            db.commit()
                    except Exception as sync_e:
                        db.rollback()
                        print(f"\n    ! 同步作业 {act_id} 失败: {str(sync_e)[:100]}")
                        continue
                db.commit()
                print(f"\n  ✓ MPDB 汇总同步完成")
                
                # 清理临时文件
                os.unlink(csv_path)
                
            except Exception as e:
                if os.path.exists(csv_path):
                    os.unlink(csv_path)
                raise e
        else:
            # 直接处理Excel，手动分块
            print(f"  读取Excel文件（这可能需要一些时间）...")
            df_full = pd.read_excel(excel_file, sheet_name=target_sheet)
            total_rows = len(df_full)
            print(f"  读取完成，共 {total_rows} 行，开始分块处理...")
            
            total_imported = 0
            all_errors = []
            
            # 手动分块处理
            for start_idx in range(0, total_rows, chunk_size):
                end_idx = min(start_idx + chunk_size, total_rows)
                chunk = df_full.iloc[start_idx:end_idx]
                chunk_num = (start_idx // chunk_size) + 1
                
                print(f"  处理第 {chunk_num} 块 ({len(chunk)} 行)...", end='', flush=True)
                
                imported, errors = _import_mpdb_chunk(chunk, db)
                total_imported += imported
                all_errors.extend(errors)
                
                # 每块提交一次
                db.commit()
                
                # 显示跳过统计
                skip_info = []
                for error in errors:
                    if '跳过统计' in error:
                        skip_info.append(error.replace('跳过统计: ', ''))
                
                if skip_info:
                    print(f" 导入 {imported} 条 (跳过: {', '.join(skip_info)})")
                else:
                    print(f" 导入 {imported} 条")
        
        # 统计跳过的行数
        total_skipped = 0
        skip_summary = {}
        for error in all_errors:
            if '跳过统计' in error:
                # 解析跳过统计信息
                skip_text = error.replace('跳过统计: ', '')
                for item in skip_text.split(', '):
                    if ':' in item:
                        key, value = item.split(': ')
                        count = int(value.replace(' 行', ''))
                        skip_summary[key] = skip_summary.get(key, 0) + count
                        total_skipped += count
        
        print(f"  ✓ 总共导入 {total_imported} 条")
        if total_skipped > 0:
            print(f"  ⚠ 跳过 {total_skipped} 行数据:")
            for reason, count in skip_summary.items():
                print(f"    - {reason}: {count} 行")
        if all_errors:
            # 只显示非跳过统计的错误
            other_errors = [e for e in all_errors if '跳过统计' not in e]
            if other_errors:
                print(f"  ⚠ 其他错误 {len(other_errors)} 条（仅显示前10个）")
                for error in other_errors[:10]:
                    print(f"    {error}")
        
        return total_imported, 0, all_errors
        
    except Exception as e:
        db.rollback()
        print(f"  ✗ 导入失败: {str(e)}")
        traceback.print_exc()
        return 0, 0, [str(e)]


def _import_mpdb_chunk(chunk: pd.DataFrame, db: Session):
    """处理MPDB数据块（批量插入优化）
    
    Args:
        chunk: 数据块
        db: 数据库会话
    """
    imported = 0
    errors = []
    
    # 列名映射（支持多种格式）
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
        'quarter': ['!BCC_Quarter', 'BCC_Quarter', 'BCC Quarter', 'Quarter', 'quarter'],
        'main_block': ['Main_Block', 'Main Block', 'MAIN_BLOCK'],
        'activity_description': ['Activity Description', 'Activity_Description', 'ActivityDescription'],
        'gcc_discipline': ['GCC_Discipline', 'GCC Discipline', 'GCC_DISCIPLINE'],
        'gcc_workpackage': ['GCC_Workpackage', 'GCC Workpackage', 'GCC_WORKPACKAGE'],
        'remarks': ['Remarks', 'REMARKS', '备注'],
    }
    
    # 查找实际列名
    actual_columns = {}
    for key, possible_names in column_mapping.items():
        for col_name in chunk.columns:
            if str(col_name).strip() in possible_names:
                actual_columns[key] = col_name
                break
    
    if 'date' not in actual_columns:
        return 0, ["找不到必需的列: Date"]
    
    # activity_id 不是必需的，允许为空（用于休息人力、间接人力等）
    activity_id_col = actual_columns.get('activity_id')
    
    # 准备批量插入数据
    records_to_insert = []
    skipped_stats = {
        'no_date': 0,
        'parse_error': 0
    }
    
    for index, row in chunk.iterrows():
        try:
            # 解析日期
            date_col = actual_columns['date']
            date_value = row.get(date_col)
            if pd.isna(date_value):
                skipped_stats['no_date'] += 1
                continue
            
            try:
                if isinstance(date_value, str):
                    try:
                        date_obj = datetime.strptime(date_value, '%Y-%m-%d').date()
                    except:
                        date_obj = pd.to_datetime(date_value).date()
                else:
                    date_obj = date_value.date() if hasattr(date_value, 'date') else pd.to_datetime(date_value).date()
            except Exception as e:
                skipped_stats['parse_error'] += 1
                errors.append(f"第 {index + 2} 行日期解析失败: {str(e)}")
                continue
            
            # 获取activity_id（允许为空）
            activity_id = None
            if activity_id_col:
                activity_id = clean_value(row.get(activity_id_col))
                # 如果清理后是空字符串，设置为 None
                if not activity_id:
                    activity_id = None
            
            # 准备数据字典
            record = {
                'date': date_obj,
                'activity_id': activity_id,  # 允许为 None
            }
            
            # 字段名映射：Excel列名 -> 数据库字段名
            field_mapping = {
                'gcc_scope': 'scope',
                'gcc_project': 'project',
                'gcc_subproject': 'subproject',
                'gcc_phase': 'implement_phase',
                'gcc_train': 'train',
                'gcc_unit': 'unit',
                'gcc_block': 'block',
                'activity_description': 'title',
                'gcc_discipline': 'discipline',
                'gcc_workpackage': 'work_package',
            }
            
            # 添加其他字段
            for field, col_name in actual_columns.items():
                if field in ['date', 'activity_id']:
                    continue
                
                # 获取数据库字段名（如果有映射则使用映射后的名称）
                db_field = field_mapping.get(field, field)
                
                value = row.get(col_name)
                if pd.notna(value):
                    if field in ['manpower', 'machinery']:
                        try:
                            # 精度提升：使用 Decimal
                            record[db_field] = Decimal(str(value))
                        except:
                            record[db_field] = Decimal('0')
                    else:
                        text_value = clean_text(clean_value(value))
                        if text_value:
                            # 对于 main_block 字段，确保是字符串格式（去除小数点后的零）
                            if db_field == 'main_block':
                                # 如果是数字格式的字符串（如 "12100.0"），转换为整数再转回字符串（如 "12100"）
                                try:
                                    # 尝试转换为浮点数再转整数，去除小数点
                                    num_value = float(text_value)
                                    if num_value.is_integer():
                                        text_value = str(int(num_value))
                                    else:
                                        text_value = str(num_value)
                                except (ValueError, TypeError):
                                    # 如果转换失败，保持原值
                                    pass
                            record[db_field] = text_value
            
            # 设置默认值
            if 'typeof_mp' not in record:
                record['typeof_mp'] = 'Direct'
            
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
            
            # 设置审计字段
            scope = record.get('scope')
            record['update_method'] = 'daily_report'
            record['updated_by'] = get_user_id_for_scope(db, scope)
            
            if 'manpower' in record:
                record['manpower'] = get_decimal_value(record['manpower'])
            else:
                record['manpower'] = Decimal('0')
                
            if 'machinery' in record:
                record['machinery'] = get_decimal_value(record['machinery'])
            else:
                record['machinery'] = Decimal('0')
            
            records_to_insert.append(record)
            
        except Exception as e:
            errors.append(f"第 {index + 2} 行: {str(e)}")
    
    # MPDB 采用 replace 模式，直接批量插入（表已清空，无需检查重复）
    # 在导入时禁用检查以加速插入
    if records_to_insert:
        try:
            from sqlalchemy import text
            # 禁用检查以加速批量插入
            db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
            db.execute(text("SET UNIQUE_CHECKS = 0"))
            
            db.bulk_insert_mappings(MPDB, records_to_insert)
            db.commit()
            
            # 重新启用检查
            db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
            db.execute(text("SET UNIQUE_CHECKS = 1"))
            
            imported = len(records_to_insert)
        except Exception as e:
            # 确保恢复检查设置
            try:
                db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
                db.execute(text("SET UNIQUE_CHECKS = 1"))
                db.commit()
            except:
                pass
            
            # 如果批量插入失败，尝试逐条插入
            imported = 0
            for record in records_to_insert:
                try:
                    mpdb_entry = MPDB(**record)
                    db.add(mpdb_entry)
                    imported += 1
                except Exception as insert_error:
                    errors.append(f"插入记录失败: {str(insert_error)}")
    
    # 返回统计信息
    if any(skipped_stats.values()):
        skip_info = []
        if skipped_stats['no_date'] > 0:
            skip_info.append(f"日期为空: {skipped_stats['no_date']} 行")
        if skipped_stats['parse_error'] > 0:
            skip_info.append(f"日期解析错误: {skipped_stats['parse_error']} 行")
        if skip_info:
            errors.append(f"跳过统计: {', '.join(skip_info)}")
    
    return imported, errors


def import_vfactdb_from_excel(file_path: str, db: Session, chunk_size: int = 10000, use_csv: bool = True, mode: str = 'replace'):
    """从Excel文件导入VFACTDB数据（支持分块处理和CSV中间格式）
    
    Args:
        file_path: Excel文件路径
        db: 数据库会话
        chunk_size: 分块大小
        use_csv: 是否使用CSV中间格式
        mode: 导入模式，'replace' 或 'update'
            - 'replace': 清空表后重新导入
            - 'update': 根据去重条件（date + activity_id + work_step_description + achieved）进行增/改
    """
    print(f"\n正在导入: {file_path}")
    print(f"  模式: {mode.upper()}")
    print(f"  分块大小: {chunk_size}, 使用CSV中间格式: {use_csv}")
    
    # 如果是 replace 模式，先清空表（使用 TRUNCATE 更快）
    # 禁用外键检查以加速 TRUNCATE
    if mode == 'replace':
        print(f"  清空 VFACTDB 表（使用 TRUNCATE，禁用外键检查）...")
        try:
            from sqlalchemy import text
            # 禁用外键检查
            db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
            # TRUNCATE 表
            db.execute(text("TRUNCATE TABLE vfactdb"))
            # 重新启用外键检查
            db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
            db.commit()
            print(f"  ✓ VFACTDB 表已清空")
        except Exception as e:
            db.rollback()
            # 确保重新启用外键检查
            try:
                db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
                db.commit()
            except:
                pass
            print(f"  ✗ 清空表失败: {str(e)}")
            return 0, 0, [str(e)]
    
    try:
        # 只处理DB工作表
        excel_file = pd.ExcelFile(file_path, engine='openpyxl')
        print(f"  找到 {len(excel_file.sheet_names)} 个工作表: {excel_file.sheet_names}")
        
        target_sheet = 'DB'
        if target_sheet not in excel_file.sheet_names:
            print(f"  ⚠ 警告: 找不到 'DB' 工作表，尝试处理第一个工作表")
            target_sheet = excel_file.sheet_names[0]
        
        print(f"  处理工作表: {target_sheet}")
        
        if use_csv:
            print(f"  步骤1: 将Excel转换为CSV（处理特殊字符）...")
            csv_file = tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv', encoding='utf-8', newline='')
            csv_path = csv_file.name
            csv_file.close()
            
            try:
                # 一次性读取整个Excel工作表
                print(f"    读取Excel文件（这可能需要一些时间）...")
                # 先读取第一行来确定列名
                df_sample = pd.read_excel(excel_file, sheet_name=target_sheet, nrows=1)
                # 找到 achieved 列的实际名称
                achieved_col_name = None
                for col in df_sample.columns:
                    col_str = str(col).strip()
                    if col_str.lower() in ['achieved', '完成量'] or 'achieved' in col_str.lower():
                        achieved_col_name = col
                        break
                
                # 使用 converters 参数，直接按字符串读取 achieved 列，避免任何精度丢失
                converters = {}
                if achieved_col_name:
                    # 定义一个转换函数，将值转换为字符串（保留原始精度）
                    def str_converter(x):
                        if pd.isna(x):
                            return '0'
                        # 如果是数字类型，使用 repr 保留更多精度
                        if isinstance(x, (int, float)):
                            # 对于整数，直接转字符串
                            if isinstance(x, int):
                                return str(x)
                            # 对于浮点数，使用 repr 保留精度，但去除科学计数法
                            s = repr(x)
                            if 'e' in s.lower():
                                # 如果有科学计数法，使用格式化
                                return f"{x:.15f}".rstrip('0').rstrip('.')
                            return s
                        # 如果已经是字符串，直接返回
                        return str(x)
                    
                    converters[achieved_col_name] = str_converter
                
                # 读取完整数据，achieved 列通过 converter 直接转换为字符串
                df_full = pd.read_excel(excel_file, sheet_name=target_sheet, converters=converters)
                total_rows = len(df_full)
                print(f"    读取完成，共 {total_rows} 行")
                
                # 确保 achieved 列是字符串类型（双重保险）
                if achieved_col_name and achieved_col_name in df_full.columns:
                    # 处理 NaN 值
                    df_full[achieved_col_name] = df_full[achieved_col_name].fillna('0')
                    df_full[achieved_col_name] = df_full[achieved_col_name].astype(str)
                    df_full[achieved_col_name] = df_full[achieved_col_name].replace(['nan', 'None', 'NaN', ''], '0')
                
                # 写入CSV（achieved 列已经是字符串，会保持完整精度）
                print(f"    写入CSV文件...")
                # 确保 achieved 列在写入 CSV 前是字符串，并且格式一致
                if achieved_col_name and achieved_col_name in df_full.columns:
                    # 确保所有值都是字符串，并且处理 NaN
                    df_full[achieved_col_name] = df_full[achieved_col_name].astype(str)
                    df_full[achieved_col_name] = df_full[achieved_col_name].replace(['nan', 'None', 'NaN', '<NA>', 'NaT'], '0')
                df_full.to_csv(csv_path, index=False, encoding='utf-8', quoting=csv.QUOTE_MINIMAL, escapechar='\\', float_format='%.15f')
                
                print(f"  步骤2: CSV文件已创建，共 {total_rows} 行")
                print(f"  步骤3: 从CSV分块导入数据...")
                
                total_imported = 0
                total_updated = 0
                all_errors = []
                
                # 读取 CSV 时，将 achieved 列指定为字符串类型，避免精度丢失
                # 先读取第一行来确定列名
                first_chunk = pd.read_csv(csv_path, nrows=1, encoding='utf-8', quoting=csv.QUOTE_MINIMAL, escapechar='\\')
                # 找到 achieved 列的实际名称
                achieved_col_name = None
                for col in first_chunk.columns:
                    if str(col).strip().lower() in ['achieved', '完成量']:
                        achieved_col_name = col
                        break
                
                # 构建 dtype 字典，将 achieved 列指定为字符串
                dtype_dict = {}
                if achieved_col_name:
                    dtype_dict[achieved_col_name] = str
                
                for chunk_num, chunk in enumerate(pd.read_csv(csv_path, chunksize=chunk_size, encoding='utf-8', quoting=csv.QUOTE_MINIMAL, escapechar='\\', dtype=dtype_dict), 1):
                    print(f"    处理第 {chunk_num} 块 ({len(chunk)} 行)...", end='', flush=True)
                    
                    # 设置块编号用于调试
                    _import_vfactdb_chunk._chunk_num = chunk_num
                    imported, updated, errors = _import_vfactdb_chunk(chunk, db, mode)
                    total_imported += imported
                    total_updated += updated
                    all_errors.extend(errors)
                    
                    try:
                        db.commit()
                        if updated > 0:
                            print(f" 导入 {imported} 条，更新 {updated} 条")
                        else:
                            print(f" 导入 {imported} 条")
                    except Exception as commit_error:
                        db.rollback()
                        print(f" ✗ 提交失败: {str(commit_error)[:200]}")
                        all_errors.append(f"第 {chunk_num} 块提交失败: {str(commit_error)[:200]}")
                        # 继续处理下一块
                
                # ========== 汇总同步逻辑 (VFACTDB) ==========
                print(f"  正在触发 Volume Control 和 Activity Summary 汇总同步...")
                from app.services.volume_control_service import VolumeControlService
                from app.services.activity_sync_service import ActivitySyncService
                # 获取本次导入涉及的所有 activity_id
                affected_activities = db.query(VFACTDB.activity_id).distinct().all()
                total_affected = len(affected_activities)
                print(f"  发现 {total_affected} 个作业，正在同步汇总数据...")
                for i, (act_id,) in enumerate(affected_activities):
                    if not act_id: continue
                    if i % 100 == 0: print(f"    正在同步: {i}/{total_affected}...", end='\r')
                    VolumeControlService.update_construction_completed_from_vfactdb(db, act_id)
                    ActivitySyncService.update_activity_from_reports(db, act_id)
                    if i % 100 == 0: db.commit()
                db.commit()
                print(f"\n  ✓ VFACTDB 汇总数据同步完成")
                
                os.unlink(csv_path)
                
            except Exception as e:
                if os.path.exists(csv_path):
                    os.unlink(csv_path)
                raise e
        else:
            # 直接处理Excel，手动分块
            print(f"  读取Excel文件（这可能需要一些时间）...")
            df_full = pd.read_excel(excel_file, sheet_name=target_sheet)
            total_rows = len(df_full)
            print(f"  读取完成，共 {total_rows} 行，开始分块处理...")
            
            total_imported = 0
            all_errors = []
            
            # 手动分块处理
            for start_idx in range(0, total_rows, chunk_size):
                end_idx = min(start_idx + chunk_size, total_rows)
                chunk = df_full.iloc[start_idx:end_idx]
                chunk_num = (start_idx // chunk_size) + 1
                
                print(f"  处理第 {chunk_num} 块 ({len(chunk)} 行)...", end='', flush=True)
                
                imported, updated, errors = _import_vfactdb_chunk(chunk, db, mode)
                total_imported += imported
                total_updated += updated
                all_errors.extend(errors)
                
                try:
                    db.commit()
                except Exception as commit_error:
                    db.rollback()
                    print(f" ✗ 第 {chunk_num} 块提交失败: {str(commit_error)[:200]}")
                    all_errors.append(f"第 {chunk_num} 块提交失败: {str(commit_error)[:200]}")
                    # 继续处理下一块
                    continue
                
                # 显示跳过统计
                skip_info = []
                for error in errors:
                    if '跳过统计' in error:
                        skip_info.append(error.replace('跳过统计: ', ''))
                
                if skip_info:
                    print(f" 导入 {imported} 条 (跳过: {', '.join(skip_info)})")
                else:
                    print(f" 导入 {imported} 条")
        
        # 统计跳过的行数
        total_skipped = 0
        skip_summary = {}
        for error in all_errors:
            if '跳过统计' in error:
                # 解析跳过统计信息
                skip_text = error.replace('跳过统计: ', '')
                for item in skip_text.split(', '):
                    if ':' in item:
                        key, value = item.split(': ')
                        count = int(value.replace(' 行', ''))
                        skip_summary[key] = skip_summary.get(key, 0) + count
                        total_skipped += count
        
        print(f"  ✓ 总共导入 {total_imported} 条")
        if total_skipped > 0:
            print(f"  ⚠ 跳过 {total_skipped} 行数据:")
            for reason, count in skip_summary.items():
                print(f"    - {reason}: {count} 行")
        if all_errors:
            # 只显示非跳过统计的错误
            other_errors = [e for e in all_errors if '跳过统计' not in e]
            if other_errors:
                print(f"  ⚠ 其他错误 {len(other_errors)} 条（仅显示前10个）")
                for error in other_errors[:10]:
                    print(f"    {error}")
        
        return total_imported, 0, all_errors
        
    except Exception as e:
        db.rollback()
        print(f"  ✗ 导入失败: {str(e)}")
        traceback.print_exc()
        return 0, 0, [str(e)]


def _import_vfactdb_chunk(chunk: pd.DataFrame, db: Session, mode: str = 'replace'):
    """处理VFACTDB数据块（批量插入优化，支持高性能去重）
    
    Args:
        chunk: 数据块
        db: 数据库会话
        mode: 导入模式，'replace' 或 'update'
    """
    imported = 0
    updated = 0
    errors = []
    
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
        'quarter': ['!BCC_Quarter', 'BCC_Quarter', 'BCC Quarter', 'Quarter', 'quarter'],
        'main_block': ['Main_Block', 'Main Block', 'MAIN_BLOCK'],
        'gcc_description': ['GCC_Description', 'GCC Description', 'GCC_DESCRIPTION'],
        'type_of_work': ['Type of Work', 'Type_of_Work', 'TypeOfWork'],
        'gcc_discipline': ['GCC_Discipline', 'GCC Discipline', 'GCC_DISCIPLINE'],
        'gcc_workpackage': ['GCC_Workpackage', 'GCC Workpackage', 'GCC_WORKPACKAGE'],
        'achieved': ['Achieved', 'ACHIEVED', '完成量'],
    }
    
    actual_columns = {}
    for key, possible_names in column_mapping.items():
        for col_name in chunk.columns:
            if str(col_name).strip() in possible_names:
                actual_columns[key] = col_name
                break
    
    if 'date' not in actual_columns:
        return 0, ["找不到必需的列: Date"]
    
    # activity_id 不是必需的，允许为空（用于休息人力、间接人力等）
    
    records_to_insert = []
    skipped_stats = {
        'no_date': 0,
        'parse_error': 0
    }
    
    for index, row in chunk.iterrows():
        try:
            date_col = actual_columns['date']
            date_value = row.get(date_col)
            if pd.isna(date_value):
                skipped_stats['no_date'] += 1
                continue
            
            try:
                if isinstance(date_value, str):
                    try:
                        date_obj = datetime.strptime(date_value, '%Y-%m-%d').date()
                    except:
                        date_obj = pd.to_datetime(date_value).date()
                else:
                    date_obj = date_value.date() if hasattr(date_value, 'date') else pd.to_datetime(date_value).date()
            except Exception as e:
                skipped_stats['parse_error'] += 1
                errors.append(f"第 {index + 2} 行日期解析失败: {str(e)}")
                continue
            
            # 获取activity_id（允许为空，用于休息人力、间接人力等）
            activity_id = None
            activity_id_col = actual_columns.get('activity_id')
            if activity_id_col:
                activity_id = clean_value(row.get(activity_id_col))
                # 如果清理后是空字符串，设置为 None
                if not activity_id:
                    activity_id = None
            
            record = {
                'date': date_obj,
                'activity_id': activity_id,  # 允许为 None
            }
            
            # 字段名映射：Excel列名 -> 数据库字段名
            field_mapping = {
                'gcc_scope': 'scope',
                'gcc_project': 'project',
                'gcc_subproject': 'subproject',
                'gcc_phase': 'implement_phase',
                'gcc_train': 'train',
                'gcc_unit': 'unit',
                'gcc_block': 'block',
                'gcc_description': 'title',
                'type_of_work': 'work_step_description',  # 修复：将 type_of_work 映射到 work_step_description
                'gcc_discipline': 'discipline',
                'gcc_workpackage': 'work_package',
            }
            
            for field, col_name in actual_columns.items():
                if field in ['date', 'activity_id']:
                    continue
                
                # 获取数据库字段名（如果有映射则使用映射后的名称）
                db_field = field_mapping.get(field, field)
                
                value = row.get(col_name)
                if pd.notna(value):
                    if field == 'achieved':
                        # 直接从原始值转换为 Decimal，避免经过 float 丢失精度
                        try:
                            # 如果已经是 Decimal，直接使用
                            if isinstance(value, Decimal):
                                record[field] = value
                            # 如果是字符串，直接转 Decimal（这是最理想的情况）
                            elif isinstance(value, str):
                                # 去除首尾空格
                                value_str = value.strip()
                                if not value_str or value_str.lower() in ['nan', 'none', 'null', '']:
                                    record[field] = Decimal('0')
                                else:
                                    record[field] = Decimal(value_str)
                            # 如果是数字类型，先转字符串再转 Decimal（可能丢失精度，但尽量保留）
                            elif isinstance(value, (int, float)):
                                # 对于 float，使用 repr 可能保留更多精度，但通常 str 就够了
                                # 如果值是整数，直接转字符串
                                if isinstance(value, int):
                                    record[field] = Decimal(str(value))
                                else:
                                    # 对于 float，尝试使用 repr 保留更多精度
                                    value_str = repr(value)
                                    # 如果 repr 包含科学计数法，尝试格式化
                                    if 'e' in value_str.lower():
                                        # 使用格式化保留更多小数位
                                        record[field] = Decimal(f"{value:.15f}".rstrip('0').rstrip('.'))
                                    else:
                                        record[field] = Decimal(value_str)
                            else:
                                record[field] = Decimal('0')
                        except Exception as e:
                            # 如果转换失败，记录错误并使用 0
                            record[field] = Decimal('0')
                    else:
                        text_value = clean_text(clean_value(value))
                        if text_value:
                            # 对于 main_block 字段，确保是字符串格式（去除小数点后的零）
                            if db_field == 'main_block':
                                # 如果是数字格式的字符串（如 "12100.0"），转换为整数再转回字符串（如 "12100"）
                                try:
                                    # 尝试转换为浮点数再转整数，去除小数点
                                    num_value = float(text_value)
                                    if num_value.is_integer():
                                        text_value = str(int(num_value))
                                    else:
                                        text_value = str(num_value)
                                except (ValueError, TypeError):
                                    # 如果转换失败，保持原值
                                    pass
                            record[db_field] = text_value
            
            if 'achieved' not in record:
                record['achieved'] = Decimal('0')
            else:
                # 确保 achieved 值使用 normalize() 统一格式（去除尾随零）
                # 完全保留Excel原始精度，不进行四舍五入
                if isinstance(record['achieved'], Decimal):
                    record['achieved'] = record['achieved'].normalize()
            
            # 确保 work_step_description 存在（用于去重）
            work_step_desc = record.get('work_step_description')
            work_package = record.get('work_package')
            
            # 修复工作步骤描述 (针对可能被错误清洗的情况)
            if work_package and work_step_desc:
                if (work_package, work_step_desc) in _work_step_fix_map:
                    work_step_desc = _work_step_fix_map[(work_package, work_step_desc)]
            
            record['work_step_description'] = work_step_desc
            
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
            
            # 设置审计字段
            scope = record.get('scope')
            record['update_method'] = 'daily_report'
            record['updated_by'] = get_user_id_for_scope(db, scope)
            record['is_system_sync'] = False
            
            if 'achieved' in record:
                record['achieved'] = get_decimal_value(record['achieved'])
            else:
                record['achieved'] = Decimal('0')
            
            records_to_insert.append(record)
            
        except Exception as e:
            errors.append(f"第 {index + 2} 行: {str(e)}")
    
    # 根据模式处理数据
    if mode == 'replace':
        # replace 模式：直接批量插入（表已清空，无需检查重复）
        # 在导入时禁用检查以加速插入
        if records_to_insert:
            try:
                from sqlalchemy import text
                # 禁用检查以加速批量插入
                db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
                db.execute(text("SET UNIQUE_CHECKS = 0"))
                
                db.bulk_insert_mappings(VFACTDB, records_to_insert)
                db.commit()
                
                # 重新启用检查
                db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
                db.execute(text("SET UNIQUE_CHECKS = 1"))
                
                imported = len(records_to_insert)
            except Exception as e:
                # 确保恢复检查设置
                try:
                    db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
                    db.execute(text("SET UNIQUE_CHECKS = 1"))
                    db.commit()
                except:
                    pass
                
                # 如果批量插入失败，尝试逐条插入
                imported = 0
                for record in records_to_insert:
                    try:
                        vfactdb_entry = VFACTDB(**record)
                        db.add(vfactdb_entry)
                        imported += 1
                    except Exception as insert_error:
                        errors.append(f"插入记录失败: {str(insert_error)}")
    
    elif mode == 'update':
        # update 模式：根据去重条件（date + activity_id + work_step_description + achieved）进行增/改
        # 去重条件：date + activity_id + work_step_description + achieved（精确匹配，不存在近似值）
        if records_to_insert:
            # 构建去重键：date + activity_id + work_step_description + achieved（精确匹配）
            record_keys = []
            for record in records_to_insert:
                # achieved 值：已经是 Decimal 类型，直接使用
                achieved_val = record.get('achieved')
                if achieved_val is None:
                    achieved_val = Decimal('0')
                elif not isinstance(achieved_val, Decimal):
                    # 如果不是 Decimal，转换为 Decimal（应该不会发生，但保险起见）
                    achieved_val = Decimal(str(achieved_val))
                # 完全保留Excel原始精度，不进行四舍五入
                achieved_val = achieved_val.normalize()
                
                # work_step_description 去除首尾空格并标准化
                work_step_description_val = record.get('work_step_description')
                if work_step_description_val:
                    work_step_description_val = str(work_step_description_val).strip()
                    if not work_step_description_val:
                        work_step_description_val = None
                
                # activity_id 标准化（确保与数据库中的处理一致）
                activity_id_val = record.get('activity_id')
                if activity_id_val:
                    activity_id_val = str(activity_id_val).strip()
                    if not activity_id_val:
                        activity_id_val = None
                
                key = (
                    record['date'],
                    activity_id_val,
                    work_step_description_val,
                    achieved_val
                )
                record_keys.append(key)
            
            # 优化：先查询该日期范围内的所有记录，然后在Python层面进行精确匹配
            # 获取所有唯一的日期
            unique_dates = set(record['date'] for record in records_to_insert)
            min_date = min(unique_dates)
            max_date = max(unique_dates)
            
            # 查询该日期范围内的所有记录
            existing_records_all = db.query(VFACTDB).filter(
                VFACTDB.date >= min_date,
                VFACTDB.date <= max_date
            ).all()
            
            # 构建双字典结构以加速查找
            # 字典1：完整 key -> record（用于精确匹配）
            # 字典2：部分 key (date, activity_id, work_step_description) -> list of records（用于查找需要更新的记录）
            existing_records_map = {}  # 完整 key -> record
            existing_by_partial_key = defaultdict(list)  # (date, activity_id, work_step_description) -> list of (achieved, record)
            
            for existing in existing_records_all:
                # achieved 保留最大精度，使用 Decimal 类型（与导入时保持一致）
                if existing.achieved is not None:
                    # 数据库 Numeric 字段返回 Decimal，直接使用
                    if isinstance(existing.achieved, Decimal):
                        achieved_val = existing.achieved
                    else:
                        # 如果不是 Decimal，转换为 Decimal 保留精度
                        # 使用 normalize() 去除尾随零，确保格式一致
                        achieved_val = Decimal(str(existing.achieved)).normalize()
                else:
                    achieved_val = Decimal('0')
                
                # work_step_description 去除首尾空格（与导入时保持一致）
                work_step_description_val = existing.work_step_description
                if work_step_description_val:
                    work_step_description_val = str(work_step_description_val).strip()
                    if not work_step_description_val:
                        work_step_description_val = None
                
                # activity_id 标准化（与导入时保持一致）
                activity_id_val = existing.activity_id
                if activity_id_val:
                    activity_id_val = str(activity_id_val).strip()
                    if not activity_id_val:
                        activity_id_val = None
                
                # 完整 key
                full_key = (
                    existing.date,
                    activity_id_val,
                    work_step_description_val,
                    achieved_val
                )
                existing_records_map[full_key] = existing
                
                # 部分 key（用于快速查找需要更新的记录）
                partial_key = (
                    existing.date,
                    activity_id_val,
                    work_step_description_val
                )
                existing_by_partial_key[partial_key].append((achieved_val, existing))
            
            # 分离新记录和需要更新的记录（精确匹配，使用双字典加速）
            new_records = []
            records_to_update = []
            
            # 调试：统计匹配情况
            exact_matches = 0
            partial_matches_same_achieved = 0
            partial_matches_diff_achieved = 0
            no_matches = 0
            
            for record, key in zip(records_to_insert, record_keys):
                # 精确匹配：date + activity_id + work_step_description + achieved
                if key in existing_records_map:
                    # 完全匹配，跳过（不更新）
                    exact_matches += 1
                    pass
                else:
                    # 没有完全匹配，检查是否有相同 date + activity_id + work_step_description 但不同 achieved 的记录
                    # 使用部分 key 字典快速查找（O(1) 时间复杂度）
                    partial_key = (key[0], key[1], key[2])  # date, activity_id, work_step_description
                    
                    if partial_key in existing_by_partial_key:
                        # 找到了相同 date + activity_id + work_step_description 的记录
                        # 检查 achieved 值是否真的不同（精确比较）
                        record_achieved = key[3]
                        found_to_update = False
                        found_same_achieved = False
                        
                        for existing_achieved, existing in existing_by_partial_key[partial_key]:
                            # 精确比较 achieved 值（使用 normalize 确保格式一致）
                            existing_normalized = existing_achieved.normalize()
                            record_normalized = record_achieved.normalize()
                            
                            if existing_normalized == record_normalized:
                                # achieved 值相同（即使格式不同），说明应该完全匹配，但为什么没匹配上？
                                # 可能是其他字段（date, activity_id, work_step_description）的处理不一致
                                # 这种情况下不应该更新，跳过
                                found_same_achieved = True
                                found_to_update = False
                                break
                            else:
                                # achieved 值不同，需要更新
                                # achieved 值已经是 Decimal 类型，直接使用
                                new_achieved = record.get('achieved')
                                if new_achieved is None:
                                    new_achieved = Decimal('0')
                                elif not isinstance(new_achieved, Decimal):
                                    # 如果不是 Decimal，转换为 Decimal（应该不会发生，但保险起见）
                                    new_achieved = Decimal(str(new_achieved))
                                # 完全保留Excel原始精度，不进行四舍五入
                                new_achieved = new_achieved.normalize()
                                
                                # 再次检查：如果 normalize 后的值相同，说明只是格式问题，不应该更新
                                if existing_normalized == new_achieved:
                                    found_same_achieved = True
                                    found_to_update = False
                                    break
                                
                                # 调试：输出前几个不同的 achieved 值
                                current_chunk_num = getattr(_import_vfactdb_chunk, '_chunk_num', 0)
                                if len(records_to_update) < 3 and current_chunk_num <= 1:
                                    print(f"\n    [调试] achieved 值不同: 数据库={existing_achieved} ({type(existing_achieved)}), Excel={record_achieved} ({type(record_achieved)}), normalize后: 数据库={existing_normalized}, Excel={new_achieved}")
                                
                                existing.achieved = new_achieved
                                records_to_update.append(existing)
                                found_to_update = True
                                break
                        
                        if found_same_achieved:
                            # achieved 值相同但没匹配上，可能是 key 构建问题，跳过更新
                            partial_matches_same_achieved += 1
                        elif found_to_update:
                            # achieved 值不同，需要更新
                            partial_matches_diff_achieved += 1
                        else:
                            # 没有找到匹配的记录，作为新记录插入
                            new_records.append(record)
                            no_matches += 1
                    else:
                        # 真正的新记录，需要插入
                        new_records.append(record)
                        no_matches += 1
            
            # 输出调试信息（仅在前几块显示）
            if len(records_to_insert) > 0:
                chunk_num = getattr(_import_vfactdb_chunk, '_chunk_num', 0) + 1
                _import_vfactdb_chunk._chunk_num = chunk_num
                if chunk_num <= 3:  # 只显示前3块的调试信息
                    print(f"\n    [调试] 块 {chunk_num}: 精确匹配={exact_matches}, 部分匹配(相同achieved)={partial_matches_same_achieved}, 部分匹配(不同achieved)={partial_matches_diff_achieved}, 无匹配={no_matches}")
            
            # 批量插入新记录
            if new_records:
                try:
                    db.bulk_insert_mappings(VFACTDB, new_records)
                    imported = len(new_records)
                except Exception as e:
                    # 如果批量插入失败，尝试逐条插入
                    imported = 0
                    for record in new_records:
                        try:
                            vfactdb_entry = VFACTDB(**record)
                            db.add(vfactdb_entry)
                            imported += 1
                        except Exception as insert_error:
                            errors.append(f"插入记录失败: {str(insert_error)}")
            
            # 更新已存在的记录（SQLAlchemy 会自动跟踪更改）
            updated = len(records_to_update)
    
    # 返回统计信息
    if any(skipped_stats.values()):
        skip_info = []
        if skipped_stats['no_date'] > 0:
            skip_info.append(f"日期为空: {skipped_stats['no_date']} 行")
        if skipped_stats['parse_error'] > 0:
            skip_info.append(f"日期解析错误: {skipped_stats['parse_error']} 行")
        if skip_info:
            errors.append(f"跳过统计: {', '.join(skip_info)}")
    
    return imported, updated, errors


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description='导入历史数据脚本',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  # 导入所有表
  python scripts/import_previous_data.py --all
  
  # 只导入 volume_controls 表
  python scripts/import_previous_data.py --table volume_controls
  
  # 只导入 facilities 表
  python scripts/import_previous_data.py --table facilities
  
  # 只导入 rsc_defines 表
  python scripts/import_previous_data.py --table rsc_defines
  
  # 只导入 mpdb 表
  python scripts/import_previous_data.py --table mpdb
  
  # 只导入 vfactdb 表
  python scripts/import_previous_data.py --table vfactdb
  
可用表名:
  - volume_controls  : VolumeControl.xlsx
  - facilities       : Facility_List.xlsx
  - rsc_defines      : CPKG.xlsx
  - activities       : Activity_List.xlsx
  - mpdb             : GCC-OPG-PLAN-REPORT-MP.xlsm
  - vfactdb          : GCC-OPG-PLAN-REPORT-VFACT.xlsm
        """
    )
    
    parser.add_argument(
        '--table',
        type=str,
        choices=['volume_controls', 'facilities', 'rsc_defines', 'activities', 'mpdb', 'vfactdb'],
        help='指定要导入的表（可以多次使用导入多个表）'
    )
    
    parser.add_argument(
        '--all',
        action='store_true',
        help='导入所有表'
    )
    
    parser.add_argument(
        '--list',
        action='store_true',
        help='列出所有可用的表和对应的文件'
    )
    
    parser.add_argument(
        '--vfactdb-mode',
        type=str,
        choices=['replace', 'update'],
        default='replace',
        help='VFACTDB 导入模式: replace (清空后重新导入) 或 update (根据去重条件增/改)，默认 replace'
    )
    
    args = parser.parse_args()
    
    # 数据文件目录
    data_dir = project_root / "original system" / "previous data"
    
    if not data_dir.exists():
        print(f"错误: 数据目录不存在: {data_dir}")
        return
    
    # 文件映射
    
    file_mapping = {
        'volume_controls': ('VolumeControl.xlsx', import_volume_controls_from_excel),
        'facilities': ('Facility_List.xlsx', import_facilities_from_excel),
        'rsc_defines': ('CPKG.xlsx', import_rsc_defines_from_excel),
        'activities': ('Activity_List.xlsx', import_activities_from_excel),
        'mpdb': ('GCC-OPG-PLAN-REPORT-MP.xlsm', import_mpdb_from_excel),
        'vfactdb': ('GCC-OPG-PLAN-REPORT-VFACT.xlsm', import_vfactdb_from_excel),
    }
    
    # 列出可用表
    if args.list:
        print("=" * 60)
        print("可用的表和文件映射:")
        print("=" * 60)
        for table_name, (file_name, _) in file_mapping.items():
            file_path = data_dir / file_name
            exists = "✓" if file_path.exists() else "✗"
            print(f"  {exists} {table_name:20s} -> {file_name}")
        return
    
    # 确定要导入的表
    if args.all:
        tables_to_import = list(file_mapping.keys())
    elif args.table:
        tables_to_import = [args.table]
    else:
        print("错误: 请指定 --table <表名> 或 --all 或 --list")
        print("\n可用表名:")
        for table_name in file_mapping.keys():
            print(f"  - {table_name}")
        print("\n使用 --list 查看详细信息")
        return
    
    print("=" * 60)
    print("历史数据导入脚本")
    print("=" * 60)
    print(f"要导入的表: {', '.join(tables_to_import)}")
    print("=" * 60)
    
    db = SessionLocal()
    
    try:
        # 加载修复映射
        load_work_step_fix_map(db)
        
        for table_name in tables_to_import:
            file_name, import_func = file_mapping[table_name]
            file_path = data_dir / file_name
            
            if not file_path.exists():
                print(f"\n⚠ 文件不存在: {file_path}")
                continue
            
            print(f"\n{'='*60}")
            print(f"导入表: {table_name}")
            print(f"文件: {file_name}")
            print(f"{'='*60}")
            
            # 对于大数据表，传递chunk_size和use_csv参数
            if table_name == 'mpdb':
                import_func(str(file_path), db, chunk_size=10000, use_csv=True)
            elif table_name == 'vfactdb':
                import_func(str(file_path), db, chunk_size=10000, use_csv=True, mode=args.vfactdb_mode)
            else:
                import_func(str(file_path), db)
        
        print("\n" + "=" * 60)
        print("导入完成！")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n✗ 导入过程出错: {str(e)}")
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    main()

