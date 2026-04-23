"""
清理未使用的权限：先检查需解绑的引用，待用户确认后再解绑并删除权限记录。

未使用权限列表（与 README_PERMISSIONS.md 一致）：
- report:read/create/update/delete（已由 daily_report:* 取代）
- activity:read/create/update/delete（接口只查 planning:*）
- volume:read/create/update/delete（已废弃，使用具体类型）
- project:read（无任何校验）
- p6_resource:write（代码已改为使用 p6_resource:update，可删除表中该项）

执行前请确保 backend/app/api/p6_sync.py 已改为使用 p6_resource:update。
"""
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal
from app.models.user import Permission, UserPermission, RolePermission, User, Role

# 将要删除的权限代码（未在代码中使用的）
REMOVABLE_CODES = [
    "report:read",
    "report:create",
    "report:update",
    "report:delete",
    "activity:read",
    "activity:create",
    "activity:update",
    "activity:delete",
    "volume:read",
    "volume:create",
    "volume:update",
    "volume:delete",
    "project:read",
    "p6_resource:write",
]


def run():
    db = SessionLocal()
    try:
        # 1. 查出这些 code 在库中存在的权限
        perms = db.query(Permission).filter(Permission.code.in_(REMOVABLE_CODES)).all()
        if not perms:
            print("未发现任何可删除的权限记录（表中可能已无上述 code）。")
            return

        perm_ids = [p.id for p in perms]
        perm_by_id = {p.id: p for p in perms}

        # 2. 用户权限引用
        up_list = db.query(UserPermission).filter(UserPermission.permission_id.in_(perm_ids)).all()
        # 角色权限引用
        rp_list = db.query(RolePermission).filter(RolePermission.permission_id.in_(perm_ids)).all()

        # 3. 汇总：按权限列出被谁引用
        user_ids = list({up.user_id for up in up_list})
        role_ids = list({rp.role_id for rp in rp_list})
        users = db.query(User).filter(User.id.in_(user_ids)).all() if user_ids else []
        roles = db.query(Role).filter(Role.id.in_(role_ids)).all() if role_ids else []
        user_by_id = {u.id: u for u in users}
        role_by_id = {r.id: r for r in roles}

        # 4. 打印报告
        print("=" * 60)
        print("以下权限将被删除（未使用）：")
        print("=" * 60)
        for p in perms:
            print(f"  - {p.code}  (id={p.id}) {p.name or ''}")
        print()

        if up_list or rp_list:
            print("需要先解绑的引用：")
            print("-" * 60)
            if up_list:
                print("  用户权限 (user_permissions)：")
                for up in up_list:
                    u = user_by_id.get(up.user_id)
                    name = u.username if u else f"user_id={up.user_id}"
                    perm = perm_by_id.get(up.permission_id)
                    code = perm.code if perm else f"permission_id={up.permission_id}"
                    print(f"    - 用户 {name} (id={up.user_id}) -> 权限 {code} (id={up.permission_id})")
                print()
            if rp_list:
                print("  角色权限 (role_permissions)：")
                for rp in rp_list:
                    r = role_by_id.get(rp.role_id)
                    name = r.name if r else f"role_id={rp.role_id}"
                    perm = perm_by_id.get(rp.permission_id)
                    code = perm.code if perm else f"permission_id={rp.permission_id}"
                    print(f"    - 角色 {name} (id={rp.role_id}) -> 权限 {code} (id={rp.permission_id})")
                print()
        else:
            print("没有用户或角色引用上述权限，无需解绑，可直接删除权限记录。")
            print()

        print("=" * 60)
        confirm = input("确认解绑并删除以上权限？请输入 yes 后回车，其它任意输入取消: ").strip().lower()
        if confirm != "yes":
            print("已取消，未做任何修改。")
            return

        # 5. 执行：先删引用，再删权限
        deleted_up = db.query(UserPermission).filter(UserPermission.permission_id.in_(perm_ids)).delete()
        deleted_rp = db.query(RolePermission).filter(RolePermission.permission_id.in_(perm_ids)).delete()
        deleted_perm = db.query(Permission).filter(Permission.id.in_(perm_ids)).delete(synchronize_session=False)
        db.commit()

        print()
        print("执行结果：")
        print(f"  - 已删除 user_permissions 记录数: {deleted_up}")
        print(f"  - 已删除 role_permissions 记录数: {deleted_rp}")
        print(f"  - 已删除 permissions 记录数: {deleted_perm}")
        print("完成。")
    except Exception as e:
        db.rollback()
        print(f"错误: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
