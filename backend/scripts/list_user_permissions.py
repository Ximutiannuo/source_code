"""
列出所有账号及其拥有的权限（含 scope 等范围限制）。

运行（控制台输出）：
  python backend/scripts/list_user_permissions.py

运行（生成 Markdown 报告）：
  python backend/scripts/list_user_permissions.py --md
  python backend/scripts/list_user_permissions.py --md -o docs/user_permissions_report.md
"""
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal
from app.models.user import User, Role, Permission, UserPermission, RolePermission

# 权限关联上会带范围限制的字段（与 UserPermission / RolePermission 一致）
SCOPE_FIELDS = [
    "scope",
    "project",
    "subproject",
    "block",
    "train",
    "unit",
    "main_block",
    "quarter",
    "simple_block",
    "discipline",
    "work_package",
    "resource_id",
]


def format_scope(record, prefix="") -> str:
    """从用户权限或角色权限记录中提取范围限制，格式化为可读字符串。"""
    parts = []
    for field in SCOPE_FIELDS:
        if not hasattr(record, field):
            continue
        val = getattr(record, field, None)
        if val is not None and str(val).strip():
            parts.append(f"{field}={val}")
    if getattr(record, "facility_id", None) is not None:
        parts.append(f"facility_id={record.facility_id}")
    if not parts:
        return "（全范围）"
    return ", ".join(parts)


def build_report_data(db):
    """查询所有用户及其权限，返回结构化数据。"""
    users = db.query(User).order_by(User.username).all()
    result = []
    for user in users:
        super_tag = " [超级管理员]" if user.is_superuser else ""
        active_tag = " [已禁用]" if not user.is_active else ""
        entry = {
            "username": user.username,
            "id": user.id,
            "is_superuser": user.is_superuser,
            "is_active": user.is_active,
            "title": f"{user.username} (id={user.id}){super_tag}{active_tag}",
            "permissions": [],
        }
        if user.is_superuser:
            result.append(entry)
            continue
        for up in db.query(UserPermission).filter(UserPermission.user_id == user.id).all():
            perm = up.permission
            code = perm.code if perm else f"permission_id={up.permission_id}"
            name = perm.name if perm and perm.name else ""
            entry["permissions"].append({
                "source": "直接",
                "code": code,
                "name": name,
                "scope": format_scope(up),
            })
        for role in user.roles:
            if not role.is_active:
                continue
            for rp in db.query(RolePermission).filter(RolePermission.role_id == role.id).all():
                perm = rp.permission
                code = perm.code if perm else f"permission_id={rp.permission_id}"
                name = perm.name if perm and perm.name else ""
                entry["permissions"].append({
                    "source": f"角色:{role.name}",
                    "code": code,
                    "name": name,
                    "scope": format_scope(rp),
                })
        result.append(entry)
    return result


def write_md(path: str, data: list) -> None:
    """将权限数据写入 Markdown 文件（UTF-8）。"""
    lines = [
        "# 账号权限一览",
        "",
        "本文档由 `backend/scripts/list_user_permissions.py --md` 生成，列出各账号拥有的权限及 scope 范围限制。",
        "",
        f"**生成时间**：{datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
        "---",
        "",
    ]
    for entry in data:
        lines.append(f"## {entry['title']}")
        lines.append("")
        if entry["is_superuser"]:
            lines.append("拥有所有权限（不展开）。")
            lines.append("")
            continue
        if not entry["permissions"]:
            lines.append("无直接权限且无通过角色的权限。")
            lines.append("")
            continue
        lines.append("| 来源 | 权限代码 | 权限名称 | 范围 |")
        lines.append("|------|----------|----------|------|")
        for p in entry["permissions"]:
            name = (p["name"] or "").replace("|", "\\|")
            scope = (p["scope"] or "").replace("|", "\\|")
            lines.append(f"| {p['source']} | `{p['code']}` | {name} | {scope} |")
        lines.append("")
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def run():
    db = SessionLocal()
    try:
        users = db.query(User).order_by(User.username).all()
        if not users:
            print("暂无用户。")
            return

        for user in users:
            super_tag = " [超级管理员]" if user.is_superuser else ""
            active_tag = "" if user.is_active else " [已禁用]"
            print("=" * 70)
            print(f"用户: {user.username} (id={user.id}){super_tag}{active_tag}")
            print("-" * 70)

            if user.is_superuser:
                print("  拥有所有权限（不展开）。")
                print()
                continue

            has_any = False

            # 直接分配的权限
            up_list = (
                db.query(UserPermission)
                .filter(UserPermission.user_id == user.id)
                .all()
            )
            for up in up_list:
                has_any = True
                perm = up.permission
                code = perm.code if perm else f"permission_id={up.permission_id}"
                name = f" — {perm.name}" if perm and perm.name else ""
                scope_str = format_scope(up)
                print(f"  [直接] {code}{name}")
                print(f"         范围: {scope_str}")

            # 通过角色获得的权限
            for role in user.roles:
                if not role.is_active:
                    continue
                rp_list = (
                    db.query(RolePermission)
                    .filter(RolePermission.role_id == role.id)
                    .all()
                )
                for rp in rp_list:
                    has_any = True
                    perm = rp.permission
                    code = perm.code if perm else f"permission_id={rp.permission_id}"
                    name = f" — {perm.name}" if perm and perm.name else ""
                    scope_str = format_scope(rp)
                    print(f"  [角色:{role.name}] {code}{name}")
                    print(f"         范围: {scope_str}")

            if not has_any:
                print("  （无直接权限且无通过角色的权限）")

            print()

        print("=" * 70)
        print("结束。")
    finally:
        db.close()


if __name__ == "__main__":
    args = sys.argv[1:]
    out_md = None
    if "--md" in args or "-m" in args:
        try:
            i = args.index("-o")
            out_md = args[i + 1]
        except (ValueError, IndexError):
            try:
                i = args.index("--output")
                out_md = args[i + 1]
            except (ValueError, IndexError):
                pass
        if not out_md:
            out_md = os.path.join(os.path.dirname(__file__), "user_permissions_report.md")

    if out_md:
        db = SessionLocal()
        try:
            data = build_report_data(db)
            write_md(out_md, data)
            print(f"已生成报告: {os.path.abspath(out_md)}")
        finally:
            db.close()
    else:
        run()
