"""
诊断指定分包商(scope)的工程量与实际完成数据情况。
用于排查「某分包商工程量/实际完成显示为 0 或无数据」时的原因。

用法（在 backend 目录下）:
  python -m scripts.diagnose_scope_volume C12
  python -m scripts.diagnose_scope_volume 二化建

数据来源与 AI 工具一致：
- 工程量总量/材料到货/工作面/施工完成/验收/竣工资料/收款 → activity_summary + volume_control_* 表
- 实际完成 → VFACTDB
"""
import sys
from sqlalchemy import func

from app.database import SessionLocal
from app.models.activity_summary import ActivitySummary
from app.models.report import VFACTDB
from app.models.volume_control_asbuilt import VolumeControlAsbuilt
from app.models.volume_control_inspection import VolumeControlInspection
from app.models.volume_control_payment import VolumeControlPayment
from app.models.volume_control_quantity import VolumeControlQuantity


def get_scope_list(scope: str):
    """与 ai_assistant_service._get_scopes 逻辑一致：C12/二化建 -> [C12]"""
    from app.services.ai_assistant_service import _get_scopes
    return _get_scopes(scope)


def main():
    scope_input = (sys.argv[1] or "").strip() or "C12"
    db = SessionLocal()
    try:
        scope_list = get_scope_list(scope_input)
        if not scope_list:
            print(f"未识别的分包商：{scope_input}。请使用 C12、二化建 等。")
            return

        scope_str = ", ".join(scope_list)
        print(f"=== 分包商 scope = {scope_str}（输入：{scope_input}）=== \n")

        # 1. activity_summary 中该 scope 的作业数
        n_act = (
            db.query(func.count(ActivitySummary.activity_id))
            .filter(ActivitySummary.scope.in_(scope_list))
            .scalar() or 0
        )
        print(f"1. activity_summary 中 scope in ({scope_str}) 的作业数：{n_act}")
        if n_act == 0:
            print("   → 原因：作业汇总中无该分包商的作业。请确认 P6/作业汇总 中是否已为该分包商分配 scope。\n")
        else:
            # 2. volume_control 表中与该 scope 作业关联的记录数（通过 activity_summary 关联）
            n_vcq = (
                db.query(func.count(VolumeControlQuantity.activity_id))
                .join(ActivitySummary, VolumeControlQuantity.activity_id == ActivitySummary.activity_id)
                .filter(ActivitySummary.scope.in_(scope_list))
                .scalar() or 0
            )
            n_vci = (
                db.query(func.count(VolumeControlInspection.activity_id))
                .join(ActivitySummary, VolumeControlInspection.activity_id == ActivitySummary.activity_id)
                .filter(ActivitySummary.scope.in_(scope_list))
                .scalar() or 0
            )
            n_vca = (
                db.query(func.count(VolumeControlAsbuilt.activity_id))
                .join(ActivitySummary, VolumeControlAsbuilt.activity_id == ActivitySummary.activity_id)
                .filter(ActivitySummary.scope.in_(scope_list))
                .scalar() or 0
            )
            n_vcp = (
                db.query(func.count(VolumeControlPayment.activity_id))
                .join(ActivitySummary, VolumeControlPayment.activity_id == ActivitySummary.activity_id)
                .filter(ActivitySummary.scope.in_(scope_list))
                .scalar() or 0
            )
            print(f"2. 工程量清单中该分包商作业对应的记录数：")
            print(f"   - 施工工程量(volume_control_quantity)：{n_vcq}")
            print(f"   - 验收(volume_control_inspection)：{n_vci}")
            print(f"   - 竣工资料(volume_control_asbuilt)：{n_vca}")
            print(f"   - 收款(volume_control_payment)：{n_vcp}")
            if n_vcq == 0 and n_vci == 0 and n_vca == 0 and n_vcp == 0:
                print("   → 原因：activity_summary 中有作业，但工程量清单中未录入数据。请在工程量管理中录入。\n")
            else:
                print("   → 工程量清单已有数据，若 AI 仍显示 0，请检查 work_type/位置/期别 等筛选是否过滤掉了全部数据。\n")

        # 3. VFACTDB 中该 scope 的记录数（实际完成）
        n_vf = (
            db.query(func.count(VFACTDB.id))
            .filter(VFACTDB.scope.in_(scope_list))
            .scalar() or 0
        )
        vf_sum = (
            db.query(func.sum(VFACTDB.achieved))
            .filter(VFACTDB.scope.in_(scope_list))
            .scalar()
        )
        print(f"3. VFACTDB（实际完成日报）中 scope in ({scope_str}) 的记录数：{n_vf}，achieved 合计：{vf_sum or 0}")
        if n_vf == 0:
            print("   → 原因：该分包商无日报数据。请确认分包商是否已填报日报或系统是否已从 PI04/PI05 等同步 VFACTDB。\n")
        else:
            print("   → 有实际完成数据。若按专业分组无数据，请检查 date_range/work_type 是否过滤掉了全部记录。\n")

        print("=== 诊断结束 ===")
    finally:
        db.close()


if __name__ == "__main__":
    main()
