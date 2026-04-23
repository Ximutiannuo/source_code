import type { PermissionScope, Role } from '../services/permissionService'

export type ResourceActionConfig = {
  value: string
  label: string
  color?: string
}

export type ResourceTypeConfig = {
  label: string
  description: string
  category: '制造协同' | '平台治理' | '遗留工程'
  legacy?: boolean
  actions: ResourceActionConfig[]
}

export type ManufacturingRoleTemplate = {
  key: string
  name: string
  department: string
  color: string
  summary: string
  presetDescription: string
  responsibilities: string[]
  suggestedModules: string[]
  keywords: string[]
}

export type ManufacturingDepartmentGuide = {
  name: string
  mission: string
  roles: string[]
}

export const RESOURCE_TYPE_CONFIG: Record<string, ResourceTypeConfig> = {
  facility: {
    label: '设备与工装台账',
    description: '设备、工装、工位与基础设施主数据维护，支撑产能评估、保养与稼动分析。',
    category: '制造协同',
    actions: [
      { value: 'read', label: '查看', color: 'blue' },
      { value: 'create', label: '新增', color: 'green' },
      { value: 'update', label: '维护', color: 'orange' },
      { value: 'delete', label: '删除', color: 'red' },
    ],
  },
  welding_data: {
    label: '焊接工艺接口',
    description: '焊接工艺、焊缝台账、外部系统接口与同步配置管理。',
    category: '制造协同',
    actions: [
      { value: 'read', label: '查看', color: 'blue' },
      { value: 'config:read', label: '配置查看', color: 'cyan' },
      { value: 'config:create', label: '配置新增', color: 'green' },
      { value: 'config:update', label: '配置维护', color: 'orange' },
      { value: 'config:delete', label: '配置删除', color: 'red' },
      { value: 'sync', label: '执行同步', color: 'purple' },
    ],
  },
  user: {
    label: '账号主数据',
    description: '平台账号、组织归属、岗位职责与启停状态管理。',
    category: '平台治理',
    actions: [
      { value: 'read', label: '查看', color: 'blue' },
      { value: 'create', label: '新增', color: 'green' },
      { value: 'update', label: '维护', color: 'orange' },
      { value: 'delete', label: '删除', color: 'red' },
    ],
  },
  permission: {
    label: '角色与权限',
    description: '角色授权、岗位分权与数据访问边界管理。',
    category: '平台治理',
    actions: [
      { value: 'read', label: '查看', color: 'blue' },
      { value: 'assign', label: '授权', color: 'cyan' },
      { value: 'revoke', label: '撤销', color: 'magenta' },
    ],
  },
  exhibition_report: {
    label: '现场报表（遗留）',
    description: '原工程建设场景的报表权限，建议逐步迁移至制造经营看板。',
    category: '遗留工程',
    legacy: true,
    actions: [
      { value: 'read', label: '查看', color: 'blue' },
      { value: 'create', label: '新增', color: 'green' },
      { value: 'update', label: '维护', color: 'orange' },
      { value: 'delete', label: '删除', color: 'red' },
    ],
  },
  planning: {
    label: '遗留计划排程',
    description: '旧工程排程、前置计划与任务推进模块权限，仅用于兼容历史模块。',
    category: '遗留工程',
    legacy: true,
    actions: [
      { value: 'read', label: '查看', color: 'blue' },
      { value: 'create', label: '新增', color: 'green' },
      { value: 'update', label: '维护', color: 'orange' },
      { value: 'delete', label: '删除', color: 'red' },
    ],
  },
  construction_volume: {
    label: '遗留施工工程量',
    description: '原工程施工工程量管理权限，保留用于旧口径数据穿透查询。',
    category: '遗留工程',
    legacy: true,
    actions: [
      { value: 'read', label: '查看', color: 'blue' },
      { value: 'create', label: '新增', color: 'green' },
      { value: 'update', label: '维护', color: 'orange' },
      { value: 'delete', label: '删除', color: 'red' },
    ],
  },
  acceptance_volume: {
    label: '遗留验收工程量',
    description: '原工程验收工程量权限，保留用于历史验工口径核查。',
    category: '遗留工程',
    legacy: true,
    actions: [
      { value: 'read', label: '查看', color: 'blue' },
      { value: 'create', label: '新增', color: 'green' },
      { value: 'update', label: '维护', color: 'orange' },
      { value: 'delete', label: '删除', color: 'red' },
    ],
  },
  abd_volume: {
    label: '遗留 ABD 工程量',
    description: '原 ABD 工程量管理权限，保留用于旧数据接口兼容。',
    category: '遗留工程',
    legacy: true,
    actions: [
      { value: 'read', label: '查看', color: 'blue' },
      { value: 'create', label: '新增', color: 'green' },
      { value: 'update', label: '维护', color: 'orange' },
      { value: 'delete', label: '删除', color: 'red' },
    ],
  },
  ovr_volume: {
    label: '遗留 OVR 工程量',
    description: '原 OVR 工程量管理权限，保留用于旧核算口径兼容。',
    category: '遗留工程',
    legacy: true,
    actions: [
      { value: 'read', label: '查看', color: 'blue' },
      { value: 'create', label: '新增', color: 'green' },
      { value: 'update', label: '维护', color: 'orange' },
      { value: 'delete', label: '删除', color: 'red' },
    ],
  },
  daily_report: {
    label: '遗留日报管理',
    description: '原工程日报、人力日报与现场填报模块权限。',
    category: '遗留工程',
    legacy: true,
    actions: [
      { value: 'read', label: '查看', color: 'blue' },
      { value: 'create', label: '新增', color: 'green' },
      { value: 'update', label: '维护', color: 'orange' },
      { value: 'delete', label: '删除', color: 'red' },
    ],
  },
  inspection_db: {
    label: '遗留验收记录',
    description: '原工程 RFI/验收记录模块权限，保留用于历史质量资料查询。',
    category: '遗留工程',
    legacy: true,
    actions: [
      { value: 'read', label: '查看', color: 'blue' },
      { value: 'create', label: '新增', color: 'green' },
      { value: 'update', label: '维护', color: 'orange' },
      { value: 'delete', label: '删除', color: 'red' },
    ],
  },
  acceptance_procedure: {
    label: '遗留验收程序',
    description: '原工程 ITP/验收程序资料查看权限，保留用于旧项目交付资料。',
    category: '遗留工程',
    legacy: true,
    actions: [
      { value: 'read', label: '查看', color: 'blue' },
    ],
  },
  p6_database: {
    label: '遗留 P6 主数据',
    description: '原 Primavera P6/EPS/WBS/资源/工作包等主数据权限。',
    category: '遗留工程',
    legacy: true,
    actions: [
      { value: 'read', label: '查看', color: 'blue' },
      { value: 'update', label: '维护', color: 'orange' },
      { value: 'sync', label: '执行同步', color: 'purple' },
    ],
  },
  p6_sync: {
    label: '遗留 P6 同步',
    description: '原 P6 集成与同步配置权限，保留用于存量工程系统衔接。',
    category: '遗留工程',
    legacy: true,
    actions: [
      { value: 'read', label: '查看', color: 'blue' },
      { value: 'update', label: '维护', color: 'orange' },
      { value: 'delete', label: '删除', color: 'red' },
      { value: 'sync', label: '执行同步', color: 'purple' },
    ],
  },
}

export const RESOURCE_CATEGORY_ORDER: ResourceTypeConfig['category'][] = ['制造协同', '平台治理']

export const MANUFACTURING_ROLE_TEMPLATES: ManufacturingRoleTemplate[] = [
  {
    key: 'sales-order',
    name: '销售与订单经理',
    department: '营销与项目交付',
    color: 'blue',
    summary: '负责订单评审、交期承诺、项目里程碑与客户变更闭环。',
    presetDescription:
      '面向非标装备订单全过程，负责客户需求澄清、订单评审、交期承诺、项目节点跟踪与交付协同。',
    responsibilities: ['订单评审', '交期承诺', '项目里程碑', '客户变更'],
    suggestedModules: ['账号主数据', '角色与权限'],
    keywords: ['销售', '订单', '交付', '项目经理', '客户'],
  },
  {
    key: 'design',
    name: '研发设计工程师',
    department: '研发设计部',
    color: 'geekblue',
    summary: '负责图纸、EBOM、设计变更与设计资料下发。',
    presetDescription:
      '负责非标设备方案设计、图纸输出、EBOM 管理、设计资料归档以及 ECN 变更协同。',
    responsibilities: ['图纸管理', 'EBOM', '设计变更', '资料归档'],
    suggestedModules: ['焊接工艺接口'],
    keywords: ['设计', '研发', '图纸', '研发工程师', '结构'],
  },
  {
    key: 'process',
    name: '工艺工程师',
    department: '工艺与制造工程',
    color: 'cyan',
    summary: '负责 PBOM、工艺路线、工时定额与工装工位标准。',
    presetDescription:
      '负责 EBOM 转 PBOM、工艺路线编制、工时定额维护、工装夹具需求与关键工序控制。',
    responsibilities: ['PBOM', '工艺路线', '工时定额', '工装需求'],
    suggestedModules: ['设备与工装台账', '焊接工艺接口'],
    keywords: ['工艺', '制造工程', '工艺工程师', 'PBOM', '定额'],
  },
  {
    key: 'planning',
    name: '生产计划员',
    department: '计划与供应链',
    color: 'purple',
    summary: '负责 APS 排产、齐套分析、工单下发与异常插单协调。',
    presetDescription:
      '负责产能平衡、APS 排产、工单优先级调整、物料齐套检查和关键设备负荷协调。',
    responsibilities: ['APS 排产', '齐套分析', '工单下发', '插单协调'],
    suggestedModules: ['设备与工装台账'],
    keywords: ['计划', '排产', 'PMC', '调度', '生产计划'],
  },
  {
    key: 'procurement',
    name: '采购工程师',
    department: '计划与供应链',
    color: 'orange',
    summary: '负责 MRP 采购执行、供应商跟催与到料风险预警。',
    presetDescription:
      '负责依据 MRP 建议执行采购、交期跟催、外协协同、短缺预警与替代料协商。',
    responsibilities: ['MRP 执行', '供应商协同', '到料跟催', '短缺预警'],
    suggestedModules: ['账号主数据'],
    keywords: ['采购', '供应链', '供应商', '外协', '物控'],
  },
  {
    key: 'workshop',
    name: '车间主任',
    department: '生产制造部',
    color: 'green',
    summary: '负责班组节拍、工位报工、WIP 控制与异常升级。',
    presetDescription:
      '负责车间作业计划执行、工位负荷平衡、在制品控制、报工审核和制造异常闭环。',
    responsibilities: ['班组节拍', '工位报工', 'WIP 管控', '异常升级'],
    suggestedModules: ['设备与工装台账'],
    keywords: ['车间', '主任', '班组', '制造', '生产主管'],
  },
  {
    key: 'operator',
    name: '工位操作员',
    department: '生产制造部',
    color: 'lime',
    summary: '负责扫码报工、工艺执行、首件确认与过程自检。',
    presetDescription:
      '负责按工艺卡执行作业、扫码报工、首件确认、过程自检以及异常及时上报。',
    responsibilities: ['扫码报工', '工艺执行', '首件确认', '过程自检'],
    suggestedModules: ['设备与工装台账'],
    keywords: ['操作员', '工位', '报工', '班组长', '技工'],
  },
  {
    key: 'quality',
    name: '质量工程师',
    department: '质量管理部',
    color: 'magenta',
    summary: '负责 IQC/IPQC/FQC、质量追溯与不合格闭环。',
    presetDescription:
      '负责来料、过程、完工质量控制，建立可追溯质量记录，推动 NCR/8D 闭环和放行管理。',
    responsibilities: ['IQC/IPQC/FQC', '质量追溯', 'NCR/8D', '放行管理'],
    suggestedModules: ['焊接工艺接口', '遗留验收记录'],
    keywords: ['质量', '检验', 'IQC', 'IPQC', 'FQC', 'QE', 'QA'],
  },
  {
    key: 'equipment',
    name: '设备维修工程师',
    department: '设备动力部',
    color: 'volcano',
    summary: '负责预防性维护、点检保养、停机分析与备件协同。',
    presetDescription:
      '负责设备台账、点检保养计划、故障分析、维修闭环和关键备件状态管理。',
    responsibilities: ['预防性维护', '点检保养', '停机分析', '备件协同'],
    suggestedModules: ['设备与工装台账'],
    keywords: ['设备', '维修', '保全', '机修', '点检'],
  },
  {
    key: 'cost',
    name: '成本会计',
    department: '财务成本部',
    color: 'gold',
    summary: '负责订单料工费归集、在制核算与项目毛利分析。',
    presetDescription:
      '负责订单级料工费归集、在制品核算、成本偏差分析和项目毛利复盘，为经营决策提供依据。',
    responsibilities: ['料工费归集', '在制核算', '成本偏差', '毛利分析'],
    suggestedModules: ['账号主数据', '角色与权限'],
    keywords: ['成本', '财务', '会计', '毛利', '核算'],
  },
]

export const MANUFACTURING_DEPARTMENT_GUIDE: ManufacturingDepartmentGuide[] = [
  {
    name: '营销与项目交付',
    mission: '承接客户需求、订单评审、项目里程碑与交付窗口。',
    roles: ['销售与订单经理'],
  },
  {
    name: '研发设计部',
    mission: '负责方案设计、图纸输出、EBOM 与设计变更控制。',
    roles: ['研发设计工程师'],
  },
  {
    name: '工艺与制造工程',
    mission: '负责 PBOM、工艺路线、工时定额与工装标准。',
    roles: ['工艺工程师'],
  },
  {
    name: '计划与供应链',
    mission: '负责 APS 排产、MRP 采购建议、供应商协同与齐套。',
    roles: ['生产计划员', '采购工程师'],
  },
  {
    name: '生产制造部',
    mission: '负责工单执行、工位报工、WIP 控制与现场交付。',
    roles: ['车间主任', '工位操作员'],
  },
  {
    name: '质量管理部',
    mission: '负责 IQC/IPQC/FQC、追溯放行与异常闭环。',
    roles: ['质量工程师'],
  },
  {
    name: '设备动力部',
    mission: '负责稼动率提升、预防性维护与停机治理。',
    roles: ['设备维修工程师'],
  },
  {
    name: '财务成本部',
    mission: '负责订单成本、WIP、毛利与经营复盘。',
    roles: ['成本会计'],
  },
]

const DEFAULT_RESOURCE_CONFIG: ResourceTypeConfig = {
  label: '未归类模块',
  description: '该权限资源尚未配置业务语义，可按实际业务继续补充。',
  category: '平台治理',
  actions: [],
}

const LEGACY_SCOPE_LABELS: Array<{ key: keyof PermissionScope; label: string; color: string }> = [
  { key: 'scope', label: '遗留 Scope', color: 'blue' },
  { key: 'project', label: '遗留项目', color: 'gold' },
  { key: 'subproject', label: '遗留子项', color: 'cyan' },
  { key: 'block', label: '遗留区块', color: 'green' },
  { key: 'work_package', label: '遗留工作包', color: 'purple' },
  { key: 'train', label: '遗留线别', color: 'geekblue' },
  { key: 'unit', label: '遗留单元', color: 'orange' },
  { key: 'main_block', label: '遗留主区块', color: 'volcano' },
  { key: 'quarter', label: '遗留季度', color: 'magenta' },
  { key: 'simple_block', label: '遗留简化区块', color: 'lime' },
  { key: 'discipline', label: '遗留专业', color: 'cyan' },
  { key: 'resource_id', label: '资源 ID', color: 'default' },
]

export const getResourceTypeConfig = (resourceType: string): ResourceTypeConfig => {
  return RESOURCE_TYPE_CONFIG[resourceType] || {
    ...DEFAULT_RESOURCE_CONFIG,
    label: resourceType,
  }
}

export const findRoleTemplate = (roleLike: Pick<Role, 'name' | 'description'> | { name?: string; description?: string }) => {
  const source = `${roleLike.name || ''} ${roleLike.description || ''}`.toLowerCase()
  return MANUFACTURING_ROLE_TEMPLATES.find(template =>
    template.keywords.some(keyword => source.includes(keyword.toLowerCase()))
  )
}

const normalizeScopeValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(', ')
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
      .join(', ')
  }
  if (typeof value === 'number') {
    return String(value)
  }
  return ''
}

export const getPermissionScopeEntries = (scope?: PermissionScope) => {
  if (!scope) {
    return []
  }

  return LEGACY_SCOPE_LABELS
    .map(item => ({
      ...item,
      value: normalizeScopeValue(scope[item.key]),
    }))
    .filter(item => item.value)
}
