# 新增 AI 工具必读指南

本文档面向在项目中**新增或修改 AI 助手（Function Calling）工具**的开发人员，用于统一维度来源、参数描述与系统提示，避免错误示例和漏项。

---

## 一、核心原则

1. **工程量/完成量禁止跨单位加总**  
   不同工作包对应不同计量单位（如 DIN、M、M²、M³、T、EA、PKG 等），**禁止将不同工作包/不同单位的数量加总为一个「总量合计」或「完成比」**。工具返回与 AI 回复均须遵守：按工作包（或设施维度×工作包）分项列出，每项带本单位；仅同一 work_package（同一单位）内可汇总或算完成比。query_volume_control_summary 按主项/子项目等设施分组时，后端按 (设施, work_package) 分项返回并注明「单位不同不可跨工作包合计」。

2. **维度与系统一致**  
   所有涉及「设施 / 筛选维度」的工具，必须与 **facilities**、**activity_summary**、**GlobalFilter**、**ActivityListAdvanced** 使用的栏位一致，不得自创维度或编造取值。

3. **取值以数据表为准，且须写清取值形态**  
   参数描述中应注明数据来源，并写清**取值形态**（如 quarter 为 Q11、Q21；main_block 为 12200、12401 等数字编号；unit 为 EC1、PE1 等），避免不同维度形态不清导致 AI 误匹配。不要写与真实数据不符的示例。

4. **一次补全设施维度**  
   若某工具需要支持「按设施筛选」，应一次性支持 facilities 相关全部维度（subproject、scope、unit、main_block、block、train、quarter、simple_block 等），避免用户问到「子项」「开车阶段」时再零散追加，增加维护成本。

5. **发生用户反馈 AI 识别错误时，必须找到根本原因，禁止亡羊补牢式修改**  
   例如：用户反馈「C09在12200」被识别成 quarter（区块）导致无数据。**根本原因**是 quarter 与 main_block 的**取值形态**未在参数描述中写清——quarter 实际为 Q11、Q21 等，与 12200 形态完全不同，若描述清楚则不会混淆。正确做法是在**参数 description 中补全取值形态**（quarter：Q11、Q21；main_block：12200、12401），而非在系统提示或工具描述中堆砌「勿用 quarter」「12200 为主项」等补救语句，否则参数会越来越乱、难以维护。

6. **修改过程中若发现已存在的亡羊补牢式提示或代码，必须一并修改，从根本解决问题**  
   在新增或修改工具时，应主动排查系统提示、工具 description、工具返回值及后端逻辑中是否含有「勿…」「不要…」「切勿…」「禁止…」等补救式约束。若存在，应分析其对应的**根本原因**（如参数取值形态未写清、工具能力未支持某类问法、无数据时工具未返回可操作建议等），通过补全参数形态、增强工具能力、让工具返回诊断/可尝试建议等方式从根本解决，并删除或改写为正面表述，不得仅保留或新增补救语句。

7. **能复用则要复用，不新增重复工具或函数**  
   在能够复用现有工具（Function Calling 工具）或现有后端函数的情况下，**不要新增**工具或函数，以降低维护难度。新增需求应先检索：是否已有工具/函数能通过扩展参数或组合调用满足；是否仅需在现有工具中增加分支或参数即可覆盖。若存在逻辑雷同的多个函数（如相同筛选条件、相同数据源仅返回形态不同），应合并为单一实现，由调用方按需取列表或子查询等。

8. **查摆问题时把现象抽象为原理**  
   用户反馈的问题（如「某格式解析失败」「某场景返回错误」）是**现象**，修改时应抽象为**原理**，而非针对该现象罗列补救规则。例如：用户说「2026.2.20-2.26」未被识别 → 应抽象为「参数须与用户指定内容一致；后端应容忍用户常用的各类日期/周期写法」；在文档和提示中写原理（参数对齐用户意图、格式宽容解析），而非枚举「2026.2.20-2.26 时传该范围」等具体格式。现象会变，原理不变。

---


## 二、维度与数据表对应关系

| 维度（中文） | 英文/列名 | 主要来源 | 说明 |
|-------------|-----------|----------|------|
| 子项目 | subproject | facilities.subproject / activity_summary.subproject | 如 ECU、PEL、UIO |
| 分包商 | scope | activity_summary.scope | 如 C01、C09 |
| 装置 | unit | facilities.unit / activity_summary.unit | 如 **EC1、EC2、PE1、PE2** 等，以系统为准 |
| 主项 | main_block | facilities.main_block / activity_summary.main_block | 取值形态：数字编号，如 12200、12401。以系统为准。 |
| 子项 | block | facilities.block / activity_summary.block | 以系统为准 |
| 开车阶段 | train | facilities.train / activity_summary.train | 如 T0、T1、T2 |
| 区块 | quarter | facilities.quarter / activity_summary.quarter | **取值形态：Q11、Q21 等**。以系统为准。 |
| 简化子项 | simple_block | facilities.simple_block / activity_summary.simple_block | 以系统为准 |
| 专业 | discipline | activity_summary.discipline | 与 rsc_defines/work_package 相关 |
| 实施阶段 | implement_phase | activity_summary | EN/设计、PR/采购、CT/施工 |
| 合同阶段 | contract_phase | activity_summary | Add.1、Add.2.1、Add.2.2、Add.3 |
| 工作包 | work_package | activity_summary / rsc_defines | 工程量类型，rsc_defines 有定义 |

- **facilities** 表：主项子项清单，含 block、subproject、train、unit、main_block、quarter、simple_block 等。
- **activity_summary** 表：作业汇总，与 facilities 维度对齐，另含 scope、discipline、implement_phase、contract_phase、work_package 等。
- **rsc_defines** 表：工作包资源定义，含 work_package、uom、norms、cn_wk_report 等，用于工程量/专业相关描述与单位。

级联筛选选项可从 **facility_filter API**（或 activity_summary/facilities 查询）获取，工具描述中应引导「取值以系统为准」而非写死错误示例。  
**取值形态**写清后，quarter（Q11、Q21）与 main_block（12200、12401）从形态上即可区分，不会混淆。

---

## 三、新增/修改工具时的检查清单

### 3.1 工具定义（ai_assistant_tools.py）

- [ ] **description**  
  - 若涉及设施/筛选维度，写明「维度与 facilities、activity_summary、GlobalFilter 一致，取值以系统实际数据为准」或等价表述。
- [ ] **parameters**  
  - 设施类参数（subproject、scope、unit、main_block、block、train、quarter、simple_block）需**一次配齐**，避免只写 unit 不写 block，日后又补 block。
  - 每个参数 description 注明数据来源与**取值形态**（如 quarter 为 Q11、Q21；main_block 为 12200、12401 等数字），避免不同维度形态不清导致 AI 误匹配。
  - 不要写与真实数据不符的示例。

### 3.2 后端实现（ai_assistant_service.py）

- [ ] **复用优先**  
  - 先检索是否已有可复用函数（如 _get_scopes、_parse_date_range、_location_filter、_get_work_packages、_get_ordered_wp_info、_build_progress_filters 等）；相同数据源或相同筛选逻辑只保留一处实现，调用方按需取不同形态（列表/子查询/字符串等）。
- [ ] **筛选/过滤逻辑**  
  - 使用与 `s_curve_filter_utils.build_act_where_sql` 一致的维度列名（subproject、train、unit、simple_block、main_block、block、quarter、scope、discipline、implement_phase、contract_phase 等）。
- [ ] **构建 filters**  
  - 若有集中构建 filters 的函数（如 `_build_progress_filters`），新维度应同时加入该函数与工具入参，保证「工具参数 ↔ 后端 filters」一一对应。
- [ ] **breakdown_by / group_by**  
  - 若支持「各个 X」拆分，breakdown_by 或 group_by 的取值与 PROGRESS_BREAKDOWN_COL / _resolve_group_by 等映射一致，并与 facilities 维度命名一致。

### 3.3 系统提示（AI_ASSISTANT_SYSTEM_PROMPT）

- [ ] **工具路由与参数说明**  
  - 写明该工具维度与 facilities/activity_summary/GlobalFilter 一致；装置(unit) 等易错处明确「如 EC1、EC2、PE1、PE2，以系统为准」；要求 AI 仅使用工具返回或参数说明中的取值与建议，不编造取值或原因。
- [ ] **无数据时的行为**  
  - 若工具会返回「可尝试：…」或诊断建议，系统提示中要求 AI 仅依据工具返回回复，不编造「可能不属于」「可能未录入」等理由。

---

## 四、文件与引用位置

| 内容 | 文件路径 |
|------|----------|
| 工具定义（name、description、parameters） | `backend/app/services/ai_assistant_tools.py` |
| 执行逻辑、filters 构建、breakdown 映射 | `backend/app/services/ai_assistant_service.py` |
| 维度列名、filter_key、WHERE 构建 | `backend/app/services/s_curve_filter_utils.py` |
| 设施表结构 | `backend/app/models/facility.py` |
| 作业汇总表结构 | `backend/app/models/activity_summary.py` |
| 工作包/资源定义 | `backend/app/models/rsc.py`（rsc_defines） |
| 级联筛选 API | `backend/app/api/facility_filter.py` |

---

## 五、已有工具与查询范围一览

以下为当前 AI 助手已接入的工具、数据来源、参数与系统提示中的路由说明。新增或修改工具时请先对照本表，避免重复或冲突。

| 工具名 | 查询范围 / 数据来源 | 必填参数 | 可选参数 | 系统提示中的路由/说明 |
|--------|---------------------|----------|----------|------------------------|
| **query_achieved** | 实际完成量，来自 **VFACTDB**（与滚动计划无关） | date_range | work_type、scope、location、group_by | 「完成了多少」「实际完成」「完成情况」→ 用本工具；date_range 未指定时传 全周期（累计）；group_by=空/scope/子项目/专业；与工程量搭配时先 query_volume_control_summary 再本工具。 |
| **query_manpower** | 人力投入，来自 **MPDB**（与工程量工具维度一致） | date | scope、location、work_type、manpower_type、group_by | 人力、工日、人数；group_by=专业/scope/子项 等。 |
| **query_volume_control_summary** | 工程量控制汇总：总量、到货、工作面、施工完成、验收、竣工、收款；来自 **VolumeControl*** + **activity_summary** | 无 | location、work_type、scope、group_by、phase | 某分包商工程量总量/各工作包 → scope + work_type 不传或全部；group_by 支持工作包、主项、子项目、装置、子项、开车阶段、区块；「本周实际完成」用 query_achieved。 |
| **list_ahead_plan_types** | 列出 **ahead_plan** 表中实际存在的 type_of_plan | 无 | 无 | 用户要查「计划完成」「计划vs实际」且未指定计划类型时先调用，再根据返回选 type_of_plan。 |
| **query_ahead_plan** | 滚动计划计划量/实际量，来自 **ahead_plan** 及相关实际数据 | type_of_plan、week | work_type、scope、location、include_actual、group_by | 「计划完成」「计划vs实际」→ 本工具。week：参数须与用户指定周期一致，用户指定了某周期（无论以何种日期写法）则传该周期，不得擅自用整个周期替代；后端应容忍用户常用的各类日期/周期写法并解析。group_by：用户明确问「各X」时传对应维度；仅问「计划量vs完成量」未提「各」时传空。plan 与 actual 均按 scope 过滤。 |
| **query_ahead_plan_submitters** | 滚动计划提交人/审批人/批准人，来自 **ahead_plan** | type_of_plan、work_type | scope、location | 「谁提交/审批/批准」类问题。 |
| **query_progress_summary** | 项目累计进度（WF%），单维走 cache、组合走实时 | 无 | as_of_date、dimension/implement_phase、subproject、scope、unit、main_block、block、train、quarter、simple_block、contract_phase、breakdown_by | 累计进度、E/P/C 阶段；维度与 facilities/activity_summary 一致；「各专业/各子项/各装置」→ breakdown_by。 |
| **query_progress_period** | 某时间段内进度增量（WF%） | date_range | dimension、subproject、scope、unit、main_block、block、train、quarter、simple_block、implement_phase、contract_phase | 本周/上月进度增量等。 |
| **query_productivity** | 工效（劳动效率），来自 **productivity_cache** / **productivity_cache_wp** | 无 | date_range、work_type、scope、location、group_by | 带周期→传 date_range 得周期+累计工效；无周期→仅累计工效；各分包商→group_by=scope。 |

### 5.1 参数与维度速查

- **scope**：所有带 scope 的工具，调用后会在返回结果前自动注入「【查询条件】分包商：{用户输入}（解析为 Cxx）」，回复时以该解析结果为准。
- **date_range / date / week**：支持相对词（本周、上周、全周期、累计）及日期范围；周定义为周五～周四。后端应容忍用户常用的各类日期/周期写法（含非规范写法），解析为对应周期。
- **group_by / breakdown_by**：  
  - **设施维度**：与 facilities 一致。子项=block（取值以 facilities.block/activity_summary.block 为准）；区块=quarter（**取值形态 Q11、Q21**，与 main_block 数字编号如 12200、1301 等形态不同）。写清取值形态后，按「子项」分组传 子项/block，按「区块」筛选或分组传 区块/quarter。  
  - **工程量/专业维度**：与 **rsc_defines**、**activity_summary.work_package** 一致。group_by=专业/work_package 时，work_package 取值、单位(uom)、中文名(cn_wk_report) 以 **rsc_defines** 为准；专业为 work_package 前缀归类（见 ai_assistant_service 中 DISCIPLINE_MAPPING），与 rsc_defines 中的 work_package 对应。输出时同专业、同 resource_id_name 的工作包应先汇总再分项。
- **设施维度**：subproject、unit、main_block、block、train、quarter、simple_block 的取值形态见第二节表格。

### 5.2 提示词与定义位置

| 内容 | 位置 |
|------|------|
| 工具 name/description/parameters | `ai_assistant_tools.py` 的 TOOLS |
| 工具路由、参数约定、输出规范 | `ai_assistant_service.py` 的 AI_ASSISTANT_SYSTEM_PROMPT（「二、参数概念」「三、工具路由」「四、输出规范」） |
| scope 解析与结果注入 | `ai_assistant_service.py`：SCOPE_MAPPING、_get_scopes；chat_with_tools 中对带 scope 工具在 result 前拼接「查询条件」 |

---

## 六、常见错误与纠正

| 错误 | 纠正 |
|------|------|
| 将不同工作包/不同单位（DIN、M、M²、T 等）的工程量或完成量加总为「总量合计」或「完成比」 | **原理**：每个 work_package 对应一种计量单位，不同单位不可相加。工具按主项/子项目分组时须按 (设施, work_package) 分项返回、每项带单位，且不输出跨工作包合计；AI 回复须分工作包/分单位说明，仅同工作包内可汇总或算完成比。 |
| 参数描述未写取值形态，导致 AI 将 12200 误匹配到 quarter | **根本原因**：quarter 取值为 Q11、Q21，与 12200 形态不同；若在参数 description 中写清「quarter：Q11、Q21」「main_block：12200、12401」，即可从源头区分。禁止在系统提示或描述中堆砌「勿用 quarter」等亡羊补牢语句。 |
| unit 描述写「如 12200、12510」 | 改为「装置（facilities.unit）。如 EC1、EC2、PE1、PE2 等，取值以 facilities/activity_summary 为准。」 |
| 只加 unit、main_block，未加 block/train/quarter | 一次性补全 facilities 相关维度：block、train、quarter、simple_block。 |
| 无数据时 AI 回复「可能不属于」「可能未录入」 | 工具返回中带「可尝试：…」或诊断建议；系统提示要求 AI 仅依据工具返回回复，不编造原因。 |
| 新工具自创维度名或与 GlobalFilter 不一致 | 严格使用 s_curve_filter_utils 与 facilities/activity_summary 中的列名与语义。 |
| **发现已有亡羊补牢式提示或代码** | **修改时必须一并排查并从根本上解决**（补全参数形态、增强工具能力、工具返回可尝试/诊断等），删除或改写「勿…」「不要…」「切勿…」类补救语句，不得仅保留或新增此类约束。 |
| **新增与现有逻辑雷同的工具或函数** | 能复用则要复用：先检索现有工具/函数是否可扩展或组合满足需求；若存在仅返回形态不同（如列表 vs 子查询）的重复实现，合并为单一实现。 |

---

新增或修改 AI 工具时，请按本指南核对维度来源、参数描述与系统提示，保证与 facilities、activity_summary、GlobalFilter 一套系统一致，并避免错误示例和漏项。**先查阅第五节已有工具一览，避免重复；凡有修改，均须检查是否存在亡羊补牢式表述并予根除；且优先复用现有工具与函数，不新增重复实现。**
