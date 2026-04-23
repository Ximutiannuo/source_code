"""
AI 助手服务 - DeepSeek API 调用与 Function Calling
"""
import json
import logging
import re
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from openai import OpenAI
from sqlalchemy import func, or_, text
from sqlalchemy.orm import Session

from app.config import settings
from app.models.activity_summary import ActivitySummary
from app.models.ahead_plan import AheadPlan
from app.models.report import MPDB, VFACTDB
from app.models.rsc import RSCDefine
from app.models.volume_control_asbuilt import VolumeControlAsbuilt
from app.models.volume_control_inspection import VolumeControlInspection
from app.models.volume_control_payment import VolumeControlPayment
from app.models.volume_control_quantity import VolumeControlQuantity
from app.models.ai_assistant_query_log import AIAssistantQueryLog
from app.models.ai_assistant_usage import AIAssistantUsage
from app.models.user import Permission, Role, RolePermission, User, user_role_table
from app.services.ai_assistant_tools import TOOLS
from app.services.productivity_service import get_productivity_analysis, PROJECT_START_DATE
from app.services.s_curve_filter_utils import build_act_where_sql, build_filter_key
from app.services.dashboard_service import DashboardService

logger = logging.getLogger(__name__)

# AI 助手参考的权限代码：用于从 role_permissions 提取用户默认 scope/subproject 约束
_AI_SCOPE_PERMISSION_CODES = (
    "construction_volume:read",
    "daily_report:read",
    "planning:read",
    "acceptance_volume:read",
    "abd_volume:read",
    "ovr_volume:read",
)


def get_ai_user_constraints(db: Session, user: Any) -> Dict[str, Optional[str]]:
    """
    根据用户角色权限返回 AI 查询的默认约束。
    C01Planner -> scope=C01；ECUConstructionSupervisor -> subproject=ECU。
    超级管理员无约束。返回 {"scope": str|None, "subproject": str|None}。
    """
    if not user or getattr(user, "is_superuser", False):
        return {"scope": None, "subproject": None}

    perm_ids = [
        p.id
        for p in db.query(Permission)
        .filter(Permission.code.in_(_AI_SCOPE_PERMISSION_CODES))
        .all()
    ]
    if not perm_ids:
        return {"scope": None, "subproject": None}

    role_ids = [
        r.id
        for r in db.query(Role)
        .join(user_role_table, Role.id == user_role_table.c.role_id)
        .filter(
            user_role_table.c.user_id == user.id,
            Role.is_active == True,
        )
        .all()
    ]
    if not role_ids:
        return {"scope": None, "subproject": None}

    rows = (
        db.query(RolePermission.scope, RolePermission.subproject)
        .filter(
            RolePermission.role_id.in_(role_ids),
            RolePermission.permission_id.in_(perm_ids),
        )
        .distinct()
        .all()
    )
    scopes = [r[0] for r in rows if r[0]]
    subprojects = [r[1] for r in rows if r[1]]
    return {
        "scope": ",".join(sorted(set(scopes))) if scopes else None,
        "subproject": ",".join(sorted(set(subprojects))) if subprojects else None,
    }


def _merge_constraints(
    args: dict,
    constraints: Dict[str, Optional[str]],
    scope_key: str = "scope",
    location_key: str = "location",
) -> dict:
    """
    将用户权限约束合并到工具参数中。用户仅能查看自己有权限的数据。
    有 scope/subproject 约束时，强制使用约束值（防止越权查询）。
    """
    out = dict(args)
    if constraints.get("scope"):
        out[scope_key] = constraints["scope"]
    if constraints.get("subproject"):
        # subproject 约束映射到 location（设施维度过滤）
        out[location_key] = constraints["subproject"]
    return out


def _build_system_prompt(constraints: Dict[str, Optional[str]]) -> str:
    """根据用户权限约束追加 system prompt 提示。"""
    base = AI_ASSISTANT_SYSTEM_PROMPT
    parts = []
    if constraints.get("scope"):
        parts.append(f"scope={constraints['scope']}（仅能查看该分包商数据）")
    if constraints.get("subproject"):
        parts.append(f"subproject/location={constraints['subproject']}（仅能查看该子项目/区域数据）")
    if parts:
        base += "\n\n【当前用户数据范围】" + "；".join(parts) + "。调用工具时 scope/location 将自动使用以上范围。"
    return base


# 用户说的「工程量类型」-> work_package 列表（rsc_defines.cn_wk_report + wpkg_description）
WORK_TYPE_MAPPING = {
    # === 混凝土/土建 (CI) ===
    "开挖": ["CI01"],
    "打桩": ["CI02"],
    "基础混凝土": ["CI03", "CI06"],
    "结构基础": ["CI03"],
    "设备基础": ["CI06"],
    "上部混凝土": ["CI04", "CI05", "CI07", "CI08"],
    "结构地坪": ["CI07"],
    "管墩基础": ["CI08"],
    "道路地坪": ["CI09"],
    "景观绿植": ["CI10"],
    "混凝土": ["CI03", "CI04", "CI05", "CI06", "CI07", "CI08"],
    "地坪": ["CI07", "CI09"],
    "砼": ["CI03", "CI04", "CI05", "CI06", "CI07", "CI08"],
    "土建": ["CI01", "CI02", "CI03", "CI04", "CI05", "CI06", "CI07", "CI08", "CI09", "CI10"],
    "KJ0": ["CI02"],
    "KJ1": ["CI03"],
    "KJ2": ["CI04", "CI05"],
    "KJ3": ["CI06"],
    "KJ4": ["CI07"],
    "KJ5": ["CI07"],
    "KJ6": ["CI08"],

    # === 建筑物 (AR) ===
    "建筑物": ["AR01", "AR02", "AR03", "AR04", "AR05", "AR06", "AR07"],
    "建筑物内墙": ["AR01"],
    "砖墙": ["AR01"],
    "建筑物外墙": ["AR02"],
    "夹芯板": ["AR02"],
    "建筑物地面": ["AR03"],
    "建筑物吊顶": ["AR04"],
    "建筑物门窗": ["AR05"],
    "给排水管": ["AR06"],
    "给排水": ["AR06"],
    "建筑物屋面": ["AR07"],
    "内墙": ["AR01"],
    "外墙": ["AR02"],
    "地面": ["AR03"],
    "吊顶": ["AR04"],
    "门窗": ["AR05"],
    "屋面": ["AR07"],
    # === 暖通 (HV) ===
    "采暖管道": ["HV01"],
    "采暖设备": ["HV02"],
    "风管": ["HV03"],
    "通风设备": ["HV04"],
    "空调": ["HV05"],
    "地暖": ["HV06"],
    "暖通": ["HV01", "HV02", "HV03", "HV04", "HV05", "HV06"],
    # === 钢结构 (CS) ===
    "钢结构": ["CS01", "CS02", "CS03", "CS04"],
    "钢构": ["CS01", "CS02", "CS03", "CS04"],
    "钢": ["CS01", "CS02", "CS03", "CS04"],
    "主体结构": ["CS01"],
    "次级结构": ["CS02", "CS03", "CS04"],

    # === 设备 (ME) ===
    "设备": ["ME01", "ME02", "ME03", "ME04", "ME05", "ME06", "ME07", "ME08", "ME09"],
    "静设备": ["ME01"],
    "塔器": ["ME01"],
    "反应器": ["ME01"],
    "容器": ["ME01"],
    "换热器": ["ME01"],
    "塔盘": ["ME02"],
    "填料": ["ME02"],
    "泵": ["ME03"],
    "压缩机": ["ME04"],
    "空冷器": ["ME05"],
    "空冷": ["ME05"],
    "加热炉": ["ME06"],
    "裂解炉": ["ME06"],
    "炉子": ["ME06"],
    "撬装": ["ME07"],
    "成套设备": ["ME07"],
    "撬": ["ME07"],
    "储罐": ["ME09"],
    "罐": ["ME09"],
    "其它设备": ["ME08"],
    "其他设备": ["ME08"],
    # === 管道 (PI) ===
    "地管": ["PI01"],
    "地管井": ["PI02"],
    "阴极保护": ["PI03"],
    "工艺管": ["PI04", "PI05", "PI06", "PI07", "PI08", "PI09"],
    "工艺管道": ["PI04", "PI05", "PI06", "PI07", "PI08", "PI09"],
    "焊接": ["PI04", "PI05"],
    "管道预制": ["PI04"],
    "管道安装": ["PI05"],
    "管架": ["PI06", "PI07"],
    "管支架": ["PI06", "PI07"],
    "管道支架": ["PI06", "PI07"],
    "管道支架预制": ["PI06"],
    "管道支架安装": ["PI07"],
    "工艺管道支架": ["PI06", "PI07"],
    "水压试验": ["PI08"],
    "管道试压": ["PI08"],
    "伴热": ["PI09"],
    "管道伴热系统": ["PI09"],
    "地下管": ["PI01"],
    # === 电气 (EL) ===
    "接地": ["EL01"],
    "变压器": ["EL02"],
    "开关柜": ["EL03"],
    "UPS": ["EL04"],
    "电气桥架": ["EL05"],
    "电气电缆": ["EL06"],
    "桥架": ["EL05", "IN02", "IN04"],
    "电缆": ["EL06", "IN03", "IN05"],
    "电伴热": ["EL08"],
    "灯具": ["EL09"],
    "电气": ["EL01", "EL02", "EL03", "EL04", "EL05", "EL06", "EL07", "EL08", "EL09"],
    # === 仪表 (IN) ===
    "仪表桥架": ["IN02", "IN04"],
    "仪表主桥架": ["IN02"],
    "仪表分支桥架": ["IN04"],
    "仪表电缆": ["IN03", "IN05"],
    "仪表主电缆": ["IN03"],
    "仪表分支电缆": ["IN05"],
    "控制系统": ["IN01"],
    "DCS": ["IN01"],
    "PLC": ["IN01"],
    "接线箱": ["IN06"],
    "分析小屋": ["IN07"],
    "仪表设备": ["IN08"],
    "仪表": ["IN01", "IN02", "IN03", "IN04", "IN05", "IN06", "IN07", "IN08", "IN09", "IN10"],
    "电仪": ["EL01", "EL02", "EL03", "EL04", "EL05", "EL06", "EL07", "EL08", "EL09", "IN01", "IN02", "IN03", "IN04", "IN05", "IN06", "IN07", "IN08", "IN09", "IN10"],
    "电气仪表": ["EL01", "EL02", "EL03", "EL04", "EL05", "EL06", "EL07", "EL08", "EL09", "IN01", "IN02", "IN03", "IN04", "IN05", "IN06", "IN07", "IN08", "IN09", "IN10"],
    # === 防腐 (PA) ===
    "防腐": ["PA01", "PA02", "PA03"],
    "管道防腐": ["PA01"],
    "工艺管道防腐": ["PA01"],
    "设备防腐": ["PA02"],
    "钢结构防腐": ["PA03"],
    "结构防腐": ["PA03"],
    # === 保温 (IS) ===
    "保温": ["IS01", "IS02"],
    "设备保温": ["IS01"],
    "管道保温": ["IS02"],
    # === 消防 (FF) ===
    "消防": ["FF01", "FF02", "FF03"],
    "消防栓": ["FF01"],
    "安全淋浴": ["FF02"],
    "消防系统": ["FF03"],
    # 专业（discipline）别名，与 DISCIPLINE_MAPPING 对应
    "管道": ["PI01", "PI02", "PI03", "PI04", "PI05", "PI06", "PI07", "PI08", "PI09"],
    "建筑": ["AR01", "AR02", "AR03", "AR04", "AR05", "AR06", "AR07"],
    "装饰装修": ["AR01", "AR02", "AR03", "AR04", "AR05", "AR06", "AR07"],
    "结构": ["CS01", "CS02", "CS03", "CS04"],
    "工艺设备": ["ME01", "ME02", "ME03", "ME04", "ME05", "ME06", "ME07", "ME08", "ME09"],
    "辅助作业": [],  # CO 专业，可据 rsc_defines 补充
    "预试车": [],    # PC 专业，可据 rsc_defines 补充
}

# work_package -> 中文展示名（优先使用，rsc_defines.cn_wk_report 为空或混合代码时兜底）
# 若 WP_CODE_TO_CN 有此 code，则优先用此中文；否则用 rsc_defines.cn_wk_report；再否则用 code 本身
WP_CODE_TO_CN = {
    # 土建 CI
    "CI01": "开挖", "CI02": "打桩", "CI03": "结构基础", "CI04": "上部混凝土", "CI05": "上部混凝土",
    "CI06": "设备基础", "CI07": "结构地坪", "CI08": "管墩基础", "CI09": "道路地坪", "CI10": "景观绿植",
    # 建筑 AR
    "AR01": "内墙", "AR02": "外墙", "AR03": "地面", "AR04": "吊顶", "AR05": "门窗",
    "AR06": "给排水管", "AR07": "屋面",
    # 暖通 HV
    "HV01": "热水管道系统", "HV02": "暖通加热设备", "HV03": "暖通风管", "HV04": "通风设备",
    "HV05": "空调系统", "HV06": "地暖系统",
    # 钢结构 CS
    "CS01": "主体结构", "CS02": "次级结构", "CS03": "次级结构", "CS04": "次级结构",
    # 设备 ME
    "ME01": "静设备", "ME02": "塔盘/填料", "ME03": "泵", "ME04": "压缩机", "ME05": "空冷器",
    "ME06": "加热炉", "ME07": "撬装", "ME08": "其他设备", "ME09": "储罐",
    # 管道 PI
    "PI01": "地管", "PI02": "地管井", "PI03": "阴极保护", "PI04": "管道预制", "PI05": "管道安装",
    "PI06": "管道支架预制", "PI07": "管道支架安装", "PI08": "管道试压", "PI09": "管道伴热系统", "PI10": "塑料井",
    # 电气 EL
    "EL01": "接地", "EL02": "变压器", "EL03": "开关柜", "EL04": "UPS", "EL05": "电气桥架",
    "EL06": "电气电缆", "EL07": "电气设备", "EL08": "电伴热系统", "EL09": "灯具",
    # 仪表 IN
    "IN01": "控制系统（DCS/PLC/SIS等）", "IN02": "仪表主桥架", "IN03": "仪表主电缆", "IN04": "仪表分支桥架",
    "IN05": "仪表分支电缆", "IN06": "接线箱", "IN07": "分析小屋", "IN08": "仪表设备",
    "IN09": "仪表", "IN10": "仪表",
    # 防腐 PA
    "PA01": "管道防腐", "PA02": "设备防腐", "PA03": "钢结构防腐",
    # 保温 IS
    "IS01": "设备保温", "IS02": "管道保温",
    # 消防 FF
    "FF01": "消防栓/消防炮", "FF02": "洗眼器和安全淋浴系统", "FF03": "水/泡沫/气体消防系统",
    # 辅助作业 CO
    "CO01": "辅助作业", "CO02": "辅助作业", "CO03": "辅助作业", "CO04": "辅助作业",
}


def _get_wp_display_cn(wp: Optional[str], rsc_cn: Optional[str]) -> str:
    """
    获取 work_package 的中文展示名。优先 WP_CODE_TO_CN，其次 rsc_defines.cn_wk_report，最后 code 本身。
    """
    if not wp:
        return rsc_cn or "(空)"
    return WP_CODE_TO_CN.get(wp) or (rsc_cn and rsc_cn.strip()) or wp


SCOPE_MAPPING = {
    "重庆分公司": ["C01"],
    "重分": ["C01"],
    "施工一队": ["C01"],
    "一队": ["C01"],
    "1队": ["C01"],
    "施工1队": ["C01"],
    "C1": ["C01"],

    "十一公司": ["C02"],
    "十一化建": ["C02"],
    "施工二队": ["C02"],
    "二队": ["C02"],
    "2队": ["C02"],
    "施工2队": ["C02"],
    "C2": ["C02"],

    "水利水电十二局": ["C05"],
    "水电十二局": ["C05"],
    "施工五队": ["C05"],
    "五队": ["C05"],
    "5队": ["C05"],
    "施工5队": ["C05"],
    "C5": ["C05"],

    "河南二建": ["C07"],
    "施工七队": ["C07"],
    "七队": ["C07"],
    "7队": ["C07"],
    "施工7队": ["C07"],
    "C7": ["C07"],   

    "四化建": ["C09"],
    "施工九队": ["C09"],
    "四公司": ["C09"],
    "九队": ["C09"],
    "9队": ["C09"],
    "施工9队": ["C09"],
    "C9": ["C09"], 

    "中化二建": ["C12"],
    "二化建": ["C12"],
    "二公司": ["C12"],
    "施工十二队": ["C12"],
    "十二队": ["C12"],
    "12队": ["C12"],
    "施工12队": ["C12"],

    "十三化建": ["C13"],
    "十三公司": ["C13"],
    "施工十三队": ["C13"],
    "十三队": ["C13"],
    "13队": ["C13"],
    "施工13队": ["C13"],

    "泸州分公司": ["C15"],
    "泸分": ["C15"],
    "施工十五队": ["C15"],
    "十五队": ["C15"],
    "15队": ["C15"],
    "施工15队": ["C15"],

    "生态公司": ["C16"],
    "中化环保": ["C16"],
    "施工十六队": ["C16"],
    "十六队": ["C16"],
    "16队": ["C16"],
    "施工16队": ["C16"],

    "贵州熠诺": ["C17"],
    "施工十七队": ["C17"],
    "十七队": ["C17"],
    "17队": ["C17"],
    "施工17队": ["C17"],    

    "十六公司": ["C18"],
    "十六化建": ["C18"],
    "十八队": ["C18"],
    "18队": ["C18"],
    "施工18队": ["C18"],

    "十四公司": ["C19"],
    "十四化建": ["C19"],
    "十九队": ["C19"],
    "19队": ["C19"],
    "施工19队": ["C19"],
    # 直接 scope 码
    "C01": ["C01"], "C02": ["C02"], "C05": ["C05"], "C07": ["C07"],
    "C09": ["C09"], "C12": ["C12"], "C13": ["C13"], "C15": ["C15"],
    "C16": ["C16"], "C17": ["C17"], "C18": ["C18"], "C19": ["C19"],
}

# 化工行业「专业」与工作包（WBS）包含关系：专业代码 -> (中文名, 工作包列表)
# 专业包含以其为前缀的 work_package，如 CI 专业包含 CI01-CI10
# AR(内墙、外墙、屋面等) 为建筑物/装饰装修专业，与 CI 土建专业区分
DISCIPLINE_MAPPING = {
    "CI": ("土建", ["CI01", "CI02", "CI03", "CI04", "CI05", "CI06", "CI07", "CI08", "CI09", "CI10"]),
    "AR": ("建筑物/装饰装修", ["AR01", "AR02", "AR03", "AR04", "AR05", "AR06", "AR07"]),
    "HV": ("暖通", ["HV01", "HV02", "HV03", "HV04", "HV05", "HV06"]),
    "CS": ("钢结构", ["CS01", "CS02", "CS03", "CS04"]),
    "ME": ("设备", ["ME01", "ME02", "ME03", "ME04", "ME05", "ME06", "ME07", "ME08", "ME09"]),
    "PI": ("管道", ["PI01", "PI02", "PI03", "PI04", "PI05", "PI06", "PI07", "PI08", "PI09"]),
    "EL": ("电气", ["EL01", "EL02", "EL03", "EL04", "EL05", "EL06", "EL07", "EL08", "EL09"]),
    "IN": ("仪表", ["IN01", "IN02", "IN03", "IN04", "IN05", "IN06", "IN07", "IN08", "IN09", "IN10"]),
    "FF": ("消防", ["FF01", "FF02", "FF03"]),
    "PA": ("防腐", ["PA01", "PA02", "PA03"]),
    "IS": ("保温", ["IS01", "IS02"]),
    "CO": ("辅助作业", ["CO01", "CO02", "CO03", "CO04"]),   # 可据 rsc_defines 补充
    "PC": ("预试车", []),    # 可据 rsc_defines 补充
}

# 设施/维度映射（与 ActivityListAdvanced 一致）
# 中文名称/英文字段 -> 数据库字段名
FACILITIES_MAPPING = {
    "子项目": "subproject",
    "subproject": "subproject",
    "开车阶段": "train",
    "train": "train",
    "装置": "unit",
    "unit": "unit",
    "子项": "block",
    "block": "block",
    "主项": "main_block",
    "main_block": "main_block",
    "区块": "quarter",
    "quarter": "quarter",
    "分包商": "scope",
    "scope": "scope",
}

# 期别 -> train 过滤：一期=T0/T1，二期=T2
TRAIN_PHASE_MAPPING = {
    "一期": ["T0", "T1"],
    "二期": ["T2"],
}


def _resolve_phase(phase: str) -> Optional[List[str]]:
    """用户说的期别 -> train 列表。一期=T0/T1，二期=T2。返回 None 表示不按期过滤。"""
    if not phase or not phase.strip():
        return None
    key = phase.strip()
    return TRAIN_PHASE_MAPPING.get(key)


# 字段名 -> 中文标签（用于输出）
FACILITY_CN_LABELS = {
    "subproject": "子项目",
    "train": "开车阶段",
    "unit": "装置",
    "block": "子项",
    "main_block": "主项",
    "quarter": "区块",
    "scope": "分包商",
}


def _resolve_group_by(group_by: str) -> Optional[Tuple[str, str]]:
    """
    用户说的分组维度 -> (数据库字段名, 中文标签)。
    返回 None 表示无法解析。
    """
    if not group_by or not group_by.strip():
        return None
    key = group_by.strip()
    col = FACILITIES_MAPPING.get(key)
    if col:
        cn = FACILITY_CN_LABELS.get(col, col)
        return (col, cn)
    for k, v in FACILITIES_MAPPING.items():
        if key in k and len(k) > 2 and k not in ("subproject", "train", "unit", "block", "main_block", "quarter"):
            return (v, k)
    return None


def _get_scopes(scope: str) -> Optional[List[str]]:
    """
    用户说的 scope → scope 代码列表。
    返回 None 表示不按 scope 过滤（全项目）；返回 [...] 表示按这些 scope 过滤。
    """
    if not scope or not scope.strip():
        return None
    key = scope.strip()

    # 1. 精确匹配
    codes = SCOPE_MAPPING.get(key)
    if codes:
        return codes

    # 2. 模糊匹配：mapping key 包含用户输入
    collected = []
    for k, v in SCOPE_MAPPING.items():
        if key in k:
            collected.extend(v)
    if collected:
        return list(dict.fromkeys(collected))

    # 3. 直接 scope 码（C01、C02 等）
    if len(key) >= 2 and key[0].upper() == "C" and key[1:].isdigit():
        return [f"C{key[1:].zfill(2)}"]

    return [key]  # 兜底


def _this_week_thursday() -> datetime.date:
    """本周四（ahead_plan 周周期为周五至周四，date 存周四）。
    例如：今天是周五，本周=本周五~下周四，本周四=下周四；上周=上周五~本周四。"""
    today = datetime.now().date()
    days_until = (3 - today.weekday() + 7) % 7
    return today + timedelta(days=days_until)


def _parse_week(week_str: str) -> datetime.date:
    """解析相对周或 YYYY-MM-DD 为周结束日（周四）。
    周定义：周五~周四为一周，周四为该周标识日期。
    支持：本周/这周、上周、上上周/上上周、下周、未来N周、过去N周、YYYY-MM-DD。"""
    if not week_str or not week_str.strip():
        return _this_week_thursday()
    s = week_str.strip()
    thursday = _this_week_thursday()

    # 周映射（周四日期）
    week_map = {
        "本周": 0, "这周": 0,
        "上周": -1, "上週": -1,
        "上上周": -2, "上上週": -2, "大上周": -2,
        "下周": 1, "下週": 1,
        "下下周": 2, "下下週": 2,
    }
    if s in week_map:
        return thursday + timedelta(weeks=week_map[s])

    # 未来N周、过去N周
    m_future = re.match(r"^未来\s*(\d+)\s*周$", s)
    if m_future:
        n = int(m_future.group(1))
        return thursday + timedelta(weeks=n)
    m_past = re.match(r"^过去\s*(\d+)\s*周$", s)
    if m_past:
        n = int(m_past.group(1))
        return thursday - timedelta(weeks=n)

    # YYYY-MM-DD
    for fmt in ("%Y-%m-%d", "%Y/%m/%d"):
        try:
            d = datetime.strptime(s, fmt).date()
            # 周定义为周五～周四，周四为周标识日。若用户给的是周五日期，需转为该周周四
            if d.weekday() == 4:  # 周五
                return d + timedelta(days=6)  # 该周周四
            return d
        except ValueError:
            continue
    # 日期范围写法（如 2026.2.20-2.26、2026-02-20至2026-02-26）：取终点日作为该周周四
    range_m = re.search(
        r"(\d{4})[./-](\d{1,2})[./-](\d{1,2})\s*[-~至到]\s*(\d{4})?[./-]?(\d{1,2})[./-](\d{1,2})",
        s,
    )
    if range_m:
        y1, m1, d1 = int(range_m.group(1)), int(range_m.group(2)), int(range_m.group(3))
        y2 = int(range_m.group(4) or y1)
        m2, d2 = int(range_m.group(5)), int(range_m.group(6))
        try:
            end_d = datetime(y2, m2, d2).date()
            if end_d.weekday() == 3:  # 周四，直接返回
                return end_d
            if end_d.weekday() == 4:  # 周五，该周周四为 end_d+6
                return end_d + timedelta(days=6)
            # 其他情况返回 end_d 本身（如用户指定 2.26 且 2.26 为周四）
            return end_d
        except ValueError:
            pass
    return thursday


def _parse_date(date_str: str) -> datetime.date:
    """把相对日期或 YYYY-MM-DD 解析成 date。
    支持：昨天、前天、今天、本周、本月、上月、下月、本年、去年、YYYY-MM-DD 等。"""
    if not date_str or not date_str.strip():
        return datetime.now().date()
    s = date_str.strip()
    today = datetime.now().date()

    # 日
    if s in ("昨天", "昨日"):
        return today - timedelta(days=1)
    if s in ("前天",):
        return today - timedelta(days=2)
    if s in ("今天", "今日"):
        return today
    if s in ("大前天",):
        return today - timedelta(days=3)

    # 周（返回该周周四作为代表日）
    if s in ("本周", "这周", "上周", "上上周", "下周"):
        return _parse_week(s)

    # 月
    if s in ("本月", "这月"):
        return today.replace(day=1)
    if s in ("上月", "上个月"):
        first = (today.replace(day=1)) - timedelta(days=1)
        return first.replace(day=1)
    if s in ("下月", "下个月"):
        if today.month == 12:
            return today.replace(year=today.year + 1, month=1, day=1)
        return today.replace(month=today.month + 1, day=1)
    m_past_month = re.match(r"^过去\s*(\d+)\s*月$", s)
    if m_past_month:
        n = int(m_past_month.group(1))
        d = today
        for _ in range(n):
            d = (d.replace(day=1) - timedelta(days=1)).replace(day=1)
        return d
    m_future_month = re.match(r"^未来\s*(\d+)\s*月$", s)
    if m_future_month:
        n = int(m_future_month.group(1))
        y, m = today.year, today.month
        m += n
        while m > 12:
            m -= 12
            y += 1
        return today.replace(year=y, month=m, day=1)

    # 季度（返回季度最后一天）
    if s in ("本季度", "这季度"):
        q = (today.month - 1) // 3 + 1
        last_month = q * 3
        d = today.replace(month=last_month, day=1)
        nd = d.replace(day=28) + timedelta(days=4)
        return (nd.replace(day=1) - timedelta(days=1))
    if s in ("上季度", "上个季度"):
        q = (today.month - 1) // 3
        if q == 0:
            last_month = 12
            y = today.year - 1
        else:
            last_month = q * 3
            y = today.year
        d = today.replace(year=y, month=last_month, day=1)
        nd = d.replace(day=28) + timedelta(days=4)
        return (nd.replace(day=1) - timedelta(days=1))
    if s in ("下季度", "下个季度"):
        q = (today.month - 1) // 3 + 2
        if q > 4:
            last_month = 3
            y = today.year + 1
        else:
            last_month = q * 3
            y = today.year
        d = today.replace(year=y, month=last_month, day=1)
        nd = d.replace(day=28) + timedelta(days=4)
        return (nd.replace(day=1) - timedelta(days=1))

    # 年
    if s in ("本年", "今年"):
        return today.replace(month=1, day=1)
    if s in ("去年", "上年"):
        return today.replace(year=today.year - 1, month=1, day=1)
    if s in ("明年"):
        return today.replace(year=today.year + 1, month=1, day=1)

    # YYYY-MM-DD
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y%m%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return today


def _parse_type_of_plan_period(type_of_plan: str) -> Optional[Tuple[datetime.date, datetime.date]]:
    """
    从 type_of_plan 解析日期范围。如 月滚动计划_2026-01-30~2026-02-26 -> (2026-01-30, 2026-02-26)。
    返回 None 表示无法解析。
    """
    if not type_of_plan or not type_of_plan.strip():
        return None
    m = re.search(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s*[~至到]\s*(\d{4})[-/](\d{1,2})[-/](\d{1,2})", type_of_plan)
    if not m:
        return None
    try:
        d1 = datetime(int(m.group(1)), int(m.group(2)), int(m.group(3))).date()
        d2 = datetime(int(m.group(4)), int(m.group(5)), int(m.group(6))).date()
        return (d1, d2) if d1 <= d2 else (d2, d1)
    except (ValueError, IndexError):
        return None


def _parse_single_date_part(part: str) -> Optional[datetime.date]:
    """解析单个日期部分，支持 YYYY-MM-DD、YYYY.M.D、YYYY年M月D日、YYYY/M/D 等。"""
    if not part:
        return None
    part = part.strip()
    # YYYY.M.D、YYYY.MM.DD（非规范写法，如 2026.2.20）
    m_dot = re.match(r"^(\d{4})\.(\d{1,2})\.(\d{1,2})$", part)
    if m_dot:
        try:
            return datetime(int(m_dot.group(1)), int(m_dot.group(2)), int(m_dot.group(3))).date()
        except ValueError:
            pass
    # YYYY-MM-DD, YYYY/MM/DD, YYYYMMDD
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y%m%d"):
        try:
            return datetime.strptime(part, fmt).date()
        except ValueError:
            continue
    # YYYY年M月D日、YYYY年MM月DD日
    m = re.match(r"(\d{4})年(\d{1,2})月(\d{1,2})日?", part)
    if m:
        try:
            return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3))).date()
        except ValueError:
            pass
    return None


def _week_range_from_thursday(thursday: datetime.date) -> Tuple[datetime.date, datetime.date]:
    """由周四日期得到该周范围（周五~周四）"""
    friday = thursday - timedelta(days=6)
    return (friday, thursday)


def _resolve_relative_end_date(
    end_word: str, today: datetime.date, thursday: datetime.date
) -> Optional[datetime.date]:
    """
    将「到 XXX」中的相对终点词解析为单个日期。
    用于支持「2026年2月1日到今天」「到昨天」「到上周」等语义。
    """
    if not end_word or not end_word.strip():
        return None
    w = end_word.strip()
    # 日
    if w in ("今天", "今日"):
        return today
    if w in ("昨天", "昨日"):
        return today - timedelta(days=1)
    if w in ("前天",):
        return today - timedelta(days=2)
    if w in ("大前天",):
        return today - timedelta(days=3)
    # 周：以周五~周四为一周，终点取该周周四
    if w in ("本周", "这周"):
        return thursday
    if w in ("上周", "上週"):
        return thursday - timedelta(weeks=1)
    if w in ("上上周", "上上週", "大上周"):
        return thursday - timedelta(weeks=2)
    if w in ("下周", "下週"):
        return thursday + timedelta(weeks=1)
    if w in ("下下周", "下下週"):
        return thursday + timedelta(weeks=2)
    # 月：终点取该月最后一天
    if w in ("本月", "这月"):
        d1 = today.replace(day=1)
        nd = d1.replace(day=28) + timedelta(days=4)
        return nd.replace(day=1) - timedelta(days=1)
    if w in ("上月", "上个月"):
        d1 = today.replace(day=1) - timedelta(days=1)
        d1 = d1.replace(day=1)
        nd = d1.replace(day=28) + timedelta(days=4)
        return nd.replace(day=1) - timedelta(days=1)
    if w in ("下月", "下个月"):
        if today.month == 12:
            d1 = today.replace(year=today.year + 1, month=1, day=1)
        else:
            d1 = today.replace(month=today.month + 1, day=1)
        nd = d1.replace(day=28) + timedelta(days=4)
        return nd.replace(day=1) - timedelta(days=1)
    # 季度
    def _quarter_last_day(y: int, q: int) -> datetime.date:
        last_month = q * 3
        d = datetime(y, last_month, 1).date()
        nd = d.replace(day=28) + timedelta(days=4)
        return nd.replace(day=1) - timedelta(days=1)

    if w in ("本季度", "这季度"):
        q = (today.month - 1) // 3 + 1
        return _quarter_last_day(today.year, q)
    if w in ("上季度", "上个季度"):
        q_cur = (today.month - 1) // 3 + 1
        q_prev = 4 if q_cur == 1 else q_cur - 1
        y = today.year - 1 if q_cur == 1 else today.year
        return _quarter_last_day(y, q_prev)
    if w in ("下季度", "下个季度"):
        q_cur = (today.month - 1) // 3 + 1
        q_next = 1 if q_cur == 4 else q_cur + 1
        y = today.year + 1 if q_cur == 4 else today.year
        return _quarter_last_day(y, q_next)
    # 年
    if w in ("本年", "今年"):
        return today.replace(month=12, day=31)
    if w in ("去年", "上年"):
        return today.replace(year=today.year - 1, month=12, day=31)
    if w in ("明年",):
        return today.replace(year=today.year + 1, month=12, day=31)
    return None


def _parse_date_range(date_str: str) -> Tuple[datetime.date, datetime.date]:
    """解析为日期范围。
    支持：全周期/累计（项目起日至今天）、单日、本周、上周、上上周、下周、过去N周、未来N周、
    本月、上月、下月、过去N月、未来N月、
    本季度、上季度、下季度、本年、去年、明年、
    YYYY-MM-DD至YYYY-MM-DD、2025年1月1日至2026年2月12日、
    某年某月整月（如 2026年2月、2026年2月份 → 该月1日至该月最后一日）；
    以及「起始日至相对终点」：如 2026年2月1日到今天、到昨天、到上周、到本周、到上月、到本月、到本季度、到今年 等。"""
    if not date_str or not date_str.strip():
        d = datetime.now().date()
        return (d, d)
    s = date_str.strip()
    today = datetime.now().date()
    thursday = _this_week_thursday()

    # 全周期/累计：项目起日至今天
    if s in ("全周期", "累计", "整个周期", "全计划周期", "周期"):
        return (datetime(2020, 1, 1).date(), today)

    # 周范围（周五~周四）
    week_range_map = {
        "本周": 0, "这周": 0,
        "上周": -1, "上週": -1,
        "上上周": -2, "上上週": -2, "大上周": -2,
        "下周": 1, "下週": 1,
        "下下周": 2, "下下週": 2,
    }
    if s in week_range_map:
        th = thursday + timedelta(weeks=week_range_map[s])
        return _week_range_from_thursday(th)

    # 过去N周、未来N周（返回连续N周的日期范围）
    m_past_weeks = re.match(r"^过去\s*(\d+)\s*周$", s)
    if m_past_weeks:
        n = int(m_past_weeks.group(1))
        end_th = thursday - timedelta(weeks=1)  # 上周四
        start_th = end_th - timedelta(weeks=n - 1)
        return _week_range_from_thursday(start_th)[0], _week_range_from_thursday(end_th)[1]
    m_future_weeks = re.match(r"^未来\s*(\d+)\s*周$", s)
    if m_future_weeks:
        n = int(m_future_weeks.group(1))
        start_th = thursday  # 本周四（本周范围是本周五~下周四）
        end_th = thursday + timedelta(weeks=n - 1)
        return _week_range_from_thursday(start_th)[0], _week_range_from_thursday(end_th)[1]

    # 月范围
    if s in ("本月", "这月"):
        d1 = today.replace(day=1)
        nd = d1.replace(day=28) + timedelta(days=4)
        d2 = (nd.replace(day=1) - timedelta(days=1))
        return (d1, d2)
    if s in ("上月", "上个月"):
        d1 = today.replace(day=1) - timedelta(days=1)
        d1 = d1.replace(day=1)
        nd = d1.replace(day=28) + timedelta(days=4)
        d2 = (nd.replace(day=1) - timedelta(days=1))
        return (d1, d2)
    if s in ("下月", "下个月"):
        if today.month == 12:
            d1 = today.replace(year=today.year + 1, month=1, day=1)
        else:
            d1 = today.replace(month=today.month + 1, day=1)
        nd = d1.replace(day=28) + timedelta(days=4)
        d2 = (nd.replace(day=1) - timedelta(days=1))
        return (d1, d2)
    m_past_months = re.match(r"^过去\s*(\d+)\s*月$", s)
    if m_past_months:
        n = int(m_past_months.group(1))
        end_d = today.replace(day=1) - timedelta(days=1)
        start_d = end_d.replace(day=1)
        for _ in range(n - 1):
            start_d = (start_d.replace(day=1) - timedelta(days=1)).replace(day=1)
        return (start_d, end_d)
    m_future_months = re.match(r"^未来\s*(\d+)\s*月$", s)
    if m_future_months:
        n = int(m_future_months.group(1))
        if today.month == 12:
            start_d = today.replace(year=today.year + 1, month=1, day=1)
        else:
            start_d = today.replace(month=today.month + 1, day=1)
        y, m = start_d.year, start_d.month
        m += n - 1
        while m > 12:
            m -= 12
            y += 1
        end_first = today.replace(year=y, month=m, day=1)
        nd = end_first.replace(day=28) + timedelta(days=4)
        end_d = (nd.replace(day=1) - timedelta(days=1))
        return (start_d, end_d)

    # 季度范围（Q1=1-3月，Q2=4-6月，Q3=7-9月，Q4=10-12月）
    def _quarter_last_day(y: int, q: int) -> datetime.date:
        """q 为 1-4 的季度号，返回该季度最后一天"""
        last_month = q * 3
        d = datetime(y, last_month, 1).date()
        nd = d.replace(day=28) + timedelta(days=4)
        return nd.replace(day=1) - timedelta(days=1)

    if s in ("本季度", "这季度"):
        q = (today.month - 1) // 3 + 1
        d1 = today.replace(month=(q - 1) * 3 + 1, day=1)
        d2 = _quarter_last_day(today.year, q)
        return (d1, d2)
    if s in ("上季度", "上个季度"):
        q_cur = (today.month - 1) // 3 + 1
        q_prev = 4 if q_cur == 1 else q_cur - 1
        y = today.year - 1 if q_cur == 1 else today.year
        d1 = today.replace(year=y, month=(q_prev - 1) * 3 + 1, day=1)
        d2 = _quarter_last_day(y, q_prev)
        return (d1, d2)
    if s in ("下季度", "下个季度"):
        q_cur = (today.month - 1) // 3 + 1
        q_next = 1 if q_cur == 4 else q_cur + 1
        y = today.year + 1 if q_cur == 4 else today.year
        d1 = today.replace(year=y, month=(q_next - 1) * 3 + 1, day=1)
        d2 = _quarter_last_day(y, q_next)
        return (d1, d2)

    # 年范围
    if s in ("本年", "今年"):
        return (today.replace(month=1, day=1), today.replace(month=12, day=31))
    if s in ("去年", "上年"):
        y = today.year - 1
        return (today.replace(year=y, month=1, day=1), today.replace(year=y, month=12, day=31))
    if s in ("明年"):
        y = today.year + 1
        return (today.replace(year=y, month=1, day=1), today.replace(year=y, month=12, day=31))

    # 尝试解析「起始日 至/到 相对终点」：如 2026年2月1日到今天、到昨天、到上周、到本月 等
    range_to_relative = re.search(
        r"(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)\s*[至到~]\s*(.+?)\s*$",
        s,
    )
    if range_to_relative:
        d1 = _parse_single_date_part(range_to_relative.group(1))
        end_word = range_to_relative.group(2).strip()
        d2 = _resolve_relative_end_date(end_word, today, thursday)
        if d1 and d2:
            return (d1, d2) if d1 <= d2 else (d2, d1)
    # 尝试解析日期范围：至、到、~（两端均为显式日期）
    range_match = re.search(
        r"(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)\s*[至到~]\s*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)",
        s,
    )
    if range_match:
        d1 = _parse_single_date_part(range_match.group(1))
        d2 = _parse_single_date_part(range_match.group(2))
        if d1 and d2:
            return (d1, d2) if d1 <= d2 else (d2, d1)
    # 某年某月（整月）：2026年2月、2026年2月份
    m_ym = re.match(r"^(\d{4})年(\d{1,2})月(份)?$", s)
    if m_ym:
        try:
            y, month = int(m_ym.group(1)), int(m_ym.group(2))
            if 1 <= month <= 12:
                d1 = datetime(y, month, 1).date()
                nd = d1.replace(day=28) + timedelta(days=4)
                d2 = (nd.replace(day=1) - timedelta(days=1))
                return (d1, d2)
        except (ValueError, TypeError):
            pass
    # 单日
    d = _parse_date(date_str)
    return (d, d)


def _get_work_packages_for_discipline(discipline: str) -> List[str]:
    """专业代码或中文名 → work_package 列表（来自 DISCIPLINE_MAPPING）"""
    if not discipline or not discipline.strip():
        return []
    key = discipline.strip().upper()
    # 专业代码如 CI、AR
    if key in DISCIPLINE_MAPPING:
        _, pkgs = DISCIPLINE_MAPPING[key]
        return pkgs.copy()
    # 中文名查找
    for code, (cn, pkgs) in DISCIPLINE_MAPPING.items():
        if key == cn:
            return pkgs.copy()
    return []


def _get_work_packages_for_scope(
    db: Session,
    scope_list: List[str],
    loc: str = "",
    train_list: Optional[List[str]] = None,
) -> List[str]:
    """从 activity_summary 取指定 scope（及可选 location、train）下的全部 work_package。用于「某分包商各工作包工程量」不指定单一类型时。"""
    q = (
        db.query(ActivitySummary.work_package)
        .filter(ActivitySummary.scope.in_(scope_list), ActivitySummary.work_package.isnot(None), ActivitySummary.work_package != "")
        .distinct()
    )
    if loc:
        q = q.filter(_location_filter(ActivitySummary, loc, _LOCATION_COLS_WITH_SIMPLE))
    if train_list is not None:
        q = q.filter(ActivitySummary.train.in_(train_list))
    return sorted([r[0] for r in q.all() if r and r[0]])


def _get_all_active_work_packages(db: Session) -> List[str]:
    """rsc_defines 中 is_active=True 的 work_package 列表。"""
    rows = db.query(RSCDefine.work_package).filter(RSCDefine.is_active == True).distinct().all()
    return sorted([r[0] for r in rows if r and r[0]])


def _get_work_packages(work_type: str) -> List[str]:
    """用户说的工程量类型/专业 → work_package 列表（支持精确匹配 + 关键词包含匹配 + 专业）"""
    if not work_type or not work_type.strip():
        return []
    key = work_type.strip()

    # 0. 专业（discipline）：如 CI、土建、土建专业、钢结构专业
    if key.endswith("专业"):
        pkgs = _get_work_packages_for_discipline(key[:-2])
        if pkgs:
            return pkgs
    pkgs = _get_work_packages_for_discipline(key)
    if pkgs:
        return pkgs

    # 1. 精确匹配
    pkgs = WORK_TYPE_MAPPING.get(key)
    if pkgs:
        return pkgs

    # 2. 模糊匹配：任意 mapping key 包含用户输入 → 合并其 work_packages
    collected = []
    for k, v in WORK_TYPE_MAPPING.items():
        if key in k:
            collected.extend(v)
    if collected:
        return list(dict.fromkeys(collected))  # 去重且保持顺序

    return [key]  # 兜底


# rsc_defines 相关：_get_ordered_wp_info 为单一数据源（顺序+uom+cn）；_get_wp_uom_map 基于其返回 uom 映射；_get_uom_for_work_packages 仅需「整段单位字符串」时用，避免重复查表形态不一致。


def _get_ordered_wp_info(db: Session, wp_list: List[str]) -> Tuple[List[str], Dict[str, Dict[str, str]]]:
    """
    从 rsc_defines 按表顺序（id）取 work_package 的 uom、cn_wk_report。
    返回：(有序 work_package 列表, {work_package: {uom, cn}})。按工作包展示、逐项单位/中文均由此统一获取。
    """
    if not wp_list:
        return [], {}
    rows = (
        db.query(RSCDefine.work_package, RSCDefine.uom, RSCDefine.cn_wk_report)
        .filter(RSCDefine.work_package.in_(wp_list), RSCDefine.is_active == True)
        .order_by(RSCDefine.id)
        .all()
    )
    ordered = []
    seen = set()
    wp_info = {}
    for r in rows:
        wp = r[0]
        if wp and wp not in seen:
            seen.add(wp)
            ordered.append(wp)
        if wp:
            wp_info[wp] = {"uom": (r[1] and str(r[1]).strip()) or "单位", "cn": (r[2] and str(r[2]).strip()) or wp}
    for wp in wp_list:
        if wp not in seen:
            ordered.append(wp)
            wp_info.setdefault(wp, {"uom": "单位", "cn": wp})
    return ordered, wp_info


def _get_uom_for_work_packages(db: Session, wp_list: List[str]) -> str:
    """
    从 rsc_defines 取 work_package 对应 uom 的并集，返回单一字符串（如 "m/吨"）。
    用于整段汇总只需一个单位标签的场景；需按工作包逐项单位时用 _get_ordered_wp_info 的 wp_info[wp]['uom']。
    """
    rows = (
        db.query(RSCDefine.uom)
        .filter(RSCDefine.work_package.in_(wp_list), RSCDefine.is_active == True)
        .distinct()
        .all()
    )
    uoms = [r[0] for r in rows if r[0] and str(r[0]).strip()]
    if not uoms:
        return "单位"
    return "/".join(sorted(set(uoms)))


def _get_wp_uom_map(db: Session, wp_list: List[str]) -> Dict[str, str]:
    """返回 work_package -> uom 映射。基于 _get_ordered_wp_info，避免重复查 rsc_defines。"""
    _, wp_info = _get_ordered_wp_info(db, wp_list)
    return {wp: info.get("uom", "单位") for wp, info in wp_info.items()}


def execute_query_achieved(
    db: Session,
    date_range: str,
    work_type: str = "",
    scope: str = "",
    location: str = "",
    group_by: str = "",
) -> str:
    """
    统一查询实际完成量（VFACTDB）。date_range 支持单日（昨天、今天）或范围（本周、上周、2025-01-01至2026-02-12）。
    通过 group_by 控制返回形式：
    - group_by 空：返回总和
    - group_by=scope/分包商：按分包商分组
    - group_by=子项/子项目/装置等：按设施维度分组
    - group_by=专业/work_package/discipline：按工程量类型分组（专业=按化工专业归类展示）
    work_type 可选；不填且 group_by=专业/work_package 时返回全部类型分组。
    """
    gb = (group_by or "").strip().lower()
    # date 与 date_range 兼容；未指定时默认累计（全周期）
    dr = (date_range or "").strip() or "全周期"

    if gb in ("专业", "work_package", "discipline", "工作包"):
        return _execute_query_achieved_by_work_package(
            db, dr, scope, location, work_type, use_discipline_format=(gb == "专业")
        )
    if gb in ("scope", "分包商", "scope/分包商"):
        return execute_query_daily_achieved_by_scope(db, dr, work_type, location, scope)
    if gb in ("", "总和", "合计", "总计"):
        return execute_query_daily_achieved(db, dr, scope, work_type, location)
    # facilities: 子项目、子项、装置等
    return execute_query_daily_achieved_by_block(db, dr, scope, work_type, gb or "子项", location)


def _execute_query_achieved_by_work_package(
    db: Session,
    date_range: str,
    scope: str,
    location: str,
    work_type: str,
    use_discipline_format: bool = False,
) -> str:
    """按 work_package 分组查询实际完成量。use_discipline_format 为 True 时按专业归类展示。"""
    d_start, d_end = _parse_date_range(date_range)
    scope_list = _get_scopes(scope) if scope and scope.strip() else None
    loc = (location or "").strip()
    wp_filter = _get_work_packages(work_type) if work_type and work_type.strip() else None

    q = (
        db.query(VFACTDB.work_package, func.sum(VFACTDB.achieved).label("achieved"))
        .filter(VFACTDB.date >= d_start, VFACTDB.date <= d_end)
        .group_by(VFACTDB.work_package)
    )
    if scope_list is not None:
        q = q.filter(VFACTDB.scope.in_(scope_list))
    if loc:
        q = q.filter(_location_filter(VFACTDB, loc))
    if wp_filter:
        q = q.filter(VFACTDB.work_package.in_(wp_filter))
    rows = q.all()
    total_ach = sum(float(r[1] or 0) for r in rows)

    wp_set = [r[0] for r in rows if r[0]]
    _, wp_info = _get_ordered_wp_info(db, wp_set if wp_set else (wp_filter or []))

    scope_desc = "全项目" if scope_list is None else f"scope in {scope_list}"
    loc_desc = f"，位置={loc}（模糊匹配）" if loc else ""
    date_desc = f"{d_start}~{d_end}" if d_start != d_end else str(d_start)
    wp_desc = f"，工作包={work_type}（{wp_filter}）" if wp_filter else ""

    if use_discipline_format:
        by_disc: dict = {}
        for wp, achieved in rows:
            if not wp or len(wp) < 2:
                continue
            disc_code = wp[:2].upper()
            cn_name = DISCIPLINE_MAPPING.get(disc_code, (disc_code, []))[0]
            key = (disc_code, cn_name)
            if key not in by_disc:
                by_disc[key] = []
            info = wp_info.get(wp, {"uom": "单位", "cn": wp})
            label = _get_wp_display_cn(wp, info.get("cn"))
            by_disc[key].append((label, info["uom"], float(achieved or 0)))
        lines = []
        for (code, cn_name), items in sorted(by_disc.items(), key=lambda x: x[0][0]):
            parts = [f"{label}: {v}{uom}" for label, uom, v in items]
            lines.append(f"{cn_name}({code}): {'；'.join(parts)}")
        detail = "\n".join(lines) if lines else "（无数据）"
        msg = (
            f"按专业分组：日期={date_desc}，{scope_desc}{loc_desc}{wp_desc}。\n"
            f"专业与工作包对应：CI=土建、AR=建筑物、CS=钢结构、ME=设备、PI=管道、EL=电气、IN=仪表 等。\n"
            f"{detail}"
        )
        if scope_list is not None and total_ach == 0:
            msg += " 可尝试：1) 确认查询的日期范围是否为意图区间（如问「某月完成量」应传该月整月，如 2026年2月）；2) 确认 VFACTDB 中是否有该 scope 的日报数据（分包商是否已填报日报或系统是否已同步）。"
        return msg

    items = []
    for wp, achieved in rows:
        info = wp_info.get(wp, {"uom": "单位", "cn": wp or "(空)"})
        uom = info["uom"] or "单位"
        label = _get_wp_display_cn(wp, info.get("cn"))
        items.append(f"{label}: {float(achieved or 0)}{uom}")
    detail = "；".join(items) if items else "（无数据）"
    msg = (
        f"查询结果：日期={date_desc}，{scope_desc}{loc_desc}。"
        f"按工程量类型分组（不同单位不可相加）：{detail}。"
    )
    if scope_list is not None and total_ach == 0:
        msg += " 可尝试：1) 确认查询的日期范围是否为意图区间（如问「某月完成量」应传该月整月，如 2026年2月）；2) 确认 VFACTDB 中是否有该 scope 的日报数据（分包商是否已填报日报或系统是否已同步）。"
    return msg


def execute_query_daily_achieved(
    db: Session, date: str, scope: str, work_type: str, location: str = ""
) -> str:
    """执行完成量查询（实际完成，来自 VFACTDB）。支持单日或本周。scope/location 为空时查全项目/全场。location 支持模糊匹配。
    不同计量单位（DIN、M²、M³ 等）不得相加，按工作包分项返回。"""
    d_start, d_end = _parse_date_range(date)
    wp_list = _get_work_packages(work_type)
    if not wp_list:
        return f"未知工程量类型「{work_type}」。常用类型：钢结构、混凝土、地坪、焊接、给排水、电气桥架、电气电缆、仪表桥架、仪表电缆 等。可参考 rsc_defines.cn_wk_report 调整 WORK_TYPE_MAPPING。"

    scope_list = _get_scopes(scope)
    loc = (location or "").strip()
    q = (
        db.query(VFACTDB.work_package, func.sum(VFACTDB.achieved).label("achieved"))
        .filter(
            VFACTDB.date >= d_start,
            VFACTDB.date <= d_end,
            VFACTDB.work_package.in_(wp_list),
        )
        .group_by(VFACTDB.work_package)
    )
    if scope_list is not None:
        q = q.filter(VFACTDB.scope.in_(scope_list))
    if loc:
        q = q.filter(_location_filter(VFACTDB, loc))
    rows = q.all()
    _, wp_info = _get_ordered_wp_info(db, [r[0] for r in rows if r[0]] or wp_list)
    items = []
    for wp, achieved in rows:
        if not wp:
            continue
        info = wp_info.get(wp, {"uom": "单位", "cn": wp})
        uom = info.get("uom") or "单位"
        label = _get_wp_display_cn(wp, info.get("cn"))
        items.append(f"{label}: {float(achieved or 0)}{uom}")
    detail = "；".join(items) if items else "（无数据）"

    scope_desc = "全项目" if scope_list is None else f"scope in {scope_list}"
    loc_desc = f"，位置={loc}（模糊匹配 subproject/unit/block/main_block 等）" if loc else ""
    date_desc = f"{d_start}~{d_end}" if d_start != d_end else str(d_start)
    msg = (
        f"查询结果：日期={date_desc}，{scope_desc}{loc_desc}，工程量类型={work_type}（work_package in {wp_list}）。"
        f"按工作包分项（不同单位不可相加）：{detail}。"
    )
    total_count = sum(float(r[1] or 0) for r in rows)
    if scope_list is not None and total_count == 0:
        msg += " 可尝试：1) 确认查询的日期范围是否为意图区间（如问「某月完成量」应传该月整月，如 2026年2月）；2) 确认 VFACTDB 中是否有该 scope 的日报数据（分包商是否已填报日报或系统是否已同步）；3) 确认 location 是否为主项（main_block 如 12401）或子项（block）。"
    return msg


def execute_query_daily_achieved_by_block(
    db: Session, date: str, scope: str, work_type: str, group_by: str = "子项", location: str = ""
) -> str:
    """按设施维度拆分某日/某周某工程量类型的完成量。group_by 支持：子项目、子项、装置、开车阶段、主项、区块。scope、location 可选。"""
    d_start, d_end = _parse_date_range(date)
    wp_list = _get_work_packages(work_type)
    if not wp_list:
        return f"未知工程量类型「{work_type}」。常用类型：钢结构、混凝土、地坪、焊接、给排水 等。"

    resolved = _resolve_group_by(group_by)
    if not resolved:
        col_name, col_cn = "block", "子项"
    else:
        col_name, col_cn = resolved

    vf_col = getattr(VFACTDB, col_name, None)
    if vf_col is None:
        return f"不支持的分组字段：{col_name}。"

    scope_list = _get_scopes(scope)
    loc = (location or "").strip()
    q = (
        db.query(vf_col.label("dim_val"), func.sum(VFACTDB.achieved).label("achieved"))
        .filter(
            VFACTDB.date >= d_start,
            VFACTDB.date <= d_end,
            VFACTDB.work_package.in_(wp_list),
        )
        .group_by(vf_col)
    )
    if scope_list is not None:
        q = q.filter(VFACTDB.scope.in_(scope_list))
    if loc:
        q = q.filter(_location_filter(VFACTDB, loc))
    rows = q.all()

    uom = _get_uom_for_work_packages(db, wp_list)
    items = [f"{r[0] or '(空)'}: {float(r[1] or 0)}{uom}" for r in rows]
    total = sum(float(r[1] or 0) for r in rows)
    scope_desc = "全项目" if scope_list is None else f"scope in {scope_list}"
    loc_desc = f"，位置={loc}（模糊匹配）" if loc else ""
    date_desc = f"{d_start}~{d_end}" if d_start != d_end else str(d_start)
    detail = "；".join(items) if items else "（无数据）"
    return (
        f"按{col_cn}拆分：日期={date_desc}，{scope_desc}{loc_desc}，工程量类型={work_type}（work_package in {wp_list}）。"
        f"各{col_cn}完成量：{detail}。合计={total}{uom}。"
    )


def execute_query_daily_achieved_by_scope(
    db: Session, date: str, work_type: str, location: str = "", scope: str = ""
) -> str:
    """按分包商(scope)拆分某日/某周某工程量类型的完成量。scope、location 可选。"""
    d_start, d_end = _parse_date_range(date)
    wp_list = _get_work_packages(work_type)
    if not wp_list:
        return f"未知工程量类型「{work_type}」。常用类型：钢结构、混凝土、地坪、焊接、给排水 等。"

    scope_list = _get_scopes(scope)
    loc = (location or "").strip()
    q = (
        db.query(VFACTDB.scope.label("dim_val"), func.sum(VFACTDB.achieved).label("achieved"))
        .filter(
            VFACTDB.date >= d_start,
            VFACTDB.date <= d_end,
            VFACTDB.work_package.in_(wp_list),
        )
        .group_by(VFACTDB.scope)
    )
    if scope_list is not None:
        q = q.filter(VFACTDB.scope.in_(scope_list))
    if loc:
        q = q.filter(_location_filter(VFACTDB, loc))
    rows = q.all()

    uom = _get_uom_for_work_packages(db, wp_list)
    items = [f"{r[0] or '(空)'}: {float(r[1] or 0)}{uom}" for r in rows]
    total = sum(float(r[1] or 0) for r in rows)
    scope_desc = "全项目" if scope_list is None else f"scope in {scope_list}"
    loc_desc = f"，位置={loc}（模糊匹配）" if loc else ""
    date_desc = f"{d_start}~{d_end}" if d_start != d_end else str(d_start)
    detail = "；".join(items) if items else "（无数据）"
    msg = (
        f"按分包商拆分：日期={date_desc}，{scope_desc}{loc_desc}，工程量类型={work_type}（work_package in {wp_list}）。"
        f"各分包商完成量：{detail}。合计={total}{uom}。"
    )
    if scope_list is not None and total == 0:
        msg += " 可尝试：1) 确认查询的日期范围是否为意图区间（如问「某月完成量」应传该月整月，如 2026年2月）；2) 确认 VFACTDB 中是否有该 scope 的日报数据（分包商是否已填报日报或系统是否已同步）。"
    return msg


# MPDB/VFACTDB/ActivitySummary 中用于按位置过滤的字段
_LOCATION_COLS = ("subproject", "train", "unit", "block", "quarter", "main_block")
_LOCATION_COLS_WITH_SIMPLE = _LOCATION_COLS + ("simple_block",)  # ActivitySummary 另有 simple_block


def _escape_like_pattern(s: str) -> str:
    """转义 LIKE 中的 % 和 _，避免被当作通配符"""
    if not s:
        return s
    return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _location_filter(table_ref, loc: str, cols: Tuple[str, ...] = _LOCATION_COLS):
    """
    构建位置过滤条件，支持精确匹配和模糊匹配。
    用户输入 "12510-01" 可匹配数据库中 "0000-12510-01" 等。
    用户输入 "12401" 可匹配 main_block=12401、block 含 12401 等。
    """
    if not loc or not str(loc).strip():
        return True
    loc = str(loc).strip()
    esc = _escape_like_pattern(loc)
    clauses = []
    for c in cols:
        col = getattr(table_ref, c, None)
        if col is not None:
            clauses.append(or_(col == loc, col.like(f"%{esc}%", escape="\\")))
    return or_(*clauses) if clauses else True


def _volume_control_scope_diagnostic(
    db: Session,
    scope_list: Optional[List[str]],
    wp_list: List[str],
    loc: str,
    train_list: Optional[List[str]],
) -> str:
    """
    当指定 scope 且工程量汇总全为 0 时，基于 activity_summary 给出诊断建议（与必读指南一致：以数据表为准，不编造原因）。
    """
    if not scope_list or not wp_list:
        return ""
    q = db.query(func.count(ActivitySummary.activity_id)).filter(
        ActivitySummary.scope.in_(scope_list),
        ActivitySummary.work_package.in_(wp_list),
    )
    if loc:
        q = q.filter(_location_filter(ActivitySummary, loc, _LOCATION_COLS_WITH_SIMPLE))
    if train_list is not None:
        q = q.filter(ActivitySummary.train.in_(train_list))
    n = q.scalar() or 0
    scope_str = ",".join(scope_list)
    if n == 0:
        return (
            f" 诊断：activity_summary 中无 scope in ({scope_str}) 且符合该工程量类型的作业；"
            "请确认 P6/作业汇总 中是否已为该分包商分配 scope。"
        )
    return (
        f" 诊断：activity_summary 中有 {n} 条符合条件的作业，"
        "但工程量清单（施工工程量/验收/竣工资料/收款）中暂无数据；请在工程量管理中录入。"
    )


def execute_query_manpower(
    db: Session,
    date: str,
    scope: str = "",
    location: str = "",
    manpower_type: str = "direct",
    work_type: str = "",
    group_by: str = "",
) -> str:
    """
    查询人力投入。数据来源 MPDB。支持多维度筛选与分组，与工程量工具维度一致。
    date: 单日或日期范围。work_type: 可选，按工作包过滤（PI01、地下管、钢结构等）。
    scope、location: 可选。group_by: 可选，分组维度——专业/discipline、分包商/scope、
    子项/block、子项目/subproject、装置/unit 等（不传则返回总和）。
    """
    d_start, d_end = _parse_date_range(date)
    mp_lower = manpower_type.lower().strip()
    if mp_lower in ("direct", "直接"):
        mp_filter = func.lower(MPDB.typeof_mp).like("%direct%")
        mp_desc = "直接人力"
    elif mp_lower in ("indirect", "间接"):
        mp_filter = func.lower(MPDB.typeof_mp).like("%indirect%")
        mp_desc = "间接人力"
    else:
        mp_filter = True
        mp_desc = "全部人力"

    wp_filter = _get_work_packages(work_type) if work_type and work_type.strip() else None
    scope_list = _get_scopes(scope) if scope and scope.strip() else None
    loc = (location or "").strip()
    scope_desc = "全项目" if scope_list is None else f"scope in {scope_list}"
    loc_desc = f"位置={loc}（模糊匹配）" if loc else "全场"
    date_desc = f"{d_start}~{d_end}" if d_start != d_end else str(d_start)
    wp_desc = f"，工作包={work_type.strip()}（{wp_filter}）" if wp_filter else ""

    grp = (group_by or "").strip().lower()
    is_discipline = grp in ("专业", "discipline")
    is_scope = grp in ("分包商", "scope")

    # 设施维度：子项目、子项、装置等
    resolved = _resolve_group_by(group_by) if group_by and not is_discipline and not is_scope else None
    is_facility = resolved is not None

    base_filter = [
        MPDB.date >= d_start,
        MPDB.date <= d_end,
    ]
    if mp_filter is not True:
        base_filter.append(mp_filter)
    if wp_filter:
        base_filter.append(MPDB.work_package.in_(wp_filter))
    if scope_list is not None:
        base_filter.append(MPDB.scope.in_(scope_list))
    if loc:
        base_filter.append(_location_filter(MPDB, loc))

    if is_discipline:
        disc_expr = func.coalesce(
            func.upper(func.substr(MPDB.work_package, 1, 2)),
            func.coalesce(MPDB.discipline, "XX"),
        ).label("disc")
        q = (
            db.query(disc_expr, func.sum(MPDB.manpower).label("manpower"))
            .filter(*base_filter)
            .group_by(disc_expr)
        )
        rows = q.all()
        lines = []
        for code, mp in rows:
            c = (code or "").strip().upper() or "XX"
            cn_name = DISCIPLINE_MAPPING.get(c, (c, []))[0] if c in DISCIPLINE_MAPPING else ("其他" if c == "XX" else c)
            lines.append(f"{cn_name}({c}): {float(mp or 0):.1f} 工日")
        total = sum(float(r[1] or 0) for r in rows)
        detail = "；".join(lines) if lines else "（无数据）"
        return (
            f"按专业分组人力：日期={date_desc}，{scope_desc}，{loc_desc}，{mp_desc}{wp_desc}。"
            f"各专业：{detail}。合计={total:.1f} 工日。"
        )

    if is_scope:
        q = (
            db.query(MPDB.scope.label("dim_val"), func.sum(MPDB.manpower).label("manpower"))
            .filter(*base_filter)
            .group_by(MPDB.scope)
        )
        rows = q.all()
        lines = [f"{r[0] or '(空)'}: {float(r[1] or 0):.1f} 工日" for r in rows]
        total = sum(float(r[1] or 0) for r in rows)
        detail = "；".join(lines) if lines else "（无数据）"
        return (
            f"按分包商分组人力：日期={date_desc}，{scope_desc}，{loc_desc}，{mp_desc}{wp_desc}。"
            f"各分包商：{detail}。合计={total:.1f} 工日。"
        )

    if is_facility:
        col_name, col_cn = resolved
        col = getattr(MPDB, col_name, None)
        if col is not None:
            q = (
                db.query(col.label("dim_val"), func.sum(MPDB.manpower).label("manpower"))
                .filter(*base_filter)
                .group_by(col)
            )
            rows = q.all()
            lines = [f"{r[0] or '(空)'}: {float(r[1] or 0):.1f} 工日" for r in rows]
            total = sum(float(r[1] or 0) for r in rows)
            detail = "；".join(lines) if lines else "（无数据）"
            return (
                f"按{col_cn}分组人力：日期={date_desc}，{scope_desc}，{loc_desc}，{mp_desc}{wp_desc}。"
                f"各{col_cn}：{detail}。合计={total:.1f} 工日。"
            )

    # 汇总（无分组）
    q = db.query(func.sum(MPDB.manpower)).filter(*base_filter)
    result = q.scalar()
    total = float(result or 0)
    return f"查询结果：日期={date_desc}，{scope_desc}，{loc_desc}，{mp_desc}{wp_desc}。MPDB manpower 总和={total}。"


def execute_query_volume_control_summary(
    db: Session, location: str, work_type: str, scope: str = "", breakdown: bool = True, group_by: str = "", phase: str = ""
) -> str:
    """
    查询某位置某工程量类型的 volume_control 汇总。
    scope（分包商）、location（设施位置）、phase（期别）可选。location 支持模糊匹配。
    phase：一期= train T0/T1，二期= train T2。
    group_by：分组维度。子项目/subproject、主项、装置、子项、开车阶段、区块；或 工作包/work_package 按各工作包分解（与 activity_summary.work_package 一致）。
    work_type：不传或传「全部」且指定 scope 时，按该分包商在 activity_summary 中的各 work_package 汇总；传「全部」且未指定 scope 时按 rsc_defines 全部类型。
    """
    loc = (location or "").strip()
    scope_list = _get_scopes(scope) if scope and scope.strip() else None
    train_list = _resolve_phase(phase)

    wt = (work_type or "").strip()
    if wt.lower() in ("", "全部", "各工作包", "各类型"):
        if scope_list:
            wp_list = _get_work_packages_for_scope(db, scope_list, loc, train_list)
            if not wp_list:
                return f"该分包商（scope in {scope_list}）下无作业或无不符位置/期别筛选的作业，无法汇总工程量。"
        else:
            wp_list = _get_all_active_work_packages(db)
            if not wp_list:
                return "系统中无有效工作包定义（rsc_defines），无法汇总。"
        # 未指定单一类型时，默认按工作包分解，便于「某分包商工程量总量情况」一次返回各工作包
        if not (group_by and group_by.strip()):
            group_by = "工作包"
        work_type = work_type or "全部"
    else:
        wp_list = _get_work_packages(work_type)
        if not wp_list:
            return f"未知工程量类型「{work_type}」。常用：钢结构、混凝土、焊接、给排水、电仪 等。"

    # group_by 支持 工作包/work_package（activity_summary.work_package），与 facilities 维度一致在参数层面一次支持
    resolved_group = None
    if group_by and group_by.strip():
        gb_key = group_by.strip()
        if gb_key in ("工作包", "work_package"):
            resolved_group = ("work_package", "工作包")
        else:
            resolved_group = _resolve_group_by(group_by)

    def _base_filter(q, as_ref):
        q = q.filter(as_ref.work_package.in_(wp_list))
        if scope_list is not None:
            q = q.filter(as_ref.scope.in_(scope_list))
        if loc:
            q = q.filter(_location_filter(as_ref, loc, _LOCATION_COLS_WITH_SIMPLE))
        if train_list is not None:
            q = q.filter(as_ref.train.in_(train_list))
        return q

    # 宽泛类别（多个 work_package）时按工作项分解，穷举给用户；有 group_by 时按分组维度优先
    do_breakdown = breakdown and len(wp_list) > 1 and not resolved_group

    # 按 group_by 分组（如 子项目/subproject -> ECU/PEL/UIO 分解）
    if resolved_group:
        col_name, col_cn = resolved_group
        group_col = getattr(ActivitySummary, col_name, None)
        if group_col is None:
            return f"未知分组维度「{group_by}」。支持：主项、main_block、子项目、subproject、子项、block、装置、unit、开车阶段、train、区块、quarter、工作包、work_package。"

        def _loc_q(base_q, tbl_join_col, as_ref=ActivitySummary):
            q = base_q.join(as_ref, tbl_join_col == as_ref.activity_id).filter(as_ref.work_package.in_(wp_list))
            if scope_list is not None:
                q = q.filter(as_ref.scope.in_(scope_list))
            if loc:
                q = q.filter(_location_filter(as_ref, loc, _LOCATION_COLS_WITH_SIMPLE))
            if train_list is not None:
                q = q.filter(as_ref.train.in_(train_list))
            return q

        # 按工作包分组时：仅按 work_package 分组；按主项/子项目等设施分组时：按 (设施维度, work_package) 分组，避免不同单位加总
        is_work_package_group = col_name == "work_package"
        if is_work_package_group:
            vcq_q = db.query(
                group_col.label("grp"),
                func.sum(VolumeControlQuantity.estimated_total).label("et"),
                func.sum(VolumeControlQuantity.material_arrived).label("ma"),
                func.sum(VolumeControlQuantity.available_workface).label("aw"),
                func.sum(VolumeControlQuantity.construction_completed).label("cc"),
            )
            vcq_q = _loc_q(vcq_q, VolumeControlQuantity.activity_id).group_by(group_col)
            vcq_rows = {r[0] or "(空)": (float(r[1] or 0), float(r[2] or 0), float(r[3] or 0), float(r[4] or 0)) for r in vcq_q.all()}

            vci_q = db.query(
                group_col.label("grp"),
                (func.coalesce(func.sum(VolumeControlInspection.rfi_completed_a), 0) + func.coalesce(func.sum(VolumeControlInspection.rfi_completed_b), 0) + func.coalesce(func.sum(VolumeControlInspection.rfi_completed_c), 0)).label("rfi"),
            )
            vci_q = _loc_q(vci_q, VolumeControlInspection.activity_id).group_by(group_col)
            vci_rows = {r[0] or "(空)": float(r[1] or 0) for r in vci_q.all()}

            vca_q = db.query(
                group_col.label("grp"),
                (func.coalesce(func.sum(VolumeControlAsbuilt.asbuilt_signed_r0), 0) + func.coalesce(func.sum(VolumeControlAsbuilt.asbuilt_signed_r1), 0)).label("abd"),
            )
            vca_q = _loc_q(vca_q, VolumeControlAsbuilt.activity_id).group_by(group_col)
            vca_rows = {r[0] or "(空)": float(r[1] or 0) for r in vca_q.all()}

            vcp_q = db.query(group_col.label("grp"), func.sum(VolumeControlPayment.obp_signed).label("obp"))
            vcp_q = _loc_q(vcp_q, VolumeControlPayment.activity_id).group_by(group_col)
            vcp_rows = {r[0] or "(空)": float(r[1] or 0) for r in vcp_q.all()}

            ordered_wp_list, wp_info = _get_ordered_wp_info(db, wp_list)
            all_grps = ordered_wp_list
        else:
            # 设施维度（主项/子项目/装置/子项/开车阶段/区块）：按 (设施, work_package) 分组，每行带该工作包单位，禁止跨单位合计
            vcq_q = db.query(
                group_col.label("grp"),
                ActivitySummary.work_package.label("wp"),
                func.sum(VolumeControlQuantity.estimated_total).label("et"),
                func.sum(VolumeControlQuantity.material_arrived).label("ma"),
                func.sum(VolumeControlQuantity.available_workface).label("aw"),
                func.sum(VolumeControlQuantity.construction_completed).label("cc"),
            )
            vcq_q = _loc_q(vcq_q, VolumeControlQuantity.activity_id).group_by(group_col, ActivitySummary.work_package)
            vcq_rows = {(r[0] or "(空)", r[1] or ""): (float(r[2] or 0), float(r[3] or 0), float(r[4] or 0), float(r[5] or 0)) for r in vcq_q.all()}

            vci_q = db.query(
                group_col.label("grp"),
                ActivitySummary.work_package.label("wp"),
                (func.coalesce(func.sum(VolumeControlInspection.rfi_completed_a), 0) + func.coalesce(func.sum(VolumeControlInspection.rfi_completed_b), 0) + func.coalesce(func.sum(VolumeControlInspection.rfi_completed_c), 0)).label("rfi"),
            )
            vci_q = _loc_q(vci_q, VolumeControlInspection.activity_id).group_by(group_col, ActivitySummary.work_package)
            vci_rows = {(r[0] or "(空)", r[1] or ""): float(r[2] or 0) for r in vci_q.all()}

            vca_q = db.query(
                group_col.label("grp"),
                ActivitySummary.work_package.label("wp"),
                (func.coalesce(func.sum(VolumeControlAsbuilt.asbuilt_signed_r0), 0) + func.coalesce(func.sum(VolumeControlAsbuilt.asbuilt_signed_r1), 0)).label("abd"),
            )
            vca_q = _loc_q(vca_q, VolumeControlAsbuilt.activity_id).group_by(group_col, ActivitySummary.work_package)
            vca_rows = {(r[0] or "(空)", r[1] or ""): float(r[2] or 0) for r in vca_q.all()}

            vcp_q = db.query(group_col.label("grp"), ActivitySummary.work_package.label("wp"), func.sum(VolumeControlPayment.obp_signed).label("obp"))
            vcp_q = _loc_q(vcp_q, VolumeControlPayment.activity_id).group_by(group_col, ActivitySummary.work_package)
            vcp_rows = {(r[0] or "(空)", r[1] or ""): float(r[2] or 0) for r in vcp_q.all()}

            ordered_wp_list, wp_info = _get_ordered_wp_info(db, wp_list)
            all_grp_wp = sorted(set(vcq_rows.keys()) | set(vci_rows.keys()) | set(vca_rows.keys()) | set(vcp_rows.keys()))

        lines = []
        if is_work_package_group:
            sum_et, sum_ma, sum_aw, sum_cc = 0.0, 0.0, 0.0, 0.0
            sum_rfi, sum_abd, sum_obp = 0.0, 0.0, 0.0
            for grp in all_grps:
                vcq = vcq_rows.get(grp, (0, 0, 0, 0))
                et, ma, aw, cc = vcq[0], vcq[1], vcq[2], vcq[3]
                rfi = vci_rows.get(grp, 0)
                abd = vca_rows.get(grp, 0)
                obp = vcp_rows.get(grp, 0)
                info = wp_info.get(grp, {"uom": "单位", "cn": grp})
                uom_grp = info.get("uom", "单位")
                display_cn = _get_wp_display_cn(grp, info.get("cn"))
                lines.append(f"{display_cn}({grp})：总量={et}{uom_grp}，到货={ma}{uom_grp}，工作面={aw}{uom_grp}，施工完成={cc}{uom_grp}，验收={rfi}{uom_grp}，竣工资料={abd}{uom_grp}，收款={obp}{uom_grp}")
                sum_et += et
                sum_ma += ma
                sum_aw += aw
                sum_cc += cc
                sum_rfi += rfi
                sum_abd += abd
                sum_obp += obp
            total_line = f" 合计：总量={sum_et}，到货={sum_ma}，工作面={sum_aw}，施工完成={sum_cc}，验收={sum_rfi}，竣工资料={sum_abd}，收款={sum_obp}。（各工作包单位可能不同，合计仅作参考）。" if lines else ""
        else:
            # 设施×工作包：每行带该工作包单位，不输出跨工作包合计
            for (grp, wp) in all_grp_wp:
                vcq = vcq_rows.get((grp, wp), (0, 0, 0, 0))
                et, ma, aw, cc = vcq[0], vcq[1], vcq[2], vcq[3]
                rfi = vci_rows.get((grp, wp), 0)
                abd = vca_rows.get((grp, wp), 0)
                obp = vcp_rows.get((grp, wp), 0)
                if et or ma or aw or cc or rfi or abd or obp:
                    info = wp_info.get(wp, {"uom": "单位", "cn": wp})
                    uom_grp = info.get("uom", "单位")
                    display_cn = _get_wp_display_cn(wp, info.get("cn"))
                    lines.append(f"{grp} - {display_cn}({wp})：总量={et}{uom_grp}，到货={ma}{uom_grp}，工作面={aw}{uom_grp}，施工完成={cc}{uom_grp}，验收={rfi}{uom_grp}，竣工资料={abd}{uom_grp}，收款={obp}{uom_grp}")
            total_line = " 以上按{0}×工作包分项，单位不同不可跨工作包合计。".format(col_cn) if lines else ""

        scope_desc = f"scope in {scope_list}，" if scope_list is not None else ""
        loc_desc = f"位置={loc}" if loc else "全项目"
        phase_desc = f"期别={phase}（train {'/'.join(train_list)}），" if train_list else ""
        detail = "；".join(lines) if lines else "（无数据）"
        hint = ""
        if not is_work_package_group and lines:
            grp_keys = {g for g, _ in all_grp_wp}
            if "(空)" in grp_keys:
                hint = " 注：部分作业的{0}未分配，归入「(空)」。若希望ECU/PEL/UIO有数据，需在P6中为作业分配GCC_Sub-project，或确保block在facilities表中有对应subproject。".format(col_cn)
        return f"查询结果（按{col_cn}分组）：{scope_desc}{phase_desc}{loc_desc}，工程量类型={work_type}。{detail}。{total_line}{hint}"

    if do_breakdown:
        ordered_wp_breakdown, wp_info = _get_ordered_wp_info(db, wp_list)

        def _loc_q(base_q, tbl_join_col, as_ref=ActivitySummary):
            q = base_q.join(as_ref, tbl_join_col == as_ref.activity_id).filter(as_ref.work_package.in_(wp_list))
            if scope_list is not None:
                q = q.filter(as_ref.scope.in_(scope_list))
            if loc:
                q = q.filter(_location_filter(as_ref, loc, _LOCATION_COLS_WITH_SIMPLE))
            if train_list is not None:
                q = q.filter(as_ref.train.in_(train_list))
            return q

        vcq_q = db.query(ActivitySummary.work_package, func.sum(VolumeControlQuantity.estimated_total).label("et"), func.sum(VolumeControlQuantity.material_arrived).label("ma"),
                         func.sum(VolumeControlQuantity.available_workface).label("aw"), func.sum(VolumeControlQuantity.construction_completed).label("cc"))
        vcq_q = _loc_q(vcq_q, VolumeControlQuantity.activity_id).group_by(ActivitySummary.work_package)
        vcq_rows = {r[0]: (float(r[1] or 0), float(r[2] or 0), float(r[3] or 0), float(r[4] or 0)) for r in vcq_q.all()}

        vci_q = db.query(ActivitySummary.work_package, (func.coalesce(func.sum(VolumeControlInspection.rfi_completed_a), 0) + func.coalesce(func.sum(VolumeControlInspection.rfi_completed_b), 0) + func.coalesce(func.sum(VolumeControlInspection.rfi_completed_c), 0)).label("rfi"))
        vci_q = _loc_q(vci_q, VolumeControlInspection.activity_id).group_by(ActivitySummary.work_package)
        vci_rows = {r[0]: float(r[1] or 0) for r in vci_q.all()}

        vca_q = db.query(ActivitySummary.work_package, (func.coalesce(func.sum(VolumeControlAsbuilt.asbuilt_signed_r0), 0) + func.coalesce(func.sum(VolumeControlAsbuilt.asbuilt_signed_r1), 0)).label("abd"))
        vca_q = _loc_q(vca_q, VolumeControlAsbuilt.activity_id).group_by(ActivitySummary.work_package)
        vca_rows = {r[0]: float(r[1] or 0) for r in vca_q.all()}

        vcp_q = db.query(ActivitySummary.work_package, func.sum(VolumeControlPayment.obp_signed).label("obp"))
        vcp_q = _loc_q(vcp_q, VolumeControlPayment.activity_id).group_by(ActivitySummary.work_package)
        vcp_rows = {r[0]: float(r[1] or 0) for r in vcp_q.all()}

        lines = []
        for wp in ordered_wp_breakdown:
            info = wp_info.get(wp, {"uom": "单位", "cn": wp})
            uom = info.get("uom", "单位")
            cn = _get_wp_display_cn(wp, info.get("cn"))
            vcq = vcq_rows.get(wp, (0, 0, 0, 0))
            et, ma, aw, cc = vcq[0], vcq[1], vcq[2], vcq[3]
            rfi = vci_rows.get(wp, 0)
            abd = vca_rows.get(wp, 0)
            obp = vcp_rows.get(wp, 0)
            if et or ma or cc or rfi or abd or obp:
                lines.append(f"{cn}({wp}): 总量={et}{uom}，到货={ma}{uom}，工作面={aw}{uom}，施工完成={cc}{uom}，验收={rfi}{uom}，竣工资料={abd}{uom}，收款={obp}{uom}")
        scope_desc = f"scope in {scope_list}，" if scope_list is not None else ""
        loc_desc = f"位置={loc}" if loc else "全项目"
        phase_desc = f"期别={phase}（train {'/'.join(train_list)}），" if train_list else ""
        detail = "；".join(lines) if lines else "（无数据）"
        return f"查询结果：{scope_desc}{phase_desc}{loc_desc}，工程量类型={work_type}（按工作项分解）。{detail}。"
    else:
        # 优化：合并分散的查询，将 10 次查询合并为 4 次，提升性能
        def _get_vcq_sums():
            res = db.query(
                func.sum(VolumeControlQuantity.estimated_total),
                func.sum(VolumeControlQuantity.material_arrived),
                func.sum(VolumeControlQuantity.available_workface),
                func.sum(VolumeControlQuantity.construction_completed)
            ).join(ActivitySummary, VolumeControlQuantity.activity_id == ActivitySummary.activity_id)
            row = _base_filter(res, ActivitySummary).first()
            return [float(x or 0) for x in row] if row else [0.0, 0.0, 0.0, 0.0]

        def _get_vci_sums():
            res = db.query(
                func.sum(VolumeControlInspection.rfi_completed_a),
                func.sum(VolumeControlInspection.rfi_completed_b),
                func.sum(VolumeControlInspection.rfi_completed_c)
            ).join(ActivitySummary, VolumeControlInspection.activity_id == ActivitySummary.activity_id)
            row = _base_filter(res, ActivitySummary).first()
            return [float(x or 0) for x in row] if row else [0.0, 0.0, 0.0]

        def _get_vca_sums():
            res = db.query(
                func.sum(VolumeControlAsbuilt.asbuilt_signed_r0),
                func.sum(VolumeControlAsbuilt.asbuilt_signed_r1)
            ).join(ActivitySummary, VolumeControlAsbuilt.activity_id == ActivitySummary.activity_id)
            row = _base_filter(res, ActivitySummary).first()
            return [float(x or 0) for x in row] if row else [0.0, 0.0]

        def _get_vcp_sums():
            res = db.query(func.sum(VolumeControlPayment.obp_signed)).join(
                ActivitySummary, VolumeControlPayment.activity_id == ActivitySummary.activity_id
            )
            val = _base_filter(res, ActivitySummary).scalar()
            return float(val or 0)

        vcq_data = _get_vcq_sums()
        estimated_total, material_arrived, available_workface, construction_completed = vcq_data
        
        vci_data = _get_vci_sums()
        rfi_a, rfi_b, rfi_c = vci_data
        inspection_total = rfi_a + rfi_b + rfi_c
        
        vca_data = _get_vca_sums()
        asbuilt_r0, asbuilt_r1 = vca_data
        asbuilt_total = asbuilt_r0 + asbuilt_r1
        
        obp_signed = _get_vcp_sums()

        uom = _get_uom_for_work_packages(db, wp_list)

        scope_desc = f"scope in {scope_list}，" if scope_list is not None else ""
        loc_desc = f"位置={loc}" if loc else "全项目"
        phase_desc = f"期别={phase}（train {'/'.join(train_list)}），" if train_list else ""
        msg = (
            f"查询结果：{scope_desc}{phase_desc}{loc_desc}，工程量类型={work_type}（work_package in {wp_list}）。单位(uom)={uom}。"
            f"总量(estimated_total)={estimated_total}{uom}；到货(material_arrived)={material_arrived}{uom}；"
            f"工作面(available_workface)={available_workface}{uom}；施工完成(construction_completed)={construction_completed}{uom}；"
            f"验收(RFI A+B+C)={inspection_total}{uom}；竣工资料/ABD(R0+R1)={asbuilt_total}{uom}；OVR/收款(obp_signed)={obp_signed}{uom}。"
        )
        if (
            scope_list is not None
            and estimated_total == 0
            and material_arrived == 0
            and available_workface == 0
            and construction_completed == 0
            and inspection_total == 0
            and asbuilt_total == 0
            and obp_signed == 0
        ):
            msg += _volume_control_scope_diagnostic(db, scope_list, wp_list, loc, train_list)
        return msg


# 进度查询维度：用户说法 -> 筛选用值（与 activity_summary / dashboard_s_curve_cache 一致）
PROGRESS_IMPLEMENT_PHASE = {"E": "EN", "EN": "EN", "设计": "EN", "P": "PR", "PR": "PR", "采购": "PR", "C": "CT", "CT": "CT", "施工": "CT"}
PROGRESS_CONTRACT_PHASE = {
    "add.1": "Add.1", "Add.1": "Add.1", "add1": "Add.1",
    "add.2.1": "Add.2.1", "Add.2.1": "Add.2.1", "2.1": "Add.2.1", "add2.1": "Add.2.1",
    "add.2.2": "Add.2.2", "Add.2.2": "Add.2.2", "add2.2": "Add.2.2", "c": "Add.2.2",
    "add.3": "Add.3", "Add.3": "Add.3", "add3": "Add.3",
}
# 子项目/分包商/装置：用户常说名 -> 传入 filter 的值（多数与库一致，仅别名归一化）
PROGRESS_SUBPROJECT_ALIAS = {"ecu": "ECU", "pel": "PEL", "uio": "UIO", "ec1": "EC1", "ec2": "EC2"}
PROGRESS_SCOPE_ALIAS = {}  # C01..C09 等直接传

def _build_progress_filters(
    subproject: str = "",
    scope: str = "",
    unit: str = "",
    main_block: str = "",
    block: str = "",
    train: str = "",
    quarter: str = "",
    simple_block: str = "",
    implement_phase: str = "",
    contract_phase: str = "",
    dimension: str = "",
) -> Tuple[Dict[str, List[str]], str]:
    """
    从工具参数构建进度筛选项 filters（与 facilities / activity_summary / build_act_where_sql 维度一致）。
    dimension 兼容旧版：若为 E/P/C/设计/采购/施工，当作 implement_phase。
    """
    filters: Dict[str, List[str]] = {}
    parts: List[str] = []
    impl_labels = {"EN": "设计", "PR": "采购", "CT": "施工"}

    def add(dim: str, val: str, label: str) -> None:
        if not val or not str(val).strip():
            return
        v = str(val).strip()
        if dim == "implement_phase":
            v = PROGRESS_IMPLEMENT_PHASE.get(v) or PROGRESS_IMPLEMENT_PHASE.get(v.upper(), v)
            label = impl_labels.get(v, v)
        elif dim == "contract_phase":
            v = PROGRESS_CONTRACT_PHASE.get(v) or PROGRESS_CONTRACT_PHASE.get(v.replace(" ", ""), v)
        elif dim == "subproject":
            v = PROGRESS_SUBPROJECT_ALIAS.get(v.lower(), v)
        if v and dim not in filters:
            filters[dim] = [v]
            parts.append(label or v)

    impl_from_dim = ""
    if dimension and dimension.strip():
        k = dimension.strip()
        impl_from_dim = PROGRESS_IMPLEMENT_PHASE.get(k) or PROGRESS_IMPLEMENT_PHASE.get(k.upper()) or ""
    impl_val = impl_from_dim or (str(implement_phase).strip() if implement_phase else "")
    add("implement_phase", impl_val, impl_labels.get(impl_val, impl_val))
    add("contract_phase", contract_phase, contract_phase or "")
    add("subproject", subproject, subproject or "")
    add("scope", scope, scope or "")
    add("unit", unit, unit or "")
    add("main_block", main_block, main_block or "")
    add("block", block, block or "")
    add("train", train, train or "")
    add("quarter", quarter, quarter or "")
    add("simple_block", simple_block, simple_block or "")

    desc = "全项目" if not filters else "、".join(parts)
    return filters, desc


def _progress_cache_has_key(db: Session, filter_key: str) -> bool:
    """缓存表中是否存在该 filter_key（任意一条即可）。"""
    if not filter_key:
        return True
    row = db.execute(
        text("SELECT 1 FROM dashboard_s_curve_cache WHERE filter_key = :fk LIMIT 1"),
        {"fk": filter_key},
    ).fetchone()
    return row is not None


# breakdown_by 用户说法 -> activity_summary 列名（与 facilities/activity_summary 一致）
PROGRESS_BREAKDOWN_COL = {
    "discipline": "discipline", "专业": "discipline",
    "block": "block", "子项": "block",
    "unit": "unit", "装置": "unit",
    "main_block": "main_block", "主项": "main_block",
    "subproject": "subproject", "子项目": "subproject",
    "scope": "scope", "分包商": "scope",
    "train": "train", "开车阶段": "train",
    "quarter": "quarter", "区块": "quarter",
    "simple_block": "simple_block", "简化子项": "simple_block",
}
PROGRESS_BREAKDOWN_LABEL = {"discipline": "专业", "block": "子项", "unit": "装置", "main_block": "主项", "subproject": "子项目", "scope": "分包商", "train": "开车阶段", "quarter": "区块", "simple_block": "简化子项"}


def _resolve_breakdown_by(breakdown_by: str) -> Optional[str]:
    """用户说的 breakdown_by -> 列名。"""
    if not breakdown_by or not str(breakdown_by).strip():
        return None
    k = str(breakdown_by).strip().lower()
    return PROGRESS_BREAKDOWN_COL.get(k) or PROGRESS_BREAKDOWN_COL.get(breakdown_by.strip())


def _get_distinct_progress_dimension_values(db: Session, base_filters: Dict[str, List[str]], col: str) -> List[str]:
    """在 base_filters 条件下，取 activity_summary 中该维度的非空取值列表。"""
    act_where = build_act_where_sql(base_filters, base="contract")
    dc = f"`{col}`"  # 反引号避免保留字
    sql = text(
        f"SELECT DISTINCT {dc} FROM activity_summary WHERE {act_where} AND {dc} IS NOT NULL AND {dc} <> '' ORDER BY {dc}"
    )
    rows = db.execute(sql).fetchall()
    return [str(r[0]).strip() for r in rows if r and r[0]]


def _format_progress_one(plan: float, forecast: float, actual: float) -> str:
    return f"计划{round(plan, 2)}%、预测{round(forecast, 2)}%、实际{round(actual, 2)}%"


def execute_query_progress_summary(
    db: Session,
    as_of_date: str = "",
    dimension: str = "",
    subproject: str = "",
    scope: str = "",
    unit: str = "",
    main_block: str = "",
    block: str = "",
    train: str = "",
    quarter: str = "",
    simple_block: str = "",
    implement_phase: str = "",
    contract_phase: str = "",
    breakdown_by: str = "",
) -> str:
    """
    查询项目累计进度（WF%）。维度与 facilities/activity_summary/GlobalFilter 一致。
    单维度优先走 dashboard_s_curve_cache，组合条件走实时聚合。
    """
    filters, dim_desc = _build_progress_filters(
        subproject=subproject, scope=scope, unit=unit, main_block=main_block,
        block=block, train=train, quarter=quarter, simple_block=simple_block,
        implement_phase=implement_phase, contract_phase=contract_phase, dimension=dimension,
    )
    d_start, d_end = _parse_date_range(as_of_date) if as_of_date and as_of_date.strip() else (datetime.now().date(), datetime.now().date())
    as_of = d_end
    breakdown_col = _resolve_breakdown_by(breakdown_by)

    def _one_summary(f: Optional[Dict[str, List[str]]], desc: str) -> Optional[str]:
        use_cache = f and len(f) <= 1 and _progress_cache_has_key(db, build_filter_key(f) if f else "")
        if use_cache and f and len(f) <= 1:
            fk = build_filter_key(f)
            row = db.execute(
                text("SELECT date, cum_plan_wf, cum_forecast_wf, cum_actual_wf FROM dashboard_s_curve_cache WHERE filter_key = :fk AND date <= :d ORDER BY date DESC LIMIT 1"),
                {"fk": fk, "d": as_of},
            ).fetchone()
            if row:
                return _format_progress_one(float(row[1] or 0), float(row[2] or 0), float(row[3] or 0))
        svc = DashboardService(db)
        real = svc.get_progress_realtime(f if f else None, as_of)
        if not real:
            return None
        return _format_progress_one(float(real["cum_plan_wf"] or 0), float(real["cum_forecast_wf"] or 0), float(real["cum_actual_wf"] or 0))

    try:
        if not breakdown_col:
            use_cache = len(filters) <= 1 and _progress_cache_has_key(db, build_filter_key(filters) if filters else "")
            if use_cache and len(filters) <= 1:
                fk = build_filter_key(filters) if filters else ""
                row = db.execute(
                    text("SELECT date, cum_plan_wf, cum_forecast_wf, cum_actual_wf FROM dashboard_s_curve_cache WHERE filter_key = :fk AND date <= :d ORDER BY date DESC LIMIT 1"),
                    {"fk": fk, "d": as_of},
                ).fetchone()
                if row:
                    d, plan, forecast, actual = row[0], float(row[1] or 0), float(row[2] or 0), float(row[3] or 0)
                    return f"进度汇总（{dim_desc}，截止{d}）：计划进度={round(plan, 2)}%，预测进度={round(forecast, 2)}%，实际进度={round(actual, 2)}%，偏差(实际-预测)={round(actual - forecast, 2)}%。"
            svc = DashboardService(db)
            real = svc.get_progress_realtime(filters if filters else None, as_of)
            if not real:
                hint = "可尝试：仅查该分包商进度（不限定装置/主项），或仅查该装置/主项进度（不限定分包商）。"
                return f"进度无数据（{dim_desc}，截止{as_of}）。{hint}"
            plan, forecast, actual = float(real["cum_plan_wf"] or 0), float(real["cum_forecast_wf"] or 0), float(real["cum_actual_wf"] or 0)
            return f"进度汇总（{dim_desc}，截止{real['date']}）：计划进度={round(plan, 2)}%，预测进度={round(forecast, 2)}%，实际进度={round(actual, 2)}%，偏差(实际-预测)={round(actual - forecast, 2)}%。"

        values = _get_distinct_progress_dimension_values(db, filters, breakdown_col)
        if not values:
            return f"进度无数据（{dim_desc}，截止{as_of}）；且无有效「{PROGRESS_BREAKDOWN_LABEL.get(breakdown_col, breakdown_col)}」维度取值。"
        label = PROGRESS_BREAKDOWN_LABEL.get(breakdown_col, breakdown_col)
        overall = _one_summary(filters, dim_desc)
        parts = [f"{dim_desc}总体（截止{as_of}）：{overall}。"] if overall else []
        parts.append(f"各{label}：")
        for v in values:
            f2 = {**filters, breakdown_col: [v]}
            one = _one_summary(f2, v)
            if one:
                parts.append(f"{v} {one}；")
        if len(parts) == 1:
            return parts[0].rstrip("。") + "。"
        return "".join(parts).rstrip("；") + "。"
    except Exception as e:
        logger.exception("query_progress_summary 失败: %s", e)
        return f"查询进度失败：{str(e)}"


def execute_query_progress_period(
    db: Session,
    date_range: str,
    dimension: str = "",
    subproject: str = "",
    scope: str = "",
    unit: str = "",
    main_block: str = "",
    block: str = "",
    train: str = "",
    quarter: str = "",
    simple_block: str = "",
    implement_phase: str = "",
    contract_phase: str = "",
) -> str:
    """
    查询某时间段内完成的进度值（WF% 增量）。维度与 facilities/activity_summary 一致。
    """
    filters, dim_desc = _build_progress_filters(
        subproject=subproject, scope=scope, unit=unit, main_block=main_block,
        block=block, train=train, quarter=quarter, simple_block=simple_block,
        implement_phase=implement_phase, contract_phase=contract_phase, dimension=dimension,
    )
    d_start, d_end = _parse_date_range(date_range)

    try:
        use_cache = len(filters) <= 1 and _progress_cache_has_key(db, build_filter_key(filters) if filters else "")
        if use_cache and len(filters) <= 1:
            fk = build_filter_key(filters) if filters else ""
            row_start = db.execute(
                text("""
                    SELECT date, cum_plan_wf, cum_forecast_wf, cum_actual_wf
                    FROM dashboard_s_curve_cache WHERE filter_key = :fk AND date < :d
                    ORDER BY date DESC LIMIT 1
                """),
                {"fk": fk, "d": d_start},
            ).fetchone()
            row_end = db.execute(
                text("""
                    SELECT date, cum_plan_wf, cum_forecast_wf, cum_actual_wf
                    FROM dashboard_s_curve_cache WHERE filter_key = :fk AND date <= :d
                    ORDER BY date DESC LIMIT 1
                """),
                {"fk": fk, "d": d_end},
            ).fetchone()
            if row_end:
                plan_end = float(row_end[1] or 0)
                forecast_end = float(row_end[2] or 0)
                actual_end = float(row_end[3] or 0)
                plan_start = forecast_start = actual_start = 0.0
                if row_start:
                    plan_start, forecast_start, actual_start = float(row_start[1] or 0), float(row_start[2] or 0), float(row_start[3] or 0)
                return (
                    f"进度增量（{dim_desc}，{d_start}~{d_end}）："
                    f"实际进度+{round(actual_end - actual_start, 2)}%，计划进度+{round(plan_end - plan_start, 2)}%，预测进度+{round(forecast_end - forecast_start, 2)}%。"
                )

        svc = DashboardService(db)
        real = svc.get_progress_period_realtime(filters if filters else None, d_start, d_end)
        if not real:
            return f"当前无进度数据（{dim_desc}，{d_start}~{d_end}）。"
        return (
            f"进度增量（{dim_desc}，{d_start}~{d_end}）："
            f"实际进度+{round(real['delta_actual_wf'], 2)}%，计划进度+{round(real['delta_plan_wf'], 2)}%，预测进度+{round(real['delta_forecast_wf'], 2)}%。"
        )
    except Exception as e:
        logger.exception("query_progress_period 失败: %s", e)
        return f"查询进度增量失败：{str(e)}"


def execute_query_productivity(
    db: Session,
    date_range: str = "",
    work_type: str = "",
    scope: str = "",
    location: str = "",
    group_by: str = "",
) -> str:
    """
    查询工效。数据来自 productivity_cache / productivity_cache_wp。
    - 带 date_range：返回周期工效、累计工效（分别不算/算辅助人力）及各自相对标准工效的差距。
    - 无 date_range：仅返回累计工效及相对标准工效的差距。
    - group_by=scope/分包商：一次返回各分包商明细，避免多次调用导致超时。
    """
    today = datetime.now().date()
    if date_range and date_range.strip():
        d_start, d_end = _parse_date_range(date_range.strip())
        has_period = True
    else:
        d_start = PROJECT_START_DATE
        d_end = today
        has_period = False

    filters = {}
    wp_list = _get_work_packages(work_type) if work_type and work_type.strip() else None
    if wp_list:
        filters["work_package"] = wp_list
    scope_list = _get_scopes(scope) if scope and scope.strip() else None
    if scope_list:
        filters["scope"] = scope_list
    loc = (location or "").strip()
    if loc:
        filters["location"] = loc

    gb = (group_by or "").strip().lower()
    # 映射到 productivity_service 的 group_by：scope/subproject/block/unit/train/work_package
    _prod_grp_map = {
        "scope": "scope", "分包商": "scope",
        "subproject": "subproject", "子项目": "subproject",
        "block": "block", "子项": "block",
        "unit": "unit", "装置": "unit",
        "train": "train", "开车阶段": "train",
        "main_block": "main_block", "主项": "main_block",
        "quarter": "quarter", "区块": "quarter",
        "work_package": "work_package", "工作包": "work_package",
    }
    grp = _prod_grp_map.get(gb) or ("scope" if gb in ("scope", "分包商") else None)
    if not grp:
        grp = "scope"
    want_grouped = gb and grp and (gb in ("scope", "分包商", "子项目", "subproject", "子项", "block", "装置", "unit", "开车阶段", "train", "主项", "区块"))

    try:
        result = get_productivity_analysis(
            db, start_date=d_start, end_date=d_end, filters=filters if filters else None, group_by=grp
        )
    except Exception as e:
        logger.exception("query_productivity 失败: %s", e)
        return f"查询工效失败：{str(e)}"

    summary = result.get("summary", {})
    items = result.get("items", [])

    def _gap(actual, standard):
        if not standard or standard <= 0:
            return ""
        pct = (actual - standard) / standard * 100
        sign = "+" if pct >= 0 else ""
        return f"（相对标准工效 {sign}{round(pct, 2)}%）"

    cond_parts = []
    if work_type:
        cond_parts.append(work_type)
    if scope:
        cond_parts.append(f"scope={scope}")
    if loc:
        cond_parts.append(f"位置={loc}")
    cond_str = "、".join(cond_parts) if cond_parts else "全项目"

    # 当用户要求按维度分组且有 items 时，返回各维度明细
    dim_cn = {"scope": "分包商", "subproject": "子项目", "block": "子项", "unit": "装置", "train": "开车阶段", "main_block": "主项", "quarter": "区块", "work_package": "工作包"}.get(grp, grp)
    if want_grouped and items:
        lines = [f"【各{dim_cn}工效（截至{d_end}）】{cond_str}"]
        for it in items:
            dv = it.get("dim_val") or "—"
            cp = float(it.get("cum_productivity") or 0)
            cp_wp = float(it.get("cum_productivity_wp") or 0)
            wn = float(it.get("weighted_norms") or 0)
            g1 = _gap(cp, wn)
            g2 = _gap(cp_wp, wn)
            lines.append(f"  {dv}：累计工效（不算辅助人力）{round(cp, 4)}{g1}；算辅助人力 {round(cp_wp, 4)}{g2}；标准工效 {round(wn, 4)}")
        return "\n".join(lines)

    if not summary:
        return f"工效数据为空（{cond_str}，{d_start}~{d_end}）。"

    def _f(k, default=0):
        v = summary.get(k)
        try:
            return float(v) if v is not None else default
        except (ValueError, TypeError):
            return default

    prod = _f("productivity")
    prod_wp = _f("productivity_wp")
    cum_prod = _f("cum_productivity")
    cum_prod_wp = _f("cum_productivity_wp")
    std_norms = _f("weighted_norms")
    cum_std = _f("cum_weighted_norms", std_norms)

    lines = []
    if has_period:
        lines.append(f"【{d_start}~{d_end} 周期工效】{cond_str}")
        lines.append(f"  周期工效（不算辅助人力）：{round(prod, 4)} {_gap(prod, std_norms)}")
        lines.append(f"  周期工效（算辅助人力）：{round(prod_wp, 4)} {_gap(prod_wp, std_norms)}")
    lines.append(f"【累计工效（截至{d_end}）】{cond_str}")
    lines.append(f"  累计工效（不算辅助人力）：{round(cum_prod, 4)} {_gap(cum_prod, cum_std)}")
    lines.append(f"  累计工效（算辅助人力）：{round(cum_prod_wp, 4)} {_gap(cum_prod_wp, cum_std)}")
    std_label = f"标准工效：{round(cum_std, 4)}" if cum_std > 0 else "标准工效：无数据"
    lines.append(f"  {std_label}")
    return "\n".join(lines)


def list_ahead_plan_types(db: Session) -> str:
    """列出 ahead_plan 中所有 type_of_plan，供用户确认计划版本。"""
    rows = db.query(AheadPlan.type_of_plan).distinct().order_by(AheadPlan.type_of_plan).all()
    types = [r[0] for r in rows if r[0]]
    if not types:
        return "ahead_plan 中暂无计划数据。"
    return f"可选计划类型（type_of_plan）：{types}。请用户从中选择或直接指定其中一个。"


def _ahead_plan_activity_query(db, wp_list: List[str], scope_list, loc: str):
    """符合 work_type+scope+location 的 activity_id 查询（单一实现，供 filter 与 subquery 复用）。"""
    q = db.query(ActivitySummary.activity_id).filter(ActivitySummary.work_package.in_(wp_list))
    if scope_list is not None:
        q = q.filter(ActivitySummary.scope.in_(scope_list))
    if loc:
        q = q.filter(_location_filter(ActivitySummary, loc, _LOCATION_COLS_WITH_SIMPLE))
    return q.distinct()


def _ahead_plan_activity_filter(db, type_of_plan: str, wp_list: List[str], scope_list, loc: str):
    """返回符合 work_type+scope+location 的 activity_id 列表（用于 ahead_plan 查询）。"""
    return [r[0] for r in _ahead_plan_activity_query(db, wp_list, scope_list, loc).all()]


def _ahead_plan_activity_subquery(db, wp_list: List[str], scope_list, loc: str):
    """返回 activity_id 的 subquery，用于 JOIN 替代 IN(list)，避免 MySQL 大 IN 子句性能问题。"""
    return _ahead_plan_activity_query(db, wp_list, scope_list, loc).subquery()


def execute_query_ahead_plan(
    db: Session,
    type_of_plan: str,
    week: str,
    work_type: str = "",
    scope: str = "",
    location: str = "",
    include_actual: bool = True,
    group_by: str = "",
) -> str:
    """
    统一滚动计划查询。group_by 空=返回汇总；group_by=子项目/scope/分包商等=按维度分解。
    """
    if not type_of_plan or not type_of_plan.strip():
        return list_ahead_plan_types(db)
    gb = (group_by or "").strip()
    if not gb or gb.lower() in ("", "总和", "合计", "汇总"):
        return execute_query_ahead_plan_weekly(
            db, type_of_plan, work_type, scope, location, week, include_actual
        )
    # 按维度分解（设施或 scope）
    resolved = _resolve_group_by(gb)
    if not resolved:
        valid = "、".join(FACILITY_CN_LABELS.values())
        return f"未知分组维度「{gb}」。支持：{valid}（子项目、子项、装置、分包商/scope 等）。"
    return execute_query_ahead_plan_by_facility(
        db, type_of_plan, work_type, week, gb, scope, location, include_actual
    )


def execute_query_ahead_plan_weekly(
    db: Session,
    type_of_plan: str,
    work_type: str,
    scope: str,
    location: str,
    week: str,
    include_actual: bool = False,
) -> str:
    """
    滚动计划：某周某工程量类型的计划完成量（及可选的实际完成量）。
    type_of_plan: 如 月滚动计划_2026-01-30~2026-02-26；用户直接给出则无需确认。
    week: 本周 或 YYYY-MM-DD（周四日期）。
    """
    if not type_of_plan or not type_of_plan.strip():
        return list_ahead_plan_types(db)
    type_of_plan = type_of_plan.strip()

    wp_list = _get_work_packages(work_type)
    if not wp_list:
        return f"未知工程量类型「{work_type}」。常用：钢结构、混凝土、焊接 等。"

    thursday = _parse_week(week)
    scope_list = _get_scopes(scope)
    loc = (location or "").strip()

    allowed_subq = _ahead_plan_activity_subquery(db, wp_list, scope_list, loc)
    if not db.query(allowed_subq).limit(1).first():
        scope_desc = "全项目" if scope_list is None else f"scope in {scope_list}"
        loc_desc = loc or "全场"
        return f"无匹配作业：type_of_plan={type_of_plan}，work_type={work_type}，{scope_desc}，{loc_desc}。无计划数据。"

    planned = (
        db.query(func.sum(AheadPlan.planned_units))
        .join(allowed_subq, AheadPlan.activity_id == allowed_subq.c.activity_id)
        .filter(
            AheadPlan.type_of_plan == type_of_plan,
            AheadPlan.date == thursday,
        )
        .scalar()
    )
    planned_total = float(planned or 0)
    uom = _get_uom_for_work_packages(db, wp_list)

    result = (
        f"滚动计划：type_of_plan={type_of_plan}，week(周四)={thursday}，工程量类型={work_type}（work_package in {wp_list}）。"
        f"计划完成(planned_units)={planned_total}{uom}。"
    )

    if include_actual:
        week_start = thursday - timedelta(days=6)
        q_actual = (
            db.query(func.sum(VFACTDB.achieved))
            .filter(
                VFACTDB.date >= week_start,
                VFACTDB.date <= thursday,
                VFACTDB.work_package.in_(wp_list),
            )
        )
        if scope_list is not None:
            q_actual = q_actual.filter(VFACTDB.scope.in_(scope_list))
        if loc:
            q_actual = q_actual.filter(_location_filter(VFACTDB, loc))
        actual_total = float((q_actual.scalar()) or 0)
        result += f" 实际完成(VFACTDB.achieved)={actual_total}{uom}。"
    return result


def execute_query_ahead_plan_by_facility(
    db: Session,
    type_of_plan: str,
    work_type: str,
    week: str,
    group_by: str,
    scope: str = "",
    location: str = "",
    include_actual: bool = True,
) -> str:
    """
    滚动计划：按设施维度（子项目/子项/装置等）分解某周或整个计划周期的计划完成量及实际完成量。
    work_type 为空或「全部」「各专业」时，返回各子项目下各专业(work_package)的 plan vs actual。
    week 支持：本周、上周、上上周；或 整个周期/全周期/整个计划周期（聚合计划名称中的日期范围内全部周）。
    group_by 支持：子项目、子项、装置、开车阶段、主项、区块（或 subproject、block、unit、train、main_block、quarter）。
    不同计量单位的工作项不汇总合计；每项均显示单位。
    """
    if not type_of_plan or not type_of_plan.strip():
        return list_ahead_plan_types(db)
    type_of_plan = type_of_plan.strip()

    resolved = _resolve_group_by(group_by)
    if not resolved:
        valid = "、".join(FACILITY_CN_LABELS.values())
        return f"未知分组维度「{group_by}」。支持：{valid}（或 subproject、block、unit、train、main_block、quarter）。"

    col_name, col_cn = resolved
    wt = (work_type or "").strip().lower()
    all_disciplines = wt in ("", "全部", "各专业", "各类型", "全部专业")

    # 解析 week：整个周期 或 单周
    week_lower = (week or "").strip().lower()
    whole_period = week_lower in ("整个周期", "全周期", "整个计划周期", "全计划周期", "周期")

    scope_list = _get_scopes(scope)
    loc = (location or "").strip()

    if whole_period:
        # 整个周期：从 ahead_plan 取该计划所有周四，聚合计划与实际
        thursday_dates = [
            r[0] for r in
            db.query(AheadPlan.date)
            .filter(AheadPlan.type_of_plan == type_of_plan)
            .distinct().all()
        ]
        if not thursday_dates:
            return f"无计划数据：type_of_plan={type_of_plan}。"
        period_start = min(thursday_dates) - timedelta(days=6)  # 首周周五
        period_end = max(thursday_dates)  # 末周周四
        period_desc = f"{period_start}~{period_end}（整个周期）"
    else:
        thursday = _parse_week(week)
        thursday_dates = [thursday]
        period_start = thursday - timedelta(days=6)
        period_end = thursday
        period_desc = f"week(周四)={thursday}"

    if all_disciplines:
        # 各专业：一次查询获取 plan 内符合 scope/location 的 activity_id 与 work_package，避免大 IN 子句
        plan_act_subq = (
            db.query(AheadPlan.activity_id)
            .filter(
                AheadPlan.type_of_plan == type_of_plan,
                AheadPlan.date.in_(thursday_dates),
            )
            .distinct().subquery()
        )
        as_q = (
            db.query(ActivitySummary.activity_id, ActivitySummary.work_package)
            .join(plan_act_subq, ActivitySummary.activity_id == plan_act_subq.c.activity_id)
        )
        if scope_list is not None:
            as_q = as_q.filter(ActivitySummary.scope.in_(scope_list))
        if loc:
            as_q = as_q.filter(_location_filter(ActivitySummary, loc, _LOCATION_COLS_WITH_SIMPLE))
        rows = as_q.distinct().all()
        aid_list = list({r[0] for r in rows})
        wp_list = [w for w in {r[1] for r in rows if r[1]}]
        if not aid_list or not wp_list:
            return f"无计划数据：type_of_plan={type_of_plan}，{period_desc}。"
    else:
        wp_list = _get_work_packages(work_type)
        if not wp_list:
            return f"未知工程量类型「{work_type}」。常用：钢结构、混凝土、焊接、管道 等。可传「全部」或「各专业」查全部类型。"

    aid_list = _ahead_plan_activity_filter(db, type_of_plan, wp_list, scope_list, loc)
    if not aid_list:
        return f"无匹配作业：type_of_plan={type_of_plan}，work_type={work_type}。无计划数据。"

    as_col = getattr(ActivitySummary, col_name, None)
    vf_col = getattr(VFACTDB, col_name, None)
    if as_col is None or vf_col is None:
        return f"不支持的分组字段：{col_name}。"

    _, wp_info_full = _get_ordered_wp_info(db, wp_list)
    wp_uom_map = {wp: info.get("uom", "单位") for wp, info in wp_info_full.items()}
    wp_info = {wp: info.get("cn", wp) for wp, info in wp_info_full.items()}  # 供 _get_wp_display_cn 使用

    if all_disciplines:
        # 优化：不再按周循环查询，改为一次性全量聚合，极大提升性能并减少 504 概率
        allowed_subq = _ahead_plan_activity_subquery(db, wp_list, scope_list, loc)
        by_dim: dict = {}
        
        # 1. 一次性查出所有计划量（与 actual 一致：scope 必须显式过滤，避免 plan 范围超出 scope）
        plan_q = (
            db.query(as_col.label("dim_val"), ActivitySummary.work_package, func.sum(AheadPlan.planned_units).label("planned"))
            .join(ActivitySummary, AheadPlan.activity_id == ActivitySummary.activity_id)
            .join(allowed_subq, AheadPlan.activity_id == allowed_subq.c.activity_id)
            .filter(
                AheadPlan.type_of_plan == type_of_plan,
                AheadPlan.date.in_(thursday_dates),
            )
        )
        if scope_list is not None:
            plan_q = plan_q.filter(ActivitySummary.scope.in_(scope_list))
        plan_q = plan_q.group_by(as_col, ActivitySummary.work_package)
        for r in plan_q.all():
            d, wp, v = str(r[0] or "(空)"), r[1], float(r[2] or 0)
            if d not in by_dim: by_dim[d] = {}
            by_dim[d][wp] = [v, 0.0] # [planned, actual]

        # 2. 一次性查出所有实际完成量
        if include_actual:
            actual_q = (
                db.query(vf_col.label("dim_val"), VFACTDB.work_package, func.sum(VFACTDB.achieved).label("achieved"))
                .filter(
                    VFACTDB.date >= period_start,
                    VFACTDB.date <= period_end,
                    VFACTDB.work_package.in_(wp_list),
                )
                .group_by(vf_col, VFACTDB.work_package)
            )
            if scope_list is not None:
                actual_q = actual_q.filter(VFACTDB.scope.in_(scope_list))
            if loc:
                actual_q = actual_q.filter(_location_filter(VFACTDB, loc))
            
            for r in actual_q.all():
                d, wp, v = str(r[0] or "(空)"), r[1], float(r[2] or 0)
                if d not in by_dim: by_dim[d] = {}
                if wp not in by_dim[d]: by_dim[d][wp] = [0.0, 0.0]
                by_dim[d][wp][1] += v

        # 专业代码排序（与 DISCIPLINE_MAPPING 顺序一致）
        _disc_order = list(DISCIPLINE_MAPPING.keys()) + ["XX"]

        def _disc_sort_key(wp: str) -> int:
            code = (wp[:2].upper() if wp and len(wp) >= 2 else "XX")
            return _disc_order.index(code) if code in _disc_order else 999

        lines = []
        for dim_val in sorted(by_dim.keys()):
            # 按专业代码 -> 计量单位 -> [(wp, planned, achieved)] 重组
            by_disc_uom: Dict[str, Dict[str, List[Tuple[str, float, float]]]] = {}
            for wp, (p, a) in by_dim[dim_val].items():
                disc_code = wp[:2].upper() if wp and len(wp) >= 2 else "XX"
                uom = wp_uom_map.get(wp, "单位")
                if disc_code not in by_disc_uom:
                    by_disc_uom[disc_code] = {}
                if uom not in by_disc_uom[disc_code]:
                    by_disc_uom[disc_code][uom] = []
                by_disc_uom[disc_code][uom].append((wp, p, a))

            disc_items = []
            for disc_code in sorted(by_disc_uom.keys(), key=lambda c: _disc_order.index(c) if c in _disc_order else 999):
                disc_cn = DISCIPLINE_MAPPING.get(disc_code, (disc_code, []))[0]
                uom_groups = by_disc_uom[disc_code]
                for uom, wp_list in sorted(uom_groups.items(), key=lambda x: -len(x[1])):
                    wp_list_sorted = sorted(wp_list, key=lambda t: (_disc_sort_key(t[0]), t[0]))
                    total_p = round(sum(t[1] for t in wp_list_sorted), 2)
                    total_a = round(sum(t[2] for t in wp_list_sorted), 2)
                    rate_pct = total_a / total_p * 100 if total_p > 0 else 0
                    if len(wp_list_sorted) > 1:
                        details = "；".join(
                            f"{_get_wp_display_cn(wp, wp_info.get(wp))}计划{round(p, 2)}{uom}（实际{round(a, 2)}{uom}，{(a/p*100):.1f}%）"
                            if p > 0 else f"{_get_wp_display_cn(wp, wp_info.get(wp))}计划{round(p, 2)}{uom}（实际{round(a, 2)}{uom}）"
                            for wp, p, a in wp_list_sorted
                        )
                        disc_items.append(
                            f"{disc_cn}：计划{total_p}{uom}（实际{total_a}{uom}，{rate_pct:.1f}%），其中{details}"
                        )
                    else:
                        wp, p, a = wp_list_sorted[0]
                        label = _get_wp_display_cn(wp, wp_info.get(wp))
                        disc_items.append(
                            f"{disc_cn}：{label}计划{round(p, 2)}{uom}（实际{round(a, 2)}{uom}，{rate_pct:.1f}%）"
                        )
            lines.append(f"{dim_val}：{'；'.join(disc_items)}")
        detail = "\n".join(lines) if lines else "（无数据）"
        # 不同单位不可相加，不输出多专业总体合计
        return (
            f"滚动计划按{col_cn}分解（各专业）：type_of_plan={type_of_plan}，{period_desc}。\n"
            f"{detail}"
        )

    # 单一 work_type：计划聚合多周；用 subquery JOIN 替代 IN(aid_list)；scope 显式过滤
    uom = _get_uom_for_work_packages(db, wp_list)
    allowed_subq = _ahead_plan_activity_subquery(db, wp_list, scope_list, loc)
    plan_q = (
        db.query(as_col.label("dim_val"), func.sum(AheadPlan.planned_units).label("planned"))
        .join(ActivitySummary, AheadPlan.activity_id == ActivitySummary.activity_id)
        .join(allowed_subq, AheadPlan.activity_id == allowed_subq.c.activity_id)
        .filter(
            AheadPlan.type_of_plan == type_of_plan,
            AheadPlan.date.in_(thursday_dates),
        )
    )
    if scope_list is not None:
        plan_q = plan_q.filter(ActivitySummary.scope.in_(scope_list))
    plan_q = plan_q.group_by(as_col)
    plan_rows = plan_q.all()

    actual_q = (
        db.query(vf_col.label("dim_val"), func.sum(VFACTDB.achieved).label("achieved"))
        .filter(
            VFACTDB.date >= period_start,
            VFACTDB.date <= period_end,
            VFACTDB.work_package.in_(wp_list),
        )
        .group_by(vf_col)
    )
    if scope_list is not None:
        actual_q = actual_q.filter(VFACTDB.scope.in_(scope_list))
    if loc:
        actual_q = actual_q.filter(_location_filter(VFACTDB, loc))
    actual_rows = actual_q.all() if include_actual else []

    plan_map = {str(r[0] or "(空)"): float(r[1] or 0) for r in plan_rows}
    actual_map = {str(r[0] or "(空)"): float(r[1] or 0) for r in actual_rows}
    all_keys = sorted(set(plan_map.keys()) | set(actual_map.keys()))

    lines = []
    for k in all_keys:
        p = plan_map.get(k, 0)
        a = actual_map.get(k, 0)
        rate = f"({a/p*100:.1f}%)" if p and p > 0 else ""
        lines.append(f"{k}: 计划={p}{uom}, 实际={a}{uom} {rate}")
    total_plan = sum(plan_map.values())
    total_actual = sum(actual_map.values())
    total_rate = f"({total_actual/total_plan*100:.1f}%)" if total_plan and total_plan > 0 else ""
    detail = "；".join(lines) if lines else "（无数据）"
    return (
        f"滚动计划按{col_cn}分解：type_of_plan={type_of_plan}，{period_desc}，工程量类型={work_type}。"
        f"各{col_cn}：{detail}。"
        f"合计：计划={total_plan}{uom}，实际={total_actual}{uom} {total_rate}。"
    )


def execute_query_ahead_plan_submitters(
    db: Session, type_of_plan: str, work_type: str, scope: str, location: str
) -> str:
    """钢结构月滚动计划都是谁提交的？谁审批的？谁批准的？"""
    if not type_of_plan or not type_of_plan.strip():
        return list_ahead_plan_types(db)
    type_of_plan = type_of_plan.strip()

    wp_list = _get_work_packages(work_type)
    if not wp_list:
        return f"未知工程量类型「{work_type}」。常用：钢结构、混凝土、焊接 等。"

    scope_list = _get_scopes(scope)
    loc = (location or "").strip()
    allowed_subq = _ahead_plan_activity_subquery(db, wp_list, scope_list, loc)
    if not db.query(allowed_subq).limit(1).first():
        return f"无匹配作业：type_of_plan={type_of_plan}，work_type={work_type}。无计划数据。"

    rows = (
        db.query(AheadPlan.create_by, AheadPlan.reviewed_by, AheadPlan.approved_by)
        .join(allowed_subq, AheadPlan.activity_id == allowed_subq.c.activity_id)
        .filter(AheadPlan.type_of_plan == type_of_plan)
        .distinct()
        .all()
    )
    submitters = sorted({r[0] for r in rows if r[0]})
    reviewers = sorted({r[1] for r in rows if r[1]})
    approvers = sorted({r[2] for r in rows if r[2]})
    return (
        f"滚动计划 type_of_plan={type_of_plan}，工程量类型={work_type}："
        f"提交人(create_by)={submitters}；审批人(reviewed_by)={reviewers}；批准人(approved_by)={approvers}。"
    )


AI_ASSISTANT_SYSTEM_PROMPT = """你是项目计划管理系统的 AI 助手。根据用户问题直接调用合适工具；已明确的信息无需再向用户确认。若有对话历史，结合上下文理解后直接调用。

=== 一、核心区分：实际完成 vs 计划 ===
【实际完成】用户说「完成了多少」「实际完成」「完成情况」且未提「计划」→ 用 query_achieved；计划类问题用 query_ahead_plan。例：「上上周焊接完成了多少」= query_achieved(date_range=上上周, work_type=焊接, group_by=专业)。
【计划完成】用户明确说「计划完成」「计划vs实际」「计划多少」→ 用 query_ahead_plan，需 type_of_plan。未指定时先调用 list_ahead_plan_types。

=== 二、参数概念 ===
• scope（分包商）：取值形态为 scope 代码（C01、C02、…、C19）或常用称呼，由系统解析。回复中涉及分包商代码时，以工具返回的「查询条件」或结果中的解析说明为准。
• location（位置）：ECU、PEL、UIO、12510-01、block 等
• 日期：直接将相对词传入，无需追问。周=本周/上周/上上周；日=今天/昨天/前天；月=本月/上月；周期=整个周期/全周期
• 各专业：用户说「各专业」「全部专业」→ 不传 work_type 或 work_type=全部
• 专业命名：AR=建筑物/装饰（内墙/外墙/屋面/地面/吊顶/门窗/给排水管等）；CI=土建（结构基础/上部混凝土/道路地坪等）。取值以 activity_summary/rsc_defines 为准。
• 【「各个」统一规则】用户问「总量/总体多少，各个X分别多少」时：进度类用 query_progress_summary 的 breakdown_by（专业/子项/装置/主项等）；工程量、实际完成、滚动计划、人力类用对应工具的 group_by（子项目/主项/装置/专业/分包商等），一次调用即返回明细与合计，不是 progress 专属。

=== 三、工具路由 ===

query_achieved（实际完成）
  意图：完成量、实际完成、完成情况、按子项目/分包商/专业分解实际
  参数：date_range 必填；work_type 可选；group_by=空/scope/子项目/专业
  【某月完成量】用户问「某年某月完成量」「2月份完成情况」时，date_range 传该月整月，如 2026年2月、2026年2月份（系统解析为该月1日至该月最后一日）。
  【各个】「实际完成总共多少，各个子项目分别多少」→ group_by=子项目；「各专业完成量」→ group_by=专业
  【与工程量搭配】用户问「某分包商工程量总量情况？完成情况？」→ 先 query_volume_control_summary(scope=该分包商, work_type=全部) 得各工作包总量，再 query_achieved(scope=该分包商, group_by=专业, date_range=…) 得各专业完成量；用户未指定周期时传 date_range=全周期（累计）。

query_manpower（人力）
  意图：人力投入、工日、人数
  参数：date 必填；group_by=空/专业/scope/子项 等；work_type 可选

query_ahead_plan（滚动计划）
  意图：计划完成、计划vs实际、各专业计划vs实际
  参数：type_of_plan、week 必填；work_type=全部 返回各专业
  【week 与用户指定周期一致】参数须与用户指定周期一致；用户指定了某周期则传该周期，不得擅自用整个周期替代。后端容忍各类日期/周期写法并解析。
  【group_by 按用户意图】用户明确问「各专业计划vs实际」「各个子项目」→ group_by=子项目、work_type=全部、week=用户指定周或整个周期；用户仅问「计划量vs完成量」未提「各」→ group_by 空（汇总）

query_volume_control_summary（工程量控制）
  意图：总量(estimated_total)、材料到货、工作面、施工完成、验收、竣工资料、收款；按工作包/主项/子项目/装置分解。
  【某分包商工程量总量/各工作包】用户问「二化建工程量总量情况」「某分包商各个工作包的工程量」→ scope=该分包商，work_type 不传或传「全部」，一次返回各 work_package 的总量/到货/工作面/施工完成/验收/竣工/收款（工具内部默认 group_by=工作包），无需用户指定工程量类型。
  【单类型+设施分解】「混凝土总量有多少，各个子项目分别有多少」→ work_type=混凝土 + group_by=子项目。group_by 支持：工作包/work_package、主项、子项目、装置、子项、开车阶段、区块。phase：一期/二期。

query_progress_summary / query_progress_period（进度）
  意图：累计进度、E/P/C 阶段进度、本周/上月进度增量
  参数：维度与 facilities、activity_summary、GlobalFilter 栏位一致：subproject/scope/unit/main_block/block/train/quarter/simple_block/implement_phase/contract_phase。各参数取值形态见工具 definition（如 unit 为 EC1/PE1；main_block 为 12200、12401；quarter 为 Q11、Q21）。无数据时仅依据工具返回的「可尝试」或诊断建议回复，不编造原因。
  【各个】用户问「各专业/各子项/各装置」→ 传对应筛选并 breakdown_by=专业/block/unit 等。

query_productivity（工效）
  意图：工效、劳动效率
  参数：date_range 可选；group_by=scope 得各分包商明细

=== 四、输出规范 ===
• 回复使用纯文本（不用 Markdown 粗体）。
• 合计/汇总/总计须基于工具返回数据；工具已返回「合计」行时直接引用，不编造数值。
• 【保留明细】query_ahead_plan 返回子项目×专业明细时，原样呈现 ECU/PEL/UIO 下各专业详情，不得汇总成「钢结构」「混凝土」等大类丢失子项目维度。
• 【效率优先】若返回数据量极大（如超过 20 条明细），请先给出一个全局性的简要总结（总计划 vs 总实际），再以紧凑的列表形式列出明细，避免过长描述。
• 【工程量单位】不同工作包对应不同单位（M³、T、M、M²、DIN 等），禁止把不同工作包的数量加总为一个「总量合计」或「完成比」。工具按主项/子项目分组时已按「主项×工作包」或「子项目×工作包」分项返回、每项带单位；回复时仅可同工作包内汇总或算完成比，不得将各工作包再相加。
• 【同专业先汇总再分项】同专业且同 resource_id_name/resource_id 的工作包，先给该专业汇总值，再分项列出（如：钢结构 46,304T（其中主体结构 34,118T，次级结构 12,186T））。
• 【子项与区块】用户问「分布在哪些子项」时仅用 group_by=子项/block，不得改用或自行汇总为「区块」；区块(quarter) 取值仅为 Q11、Q21 等；数字编号如 1301、1302 属主项/子项等，不是区块。未得到用户明确指令前不得自行按其他维度汇总。
"""


# 对话模式：最多保留的历史消息数，避免 token 超限
MAX_HISTORY_MESSAGES = 20


def chat_with_tools(
    db: Session,
    user_message: str,
    conversation_history: Optional[List[dict]] = None,
    current_user: Optional[Any] = None,
) -> Tuple[str, list]:
    """
    调用 DeepSeek，支持 Function Calling。
    若模型返回 tool_calls，执行对应函数并把结果回传，循环直到模型返回文本。
    支持对话模式：传入 conversation_history 可让模型理解上下文（如「再查一下上周的」「按子项目分解」等追问）。
    current_user: 当前用户，用于注入 scope/subproject 权限约束（C01Planner→scope=C01，ECUConstructionSupervisor→subproject=ECU）。
    返回: (reply_text, tools_called_list)，tools_called_list 形如 [{"name": "query_achieved", "arguments": {...}}]
    """
    api_key = settings.DEEPSEEK_API_KEY or ""
    if not api_key:
        logger.warning("DEEPSEEK_API_KEY 未配置，AI 助手不可用")
        return ("AI 助手暂未配置，请设置 DEEPSEEK_API_KEY 环境变量。", [])

    constraints = get_ai_user_constraints(db, current_user) if current_user else {"scope": None, "subproject": None}
    system_content = _build_system_prompt(constraints)

    tools_called: list = []
    client = OpenAI(
        api_key=api_key,
        base_url=settings.DEEPSEEK_BASE_URL or "https://api.deepseek.com",
        timeout=300.0,  # 增加超时时间到 5 分钟，处理大数据量生成
        max_retries=2,   # 减少重试次数，避免无限阻塞
    )

    messages = [{"role": "system", "content": system_content}]
    if conversation_history:
        # 只保留最近 N 条，避免 token 超限
        trimmed = conversation_history[-MAX_HISTORY_MESSAGES:]
        messages.extend(trimmed)
    messages.append({"role": "user", "content": user_message})

    max_rounds = 10  # 防止 Function Calling 循环
    for round_num in range(max_rounds):
        logger.info(f"AI Assistant Chat Round {round_num + 1}/{max_rounds} for user: {current_user.username if current_user else 'unknown'}")
        try:
            response = client.chat.completions.create(
                model="deepseek-chat",
                messages=messages,
                tools=TOOLS,
            )
        except Exception as e:
            logger.exception(f"DeepSeek API 调用失败 (Round {round_num + 1}): %s", e)
            return (f"AI 服务调用失败：{str(e)}", tools_called)

        msg = response.choices[0].message
        logger.info(f"AI Assistant Round {round_num + 1} response received. Tool calls: {bool(msg.tool_calls)}")

        if not msg.tool_calls:
            reply = (msg.content or "").strip() or "抱歉，未能生成回复。"
            return (reply, tools_called)

        messages.append(msg)
        for tc in msg.tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            tools_called.append({"name": name, "arguments": args})
            # 注入用户权限约束：scope/subproject 未填时使用当前用户权限范围
            a = _merge_constraints(args, constraints)

            if name == "query_achieved":
                result = execute_query_achieved(
                    db,
                    a.get("date_range") or a.get("date", ""),
                    a.get("work_type", ""),
                    a.get("scope", ""),
                    a.get("location", ""),
                    a.get("group_by", ""),
                )
            elif name == "query_manpower":
                result = execute_query_manpower(
                    db,
                    a.get("date", ""),
                    a.get("scope", ""),
                    a.get("location", ""),
                    a.get("manpower_type", "direct"),
                    a.get("work_type", ""),
                    a.get("group_by", ""),
                )
            elif name == "query_volume_control_summary":
                result = execute_query_volume_control_summary(
                    db,
                    a.get("location", ""),
                    a.get("work_type", ""),
                    a.get("scope", ""),
                    group_by=a.get("group_by", ""),
                    phase=a.get("phase", ""),
                )
            elif name == "list_ahead_plan_types":
                result = list_ahead_plan_types(db)
            elif name == "query_ahead_plan":
                result = execute_query_ahead_plan(
                    db,
                    a.get("type_of_plan", ""),
                    a.get("week", "本周"),
                    a.get("work_type", ""),
                    a.get("scope", ""),
                    a.get("location", ""),
                    a.get("include_actual", True),
                    a.get("group_by", ""),
                )
            elif name == "query_ahead_plan_submitters":
                result = execute_query_ahead_plan_submitters(
                    db,
                    a.get("type_of_plan", ""),
                    a.get("work_type", ""),
                    a.get("scope", ""),
                    a.get("location", ""),
                )
            elif name == "query_progress_summary":
                result = execute_query_progress_summary(
                    db,
                    a.get("as_of_date", ""),
                    a.get("dimension", ""),
                    a.get("subproject", ""),
                    a.get("scope", ""),
                    a.get("unit", ""),
                    a.get("main_block", ""),
                    a.get("block", ""),
                    a.get("train", ""),
                    a.get("quarter", ""),
                    a.get("simple_block", ""),
                    a.get("implement_phase", ""),
                    a.get("contract_phase", ""),
                    a.get("breakdown_by", ""),
                )
            elif name == "query_progress_period":
                result = execute_query_progress_period(
                    db,
                    a.get("date_range", ""),
                    a.get("dimension", ""),
                    a.get("subproject", ""),
                    a.get("scope", ""),
                    a.get("unit", ""),
                    a.get("main_block", ""),
                    a.get("block", ""),
                    a.get("train", ""),
                    a.get("quarter", ""),
                    a.get("simple_block", ""),
                    a.get("implement_phase", ""),
                    a.get("contract_phase", ""),
                )
            elif name == "query_productivity":
                result = execute_query_productivity(
                    db,
                    a.get("date_range", ""),
                    a.get("work_type", ""),
                    a.get("scope", ""),
                    a.get("location", ""),
                    a.get("group_by", ""),
                )
            else:
                result = f"未知工具: {name}"

            # 凡接受 scope 的工具，在返回结果前注明解析后的分包商，供模型照抄回复、避免编造代码（根本解决 scope 识别错误）
            _SCOPE_TOOLS = (
                "query_achieved",
                "query_manpower",
                "query_volume_control_summary",
                "query_ahead_plan",
                "query_ahead_plan_submitters",
                "query_progress_summary",
                "query_progress_period",
                "query_productivity",
            )
            scope_arg = (a.get("scope") or "").strip()
            if name in _SCOPE_TOOLS and scope_arg:
                codes = _get_scopes(scope_arg)
                if codes:
                    result = f"【查询条件】分包商：{scope_arg}（{', '.join(codes)}）\n\n{result}"

            messages.append(
                {"role": "tool", "tool_call_id": tc.id, "content": result}
            )

    # 达到 max_rounds 时，强制进行一次无工具调用，要求模型基于已有工具结果生成文本回答
    if tools_called:
        try:
            force_msg = {"role": "user", "content": "请根据上述工具返回的数据，直接给出简洁的汇总回答，不要再调用工具。"}
            messages.append(force_msg)
            resp = client.chat.completions.create(
                model="deepseek-chat",
                messages=messages,
                tools=TOOLS,
                tool_choice="none",
            )
            final = (resp.choices[0].message.content or "").strip()
            if final:
                return (final, tools_called)
        except Exception as e:
            logger.warning("强制生成最终回答失败: %s", e)

    logger.warning(
        "AI 助手达到 max_rounds=%d 未返回最终回答，已调用工具: %s",
        max_rounds,
        [t.get("name") for t in tools_called],
    )
    return ("查询已执行，但模型未返回最终回答，请重试。", tools_called)


class AIAssistantService:
    def __init__(self, db: Session):
        self.db = db

    async def chat(self, user_id: int, message: str, history: list = None, context: dict = None):
        return {
            "answer": "AI 助手已恢复（当前为兼容模式）。原有的 EPC 查询功能正在适配新的制造管理平台数据模型。",
            "history": history or []
        }

    def get_user_chat_history(self, user_id: int):
        return []


AI_ASSISTANT_DAILY_LIMIT = 20

MANUFACTURING_AI_PERSONA = """你是一位深耕机械制造行业 20 年的首席系统架构师与流程专家，精通 ERP、MES、PLM 及 APS 系统集成。
你的回答必须围绕机械制造企业“非标定制多、BOM 结构复杂、工艺路径多变、成本核算难、交期压力大”的真实痛点展开，并给出能直接落地到系统功能、主数据、流程节点和管理指标的建议。"""

MANUFACTURING_DOMAIN_PLAYBOOK = [
    {
        "name": "经营与项目立项",
        "keywords": ["报价", "商机", "项目", "合同", "订单", "客户", "交付", "交期"],
        "guidance": [
            "建立“销售订单/项目号/客户需求版本”三位一体主线，所有设计、采购、生产、发运都回写同一项目对象。",
            "非标制造必须把技术澄清、配置选择、交期承诺和目标毛利放在接单前锁定，否则后续 BOM 与工艺会持续返工。",
            "核心看板建议跟踪：中标率、变更后毛利、承诺交期达成率、项目延期原因结构。",
        ],
        "deliverables": ["客户需求清单", "项目主数据", "交付里程碑", "目标成本"],
    },
    {
        "name": "PLM 与多层 BOM",
        "keywords": ["bom", "ebom", "pbom", "mbom", "物料", "替代料", "版本", "ecn", "图纸", "设计"],
        "guidance": [
            "先统一物料编码、图号、版本号、单位、材质和来源属性，再谈 BOM 展开、替代料和成本汇总。",
            "系统要区分 EBOM、PBOM、MBOM，并保留设计版本到制造版本的转换关系，否则工艺和采购永远追不上设计变更。",
            "ECN 不能只记录结果，还要记录影响范围：已采购、在制、待装配、已发货四类对象必须分开处置。",
        ],
        "deliverables": ["物料主数据", "多版本 BOM", "ECN 影响清单", "替代料策略"],
    },
    {
        "name": "工艺路线与车间执行",
        "keywords": ["工艺", "路线", "工序", "工时", "委外", "派工", "报工", "工装", "产线", "车间"],
        "guidance": [
            "工艺模板需要支持按产品族继承，再允许订单级差异化覆盖，才能适配非标场景。",
            "每道工序至少要绑定工作中心、标准工时、前置约束、检验点和是否委外，这些字段是 APS 排产与 MES 执行的底座。",
            "报工不仅记录完工数量，还要记录返工、报废、等待、换型和异常原因，否则无法做真实工时与效率分析。",
        ],
        "deliverables": ["工艺模板", "工序路线", "工作中心日历", "派工报工记录"],
    },
    {
        "name": "APS 排产与产能协同",
        "keywords": ["aps", "排产", "产能", "齐套", "瓶颈", "负荷", "计划", "插单", "优先级"],
        "guidance": [
            "排产不能只按交期，要同时看物料齐套、关键工序负荷、外协周期和装配窗口。",
            "对非标订单建议采用“主计划 + 瓶颈工序有限产能 + 关键件齐套校验”的混合排产策略。",
            "系统应输出延期预警、瓶颈资源热力图、插单影响分析和缺料影响清单，支持计划员快速调整。",
        ],
        "deliverables": ["主生产计划", "产能负荷表", "缺料预警", "插单影响分析"],
    },
    {
        "name": "采购、库存与齐套",
        "keywords": ["采购", "库存", "mrp", "缺料", "齐套", "供应商", "到货", "仓库"],
        "guidance": [
            "采购计划必须按订单 BOM 和工艺前置时间反算，而不是只看安全库存。",
            "非标件、标准件、外协件要分别管理采购策略与交期责任，否则齐套分析会失真。",
            "建议把缺料分成：设计未释放、请购未下达、供应商延期、来料检验不合格、仓储不可用五类。",
        ],
        "deliverables": ["MRP 计划", "缺料分类", "供应商交付表现", "齐套清单"],
    },
    {
        "name": "成本、质量与交付闭环",
        "keywords": ["成本", "核算", "质量", "不良", "返工", "毛利", "交付", "售后", "验收"],
        "guidance": [
            "成本核算至少分解到材料、加工、装配、外协、质检、物流六个层面，并能追溯到订单和工序。",
            "质量模块要贯穿来料、过程、终检和售后，并与返工返修工时联动，才能算出真实制造成本。",
            "最终管理闭环不是“产品做完”，而是“按期交付、利润兑现、问题沉淀回设计和工艺标准库”。",
        ],
        "deliverables": ["订单成本台账", "质量闭环", "交付看板", "经验复盘库"],
    },
]


def _normalize_chat_history(history: Optional[List[Dict[str, Any]]]) -> List[Dict[str, str]]:
    normalized: List[Dict[str, str]] = []
    for item in history or []:
        role = str(item.get("role", "")).strip()
        content = str(item.get("content", "")).strip()
        if role in {"user", "assistant"} and content:
            normalized.append({"role": role, "content": content})
    return normalized[-MAX_HISTORY_MESSAGES:]


def _infer_manufacturing_topics(message: str) -> List[Dict[str, Any]]:
    lowered = message.lower()
    matched: List[Dict[str, Any]] = []
    for area in MANUFACTURING_DOMAIN_PLAYBOOK:
        if any(keyword.lower() in lowered for keyword in area["keywords"]):
            matched.append(area)
    return matched


def _build_overall_architecture_reply() -> str:
    return "\n".join(
        [
            "我会按机械制造公司的全链路管理平台来拆解这件事，建议先把系统骨架定成 6 层：",
            "1. 经营与项目层：客户需求、报价、订单、项目里程碑、目标毛利。",
            "2. PLM 主数据层：物料主数据、图纸版本、EBOM/PBOM/MBOM、ECN 影响控制。",
            "3. 工艺制造层：工艺路线、工序模板、工作中心、工装夹具、委外工序。",
            "4. 计划协同层：MRP 齐套、APS 排产、瓶颈资源、插单影响、交期承诺。",
            "5. 执行质量层：派工、报工、检验、返工返修、不良原因、入库与发运。",
            "6. 经营分析层：订单成本、标准成本偏差、准交率、一次合格率、在制周转天数。",
            "",
            "如果你要把当前项目继续做成制造业平台，第一优先不是多做页面，而是先统一“订单、物料、BOM、工艺、工单”五个核心对象及其状态流转。",
            "建议下一步先定三份基础蓝图：业务流程蓝图、主数据蓝图、角色权限蓝图。这样后面的页面、接口和报表都会稳很多。",
        ]
    )


def _build_topic_reply(message: str, topics: List[Dict[str, Any]]) -> str:
    lines = ["我按机械制造企业的落地逻辑来分析这个问题。"]
    for index, topic in enumerate(topics[:3], start=1):
        lines.append(f"{index}. {topic['name']}")
        for point in topic["guidance"]:
            lines.append(f"- {point}")
        lines.append(f"建议系统对象：{', '.join(topic['deliverables'])}")

    if any(keyword in message for keyword in ["流程", "架构", "规划", "平台", "系统"]):
        lines.extend(
            [
                "",
                "建议实施顺序：",
                "1. 先打通主数据和版本控制，确保物料/BOM/工艺不会各自为政。",
                "2. 再把订单、采购、生产、质检的状态流统一到一条订单交付主线上。",
                "3. 最后补经营分析和预警看板，避免先做展示层、后补业务底座。",
            ]
        )
    else:
        lines.extend(
            [
                "",
                "如果你愿意，我下一步可以继续把这部分直接细化成：数据表设计、页面菜单结构，或者接口清单。",
            ]
        )
    return "\n".join(lines)


def _generate_manufacturing_reply(message: str, history: Optional[List[Dict[str, str]]] = None) -> str:
    history = history or []
    latest_context = ""
    for item in reversed(history):
        if item.get("role") == "user":
            latest_context = item.get("content", "")
            break
    combined_message = f"{latest_context}\n{message}".strip()
    topics = _infer_manufacturing_topics(combined_message)
    if topics:
        return _build_topic_reply(message, topics)
    return _build_overall_architecture_reply()


class AIAssistantService:
    def __init__(self, db: Session):
        self.db = db
        self._ensure_tables()

    def _ensure_tables(self) -> None:
        bind = self.db.get_bind()
        if bind is None:
            return
        AIAssistantUsage.__table__.create(bind=bind, checkfirst=True)
        AIAssistantQueryLog.__table__.create(bind=bind, checkfirst=True)

    def _get_today_usage_row(self, user_id: int) -> AIAssistantUsage:
        today = datetime.now().date()
        row = (
            self.db.query(AIAssistantUsage)
            .filter(
                AIAssistantUsage.user_id == user_id,
                AIAssistantUsage.usage_date == today,
            )
            .first()
        )
        if row:
            return row

        row = AIAssistantUsage(user_id=user_id, usage_date=today, count=0)
        self.db.add(row)
        self.db.flush()
        return row

    def get_usage(self, user_id: int) -> Dict[str, int]:
        usage = self._get_today_usage_row(user_id)
        used = usage.count or 0
        return {
            "used": used,
            "limit": AI_ASSISTANT_DAILY_LIMIT,
            "remaining": max(AI_ASSISTANT_DAILY_LIMIT - used, 0),
        }

    async def chat(self, user_id: int, message: str, history: list = None, context: dict = None):
        cleaned_message = (message or "").strip()
        if not cleaned_message:
            raise ValueError("消息不能为空")

        usage = self._get_today_usage_row(user_id)
        if (usage.count or 0) >= AI_ASSISTANT_DAILY_LIMIT:
            raise ValueError("今日 AI 提问次数已用完，请明天再试。")

        normalized_history = _normalize_chat_history(history)
        reply = _generate_manufacturing_reply(cleaned_message, normalized_history)
        new_history = normalized_history + [
            {"role": "user", "content": cleaned_message},
            {"role": "assistant", "content": reply},
        ]

        user = self.db.query(User).filter(User.id == user_id).first()
        log = AIAssistantQueryLog(
            user_id=user_id,
            username=getattr(user, "username", None),
            question=cleaned_message,
            reply=reply,
            tools_called=json.dumps(
                {
                    "mode": "manufacturing_advisor",
                    "persona": MANUFACTURING_AI_PERSONA,
                    "context": context or {},
                },
                ensure_ascii=False,
            ),
        )
        self.db.add(log)
        usage.count = (usage.count or 0) + 1
        self.db.commit()
        self.db.refresh(log)

        return {
            "reply": reply,
            "answer": reply,
            "remaining": max(AI_ASSISTANT_DAILY_LIMIT - usage.count, 0),
            "log_id": log.id,
            "history": new_history[-MAX_HISTORY_MESSAGES:],
        }

    def submit_feedback(self, user_id: int, log_id: int, feedback: str) -> None:
        log = (
            self.db.query(AIAssistantQueryLog)
            .filter(
                AIAssistantQueryLog.id == log_id,
                AIAssistantQueryLog.user_id == user_id,
            )
            .first()
        )
        if not log:
            raise ValueError("未找到对应的 AI 对话记录。")
        log.feedback = feedback
        self.db.commit()

    def get_query_log(self, user_id: int, page: int = 1, page_size: int = 20, days: int = 30) -> Dict[str, Any]:
        page = max(page, 1)
        page_size = max(min(page_size, 100), 1)
        cutoff = datetime.now() - timedelta(days=max(days, 1))

        query = (
            self.db.query(AIAssistantQueryLog)
            .filter(
                AIAssistantQueryLog.user_id == user_id,
                AIAssistantQueryLog.created_at >= cutoff,
            )
            .order_by(AIAssistantQueryLog.created_at.desc())
        )
        total = query.count()
        rows = query.offset((page - 1) * page_size).limit(page_size).all()
        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "items": [
                {
                    "id": row.id,
                    "question": row.question,
                    "reply": row.reply,
                    "feedback": row.feedback,
                    "created_at": row.created_at.isoformat() if row.created_at else None,
                }
                for row in rows
            ],
        }

    def get_user_chat_history(self, user_id: int):
        rows = (
            self.db.query(AIAssistantQueryLog)
            .filter(AIAssistantQueryLog.user_id == user_id)
            .order_by(AIAssistantQueryLog.created_at.desc())
            .limit(MAX_HISTORY_MESSAGES // 2)
            .all()
        )
        history: List[Dict[str, str]] = []
        for row in reversed(rows):
            history.append({"role": "user", "content": row.question})
            history.append({"role": "assistant", "content": row.reply or ""})
        return history[-MAX_HISTORY_MESSAGES:]
