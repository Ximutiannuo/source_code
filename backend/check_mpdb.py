
from app.database import SessionLocal
from app.models.report import MPDB
from sqlalchemy import desc

def check_last_records():
    db = SessionLocal()
    try:
        # Get last 5 records by ID
        records = db.query(MPDB).order_by(desc(MPDB.id)).limit(5).all()
        print(f"Total rows: {db.query(MPDB).count()}")
        for r in records:
            print(f"ID: {r.id}, Date: {r.date}, Activity: {r.activity_id}, Scope: {r.scope}, Method: {r.update_method}, User: {r.updated_by}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_last_records()
