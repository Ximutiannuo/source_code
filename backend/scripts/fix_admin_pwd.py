
from app.database import SessionLocal
from app.models.user import User
import bcrypt

def fix_admin():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == "admin").first()
        if not user:
            print("User 'admin' not found. Creating it...")
            user = User(
                username="admin",
                full_name="Administrator",
                is_active=True,
                is_superuser=True
            )
            db.add(user)
        
        password = "123546"
        user.hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        db.commit()
        print("Successfully updated 'admin' password to '123546'.")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_admin()
