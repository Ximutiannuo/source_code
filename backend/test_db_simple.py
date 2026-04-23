
from app.database import SessionLocal
from app.models.report import MPDB
from datetime import date
from decimal import Decimal

def test_db():
    db = SessionLocal()
    try:
        count_before = db.query(MPDB).count()
        print(f"Count before: {count_before}")
        
        test_entry = MPDB(
            date=date(2026, 4, 1),
            activity_id=None,
            scope="TEST",
            manpower=Decimal("1.0"),
            update_method="test_script"
        )
        db.add(test_entry)
        db.commit()
        
        count_after = db.query(MPDB).count()
        print(f"Count after: {count_after}")
        
        # Cleanup
        db.delete(test_entry)
        db.commit()
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    test_db()
