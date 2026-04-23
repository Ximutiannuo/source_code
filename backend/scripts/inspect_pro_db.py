
import pymysql
import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv(dotenv_path='backend/.env')

def check_pro_schema():
    """检查 pro 数据库的表结构"""
    try:
        # 尝试连接到 pro 数据库
        # 注意：这里假设 root 用户有权限访问 pro，或者使用 .env 中的凭据
        connection = pymysql.connect(
            host=os.getenv("MYSQL_SERVER", "localhost"),
            database='pro',
            user=os.getenv("MYSQL_USER", "root"),
            password=os.getenv("MYSQL_PASSWORD", "root")
        )

        if connection.open:
            with connection.cursor() as cursor:
                print("Successfully connected to database: pro")
                
                tables = ['PRODB_DIMENSION', 'PRODB_FACT']
                
                for table in tables:
                    print(f"\n--- Structure for {table} ---")
                    try:
                        cursor.execute(f"DESCRIBE {table}")
                        result = cursor.fetchall()
                        for row in result:
                            print(row)
                            
                        # 顺便看一眼数据样例，确认字段内容
                        cursor.execute(f"SELECT * FROM {table} LIMIT 1")
                        rows = cursor.fetchall()
                        if rows:
                            print(f"Sample data: {rows[0]}")
                    except Exception as e:
                        print(f"Error describing {table}: {e}")

    except Exception as e:
        print(f"Error while connecting to MySQL: {e}")
    finally:
        if 'connection' in locals() and connection.open:
            connection.close()

if __name__ == '__main__':
    check_pro_schema()
