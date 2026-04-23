"""
测试单个文件的字段名更新
用于验证编码处理是否正确
"""

import sys
from pathlib import Path

project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from scripts.update_code_field_names import update_file, read_file_safe, detect_encoding

def test_file(file_path_str):
    """测试单个文件"""
    file_path = Path(file_path_str)
    
    if not file_path.exists():
        print(f"文件不存在: {file_path}")
        return
    
    print(f"测试文件: {file_path}")
    print(f"文件大小: {file_path.stat().st_size} 字节")
    
    # 检测编码
    encoding = detect_encoding(file_path)
    print(f"检测到的编码: {encoding}")
    
    # 读取文件
    try:
        content, actual_encoding = read_file_safe(file_path)
        print(f"实际使用的编码: {actual_encoding}")
        print(f"文件内容长度: {len(content)} 字符")
        
        # 检查前100个字符
        preview = content[:100].replace('\n', '\\n')
        print(f"文件前100字符预览: {preview}")
        
        # 检查是否包含中文字符
        has_chinese = any('\u4e00' <= char <= '\u9fff' for char in content)
        print(f"包含中文字符: {has_chinese}")
        
        # 尝试更新（不实际保存）
        print("\n模拟更新（不保存）...")
        updated, encoding_used = update_file(file_path, backup=False)
        if updated:
            print(f"  会更新文件，使用编码: {encoding_used}")
        else:
            print("  文件无需更新")
            
    except Exception as e:
        print(f"错误: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        test_file(sys.argv[1])
    else:
        # 测试一个示例文件
        test_file = project_root / "backend/app/api/reports.py"
        if test_file.exists():
            test_file(str(test_file))
        else:
            print("请提供要测试的文件路径作为参数")

