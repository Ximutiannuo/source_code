import sys
import os
import re
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from app.database import SessionLocal
from app.models.workstep import WorkStepDefine
from app.models.report import VFACTDB
from sqlalchemy import text, func, and_, desc

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

def transliterate_russian(text_str: str) -> str:
    if not text_str: return text_str
    return ''.join(RUSSIAN_TO_LATIN.get(char, char) for char in text_str)

def clean_text_old(text_str: str) -> str:
    if not text_str: return text_str
    text_str = transliterate_russian(text_str)
    # 旧逻辑：移除了 / 和 &
    text_str = re.sub(r'[^\w\s\-.,;:()\[\]{}]', '', text_str)
    text_str = re.sub(r'\s+', ' ', text_str).strip()
    return text_str

def get_vfactdb_stats(db):
    """
    获取 vfactdb 中工作步骤描述的匹配统计情况
    返回: (已匹配总行数, 未匹配总行数, 未匹配的描述列表)
    """
    # 只获取关键工程量的定义（vfactdb 只应该包含关键工程量）
    defines = db.query(WorkStepDefine.work_package, WorkStepDefine.work_step_description).filter(
        WorkStepDefine.is_key_quantity == True
    ).all()
    define_map = set((d.work_package, d.work_step_description) for d in defines)
    
    # 获取 vfactdb 中的所有不同描述
    vfact_records = db.query(
        VFACTDB.work_package, 
        VFACTDB.work_step_description, 
        func.count(VFACTDB.id).label('count')
    ).group_by(VFACTDB.work_package, VFACTDB.work_step_description).all()
    
    matched_count = 0
    unmatched_count = 0
    unmatched_details = []
    
    for r in vfact_records:
        if not r.work_package or not r.work_step_description:
            unmatched_count += r.count
            unmatched_details.append((r.work_package, r.work_step_description, r.count))
            continue
            
        if (r.work_package, r.work_step_description) in define_map:
            matched_count += r.count
        else:
            unmatched_count += r.count
            unmatched_details.append((r.work_package, r.work_step_description, r.count))
            
    return matched_count, unmatched_count, unmatched_details

def fix_vfactdb_descriptions():
    db = SessionLocal()
    try:
        print("\n=== 第一阶段: 初始状态验证 ===")
        m_before, u_before, details_before = get_vfactdb_stats(db)
        print(f"当前统计: 已匹配定义 {m_before} 条记录, 未匹配 {u_before} 条记录")
        if u_before > 0:
            print(f"前 5 种未匹配的描述:")
            for wp, desc, cnt in sorted(details_before, key=lambda x: x[2], reverse=True)[:5]:
                print(f"  - [{wp}] {desc} ({cnt} 行)")

        # 1. 修复特殊字符问题（关键工程量的描述被错误清洗）
        print("\n=== 第二阶段: 修复特殊字符问题 ===")
        defines = db.query(WorkStepDefine).filter(WorkStepDefine.is_key_quantity == True).all()
        mapping = {}
        for d in defines:
            if not d.work_step_description: continue
            cleaned = clean_text_old(d.work_step_description)
            if cleaned != d.work_step_description:
                key = (d.work_package, cleaned)
                mapping[key] = d.work_step_description
        
        total_fixed_chars = 0
        if mapping:
            print(f"找到 {len(mapping)} 个基于定义的可能修复映射（特殊字符问题）。")
            for (wp, cleaned_desc), correct_desc in mapping.items():
                sql = text("""
                    UPDATE vfactdb 
                    SET work_step_description = :correct_desc
                    WHERE work_package = :wp 
                    AND work_step_description = :cleaned_desc
                """)
                result = db.execute(sql, {
                    "correct_desc": correct_desc,
                    "wp": wp,
                    "cleaned_desc": cleaned_desc
                })
                if result.rowcount > 0:
                    print(f"  修复特殊字符: [{wp}] '{cleaned_desc}' -> '{correct_desc}' ({result.rowcount} 行)")
                    total_fixed_chars += result.rowcount
        else:
            print("未发现需要修复的特殊字符问题。")

        # 2. 修复非关键工程量问题：将非关键工程量的描述改为同一工作包的上一个关键工程量描述
        print("\n=== 第三阶段: 修复非关键工程量问题 ===")
        
        # 获取所有工作包的关键工程量定义，按 work_package 和 sort_order 排序
        key_defines_by_wp = {}
        for d in defines:
            if not d.work_package or not d.work_step_description:
                continue
            if d.work_package not in key_defines_by_wp:
                key_defines_by_wp[d.work_package] = []
            key_defines_by_wp[d.work_package].append(d)
        
        # 对每个工作包的关键工程量按 sort_order 排序
        for wp in key_defines_by_wp:
            key_defines_by_wp[wp].sort(key=lambda x: x.sort_order)
        
        # 获取所有非关键工程量的定义
        non_key_defines = db.query(WorkStepDefine).filter(
            WorkStepDefine.is_key_quantity == False
        ).all()
        
        # 建立非关键工程量到上一个关键工程量的映射
        # 需要同时考虑原始描述和清洗后的描述（因为 vfactdb 中可能已经是清洗后的）
        non_key_to_key_mapping = {}
        for non_key in non_key_defines:
            if not non_key.work_package or not non_key.work_step_description:
                continue
            
            wp = non_key.work_package
            if wp not in key_defines_by_wp:
                # 如果该工作包没有关键工程量，跳过
                continue
            
            # 找到 sort_order 小于当前非关键工程量的最大 sort_order 的关键工程量
            prev_key = None
            for key_def in key_defines_by_wp[wp]:
                if key_def.sort_order < non_key.sort_order:
                    prev_key = key_def
                else:
                    break
            
            # 如果没找到（说明非关键工程量的 sort_order 比所有关键工程量都小），使用第一个关键工程量
            if not prev_key and key_defines_by_wp[wp]:
                prev_key = key_defines_by_wp[wp][0]
            
            # 如果找到了关键工程量，建立映射
            # 同时映射原始描述和清洗后的描述
            if prev_key:
                # 原始描述
                non_key_to_key_mapping[(wp, non_key.work_step_description)] = prev_key.work_step_description
                # 清洗后的描述（如果不同）
                cleaned_non_key = clean_text_old(non_key.work_step_description)
                if cleaned_non_key != non_key.work_step_description:
                    non_key_to_key_mapping[(wp, cleaned_non_key)] = prev_key.work_step_description
        
        total_fixed_non_key = 0
        if non_key_to_key_mapping:
            print(f"找到 {len(non_key_to_key_mapping)} 个非关键工程量映射需要修复。")
            for (wp, non_key_desc), key_desc in non_key_to_key_mapping.items():
                sql = text("""
                    UPDATE vfactdb 
                    SET work_step_description = :key_desc
                    WHERE work_package = :wp 
                    AND work_step_description = :non_key_desc
                """)
                result = db.execute(sql, {
                    "key_desc": key_desc,
                    "wp": wp,
                    "non_key_desc": non_key_desc
                })
                if result.rowcount > 0:
                    print(f"  修复非关键工程量: [{wp}] '{non_key_desc}' -> '{key_desc}' ({result.rowcount} 行)")
                    total_fixed_non_key += result.rowcount
        else:
            print("未发现需要修复的非关键工程量问题。")
        
        total_fixed = total_fixed_chars + total_fixed_non_key
        if total_fixed > 0:
            print(f"\n修复操作完成，共修复 {total_fixed} 条记录（特殊字符: {total_fixed_chars}, 非关键工程量: {total_fixed_non_key}）。")

        db.commit()

        print("\n=== 第四阶段: 修复后结果验证 ===")
        m_after, u_after, details_after = get_vfactdb_stats(db)
        print(f"修复后统计: 已匹配定义 {m_after} 条记录 (较之前 +{m_after - m_before}), 未匹配 {u_after} 条记录")
        
        if u_after > 0:
            print(f"剩余 {u_after} 条记录仍未匹配，可能需要人工检查。")
            if u_after < u_before:
                # 如果有改善，列出剩余的
                print(f"剩余未匹配的前 5 种描述:")
                for wp, desc, cnt in sorted(details_after, key=lambda x: x[2], reverse=True)[:5]:
                    print(f"  - [{wp}] {desc} ({cnt} 行)")
        else:
            print("所有记录现在都已成功匹配到定义！")

        print("\n注：已验证 updated_at 和 is_system_sync 字段保持不变。")

    except Exception as e:
        db.rollback()
        print(f"\n发生错误: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    fix_vfactdb_descriptions()
