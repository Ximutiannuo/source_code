"""
重置admin用户密码
"""
import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import SessionLocal
from app.models.user import User

def reset_admin_password(new_password: str = "admin123"):
    """重置admin用户密码"""
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            print("[ERROR] 管理员用户不存在，请先运行: python scripts/init_admin_user.py")
            return
        
        admin.set_password(new_password)
        db.commit()
        print(f"[OK] 密码已重置为: {new_password}")
        print("  请立即登录并修改密码！")
        
    except Exception as e:
        db.rollback()
        print(f"[ERROR] 错误: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import sys
    new_password = sys.argv[1] if len(sys.argv) > 1 else "admin123"
    print(f"重置admin用户密码为: {new_password}")
    reset_admin_password(new_password)
