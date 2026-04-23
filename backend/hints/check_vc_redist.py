"""
检查已安装的 Visual C++ Redistributable 版本
"""
import subprocess
import re

print("=" * 60)
print("检查 Visual C++ Redistributable 安装情况")
print("=" * 60)
print()

try:
    # 使用 PowerShell 查询已安装的 VC++ Redistributable
    cmd = 'powershell "Get-WmiObject -Class Win32_Product | Where-Object {$_.Name -like \'*Visual C++*Redistributable*\'} | Select-Object Name, Version | Format-Table -AutoSize"'
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
    
    if result.returncode == 0 and result.stdout.strip():
        print("已安装的 Visual C++ Redistributable：")
        print(result.stdout)
    else:
        print("⚠️ 无法查询已安装的版本（可能需要管理员权限）")
        print("或者使用以下方法手动检查：")
        print("  1. 打开'控制面板' > '程序和功能'")
        print("  2. 搜索'Microsoft Visual C++'")
        print("  3. 查看已安装的版本")
except Exception as e:
    print(f"查询失败: {e}")
    print("\n手动检查方法：")
    print("  1. 打开'控制面板' > '程序和功能'")
    print("  2. 搜索'Microsoft Visual C++'")
    print("  3. 查看已安装的版本")

print()
print("=" * 60)
print("结论：")
print("从安装日志看，系统已安装 14.50.35710.0 版本")
print("这个版本足够新，应该支持 numpy 和 pandas")
print("问题可能不在 Visual C++ Redistributable")
print("=" * 60)

