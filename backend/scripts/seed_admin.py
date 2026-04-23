from app.database import SessionLocal
from app.models.user import User
import bcrypt

def seed_admin():
    db = SessionLocal()
    try:
        # Check if root user exists
        user = db.query(User).filter(User.username == "root").first()
        if user:
            print("User 'root' already exists. Updating password...")
        else:
            print("Creating 'root' user...")
            user = User(
                username="root",
                full_name="System Administrator",
                is_active=True,
                is_superuser=True
            )
            db.add(user)
        
        # Set password
        password = "Ww@1932635539"
        user.hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        db.commit()
        print("Successfully seeded 'root' user.")
    except Exception as e:
        print(f"Error seeding admin: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_admin()
