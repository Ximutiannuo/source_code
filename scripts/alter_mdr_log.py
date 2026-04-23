import pymysql
import os

def alter_table():
    db_url = os.getenv("DATABASE_URL", "mysql+pymysql://root:password@localhost:3306/projectcontrols?charset=utf8mb4")
    
    # Simple parse
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
            cursor.execute("ALTER TABLE mdr_sync_log ADD COLUMN processed_count INT DEFAULT 0 AFTER total_count;")
            connection.commit()
            print("Column added successfully.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        connection.close()

if __name__ == "__main__":
    alter_table()
