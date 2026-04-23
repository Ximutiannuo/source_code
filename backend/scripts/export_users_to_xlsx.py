"""
导出所有账户到 Excel（username, email, full_name 三列）。

运行：
  cd backend && python scripts/export_users_to_xlsx.py
  cd backend && python scripts/export_users_to_xlsx.py -o users_export.xlsx
"""
import sys
import os
import argparse

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal
from app.models.user import User

try:
    import pandas as pd
except ImportError:
    print("请安装 pandas: pip install pandas")
    sys.exit(1)


def export_users_to_xlsx(output_path: str) -> tuple[str, int]:
    """导出所有用户到 xlsx，返回 (绝对路径, 用户数)。"""
    db = SessionLocal()
    try:
        users = db.query(User).order_by(User.username).all()
        rows = [
            {
                "username": u.username or "",
                "email": u.email or "",
                "full_name": u.full_name or "",
            }
            for u in users
        ]
        df = pd.DataFrame(rows)
        df.to_excel(output_path, index=False, engine="openpyxl")
        return os.path.abspath(output_path), len(users)
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="导出所有账户到 Excel（username, email, full_name）")
    parser.add_argument(
        "-o", "--output",
        default="users_export.xlsx",
        help="输出 Excel 文件路径（默认: users_export.xlsx）",
    )
    args = parser.parse_args()
    out_path, count = export_users_to_xlsx(args.output)
    print(f"已导出 {count} 个账户到: {out_path}")
