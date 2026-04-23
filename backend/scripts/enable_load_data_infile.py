"""
启用 MySQL LOAD DATA LOCAL INFILE 配置脚本

此脚本会：
1. 在 MySQL 服务器端启用 local_infile（全局设置）
2. 检查并显示当前配置状态
3. 提供配置验证

使用方法:
    python backend/scripts/enable_load_data_infile.py
"""
import sys
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from sqlalchemy import text
from app.database import SessionLocal
import traceback


def check_local_infile_status(db):
    """检查当前 local_infile 配置状态"""
    print("\n" + "=" * 60)
    print("检查当前 local_infile 配置")
    print("=" * 60)
    
    try:
        # 检查全局变量
        global_result = db.execute(text("SHOW GLOBAL VARIABLES LIKE 'local_infile'")).fetchone()
        if global_result:
            print(f"  全局 local_infile: {global_result[1]}")
        else:
            print("  全局 local_infile: 未找到")
        
        # 检查会话变量
        session_result = db.execute(text("SHOW VARIABLES LIKE 'local_infile'")).fetchone()
        if session_result:
            print(f"  会话 local_infile: {session_result[1]}")
        else:
            print("  会话 local_infile: 未找到")
        
        return global_result[1] if global_result else None
        
    except Exception as e:
        print(f"  ❌ 检查配置失败: {str(e)}")
        return None


def enable_local_infile(db):
    """启用 local_infile（全局设置）"""
    print("\n" + "=" * 60)
    print("启用 local_infile（全局）")
    print("=" * 60)
    
    try:
        # 设置全局变量
        db.execute(text("SET GLOBAL local_infile = 1"))
        db.commit()
        print("  ✅ 已设置 SET GLOBAL local_infile = 1")
        
        # 验证设置
        result = db.execute(text("SHOW GLOBAL VARIABLES LIKE 'local_infile'")).fetchone()
        if result and result[1] == 'ON':
            print("  ✅ 验证成功：local_infile 已启用（ON）")
            return True
        else:
            print(f"  ⚠️  警告：设置后状态为 {result[1] if result else '未知'}")
            return False
            
    except Exception as e:
        print(f"  ❌ 启用 local_infile 失败: {str(e)}")
        db.rollback()
        return False


def check_max_allowed_packet(db):
    """检查 max_allowed_packet 配置"""
    print("\n" + "=" * 60)
    print("检查 max_allowed_packet 配置")
    print("=" * 60)
    
    try:
        result = db.execute(text("SHOW VARIABLES LIKE 'max_allowed_packet'")).fetchone()
        if result:
            value = int(result[1])
            value_mb = value / (1024 * 1024)
            print(f"  当前值: {value_mb:.2f} MB ({value} 字节)")
            
            if value < 512 * 1024 * 1024:  # 小于 512MB
                print(f"  ⚠️  建议：max_allowed_packet 应该至少为 512MB（当前 {value_mb:.2f} MB）")
                print(f"  可以执行: SET GLOBAL max_allowed_packet = 1073741824;  # 1GB")
            else:
                print(f"  ✅ max_allowed_packet 配置正常")
        else:
            print("  ⚠️  未找到 max_allowed_packet 配置")
            
    except Exception as e:
        print(f"  ❌ 检查 max_allowed_packet 失败: {str(e)}")


def main():
    """主函数"""
    print("=" * 60)
    print("MySQL LOAD DATA LOCAL INFILE 配置工具")
    print("=" * 60)
    print("\n此脚本将启用 MySQL 服务器端的 local_infile 配置")
    print("注意：客户端连接时也需要设置 local_infile=1（已在 database.py 中配置）")
    
    db = SessionLocal()
    
    try:
        # 步骤1: 检查当前状态
        current_status = check_local_infile_status(db)
        
        # 步骤2: 如果未启用，则启用
        if current_status != 'ON':
            success = enable_local_infile(db)
            if success:
                print("\n✅ local_infile 已成功启用！")
            else:
                print("\n❌ 启用 local_infile 失败，请检查错误信息")
                return False
        else:
            print("\n✅ local_infile 已经启用，无需修改")
        
        # 步骤3: 再次检查确认
        print("\n" + "=" * 60)
        print("最终配置确认")
        print("=" * 60)
        final_status = check_local_infile_status(db)
        
        # 步骤4: 检查其他相关配置
        check_max_allowed_packet(db)
        
        # 完成提示
        print("\n" + "=" * 60)
        print("配置完成")
        print("=" * 60)
        print("✅ MySQL 服务器端 local_infile 已启用")
        print("\n📝 重要提示：")
        print("   1. 此设置会在 MySQL 重启后失效（除非修改配置文件）")
        print("   2. 如需永久配置，请编辑 MySQL 配置文件：")
        print("      Windows: C:/ProgramData/MySQL/MySQL Server 8.0/my.ini")
        print("      在 [mysqld] 和 [mysql] 部分添加: local_infile = 1")
        print("   3. 修改配置文件后需要重启 MySQL 服务")
        print("   4. 客户端连接配置已在 database.py 中设置 local_infile=1")
        print("\n🚀 现在可以重新运行同步脚本了！")
        print("=" * 60)
        
        return True
        
    except Exception as e:
        print(f"\n❌ 执行异常: {e}")
        print(f"详细信息: {traceback.format_exc()}")
        return False
        
    finally:
        db.close()


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

