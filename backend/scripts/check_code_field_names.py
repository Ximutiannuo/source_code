"""
检查代码中是否还有遗漏的旧字段名

检查所有代码文件，查找是否还有未更新的旧字段名
"""

import re
from pathlib import Path
import sys

# 旧字段名列表（需要检查的）
OLD_FIELDS = [
    # activities表
    r'\bact_id\b',
    r'\bact_description\b',
    
    # mpdb/vfactdb表
    r'\bgcc_scope\b',
    r'\bgcc_block\b',
    r'\bgcc_discipline\b',
    r'\bgcc_workpackage\b',
    r'\bgcc_project\b',
    r'\bgcc_subproject\b',
    r'\bgcc_phase\b',
    r'\bgcc_train\b',
    r'\bgcc_unit\b',
    r'\bbcc_quarter\b',
    r'\bactivity_description\b',
    r'\bgcc_description\b',
    
    # activity_summary表
    r'\bworkpackage\b',  # 注意：可能在其他地方也是合法的
    r'\bsubproject_code\b',
    r'\bphase\b',  # 注意：这个可能在其他地方也是合法的
    r'\bbcc_work_package\b',
    r'\bgcc_simpblk\b',
    r'\bbcc_startup_sequence\b',
]

# 需要检查的目录
DIRECTORIES_TO_CHECK = [
    'backend/app/api',
    'backend/app/services',
    'backend/app/models',
    'backend/app/p6_sync',
    'frontend/src',
    'backend/scripts',
]

# 排除的文件/目录
EXCLUDE_PATTERNS = [
    'node_modules',
    '__pycache__',
    '.bak',
    'update_code_field_names.py',
    'check_code_field_names.py',
    'migrate_unify_column_names.py',
    'test_update_single_file.py',
]

# 允许的上下文（这些情况下出现旧字段名是正常的）
ALLOWED_CONTEXTS = [
    r'#.*旧字段',  # 注释中的旧字段名
    r'"""[\s\S]*?旧字段',  # 文档字符串中的旧字段名
    r"'''[\s\S]*?旧字段",  # 文档字符串中的旧字段名
    r'column_names_mapping\.md',  # 映射文档中的字段名
    r'unify_column_names\.md',  # 文档中的字段名
]

def read_file_safe(file_path):
    """安全读取文件"""
    encodings = ['utf-8', 'utf-8-sig', 'gbk', 'gb2312', 'latin-1']
    for encoding in encodings:
        try:
            with open(file_path, 'r', encoding=encoding) as f:
                return f.read(), encoding
        except (UnicodeDecodeError, LookupError):
            continue
    # 如果都失败，使用UTF-8并忽略错误
    try:
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            return f.read(), 'utf-8'
    except Exception:
        return None, None

def is_allowed_context(content, match_pos):
    """检查匹配位置是否在允许的上下文中"""
    # 检查前后50个字符的上下文
    start = max(0, match_pos - 50)
    end = min(len(content), match_pos + 50)
    context = content[start:end]
    
    for pattern in ALLOWED_CONTEXTS:
        if re.search(pattern, context, re.IGNORECASE):
            return True
    return False

def check_file(file_path):
    """检查单个文件"""
    content, encoding = read_file_safe(file_path)
    if content is None:
        return None, f"无法读取文件（编码问题）"
    
    issues = []
    
    for old_field_pattern in OLD_FIELDS:
        pattern = re.compile(old_field_pattern, re.IGNORECASE)
        matches = list(pattern.finditer(content))
        
        for match in matches:
            # 检查是否在允许的上下文中
            if is_allowed_context(content, match.start()):
                continue
            
            # 获取匹配行的上下文
            line_start = content.rfind('\n', 0, match.start()) + 1
            line_end = content.find('\n', match.end())
            if line_end == -1:
                line_end = len(content)
            line_content = content[line_start:line_end]
            line_num = content[:match.start()].count('\n') + 1
            
            issues.append({
                'field': match.group(),
                'line': line_num,
                'context': line_content.strip(),
            })
    
    return issues, encoding

def main():
    """主函数"""
    project_root = Path(__file__).parent.parent.parent
    
    print("=" * 60)
    print("检查代码中遗漏的旧字段名")
    print("=" * 60)
    
    all_issues = {}
    files_checked = 0
    
    for dir_name in DIRECTORIES_TO_CHECK:
        dir_path = project_root / dir_name
        if not dir_path.exists():
            print(f"\n警告: 目录不存在: {dir_path}")
            continue
        
        print(f"\n检查目录: {dir_path}")
        
        # 遍历所有代码文件
        for ext in ['*.py', '*.ts', '*.tsx', '*.js', '*.jsx']:
            for file_path in dir_path.rglob(ext):
                # 跳过排除的文件
                if any(pattern in str(file_path) for pattern in EXCLUDE_PATTERNS):
                    continue
                
                files_checked += 1
                issues, encoding = check_file(file_path)
                
                if issues is None:
                    print(f"  错误: {file_path.relative_to(project_root)}: {encoding}")
                    continue
                
                if issues:
                    all_issues[str(file_path.relative_to(project_root))] = {
                        'issues': issues,
                        'encoding': encoding
                    }
    
    print("\n" + "=" * 60)
    print("检查结果")
    print("=" * 60)
    print(f"检查了 {files_checked} 个文件")
    
    if all_issues:
        print(f"\n发现 {len(all_issues)} 个文件可能还有旧字段名：")
        print("=" * 60)
        
        for file_path, data in sorted(all_issues.items()):
            print(f"\n文件: {file_path} [{data['encoding']}]")
            for issue in data['issues']:
                print(f"  行 {issue['line']}: {issue['field']}")
                print(f"    上下文: {issue['context'][:80]}...")
        
        print("\n" + "=" * 60)
        print("注意：")
        print("  1. 请检查上述文件，确认是否需要更新")
        print("  2. 某些旧字段名可能在注释或文档中，这是正常的")
        print("  3. 某些字段名可能在其他上下文中使用，需要手动判断")
        print("=" * 60)
    else:
        print("\n✅ 未发现遗漏的旧字段名！")
        print("=" * 60)

if __name__ == "__main__":
    main()

