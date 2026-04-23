"""
排序规则对齐脚本：确保作业状态系统使用 utf8mb4_unicode_ci
防止因排序规则不一致导致的 JOIN 错误
"""
import sys
from pathlib import Path
from sqlalchemy import text

project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from app.database import SessionLocal

def ensure_collation():
    db = SessionLocal()
    print("=" * 60)
    print("开始检查并修正数据库排序规则 (utf8mb4_unicode_ci)...")
    print("=" * 60)

    try:
        # 1. 修正 activity_status_records 表
        print("\n[1/2] 修正 activity_status_records 表...")
        db.execute(text("""
            ALTER TABLE activity_status_records 
            CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
        """))
        print("  ✓ activity_status_records 表及其所有列已设为 utf8mb4_unicode_ci")

        # 2. 修正 activity_summary 表中的系统状态列
        print("\n[2/2] 修正 activity_summary.system_status 列...")
        db.execute(text("""
            ALTER TABLE activity_summary 
            MODIFY COLUMN system_status VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'In Progress';
        """))
        print("  ✓ activity_summary.system_status 列已设为 utf8mb4_unicode_ci")

        # 验证日志
        print("\n[验证日志] 当前排序规则状态：")
        check_sql = text("""
            SELECT TABLE_NAME, COLUMN_NAME, COLLATION_NAME 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND (
                (TABLE_NAME = 'activity_status_records' AND COLUMN_NAME = 'activity_id') OR
                (TABLE_NAME = 'activity_summary' AND COLUMN_NAME = 'system_status') OR
                (TABLE_NAME = 'activity_summary' AND COLUMN_NAME = 'activity_id')
            );
        """)
        results = db.execute(check_sql).fetchall()
        for row in results:
            print(f"  - {row[0]}.{row[1]}: {row[2]}")

        db.commit()
        print("\n" + "=" * 60)
        print("排序规则对齐完成！所有核心关联字段均已同步。")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        print(f"\n[!] 修正失败: {str(e)}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    ensure_collation()
