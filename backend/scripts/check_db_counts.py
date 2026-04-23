from sqlalchemy import text
from app.database import SessionLocal

def check_counts():
    db = SessionLocal()
    try:
        tables = ['p6_activities', 'p6_activity_code_assignments', 'vfactdb', 'mpdb', 'activity_summary', 'volume_control_quantity', 'facilities', 'rsc_defines']
        for table in tables:
            count = db.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
            print(f"{table}: {count}")
    finally:
        db.close()

if __name__ == "__main__":
    check_counts()
