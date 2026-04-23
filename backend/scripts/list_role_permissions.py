"""
列出所有角色及其拥有的权限（含 scope/subproject 等范围限制）。

运行（控制台输出）：
  python backend/scripts/list_role_permissions.py

运行（生成 Markdown 报告）：
  python backend/scripts/list_role_permissions.py --md
  python backend/scripts/list_role_permissions.py --md -o docs/role_permissions_report.md
"""
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import load_env_with_fallback

load_env_with_fallback()

from app.database import SessionLocal
from app.models.user import Role, Permission, RolePermission

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


def format_scope(record) -> str:
    """从角色权限记录中提取范围限制，格式化为可读字符串。"""
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
    """查询所有角色及其权限，返回结构化数据。"""
    roles = db.query(Role).order_by(Role.name).all()
    result = []
    for role in roles:
        active_tag = " [已禁用]" if not getattr(role, "is_active", True) else ""
        entry = {
            "name": role.name,
            "id": role.id,
            "title": f"{role.name} (id={role.id}){active_tag}",
            "permissions": [],
        }
        for rp in db.query(RolePermission).filter(RolePermission.role_id == role.id).all():
            perm = rp.permission
            code = perm.code if perm else f"permission_id={rp.permission_id}"
            name = perm.name if perm and perm.name else ""
            entry["permissions"].append({
                "code": code,
                "name": name,
                "scope": format_scope(rp),
            })
        # 按权限代码排序
        entry["permissions"].sort(key=lambda p: p["code"])
        result.append(entry)
    return result


def write_md(path: str, data: list) -> None:
    """将角色权限数据写入 Markdown 文件（UTF-8）。"""
    lines = [
        "# 角色权限一览",
        "",
        "本文档由 `backend/scripts/list_role_permissions.py --md` 生成，列出各角色拥有的权限及 scope/subproject 范围限制。",
        "",
        f"**生成时间**：{datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
        "---",
        "",
    ]
    for entry in data:
        lines.append(f"## {entry['title']}")
        lines.append("")
        if not entry["permissions"]:
            lines.append("（无权限）")
            lines.append("")
            continue
        lines.append("| 权限代码 | 权限名称 | 范围 |")
        lines.append("|----------|----------|------|")
        for p in entry["permissions"]:
            name = (p["name"] or "").replace("|", "\\|")
            scope = (p["scope"] or "").replace("|", "\\|")
            lines.append(f"| `{p['code']}` | {name} | {scope} |")
        lines.append("")
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def run():
    db = SessionLocal()
    try:
        roles = db.query(Role).order_by(Role.name).all()
        if not roles:
            print("暂无角色。")
            return

        for role in roles:
            active_tag = " [已禁用]" if not getattr(role, "is_active", True) else ""
            print("=" * 70)
            print(f"角色: {role.name} (id={role.id}){active_tag}")
            print("-" * 70)

            rp_list = db.query(RolePermission).filter(RolePermission.role_id == role.id).all()
            if not rp_list:
                print("  （无权限）")
            else:
                for rp in sorted(rp_list, key=lambda x: (x.permission.code if x.permission else "")):
                    perm = rp.permission
                    code = perm.code if perm else f"permission_id={rp.permission_id}"
                    name = f" — {perm.name}" if perm and perm.name else ""
                    scope_str = format_scope(rp)
                    print(f"  {code}{name}")
                    print(f"    范围: {scope_str}")
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
            out_md = os.path.join(os.path.dirname(__file__), "role_permissions_report.md")

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
