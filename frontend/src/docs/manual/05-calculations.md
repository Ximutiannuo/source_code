# 计算方法与数学公式详解

本系统严格遵循项目进度管理与赢得值（EV）核算标准。为了确保数据的透明性，现公布系统底层的核心数学模型。

---

## 1. 劳动效率 (Productivity) 核算逻辑

工效核算分为“周期性（Period）”与“开工累计（Cumulative）”，并区分是否分摊“非生产性辅助人力”。

### A. 基础定义
*   **$Q_{ach}$**：实际完成工程量（来自 VFACTDB）。
*   **$L_{total}$**：总投入人力（来自 MPDB，含直接工与辅助工）。
*   **$L_{prod}$**：生产性人力（关联了具体作业 Activity ID 且不属于 CO 工作包的人力）。
*   **$L_{non}$**：非生产性辅助人力（属于 CO01/CO03/CO04 工作包，如管理、后勤、辅助人员）。

### B. 实际工效计算式（Actual Productivity）

| 维度 | 算法 1：不含辅助人力 | 算法 2：含辅助人力 (w/ non-p) |
| :--- | :--- | :--- |
| **周期工效 (Period)** | $$P_{p} = \frac{Q_{period}}{L_{total\_period}}$$ | $$P_{p\_wp} = \frac{Q_{period}}{L_{weighted\_period}}$$ |
| **开累工效 (Cum)** | $$P_{c} = \frac{\sum Q}{\sum L_{total}}$$ | $$P_{c\_wp} = \frac{\sum Q}{\sum L_{weighted}}$$ |

**※ 关键：辅助人力分摊公式（Labor Weighted）**
系统采用“比例分摊法”将非生产性人力分配至各核算单元：

$$L_{weighted} = (L_{total} - L_{non}) + \left( \frac{L_{total}}{L_{prod\_global}} \times L_{non\_global} \right)$$

*注：当应用资源筛选时，系统会优先使用全局 $L_{prod\_global}$、$L_{non\_global}$ 计算分摊比例；按维度（如分包商、子项）分组时，也可按该维度内的生产性/非生产性人力采用同一公式形式计算 $L_{weighted}$。*

### C. 标准工效 (Weighted Norms)
用于衡量“理论上应该达到的效率”：

$$P_{standard} = \frac{\sum (Norm_{wp} \times L_{wp})}{\sum L_{total}}$$
*   $Norm_{wp}$：对应工作包的标准定额。
*   $L_{wp}$：该工作包实际投入的人力。

---

## 2. 施工权重 (Weight Factor) 核算逻辑

权重系统用于将不同计量单位的实物量（如 m³、Dia-inch）统一转化为“进度贡献值”。

### A. 预算权重因子 (Weight Factor)

$$WF = \frac{H_{calculated}}{H_{project\_total}} \times 254,137,500$$

其中：
*   **预算人工时 ($H_{calculated}$)** = 总工程量 × 劳动定额（对应系统字段 `norms_mp`）。
*   **项目总人工时 ($H_{project\_total}$)** = 该项目（Project）下所有作业预算人工时之和。
*   **254,137,500**：系统设定的固定权重基数（分配给施工阶段的总点数）。

### B. 赢得权重因子 (Actual Weight Factor)
反映当前实际完成量折算后的权重值：

$$AWF = \frac{H_{earned}}{H_{calculated}} \times 254,137,500$$

其中，**赢得人工时 ($H_{earned}$)** 在不同场景下采用如下口径：

*   **活动级（单作业）**：$H_{earned} = \dfrac{Q_{completed}}{Spe\_Mhrs} \times 10$。$Spe\_Mhrs$ 为作业定义的特殊折算系数（活动级），10 为工时转换常数。
*   **按日/工作包汇总（如 S 曲线、日报）**：系统使用 VFACTDB 的完成量（achieved）与工作包标准定额（`rsc_defines.norms`）折算：$\sum \dfrac{achieved}{norms} \times 10$，用于按日聚合的赢得人工时。

---

## 3. 施工进度 (Progress Rate) 核算逻辑

进度核算采用点数累加法，确保大作业和小作业对总进度的贡献互不干扰。

### 进度百分比计算（概念公式）

按活动汇总的进度百分比定义为：

$$Progress\% = \frac{\sum AWF}{\sum WF} \times 100\%$$

即：所有活动的赢得权重之和 ÷ 所有活动的预算权重之和。

### 仪表盘 S 曲线（按日聚合）

仪表盘中的计划/预测/实际进度曲线由**按日聚合**的数据计算，与上述活动级汇总在数据源上有所区别：

*   **计划进度**：按日累计 `budgeted_db`（计划工时/工程量）至当日，除以全量计划总值，再 ×100%。
*   **预测进度**：按日累计 `atcompletion_db`（预测完工工时/工程量）至当日，除以全量预测总值，再 ×100%。
*   **实际进度**：按日汇总 VFACTDB 折算的赢得人工时（achieved/norms×10），按项目总人工时与总权重比例折算到权重空间，加上 `owf_db` 的实际完成值（actual_units），得到每日“实际权重贡献”；累计后除以项目总权重（或总权重初始值）再 ×100%。即实际进度 =（折算赢得人工时 + OWF 实际值）的累计 / 总权重 ×100%。

*   **自动刷新机制**：系统定时重新运行上述逻辑，同步最新的日报数据与权重状态。
*   **组织资产价值**：每一次精准的 $L_{total}$ 填报，都会修正 $P_{actual}$ 与 $P_{standard}$ 的偏差，这些偏差数据将自动存入公司“工效经验数据库”，作为未来投标报价的底层核心资产。

---
*最后更新：2026-02*
