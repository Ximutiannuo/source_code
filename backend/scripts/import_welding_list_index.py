"""
导入 WeldingList Index.xlsx 数据到数据库
"""
import sys
import os
import pandas as pd
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from app.database import SessionLocal
from app.models.welding_config import WeldingMarkaCode, WeldingNonStandardDrawing, WeldingConstContractorMapping

# Excel文件路径
EXCEL_FILE = r"C:\Projects\ProjectControls\original system\WeldingList Index.xlsx"


def import_marka_codes(db):
    """导入Marka代码"""
    try:
        df = pd.read_excel(EXCEL_FILE, sheet_name='marka codes')
        print(f"读取到 {len(df)} 条Marka代码数据")
        
        # 尝试不同的列名
        marka_col = None
        for col in ['Marka', 'Code', 'marka', 'code', 'MARKA', 'CODE']:
            if col in df.columns:
                marka_col = col
                break
        
        if not marka_col:
            print("❌ 未找到Marka代码列")
            return 0
        
        count = 0
        for _, row in df.iterrows():
            try:
                marka = str(row[marka_col]).strip()
                if pd.isna(marka) or marka == '' or marka == 'nan':
                    continue
                
                # 检查是否已存在
                existing = db.query(WeldingMarkaCode).filter(WeldingMarkaCode.marka == marka).first()
                if existing:
                    print(f"  ⚠️  Marka代码 {marka} 已存在，跳过")
                    continue
                
                # 创建新记录
                db_item = WeldingMarkaCode(
                    marka=marka,
                    description=row.get('Description', row.get('description', '')) if 'Description' in df.columns or 'description' in df.columns else None
                )
                db.add(db_item)
                db.commit()  # 逐条提交
                count += 1
            except Exception as e:
                db.rollback()
                print(f"  ⚠️  导入Marka代码 {row.get(marka_col, 'unknown')} 失败: {e}")
                continue
        
        print(f"✅ 成功导入 {count} 条Marka代码")
        return count
    except Exception as e:
        db.rollback()
        print(f"❌ 导入Marka代码失败: {e}")
        return 0


def import_non_standard_drawings(db):
    """导入非标准图纸"""
    try:
        df = pd.read_excel(EXCEL_FILE, sheet_name='non-standard drawing type')
        print(f"读取到 {len(df)} 条非标准图纸数据")
        
        # 尝试不同的列名
        drawing_col = None
        for col in ['DrawingNumber', 'drawing_number', 'Drawing Number', 'DRAWINGNUMBER']:
            if col in df.columns:
                drawing_col = col
                break
        
        if not drawing_col:
            print("❌ 未找到图纸编号列")
            return 0
        
        count = 0
        for _, row in df.iterrows():
            try:
                drawing_number = str(row[drawing_col]).strip()
                if pd.isna(drawing_number) or drawing_number == '' or drawing_number == 'nan':
                    continue
                
                # 获取其他字段（必须先获取，因为用于唯一性检查）
                joint_type_fs = None
                activity_id = None
                description = None
                
                if 'JointTypeFS' in df.columns or 'joint_type_fs' in df.columns:
                    joint_type_fs_col = 'JointTypeFS' if 'JointTypeFS' in df.columns else 'joint_type_fs'
                    joint_type_fs = str(row[joint_type_fs_col]).strip() if pd.notna(row[joint_type_fs_col]) else None
                    if joint_type_fs == 'nan' or joint_type_fs == '':
                        joint_type_fs = None
                
                if 'activity_id' in df.columns or 'Activity_ID' in df.columns or 'Activity ID' in df.columns:
                    activity_id_col = 'activity_id' if 'activity_id' in df.columns else ('Activity_ID' if 'Activity_ID' in df.columns else 'Activity ID')
                    activity_id = str(row[activity_id_col]).strip() if pd.notna(row[activity_id_col]) else None
                    if activity_id == 'nan' or activity_id == '':
                        activity_id = None
                
                # 检查必需字段
                if not joint_type_fs or not activity_id:
                    print(f"  ⚠️  图纸编号 {drawing_number} 缺少必需字段 (joint_type_fs={joint_type_fs}, activity_id={activity_id})，跳过")
                    continue
                
                # 检查是否已存在（使用复合唯一键：drawing_number + joint_type_fs + activity_id）
                existing = db.query(WeldingNonStandardDrawing).filter(
                    WeldingNonStandardDrawing.drawing_number == drawing_number,
                    WeldingNonStandardDrawing.joint_type_fs == joint_type_fs,
                    WeldingNonStandardDrawing.activity_id == activity_id
                ).first()
                if existing:
                    print(f"  ⚠️  记录已存在 (drawing_number={drawing_number}, joint_type_fs={joint_type_fs}, activity_id={activity_id})，跳过")
                    continue
                
                if 'Description' in df.columns or 'description' in df.columns:
                    desc_col = 'Description' if 'Description' in df.columns else 'description'
                    description = str(row[desc_col]).strip() if pd.notna(row[desc_col]) else None
                    if description == 'nan' or description == '':
                        description = None
                
                # 创建新记录
                db_item = WeldingNonStandardDrawing(
                    drawing_number=drawing_number,
                    joint_type_fs=joint_type_fs,
                    activity_id=activity_id,
                    description=description
                )
                db.add(db_item)
                db.commit()  # 逐条提交
                count += 1
            except Exception as e:
                db.rollback()
                print(f"  ⚠️  导入图纸编号 {row.get(drawing_col, 'unknown')} 失败: {e}")
                continue
        
        print(f"✅ 成功导入 {count} 条非标准图纸")
        return count
    except Exception as e:
        db.rollback()
        print(f"❌ 导入非标准图纸失败: {e}")
        import traceback
        traceback.print_exc()
        return 0


def import_constcontractor_mappings(db):
    """导入ConstContractor映射"""
    try:
        df = pd.read_excel(EXCEL_FILE, sheet_name='constcontractor')
        print(f"读取到 {len(df)} 条ConstContractor映射数据")
        
        # 尝试不同的列名
        const_col = None
        scope_col = None
        
        for col in ['ConstContractor', 'constcontractor', 'CONSTCONTRACTOR']:
            if col in df.columns:
                const_col = col
                break
        
        for col in ['Scope', 'scope', 'SCOPE']:
            if col in df.columns:
                scope_col = col
                break
        
        if not const_col or not scope_col:
            print(f"❌ 未找到必要的列: ConstContractor={const_col}, Scope={scope_col}")
            return 0
        
        count = 0
        for _, row in df.iterrows():
            try:
                constcontractor = str(row[const_col]).strip()
                scope = str(row[scope_col]).strip()
                
                if pd.isna(constcontractor) or constcontractor == '' or constcontractor == 'nan':
                    continue
                if pd.isna(scope) or scope == '' or scope == 'nan':
                    continue
                
                # 检查是否已存在
                existing = db.query(WeldingConstContractorMapping).filter(
                    WeldingConstContractorMapping.constcontractor == constcontractor
                ).first()
                if existing:
                    print(f"  ⚠️  ConstContractor {constcontractor} 已存在，跳过")
                    continue
                
                # 获取描述
                description = None
                if 'Description' in df.columns or 'description' in df.columns:
                    desc_col = 'Description' if 'Description' in df.columns else 'description'
                    description = str(row[desc_col]).strip() if pd.notna(row[desc_col]) else None
                    if description == 'nan' or description == '':
                        description = None
                
                # 创建新记录
                db_item = WeldingConstContractorMapping(
                    constcontractor=constcontractor,
                    scope=scope,
                    description=description
                )
                db.add(db_item)
                db.commit()  # 逐条提交
                count += 1
            except Exception as e:
                db.rollback()
                print(f"  ⚠️  导入ConstContractor {row.get(const_col, 'unknown')} 失败: {e}")
                continue
        
        print(f"✅ 成功导入 {count} 条ConstContractor映射")
        return count
    except Exception as e:
        db.rollback()
        print(f"❌ 导入ConstContractor映射失败: {e}")
        import traceback
        traceback.print_exc()
        return 0


def main():
    """主函数"""
    if not os.path.exists(EXCEL_FILE):
        print(f"❌ Excel文件不存在: {EXCEL_FILE}")
        return
    
    print(f"📂 读取Excel文件: {EXCEL_FILE}")
    
    db = SessionLocal()
    try:
        total = 0
        
        print("\n" + "="*50)
        print("开始导入 Marka代码...")
        print("="*50)
        total += import_marka_codes(db)
        
        print("\n" + "="*50)
        print("开始导入 非标准图纸...")
        print("="*50)
        total += import_non_standard_drawings(db)
        
        print("\n" + "="*50)
        print("开始导入 ConstContractor映射...")
        print("="*50)
        total += import_constcontractor_mappings(db)
        
        print("\n" + "="*50)
        print(f"✅ 导入完成！共导入 {total} 条记录")
        print("="*50)
        
    except Exception as e:
        print(f"❌ 导入过程出错: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    main()

