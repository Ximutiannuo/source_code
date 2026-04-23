#!/usr/bin/env python3
"""
将 volume_control_quantity 表按「用户 + 日期」回滚到该用户当日第一次修改前的状态。

依赖：volume_control_quantity_history 表中已记录每次修改的 old_value/new_value/updated_by/updated_at。
逻辑：找出指定用户在该日期的所有修改记录，对每个 (activity_id, field_name) 取当日最早一条的 old_value，
     写回 volume_control_quantity 主表，并可选写入一条回滚历史记录。

用法:
  # 仅预览（不写库）
  python rollback_volume_control_quantity_by_user_date.py --user-id 24 --date 2026-02-25

  # 执行回滚（建议先备份数据库或相关表）
  python rollback_volume_control_quantity_by_user_date.py --user-id 24 --date 2026-02-25 --execute

  # 指定“回滚操作人”（记录到主表 _updated_by 及历史表 updated_by）
  python rollback_volume_control_quantity_by_user_date.py --user-id 24 --date 2026-02-25 --execute --rollback-by 1

  # 仅对单个 activity_id 测试（先预览再执行）
  python rollback_volume_control_quantity_by_user_date.py --user-id 24 --date 2026-02-25 --activity-id UI1CT0001112CS01001
  python rollback_volume_control_quantity_by_user_date.py --user-id 24 --date 2026-02-25 --activity-id UI1CT0001112CS01001 --execute
"""
import argparse
import sys
from pathlib import Path
from datetime import datetime, date
from typing import Optional

project_root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from sqlalchemy import text
from app.database import SessionLocal
from app.models.volume_control_quantity import VolumeControlQuantity, VolumeControlQuantityHistory
from app.utils.timezone import now as system_now


# 主表中有 _updated_at / _updated_by 的数值字段（与 history 的 field_name 一致）
QUANTITY_FIELDS = [
    "estimated_total",
    "drawing_approved_afc",
    "material_arrived",
    "available_workface",
    "workface_restricted_material",
    "workface_restricted_site",
    "construction_completed",
]


def parse_date(s: str) -> date:
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError:
        raise argparse.ArgumentTypeError(f"无效日期格式，请使用 YYYY-MM-DD: {s}")


def get_history_for_rollback(db, user_id: int, target_date: date, activity_id: Optional[str] = None):
    """获取指定用户在该日期的所有 history 记录，按 (activity_id, field_name) 分组，取当日最早一条的 old_value。
    若指定 activity_id，则仅返回该作业的记录（用于单条测试）。"""
    params = {"uid": user_id, "dt": target_date.isoformat()}
    cond_activity = " AND h.activity_id = :activity_id" if activity_id else ""
    if activity_id:
        params["activity_id"] = activity_id
    sql = text(f"""
        SELECT h.id, h.activity_id, h.field_name, h.old_value, h.new_value, h.updated_at, h.updated_by
        FROM volume_control_quantity_history h
        WHERE h.updated_by = :uid
          AND DATE(h.updated_at) = :dt
          AND h.field_name IS NOT NULL
          {cond_activity}
        ORDER BY h.activity_id, h.field_name, h.updated_at ASC
    """)
    rows = db.execute(sql, params).fetchall()
    # 每个 (activity_id, field_name) 只保留当日最早一条（即第一次修改前的 old_value）
    seen = set()
    rollback_list = []
    for r in rows:
        key = (r.activity_id, r.field_name)
        if key in seen:
            continue
        seen.add(key)
        if r.field_name not in QUANTITY_FIELDS:
            continue
        rollback_list.append({
            "activity_id": r.activity_id,
            "field_name": r.field_name,
            "old_value": r.old_value,
            "new_value": r.new_value,
            "updated_at": r.updated_at,
        })
    return rollback_list


def dry_run(db, user_id: int, target_date: date, activity_id: Optional[str] = None):
    """仅打印将要回滚的项，不写库。预览中「当前值」来自主表 volume_control_quantity，「回滚为」即该日该用户第一次修改前的 old_value。"""
    rollback_list = get_history_for_rollback(db, user_id, target_date, activity_id)
    if not rollback_list:
        scope = f" activity_id={activity_id}" if activity_id else ""
        print(f"未找到 user_id={user_id} 在 {target_date}{scope} 对 volume_control_quantity 的修改记录。")
        return 0
    scope_note = f"（仅 activity_id={activity_id}）" if activity_id else ""
    print(f"以下 {len(rollback_list)} 条将回滚到「该日 user_id={user_id} 第一次修改前」的值（date={target_date}{scope_note}）:\n")
    for i, item in enumerate(rollback_list, 1):
        q = db.query(VolumeControlQuantity).filter(
            VolumeControlQuantity.activity_id == item["activity_id"]
        ).first()
        current_val = getattr(q, item["field_name"], None) if q else None
        print(f"  {i}. activity_id={item['activity_id']!r} field={item['field_name']!r}")
        print(f"     当前值（主表）={current_val} -> 回滚为 {item['old_value']}（该日第一次修改前的值）")
    return len(rollback_list)


def execute_rollback(db, user_id: int, target_date: date, rollback_by: int, activity_id: Optional[str] = None):
    """执行回滚：将主表对应字段恢复为当日最早一条的 old_value，并写一条回滚历史。"""
    rollback_list = get_history_for_rollback(db, user_id, target_date, activity_id)
    if not rollback_list:
        scope = f" activity_id={activity_id}" if activity_id else ""
        print(f"未找到 user_id={user_id} 在 {target_date}{scope} 的修改记录，无需回滚。")
        return 0
    now = system_now()
    updated = 0
    for item in rollback_list:
        activity_id = item["activity_id"]
        field_name = item["field_name"]
        old_value = item["old_value"]
        quantity = db.query(VolumeControlQuantity).filter(
            VolumeControlQuantity.activity_id == activity_id
        ).first()
        if not quantity:
            print(f"  跳过（主表无记录）: activity_id={activity_id} field={field_name}")
            continue
        current = getattr(quantity, field_name, None)
        setattr(quantity, field_name, old_value)
        setattr(quantity, f"{field_name}_updated_at", now)
        setattr(quantity, f"{field_name}_updated_by", rollback_by)
        # 写一条回滚历史，便于审计
        history = VolumeControlQuantityHistory(
            activity_id=activity_id,
            field_name=field_name,
            old_value=current,
            new_value=old_value,
            updated_at=now,
            updated_by=rollback_by,
            remarks=f"回滚: 恢复 user_id={user_id} 于 {target_date} 修改前的数据",
        )
        db.add(history)
        updated += 1
        print(f"  已回滚: activity_id={activity_id} field={field_name} current={current} -> {old_value}")
    db.commit()
    # 若回滚了 estimated_total，需要同步 activity_summary 的 key_qty 等
    for item in rollback_list:
        if item["field_name"] == "estimated_total":
            try:
                from app.services.activity_sync_service import ActivitySyncService
                ActivitySyncService.sync_activity_summary_from_vcq(db, item["activity_id"])
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"同步 activity_summary 失败 activity_id={item['activity_id']}: {e}")
    db.commit()
    return updated


def main():
    parser = argparse.ArgumentParser(
        description="按用户+日期回滚 volume_control_quantity 到该用户当日第一次修改前的状态"
    )
    parser.add_argument("--user-id", type=int, required=True, help="要回滚的修改人 user id（如 24）")
    parser.add_argument("--date", type=parse_date, required=True, help="日期 YYYY-MM-DD（如 2026-02-25）")
    parser.add_argument("--activity-id", type=str, default=None, help="仅处理该 activity_id（用于单条测试，如 UI1CT0001112CS01001）")
    parser.add_argument("--count-only", action="store_true", help="仅输出待回滚条数，不列明细")
    parser.add_argument("--execute", action="store_true", help="执行回滚（默认仅预览）")
    parser.add_argument("--rollback-by", type=int, default=1, help="回滚操作人 user id，用于记录主表与历史（默认 1）")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.count_only:
            rollback_list = get_history_for_rollback(db, args.user_id, args.date, args.activity_id)
            n = len(rollback_list)
            activities = len({r["activity_id"] for r in rollback_list})
            print(f"user_id={args.user_id} 在 {args.date} 的修改待回滚：共 {n} 条（涉及 {activities} 个 activity_id）")
        elif args.execute:
            n = execute_rollback(db, args.user_id, args.date, args.rollback_by, args.activity_id)
            print(f"\n回滚完成，共更新 {n} 条记录。")
        else:
            n = dry_run(db, args.user_id, args.date, args.activity_id)
            print(f"\n以上共 {n} 条。若要执行回滚，请加上 --execute。建议先备份数据库或 volume_control_quantity 表。")
    finally:
        db.close()


if __name__ == "__main__":
    main()
