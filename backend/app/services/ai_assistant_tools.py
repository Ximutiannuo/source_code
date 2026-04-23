"""
AI 助手 Function Calling 工具定义

日期/周/月/季/年 相对词映射（无需询问用户，可直接传入工具）：
  周（周五~周四为一周）：本周/这周、上周、上上周/大上周、下周、下下周、未来N周、过去N周
  日：今天、昨天、前天、大前天
  月：本月、上月、下月、过去N月、未来N月
  季度：本季度、上季度、下季度
  年：本年、今年、去年、明年
  示例：今天是周五，则 上周=上周五~本周四；本周=本周五~下周四。

设施维度映射（与 facilities 表、activity_summary、GlobalFilter、ActivityListAdvanced 一致）：
  子项目=subproject、子项=block、装置=unit、开车阶段=train、主项=main_block、区块=quarter、简化子项=simple_block。
  装置(unit) 取值为 facilities.unit，如 EC1、EC2、PE1、PE2 等；主项/子项等取值以系统实际数据为准（见各参数取值形态）。
"""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "query_achieved",
            "description": "查询实际完成量（VFACTDB，与滚动计划无关）。date_range 支持单日（昨天、今天）、范围（本周、上周、2025-01-01至2026-02-12）、全周期/累计。用户未指定周期时传 date_range=全周期 表示累计完成。【重要】「完成了多少」=实际完成；「计划完成多少」用 query_ahead_plan。group_by：空=总和；scope/分包商=按分包商；子项目/子项/装置=按设施；专业/work_package=按工程量类型。",
            "parameters": {
                "type": "object",
                "properties": {
                    "date_range": {
                        "type": "string",
                        "description": "日期。单日：昨天、今天；范围：本周、上周、本月、上月、2025-01-01至2026-02-12；某年某月整月：2026年2月、2026年2月份（解析为该月1日至该月最后一日）；起始日至相对终点：如 2026年2月1日到今天、到昨天、到上周、到本月；用户未指定周期时传 全周期 或 累计 表示累计完成。",
                    },
                    "work_type": {
                        "type": "string",
                        "description": "工程量类型（可选）。如 钢结构、混凝土、焊接。group_by=专业/work_package 时不传则全部类型；group_by 空/scope/设施时必填。",
                    },
                    "scope": {
                        "type": "string",
                        "description": "分包商。取值形态：scope 代码（C01、C02、C05、C07、C09、C12、C13、C15、C16、C17、C18、C19）或常用称呼；系统解析后会在返回结果中注明「查询条件：分包商 xxx（解析为 Cxx）」，回复时以该解析结果为准。不填则全项目。",
                    },
                    "location": {
                        "type": "string",
                        "description": "位置，如 ECU、12510-01。支持模糊匹配，不填则全场。",
                    },
                    "group_by": {
                        "type": "string",
                        "description": "分组维度：空=总和；scope/分包商=按分包商；子项目/子项/装置/开车阶段/主项/区块=按设施；专业/work_package=按工程量类型。",
                    },
                },
                "required": ["date_range"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_manpower",
            "description": "查询人力投入，与工程量工具维度一致。支持 date、scope、location、work_type 筛选，及 group_by 分组。【各个】用户问「人力总共多少，各个专业/子项目分别多少」→ 传 group_by=专业 或 group_by=子项目。group_by=专业/discipline 按专业分组；group_by=分包商/scope 按分包商分组；group_by=子项/block、子项目、装置 等按设施分组；不传 group_by 返回总和。适用于「PI01昨天投入多少人」「各专业人力」「各分包商人力」「按子项人力」等。",
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {"type": "string", "description": "日期。支持：昨天、今天、本周、上周、2025-01-01至2026-02-12 等"},
                    "scope": {"type": "string", "description": "分包商，如 C13、施工九队。不填则全项目。"},
                    "location": {"type": "string", "description": "位置，如 ECU、12510-01。支持模糊匹配。不填则全场。"},
                    "work_type": {"type": "string", "description": "工作包/工程量类型（可选）。如 PI01、地下管、钢结构、焊接 等。"},
                    "manpower_type": {"type": "string", "description": "人力类型：direct/直接、indirect/间接、all/全部"},
                    "group_by": {"type": "string", "description": "分组维度（可选）：专业/discipline、分包商/scope、子项/block、子项目/subproject、装置/unit 等。不传则返回总和。"},
                },
                "required": ["date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_volume_control_summary",
            "description": "查询工程量控制汇总，返回：总量(estimated_total)、材料到货、工作面、施工完成、验收、竣工资料、收款。用户问「某分包商工程量总量情况」「各工作包分别的量」→ 传 scope=该分包商，work_type 不传或传「全部」，则按该分包商在 activity_summary 中的各 work_package 分解返回（等价 group_by=工作包）。单类型时传 work_type=钢结构/混凝土/焊接 等。group_by：按主项/子项目/装置/子项/开车阶段/区块 或 工作包/work_package（与 activity_summary.work_package 一致）。期别 phase：一期=train T0/T1，二期=T2。「本周实际完成」用 query_achieved。",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "位置（activity_summary 维度）。如 12510-01、ECU。支持模糊匹配，不填则全项目。",
                    },
                    "work_type": {
                        "type": "string",
                        "description": "工程量类型（可选）。不传或传「全部」且指定 scope 时，按该分包商各 work_package 分解；传 钢结构、混凝土、焊接、给排水 等为单类。",
                    },
                    "scope": {
                        "type": "string",
                        "description": "分包商（activity_summary.scope）。取值形态：scope 代码（C01、C02、…、C19）或常用称呼；系统解析后会在返回结果中注明「查询条件：分包商 xxx（解析为 Cxx）」，回复时以该解析结果为准。不填则全项目。",
                    },
                    "group_by": {
                        "type": "string",
                        "description": "分组维度（可选）。工作包/work_package=按各工作包；主项、子项目/subproject、装置/unit、子项/block、开车阶段/train、区块/quarter。取值形态：子项/block 对应 facilities.block，取值以系统为准；区块/quarter 对应 facilities.quarter，取值形态为 Q11、Q21 等。不传且 work_type=全部 时默认按工作包。",
                    },
                    "phase": {
                        "type": "string",
                        "description": "期别（可选）。一期=train T0/T1；二期=train T2。不传则不过滤。",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_ahead_plan_types",
            "description": "列出 ahead_plan 表中实际存在的 type_of_plan，仅当用户明确要查「计划完成」「计划vs实际」且未指定计划类型时调用。返回数据库中实际存在的选项；向用户展示时仅使用本函数返回的列表。用户已直接给出 type_of_plan 则无需调用。",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_ahead_plan",
            "description": "滚动计划查询。week：参数须与用户指定周期一致，用户指定了某周期则传该周期，不得擅自用整个周期替代；后端容忍各类日期/周期写法并解析。group_by：用户明确问「各专业」「各个子项目」「各个分包商」时传对应维度；仅问「计划量vs完成量」未提「各」时传空。用户问「各专业计划vs实际」→ group_by=子项目、work_type=全部。work_type 传空或「全部」返回各专业。",
            "parameters": {
                "type": "object",
                "properties": {
                    "type_of_plan": {"type": "string", "description": "计划类型，如 月滚动计划_2026-01-30~2026-02-26"},
                    "week": {"type": "string", "description": "须与用户指定周期一致：用户指定了某周期则传该周期；用户说整个周期才传 整个周期/全周期。不得擅自用整个周期替代用户指定的周。后端容忍各类日期/周期写法并解析。"},
                    "work_type": {"type": "string", "description": "工程量类型。钢结构、混凝土、焊接 等。传空或「全部」返回各专业。"},
                    "scope": {"type": "string", "description": "分包商。不填则全项目。"},
                    "location": {"type": "string", "description": "位置，如 ECU。不填则全场。"},
                    "include_actual": {"type": "boolean", "description": "是否同时查询实际完成量，默认 true"},
                    "group_by": {
                        "type": "string",
                        "description": "分组维度。用户明确问「各专业」「各个子项目」「各个分包商」时传对应值；用户仅问「计划量vs完成量」未提「各」时传空。空=汇总；子项目=按ECU/PEL/UIO分解；分包商=按分包商分解。",
                    },
                },
                "required": ["type_of_plan", "week"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_ahead_plan_submitters",
            "description": "查询滚动计划中某工程量类型的提交人、审批人、批准人。适用于：'钢结构月滚动计划都是谁提交的？谁审批的？谁批准的？'",
            "parameters": {
                "type": "object",
                "properties": {
                    "type_of_plan": {"type": "string", "description": "计划类型，如 月滚动计划_2026-01-30~2026-02-26"},
                    "work_type": {"type": "string", "description": "工程量类型：钢结构、混凝土、焊接 等"},
                    "scope": {"type": "string", "description": "分包商，如 施工九队。不填则全项目。"},
                    "location": {"type": "string", "description": "位置，如 ECU、PEL。不填则全场。"},
                },
                "required": ["type_of_plan", "work_type"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_progress_summary",
            "description": "查询项目累计进度（WF%）。维度与 facilities、activity_summary、GlobalFilter 一致，取值以系统实际数据为准。单维度走 cache，组合走实时。",
            "parameters": {
                "type": "object",
                "properties": {
                    "as_of_date": {"type": "string", "description": "截止日期。今天、昨天、本周、上周、2025-02-15 等。不填默认今天。"},
                    "dimension": {"type": "string", "description": "阶段（可选）：E/EN/设计、P/PR/采购、C/CT/施工。与 implement_phase 二选一。"},
                    "subproject": {"type": "string", "description": "子项目（facilities.subproject）。如 ECU、PEL、UIO。取值以系统为准。"},
                    "scope": {"type": "string", "description": "分包商（activity_summary.scope）。如 C01、C09。"},
                    "unit": {"type": "string", "description": "装置（facilities.unit）。如 EC1、EC2、PE1、PE2 等，取值以 facilities/activity_summary 为准。"},
                    "main_block": {"type": "string", "description": "主项（facilities.main_block）。取值形态为数字编号，如 12200、12401。取值以系统为准。"},
                    "block": {"type": "string", "description": "子项（facilities.block）。取值以系统为准。"},
                    "train": {"type": "string", "description": "开车阶段（facilities.train）。如 T0、T1、T2。取值以系统为准。"},
                    "quarter": {"type": "string", "description": "区块（facilities.quarter）。取值形态为 Q11、Q21 等。取值以系统为准。"},
                    "simple_block": {"type": "string", "description": "简化子项（facilities.simple_block）。取值以系统为准。"},
                    "implement_phase": {"type": "string", "description": "实施阶段（可选）。E/EN/设计、P/PR/采购、C/CT/施工。与 dimension 二选一。"},
                    "contract_phase": {"type": "string", "description": "合同阶段（可选）。Add.1、Add.2.1、Add.2.2、Add.3。"},
                    "breakdown_by": {"type": "string", "description": "按某维度拆分为「各个」明细（可选）。专业=discipline；子项=block；装置=unit；主项=main_block；子项目=subproject；分包商=scope。与其它筛选组合使用。"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_progress_period",
            "description": "查询某时间段内进度增量（WF%）。维度与 facilities、activity_summary、GlobalFilter 一致，取值以系统为准。",
            "parameters": {
                "type": "object",
                "properties": {
                    "date_range": {"type": "string", "description": "时间段。本周、上周、本月、上月、本季度 等。"},
                    "dimension": {"type": "string", "description": "阶段（可选）：E/EN/设计、P/PR/采购、C/CT/施工。"},
                    "subproject": {"type": "string", "description": "子项目（facilities.subproject）。如 ECU、PEL、UIO。"},
                    "scope": {"type": "string", "description": "分包商（activity_summary.scope）。如 C01、C09。"},
                    "unit": {"type": "string", "description": "装置（facilities.unit）。如 EC1、EC2、PE1、PE2 等。"},
                    "main_block": {"type": "string", "description": "主项（facilities.main_block）。取值形态为数字编号如 12200、12401。"},
                    "block": {"type": "string", "description": "子项（facilities.block）。"},
                    "train": {"type": "string", "description": "开车阶段（facilities.train）。如 T0、T1、T2。"},
                    "quarter": {"type": "string", "description": "区块（facilities.quarter）。取值形态为 Q11、Q21 等。"},
                    "simple_block": {"type": "string", "description": "简化子项（facilities.simple_block）。"},
                    "implement_phase": {"type": "string", "description": "实施阶段（可选）。E/EN/设计、P/PR/采购、C/CT/施工。"},
                    "contract_phase": {"type": "string", "description": "合同阶段（可选）。Add.1、Add.2.1、Add.2.2、Add.3。"},
                },
                "required": ["date_range"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_productivity",
            "description": "查询工效（劳动效率）。数据来自 productivity_cache / productivity_cache_wp。\n\n【带周期】当用户问「某时间到某时间的工效」时，传 date_range，返回：周期工效（不算辅助人力）、周期工效（算辅助人力）、累计工效及相对标准工效的差距。\n\n【无周期】当用户问「混凝土的工效」「钢结构工效」且未指定时间段时，不传 date_range，仅返回累计工效及相对标准工效的差距。\n\n【各分包商】当用户问「各个分包商的情况」「各分包商工效」「按分包商分解」时，传 group_by=scope 或 group_by=分包商，一次返回所有分包商的工效明细。\n\nwork_type 支持：混凝土、钢结构、焊接、土建、电仪、设备 等。scope=分包商；location=位置。",
            "parameters": {
                "type": "object",
                "properties": {
                    "date_range": {
                        "type": "string",
                        "description": "日期范围（可选）。带周期查询时必填。支持：本周、上周、上月、2025-01-01至2026-02-22 等。不填则仅查累计工效。",
                    },
                    "work_type": {
                        "type": "string",
                        "description": "工程量类型/专业，如 混凝土、钢结构、焊接、土建、电仪。不填则查全项目。",
                    },
                    "scope": {
                        "type": "string",
                        "description": "分包商，如 C01、施工九队。不填则全项目。",
                    },
                    "location": {
                        "type": "string",
                        "description": "位置，如 ECU、12510-01。支持模糊匹配，不填则全场。",
                    },
                    "group_by": {
                        "type": "string",
                        "description": "分组维度（可选）：scope/分包商、子项目/subproject、子项/block、装置/unit 等。不传则返回汇总。用户问「各分包商工效」「按子项目工效」时传对应 group_by。",
                    },
                },
                "required": [],
            },
        },
    },
]
