"""
初始化管理员用户
"""
import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import SessionLocal
from app.models.user import User

def init_admin_user():
    """创建默认管理员用户"""
    db = SessionLocal()
    try:
        # 检查是否已存在管理员
        admin = db.query(User).filter(User.username == "admin").first()
        if admin:
            print("管理员用户已存在")
            return
        
        # 创建管理员用户
        admin = User(
            username="admin",
            email="admin@example.com",
            full_name="系统管理员",
            is_active=True,
            is_superuser=True
        )
        admin.set_password("admin123")  # 默认密码，首次登录后请修改
        
        db.add(admin)
        db.commit()
        print("管理员用户创建成功！")
        print("用户名: admin")
        print("密码: admin123")
        print("请首次登录后立即修改密码！")
        
    except Exception as e:
        db.rollback()
        print(f"错误: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("开始初始化管理员用户...")
    init_admin_user()
