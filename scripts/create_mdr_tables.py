import pymysql
import os
from urllib.parse import urlparse

def create_tables():
    # 数据库连接配置
    db_url = os.getenv("DATABASE_URL", "mysql+pymysql://root:password@localhost:3306/projectcontrols?charset=utf8mb4")
    
    # 解析 URL
    # mysql+pymysql://root:password@localhost:3306/projectcontrols
    url = db_url.replace("mysql+pymysql://", "")
    auth, rest = url.split("@")
    user, password = auth.split(":")
    host_port, db_name_part = rest.split("/")
    host = host_port.split(":")[0]
    port = int(host_port.split(":")[1]) if ":" in host_port else 3306
    db_name = db_name_part.split("?")[0]

    connection = pymysql.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database=db_name,
        charset='utf8mb4'
    )

    try:
        with connection.cursor() as cursor:
            with open(r"c:\Projects\ProjectControls\database\mdr_design_tables.sql", "r", encoding="utf-8") as f:
                sql = f.read()
                # 分割 SQL 语句
                statements = sql.split(";")
                for statement in statements:
                    if statement.strip():
                        cursor.execute(statement)
            connection.commit()
            print("Tables created successfully.")
    finally:
        connection.close()

if __name__ == "__main__":
    create_tables()
