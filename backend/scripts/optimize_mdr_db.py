import pymysql
import os
import sys
import re
import getpass
from pathlib import Path

def get_db_config():
    """从环境变量、.env 文件或手动输入获取数据库配置"""
    # 尝试从当前目录或父目录寻找 .env
    env_path = Path(__file__).parent.parent / '.env'
    if not env_path.exists():
        # 尝试项目根目录
        env_path = Path(__file__).parent.parent.parent / '.env'
    
    db_url = os.getenv("DATABASE_URL")
    
    if not db_url and env_path.exists():
        try:
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.startswith('DATABASE_URL='):
                        db_url = line.split('=', 1)[1].strip().strip('"').strip("'")
                        break
        except Exception as e:
            print(f"读取 .env 文件失败: {e}")
    
    if db_url:
        # 解析 DATABASE_URL
        try:
            # 去掉协议前缀
            url = db_url.split("://")[-1]
            
            # 分离认证和地址
            auth, rest = url.split("@")
            user_pass = auth.split(":")
            user = user_pass[0]
            password = user_pass[1] if len(user_pass) > 1 else ""
            
            # 分离地址和数据库名
            address_db = rest.split("/")
            host_port = address_db[0].split(":")
            host = host_port[0]
            port = int(host_port[1]) if len(host_port) > 1 else 3306
            
            # 获取数据库名 (去掉查询参数)
            db_name = address_db[1].split("?")[0]
            
            return {
                "host": host,
                "port": port,
                "user": user,
                "password": password,
                "database": db_name,
                "charset": "utf8mb4",
                "cursorclass": pymysql.cursors.DictCursor
            }
        except Exception as e:
            print(f"解析 DATABASE_URL 失败: {e}，将进入手动输入模式。")

    # 手动输入模式
    print("\n--- 数据库连接配置 ---")
    host = input("数据库地址 (默认 localhost): ").strip() or "localhost"
    port_input = input("端口 (默认 3306): ").strip() or "3306"
    port = int(port_input)
    user = input("用户名 (默认 root): ").strip() or "root"
    password = getpass.getpass("密码: ")
    db_name = input("数据库名 (默认 projectcontrols): ").strip() or "projectcontrols"
    
    return {
        "host": host,
        "port": port,
        "user": user,
        "password": password,
        "database": db_name,
        "charset": "utf8mb4",
        "cursorclass": pymysql.cursors.DictCursor
    }

def optimize_mdr_database():
    config = get_db_config()
    if not config:
        print("无法获取数据库配置。")
        return

    try:
        print(f"\n正在连接数据库: {config['host']}:{config['port']}, 用户: {config['user']}, 数据库: {config['database']}")
        connection = pymysql.connect(**config)
        with connection.cursor() as cursor:
            # 临时关闭严格模式，允许处理 0000-00-00 日期
            cursor.execute("SET SESSION sql_mode = ''")
            
            print("--- 开始优化 MDR 相关表 ---")

            # 1. 清理非法日期值 '0000-00-00' -> NULL
            tables = ['ext_eng_db_current', 'ext_eng_db_previous']
            for table in tables:
                print(f"1. 正在清理 {table} 中的非法日期 ('0000-00-00' -> NULL)...")
                # 使用 STR_TO_DATE 或直接比较，在 sql_mode='' 下是可以执行的
                cursor.execute(f"UPDATE {table} SET dates = NULL WHERE dates = '0000-00-00' OR dates IS NULL")
                connection.commit()

            # 2. 添加索引优化查询性能
            print("2. 正在检查并添加索引...")
            index_statements = [
                ("ext_eng_db_current", "idx_mdr_filters", "(originator_code, discipline, document_type)"),
                ("ext_eng_db_previous", "idx_mdr_filters", "(originator_code, discipline, document_type)"),
                ("ext_eng_db_current", "idx_mdr_lookup", "(document_number, type_of_dates)"),
                ("ext_eng_db_previous", "idx_mdr_lookup", "(document_number, type_of_dates)"),
                ("ext_eng_db_current", "idx_mdr_dates", "(dates)"),
                ("ext_eng_db_previous", "idx_mdr_dates", "(dates)")
            ]

            for table, idx_name, cols in index_statements:
                try:
                    sql = f"ALTER TABLE {table} ADD INDEX {idx_name} {cols}"
                    print(f"   执行: {sql}")
                    cursor.execute(sql)
                    connection.commit()
                except Exception as e:
                    if "Duplicate key name" in str(e) or "already exists" in str(e).lower():
                        print(f"   - 索引 {idx_name} 已存在，跳过。")
                    else:
                        print(f"   - 执行失败: {e}")

            print("\n--- 数据库优化完成！ ---")

    except pymysql.err.OperationalError as e:
        if e.args[0] == 1045:
            print("\n错误: 数据库访问被拒绝。请确保用户名和密码正确。")
        else:
            print(f"\n数据库连接错误: {e}")
    except Exception as e:
        print(f"\n发生未预期错误: {e}")
    finally:
        if 'connection' in locals() and connection.open:
            connection.close()

if __name__ == "__main__":
    optimize_mdr_database()
