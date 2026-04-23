"""
迁移脚本：创建 departments 表、初始化部门数据、为 users 表添加 department_id 列

执行方式：
  cd backend && python -m scripts.migrate_add_departments_and_user_department
  或
  python backend/scripts/migrate_add_departments_and_user_department.py

需要数据库写权限（CREATE TABLE、ALTER TABLE、INSERT）。
"""
import sys
import os
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from app.database import load_env_with_fallback

if not os.getenv("DATABASE_URL"):
    load_env_with_fallback()

from app.database import get_default_engine
from app.models.department import Department
from sqlalchemy import text

# 部门配置（code 用于 ahead_plan_issue.resolving_department、user.department_id 等）
DEPARTMENT_SEED = [
    ("safety", "安全管理部", 1),
    ("construction", "施工管理部", 2),
    ("finance", "财务资金部", 3),
    ("procurement", "采购管理部", 4),
    ("contract", "合同管理部", 5),
    ("control", "控制管理部", 6),
    ("quality", "质量控制部", 7),
    ("general", "综合管理部", 8),
    ("design", "设计管理部", 9),
    ("it", "IT管理部", 10),
    ("security", "安保部", 11),
    ("planning", "计划管理部", 12),
    ("handover_docs", "竣工资料管理部", 13),
    ("cost_control", "费控管理部", 14),
    ("equipment_material", "设备材料部", 15),
    ("warehouse", "仓储管理部", 16),
    ("document_control", "文控管理部", 17),
    ("hr", "人力资源部", 18),
    ("admin", "行政管理部", 19),
    ("logistics", "后勤管理部", 20),
    ("construction_support", "施工保障部", 21),
    # C01..C19（可按需在库中修改名称）
    ("C01", "C01", 22),
    ("C02", "C02", 23),
    ("C03", "C03", 24),
    ("C04", "C04", 25),
    ("C05", "C05", 26),
    ("C06", "C06", 27),
    ("C07", "C07", 28),
    ("C08", "C08", 29),
    ("C09", "C09", 30),
    ("C10", "C10", 31),
    ("C11", "C11", 32),
    ("C12", "C12", 33),
    ("C13", "C13", 34),
    ("C14", "C14", 35),
    ("C15", "C15", 36),
    ("C16", "C16", 37),
    ("C17", "C17", 38),
    ("C18", "C18", 39),
    ("C19", "C19", 40),
    # 特殊分类
    ("external_user", "外部用户", 41),
    ("project_leader", "项目领导", 42),
]


def run_migration():
    engine = get_default_engine()

    with engine.connect() as conn:
        # 1. 创建 departments 表
        Department.__table__.create(engine, checkfirst=True)
        print("✅ departments 表已就绪")

        # 2. 初始化/增量补充部门数据（按 code 不存在则插入）
        result = conn.execute(text("SELECT code FROM departments"))
        existing_codes = {r[0] for r in result}
        added = 0
        for code, name, sort_order in DEPARTMENT_SEED:
            if code not in existing_codes:
                conn.execute(
                    text(
                        "INSERT INTO departments (code, name, is_active, sort_order) VALUES (:code, :name, 1, :sort_order)"
                    ),
                    {"code": code, "name": name, "sort_order": sort_order},
                )
                existing_codes.add(code)
                added += 1
        conn.commit()
        if added > 0:
            print(f"✅ 已补充 {added} 个部门（共 {len(DEPARTMENT_SEED)} 项配置）")
        else:
            print(f"  departments 表已包含全部 {len(DEPARTMENT_SEED)} 个部门，无需补充")

        # 3. 检查 users 表是否已有 department_id 列
        conn.commit()
        db_name = conn.execute(text("SELECT DATABASE()")).scalar()
        result = conn.execute(
            text(
                """
            SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'department_id'
            """
            ),
            {"db": db_name},
        )
        has_col = result.scalar() > 0

        if not has_col:
            conn.execute(
                text(
                    """
                ALTER TABLE users ADD COLUMN department_id INT NULL COMMENT '所属部门' AFTER last_login,
                ADD INDEX ix_users_department_id (department_id),
                ADD CONSTRAINT fk_users_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
                """
                )
            )
            conn.commit()
            print("✅ users 表已添加 department_id 列及外键")
        else:
            print("  users 表已有 department_id 列，跳过")


if __name__ == "__main__":
    print("=" * 60)
    print("迁移：departments 表 + users.department_id")
    print("=" * 60)
    try:
        run_migration()
        print("\n=== 迁移完成 ===")
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
