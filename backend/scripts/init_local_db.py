import pymysql

# 数据库连接配置
DB_HOST = "localhost"
DB_USER = "root"
DB_PASS = "Ww@1932635539"
DB_NAME = "manufacturing_platform"

def init_db():
    try:
        # 连接到 MySQL 服务器（默认 3306 端口）
        print(f"Connecting to MySQL server at {DB_HOST} with user {DB_USER}...")
        connection = pymysql.connect(
            host=DB_HOST,
            user=DB_USER,
            password=DB_PASS,
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor
        )
        
        with connection.cursor() as cursor:
            # 创建数据库
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
            print(f"Database '{DB_NAME}' created or already exists.")
            
        connection.commit()
    except Exception as e:
        print(f"Error initializing local DB: {e}")
    finally:
        if 'connection' in locals() and connection.open:
            connection.close()

if __name__ == "__main__":
    init_db()
