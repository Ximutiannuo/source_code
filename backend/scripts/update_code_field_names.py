"""
批量更新代码中的字段名
根据 column_names_mapping.md 更新所有代码文件

注意：会检测文件编码，确保不会破坏文件
"""

import os
import re
import shutil
from pathlib import Path

# 尝试导入chardet，如果没有则使用备用方案
try:
    import chardet  # pyright: ignore[reportMissingImports]
    HAS_CHARDET = True
except ImportError:
    HAS_CHARDET = False

# 字段名映射字典
FIELD_MAPPINGS = {
    # activities表
    'act_id': 'activity_id',
    'act_description': 'title',
    
    # mpdb/vfactdb表
    'gcc_scope': 'scope',
    'gcc_block': 'block',
    'gcc_discipline': 'discipline',
    'gcc_workpackage': 'work_package',
    'gcc_project': 'project',
    'gcc_subproject': 'subproject',
    'gcc_phase': 'implement_phase',
    'gcc_train': 'train',
    'gcc_unit': 'unit',
    'bcc_quarter': 'quarter',
    'activity_description': 'title',
    'gcc_description': 'title',
    
    # activity_summary表
    'workpackage': 'work_package',
    'subproject_code': 'subproject',
    'phase': 'implement_phase',  # 注意：只在activity_summary表中
    'bcc_work_package': 'contract_phase',
    'gcc_simpblk': 'simple_block',
    'bcc_startup_sequence': 'start_up_sequence',
    
    # facilities表
    # subproject_code 和 bcc_quarter 已在上面
}

# 需要更新的目录
DIRECTORIES_TO_UPDATE = [
    'backend/app/api',
    'backend/app/services',
    'frontend/src',
]

def detect_encoding(file_path):
    """检测文件编码"""
    # 优先尝试的编码列表（按常见程度排序）
    encodings_to_try = ['utf-8', 'utf-8-sig', 'gbk', 'gb2312', 'latin-1', 'cp1252']
    
    # 如果安装了chardet，使用它来检测
    if HAS_CHARDET:
        try:
            with open(file_path, 'rb') as f:
                raw_data = f.read(1024)
            
            if raw_data:
                result = chardet.detect(raw_data)
                detected_encoding = result.get('encoding')
                confidence = result.get('confidence', 0)
                
                # 如果置信度足够高，将检测到的编码放在最前面
                if detected_encoding and confidence > 0.7:
                    # 映射到标准编码名
                    encoding_map = {
                        'ascii': 'utf-8',
                        'Windows-1252': 'utf-8',
                        'ISO-8859-1': 'utf-8',
                    }
                    detected_encoding = encoding_map.get(detected_encoding, detected_encoding)
                    if detected_encoding not in encodings_to_try:
                        encodings_to_try.insert(0, detected_encoding)
        except Exception:
            pass
    
    # 尝试读取文件来确定编码
    for encoding in encodings_to_try:
        try:
            with open(file_path, 'r', encoding=encoding) as f:
                f.read()
            return encoding
        except (UnicodeDecodeError, LookupError):
            continue
    
    # 默认返回UTF-8
    return 'utf-8'

def read_file_safe(file_path):
    """安全读取文件，自动检测编码"""
    encodings_to_try = ['utf-8', 'utf-8-sig', 'gbk', 'gb2312', 'latin-1']
    
    # 先尝试检测编码
    detected_encoding = detect_encoding(file_path)
    if detected_encoding:
        encodings_to_try.insert(0, detected_encoding)
    
    for encoding in encodings_to_try:
        try:
            with open(file_path, 'r', encoding=encoding) as f:
                content = f.read()
            return content, encoding
        except (UnicodeDecodeError, LookupError):
            continue
    
    # 如果所有编码都失败，使用UTF-8并忽略错误
    try:
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
        return content, 'utf-8'
    except Exception as e:
        raise Exception(f"无法读取文件 {file_path}: {str(e)}")

def write_file_safe(file_path, content, encoding='utf-8'):
    """安全写入文件"""
    try:
        with open(file_path, 'w', encoding=encoding, newline='') as f:
            f.write(content)
        return True
    except Exception as e:
        raise Exception(f"无法写入文件 {file_path}: {str(e)}")

def update_file(file_path, backup=True, dry_run=False):
    """更新单个文件
    
    Args:
        file_path: 文件路径
        backup: 是否创建备份
        dry_run: 是否为试运行（不实际保存）
    
    Returns:
        (是否更新, 使用的编码, 变更列表)
    """
    try:
        # 读取文件并检测编码
        original_content, file_encoding = read_file_safe(file_path)
        
        # 创建备份
        if backup and not dry_run:
            backup_path = file_path.with_suffix(file_path.suffix + '.bak')
            try:
                shutil.copy2(file_path, backup_path)
            except Exception as e:
                print(f"  警告: 无法创建备份 {backup_path}: {str(e)}")
        
        content = original_content
        
        # 替换字段名（注意顺序，先替换长的，避免部分匹配）
        # 按长度降序排序，先替换长的字段名
        sorted_mappings = sorted(FIELD_MAPPINGS.items(), key=lambda x: len(x[0]), reverse=True)
        
        changes_made = []
        for old_field, new_field in sorted_mappings:
            # 使用单词边界确保精确匹配
            pattern = r'\b' + re.escape(old_field) + r'\b'
            new_content = re.sub(pattern, new_field, content)
            if new_content != content:
                # 统计替换次数
                count = len(re.findall(pattern, content))
                changes_made.append(f"{old_field} -> {new_field} ({count}次)")
                content = new_content
        
        if content != original_content:
            if not dry_run:
                # 使用原文件的编码保存
                write_file_safe(file_path, content, file_encoding)
            return True, file_encoding, changes_made
        return False, file_encoding, []
    except Exception as e:
        print(f"  错误: 更新文件失败 {file_path}: {str(e)}")
        import traceback
        traceback.print_exc()
        return False, None, []

def main():
    """主函数"""
    project_root = Path(__file__).parent.parent.parent
    
    print("=" * 60)
    print("批量更新代码中的字段名")
    print("=" * 60)
    print("\n注意：")
    print("  1. 会自动检测文件编码，保持原编码")
    print("  2. 会为每个文件创建 .bak 备份")
    print("  3. 只更新匹配的字段名，不会破坏其他内容")
    
    # 先进行试运行
    print("\n先进行试运行（不实际修改文件）...")
    test_updated = []
    for dir_name in DIRECTORIES_TO_UPDATE[:1]:  # 只测试第一个目录
        dir_path = project_root / dir_name
        if not dir_path.exists():
            continue
        for ext in ['*.py']:
            for file_path in list(dir_path.rglob(ext))[:3]:  # 只测试前3个文件
                if 'node_modules' in str(file_path) or '__pycache__' in str(file_path):
                    continue
                try:
                    updated, encoding, changes = update_file(file_path, backup=False, dry_run=True)
                    if updated:
                        test_updated.append((file_path, encoding, changes))
                        print(f"  [试运行] 会更新 [{encoding}]: {file_path.relative_to(project_root)}")
                        if changes:
                            print(f"    变更: {', '.join(changes[:3])}")
                except Exception as e:
                    print(f"  [试运行] 错误: {file_path.relative_to(project_root)}: {str(e)}")
    
    if test_updated:
        print(f"\n试运行完成，发现 {len(test_updated)} 个文件需要更新")
    else:
        print("\n试运行完成，未发现需要更新的文件")
    
    confirm = input("\n确认继续实际更新？(yes/no): ")
    if confirm.lower() != 'yes':
        print("已取消")
        return
    
    updated_files = []
    skipped_files = []
    error_files = []
    
    for dir_name in DIRECTORIES_TO_UPDATE:
        dir_path = project_root / dir_name
        if not dir_path.exists():
            print(f"\n警告: 目录不存在: {dir_path}")
            continue
        
        print(f"\n处理目录: {dir_path}")
        
        # 遍历所有Python/TypeScript文件
        for ext in ['*.py', '*.ts', '*.tsx']:
            for file_path in dir_path.rglob(ext):
                # 跳过node_modules和__pycache__和备份文件
                if 'node_modules' in str(file_path) or '__pycache__' in str(file_path) or file_path.suffix == '.bak':
                    continue
                
                try:
                    updated, encoding, changes = update_file(file_path, backup=True, dry_run=False)
                    if updated:
                        updated_files.append((file_path, encoding, changes))
                        changes_str = ", ".join(changes[:2])  # 只显示前2个变更
                        if len(changes) > 2:
                            changes_str += f" ... (共{len(changes)}个变更)"
                        print(f"  已更新 [{encoding}]: {file_path.relative_to(project_root)}")
                        if changes:
                            print(f"    变更: {changes_str}")
                    else:
                        skipped_files.append(file_path)
                except Exception as e:
                    error_files.append((file_path, str(e)))
                    print(f"  错误: {file_path.relative_to(project_root)}: {str(e)}")
    
    print("\n" + "=" * 60)
    print("更新完成！")
    print("=" * 60)
    print(f"  已更新: {len(updated_files)} 个文件")
    print(f"  未修改: {len(skipped_files)} 个文件")
    if error_files:
        print(f"  错误: {len(error_files)} 个文件")
        print("\n错误文件列表:")
        for file_path, error in error_files:
            print(f"    {file_path.relative_to(project_root)}: {error}")
    
    if updated_files:
        print("\n已更新的文件:")
        for item in updated_files[:10]:  # 只显示前10个
            if len(item) == 3:
                file_path, encoding, changes = item
            else:
                file_path, encoding = item[0], item[1]
            print(f"  [{encoding}] {file_path.relative_to(project_root)}")
        if len(updated_files) > 10:
            print(f"  ... 还有 {len(updated_files) - 10} 个文件")
    
    print("\n提示: 备份文件已创建（.bak），如有问题可以恢复")
    print("=" * 60)

if __name__ == "__main__":
    main()

