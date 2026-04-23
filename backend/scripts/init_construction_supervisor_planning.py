"""
为施工主管角色（role_id 75, 76, 77）确保具备 planning:read 与 planning:update 权限。
范围根据角色名推导：ECUConstructionSupervisor -> subproject=ECU，依此类推。

若这三个角色已通过 init_qaqc_construction_permissions.py 配置过 CONSTRUCTION 模板，
则通常已有上述权限；本脚本用于查漏补缺或仅补 planning 两项。

用法：
  python backend/scripts/init_construction_supervisor_planning.py
  python backend/scripts/init_construction_supervisor_planning.py --dry-run
"""
import sys
import os
import argparse

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.database import load_env_with_fallback

load_env_with_fallback()

from app.database import SessionLocal
from app.models.user import Role, Permission, RolePermission

# 与 ahead_plan.py 中一致
CONSTRUCTION_SUPERVISOR_ROLE_IDS = (75, 76, 77)
PLANNING_CODES = ["planning:read", "planning:update"]


def get_subproject_for_role_name(role_name: str):
    """根据角色名返回 subproject（ECU/PEL/UIO），无法推导则返回 None。"""
    name = (role_name or "").upper()
    if "ECU" in name:
        return "ECU"
    if "PEL" in name:
        return "PEL"
    if "UIO" in name:
        return "UIO"
    return None


def main():
    parser = argparse.ArgumentParser(description="为 role_id 75/76/77 确保 planning:read、planning:update（按角色名 subproject）")
    parser.add_argument("--dry-run", action="store_true", help="只统计不写入")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        perms = {p.code: p for p in db.query(Permission).filter(Permission.code.in_(PLANNING_CODES)).all()}
        missing = [c for c in PLANNING_CODES if c not in perms]
        if missing:
            print(f"⚠️ 权限未定义，请先执行 init_permissions.py: {missing}")
            return

        total_added = 0
        for role_id in CONSTRUCTION_SUPERVISOR_ROLE_IDS:
            role = db.query(Role).filter(Role.id == role_id).first()
            if not role:
                print(f"  ⚠️ role_id={role_id} 不存在，跳过")
                continue
            subproject = get_subproject_for_role_name(role.name)
            scope_val, subproject_val = None, subproject

            existing = {
                (rp.permission_id, rp.scope, rp.subproject)
                for rp in db.query(RolePermission).filter(RolePermission.role_id == role.id).all()
            }
            added = 0
            for code in PLANNING_CODES:
                perm = perms[code]
                if (perm.id, scope_val, subproject_val) in existing:
                    continue
                if not args.dry_run:
                    rp = RolePermission(
                        role_id=role.id,
                        permission_id=perm.id,
                        scope=scope_val,
                        subproject=subproject_val,
                    )
                    db.add(rp)
                added += 1
                total_added += 1
            scope_str = f"subproject={subproject_val}" if subproject_val else "（全范围）"
            print(f"  {role.name} (id={role_id}): {scope_str} -> 新增 {added} 条 planning 权限")
        if not args.dry_run and total_added > 0:
            db.commit()
            print(f"\n✅ 共新增 {total_added} 条，已提交。")
        elif args.dry_run and total_added > 0:
            print(f"\n✅ dry-run: 将共新增 {total_added} 条。")
        elif total_added == 0:
            print("\n无需新增（角色已有相应 planning 权限）。")
    except Exception as e:
        db.rollback()
        print(f"❌ {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
