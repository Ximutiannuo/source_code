
from app.database import SessionLocal
from app.models.user import User, Role, Permission
import bcrypt

def seed_manufacturing_roles():
    db = SessionLocal()
    try:
        # 1. Ensure common manufacturing roles exist
        roles_data = [
            {"name": "系统管理员", "description": "拥有平台所有管理权限"},
            {"name": "生产计划员", "description": "负责 APS 排产与工单下发"},
            {"name": "工艺工程师", "description": "负责 PBOM 与工艺路线维护"},
            {"name": "质量工程师", "description": "负责检验与放行"},
            {"name": "采购工程师", "description": "负责供应跟催"},
        ]
        
        for r_data in roles_data:
            role = db.query(Role).filter(Role.name == r_data["name"]).first()
            if not role:
                print(f"Creating role '{r_data['name']}'...")
                role = Role(name=r_data["name"], description=r_data["description"])
                db.add(role)
        
        db.flush()
        
        # 2. Assign '系统管理员' to 'admin'
        admin_user = db.query(User).filter(User.username == "admin").first()
        admin_role = db.query(Role).filter(Role.name == "系统管理员").first()
        
        if admin_user and admin_role:
            if admin_role not in admin_user.roles:
                print(f"Assigning '{admin_role.name}' to 'admin'...")
                admin_user.roles.append(admin_role)
        
        db.commit()
        print("Manufacturing roles seeded successfully.")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_manufacturing_roles()
