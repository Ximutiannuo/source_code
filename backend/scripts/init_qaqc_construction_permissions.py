"""
为 QAQC 与 CONSTRUCTION 相关角色批量配置固定权限模板。

规则：
- C* 账号（分包商）：范围用 scope，如 C01QAQC -> scope=C01
- ECU/PEL/UIO 账号（项目部）：范围用 subproject，如 ECUQAQC -> subproject=ECU

用法：
  # 为所有名称含 QAQC 或 Construction 的角色按模板配置（已存在的不覆盖）
  python backend/scripts/init_qaqc_construction_permissions.py

  # 仅处理指定角色
  python backend/scripts/init_qaqc_construction_permissions.py --roles C01QAQC C02Construction

  # 试运行
  python backend/scripts/init_qaqc_construction_permissions.py --dry-run
"""
import sys
import os
import re
import argparse

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.database import load_env_with_fallback
load_env_with_fallback()

from app.database import SessionLocal
from app.models.user import Role, Permission, RolePermission

# ---------- QAQC 模板（权限代码列表）----------
QAQC_PERMISSION_CODES = [
    "planning:read",
    "p6_resource:read",
    "p6_database:read",
    "daily_report:read",
    "inspection_db:read",
    "inspection_db:create",
    "inspection_db:update",
    "inspection_db:delete",
    "acceptance_procedure:read",
    "facility:read",
    "welding_data:read",
    "construction_volume:read",
    "acceptance_volume:read",
    "acceptance_volume:update",
    "acceptance_volume:delete",
    "acceptance_volume:create",
    "abd_volume:read",
    "ovr_volume:read",
    "exhibition_report:read",
]

# ---------- CONSTRUCTION 模板 -----------
CONSTRUCTION_PERMISSION_CODES = [
    "planning:read",
    "planning:create",
    "planning:update",
    "planning:delete",
    "p6_resource:read",
    "p6_database:read",
    "daily_report:read",
    "inspection_db:read",
    "acceptance_procedure:read",
    "facility:read",
    "welding_data:read",
    "construction_volume:read",
    "construction_volume:update",
    "construction_volume:create",
    "construction_volume:delete",
    "acceptance_volume:read",
    "abd_volume:read",
    "ovr_volume:read",
    "exhibition_report:read",
]


def get_scope_for_role(role_name: str):
    """
    根据角色名返回 (scope, subproject)。
    C* 分包商 -> scope=C01 等；ECU/PEL/UIO 项目部 -> subproject=ECU/PEL/UIO。
    """
    name = (role_name or "").strip()
    # C + 数字开头：scope = C01, C02, ...
    m = re.match(r"^(C\d+)", name, re.IGNORECASE)
    if m:
        return (m.group(1), None)
    if "ECU" in name.upper():
        return (None, "ECU")
    if "PEL" in name.upper():
        return (None, "PEL")
    if "UIO" in name.upper():
        return (None, "UIO")
    return (None, None)


def role_template(role_name: str):
    """返回角色对应的模板：'qaqc' | 'construction' | None。"""
    name = (role_name or "").upper()
    if "QAQC" in name:
        return "qaqc"
    if "CONSTRUCTION" in name:
        return "construction"
    return None


def apply_template_to_role(db, role: Role, codes: list, scope_val, subproject_val, dry_run: bool):
    """为角色按权限代码列表 + scope/subproject 写入 role_permissions，已存在则跳过。返回新增条数。"""
    perm_by_code = {}
    for p in db.query(Permission).filter(Permission.code.in_(codes)).all():
        perm_by_code[p.code] = p
    missing = [c for c in codes if c not in perm_by_code]
    if missing:
        print(f"  ⚠️ 权限未定义，请先执行 init_permissions.py: {missing}")
        return 0

    existing_keys = set()
    for rp in db.query(RolePermission).filter(RolePermission.role_id == role.id).all():
        key = (rp.permission_id, rp.scope, rp.subproject)
        existing_keys.add(key)

    added = 0
    for code in codes:
        perm = perm_by_code[code]
        key = (perm.id, scope_val, subproject_val)
        if key in existing_keys:
            continue
        if not dry_run:
            rp = RolePermission(
                role_id=role.id,
                permission_id=perm.id,
                scope=scope_val,
                subproject=subproject_val,
            )
            db.add(rp)
        added += 1
    return added


def main():
    parser = argparse.ArgumentParser(description="为 QAQC/Construction 角色按固定模板配置权限")
    parser.add_argument("--roles", nargs="*", type=str, help="仅处理这些角色名；不传则处理所有名称含 QAQC 或 Construction 的角色")
    parser.add_argument("--dry-run", action="store_true", help="只统计不写入")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.roles:
            roles = []
            for name in args.roles:
                r = db.query(Role).filter(Role.name == name).first()
                if r:
                    roles.append(r)
                else:
                    print(f"⚠️ 角色不存在: {name}")
        else:
            all_roles = db.query(Role).all()
            roles = [r for r in all_roles if role_template(r.name)]

        if not roles:
            print("没有匹配的角色需要处理。")
            return

        scope_str = lambda s, p: f"scope={s}" if s else f"subproject={p}" if p else "（全范围）"
        total_added = 0
        for role in roles:
            tpl = role_template(role.name)
            if tpl == "qaqc":
                codes = QAQC_PERMISSION_CODES
            else:
                codes = CONSTRUCTION_PERMISSION_CODES
            scope_val, subproject_val = get_scope_for_role(role.name)
            added = apply_template_to_role(db, role, codes, scope_val, subproject_val, args.dry_run)
            total_added += added
            print(f"  {role.name} ({tpl}): {scope_str(scope_val, subproject_val)} -> 新增 {added} 条")

        if not args.dry_run and total_added > 0:
            db.commit()
            print(f"\n✅ 共新增 {total_added} 条角色权限，已提交。")
        elif args.dry_run:
            print(f"\n✅ dry-run: 将共新增 {total_added} 条。")
        else:
            print("\n无需新增（角色已有完整模板权限）。")
    except Exception as e:
        db.rollback()
        print(f"❌ {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
