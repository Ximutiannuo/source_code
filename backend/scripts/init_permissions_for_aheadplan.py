"""
为所有角色添加 planning:read/create/update/delete 权限。

专项计划中的「需要解决的问题」功能（问题提出、回复、解决、评分）需要完整 planning 权限。
本脚本为所有角色补充缺失的 planning 权限；若角色已有某 planning 权限（任意 scope/subproject），
则该权限不再新增。新增权限继承该角色已有 planning 权限的 scope/subproject；若该角色尚无任何 planning
权限，则新增的 scope/subproject 为空（全范围）。

用法：
  python backend/scripts/init_permissions_for_aheadplan.py

  # 仅处理指定角色
  python backend/scripts/init_permissions_for_aheadplan.py --roles C01QAQC ECUConstruction

  # 试运行（只统计不写入）
  python backend/scripts/init_permissions_for_aheadplan.py --dry-run
"""
import sys
import os
import argparse

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.database import load_env_with_fallback

load_env_with_fallback()

from app.database import SessionLocal
from app.models.user import Role, Permission, RolePermission

PLANNING_PERMISSION_CODES = [
    "planning:read",
    "planning:create",
    "planning:update",
    "planning:delete",
]


def apply_planning_to_role(
    db, role: Role, perm_by_code: dict, perm_id_to_code: dict, dry_run: bool
) -> int:
    """为角色添加缺失的 planning:* 权限；已存在的权限代码（任意 scope）则跳过。
    新增的 scope/subproject 继承该角色已有 planning 权限；若无则用空（全范围）。"""
    existing_codes = set()
    inherited_scope = None
    inherited_subproject = None
    inherited_set = False
    for rp in db.query(RolePermission).filter(RolePermission.role_id == role.id).all():
        code = perm_id_to_code.get(rp.permission_id)
        if code and code.startswith("planning:"):
            existing_codes.add(code)
            if not inherited_set:
                inherited_scope = rp.scope
                inherited_subproject = rp.subproject
                inherited_set = True

    added = 0
    for code in PLANNING_PERMISSION_CODES:
        if code in existing_codes:
            continue
        perm = perm_by_code.get(code)
        if not perm:
            continue
        if not dry_run:
            rp = RolePermission(
                role_id=role.id,
                permission_id=perm.id,
                scope=inherited_scope,
                subproject=inherited_subproject,
            )
            db.add(rp)
        added += 1
    return added


def main():
    parser = argparse.ArgumentParser(
        description="为所有角色添加 planning:read/create/update/delete 权限"
    )
    parser.add_argument(
        "--roles",
        nargs="*",
        type=str,
        help="仅处理这些角色名；不传则处理所有角色",
    )
    parser.add_argument("--dry-run", action="store_true", help="只统计不写入")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        # 加载 planning 权限及 permission_id -> code 映射（用于判断已有权限）
        perm_by_code = {}
        perm_id_to_code = {}
        for p in db.query(Permission).filter(
            Permission.code.in_(PLANNING_PERMISSION_CODES)
        ).all():
            perm_by_code[p.code] = p
            perm_id_to_code[p.id] = p.code

        missing = [c for c in PLANNING_PERMISSION_CODES if c not in perm_by_code]
        if missing:
            print(f"⚠️ 权限未定义，请先执行 init_permissions.py: {missing}")
            return

        # 获取角色列表
        if args.roles:
            roles = []
            for name in args.roles:
                r = db.query(Role).filter(Role.name == name).first()
                if r:
                    roles.append(r)
                else:
                    print(f"⚠️ 角色不存在: {name}")
        else:
            roles = db.query(Role).all()

        if not roles:
            print("没有需要处理的角色。")
            return

        total_added = 0
        for role in roles:
            added = apply_planning_to_role(
                db, role, perm_by_code, perm_id_to_code, args.dry_run
            )
            total_added += added
            if added > 0:
                print(f"  {role.name}: 新增 {added} 条 planning 权限")

        if not args.dry_run and total_added > 0:
            db.commit()
            print(f"\n✅ 共新增 {total_added} 条角色权限，已提交。")
        elif args.dry_run:
            print(f"\n✅ dry-run: 将共新增 {total_added} 条。")
        else:
            print("\n无需新增（所有角色已有完整 planning 权限）。")
    except Exception as e:
        db.rollback()
        print(f"❌ {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
