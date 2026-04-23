from app.database import SessionLocal
from app.models.user import User, Role

def seed_roles():
    db = SessionLocal()
    try:
        # 1. Ensure the admin role exists
        admin_role = db.query(Role).filter(Role.name == "admin").first()
        if not admin_role:
            print("Creating 'admin' role...")
            admin_role = Role(
                name="admin",
                description="System Administrator with full access"
            )
            db.add(admin_role)
            db.flush()
        else:
            print("'admin' role already exists.")

        # 2. Find root user
        root_user = db.query(User).filter(User.username == "root").first()
        if not root_user:
            print("Error: User 'root' not found. Run seed_admin.py first.")
            return

        # 3. Assign role to user
        if admin_role not in root_user.roles:
            print("Assigning 'admin' role to 'root' user...")
            root_user.roles.append(admin_role)
            db.commit()
            print("Role successfully assigned.")
        else:
            print("'root' user already has the 'admin' role.")

    except Exception as e:
        print(f"Error seeding roles: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_roles()
