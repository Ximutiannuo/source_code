import { useState, useEffect, useLayoutEffect, useContext, useMemo, useCallback, useRef } from 'react'
import { 
  Select, Button, Space, App, 
  Checkbox, Modal, Row, Col,
  Divider, Input, InputNumber, List, Popconfirm, Table, Upload, Tag, Progress
} from 'antd'
import { formatQuantity } from '../utils/formatNumber'
import { 
  SettingOutlined, 
  GroupOutlined,
  EyeOutlined, 
  DeleteOutlined, SaveOutlined,
  ExpandOutlined, CompressOutlined,
  CaretRightOutlined, CaretDownOutlined,
  DownloadOutlined, UploadOutlined, CloudUploadOutlined,
  PlusOutlined,
  MenuOutlined
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { activityService, type Activity } from '../services/activityService'
import { GlobalFilterContext } from '../components/layout/MainLayout'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { rscService } from '../services/rscService'
import { DEFAULT_TASK_COLORS, type TaskLevelColors } from '../components/gantt/GanttChart'
import { dailyReportManagementService, type DailyReportMgmtWorkStepValue } from '../services/dailyReportManagementService'
import { workstepService, type WorkStepDefine } from '../services/workstepService'
import { reportService } from '../services/reportService'
import type { InspectionDBResponse } from '../types/report'
import { logger } from '../utils/logger'
import InspectionDBModal from '../components/reports/InspectionDBModal'
import InspectionDBListDrawer from '../components/reports/InspectionDBListDrawer'
import LegacyModuleBanner from '../components/common/LegacyModuleBanner'

// P6经典配色方案（与GanttChart保持一致）
const TASK_COLORS: TaskLevelColors = DEFAULT_TASK_COLORS

// AntD 的类型声明未暴露 rc-table VirtualTable 的 listItemHeight，但运行时会透传到 rc-table。
// 这里用 any 包一层，允许我们把虚拟列表行高锁定为 22（与计划管理一致）。
const AntdTableAny: any = Table

// 将RGB颜色转换为浅色背景（与GanttChart保持一致：85%白色 + 15%原色）
const getGroupRowBackgroundColor = (level: number): string => {
  const colors = [
    TASK_COLORS.level0, // LEVEL 1
    TASK_COLORS.level1, // LEVEL 2
    TASK_COLORS.level2, // LEVEL 3
    TASK_COLORS.level3, // LEVEL 4
    TASK_COLORS.level4, // LEVEL 5
    TASK_COLORS.level5, // LEVEL 6
    TASK_COLORS.level6, // LEVEL 7
    TASK_COLORS.level7, // LEVEL 8
    TASK_COLORS.level8, // LEVEL 9
  ]
  const colorIndex = Math.min(level, colors.length - 1)
  const baseColor = colors[colorIndex]
  
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null
  }
  
  const rgb = hexToRgb(baseColor)
  if (!rgb) return '#f0f2f5' // 默认浅灰色
  
  // 与白色混合（85%白色 + 15%原色），得到浅色背景
  const lightR = Math.round(rgb.r * 0.15 + 255 * 0.85)
  const lightG = Math.round(rgb.g * 0.15 + 255 * 0.85)
  const lightB = Math.round(rgb.b * 0.15 + 255 * 0.85)
  
  return `rgb(${lightR}, ${lightG}, ${lightB})`
}

// 获取分组行的左侧竖条颜色（使用原始颜色）
const getGroupLeftBarColor = (level: number): string => {
  const colors = [
    TASK_COLORS.level0, // LEVEL 1
    TASK_COLORS.level1, // LEVEL 2
    TASK_COLORS.level2, // LEVEL 3
    TASK_COLORS.level3, // LEVEL 4
    TASK_COLORS.level4, // LEVEL 5
    TASK_COLORS.level5, // LEVEL 6
    TASK_COLORS.level6, // LEVEL 7
    TASK_COLORS.level7, // LEVEL 8
    TASK_COLORS.level8, // LEVEL 9
  ]
  return colors[Math.min(level, colors.length - 1)]
}

// 可用的栏位定义
const AVAILABLE_COLUMNS = [
  { key: 'status', title: '状态', width: 60, align: 'center' as const, fixed: 'left' as const },
  { key: 'activity_id', title: '作业代码', width: 150, fixed: 'left' as const },
  { key: 'title', title: '作业描述', width: 300 },
  // 日报填报字段（默认：今日MP + 昨日VFACT）
  { key: 'mp_manpower', title: '人力', width: 120, align: 'center' as const, fixed: 'right' as const },
  { key: 'mp_machinery', title: '机械', width: 120, align: 'center' as const, fixed: 'right' as const },
  { key: 'mp_remarks', title: '备注', width: 150, align: 'left' as const, fixed: 'right' as const },
  { key: 'vfact_achieved', title: '昨日完成量', width: 140, align: 'center' as const, fixed: 'right' as const },
  { key: 'inspection_add', title: '验收', width: 80, align: 'center' as const, fixed: 'right' as const },
  { key: 'wbs_code', title: 'WBS代码', width: 150 },
  { key: 'block', title: '子项', width: 120 },
  { key: 'discipline', title: '专业', width: 100 },
  { key: 'work_package', title: '工作包', width: 120 },
  { key: 'scope', title: '分包商', width: 120 },
  { key: 'implement_phase', title: '执行阶段', width: 100 },
  { key: 'project', title: '项目', width: 120 },
  { key: 'subproject', title: '子项目', width: 120 },
  { key: 'train', title: '开车阶段', width: 100 },
  { key: 'unit', title: '装置', width: 100 },
  { key: 'main_block', title: '主项', width: 120 },
  { key: 'quarter', title: '区块', width: 120 },
  { key: 'key_qty', title: '总量', width: 120, align: 'center' as const },
  { key: 'uom', title: '计量单位', width: 100 },
  { key: 'calculated_mhrs', title: '预算人工时', width: 120, align: 'center' as const },
  { key: 'weight_factor', title: '权重', width: 120, align: 'center' as const },
  { key: 'actual_weight_factor', title: '赢得权重', width: 120, align: 'center' as const },
  { key: 'start_date', title: '开始日期', width: 120 },
  { key: 'finish_date', title: '结束日期', width: 120 },
  { key: 'baseline1_start_date', title: 'BL1开始日期', width: 120 },
  { key: 'baseline1_finish_date', title: 'BL1结束日期', width: 120 },
  { key: 'planned_duration', title: '计划工期', width: 100, align: 'center' as const },
  { key: 'actual_start_date', title: '实际开始日期', width: 120 },
  { key: 'actual_finish_date', title: '实际结束日期', width: 120 },
  { key: 'actual_duration', title: '实际工期', width: 120, align: 'center' as const },
  { key: 'completed', title: '完成量', width: 100, align: 'center' as const },
  { key: 'actual_manhour', title: '实际人工时', width: 120, align: 'center' as const },
]

// 可用的分组字段
const GROUP_BY_OPTIONS = [
  { value: 'discipline', label: '专业' },
  { value: 'work_package', label: '工作包' },
  { value: 'block', label: '子项' },
  { value: 'scope', label: '分包商' },
  { value: 'implement_phase', label: '执行阶段' },
  { value: 'project', label: '项目' },
  { value: 'subproject', label: '子项目' },
  { value: 'train', label: '开车阶段' },
  { value: 'unit', label: '装置' },
  { value: 'main_block', label: '主项' },
  { value: 'quarter', label: '区块' },
]

export type DailyReportMode = 'MP' | 'VFACT' | 'INSPECTION'

export const DailyReportManagementBase = ({ mode = 'MP' }: { mode?: DailyReportMode }) => {
  const { message: messageApi } = App.useApp()
  const queryClient = useQueryClient()
  const globalFilter = useContext(GlobalFilterContext)
  const navigate = useNavigate()
  const selectedScopeForMpExtras = useMemo(() => {
    const scopes = globalFilter.scope || []
    return scopes.length === 1 ? scopes[0] : null
  }, [globalFilter.scope])

  // 状态管理
  const [groupBy, setGroupBy] = useState<string[]>([])
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => [
    'status',
    'activity_id',
    'title',
    'block',
    'discipline',
    'work_package',
  ])

  // 填报列永远在最右侧（不受栏位设置影响），且顺序固定：人力在机械左侧；备注在机械右侧；工程量最右；验收模式仅“验收”列
  // VFACT模式不显示备注列；INSPECTION 模式只显示验收列
  const trailingFillColumns = useMemo(() => {
    if (mode === 'INSPECTION') return ['inspection_add']
    if (mode === 'MP') return ['mp_manpower', 'mp_machinery', 'mp_remarks']
    return ['mp_manpower', 'mp_machinery', 'vfact_achieved']
  }, [mode])

  const orderedVisibleColumns = useMemo(() => {
    const excludeKeys = ['mp_manpower', 'mp_machinery', 'mp_remarks', 'vfact_achieved', 'inspection_add']
    const base = visibleColumns.filter((k) => !excludeKeys.includes(k))
    const merged = [...base]
    trailingFillColumns.forEach((k) => {
      if (!merged.includes(k)) merged.push(k)
    })
    return merged
  }, [visibleColumns, trailingFillColumns])
  const [columnSettingsVisible, setColumnSettingsVisible] = useState(false)
  const [groupingPanelVisible, setGroupingPanelVisible] = useState(true)
  const [localFilters, setLocalFilters] = useState({
    activity_id: '',
    title: '',
  })
  // 性能：首屏不要一次拉2000行（会导致表格/固定列/分组渲染非常卡）
  const [pagination, setPagination] = useState({ current: 1, pageSize: 2000 })
  const [loadedItems, setLoadedItems] = useState<Activity[]>([])
  const [hasMore, setHasMore] = useState(true)

  // 日期策略：本页不允许用户调整日期（按你的要求）
  // - MP页：mpDate=今天，vfactDate=昨天（仅用于提示）
  // - VFACT页：vfactDate=昨天，mpDate=昨天（同日参考）
  // 注意：每次计算时都使用当前日期，确保日期始终是最新的
  const mpDate = useMemo(() => {
    const today = dayjs().startOf('day')
    return mode === 'MP' ? today : today.subtract(1, 'day')
  }, [mode])
  const vfactDate = useMemo(() => dayjs().startOf('day').subtract(1, 'day'), [])

  // 日报填报值（以 activity_id 为key）。这里存的是"当前编辑态"值。
  // 支持工作步骤模式：work_steps 数组，或向后兼容的 achieved 字段
  const [reportEdit, setReportEdit] = useState<Record<string, { 
    manpower?: number
    machinery?: number
    achieved?: number  // 向后兼容：单个完成量（用于非工作步骤模式）
    remarks?: string
    work_steps?: DailyReportMgmtWorkStepValue[]  // 新增：工作步骤完成量列表
    key_qty?: number | null  // Activity级别的预估总量（用于MP模式）
    completed?: number | null  // Activity级别的完成量（用于MP模式）
    system_status?: string  // 作业系统状态
  }>>({})
  
  // 工作步骤定义缓存（按 work_package 缓存）
  const [workStepDefinesCache, setWorkStepDefinesCache] = useState<Record<string, WorkStepDefine[]>>({})
  
  // 是否显示所有工作步骤（包括非关键工作步骤）
  const [showAllWorkSteps, setShowAllWorkSteps] = useState(false)
  const dirtyIdsRef = useRef<Set<string>>(new Set())
  const [dirtyCount, setDirtyCount] = useState(0)

  // MP 额外项（管理/间接/休息等），仅 MP 页使用，且要求单一 scope
  const [mpExtrasVisible, setMpExtrasVisible] = useState(false)
  const [mpExtras, setMpExtras] = useState<Record<string, number>>({})

  // 验收日报：选中作业后点击 + 打开弹窗
  const [selectedActivityForInspection, setSelectedActivityForInspection] = useState<Activity | null>(null)
  const [editingInspection, setEditingInspection] = useState<InspectionDBResponse | null>(null)
  const [inspectionModalVisible, setInspectionModalVisible] = useState(false)
  const [rfiListDrawerActivityId, setRfiListDrawerActivityId] = useState<string | null>(null)

  // 导入导出进度状态（step 用于显示「步骤 x/y」，便于用户了解当前阶段）
  const [progress, setProgress] = useState<{
    visible: boolean
    percent: number
    text: string
    title: string
    step?: string
    tip?: string
  }>({
    visible: false,
    percent: 0,
    text: '',
    title: '正在处理',
  })

  // 供渲染/请求使用的日期字符串（必须在 tableColumns/useMemo 之前声明，避免 TDZ 导致白屏）
  const mpDateStr = useMemo(() => mpDate.format('YYYY-MM-DD'), [mpDate])
  const vfactDateStr = useMemo(() => vfactDate.format('YYYY-MM-DD'), [vfactDate])

  const updateReportValue = useCallback(
    (activityId: string, patch: Partial<{ 
      manpower?: number
      machinery?: number
      achieved?: number
      remarks?: string
      work_steps?: DailyReportMgmtWorkStepValue[]
    }>) => {
      setReportEdit((prev) => {
        const next = { ...prev }
        next[activityId] = { ...(next[activityId] || {}), ...patch }
        return next
      })
      dirtyIdsRef.current.add(activityId)
      setDirtyCount(dirtyIdsRef.current.size)
    },
    [],
  )
  
  // 更新工作步骤完成量
  const updateWorkStepValue = useCallback(
    (activityId: string, workStepDescription: string, achieved: number | undefined, isKeyQuantity: boolean) => {
      setReportEdit((prev) => {
        const next = { ...prev }
        const current = next[activityId] || {}
        const workSteps = current.work_steps || []
        
        // 查找是否已存在该工作步骤
        const existingIndex = workSteps.findIndex(ws => ws.work_step_description === workStepDescription)
        
        let updatedWorkSteps: DailyReportMgmtWorkStepValue[]
        if (existingIndex >= 0) {
          // 更新现有工作步骤：保留原有的 estimated_total 和 cumulative_achieved
          updatedWorkSteps = [...workSteps]
          const existing = updatedWorkSteps[existingIndex]
          updatedWorkSteps[existingIndex] = {
            ...existing,  // 保留原有字段（包括 estimated_total 和 cumulative_achieved）
            work_step_description: workStepDescription,
            achieved: achieved ?? null,  // 允许设置为 null（用于删除数据库中的记录，但保留前端显示）
            is_key_quantity: isKeyQuantity,
          }
        } else if (achieved !== undefined && achieved !== null) {
          // 只有当 achieved 有值时才添加新工作步骤
          // 添加新工作步骤：需要从 workStepDefinesCache 中获取 estimated_total
          // 注意：新添加的工作步骤可能没有 estimated_total，需要从工作步骤定义中获取
          const workPackage = loadedItems.find(a => a.activity_id === activityId)?.work_package
          const workStepDefines = workPackage ? workStepDefinesCache[workPackage] || [] : []
          const wsDefine = workStepDefines.find((ws: any) => ws.work_step_description === workStepDescription)
          
          updatedWorkSteps = [
            ...workSteps,
            {
              work_step_description: workStepDescription,
              achieved,
              is_key_quantity: isKeyQuantity,
              estimated_total: wsDefine?.estimated_total ?? undefined,  // 从工作步骤定义中获取预估总量
              cumulative_achieved: undefined,  // 新添加的工作步骤，累计完成量需要从后端获取
            },
          ]
        } else {
          // achieved 为 undefined 或 null，且工作步骤不存在，不需要添加
          updatedWorkSteps = workSteps
        }
        
        next[activityId] = {
          ...current,
          work_steps: updatedWorkSteps.length > 0 ? updatedWorkSteps : undefined,
        }
        return next
      })
      dirtyIdsRef.current.add(activityId)
      setDirtyCount(dirtyIdsRef.current.size)
    },
    [],
  )
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('daily-report-column-widths')
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (e) {
      // 静默处理列宽加载失败（使用默认值）
    }
    return {}
  })
  const [viewModalVisible, setViewModalVisible] = useState(false)
  const [savedViews, setSavedViews] = useState<Array<{
    id: string
    name: string
    groupBy: string[]
    visibleColumns: string[]
    columnWidths: Record<string, number>
    expandedGroups?: Record<string, boolean>
    expandToLevel?: number | null
  }>>([])
  
  // 分组折叠/展开状态管理
  const [expandedGroups, setExpandedGroups] = useState<Map<string, boolean>>(new Map())
  
  // 展开到第N层的状态（null表示全部展开）
  const [expandToLevel, setExpandToLevel] = useState<number | null>(null)

  // 滚动加载更多的ref（需要在useEffect之前定义）
  const isLoadingMoreRef = useRef(false) // 防止重复加载
  const savedScrollTopRef = useRef<number>(0) // 保存滚动位置
  const userRejectedLoadMoreRef = useRef(false) // 用户是否拒绝过加载更多（点击取消后设置）
  const tableContainerRef = useRef<HTMLDivElement | null>(null) // 表格区域容器（包含表头/表体/固定列等，用于列宽同步）
  const tableBodyScrollRef = useRef<HTMLDivElement | null>(null) // 表格“纵向滚动容器”（.ant-table-body），用于 scrollTop 保存/恢复
  const updateTableBodyScrollRef = useCallback(() => {
    const el = tableContainerRef.current?.querySelector('.ant-table-body') as HTMLDivElement | null
    if (el) tableBodyScrollRef.current = el
  }, [])
  // 当表格容器从“未挂载”变为“已挂载”时，用 tick 触发一次高度计算/observer 绑定（避免首次进入先显示loading导致effect不跑）
  const [tableContainerTick, setTableContainerTick] = useState(0)
  const setTableContainerEl = useCallback((el: HTMLDivElement | null) => {
    tableContainerRef.current = el
    if (el) setTableContainerTick((t) => t + 1)
  }, [])

  const legacyReportMeta = useMemo(() => {
    if (mode === 'VFACT') {
      return {
        title: '遗留工程量日报',
        description: '该页面沿用工程建设日报与工程量回写口径，服务旧项目的日清日结、作业日报与施工量填报。',
        note: '机械制造建议转向工位报工、工序完工、WIP 跟踪与订单交期看板，而不是继续使用施工日报模式管理车间执行。',
      }
    }

    if (mode === 'INSPECTION') {
      return {
        title: '遗留验收日报',
        description: '该页面沿用工程验收/RFI 逻辑，适合旧工程项目验收资料录入与查询。',
        note: '机械制造质量管理建议逐步过渡到 IQC / IPQC / FQC、工序追溯与不合格闭环，不再以工程验收日报作为质量主入口。',
      }
    }

    return {
      title: '遗留人力日报',
      description: '该页面沿用工程建设的人力/机械日报逻辑，适合历史工程项目现场填报。',
      note: '机械制造执行建议以扫码报工、设备稼动、班组节拍和工单进度反馈为核心，不再以人工日报作为主执行入口。',
    }
  }, [mode])
  
  // 表格高度（用于 Table.scroll.y，让滚动发生在 Table 内部，sticky 表头才会生效）
  // 注意：虚拟表格首次挂载时如果 scroll.y 用了错误的初始值，rc-virtual-list 可能会用错高度计算滚动条。
  // 这里用 useLayoutEffect 在首帧 paint 前就把高度同步到正确值，避免“第一次进入滚动条长度不对、第二次才正常”。
  const [tableBodyHeight, setTableBodyHeight] = useState<number>(120)
  const recalcTableBodyHeight = useCallback(() => {
    const container = tableContainerRef.current
    if (!container) return
    const h = container.clientHeight
    const reserved = hasMore ? 54 : 8
    setTableBodyHeight(Math.max(120, h - reserved))
    updateTableBodyScrollRef()
  }, [hasMore, updateTableBodyScrollRef])

  useLayoutEffect(() => {
    const container = tableContainerRef.current
    if (!container) return
    const ro = new ResizeObserver(() => {
      recalcTableBodyHeight()
    })
    ro.observe(container)
    // 首次计算
    recalcTableBodyHeight()
    return () => ro.disconnect()
  }, [tableContainerTick, recalcTableBodyHeight])

  // Table 首次渲染/数据变化时，.ant-table-body 可能会重新创建（该兜底 effect 会在 fullTableDataSource 声明后补上）
  
  // 列宽调整状态
  const [isColumnResizing, setIsColumnResizing] = useState(false)
  const columnResizeRef = useRef<{
    active: boolean
    colKey: string | null
    startX: number
    startWidth: number
    currentWidth: number
    rafId: number | null
    guideEl: HTMLDivElement | null
    colEls: HTMLTableColElement[]
    initialColumnWidths: Record<string, number> // 拖拽开始时所有列的初始宽度
    allTables: HTMLTableElement[] // 所有需要更新的表格
  }>({ 
    active: false,
    colKey: null,
    startX: 0,
    startWidth: 0,
    currentWidth: 0,
    rafId: null,
    guideEl: null,
    colEls: [],
    initialColumnWidths: {},
    allTables: [],
  })
  
  // 使用ref保存最新的列宽状态，避免闭包问题
  const columnWidthsRef = useRef<Record<string, number>>(columnWidths)
  useEffect(() => {
    columnWidthsRef.current = columnWidths
  }, [columnWidths])

  // 防止列宽更新时触发 ResizeObserver 循环的标志位
  const isUpdatingColumnWidthsRef = useRef(false)

  // 仅让 Activities 内部区域滚动：禁止页面级滚动
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])


  // 将GlobalFilter的筛选条件转换为后端API需要的格式
  const filters = useMemo(() => {
    const filterObj: Record<string, any> = {}
    
    // Facilities级联筛选
    if (globalFilter.subproject && globalFilter.subproject.length > 0) {
      filterObj.subproject = globalFilter.subproject
    }
    if (globalFilter.train && globalFilter.train.length > 0) {
      filterObj.train = globalFilter.train
    }
    if (globalFilter.unit && globalFilter.unit.length > 0) {
      filterObj.unit = globalFilter.unit
    }
    if (globalFilter.main_block && globalFilter.main_block.length > 0) {
      filterObj.main_block = globalFilter.main_block
    }
    if (globalFilter.block && globalFilter.block.length > 0) {
      filterObj.block = globalFilter.block
    }
    if (globalFilter.quarter && globalFilter.quarter.length > 0) {
      filterObj.quarter = globalFilter.quarter
    }
    
    // Scope筛选
    if (globalFilter.scope && globalFilter.scope.length > 0) {
      filterObj.scope = globalFilter.scope
    }
    // activity_summary 相关字段
    if (globalFilter.discipline && globalFilter.discipline.length > 0) {
      filterObj.discipline = globalFilter.discipline
    }
    if (globalFilter.implement_phase && globalFilter.implement_phase.length > 0) {
      filterObj.implement_phase = globalFilter.implement_phase
    }
    if (globalFilter.contract_phase && globalFilter.contract_phase.length > 0) {
      filterObj.contract_phase = globalFilter.contract_phase
    }
    if (globalFilter.type && globalFilter.type.length > 0) {
      filterObj.type = globalFilter.type
    }
    if (globalFilter.work_package && globalFilter.work_package.length > 0) {
      filterObj.work_package = globalFilter.work_package
    }
    // rsc_defines 相关字段
    if (globalFilter.resource_id_name && globalFilter.resource_id_name.length > 0) {
      filterObj.resource_id_name = globalFilter.resource_id_name
    }
    if (globalFilter.bcc_kq_code && globalFilter.bcc_kq_code.length > 0) {
      filterObj.bcc_kq_code = globalFilter.bcc_kq_code
    }
    if (globalFilter.kq && globalFilter.kq.length > 0) {
      filterObj.kq = globalFilter.kq
    }
    if (globalFilter.cn_wk_report && globalFilter.cn_wk_report.length > 0) {
      filterObj.cn_wk_report = globalFilter.cn_wk_report
    }
    
    // 日期筛选
    if (globalFilter.date_range && globalFilter.date_range[0] && globalFilter.date_range[1]) {
      filterObj.baseline1_start_date = {
        gte: globalFilter.date_range[0].format('YYYY-MM-DD'),
        lte: globalFilter.date_range[1].format('YYYY-MM-DD'),
      }
    }

    if (localFilters.activity_id) {
      filterObj.activity_id = { like: `%${localFilters.activity_id.trim()}%` }
    }

    if (localFilters.title) {
      filterObj.title = { like: `%${localFilters.title.trim()}%` }
    }
    
    return filterObj
  }, [globalFilter, localFilters])

  // 当筛选条件变化时，重置分页和加载的数据
  // 使用JSON.stringify来深度比较filters，避免因对象引用变化导致误触发
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters])
  const prevFiltersKeyRef = useRef<string>(filtersKey) // 使用当前值初始化，避免首次挂载时触发重置
  const isFirstMountRef = useRef(true)
  const lastFiltersKeyForPaginationRef = useRef<string>(filtersKey) // 用于跟踪筛选器变化，用于 effectivePagination 计算
  
  // 跟踪 groupBy 的变化，用于在分组变化时重置数据
  const groupByKey = useMemo(() => groupBy.join('|'), [groupBy])
  const prevGroupByKeyRef = useRef<string>(groupByKey)
  
  // 确保在筛选器或分组变化时，分页被重置为1
  // 当 filters 或 groupBy 变化时，使用 current: 1，否则使用 pagination.current
  // 关键：使用 filtersKey 和 groupByKey 来判断是否变化，而不是依赖 ref（因为 ref 更新是异步的）
  const lastGroupByKeyForPaginationRef = useRef<string>(groupByKey)
  const effectivePagination = useMemo(() => {
    if (isFirstMountRef.current) {
      return pagination
    }
    // 如果 filters 或 groupBy 变化了（通过比较 filtersKey/groupByKey 和 ref），强制使用 current: 1
    // 注意：这里使用 ref 来跟踪上一次的值，确保在变化时立即返回 current: 1
    const filtersChanged = lastFiltersKeyForPaginationRef.current !== filtersKey
    const groupByChanged = lastGroupByKeyForPaginationRef.current !== groupByKey
    if (filtersChanged || groupByChanged) {
      logger.log('EffectivePagination: filters or groupBy changed, using current: 1', {
        lastFiltersKey: lastFiltersKeyForPaginationRef.current,
        currentFiltersKey: filtersKey,
        lastGroupByKey: lastGroupByKeyForPaginationRef.current,
        currentGroupByKey: groupByKey,
        paginationCurrent: pagination.current,
      })
      return { current: 1, pageSize: pagination.pageSize }
    }
    return pagination
  }, [filtersKey, groupByKey, pagination])
  
  useEffect(() => {
    // 跳过首次挂载，只在 filtersKey 真正变化时才重置
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false
      prevFiltersKeyRef.current = filtersKey
      lastFiltersKeyForPaginationRef.current = filtersKey
      prevGroupByKeyRef.current = groupByKey
      lastGroupByKeyForPaginationRef.current = groupByKey
      return
    }
    
    // 检查 filtersKey 是否变化
    const filtersChanged = prevFiltersKeyRef.current !== filtersKey
    // 检查 groupBy 是否变化
    const groupByChanged = prevGroupByKeyRef.current !== groupByKey
    
    // 如果 filters 或 groupBy 变化，都需要重置数据
    if (filtersChanged || groupByChanged) {
      logger.log('Filters or groupBy changed, resetting pagination and loaded items.', {
        filtersChanged,
        groupByChanged,
        filtersKey,
        groupByKey,
      })
      // 关键：在重置之前，先更新 lastFiltersKeyForPaginationRef，确保 effectivePagination 立即返回正确的值
      // 但是，我们需要在数据加载完成后再更新它，以避免在数据加载期间触发多次查询
      // 所以这里先不更新，让 effectivePagination 检测到变化并返回 current: 1
      setPagination({ current: 1, pageSize: pagination.pageSize })
      setLoadedItems([])
      setHasMore(true)
      prevFiltersKeyRef.current = filtersKey
      prevGroupByKeyRef.current = groupByKey
      // 重置滚动位置到顶部
      setTimeout(() => {
        const scrollContainer = tableBodyScrollRef.current
        if (scrollContainer) {
          scrollContainer.scrollTop = 0
          logger.log('Reset scroll position to top after filter/groupBy change')
        }
      }, 100)
      // 注意：不在这里更新 lastFiltersKeyForPaginationRef，让它在数据加载完成后再更新
      // 这样 effectivePagination 在数据加载期间会一直返回 current: 1
    }
  }, [filtersKey, filters, pagination.pageSize, groupByKey])

  // 加载用户偏好设置
  const { data: columnPreferences } = useQuery({
    queryKey: ['activity-column-preferences'],
    queryFn: () => activityService.getUserColumnPreferences(),
  })

  const { data: groupingPreferences } = useQuery({
    queryKey: ['activity-grouping-preferences'],
    queryFn: () => activityService.getUserGroupingPreferences(),
  })


  // 获取RSC定义数据，用于专业和工作包的排序
  const { data: rscDefines } = useQuery({
    queryKey: ['rsc-defines'],
    queryFn: () => rscService.getRSCDefines({ limit: 10000 }),
  })

  // 构建专业和工作包的排序映射（基于RSC定义）
  const disciplineSortMap = useMemo(() => {
    if (!rscDefines) return new Map<string, number>()
    const disciplines = new Set<string>()
    rscDefines.forEach(rsc => {
      // 从work_package中提取专业（通常是前2个字符，如CI01中的CI）
      if (rsc.work_package && rsc.work_package.length >= 2) {
        const discipline = rsc.work_package.substring(0, 2)
        disciplines.add(discipline)
      }
    })
    const sortedDisciplines = Array.from(disciplines).sort()
    const map = new Map<string, number>()
    sortedDisciplines.forEach((d, index) => {
      map.set(d, index)
    })
    return map
  }, [rscDefines])

  const workPackageSortMap = useMemo(() => {
    if (!rscDefines) return new Map<string, number>()
    const workPackages = new Set<string>()
    rscDefines.forEach(rsc => {
      if (rsc.work_package) {
        workPackages.add(rsc.work_package)
      }
    })
    const sortedWorkPackages = Array.from(workPackages).sort()
    const map = new Map<string, number>()
    sortedWorkPackages.forEach((wp, index) => {
      map.set(wp, index)
    })
    return map
  }, [rscDefines])


  // 应用用户偏好设置
  // 检查是否有最后使用的视图，如果有，就不应用用户偏好设置
  const hasLastViewRef = useRef(false)
  
  useEffect(() => {
    // 如果已经加载了视图，就不应用用户偏好设置
    if (hasLastViewRef.current) {
      return
    }
    if (columnPreferences && Array.isArray(columnPreferences)) {
      // 用户偏好是共用的，但"MP页/VFACT页/验收页"要限制显示列
      const disallowed = mode === 'MP'
        ? new Set(['vfact_achieved', 'inspection_add'])
        : mode === 'VFACT'
          ? new Set(['mp_remarks', 'inspection_add'])
          : new Set(['mp_manpower', 'mp_machinery', 'mp_remarks', 'vfact_achieved']) // INSPECTION 禁用 MP/VFACT 列
      const merged = columnPreferences.filter((k) => !disallowed.has(k))

      const ensureKeys = mode === 'INSPECTION'
        ? ['inspection_add']
        : mode === 'VFACT'
          ? ['vfact_achieved', 'mp_manpower', 'mp_machinery']
          : ['mp_manpower', 'mp_machinery', 'mp_remarks']

      ensureKeys.forEach((k) => {
        if (!merged.includes(k)) merged.splice(2, 0, k)
      })

      setVisibleColumns(merged)
    }
  }, [columnPreferences, mode])
  
  // 应用用户分组偏好设置（仅在未加载视图时）
  useEffect(() => {
    // 如果已经加载了视图，就不应用用户偏好设置
    if (hasLastViewRef.current) {
      return
    }
    if (groupingPreferences && Array.isArray(groupingPreferences)) {
      setGroupBy(groupingPreferences)
    }
  }, [groupingPreferences])

  // 加载“今日MP + 昨日VFACT”的已填数据（批量）；验收模式不加载
  const loadReportValues = useCallback(() => {
    if (mode === 'INSPECTION') return
    const activityIds = Array.from(new Set(loadedItems.map((a) => a.activity_id).filter(Boolean)))
    if (activityIds.length === 0) return

    const mpDateStr = mpDate.format('YYYY-MM-DD')
    const vfactDateStr = vfactDate.format('YYYY-MM-DD')

    logger.log(`[DailyReportManagement] Loading values for mp_date=${mpDateStr}, vfact_date=${vfactDateStr}, activity_ids=${activityIds.length}`)

    dailyReportManagementService
      .getValues({
        mp_date: mpDateStr,
        vfact_date: vfactDateStr,
        activity_ids: activityIds,
      })
      .then((res) => {
        setReportEdit((prev) => {
          const next = { ...prev }
          activityIds.forEach((id) => {
            // 如果该行已被用户修改过，则不要覆盖编辑态
            if (dirtyIdsRef.current.has(id)) return
            const v = res.values?.[id]
            
            // 调试日志：检查后端返回的工作步骤数据
            if (v?.work_steps && v.work_steps.length > 0) {
              logger.log(`[WorkStepsData] Activity ${id} work_steps from backend:`, v.work_steps.map((ws: any) => ({
                work_step_description: ws.work_step_description,
                achieved: ws.achieved,
                cumulative_achieved: ws.cumulative_achieved,
                is_key_quantity: ws.is_key_quantity,
                estimated_total: ws.estimated_total
              })))
            }
            
            next[id] = {
              manpower: v?.manpower ?? undefined,
              machinery: v?.machinery ?? undefined,
              achieved: v?.achieved ?? undefined,  // 向后兼容
              remarks: v?.remarks ?? undefined,
              work_steps: v?.work_steps ?? undefined,  // 新增：工作步骤数据（从 vfactdb 和 workstep_volume_daily 中获取，按 work_step_description 区分）
              key_qty: v?.key_qty ?? undefined,  // Activity级别的预估总量（用于MP模式）
              completed: v?.completed ?? undefined,  // Activity级别的完成量（用于MP模式）
              system_status: v?.system_status ?? undefined,  // 作业系统状态
            }
            
            // 调试日志：检查后端返回的 completed 字段
            if (v?.completed !== null && v?.completed !== undefined) {
              logger.log(`[CompletedData] Activity ${id} completed from backend:`, v.completed)
            } else {
              logger.log(`[CompletedData] Activity ${id} completed is null/undefined from backend`)
            }
          })
          return next
        })
      })
      .catch((e: any) => {
        // 不阻塞页面，只提示一次
        logger.warn('Failed to load daily report values:', e)
      })
  }, [mode, loadedItems, mpDate, vfactDate])

  // 当 loadedItems、mpDate、vfactDate 变化时，重新加载数据
  useEffect(() => {
    loadReportValues()
  }, [loadReportValues])

  // 监听 daily-report-management 查询失效事件，强制刷新数据
  // 使用 ref 来存储 loadReportValues，避免在 useEffect 中重复创建
  const loadReportValuesRef = useRef(loadReportValues)
  loadReportValuesRef.current = loadReportValues

  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event: any) => {
      // 当 daily-report-management 查询被 invalidate 时，重新加载数据
      if (event?.type === 'removed' && event?.query?.queryKey?.[0] === 'daily-report-management') {
        logger.log('[DailyReportManagement] Query invalidated, reloading values...')
        // 延迟执行，确保数据已经更新
        setTimeout(() => {
          loadReportValuesRef.current()
        }, 100)
      }
    })
    return unsubscribe
  }, [queryClient])
  
  // 加载工作步骤定义（一次性加载所有激活的工作步骤并按 work_package 分组缓存）
  useEffect(() => {
    if (mode !== 'VFACT') return  // 仅 VFACT 模式需要工作步骤
    
    // 如果已经加载过（且不是空的），则不再重复加载
    if (Object.keys(workStepDefinesCache).length > 0) return

    const loadAllWorkSteps = async () => {
      try {
        logger.log('[WorkSteps] Loading all active work steps...')
        const allDefines = await workstepService.getWorkStepDefines({
          is_active: true,
        })
        
        if (!Array.isArray(allDefines)) {
          logger.warn('[WorkSteps] Invalid response for all work steps:', allDefines)
          return
        }

        // 按 work_package 分组
        const groupedDefines: Record<string, WorkStepDefine[]> = {}
        allDefines.forEach((ws: any) => {
          const wp = ws.work_package
          if (!wp) return
          
          if (!groupedDefines[wp]) {
            groupedDefines[wp] = []
          }
          
          // 确保 is_key_quantity 字段存在
          const normalizedWs = {
            ...ws,
            is_key_quantity: ws.is_key_quantity !== undefined ? ws.is_key_quantity : (ws.isKeyQuantity || false),
          }
          groupedDefines[wp].push(normalizedWs)
        })

        setWorkStepDefinesCache(groupedDefines)
        logger.log(`[WorkSteps] Cached work steps for ${Object.keys(groupedDefines).length} work packages. Total steps: ${allDefines.length}`)
      } catch (e) {
        logger.error('[WorkSteps] Failed to load all work steps:', e)
      }
    }

    loadAllWorkSteps()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])  // 仅在 mode 变化时触发一次（或首次加载）

  // 加载 MP 额外项（仅 MP 页 + 单一scope）
  useEffect(() => {
    if (mode !== 'MP') return
    if (!selectedScopeForMpExtras) return
    const dateStr = mpDate.format('YYYY-MM-DD')
    dailyReportManagementService
      .getMpExtras({ date: dateStr, scope: selectedScopeForMpExtras })
      .then((res) => {
        setMpExtras(res.manpower || {})
      })
      .catch(() => {
        // 静默
      })
  }, [mode, mpDate, selectedScopeForMpExtras])

  // 保存栏位配置
  const saveColumnPreferencesMutation = useMutation({
    mutationFn: (columns: string[]) => activityService.saveUserColumnPreferences(columns),
    onSuccess: () => {
      messageApi.success('栏位配置已保存')
      queryClient.invalidateQueries({ queryKey: ['activity-column-preferences'] })
    },
  })

  // 保存分组配置
  const saveGroupingPreferencesMutation = useMutation({
    mutationFn: (grouping: string[]) => activityService.saveUserGroupingPreferences(grouping),
    onSuccess: () => {
      messageApi.success('分组配置已保存')
      queryClient.invalidateQueries({ queryKey: ['activity-grouping-preferences'] })
    },
  })

  const deleteInspectionMutation = useMutation({
    mutationFn: (id: number) => reportService.deleteInspectionDB(id),
    onSuccess: () => {
      messageApi.success('删除成功')
      queryClient.invalidateQueries({ queryKey: ['inspectiondb-by-activities'] })
      queryClient.invalidateQueries({ queryKey: ['inspectiondb-list'] })
      queryClient.invalidateQueries({ queryKey: ['inspectiondb-summary'] })
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail
      let errorMsg = '删除失败'
      if (typeof detail === 'string') {
        errorMsg = detail
      } else if (Array.isArray(detail)) {
        // 处理 FastAPI 验证错误数组
        errorMsg = detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ')
      } else if (detail && typeof detail === 'object') {
        errorMsg = JSON.stringify(detail)
      }
      messageApi.error(errorMsg)
    },
  })
  
  // 保存列宽到localStorage
  useEffect(() => {
    try {
      localStorage.setItem('daily-report-column-widths', JSON.stringify(columnWidths))
    } catch (e) {
      logger.error('Failed to save column widths:', e)
    }
  }, [columnWidths])
  
  // 保存视图到localStorage（独立命名空间，避免影响 activities-advanced 等页面）
  const saveView = useCallback((viewName: string) => {
    const VIEWS_KEY = 'daily-report-views'

    const parseViews = (): any[] => {
      try {
        const raw = localStorage.getItem(VIEWS_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
      } catch (e) {
        logger.warn('[DailyReportManagement] Failed to parse saved views', e)
        return []
      }
    }

    // 将Map转换为普通对象以便保存
    const expandedGroupsObj: Record<string, boolean> = {}
    expandedGroups.forEach((value, key) => {
      expandedGroupsObj[key] = value
    })
    
    const view = {
      id: `view_${Date.now()}`,
      name: viewName,
      groupBy,
      visibleColumns,
      columnWidths,
      expandedGroups: expandedGroupsObj,
      expandToLevel,
      scope: 'daily-report-management',
      version: 1,
    }
    
    const views = parseViews()
    views.push(view)
    localStorage.setItem(VIEWS_KEY, JSON.stringify(views))
    setSavedViews(views)
    
    // 注意：保存视图时不自动设置为最后使用的视图
    // 只有用户通过"加载"按钮选择视图时，才会更新 LAST_VIEW_ID_KEY
    // 这样刷新页面时会加载用户选择的视图，而不是最后保存的视图
    
    messageApi.success('视图已保存（包含栏位宽度）')
  }, [groupBy, visibleColumns, columnWidths, expandedGroups, expandToLevel, messageApi])
  
  // 加载视图
  const loadView = useCallback((view: typeof savedViews[0], silent: boolean = false) => {
    const LAST_VIEW_ID_KEY = 'daily-report-last-view-id'

    // 标记已加载视图，防止用户偏好设置覆盖视图设置
    hasLastViewRef.current = true

    setGroupBy(view.groupBy)
    setVisibleColumns(view.visibleColumns)
    setColumnWidths(view.columnWidths || {})
    
    // 恢复折叠/展开状态
    if (view.expandedGroups) {
      const restoredMap = new Map<string, boolean>()
      Object.entries(view.expandedGroups).forEach(([key, value]) => {
        restoredMap.set(key, value)
      })
      setExpandedGroups(restoredMap)
    } else {
      // 如果没有保存的状态，默认全部展开
      setExpandedGroups(new Map())
    }
    
    // 恢复展开到第N层
    if (view.expandToLevel !== undefined) {
      setExpandToLevel(view.expandToLevel)
    } else {
      setExpandToLevel(null)
    }
    
    // 保存为最后使用的视图
    localStorage.setItem(LAST_VIEW_ID_KEY, view.id)
    
    if (!silent) {
      messageApi.success(`已加载视图: ${view.name}`)
    }
  }, [messageApi])
  
  // 删除视图
  const deleteView = useCallback((viewId: string) => {
    const VIEWS_KEY = 'daily-report-views'

    let views: any[] = []
    try {
      const parsed = JSON.parse(localStorage.getItem(VIEWS_KEY) || '[]')
      views = Array.isArray(parsed) ? parsed : []
    } catch {
      views = []
    }
    const filtered = views.filter((v: any) => v.id !== viewId)
    localStorage.setItem(VIEWS_KEY, JSON.stringify(filtered))
    setSavedViews(filtered)
    messageApi.success('视图已删除')
  }, [messageApi])
  
  // 加载保存的视图列表，并自动加载最后一次使用的视图
  useEffect(() => {
    const VIEWS_KEY = 'daily-report-views'
    const LAST_VIEW_ID_KEY = 'daily-report-last-view-id'
    const LEGACY_VIEWS_KEY = 'gantt-views'
    const LEGACY_LAST_VIEW_ID_KEY = 'gantt-last-view-id'

    let views: any[] = []
    try {
      const parsed = JSON.parse(localStorage.getItem(VIEWS_KEY) || '[]')
      views = Array.isArray(parsed) ? parsed : []
    } catch (e) {
      logger.warn('[DailyReportManagement] Failed to parse saved views', e)
      views = []
    }

    // 兼容迁移：如果新 key 没有数据，则尝试从旧 key 迁移“像日报视图”的旧数据
    if (views.length === 0) {
      try {
        const parsedLegacy = JSON.parse(localStorage.getItem(LEGACY_VIEWS_KEY) || '[]')
        const legacyViews = Array.isArray(parsedLegacy) ? parsedLegacy : []
        const migrated = legacyViews.filter((v: any) => {
          if (!v || typeof v !== 'object') return false
          if (v.scope === 'daily-report-management') return true
          // 旧版日报视图没有 timescaleConfig/gridWidth；而 activities-advanced 的视图通常有
          const looksLikeDaily =
            Array.isArray(v.visibleColumns) &&
            v.columnWidths &&
            typeof v.columnWidths === 'object' &&
            v.timescaleConfig === undefined &&
            v.gridWidth === undefined
          return looksLikeDaily
        })

        if (migrated.length > 0) {
          views = migrated
          localStorage.setItem(VIEWS_KEY, JSON.stringify(views))
          // 如果 legacy 的 lastViewId 指向迁移出来的视图，则同步到新 key
          const legacyLastId = localStorage.getItem(LEGACY_LAST_VIEW_ID_KEY)
          if (legacyLastId && migrated.some((v: any) => v.id === legacyLastId)) {
            localStorage.setItem(LAST_VIEW_ID_KEY, legacyLastId)
          }
        }
      } catch (e) {
        logger.warn('[DailyReportManagement] Failed to migrate legacy views', e)
      }
    }
    setSavedViews(views)
    
    // 自动加载最后一次使用的视图
    const lastViewId = localStorage.getItem(LAST_VIEW_ID_KEY)
    if (lastViewId && views.length > 0) {
      const lastView = views.find((v: any) => v.id === lastViewId)
      if (lastView) {
        logger.log('Auto-loading last view:', lastView.name)
        // 标记已加载视图，防止用户偏好设置覆盖视图设置
        hasLastViewRef.current = true
        // 延迟加载，确保组件已完全初始化
        setTimeout(() => {
          setGroupBy(lastView.groupBy)
          setVisibleColumns(lastView.visibleColumns)
          setColumnWidths(lastView.columnWidths || {})
        }, 100)
      }
    }
  }, []) // 只在组件挂载时执行一次

  // 查询作业数据（不使用后端GROUP BY，改为前端分组）
  // 使用 filtersKey 和 effectivePagination 确保在筛选器变化时使用正确的分页参数
  // 注意：queryKey 使用 filtersKey（字符串）而不是 filters（对象），避免对象引用变化导致不必要的查询
  // 关键：虽然 groupBy 不影响后端查询，但将其加入 queryKey 可以确保在分组变化时重新查询数据
  const { data, isLoading } = useQuery({
    // 注意：这里不要复用 ActivityListAdvanced 的 queryKey（否则两个页面会共享缓存，造成联动/错乱）
    queryKey: ['daily-report-management', 'activities', filtersKey, groupByKey, effectivePagination.current, effectivePagination.pageSize],
    queryFn: async () => {
      // 不使用group_by，让后端返回所有数据，前端进行分组显示
      const result = await activityService.getActivitiesAdvanced({
        filters: Object.keys(filters).length > 0 ? filters : undefined,
        group_by: undefined, // 不在后端分组
        order_by: [{ field: 'activity_id', order: 'asc' }],
        skip: (effectivePagination.current - 1) * effectivePagination.pageSize,
        limit: effectivePagination.pageSize,
      })
      return result
    },
  })

  // 跟踪上一次的 filtersKey 和 groupByKey，用于判断筛选器或分组是否变化
  // 关键：初始值应该是一个特殊值，确保首次切换筛选器时能正确检测到变化
  const prevFiltersKeyForDataRef = useRef<string | null>(null)
  const prevGroupByKeyForDataRef = useRef<string | null>(null)
  
  // 当数据加载完成时，更新累积的数据
  useEffect(() => {
    logger.log('Data loaded:', { 
      hasData: !!data, 
      itemsLength: data?.items?.length, 
      total: data?.total, 
      currentPage: effectivePagination.current,
      pageSize: effectivePagination.pageSize,
      filtersKey,
      groupByKey,
      prevFiltersKey: prevFiltersKeyForDataRef.current,
      prevGroupByKey: prevGroupByKeyForDataRef.current,
      lastFiltersKeyForPagination: lastFiltersKeyForPaginationRef.current,
    })
    
    // 检查筛选器或分组是否变化（首次加载时，ref.current 为 null，应该视为变化）
    const filtersChanged = prevFiltersKeyForDataRef.current === null || prevFiltersKeyForDataRef.current !== filtersKey
    const groupByChanged = prevGroupByKeyForDataRef.current === null || prevGroupByKeyForDataRef.current !== groupByKey
    
    if (data?.items) {
      // 如果是第一页或筛选器/分组变化了，直接替换数据（不追加）
      if (effectivePagination.current === 1 || filtersChanged || groupByChanged) {
        // 第一页或筛选器/分组变化，直接设置
        logger.log('Setting loadedItems (page 1 or filter/groupBy changed):', data.items.length, 'items, total:', data.total, 'filtersChanged:', filtersChanged, 'groupByChanged:', groupByChanged)
        setLoadedItems(data.items)
        const hasMoreData = (data.items.length === effectivePagination.pageSize) && (data.items.length < (data.total || 0))
        logger.log('hasMore set to:', hasMoreData, '(items:', data.items.length, 'pageSize:', effectivePagination.pageSize, 'total:', data.total, ')')
        setHasMore(hasMoreData)
        // 更新 refs - 延迟更新，确保滚动位置已经重置
        if (filtersChanged || groupByChanged) {
          // 延迟更新，避免滚动监听器在滚动位置重置之前就触发
          setTimeout(() => {
            prevFiltersKeyForDataRef.current = filtersKey
            prevGroupByKeyForDataRef.current = groupByKey
            lastFiltersKeyForPaginationRef.current = filtersKey
            lastGroupByKeyForPaginationRef.current = groupByKey
            logger.log('Updated refs after filter/groupBy change', {
              filtersKey,
              groupByKey,
            })
          }, 1000) // 延迟1秒，确保滚动位置已经重置
        }
    } else {
        // 后续页，追加到已有数据（避免重复）
        // 保存当前滚动位置（在更新前）
        const scrollContainer = tableBodyScrollRef.current
        if (scrollContainer) {
          savedScrollTopRef.current = scrollContainer.scrollTop
          logger.log('Saving scroll position before append:', savedScrollTopRef.current)
        }
        
        setLoadedItems(prev => {
          const existingIds = new Set(prev.map(item => item.id))
          const newItems = data.items.filter((item: Activity) => !existingIds.has(item.id))
          const updated = [...prev, ...newItems]
          const hasMoreData = (data.items.length === effectivePagination.pageSize) && (updated.length < (data.total || 0))
          logger.log('Appending new items:', {
            prevCount: prev.length,
            newItemsCount: newItems.length,
            updatedCount: updated.length,
            currentPageItems: data.items.length,
            total: data.total,
            hasMore: hasMoreData,
          })
          setHasMore(hasMoreData)
          return updated
        })
      }
    } else if (data && !data.items) {
      // 如果data存在但没有items，设置为空数组
      logger.log('Data exists but no items, clearing loadedItems')
      setLoadedItems([])
      setHasMore(false)
      if (filtersChanged || groupByChanged) {
        // 延迟更新，避免滚动监听器在滚动位置重置之前就触发
        setTimeout(() => {
          prevFiltersKeyForDataRef.current = filtersKey
          prevGroupByKeyForDataRef.current = groupByKey
          lastFiltersKeyForPaginationRef.current = filtersKey
          lastGroupByKeyForPaginationRef.current = groupByKey
          logger.log('Updated refs after filter/groupBy change (no items)', {
            filtersKey,
            groupByKey,
          })
        }, 1000) // 延迟1秒，确保滚动位置已经重置
      }
    }
  }, [data, effectivePagination.current, effectivePagination.pageSize, filtersKey, groupByKey])

  // 缓存activity_code描述，避免重复请求
  // key格式: `${codeValue}_${codeTypeName}`，value是description
  const [activityCodeDescriptions, setActivityCodeDescriptions] = useState<Map<string, string>>(new Map())
  
  // 批量获取activity_code描述
  useEffect(() => {
    if (!loadedItems.length || groupBy.length === 0) return
    
    const fieldToCodeTypeMap: Record<string, string> = {
      'discipline': 'Discipline',
      'work_package': 'Work Package',
      'block': 'Block',
      'scope': 'Scope',
      'implement_phase': 'Phase',
      'project': 'Project',
      'subproject': 'Subproject',
      'train': 'Train',
      'unit': 'Unit',
    }
    
    // 收集所有需要获取描述的code_value和code_type_name组合
    // 使用Set去重，避免重复请求相同的code_value和code_type_name组合
    const descriptionsToFetch = new Map<string, { activityId: string; codeTypeName: string; codeValue: string }>()
    const seenKeys = new Set<string>() // 用于去重
    
    // 遍历所有activities，收集需要获取的描述
    loadedItems.forEach((activity: Activity) => {
      groupBy.forEach(field => {
        const codeValue = (activity as any)[field] || '(空)'
        const codeTypeName = fieldToCodeTypeMap[field] || field
        const cacheKey = `${codeValue}_${codeTypeName}`
        
        // 如果还没有缓存，且不是空值，且没有重复，则添加到待获取列表
        if (!activityCodeDescriptions.has(cacheKey) && codeValue !== '(空)' && !seenKeys.has(cacheKey)) {
          seenKeys.add(cacheKey)
          // 对于分组汇总，只需要codeValue和codeTypeName，activityId可选
          descriptionsToFetch.set(cacheKey, { 
            activityId: activity.activity_id || '', 
            codeTypeName, 
            codeValue 
          })
        }
      })
    })
    
    // 批量获取描述（分片处理，避免并发过高导致连接关闭）
    if (descriptionsToFetch.size > 0) {
      const descriptionsArray = Array.from(descriptionsToFetch.entries())
      
      const fetchInChunks = async () => {
        const chunkSize = 10 // 每次并发10个
        for (let i = 0; i < descriptionsArray.length; i += chunkSize) {
          const chunk = descriptionsArray.slice(i, i + chunkSize)
          await Promise.all(chunk.map(async ([cacheKey, { activityId, codeTypeName, codeValue }]) => {
            try {
              const result = await activityService.getActivityCodeDescription(activityId || '', codeTypeName, codeValue)
              if (result && result.description) {
                setActivityCodeDescriptions(prev => {
                  const newMap = new Map(prev)
                  newMap.set(cacheKey, result.description)
                  return newMap
                })
              }
            } catch (error: any) {
              // 静默处理
            }
          }))
          // 如果还有下一批，稍微延迟一下，减轻服务器压力
          if (i + chunkSize < descriptionsArray.length) {
            await new Promise(resolve => setTimeout(resolve, 50))
          }
        }
      }
      
      fetchInChunks().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedItems, groupBy]) // 不依赖activityCodeDescriptions，避免无限循环

  // 前端分组处理
  // P6层级分组逻辑：按照groupBy的顺序，逐层构建树形结构（字典树模式）
  const groupedData = useMemo(() => {
    // 如果没有数据，返回空数组
    if (!loadedItems.length) {
      logger.log('groupedData: loadedItems is empty')
      return { items: [], groups: [] }
    }
    // 如果没有分组，直接返回loadedItems（作为普通Activity对象）
    if (groupBy.length === 0) {
      logger.log('groupedData: no grouping, returning', loadedItems.length, 'items directly')
      return { items: loadedItems, groups: [] }
    }
    logger.log('groupedData: grouping', loadedItems.length, 'items by', groupBy)
    
    // 定义树节点类型
    interface TreeNode {
      key: string
      value: string
      level: number
      children: Map<string, TreeNode>
      activities: Activity[]
      parent?: TreeNode
    }
    
    // 构建层级树
    const root: TreeNode = {
      key: 'root',
      value: 'root',
      level: -1,
      children: new Map(),
      activities: [],
    }
    
    // 将每个activity插入到树中
    loadedItems.forEach((activity: Activity) => {
      let currentNode = root
      
      // 按照groupBy的顺序，逐层向下构建树
      for (let i = 0; i < groupBy.length; i++) {
        const field = groupBy[i]
        const fieldValue = (activity as any)[field] || '(空)'
        const nodeKey = `${i}_${fieldValue}`
        
        if (!currentNode.children.has(nodeKey)) {
          currentNode.children.set(nodeKey, {
            key: nodeKey,
            value: fieldValue,
            level: i,
            children: new Map(),
            activities: [],
            parent: currentNode,
          })
        }
        currentNode = currentNode.children.get(nodeKey)!
      }
      
      // 将activity添加到叶子节点
      currentNode.activities.push(activity)
    })
    
    // 递归展开树为扁平列表（深度优先遍历）
    const items: any[] = []
    const groups: string[] = []
    
    // 字段名到code_type_name的映射（P6中通常使用首字母大写的格式）
    const fieldToCodeTypeMap: Record<string, string> = {
      'discipline': 'Discipline',
      'work_package': 'Work Package',
      'block': 'Block',
      'scope': 'Scope',
      'implement_phase': 'Phase',
      'project': 'Project',
      'subproject': 'Subproject',
      'train': 'Train',
      'unit': 'Unit',
    }
    
    // 计算分组下的所有子项数量（包括子分组和任务）
    const countGroupItems = (node: TreeNode): number => {
      let count = node.activities.length
      node.children.forEach((childNode) => {
        count += countGroupItems(childNode)
      })
      return count
    }
    
    const traverse = (node: TreeNode, path: string[] = [], parentExpanded: boolean = true) => {
      // 如果不是根节点，添加分组标题
      if (node.level >= 0) {
        // 只显示当前层级的信息，不包含上层信息
        const currentLevelValue = node.value
        const currentLevelField = groupBy[node.level]
        
        // 获取分组描述：显示 activity_code_value: activity_code_description 格式
        const codeTypeName = fieldToCodeTypeMap[currentLevelField] || currentLevelField
        const cacheKey = `${currentLevelValue}_${codeTypeName}`
        let groupDescription = activityCodeDescriptions.get(cacheKey) || ''
        
        // 分组显示：activity_code_value: activity_code_description 格式
        const groupDisplayText = groupDescription 
          ? `${currentLevelValue}: ${groupDescription}`
          : currentLevelValue
        
        const groupKey = currentLevelValue // 只使用当前层级的值作为key
        // 使用完整的路径来确保唯一性，避免不同层级有相同值导致key重复
        const fullPath = node.level >= 0 ? [...path, currentLevelValue].join('|') : currentLevelValue
        const groupId = `__group__${node.level}_${fullPath}`
        
        // 检查是否应该展开（考虑expandToLevel和expandedGroups）
        // 优先级：expandedGroups中的手动设置 > expandToLevel规则
        const shouldExpand = (() => {
          // 优先检查expandedGroups中是否有手动设置
          const manualState = expandedGroups.get(groupId)
          if (manualState !== undefined) {
            // 如果有手动设置，使用手动设置的值
            return manualState
          }
          // 如果没有手动设置，再检查expandToLevel规则
          if (expandToLevel !== null && node.level >= expandToLevel) {
            return false
          }
          // 默认展开
          return true
        })()
        
        // 计算子项数量
        const itemCount = countGroupItems(node)
        
        items.push({
          id: groupId,
          isGroupHeader: true,
          groupKey: groupDisplayText, // 显示文本包含code+描述
          groupValue: currentLevelValue, // 原始值（用于匹配）
          groupField: currentLevelField, // 当前分组的字段名
          groupValues: [...path, currentLevelValue], // 包含完整路径，用于构建唯一ID
          level: node.level,
          isExpanded: shouldExpand,
          itemCount, // 子项数量
        })
        groups.push(groupKey)
        
        // 如果当前分组未展开，或者父分组未展开，则不继续遍历子节点
        if (!shouldExpand || !parentExpanded) {
          return
        }
      }
      
      // 检查当前节点是否应该展开（根节点总是展开）
      const currentExpanded = node.level < 0 ? true : (() => {
        const fullPath = node.level >= 0 ? [...path, node.value].join('|') : ''
        const groupId = `__group__${node.level}_${fullPath}`
        // 优先检查expandedGroups中是否有手动设置
        const manualState = expandedGroups.get(groupId)
        if (manualState !== undefined) {
          // 如果有手动设置，使用手动设置的值
          return manualState
        }
        // 如果没有手动设置，再检查expandToLevel规则
        if (expandToLevel !== null && node.level >= expandToLevel) {
          return false
        }
        // 默认展开
        return true
      })()
      
      // 先遍历子节点（按key排序，保证顺序一致）
      // 如果是专业或工作包，按照RSC定义排序；否则按字母顺序排序
      const sortedChildren = Array.from(node.children.entries()).sort((a, b) => {
        const field = groupBy[node.level]
        const aValue = a[1].value
        const bValue = b[1].value
        
        // 如果是专业字段，使用专业排序映射
        if (field === 'discipline') {
          const aIndex = disciplineSortMap.get(aValue) ?? 9999
          const bIndex = disciplineSortMap.get(bValue) ?? 9999
          if (aIndex !== bIndex) {
            return aIndex - bIndex
          }
        }
        
        // 如果是工作包字段，使用工作包排序映射
        if (field === 'work_package') {
          const aIndex = workPackageSortMap.get(aValue) ?? 9999
          const bIndex = workPackageSortMap.get(bValue) ?? 9999
          if (aIndex !== bIndex) {
            return aIndex - bIndex
          }
        }
        
        // 其他字段或未找到排序映射时，按字母顺序排序
        return aValue.localeCompare(bValue)
      })
      
      sortedChildren.forEach(([, childNode]) => {
        const newPath = node.level >= 0 ? [...path, node.value] : path
        traverse(childNode, newPath, currentExpanded && parentExpanded)
      })
      
      // 然后添加当前节点的activities（叶子节点），只有在展开状态下才添加
      if (currentExpanded && parentExpanded && node.activities.length > 0) {
        items.push(...node.activities)
      }
    }
    
    traverse(root)
    
    return { items, groups }
  }, [loadedItems, groupBy, activityCodeDescriptions, expandedGroups, expandToLevel, disciplineSortMap, workPackageSortMap])

  // 处理分组折叠/展开（需要在tableColumns之前定义）
  const handleGroupToggle = useCallback((groupId: string, currentExpanded?: boolean) => {
    // 保存当前滚动位置
    const scrollContainer = tableBodyScrollRef.current
    const savedScrollTop = scrollContainer?.scrollTop || 0
    
    setExpandedGroups(prev => {
      const newMap = new Map(prev)
      const newExpanded = !currentExpanded
      // 确保groupId格式正确（应该包含__group__前缀）
      const normalizedGroupId = groupId.startsWith('__group__') ? groupId : `__group__${groupId}`
      newMap.set(normalizedGroupId, newExpanded)
      
      // 递归处理：如果折叠，则折叠所有子分组；如果展开，则展开所有子分组
      if (!newExpanded) {
        // 折叠时：找到所有子分组并折叠
        groupedData.items.forEach((item: any) => {
          if (item.isGroupHeader && item.id) {
            // 检查是否是当前分组的子分组（通过比较groupValues）
            if (item.groupValues && item.groupValues.length > 0) {
              const currentGroupValues = groupedData.items.find((i: any) => i.id === groupId)?.groupValues || []
              // 如果item的groupValues是当前分组groupValues的前缀加上更多元素，则是子分组
              if (item.groupValues.length > currentGroupValues.length &&
                  item.groupValues.slice(0, currentGroupValues.length).join('|') === currentGroupValues.join('|')) {
                newMap.set(item.id, false)
              }
            }
          }
        })
      } else {
        // 展开时：展开所有直接子分组（只展开一层）
        groupedData.items.forEach((item: any) => {
          if (item.isGroupHeader && item.id && item.id !== groupId) {
            if (item.groupValues && item.groupValues.length > 0) {
              const currentGroupValues = groupedData.items.find((i: any) => i.id === groupId)?.groupValues || []
              // 如果是直接子分组（比当前分组多一层）
              if (item.groupValues.length === currentGroupValues.length + 1 &&
                  item.groupValues.slice(0, currentGroupValues.length).join('|') === currentGroupValues.join('|')) {
                newMap.set(item.id, true)
              }
            }
          }
        })
      }
      
      return newMap
    })
    
    // 在下一帧恢复滚动位置
    setTimeout(() => {
      if (scrollContainer) {
        scrollContainer.scrollTop = savedScrollTop
      }
    }, 0)
  }, [groupedData])

  // 处理列宽调整开始
  const handleColumnResizeStart = useCallback((e: React.MouseEvent, colKey: string) => {
    e.preventDefault()
    e.stopPropagation()
    
    // 防止重复开始拖拽
    if (columnResizeRef.current.active) return

    const scrollEl = tableBodyScrollRef.current
    const thEl = (e.currentTarget as HTMLElement | null)?.closest?.('th') as HTMLTableCellElement | null
    // 以真实 th 的 data-col-key 为准，避免"拖动A列却更新成B列"的错位问题
    const realColKey = (thEl?.getAttribute?.('data-col-key') || colKey) as string

    const currentWidth = columnWidthsRef.current[realColKey] || AVAILABLE_COLUMNS.find(c => c.key === realColKey)?.width || 120

    // 预先收集所有需要同步更新的 col 元素和表格（包含主表/固定列/表头/表体）
    const colEls: HTMLTableColElement[] = []
    const allTables: HTMLTableElement[] = []
    const initialColumnWidths: Record<string, number> = {}
    
    if (scrollEl) {
      const tableRoot = scrollEl.closest('.daily-report-management-table') || tableContainerRef.current
      if (tableRoot) {
        const tables = Array.from(tableRoot.querySelectorAll('table')) as HTMLTableElement[]
        allTables.push(...tables)
        
        // 在拖拽开始时就读取并保存所有列的当前宽度，避免后续读取时出现不一致
        if (tables.length > 0) {
          const firstTable = tables[0]
          const colgroup = firstTable.querySelector('colgroup')
          
          orderedVisibleColumns.forEach((colKey) => {
            const headerCell = firstTable.querySelector(`thead th[data-col-key="${colKey}"]`) as HTMLTableCellElement | null
            if (headerCell) {
              const idx = headerCell.cellIndex
              if (idx >= 0) {
                const col = colgroup?.querySelector(`col:nth-child(${idx + 1})`) as HTMLTableColElement | null
                if (col) {
                  // 优先读取 style.width，如果没有则读取 offsetWidth
                  const styleWidth = col.style.width
                  if (styleWidth) {
                    const parsed = parseFloat(styleWidth)
                    if (!isNaN(parsed)) {
                      initialColumnWidths[colKey] = parsed
                    } else {
                      initialColumnWidths[colKey] = col.offsetWidth || headerCell.offsetWidth || 120
                    }
                  } else {
                    initialColumnWidths[colKey] = col.offsetWidth || headerCell.offsetWidth || 120
                  }
                } else {
                  initialColumnWidths[colKey] = headerCell.offsetWidth || 120
                }
              }
            } else {
              // 如果找不到 headerCell，使用 ref 或默认值
              const def = AVAILABLE_COLUMNS.find(c => c.key === colKey)
              initialColumnWidths[colKey] = columnWidthsRef.current[colKey] || def?.width || 120
            }
          })
        }
        
        // 收集当前列的 col 元素
        tables.forEach((table) => {
          // 只用 header 的 data-col-key 来定位列（更稳定，避免行渲染/虚拟化导致 cellIndex 偏移）
          const headerCell = table.querySelector(`thead th[data-col-key="${realColKey}"]`) as HTMLTableCellElement | null
          const cell = headerCell
          if (!cell) return
          const idx = cell.cellIndex
          if (idx < 0) return
          const col = table.querySelector(`colgroup col:nth-child(${idx + 1})`) as HTMLTableColElement | null
          if (col) colEls.push(col)
        })
      }
    }

    // 创建拖拽辅助线（可选，但能显著提升"拖动很明确"的体验）
    let guideEl: HTMLDivElement | null = null
    if (scrollEl) {
      const rect = scrollEl.getBoundingClientRect()
      guideEl = document.createElement('div')
      guideEl.className = 'column-resize-guide'
      // Excel 风格：用 fixed 直接跟随鼠标 clientX，避免 AntD 表头/滚动结构导致坐标计算偏差
      guideEl.style.position = 'fixed'
      guideEl.style.top = `${Math.max(0, rect.top)}px`
      guideEl.style.height = `${Math.max(0, rect.height)}px`
      guideEl.style.width = '2px'
      guideEl.style.background = '#1677ff'
      guideEl.style.opacity = '0.65'
      guideEl.style.pointerEvents = 'none'
      guideEl.style.zIndex = '1001'
      guideEl.style.left = `${e.clientX}px`
      document.body.appendChild(guideEl)
    }

    // 写入 ref（拖拽过程中不走 React state，避免卡顿）
    columnResizeRef.current.active = true
    columnResizeRef.current.colKey = realColKey
    columnResizeRef.current.startX = e.clientX
    columnResizeRef.current.startWidth = currentWidth
    columnResizeRef.current.currentWidth = currentWidth
    columnResizeRef.current.colEls = colEls
    columnResizeRef.current.guideEl = guideEl
    columnResizeRef.current.initialColumnWidths = initialColumnWidths
    columnResizeRef.current.allTables = allTables

    setIsColumnResizing(true)

    // Excel 风格：拖动过程中只移动"辅助线"，不实时改表格列宽（避免巨表反复重排导致卡顿）
    const minWidth = 1 // 几乎不设最小值（只防止出现 0/负数）
    const maxWidth = 5000

    const moveGuide = (clientX: number) => {
      if (columnResizeRef.current.guideEl) {
        columnResizeRef.current.guideEl.style.left = `${clientX}px`
      }
    }

    const onMouseMove = (ev: MouseEvent) => {
      if (!columnResizeRef.current.active) return
      if (columnResizeRef.current.rafId) {
        cancelAnimationFrame(columnResizeRef.current.rafId)
      }
      columnResizeRef.current.rafId = requestAnimationFrame(() => {
        const deltaX = ev.clientX - columnResizeRef.current.startX
        const nextWidth = Math.max(minWidth, Math.min(maxWidth, columnResizeRef.current.startWidth + deltaX))
        columnResizeRef.current.currentWidth = nextWidth
        moveGuide(ev.clientX)
      })
    }

    const endResize = () => {
      if (!columnResizeRef.current.active) return

      // 清理事件监听
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', endResize)

      // 清理动画帧
      if (columnResizeRef.current.rafId) {
        cancelAnimationFrame(columnResizeRef.current.rafId)
        columnResizeRef.current.rafId = null
      }

      // 清理辅助线
      if (columnResizeRef.current.guideEl && columnResizeRef.current.guideEl.parentNode) {
        columnResizeRef.current.guideEl.parentNode.removeChild(columnResizeRef.current.guideEl)
      }
      columnResizeRef.current.guideEl = null

      // 恢复全局样式
      document.body.style.cursor = ''
      document.body.style.userSelect = ''

      // 结束时一次性应用列宽（只改当前列，不影响其他列宽）
      const finalColKey = columnResizeRef.current.colKey
      const finalWidth = columnResizeRef.current.currentWidth
      
      if (!finalColKey) {
        columnResizeRef.current.active = false
        columnResizeRef.current.colKey = null
        columnResizeRef.current.colEls = []
        columnResizeRef.current.initialColumnWidths = {}
        columnResizeRef.current.allTables = []
        setIsColumnResizing(false)
        return
      }

      // 使用拖拽开始时保存的初始宽度，避免在设置过程中读取 DOM 导致的不一致
      const initialWidths = columnResizeRef.current.initialColumnWidths
      const tables = columnResizeRef.current.allTables
      
      if (tables.length > 0 && Object.keys(initialWidths).length > 0) {
        // 基于初始宽度计算新的总宽度（当前列使用新宽度，其他列保持初始宽度）
        const newColumnWidths: Record<string, number> = { ...initialWidths }
        newColumnWidths[finalColKey] = finalWidth
        
        const newTotalWidth = orderedVisibleColumns.reduce((sum, colKey) => {
          return sum + (newColumnWidths[colKey] || 120)
        }, 0)
        
        // 设置标志位，防止 ResizeObserver 触发循环
        isUpdatingColumnWidthsRef.current = true
        
        try {
          // 关键修复：先同步更新 DOM，避免拖宽时的抖动
          // 立即更新所有表格的宽度和列宽，确保视觉上平滑
          tables.forEach((table) => {
            const tableEl = table as HTMLElement
            // 先设置总宽度，锁定表格宽度，防止 Chrome 自动扩展
            tableEl.style.width = `${newTotalWidth}px`
            tableEl.style.minWidth = `${newTotalWidth}px`
            tableEl.style.maxWidth = `${newTotalWidth}px`
          })
          
          // 然后设置当前列的宽度，确保列宽严格等于设置的值
          const px = `${finalWidth}px`
          columnResizeRef.current.colEls.forEach((col) => {
            col.style.width = px
            col.style.minWidth = px
            col.style.maxWidth = px
          })
          
          // 最后更新 state（延迟一帧，让 DOM 更新先完成）
          requestAnimationFrame(() => {
            setColumnWidths((prev) => ({ ...prev, [finalColKey]: finalWidth }))
            // 重置标志位
            requestAnimationFrame(() => {
              isUpdatingColumnWidthsRef.current = false
            })
          })
        } catch (e) {
          // 确保即使出错也重置标志位
          isUpdatingColumnWidthsRef.current = false
        }
      } else {
        // 设置标志位，防止 ResizeObserver 触发循环
        isUpdatingColumnWidthsRef.current = true
        
        try {
          // 降级方案：如果没有保存的初始宽度，直接设置 col 元素宽度
          const px = `${finalWidth}px`
          columnResizeRef.current.colEls.forEach((col) => {
            col.style.width = px
            col.style.minWidth = px
            col.style.maxWidth = px
          })
          
          // 延迟更新 state
          requestAnimationFrame(() => {
            setColumnWidths((prev) => ({ ...prev, [finalColKey]: finalWidth }))
            // 重置标志位
            requestAnimationFrame(() => {
              isUpdatingColumnWidthsRef.current = false
            })
          })
        } catch (e) {
          // 确保即使出错也重置标志位
          isUpdatingColumnWidthsRef.current = false
        }
      }

      // 清理状态
      columnResizeRef.current.active = false
      columnResizeRef.current.colKey = null
      columnResizeRef.current.colEls = []
      columnResizeRef.current.initialColumnWidths = {}
      columnResizeRef.current.allTables = []
      setIsColumnResizing(false)
    }

    document.addEventListener('mousemove', onMouseMove, { passive: true })
    document.addEventListener('mouseup', endResize)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [orderedVisibleColumns])

  // 构建Table列配置
  const tableColumns = useMemo(() => {
    return orderedVisibleColumns.map((colKey, colIndex) => {
      const colDef = AVAILABLE_COLUMNS.find(c => c.key === colKey)
      if (!colDef) {
        return {
          title: colKey,
          dataIndex: colKey,
          key: colKey,
          width: columnWidths[colKey] || 120,
        }

      }
      const width = columnWidths[colKey] || colDef.width
      return {
        title: (
          <div style={{ 
            position: 'relative', 
            paddingRight: 0,
            display: 'flex',
            alignItems: 'center',
            height: '100%',
            width: '100%',
          }}>
            <span style={{ paddingRight: 8, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{colDef.title}</span>
            {/* 列宽调整分隔线 - 所有列都可以调整宽度 */}
            <div
              className="column-resizer"
              onMouseDown={(e) => handleColumnResizeStart(e, colKey)}
              style={{
                position: 'absolute',
                right: -9,
                top: 0,
                bottom: 0,
                width: '6px',
                cursor: 'col-resize',
                zIndex: 10,
              }}
            />
          </div>
        ),
        dataIndex: colKey,
        key: colKey,
        width: width,
        fixed: colDef.fixed,
        align: colDef.align,
        onHeaderCell: () => ({ ['data-col-key']: colKey } as any),
        onCell: (record: any) => {
          // 分组行：整行同步底纹（含右侧填报固定列），避免"填报区没有底纹"
          if (record?.isGroupHeader) {
            const level = record.level ?? 0
            const bg = getGroupRowBackgroundColor(level)
            const baseStyle: React.CSSProperties = { backgroundColor: bg }

            // 分组行的"作业ID"列使用绝对定位填充，需要 td: position: relative + 去 padding
            if (colKey === 'activity_id') {
              return {
                ['data-col-key']: colKey,
                style: {
                  ...baseStyle,
                  position: 'relative',
                  padding: 0,
                } as React.CSSProperties,
              } as any
            }

            return ({ ['data-col-key']: colKey, style: baseStyle } as any)
          }

          // 验收列：仅活动行可操作；inspection 子行用于显示聚合标识
          if (mode === 'INSPECTION' && colKey === 'inspection_add') {
            if (record.isGroupHeader || record.isWorkStepRow) return { ['data-col-key']: colKey } as any
            return ({ ['data-col-key']: colKey, style: { backgroundColor: 'transparent' } } as any)
          }

          // 普通活动行：为填报列添加底纹
          if (colKey === 'mp_manpower' || colKey === 'mp_machinery' || colKey === 'vfact_achieved' || colKey === 'mp_remarks') {
            // 工作步骤行：根据工作步骤的值和类型设置底纹
            if (record.isWorkStepRow) {
              const hasValue = record.work_step_achieved !== null && record.work_step_achieved !== undefined && record.work_step_achieved !== 0
              const isKey = record.is_key_quantity
              
              const cellStyle: React.CSSProperties = {
                backgroundColor: hasValue 
                  ? (isKey ? '#e6f7e6' : '#f0f0f0')  // 关键工作步骤绿色，非关键灰色
                  : 'transparent',
              }
              
              return ({ ['data-col-key']: colKey, style: cellStyle } as any)
            }
            
            const activityId = record.activity_id
            if (activityId) {
              const edit = reportEdit[activityId] || {}
              let hasValue = false
              
              if (colKey === 'mp_remarks') {
                const value = edit.remarks ?? ''
                hasValue = value !== '' && value !== null && value !== undefined
              } else if (colKey === 'vfact_achieved' && mode === 'VFACT') {
                // VFACT 模式：检查是否有工作步骤有值，或者向后兼容的 achieved 字段有值
                if (edit.work_steps && edit.work_steps.length > 0) {
                  hasValue = edit.work_steps.some(ws => ws.achieved !== null && ws.achieved !== undefined && ws.achieved !== 0)
                } else {
                  hasValue = edit.achieved !== null && edit.achieved !== undefined && edit.achieved !== 0
                }
              } else {
                const value = colKey === 'mp_manpower' ? edit.manpower 
                  : colKey === 'mp_machinery' ? edit.machinery 
                  : edit.achieved
                hasValue = value !== null && value !== undefined && value !== 0
              }
              
              const cellStyle: React.CSSProperties = {
                backgroundColor: hasValue ? '#e6f7e6' : 'transparent',
              }
              
              return ({ ['data-col-key']: colKey, style: cellStyle } as any)
            }
          }

          return ({ ['data-col-key']: colKey } as any)
        },
        // 注意：不要在虚拟列表场景下返回“恒 false”的 shouldCellUpdate（会导致滚动复用时内容不刷新）
        render: (text: any, record: any) => {
          // 处理状态列
          if (colKey === 'status') {
            if (record.isGroupHeader || record.isWorkStepRow) return null;
            const activityId = record.activity_id;
            const status = (activityId && reportEdit[activityId]?.system_status) || record.system_status || record.status || 'Not Started';
            
            // P6 风格圆角长方形图标
            const roundedRectStyle: React.CSSProperties = {
              width: '14px',
              height: '10px',
              borderRadius: '2px',
              display: 'inline-block',
              border: '1px solid rgba(0,0,0,0.3)',
              verticalAlign: 'middle'
            }

            if (status === 'Completed') {
              return <span style={{ ...roundedRectStyle, backgroundColor: '#0000FF' }} title="Completed" />;
            } else if (status === 'In Progress') {
              return <span style={{ 
                ...roundedRectStyle, 
                background: 'linear-gradient(to right, #0000FF 50%, #00FF00 50%)' 
              }} title="In Progress" />;
            } else {
              return <span style={{ ...roundedRectStyle, backgroundColor: '#00FF00' }} title="Not Started" />;
            }
          }

          // 处理分组行
          if (record.isGroupHeader) {
            const level = record.level ?? 0
            const leftBarColor = getGroupLeftBarColor(level)
            const bgColor = getGroupRowBackgroundColor(level)
            
            // 作业ID列：显示左侧竖条，内容为空
            if (colKey === 'activity_id') {
              return (
                <div 
                  className="activity-id-group-cell"
                  style={{
                    backgroundColor: bgColor,
                    borderLeft: `4px solid ${leftBarColor}`,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    margin: 0,
                    padding: 0,
                  }} 
                />
              )
            }
            
            // 描述列（第二列或title列）显示分组信息
            const isDescriptionColumn = colIndex === 1 || colKey === 'title' || colKey === 'description'
            if (isDescriptionColumn) {
              // 计算缩进：每层级缩进1ch（与GanttChart保持一致）
              const indentLevel = level
              const paddingLeft = indentLevel > 0 ? `${indentLevel}ch` : undefined
              
              const isExpanded = record.isExpanded !== false
              const displayText = `${record.groupKey || record.text} (${record.itemCount || 0})`
              
              return (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    fontWeight: 600,
                    backgroundColor: 'inherit',
                    // 关键：td 已经有 padding（2px 6px），这里不要再加一次，否则分组行会被“双重 padding”撑高
                    padding: 0,
                    margin: 0,
                    paddingLeft: paddingLeft ? `calc(${paddingLeft} + 6px)` : '6px',
                    cursor: 'pointer',
                    fontSize: 11,
                    // 行高由 td 控制（22px）。这里保持“填满单元格 + 垂直居中”，不要用 12px 去压内容高度。
                    height: '100%',
                    lineHeight: '18px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  onClick={() => {
                    const groupId = record.id || record.key
                    handleGroupToggle(groupId, isExpanded)
                  }}
                >
                  <span style={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    marginRight: '4px',
                    fontSize: '10px',
                    width: '12px',
                    height: '12px',
                    flexShrink: 0,
                  }}>
                    {isExpanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
                  </span>
                  <span style={{ 
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {displayText}
                  </span>
                </div>
              )
            }
            
            // 其他列：继承背景色，不显示内容
            return null
          }

          // 验收列（验收日报）：活动行显示汉堡按钮（RFI 清单）+ “+”按钮（新增）
          if (mode === 'INSPECTION' && colKey === 'inspection_add') {
            if (record.isGroupHeader || record.isWorkStepRow) return null
            const activityId = record.activity_id
            if (!activityId) return null
            return (
              <Space size={4}>
                <Button
                  type="text"
                  size="small"
                  icon={<MenuOutlined />}
                  title="本作业 RFI 清单"
                  onClick={() => setRfiListDrawerActivityId(activityId)}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<PlusOutlined />}
                  title="增加一条验收记录"
                  onClick={() => {
                    setSelectedActivityForInspection(record as Activity)
                    setInspectionModalVisible(true)
                  }}
                />
              </Space>
            )
          }

          // 日报填报列（MP/VFACT 两页）：仅对"活动行"显示；编辑权限由 mode 决定
          if (colKey === 'mp_manpower' || colKey === 'mp_machinery' || colKey === 'vfact_achieved' || colKey === 'mp_remarks') {
            // 如果是分组行，也需要显示（但不可编辑），并添加底纹
            if (record.isGroupHeader) {
              // 分组行底纹已由 onCell 统一处理（含固定列/填报列），这里返回空内容即可
              return null
            }
            
            // 工作步骤行：只在 vfact_achieved 列显示，其他列返回空
            if (record.isWorkStepRow) {
              if (colKey !== 'vfact_achieved') {
                return null  // 工作步骤行在其他填报列不显示
              }
              
              const activityId = record.parentActivityId || record.activity_id
              const workStepDescription = record.work_step_description
              const isKey = record.is_key_quantity
              const achieved = record.work_step_achieved
              // 不显示0，只显示有值的数据（空值显示为空，不显示0）
              const displayValue = (achieved !== null && achieved !== undefined && achieved !== 0) ? achieved : undefined
              const isEditable = mode === 'VFACT'
              
              return (
                <InputNumber
                  min={0}
                  style={{ 
                    width: '100%',
                    border: 'none',
                    boxShadow: 'none',
                    padding: 0,
                    fontSize: '11px',
                    backgroundColor: 'transparent',
                    borderRadius: 0,
                  }}
                  controls={false}
                  value={displayValue}
                  disabled={!isEditable}
                  onChange={(v) => {
                    if (!isEditable) return
                    const num = typeof v === 'number' ? v : (v ? Number(v) : undefined)
                    updateWorkStepValue(activityId, workStepDescription, num, isKey)
                  }}
                  placeholder="0"
                />
              )
            }
            
            const activityId = record.activity_id
            if (!activityId) return null
            
            const edit = reportEdit[activityId] || {}
            const isEditable =
              (mode === 'MP' && (colKey === 'mp_manpower' || colKey === 'mp_machinery' || colKey === 'mp_remarks')) ||
              (mode === 'VFACT' && colKey === 'vfact_achieved')
            
            // VFACT 模式：activity 行本身不显示 vfact_achieved 输入框（所有量都放在工作步骤行中）
            if (mode === 'VFACT' && colKey === 'vfact_achieved') {
              // Activity 行完全不显示完成量输入框，所有量都通过工作步骤行填写
              return null
            }

            // 备注列
            if (colKey === 'mp_remarks') {
              const value = edit.remarks ?? ''
              return (
                <Input
                  style={{ 
                    width: '100%',
                    border: 'none',
                    boxShadow: 'none',
                    padding: 0,
                    fontSize: '11px',
                    backgroundColor: 'transparent',
                    borderRadius: 0,
                  }}
                  value={value}
                  disabled={!isEditable}
                  onChange={(e) => {
                    if (!isEditable) return
                    updateReportValue(activityId, { remarks: e.target.value })
                  }}
                  placeholder=""
                />
              )
            }

            // MP 模式或其他列：使用原来的逻辑
            const value = colKey === 'mp_manpower' ? edit.manpower 
              : colKey === 'mp_machinery' ? edit.machinery 
              : edit.achieved
            // 将字符串转换为数字，InputNumber会自动格式化（去除尾随0）
            // 确保 0 不会变成科学计数法
            const displayValue = value !== null && value !== undefined 
              ? (typeof value === 'string' 
                  ? (value === '0' || value === '0.0' || parseFloat(value) === 0 ? 0 : parseFloat(value))
                  : (value === 0 ? 0 : value))
              : undefined

            return (
              <InputNumber
                min={0}
                style={{ 
                  width: '100%',
                  border: 'none',
                  boxShadow: 'none',
                  padding: 0,
                  fontSize: '11px',
                  backgroundColor: 'transparent',
                  borderRadius: 0,
                }}
                controls={false}
                value={displayValue}
                disabled={!isEditable}
                onChange={(v) => {
                  if (!isEditable) return
                  const num = typeof v === 'number' ? v : (v ? Number(v) : undefined)
                  if (colKey === 'mp_manpower') updateReportValue(activityId, { manpower: num })
                  else if (colKey === 'mp_machinery') updateReportValue(activityId, { machinery: num })
                  else updateReportValue(activityId, { achieved: num })
                }}
              />
            )
          }
          // 普通活动行：对描述列添加缩进（参考 ActivityListAdvanced）
          const isDescriptionColumn = colIndex === 1 || colKey === 'title' || colKey === 'description'
          if (isDescriptionColumn) {
            // 工作步骤行：额外缩进一层，显示层级关系
            if (record.isWorkStepRow) {
              const baseIndent = groupBy.length > 0 ? groupBy.length : 0
              const paddingLeft = `${baseIndent + 2}ch`  // 工作步骤行比 activity 行多缩进 2ch，更明显
              return (
                <div style={{ paddingLeft, fontStyle: 'italic', color: '#666', fontSize: '11px' }}>
                  {text || record.work_step_description}
                </div>
              )
            }
            
            // Activity 行：根据分组层级缩进
            if (groupBy.length > 0) {
              // 作业行缩进 = 最大分组层级 + 1ch（与 GanttChart 保持一致）
              // maxGroupLevel = groupBy.length - 1，所以缩进 = groupBy.length
              const paddingLeft = `${groupBy.length}ch`
              return (
                <div style={{ paddingLeft }}>
                  {text}
                </div>
              )
            }
          }
          
          // 工作步骤行：activity_id 列显示为空（因为它是子行）
          if (record.isWorkStepRow && colKey === 'activity_id') {
            return null
          }
          
          // Activity 行：在MP模式下显示预估总量和完成量，在VFACT模式下不显示（这些数据在工作步骤行中显示）
          if (!record.isGroupHeader && !record.isWorkStepRow && (colKey === 'key_qty' || colKey === 'completed')) {
            // VFACT模式：Activity行不显示，这些数据在工作步骤行中显示
            if (mode === 'VFACT') {
              return null
            }
            // MP模式：Activity行显示，从后端返回的 key_qty 和 completed 获取
          }
          
          // 处理工程量字段：显示时保留3位小数（仅用于非输入框的显示）
          // 注意：输入框（InputNumber）允许20位精度，这里只格式化纯文本显示
          // 必须在处理日期字段之前处理，因为工程量字段可能为 null/undefined
          const volumeFields = ['key_qty', 'completed']
          if (volumeFields.includes(colKey)) {
            // 对于工作步骤行、验收行和Activity行，直接从 record 获取值（因为 text 参数可能不准确）
            const value = (record.isWorkStepRow || !record.isGroupHeader) ? record[colKey] : text
            // 如果是 null 或 undefined，返回空字符串
            if (value === null || value === undefined || value === '') {
              return ''
            }
            // 如果是数字或可转换为数字的字符串，格式化显示
            if (typeof value === 'number' || (typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '')) {
              return formatQuantity(value)
            }
            // 其他情况返回原值
            return value
          }
          
          // 处理日期字段
          if (text === null || text === undefined) return '-'
          const dateFields = ['start_date', 'finish_date', 'baseline1_start_date', 'baseline1_finish_date', 
                             'actual_start_date', 'actual_finish_date']
          if (dateFields.includes(colKey) && typeof text === 'string' && text.includes('T')) {
            return dayjs(text).format('YYYY-MM-DD')
          }
          
          return text
        }
      }
    })
  }, [orderedVisibleColumns, columnWidths, handleGroupToggle, updateReportValue, mode, reportEdit])

  // Excel 风格：拖动列宽不应影响其它列。
  // 计算所有列宽的总和，作为 scroll.x 的值，强制表格宽度等于列宽之和
  // 这样 AntD 就不会自动调整其他列宽来填充容器
  const tableScrollX = useMemo(() => {
    const totalWidth = orderedVisibleColumns.reduce((sum, colKey) => {
      const colDef = AVAILABLE_COLUMNS.find(c => c.key === colKey)
      const width = columnWidths[colKey] || colDef?.width || 120
      return sum + width
    }, 0)
    return totalWidth
  }, [orderedVisibleColumns, columnWidths])

  // 关键修复：在列宽或可见列变化时，同步更新所有表格的 col 元素宽度
  // 这确保在分组变化或其他导致表格重新渲染的情况下，列宽能正确应用
  // 修复 Chrome 中列宽不断扩大的问题：确保表格宽度严格等于列宽之和
  useEffect(() => {
    // 如果正在更新列宽（拖拽调整中），跳过此 effect
    if (isUpdatingColumnWidthsRef.current || isColumnResizing) return
    
    // 延迟执行，确保表格已经渲染
    const timer = setTimeout(() => {
      const container = tableContainerRef.current
      if (!container) return
      
      const tables = Array.from(container.querySelectorAll('table')) as HTMLTableElement[]
      if (tables.length === 0) return
      
      // 设置标志位，防止 ResizeObserver 触发循环
      isUpdatingColumnWidthsRef.current = true
      
      try {
        // 计算总宽度（所有列宽之和）
        const totalWidth = orderedVisibleColumns.reduce((sum, colKey) => {
          const colDef = AVAILABLE_COLUMNS.find(c => c.key === colKey)
          const width = columnWidths[colKey] || colDef?.width || 120
          return sum + width
        }, 0)
        
        // 使用第一个表格的 colgroup 作为参考
        const firstTable = tables[0]
        const colgroup = firstTable.querySelector('colgroup')
        if (!colgroup) {
          isUpdatingColumnWidthsRef.current = false
          return
        }
        
        // 批量更新所有表格的列宽和表格宽度
        tables.forEach((table) => {
          const tableEl = table as HTMLElement
          const tableColgroup = table.querySelector('colgroup')
          if (!tableColgroup) return
          
          // 关键修复：先设置表格总宽度，锁定表格宽度，防止 Chrome 自动扩展
          // 使用 table-layout: fixed 时，表格宽度必须明确设置
          tableEl.style.width = `${totalWidth}px`
          tableEl.style.minWidth = `${totalWidth}px`
          tableEl.style.maxWidth = `${totalWidth}px`
          
          // 然后更新每列的宽度
          orderedVisibleColumns.forEach((colKey) => {
            const headerCell = table.querySelector(`thead th[data-col-key="${colKey}"]`) as HTMLTableCellElement | null
            if (!headerCell) return
            
            const idx = headerCell.cellIndex
            if (idx < 0) return
            
            const col = tableColgroup.querySelector(`col:nth-child(${idx + 1})`) as HTMLTableColElement | null
            if (col) {
              const colDef = AVAILABLE_COLUMNS.find(c => c.key === colKey)
              const width = columnWidths[colKey] || colDef?.width || 120
              // 确保列宽严格等于设置的值，防止 Chrome 自动调整
              col.style.width = `${width}px`
              col.style.minWidth = `${width}px`
              col.style.maxWidth = `${width}px`
            }
          })
        })
      } finally {
        // 使用 requestAnimationFrame 确保 DOM 更新完成后再重置标志位
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            isUpdatingColumnWidthsRef.current = false
          })
        })
      }
    }, 100)
    
    return () => clearTimeout(timer)
  }, [orderedVisibleColumns, columnWidths, groupBy, isColumnResizing])
  
  // 构建完整的表格数据源（从groupedData转换）
  const fullTableDataSource = useMemo(() => {
    if (!groupedData.items.length) return []
    
    const result: any[] = []
    
    groupedData.items.forEach((item: any) => {
      if (item.isGroupHeader) {
        // 分组行
        result.push({
          key: item.id,
          isGroupHeader: true,
          id: item.id,
          groupKey: item.groupKey,
          text: item.groupKey,
          itemCount: item.itemCount,
          isExpanded: item.isExpanded !== false,
          ...item // 保留所有原始属性
        })
      } else {
        // 普通活动行
        const edit = reportEdit[item.activity_id] || {}
        const activity = item as Activity
        
        // 先添加 activity 行
        result.push({
          key: item.id || item.activity_id,
          mp_manpower: edit.manpower,
          mp_machinery: edit.machinery,
          mp_remarks: edit.remarks,
          vfact_achieved: edit.achieved,
          // MP模式：Activity行显示预估总量和完成量
          // 性能优化：只使用 edit 中的值（从后端 API 返回，已实时更新），不再使用 item 中的备用值
          key_qty: mode === 'MP' ? (edit.key_qty ?? null) : undefined,
          completed: mode === 'MP' ? (edit.completed ?? null) : undefined,
          ...item
        })
        
        // VFACT 模式：如果有工作步骤定义，展开为独立行
        if (mode === 'VFACT' && activity.work_package) {
          const workStepDefines = workStepDefinesCache[activity.work_package] || []
          const currentWorkSteps = edit.work_steps || []
          
          // 确保 is_key_quantity 字段正确（处理可能的字段名不一致）
          const normalizedDefines = workStepDefines.map((ws: any) => ({
            ...ws,
            is_key_quantity: ws.is_key_quantity !== undefined ? Boolean(ws.is_key_quantity) : (Boolean(ws.isKeyQuantity) || false),
          }))
          
          // 过滤工作步骤：默认只显示关键工作步骤，除非用户选择显示所有
          const visibleWorkSteps = normalizedDefines.filter(ws => 
            showAllWorkSteps || Boolean(ws.is_key_quantity)
          )
          
          // 调试日志：检查过滤结果
          if (visibleWorkSteps.length > 0 && workStepDefines.length > 0) {
            const keyCount = visibleWorkSteps.filter((ws: any) => ws.is_key_quantity).length
            const nonKeyCount = visibleWorkSteps.filter((ws: any) => !ws.is_key_quantity).length
            const totalKey = normalizedDefines.filter((ws: any) => ws.is_key_quantity).length
            const totalNonKey = normalizedDefines.filter((ws: any) => !ws.is_key_quantity).length
            logger.log(`[WorkSteps] Activity ${activity.activity_id} (${activity.work_package}): ${visibleWorkSteps.length}/${workStepDefines.length} visible (${keyCount} key, ${nonKeyCount} non-key) of total (${totalKey} key, ${totalNonKey} non-key)`)
          }
          
          // 为每个工作步骤创建一行
          visibleWorkSteps.forEach((wsDefine) => {
            const wsValue = currentWorkSteps.find(ws => ws.work_step_description === wsDefine.work_step_description)
            const isKey = Boolean(wsDefine.is_key_quantity)
            
            // 调试日志：检查匹配结果
            if (currentWorkSteps.length > 0) {
              logger.log(`[WorkStepMatch] Activity ${activity.activity_id}, WorkStep "${wsDefine.work_step_description}":`, {
                found: !!wsValue,
                achieved: wsValue?.achieved,
                cumulative_achieved: wsValue?.cumulative_achieved,
                estimated_total: wsValue?.estimated_total,
                is_key_quantity: isKey,
                allWorkSteps: currentWorkSteps.map(ws => ({ 
                  desc: ws.work_step_description, 
                  achieved: ws.achieved,
                  cumulative_achieved: ws.cumulative_achieved,
                  estimated_total: ws.estimated_total,
                  is_key_quantity: ws.is_key_quantity
                }))
              })
            }
            
            // 构建工作步骤行数据
            // 重要：
            // 1. work_step_achieved 必须从 vfactdb 中获取（按 work_step_description 匹配），不能继承父 activity 的 completed 或 achieved
            // 2. key_qty（预估总量）必须从 API 返回的 estimated_total 获取，不能继承父 activity 的 key_qty
            //    - 关键工程量：从 VolumeControl 获取
            //    - 非关键工程量：从 WorkStepVolume 获取
            const workStepRow: any = {
              key: `${item.activity_id}__workstep__${wsDefine.work_step_description}`,
              isWorkStepRow: true,  // 标记为工作步骤行
              parentActivityId: item.activity_id,
              activity_id: item.activity_id,  // 保留父 activity_id，用于数据关联
              work_step_description: wsDefine.work_step_description,
              is_key_quantity: isKey,
              work_step_achieved: wsValue?.achieved,  // 从 vfactdb 中获取的完成量（按 work_step_description 匹配）
              // 对于 key_qty（预估总量），使用 estimated_total（关键从 VolumeControl，非关键从 WorkStepVolume）
              key_qty: wsValue?.estimated_total ?? (wsValue === undefined ? null : undefined),  // 如果 wsValue 存在但 estimated_total 为 undefined，保持 undefined 以便后续处理
              // 对于 completed（累计完成量），使用 cumulative_achieved（所有日期的总和）
              completed: wsValue?.cumulative_achieved ?? (wsValue === undefined ? null : undefined),  // 如果 wsValue 存在但 cumulative_achieved 为 undefined，保持 undefined 以便后续处理
              // 继承父 activity 的其他属性（用于显示）
              title: wsDefine.work_step_description,  // 工作步骤描述作为 title
              block: item.block,
              discipline: item.discipline,
              work_package: item.work_package,
              scope: item.scope,
              project: item.project,
              subproject: item.subproject,
              implement_phase: item.implement_phase,
              train: item.train,
              unit: item.unit,
              quarter: item.quarter,
              main_block: item.main_block,
            }
            
            // 继承父 activity 的其他属性，但排除可能覆盖完成量和预估总量的字段
            Object.keys(item).forEach((key) => {
              // 排除这些字段：
              // - id相关：activity_id, title, key, id
              // - 完成量相关：completed, achieved（这些会覆盖 work_step_achieved）
              // - 预估总量相关：key_qty（不能继承，必须从 API 返回的 estimated_total 获取）
              // - work_step_achieved 已经正确设置，不需要继承
              if (!['activity_id', 'title', 'key', 'id', 'completed', 'achieved', 'work_step_achieved', 'key_qty'].includes(key)) {
                workStepRow[key] = item[key]
              }
            })
            
            // 调试日志：检查最终的工作步骤行数据
            logger.log(`[WorkStepRow] Activity ${item.activity_id}, WorkStep "${wsDefine.work_step_description}":`, {
              key_qty: workStepRow.key_qty,
              completed: workStepRow.completed,
              work_step_achieved: workStepRow.work_step_achieved,
            })
            
            result.push(workStepRow)
          })
        }

      }
    })
    
    return result
  }, [groupedData, reportEdit, mode, workStepDefinesCache, showAllWorkSteps])

  // 修复：首次进入页面时，虚拟表格从"0行 → 首批2000行"更新后，滚动条长度偶发不正确。
  // 这通常是 rc-virtual-list 在 itemCount 由 0 变为 >0 时未能及时重算总高度导致的。
  // 做法：当数据源长度从 0 变为 >0 时，强制 remount 一次 Table，让虚拟列表重新初始化高度。
  // 同时，当工作步骤展开/折叠导致行数变化时，也需要重新计算总高度。
  const [tableRemountKey, setTableRemountKey] = useState(0)
  const prevDataLenRef = useRef(0)
  useEffect(() => {
    const len = fullTableDataSource.length
    const prev = prevDataLenRef.current
    // 当数据源长度从 0 变为 >0，或者长度发生显著变化时（可能是工作步骤展开/折叠），强制 remount
    if ((prev === 0 && len > 0) || (prev > 0 && Math.abs(len - prev) > 10)) {
      setTableRemountKey((k) => k + 1)
      logger.log(`[VirtualScroll] Remounting table: ${prev} -> ${len} rows`)
    }
    prevDataLenRef.current = len
  }, [fullTableDataSource.length])

  // Table 首次渲染/数据变化时，.ant-table-body 可能会重新创建，兜底刷新滚动容器引用
  useEffect(() => {
    const id = requestAnimationFrame(() => updateTableBodyScrollRef())
    return () => cancelAnimationFrame(id)
  }, [updateTableBodyScrollRef, tableBodyHeight, orderedVisibleColumns.length, fullTableDataSource.length])
  
  
  // 全部展开
  const handleExpandAll = useCallback(() => {
    // 保存当前滚动位置
    const scrollContainer = tableBodyScrollRef.current
    const savedScrollTop = scrollContainer?.scrollTop || 0
    
    setExpandedGroups(new Map())
    setExpandToLevel(null)
    userRejectedLoadMoreRef.current = false // 展开分组时，清除拒绝标志，允许自动加载
    
    // 在下一帧恢复滚动位置
    setTimeout(() => {
      if (scrollContainer) {
        scrollContainer.scrollTop = savedScrollTop
      }
    }, 0)
  }, [])

  // 全部折叠
  const handleCollapseAll = useCallback(() => {
    // 保存当前滚动位置
    const scrollContainer = tableBodyScrollRef.current
    const savedScrollTop = scrollContainer?.scrollTop || 0
    
    // 收集所有分组ID并设置为折叠
    const allGroupIds = new Set<string>()
    groupedData.items.forEach((item: any) => {
      if (item.isGroupHeader && item.id) {
        allGroupIds.add(item.id)
      }
    })
    const collapsedMap = new Map<string, boolean>()
    allGroupIds.forEach(id => {
      collapsedMap.set(id, false)
    })
    setExpandedGroups(collapsedMap)
    setExpandToLevel(null)
    
    // 在下一帧恢复滚动位置
    setTimeout(() => {
      if (scrollContainer) {
        scrollContainer.scrollTop = savedScrollTop
      }
    }, 0)
  }, [groupedData])
  
  // 展开到第N层
  const handleExpandToLevel = useCallback((level: number) => {
    // 保存当前滚动位置
    const scrollContainer = tableBodyScrollRef.current
    const savedScrollTop = scrollContainer?.scrollTop || 0
    
    setExpandToLevel(level)
    // 清除所有手动设置的展开状态，让expandToLevel生效
    setExpandedGroups(new Map())
    
    // 在下一帧恢复滚动位置
    setTimeout(() => {
      if (scrollContainer) {
        scrollContainer.scrollTop = savedScrollTop
      }
    }, 0)
  }, [])

  // 处理栏位配置
  const handleColumnSettings = () => {
    setColumnSettingsVisible(true)
  }

  const handleColumnSettingsOk = () => {
    saveColumnPreferencesMutation.mutate(visibleColumns)
    // 用户调整栏位后，清除视图标记，这样刷新后会应用最后调整的栏位，而不是视图
    hasLastViewRef.current = false
    localStorage.removeItem('daily-report-last-view-id')
    setColumnSettingsVisible(false)
  }

  // 处理分组
  const handleGroupByChange = (values: string[]) => {
    setGroupBy(values)
    saveGroupingPreferencesMutation.mutate(values)
    // 用户调整分组后，清除视图标记，这样刷新后会应用最后调整的分组，而不是视图
    hasLastViewRef.current = false
    localStorage.removeItem('daily-report-last-view-id')
    // 注意：分页和数据重置会在 useEffect 中自动处理（通过 groupByKey 变化检测）
    // 重置展开状态，避免旧的分组状态影响新分组
    setExpandedGroups(new Map())
    setExpandToLevel(null)
    
    // 关键修复：在分组变化时，确保表格宽度保持稳定
    // 使用 requestAnimationFrame 确保在 DOM 更新后重置滚动位置
    // 注意：表格宽度会由 useEffect (2095-2140行) 自动处理，这里不需要手动重置
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const scrollContainer = tableBodyScrollRef.current
        if (scrollContainer) {
          scrollContainer.scrollTop = 0 // 重置到顶部
        }
        // 不再手动重置表格宽度，避免触发 ResizeObserver 循环
        // useEffect 会自动处理列宽和表格宽度的同步
      })
    })
  }


  // 说明：日报页不再使用“切片 + spacer 行”的自制虚拟滚动（容易因行高不一致导致跳动/白行）。
  // 这里优先使用 Table 内部滚动（scroll.y + sticky）来稳定表头/固定列；如未来需要再做虚拟滚动，请评估可变行高带来的渲染兼容性。

  // 加载更多数据的函数
  const loadMoreData = useCallback(() => {
    if (isLoadingMoreRef.current || !hasMore || isLoading) {
      return
    }
    
    isLoadingMoreRef.current = true
    setPagination(prev => ({
      current: prev.current + 1,
      pageSize: prev.pageSize,
    }))
  }, [hasMore, isLoading, pagination.current])

  // 性能：禁用“滚动自动加载更多”，改为手动点击【加载更多】按钮。

  // 当数据加载完成时，重置加载标志并恢复滚动位置
  useEffect(() => {
    if (!isLoading) {
      isLoadingMoreRef.current = false
      
      // 恢复滚动位置（在数据加载完成后，确保 DOM 已更新）
      if (savedScrollTopRef.current > 0 && pagination.current > 1) {
        // 使用双重 requestAnimationFrame 确保 DOM 已完全更新
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const scrollContainer = tableBodyScrollRef.current
            if (scrollContainer && savedScrollTopRef.current > 0) {
              scrollContainer.scrollTop = savedScrollTopRef.current
              logger.log('✅ Restored scroll position after load:', savedScrollTopRef.current)
              savedScrollTopRef.current = 0 // 重置
            }
          })
        })
      }
    }
  }, [isLoading, pagination.current])

  // 性能优化：移除 500ms 的定时轮询（会导致页面卡顿）。
  // 仅依赖 scroll 事件触发加载更多（已在上方 useEffect 中实现）。
  
  const handleSaveDaily = useCallback(async () => {
    const ids = Array.from(dirtyIdsRef.current)
    if (ids.length === 0) {
      messageApi.info('没有需要保存的修改')
      return
    }

    try {
      messageApi.loading({
        content: `正在保存（${ids.length} 条）… 写入 MPDB / VFACTDB 可能需 1–2 分钟，请勿关闭页面`,
        key: 'drm-save',
        duration: 0,
      })
        const entries = ids.map((id) => {
        const base: any = { activity_id: id }
        const edit = reportEdit[id] || {}
        if (mode === 'MP') {
          base.manpower = edit.manpower ?? null
          base.machinery = edit.machinery ?? null
          base.remarks = edit.remarks ?? null
        } else {
          // VFACT 模式：优先使用工作步骤数据，否则使用向后兼容的 achieved 字段
          if (edit.work_steps && edit.work_steps.length > 0) {
            base.work_steps = edit.work_steps
          } else {
            base.achieved = edit.achieved ?? null  // 向后兼容
          }
          base.remarks = edit.remarks ?? null
        }
        return base
      })
      const res = await dailyReportManagementService.save({
        mp_date: mpDateStr,
        vfact_date: vfactDateStr,
        entries,
      })
      
      // 保存成功后，清除脏数据标记，并重新加载数据以更新累计完成量
      const savedIds = Array.from(dirtyIdsRef.current)
      dirtyIdsRef.current.clear()
      setDirtyCount(0)
      
      // 重新加载保存的数据，以更新累计完成量（cumulative_achieved）
      dailyReportManagementService
        .getValues({
          mp_date: mpDateStr,
          vfact_date: vfactDateStr,
          activity_ids: savedIds,
        })
        .then((reloadRes) => {
          setReportEdit((prev) => {
            const next = { ...prev }
            savedIds.forEach((id) => {
              const v = reloadRes.values?.[id]
              if (v && v.work_steps) {
                // 合并数据：保留用户可能正在编辑的其他字段（如 manpower, machinery）
                const current = next[id] || {}
                // 使用后端返回的工作步骤数据（包含最新的累计完成量和预估总量）
                // 后端会返回所有定义的工作步骤，即使 achieved 为 None
                next[id] = {
                  ...current,
                  work_steps: v.work_steps,
                  system_status: v.system_status,
                }
              }
            })
            return next
          })
        })
        .catch((e: any) => {
          logger.warn('Failed to reload data after save:', e)
        })
      
      if (res.skipped_details && res.skipped_details.length > 0) {
        messageApi.destroy('drm-save')
        const mainMsg = res.message?.replace(/ \[已跳过.*$/, '') || '保存成功'
        Modal.success({
          title: mainMsg,
          width: 420,
          content: (
            <div style={{ marginTop: 8 }}>
              <p style={{ marginBottom: 8 }}>
                已跳过 {res.skipped_details.length} 条锁定作业记录，请勿再向以下作业代码填报人力/机械数据：
              </p>
              <div
                style={{
                  maxHeight: 220,
                  overflowY: 'auto',
                  background: 'rgba(0,0,0,0.03)',
                  borderRadius: 6,
                  padding: '8px 12px',
                  fontSize: 12,
                  fontFamily: 'Consolas, Monaco, "Liberation Mono", "Courier New", monospace',
                }}
              >
                {res.skipped_details.map((e) => {
                  const mp = e.manpower != null ? `人力:${e.manpower}` : null
                  const mc = e.machinery != null ? `机械:${e.machinery}` : null
                  const suffix = [mp, mc].filter(Boolean).join('、') || '无'
                  return (
                    <div key={e.activity_id} style={{ padding: '2px 0', wordBreak: 'break-all' }}>
                      {e.activity_id}（{suffix}）
                    </div>
                  )
                })}
              </div>
            </div>
          ),
          okText: '知道了',
        })
      } else {
        messageApi.success({ content: res.message || '保存成功', key: 'drm-save' })
      }
      
      // 刷新相关缓存，确保跳转到其他页面（如 /mpdb 或 /vfactdb）时能看到最新数据
      queryClient.invalidateQueries({ queryKey: ['mpdb'] })
      queryClient.invalidateQueries({ queryKey: ['vfactdb'] })
      // 强制重新获取当前页面的汇总数据（如果有的话）
      queryClient.refetchQueries({ queryKey: ['daily-report-management'] })
    } catch (e: any) {
      const detail = e?.response?.data?.detail
      const status = e?.response?.status
      const detailStr = Array.isArray(detail) ? detail.join('\n') : (typeof detail === 'string' ? detail : '')
      if (status === 403 && detailStr) {
        Modal.error({
          title: '保存失败 - 作业已锁定',
          content: (
            <div style={{ marginTop: '10px' }}>
              <p>{detailStr}</p>
              <p style={{ fontSize: '12px', color: '#8c8c8c', marginTop: '15px' }}>
                提示：已确认完成的作业处于锁定状态，禁止再填报数据。如需修改，请先前往“计划管理”重新打开该作业。
              </p>
            </div>
          ),
          okText: '知道了',
          width: 450,
        })
        messageApi.destroy('drm-save')
      } else if (detailStr) {
        Modal.error({
          title: '保存失败',
          content: (
            <div style={{ marginTop: 8 }}>
              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 12 }}>{detailStr}</div>
              <p style={{ fontSize: '12px', color: '#8c8c8c' }}>
                若为数据库或网络超时，请稍后重试；若为“第 N 批”错误，可能是数据冲突，请减少单次保存条数或联系管理员。
              </p>
            </div>
          ),
          okText: '知道了',
          width: 520,
        })
        messageApi.destroy('drm-save')
      } else {
        messageApi.error({ content: `保存失败: ${e?.message || e}`, key: 'drm-save' })
      }
    }
  }, [messageApi, mpDateStr, vfactDateStr, reportEdit, mode])

  const handleExportExcel = useCallback(async () => {
    try {
      // 检查是否指定了单一scope
      const scopes = globalFilter.scope || []
      if (scopes.length !== 1) {
        messageApi.warning({ 
          content: '导出功能需要指定且仅指定一个分包商（SCOPE），请先选择单一分包商后再导出', 
          key: 'drm-export',
          duration: 5
        })
        return
      }

      setProgress({
        visible: true,
        percent: 5,
        text: '正在准备导出数据…',
        title: '正在导出 Excel',
        step: '步骤 1/3：准备数据',
      })

      const columns = orderedVisibleColumns.map((k) => ({
        key: k,
        title: AVAILABLE_COLUMNS.find((c) => c.key === k)?.title || k,
      }))
      
      setProgress({
        visible: true,
        percent: 50,
        text: '正在请求后端生成 Excel 文件…',
        title: '正在导出 Excel',
        step: '步骤 2/3：生成文件',
      })

      // 获取额外项数据（仅MP模式）
      const mpExtrasData = mode === 'MP' && selectedScopeForMpExtras ? mpExtras : undefined

      // 导出所有匹配的数据（由后端查询）
      const blob = await dailyReportManagementService.exportExcel({
        mp_date: mpDateStr,
        vfact_date: vfactDateStr,
        columns,
        rows: undefined, // 不传 rows，触发后端查询全部
        filters, // 传递当前筛选条件
        group_by: groupBy, // 传递当前分组
        mp_extras: mpExtrasData,
        scope: selectedScopeForMpExtras || (globalFilter.scope && globalFilter.scope.length === 1 ? globalFilter.scope[0] : undefined),
        mode: mode,
        show_all_work_steps: showAllWorkSteps, // 传递"显示所有工作步骤"选项
      })

      setProgress({
        visible: true,
        percent: 90,
        text: '正在准备下载文件…',
        title: '正在导出 Excel',
        step: '步骤 3/3：下载',
      })

      const scopeStr = (selectedScopeForMpExtras || (globalFilter.scope && globalFilter.scope.length === 1 ? globalFilter.scope[0] : 'ALL')).toUpperCase()
      const filename = mode === 'VFACT' 
        ? `MW-${scopeStr}-VFACT-${vfactDate.format('YYYYMMDD')}.xlsx`
        : `MW-${scopeStr}_MP-${mpDate.format('YYYYMMDD')}.xlsx`
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)

      setProgress({ visible: false, percent: 0, text: '', title: '', step: undefined, tip: undefined })
      messageApi.success({ content: '导出完成', key: 'drm-export' })
    } catch (e: any) {
      setProgress({ visible: false, percent: 0, text: '', title: '', step: undefined, tip: undefined })
      messageApi.error({ content: `导出失败: ${e?.message || e}`, key: 'drm-export' })
    }
  }, [messageApi, orderedVisibleColumns, reportEdit, mpDateStr, vfactDateStr, mpDate, vfactDate, filters, groupBy, globalFilter.scope, selectedScopeForMpExtras, mpExtras, mode])

  const uploadExcelProps = useMemo(() => ({
    maxCount: 1,
    showUploadList: false,
    beforeUpload: async (file: File) => {
      try {
        setProgress({
          visible: true,
          percent: 10,
          text: '上传并解析 Excel，识别表头与数据行…',
          title: '正在导入 Excel（MPDB / VFACTDB）',
          step: '步骤 1/4：上传并解析',
          tip: '大文件可能需要 1–2 分钟，请勿关闭页面',
        })

        const res = await dailyReportManagementService.importExcel({
          mp_date: mpDateStr,
          vfact_date: vfactDateStr,
          ignore_mp: mode === 'VFACT',
          file,
        })

        setProgress({
          visible: true,
          percent: 60,
          text: '写入 MPDB / VFACTDB 已完成，正在刷新页面数据…',
          title: '正在导入 Excel（MPDB / VFACTDB）',
          step: '步骤 2/4：写入完成',
        })

        // 导入后清空脏标记
        dirtyIdsRef.current.clear()
        setDirtyCount(0)

        // 立即刷新当前已加载的activity值（所见即所得）
        const activityIds = Array.from(new Set(loadedItems.map((a) => a.activity_id).filter(Boolean)))
        if (activityIds.length > 0) {
          setProgress({
            visible: true,
            percent: 70,
            text: `正在同步页面显示数据…`,
            title: '正在导入 Excel（MPDB / VFACTDB）',
            step: '步骤 3/4：刷新数据',
          })
          
          const fresh = await dailyReportManagementService.getValues({
            mp_date: mpDateStr,
            vfact_date: vfactDateStr,
            activity_ids: activityIds,
          })
          setReportEdit((prev) => {
            const next = { ...prev }
            activityIds.forEach((id) => {
            const v = fresh.values?.[id]
            next[id] = {
              manpower: v?.manpower ?? undefined,
              machinery: v?.machinery ?? undefined,
              achieved: v?.achieved ?? undefined,  // 向后兼容
              remarks: v?.remarks ?? undefined,
              work_steps: v?.work_steps ?? undefined,  // 新增：工作步骤数据
            }
            })
            return next
          })
        }
        
        // 如果是MP模式，刷新MP额外项数据
        if (mode === 'MP' && selectedScopeForMpExtras) {
          setProgress({
            visible: true,
            percent: 85,
            text: '正在刷新额外项数据…',
            title: '正在导入 Excel（MPDB / VFACTDB）',
            step: '步骤 3/4：刷新额外项',
          })
          try {
            const mpExtrasRes = await dailyReportManagementService.getMpExtras({
              date: mpDateStr,
              scope: selectedScopeForMpExtras,
            })
            setMpExtras(mpExtrasRes.manpower || {})
          } catch (e) {
            // 静默失败，不影响导入成功提示
            logger.error('刷新MP额外项失败:', e)
          }
        }
        
        setProgress({
          visible: true,
          percent: 95,
          text: '正在清理缓存并同步状态…',
          title: '正在导入 Excel（MPDB / VFACTDB）',
          step: '步骤 4/4：完成',
        })

        // 刷新VFACTDB页面数据（如果导入的是VFACT数据）
        // 使用 refetchQueries 刷新，确保数据立即更新
        if (mode === 'VFACT') {
          queryClient.invalidateQueries({ queryKey: ['vfactdb'] })
          // 强制重新获取所有 vfactdb 相关的查询
          queryClient.refetchQueries({ queryKey: ['vfactdb'] })
        }
        
        // 刷新相关缓存，确保跳转到其他页面时能看到最新数据
        queryClient.invalidateQueries({ queryKey: ['mpdb'] })
        queryClient.invalidateQueries({ queryKey: ['vfactdb'] })
        
        // 刷新daily-report-management页面数据
        queryClient.invalidateQueries({ queryKey: ['daily-report-management'] })
        queryClient.refetchQueries({ queryKey: ['daily-report-management'] })
        
        setProgress({ visible: false, percent: 0, text: '', title: '', step: undefined, tip: undefined })
        if (res.skipped_details && res.skipped_details.length > 0) {
          const mainMsg = res.message?.replace(/ \[已跳过.*$/, '') || '导入成功'
          Modal.success({
            title: mainMsg,
            width: 420,
            content: (
              <div style={{ marginTop: 8 }}>
                <p style={{ marginBottom: 8 }}>
                  已跳过 {res.skipped_details.length} 条锁定作业记录，请勿再向以下作业代码填报人力/机械数据：
                </p>
                <div
                  style={{
                    maxHeight: 220,
                    overflowY: 'auto',
                    background: 'rgba(0,0,0,0.03)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 12,
                    fontFamily: 'Consolas, Monaco, "Liberation Mono", "Courier New", monospace',
                  }}
                >
                  {res.skipped_details.map((e) => {
                    const mp = e.manpower != null ? `人力:${e.manpower}` : null
                    const mc = e.machinery != null ? `机械:${e.machinery}` : null
                    const suffix = [mp, mc].filter(Boolean).join('、') || '无'
                    return (
                      <div key={e.activity_id} style={{ padding: '2px 0', wordBreak: 'break-all' }}>
                        {e.activity_id}（{suffix}）
                      </div>
                    )
                  })}
                </div>
              </div>
            ),
            okText: '知道了',
          })
        } else {
          messageApi.success({ content: res.message || '导入成功', key: 'drm-import' })
        }
      } catch (e: any) {
        setProgress({ visible: false, percent: 0, text: '', title: '', step: undefined, tip: undefined })
        const detail = e?.response?.data?.detail
        const detailStr = Array.isArray(detail) ? detail.join('\n') : (typeof detail === 'string' ? detail : '')
        if (detailStr) {
          Modal.error({
            title: '导入失败',
            content: (
              <div style={{ marginTop: 8 }}>
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 12 }}>{detailStr}</div>
                <p style={{ fontSize: '12px', color: '#8c8c8c' }}>
                  请检查：1) 完成量是否填写在「工作步骤」行（描述列应对齐工作步骤名称，勿在作业代码行填完成量）；2) 是否误删或错列导致错行；3) 在 Excel 中取消所有筛选后另存为新文件再导入。
                </p>
              </div>
            ),
            okText: '知道了',
            width: 560,
          })
        } else {
          const msg = e?.response?.status === 504
            ? '请求超时（504）。若文件较大，服务器可能仍在处理或已处理完成，请刷新页面查看数据是否已更新；若未更新可取消 Excel 筛选、另存为新文件后重试。'
            : (e?.message || String(e))
          messageApi.error({ content: `导入失败: ${msg}`, key: 'drm-import', duration: 6 })
        }
      }
      return Upload.LIST_IGNORE
    },
  }), [messageApi, mpDateStr, vfactDateStr, loadedItems, mode, selectedScopeForMpExtras, queryClient])


  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', // 使用100%填充父容器（MainLayout的Content提供的flex容器）
      overflow: 'hidden',
      background: '#f5f5f5'
    }}>
      <LegacyModuleBanner
        compact
        title={legacyReportMeta.title}
        description={legacyReportMeta.description}
        note={legacyReportMeta.note}
        actions={[
          { label: '进入制造订单', path: '/manufacturing/orders', type: 'primary' },
          { label: '进入制造驾驶舱', path: '/manufacturing' },
        ]}
      />

      {/* 顶部工具栏 */}
      <div style={{ 
        background: '#ffffff', 
        borderBottom: '1px solid #d9d9d9',
        padding: '6px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0
      }}>
        <Space size={8} align="center">
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#333' }}>
            {mode === 'MP' ? '人力日报' : mode === 'VFACT' ? '工程量日报' : '验收日报'}
          </h2>
          {mode === 'MP' ? (
            <>
              <Tag color="blue">日期：{mpDate.format('YYYY-MM-DD')}</Tag>
              <Tag color="default">工程量(昨日)：{vfactDate.format('YYYY-MM-DD')}</Tag>
            </>
          ) : (
            <>
              <Tag color="gold">日期：{vfactDate.format('YYYY-MM-DD')}</Tag>
              <Tag color="blue">参考MP：{mpDate.format('YYYY-MM-DD')}</Tag>
            </>
          )}
        </Space>
        <Space>
          <Input
            placeholder="作业代码"
            allowClear
            size="small"
            style={{ width: 140 }}
            value={localFilters.activity_id}
            onChange={(e) => setLocalFilters({ ...localFilters, activity_id: e.target.value })}
          />
          <Input
            placeholder="作业描述"
            allowClear
            size="small"
            style={{ width: 140 }}
            value={localFilters.title}
            onChange={(e) => setLocalFilters({ ...localFilters, title: e.target.value })}
          />
          <Button
            icon={<GroupOutlined />}
            onClick={() => setGroupingPanelVisible(!groupingPanelVisible)}
            type={groupingPanelVisible ? 'primary' : 'default'}
            size="small"
          >
            分组
          </Button>
          <Button
            icon={<SettingOutlined />}
            onClick={handleColumnSettings}
            size="small"
          >
            栏位设置
          </Button>
          <Button
            icon={<EyeOutlined />}
            onClick={() => setViewModalVisible(true)}
            size="small"
          >
            视图管理
          </Button>
          {/* 日期固定：不允许用户修改；验收模式无保存/导入回写 */}
          {mode !== 'INSPECTION' && (
            <>
              <Button
                icon={<CloudUploadOutlined />}
                onClick={handleSaveDaily}
                size="small"
                type={dirtyCount > 0 ? 'primary' : 'default'}
              >
                保存{dirtyCount > 0 ? `(${dirtyCount})` : ''}
              </Button>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleExportExcel}
                size="small"
              >
                导出Excel
              </Button>
              <Upload {...uploadExcelProps}>
                <Button icon={<UploadOutlined />} size="small">
                  导入回写
                </Button>
              </Upload>
            </>
          )}
          {mode === 'MP' && (
            <Button
              size="small"
              onClick={() => {
                if (!selectedScopeForMpExtras) {
                  messageApi.warning('请在顶部筛选器中选择唯一一个SCOPE后再填写"间接/休息/管理"等额外项')
                  return
                }
                setMpExtrasVisible(true)
              }}
            >
              MP额外项
            </Button>
          )}
          {mode === 'VFACT' && (
            <Checkbox
              checked={showAllWorkSteps}
              onChange={(e) => setShowAllWorkSteps(e.target.checked)}
              style={{ marginLeft: 8 }}
            >
              显示所有工作步骤
            </Checkbox>
          )}
          {mode !== 'INSPECTION' && (
            <Button
              size="small"
              onClick={() => navigate(mode === 'MP' ? '/daily-report-volume' : '/daily-report-management')}
            >
              {mode === 'MP' ? '切换：工程量日报' : '切换：人力日报'}
            </Button>
          )}
          {mode === 'INSPECTION' && (
            <>
              <Button size="small" onClick={() => navigate('/daily-report-management')}>
                切换：人力日报
              </Button>
              <Button size="small" onClick={() => navigate('/daily-report-volume')}>
                切换：工程量日报
              </Button>
            </>
          )}
          <Button
                icon={<ExpandOutlined />}
                onClick={handleExpandAll}
                size="small"
                title="全部展开"
              >
                全部展开
              </Button>
              <Button
                icon={<CompressOutlined />}
                onClick={handleCollapseAll}
                size="small"
                title="全部折叠"
              >
                全部折叠
          </Button>
          {groupBy.length > 0 && (
              <Select
                size="small"
                style={{ width: 140 }}
                placeholder="展开到第N层"
                value={expandToLevel}
                onChange={(value) => {
                  if (value === null) {
                    handleExpandAll()
                  } else {
                    handleExpandToLevel(value)
                  }
                }}
                allowClear
              >
                {groupBy.map((_: any, index: number) => (
                  <Select.Option key={index} value={index}>
                展开到第{index + 1}层
                  </Select.Option>
                ))}
              </Select>
          )}
        </Space>
      </div>

      {/* 分组面板 */}
      {groupingPanelVisible && (
        <div style={{ 
          background: '#fafafa', 
          borderBottom: '1px solid #d9d9d9',
          padding: '8px 16px',
          flexShrink: 0
        }}>
          <Select
            mode="multiple"
            placeholder="选择分组字段"
            style={{ width: '100%' }}
            value={groupBy}
            onChange={handleGroupByChange}
            options={GROUP_BY_OPTIONS}
            size="small"
          />
        </div>
      )}

      {/* 主要内容区域 */}
      <div style={{ 
        flex: 1, 
        overflow: 'hidden',
        minHeight: 0,
        background: '#fafafa',
        position: 'relative'
      }}>
        <style>{`
          .daily-report-management-table .column-resizer:hover::after {
            content: '';
            position: absolute;
            left: 2px;
            top: 0;
            bottom: 0;
            width: 2px;
            background: rgba(22, 119, 255, 0.55);
          }
          .daily-report-management-table th {
            position: relative;
          }
          /* 固定表头/固定列：交给 AntD Table sticky 能力处理（避免外层 overflow 导致 sticky 失效/跳动） */
          .daily-report-management-table .ant-table-cell {
            user-select: ${isColumnResizing ? 'none' : 'auto'};
          }
          /* 行高：与“计划管理(Activities)”保持一模一样（rowHeight=22 + compact） */
          .daily-report-management-table .ant-table-tbody > tr {
            height: 22px !important;
          }
          /* AntD virtual table 某些版本会用 div 来渲染行（不是 tr），这里一并覆盖，保证视觉行高稳定 */
          .daily-report-management-table .ant-table-tbody-virtual .ant-table-row {
            height: 22px !important;
          }
          /* InputNumber 样式：去掉边框和圆圈，基本不可见，字体大小与表格内容一致 */
          .daily-report-management-table .ant-input-number {
            border: none !important;
            box-shadow: none !important;
            font-size: 11px !important;
            height: 18px !important;
            line-height: 18px !important;
            display: flex;
            align-items: center;
            border-radius: 0 !important;
            background: transparent !important;
          }
          .daily-report-management-table .ant-input-number:focus,
          .daily-report-management-table .ant-input-number:hover {
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
          }
          .daily-report-management-table .ant-input-number-input {
            text-align: center;
            border: none !important;
            font-size: 11px !important;
            line-height: 18px !important;
            height: 18px !important;
            padding: 0 !important;
            border-radius: 0 !important;
            background: transparent !important;
          }
          .daily-report-management-table .ant-input-number-input-wrap {
            height: 18px !important;
            border-radius: 0 !important;
            background: transparent !important;
          }
          /* Input 样式（备注列） */
          .daily-report-management-table .ant-input {
            border: none !important;
            box-shadow: none !important;
            font-size: 11px !important;
            height: 18px !important;
            line-height: 18px !important;
            padding: 0 4px !important;
            text-align: left;
            border-radius: 0 !important;
            background: transparent !important;
          }
          .daily-report-management-table .ant-input:focus,
          .daily-report-management-table .ant-input:hover {
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
          }

          /* 行高严格对齐"计划管理(Activities)"：
             - rowHeight=22（所有行：分组行、activity行、工作步骤行都使用相同行高）
             - cell padding=2px 6px
             - content line-height=18px（22 - 2 - 2 = 18） */
          .daily-report-management-table .ant-table-tbody > tr > td {
            box-sizing: border-box;
            padding: 2px 6px !important;
            font-size: 11px !important;
            line-height: 18px !important;
            height: 22px !important;
            min-height: 22px !important;
            max-height: 22px !important;
            vertical-align: middle;
            border-radius: 0 !important;
            border-right: 1px solid #f0f0f0 !important;
          }
          /* AntD virtual table 某些版本会用 div 来渲染单元格（不是 td），这里一并覆盖 */
          .daily-report-management-table .ant-table-tbody-virtual .ant-table-cell {
            box-sizing: border-box;
            padding: 2px 6px !important;
            font-size: 11px !important;
            line-height: 18px !important;
            height: 22px !important;
            min-height: 22px !important;
            max-height: 22px !important;
            display: flex;
            align-items: center;
            border-radius: 0 !important;
            border-right: 1px solid #f0f0f0 !important;
          }
          /* 确保工作步骤行也使用相同的行高（虚拟滚动需要所有行高度一致） */
          .daily-report-management-table .ant-table-tbody > tr[data-row-key*="__workstep__"] > td {
            height: 22px !important;
            min-height: 22px !important;
            max-height: 22px !important;
          }
          .daily-report-management-table .ant-table-thead > tr > th {
            padding: 6px 6px !important;
            font-size: 12px;
            border-right: 1px solid #f0f0f0 !important;
          }

          /* 表头圆角：与容器保持一致（4px） - 更加激进的样式覆盖 */
          .daily-report-management-table,
          .daily-report-management-table .ant-table,
          .daily-report-management-table .ant-table-container,
          .daily-report-management-table .ant-table-content,
          .daily-report-management-table .ant-table-header,
          .daily-report-management-table .ant-table-body {
            border-radius: 4px 4px 0 0 !important;
            overflow: hidden !important;
          }
          
          .daily-report-management-table .ant-table-thead > tr:first-child > th:first-child,
          .daily-report-management-table .ant-table-thead > tr:first-child > th:first-child .pc-group-title,
          .daily-report-management-table .ant-table-cell-fix-left:first-child,
          .daily-report-management-table .ant-table-cell-fix-left:first-child .pc-group-title {
            border-top-left-radius: 4px !important;
          }
          
          .daily-report-management-table .ant-table-thead > tr:first-child > th:last-child,
          .daily-report-management-table .ant-table-thead > tr:first-child > th:last-child .pc-group-title,
          .daily-report-management-table .ant-table-cell-fix-right:last-child,
          .daily-report-management-table .ant-table-cell-fix-right:last-child .pc-group-title {
            border-top-right-radius: 4px !important;
          }

          /* 右侧滚动条：弱化/更现代（Windows/Edge/Chrome/Firefox） */
          .daily-report-management-table .ant-table-body {
            scrollbar-width: thin; /* Firefox */
            scrollbar-color: rgba(0,0,0,0.18) transparent;
          }
          .daily-report-management-table .ant-table-body::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }
          .daily-report-management-table .ant-table-body::-webkit-scrollbar-track {
            background: transparent;
          }
          .daily-report-management-table .ant-table-body::-webkit-scrollbar-thumb {
            background: rgba(0,0,0,0.12);
            border-radius: 999px;
          }
          .daily-report-management-table .ant-table-body:hover::-webkit-scrollbar-thumb {
            background: rgba(0,0,0,0.22);
          }
          /* 关键：禁止表格把“剩余空间”平均摊给其它列（Excel 行为：列宽不自动铺满） */
          .drm-table-inline-wrap {
            display: inline-block;
            width: max-content;
            max-width: none;
          }
          .drm-table-inline-wrap .ant-table,
          .drm-table-inline-wrap .ant-table-container {
            width: max-content !important;
            max-width: none !important;
          }
          /* 强制禁止 AntD 自动调整列宽：确保表格宽度严格等于列宽之和 */
          /* Chrome 兼容性修复：使用 table-layout: fixed 时，必须明确设置表格宽度 */
          .drm-table-inline-wrap .ant-table-container table,
          .drm-table-inline-wrap .ant-table-header table,
          .drm-table-inline-wrap .ant-table-body table,
          .drm-table-inline-wrap .ant-table-content table {
            table-layout: fixed !important;
            /* 移除 width: auto，让 JavaScript 控制宽度，避免 Chrome 自动扩展 */
            min-width: 0 !important;
          }
          /* Chrome 兼容性：确保 col 元素的宽度不会被自动调整 */
          .daily-report-management-table colgroup col {
            min-width: 0 !important;
          }
          /* 禁止列宽自动调整：每列宽度必须严格遵循设置的值 */
          .daily-report-management-table .ant-table-thead th,
          .daily-report-management-table .ant-table-tbody td {
            box-sizing: border-box !important;
          }
          /* 虚拟表格的列宽也需要强制固定 */
          .daily-report-management-table .ant-table-tbody-virtual .ant-table-cell {
            box-sizing: border-box !important;
          }
        `}</style>
        {/* 只在首次加载（第一页）时显示加载提示，加载更多时不显示全屏加载 */}
        {isLoading && pagination.current === 1 && loadedItems.length === 0 ? (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100%' 
          }}>
            <div>加载中...</div>
          </div>
        ) : (
          <div
            ref={setTableContainerEl}
            style={{
              height: '100%',
              overflow: 'hidden',
              position: 'relative',
              background: '#ffffff',
            }}
          >
            <div className="drm-table-inline-wrap">
              <AntdTableAny
                // 高度/数据变化时强制重建，确保虚拟列表的总高度/滚动条在首次进入就正确
                // 额外：首次进入时 groupBy 往往会从“默认空”异步切到“用户偏好分组”，会触发 itemCount/渲染结构大幅变化。
                // rc-virtual-list 偶发不会正确重算总高度，导致“第一次滚动条偏长、第二次正常”。把 groupByKey 也纳入 key，强制重建修复该问题。
                key={`drm-virtual-${tableRemountKey}-${tableBodyHeight}-${groupBy.join('|')}-${fullTableDataSource.length}`}
                className="daily-report-management-table"
                columns={tableColumns}
                dataSource={fullTableDataSource}
                rowKey={(record: any) => {
                  if (record.isGroupHeader) return record.id || record.key
                  if (record.isWorkStepRow) return record.key || `${record.parentActivityId}__workstep__${record.work_step_description}`
                  return record.id || record.activity_id || record.key
                }}
                scroll={{ x: tableScrollX, y: tableBodyHeight }}
                sticky
                virtual
                // 关键：AntD virtual table 底层默认 itemHeight=24（见 rc-table VirtualTable/BodyGrid）。
                // 必须显式传 listItemHeight=22，才能让“行高/滚动条总高度”与计划管理(rowHeight=22)一致。
                listItemHeight={22}
                tableLayout="fixed"
                pagination={false}
                size="small"
                bordered={false}
                style={{
                  background: '#ffffff',
                }}
                onRow={(record: any) => {
                  if (record.isGroupHeader) {
                    const level = record.level ?? 0
                    const bgColor = getGroupRowBackgroundColor(level)
                    const leftBarColor = getGroupLeftBarColor(level)
                    return {
                      style: {
                        backgroundColor: bgColor,
                        // 注意：virtual table 的总高度由 listItemHeight 估算。
                        // 这里如果用 borderBottom 可能会让“实际 DOM 高度”> 22px，导致首次进入滚动条长度不正确。
                        // 用 inset box-shadow 画分隔线，不影响布局高度。
                        boxShadow: 'inset 0 -2px 0 #e5e7eb',
                        '--group-left-bar-color': leftBarColor,
                      } as React.CSSProperties,
                    }
                  }
                  return {
                    style: {
                      backgroundColor: '#ffffff',
                    },
                  }
                }}
              />
            </div>
            {/* 手动加载更多：悬浮在底部，避免 Table 内部滚动导致 sticky 失效 */}
            {hasMore && (
              <div style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                justifyContent: 'center',
                padding: '10px 0',
                background: 'linear-gradient(to top, rgba(255,255,255,0.96), rgba(255,255,255,0))',
                pointerEvents: 'none',
              }}>
                <div style={{ pointerEvents: 'auto' }}>
                  <Button
                    size="small"
                    loading={isLoading}
                    onClick={loadMoreData}
                  >
                    加载更多（当前已加载 {loadedItems.length} 条）
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 栏位设置弹窗 */}
      <Modal
        title="栏位设置"
        open={columnSettingsVisible}
        onOk={handleColumnSettingsOk}
        onCancel={() => setColumnSettingsVisible(false)}
        width={600}
      >
        <Checkbox.Group
          value={visibleColumns}
          onChange={(values) => setVisibleColumns(values as string[])}
          style={{ width: '100%' }}
        >
          <Row>
            {AVAILABLE_COLUMNS
              .filter((c) => !['mp_manpower', 'mp_machinery', 'mp_remarks', 'vfact_achieved'].includes(c.key))
              .map(col => (
              <Col span={8} key={col.key} style={{ marginBottom: 8 }}>
                <Checkbox value={col.key}>{col.title}</Checkbox>
              </Col>
            ))}
          </Row>
        </Checkbox.Group>
      </Modal>

      {/* 视图管理弹窗 */}
      <Modal
        title="视图管理"
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={null}
        width={600}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Input.Group compact>
              <Input
                placeholder="输入视图名称"
                id="view-name-input"
                style={{ width: 'calc(100% - 80px)' }}
                onPressEnter={(e) => {
                  const name = (e.target as HTMLInputElement).value.trim()
                  if (name) {
                    saveView(name)
                    ;(e.target as HTMLInputElement).value = ''
                  }
                }}
              />
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={() => {
                  const input = document.getElementById('view-name-input') as HTMLInputElement
                  const name = input?.value.trim()
                  if (name) {
                    saveView(name)
                    input.value = ''
                  } else {
                    messageApi.warning('请输入视图名称')
                  }
                }}
              >
                保存当前视图
              </Button>
            </Input.Group>
          </div>
          
          <Divider>已保存的视图</Divider>
          
          <List
            dataSource={savedViews}
            renderItem={(view: any) => (
              <List.Item
                actions={[
                  <Button
                    key="load"
                    type="link"
                    size="small"
                    onClick={() => {
                      loadView(view)
                      setViewModalVisible(false)
                    }}
                  >
                    加载
                  </Button>,
                  <Popconfirm
                    key="delete"
                    title="确定要删除这个视图吗？"
                    onConfirm={() => deleteView(view.id)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button
                      type="link"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                    >
                      删除
                    </Button>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={view.name}
                  description={`分组: ${view.groupBy.join(', ') || '无'} | 栏位: ${view.visibleColumns.length}个`}
                />
              </List.Item>
            )}
            locale={{ emptyText: '暂无保存的视图' }}
          />
        </Space>
      </Modal>

      {/* MP 额外项弹窗 */}
      <Modal
        title="人力日报：额外项（管理/间接/休息）"
        open={mpExtrasVisible}
        onCancel={() => setMpExtrasVisible(false)}
        onOk={async () => {
          if (!selectedScopeForMpExtras) {
            messageApi.warning('请先选择唯一一个SCOPE')
            return
          }
          try {
            messageApi.loading({ content: '正在保存额外项...', key: 'mp-extras' })
            const res = await dailyReportManagementService.saveMpExtras({
              date: mpDate.format('YYYY-MM-DD'),
              scope: selectedScopeForMpExtras,
              manpower: mpExtras,
            })
            messageApi.success({ content: res.message || '保存成功', key: 'mp-extras' })
            setMpExtrasVisible(false)
            // 刷新缓存
            queryClient.invalidateQueries({ queryKey: ['mpdb'] })
          } catch (e: any) {
            messageApi.error({ content: `保存失败: ${e?.message || e}`, key: 'mp-extras' })
          }
        }}
        okText="保存"
        cancelText="取消"
      >
        {!selectedScopeForMpExtras ? (
          <div>请在顶部筛选器中选择唯一一个 SCOPE，然后再填写。</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 12 }}>
            {Object.entries(mpExtras).length === 0 ? (
              <div style={{ gridColumn: '1 / -1', color: '#999' }}>加载中（或暂无数据）…</div>
            ) : (
              Object.entries(mpExtras).map(([title, value]) => (
                <div key={title} style={{ display: 'contents' }}>
                  <div style={{ alignSelf: 'center' }}>{title}</div>
                  <InputNumber
                    min={0}
                    value={value}
                    onChange={(v) => setMpExtras((prev) => ({ ...prev, [title]: Number(v ?? 0) }))}
                  />
                </div>
              ))
            )}
          </div>
        )}
      </Modal>

      {/* 导入/导出/保存进度 Modal：显示当前步骤与说明，避免用户误关页面 */}
      <Modal
        open={progress.visible}
        title={progress.title}
        footer={null}
        closable={false}
        maskClosable={false}
        width={440}
      >
        <div style={{ padding: '20px 0' }}>
          {progress.step && (
            <div style={{ marginBottom: 12, fontSize: 13, color: '#1890ff', fontWeight: 500 }}>
              {progress.step}
            </div>
          )}
          <Progress
            percent={progress.percent}
            status="active"
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
          />
          <div style={{ marginTop: 16, textAlign: 'center', color: '#666', lineHeight: 1.5 }}>
            {progress.text}
          </div>
          {progress.tip && (
            <div style={{ marginTop: 12, fontSize: 12, color: '#8c8c8c', textAlign: 'center' }}>
              {progress.tip}
            </div>
          )}
        </div>
      </Modal>

      {mode === 'INSPECTION' && (
        <InspectionDBModal
          visible={inspectionModalVisible}
          record={editingInspection}
          initialActivity={selectedActivityForInspection ?? undefined}
          onCancel={() => {
            setInspectionModalVisible(false)
            setSelectedActivityForInspection(null)
            setEditingInspection(null)
          }}
          onSuccess={() => {
            setInspectionModalVisible(false)
            setSelectedActivityForInspection(null)
            setEditingInspection(null)
            queryClient.invalidateQueries({ queryKey: ['inspectiondb-by-activities'] })
            queryClient.invalidateQueries({ queryKey: ['inspectiondb-list'] })
            queryClient.invalidateQueries({ queryKey: ['inspectiondb-summary'] })
          }}
        />
      )}

      {mode === 'INSPECTION' && (
        <InspectionDBListDrawer
          open={rfiListDrawerActivityId !== null}
          onClose={() => setRfiListDrawerActivityId(null)}
          activityId={rfiListDrawerActivityId}
          onEdit={(record) => {
            setEditingInspection(record)
            setSelectedActivityForInspection(null)
            setRfiListDrawerActivityId(null)
            setInspectionModalVisible(true)
          }}
          onDelete={(id) => deleteInspectionMutation.mutate(id)}
          deletePending={deleteInspectionMutation.isPending}
        />
      )}
    </div>
  )
}

// 默认路由仍指向“人力日报”页（兼容历史路径 /daily-report-management）
const DailyReportManagement = () => <DailyReportManagementBase mode="MP" />

export default DailyReportManagement
