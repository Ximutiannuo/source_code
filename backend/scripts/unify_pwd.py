
from app.database import SessionLocal
from app.models.user import User
import bcrypt

def unify_passwords():
    db = SessionLocal()
    try:
        target_pwd = "Ww@1932635539"
        hashed = bcrypt.hashpw(target_pwd.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        usernames = ["admin", "root"]
        for uname in usernames:
            user = db.query(User).filter(User.username == uname).first()
            if not user:
                print(f"Creating user '{uname}'...")
                user = User(
                    username=uname,
                    full_name=f"{uname.capitalize()} Administrator",
                    is_active=True,
                    is_superuser=True
                )
                db.add(user)
            
            user.hashed_password = hashed
            user.is_active = True
            print(f"Updated password for '{uname}' to '{target_pwd}'")
        
        db.commit()
        print("All specified passwords unified successfully.")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    unify_passwords()
