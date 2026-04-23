"""
创建 C01CommonUser、C02CommonUser 等分包商普通用户角色，并按 CommonUser 权限模板配置权限。

规则：
- 角色命名：{scope}CommonUser，如 C01CommonUser、C02CommonUser
- 范围：C* 分包商用 scope，如 C01CommonUser -> scope=C01
- 权限模板：与全局 CommonUser 一致（只读为主 + planning 读写），但限定在对应 scope

用法：
  # 创建 C01..C19 的 CommonUser 角色并配置权限（已存在角色不覆盖，仅补权限）
  python backend/scripts/init_common_user_roles.py

  # 仅处理指定 scope 对应的角色
  python backend/scripts/init_common_user_roles.py --scopes C01 C02 C05

  # 试运行
  python backend/scripts/init_common_user_roles.py --dry-run
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

# ---------- 支持的 scope 列表（与 migrate 等保持一致）----------
DEFAULT_SCOPES = [f"C{i:02d}" for i in range(1, 20)]  # C01..C19

# ---------- CommonUser 权限模板（与全局 CommonUser 角色一致）----------
COMMON_USER_PERMISSION_CODES = [
    "planning:read",
    "planning:create",
    "planning:update",
    "planning:delete",
    "p6_database:read",
    "daily_report:read",
    "inspection_db:read",
    "acceptance_procedure:read",
    "facility:read",
    "construction_volume:read",
    "acceptance_volume:read",
    "abd_volume:read",
    "ovr_volume:read",
    "exhibition_report:read",
]


def get_scope_for_role(role_name: str):
    """
    根据角色名返回 (scope, subproject)。
    C* 分包商 -> scope=C01 等。
    """
    name = (role_name or "").strip()
    m = re.match(r"^(C\d+)", name, re.IGNORECASE)
    if m:
        return (m.group(1), None)
    return (None, None)


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
    parser = argparse.ArgumentParser(description="创建 C01CommonUser、C02CommonUser 等角色并配置 CommonUser 权限模板")
    parser.add_argument("--scopes", nargs="*", type=str, help="仅处理这些 scope（如 C01 C02）；不传则处理 C01..C19")
    parser.add_argument("--dry-run", action="store_true", help="只统计不写入")
    args = parser.parse_args()

    scopes = args.scopes if args.scopes else DEFAULT_SCOPES
    # 规范化 scope 格式（如 C1 -> C01）
    normalized = []
    for s in scopes:
        s = (s or "").strip().upper()
        if re.match(r"^C\d+$", s):
            if len(s) == 2:  # C1 -> C01
                s = "C" + s[1:].zfill(2)
            normalized.append(s)
    scopes = normalized if normalized else DEFAULT_SCOPES

    db = SessionLocal()
    try:
        roles_created = 0
        total_perms_added = 0
        scope_str = lambda s, p: f"scope={s}" if s else f"subproject={p}" if p else "（全范围）"

        for scope in scopes:
            role_name = f"{scope}CommonUser"
            role = db.query(Role).filter(Role.name == role_name).first()
            if not role:
                if args.dry_run:
                    # dry-run：角色不存在时，模拟“将创建角色 + 将绑定全部模板权限”
                    would_add = len(COMMON_USER_PERMISSION_CODES)
                    total_perms_added += would_add
                    print(f"  [dry-run] 将创建角色: {role_name} -> 将新增 {would_add} 条权限")
                else:
                    role = Role(
                        name=role_name,
                        description=f"分包商 {scope} 普通用户（只读 + 计划查看与维护）",
                        is_active=True,
                    )
                    db.add(role)
                    db.flush()
                    roles_created += 1
                    print(f"  ✅ 创建角色: {role_name} (id={role.id})")

            if role:
                added = apply_template_to_role(db, role, COMMON_USER_PERMISSION_CODES, scope, None, args.dry_run)
                total_perms_added += added
                print(f"  {role_name}: {scope_str(scope, None)} -> 新增 {added} 条权限")

        if not args.dry_run and (roles_created > 0 or total_perms_added > 0):
            db.commit()
            print(f"\n✅ 共创建 {roles_created} 个角色，新增 {total_perms_added} 条角色权限，已提交。")
        elif args.dry_run:
            print(f"\n✅ dry-run: 将创建/处理上述角色，共新增 {total_perms_added} 条权限。")
        else:
            print("\n无需新增（角色已存在且已有完整模板权限）。")
    except Exception as e:
        db.rollback()
        print(f"❌ {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
