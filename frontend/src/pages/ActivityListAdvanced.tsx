import { useState, useEffect, useContext, useMemo, useCallback, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { 
  Select, Button, Space, App, 
  Checkbox, Modal, Form, DatePicker, Row, Col,
  Tabs, Descriptions, Divider, Input, List, Popconfirm, Spin
} from 'antd'
import { 
  SettingOutlined, 
  GroupOutlined,
  CloseOutlined, EyeOutlined,
  CalendarOutlined, DeleteOutlined, SaveOutlined,
  BgColorsOutlined,
  ExpandOutlined, CompressOutlined,
  InfoCircleOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  BarChartOutlined,
  TeamOutlined,
  ToolOutlined,
  PercentageOutlined,
  LineChartOutlined
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { activityService, type Activity } from '../services/activityService'
import { GlobalFilterContext } from '../components/layout/MainLayout'
import dayjs, { type Dayjs } from 'dayjs'
// import type { ColumnsType } from 'antd/es/table' // 暂时未使用
import GanttChart, { type GanttTask, type GanttColumn, type TimescaleConfig, type TaskLevelColors, DEFAULT_TASK_COLORS } from '../components/gantt/GanttChart'
import { reportService } from '../services/reportService'
import type { MPDBEntry, VFACTDBEntry, MPDBResponse, VFACTDBResponse } from '../types/report'
import { 
  workstepService, 
  workstepVolumeService, 
  type WorkStepDefine,
  type WorkStepVolume,
  type WorkStepVolumeCreate,
} from '../services/workstepService'
import { volumeControlService, type VolumeControl, type VolumeControlCreate } from '../services/volumeControlService'
import { rscService } from '../services/rscService'
import { 
  volumeControlServiceV2,
  type VolumeControlQuantity,
  type VolumeControlQuantityUpdate,
  type VolumeControlInspectionUpdate,
  type VolumeControlAsbuiltUpdate,
  type VolumeControlPaymentUpdate
} from '../services/volumeControlServiceV2'
import { Table, InputNumber } from 'antd'
import { PlusOutlined, EditOutlined } from '@ant-design/icons'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatHighPrecisionValue, formatQuantity } from '../utils/formatNumber'
import ActivityDesignInfo from '../components/activities/ActivityDesignInfo'
import BulkCloseModal from '../components/reports/BulkCloseModal'
import { logger } from '../utils/logger'
import LegacyModuleBanner from '../components/common/LegacyModuleBanner'

const { Option } = Select

/**
 * 统一的甘特图单元格渲染器
 */
const renderGanttCell = (colKey: string) => (val: any, record: any) => {
  if (colKey === 'status') {
    // 1. 明确取值：优先从 activity 对象取 system_status，其次取 status 字段，最后取原始 val
    const rawStatus = record.activity?.system_status || 
                    record.activity?.status || 
                    (record as any)?.system_status ||
                    (record as any)?.status || 
                    val;
    
    // 2. 格式化为标准枚举
    let status = 'Not Started';
    if (rawStatus === 'Completed') status = 'Completed';
    else if (rawStatus === 'In Progress') status = 'In Progress';

    // 3. 如果是分组行，不显示状态图标
    if (record.isGroupHeader || record.type === 'project' || record.activity_id?.startsWith('__group__')) return null;
    
    // 4. 定义圆角长方形样式
    const roundedRectStyle: React.CSSProperties = {
      width: '14px',
      height: '10px',
      borderRadius: '2px',
      display: 'inline-block',
      border: '1px solid rgba(0,0,0,0.3)',
      verticalAlign: 'middle'
    }

    if (status === 'Completed') {
      return <span style={{ ...roundedRectStyle, backgroundColor: '#0000FF' }} title="Completed" />
    } else if (status === 'In Progress') {
      return <span style={{ 
        ...roundedRectStyle, 
        background: 'linear-gradient(to right, #0000FF 50%, #00FF00 50%)' 
      }} title="In Progress" />
    } else {
      return <span style={{ ...roundedRectStyle, backgroundColor: '#00FF00' }} title="Not Started" />
    }
  }
  
  // 如果不是状态列，继续后续的数值格式化逻辑
  if (colKey === 'completed' || colKey === 'key_qty' || colKey === 'calculated_mhrs' || colKey === 'actual_manhour') {
    return formatQuantity(val, 3)
  }
  if (colKey === 'weight_factor' || colKey === 'actual_weight_factor') {
    return formatQuantity(val, 2)
  }
  return val !== undefined && val !== null ? String(val) : ''
}

// 格式化 manpower/machinery 数值：去除尾随0，避免科学计数法
const formatManpowerForChart = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined || value === '') return 0
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(numValue)) return 0
  return numValue
}

// 安全地将字符串/数字转换为数字，用于 InputNumber 组件
// 处理 "0E-20" 等科学计数法字符串，转换为 0
const safeStringToNumber = (value: string | number | null | undefined): number | undefined => {
  if (value === null || value === undefined || value === '') {
    return undefined
  }
  if (typeof value === 'number') {
    // 如果已经是数字，检查是否为 0（包括 -0）
    return value === 0 || Object.is(value, -0) ? 0 : value
  }
  if (typeof value === 'string') {
    // 处理字符串
    const trimmed = value.trim()
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') {
      return undefined
    }
    // 检查是否为科学计数法表示的 0（如 "0E-20", "0e-20", "0E+20" 等）
    const lowerTrimmed = trimmed.toLowerCase()
    if (lowerTrimmed.startsWith('0e') || lowerTrimmed === '0' || lowerTrimmed === '0.0' || lowerTrimmed === '0.00') {
      return 0
    }
    const numValue = parseFloat(trimmed)
    if (isNaN(numValue)) {
      return undefined
    }
    // 如果解析后的值为 0，直接返回 0
    if (numValue === 0 || Object.is(numValue, -0)) {
      return 0
    }
    return numValue
  }
  return undefined
}

// 可用的栏位定义
const AVAILABLE_COLUMNS = [
  { key: 'status', title: '状态', width: 60, align: 'center' as const, fixed: 'left' as const, render: renderGanttCell('status') },
  { key: 'activity_id', title: '作业代码', width: 150, fixed: 'left' as const },
  { key: 'title', title: '作业描述', width: 300 },
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
  { key: 'key_qty', title: '总量', width: 120, align: 'right' as const },
  { key: 'uom', title: '计量单位', width: 100 },
  { key: 'calculated_mhrs', title: '预算人工时', width: 120, align: 'right' as const },
  { key: 'weight_factor', title: '权重', width: 120, align: 'right' as const },
  { key: 'actual_weight_factor', title: '赢得权重', width: 120, align: 'right' as const },
  { key: 'start_date', title: '开始日期', width: 120 },
  { key: 'finish_date', title: '结束日期', width: 120 },
  { key: 'baseline1_start_date', title: 'BL1开始日期', width: 120 },
  { key: 'baseline1_finish_date', title: 'BL1结束日期', width: 120 },
  { key: 'planned_duration', title: '计划工期', width: 100, align: 'right' as const },
  { key: 'actual_start_date', title: '实际开始日期', width: 120 },
  { key: 'actual_finish_date', title: '实际结束日期', width: 120 },
  { key: 'actual_duration', title: '实际工期', width: 120, align: 'right' as const },
  { key: 'completed', title: '完成量', width: 100, align: 'right' as const, render: renderGanttCell('completed') },
  { key: 'actual_manhour', title: '实际人工时', width: 120, align: 'right' as const, render: renderGanttCell('actual_manhour') },
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

const ActivityListAdvanced = () => {
  const { message: messageApi } = App.useApp()
  const queryClient = useQueryClient()
  const globalFilter = useContext(GlobalFilterContext)
  const location = useLocation()
  const navigate = useNavigate()

  // 状态管理
  // 从localStorage加载筛选器状态
  const loadGroupByFromStorage = (): string[] => {
    try {
      const saved = localStorage.getItem('activities-advanced-groupBy')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          return parsed
        }
      }
    } catch (e) {
      logger.warn('Failed to load groupBy from storage:', e)
    }
    return []
  }

  const loadVisibleColumnsFromStorage = (): string[] => {
    try {
      const saved = localStorage.getItem('activities-advanced-visibleColumns')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
        }
      }
    } catch (e) {
      logger.warn('Failed to load visibleColumns from storage:', e)
    }
    return ['activity_id', 'title', 'block', 'discipline', 'work_package']
  }

  const [groupBy, setGroupBy] = useState<string[]>(loadGroupByFromStorage())
  const [visibleColumns, setVisibleColumns] = useState<string[]>(loadVisibleColumnsFromStorage())
  const [columnSettingsVisible, setColumnSettingsVisible] = useState(false)
  const [groupingPanelVisible, setGroupingPanelVisible] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 2000 })
  const [loadedItems, setLoadedItems] = useState<Activity[]>([]) // 累积加载的数据

  // 刷新单个作业数据的辅助函数（微刷新）
  const refreshSingleActivity = useCallback(async (activityId: string) => {
    try {
      logger.log(`Fetching updated data for activity: ${activityId}`);
      const updatedActivity = await activityService.getActivityById(activityId);
      
      // 1. 更新累积加载的列表数据 (loadedItems)
      setLoadedItems((prev: Activity[]) => prev.map(item => 
        item.activity_id === activityId ? updatedActivity : item
      ));
      
      // 2. 如果当前选中了该作业，更新选中状态 (selectedActivity)
      setSelectedActivity(prev => {
        if (prev && prev.activity_id === activityId) {
          // 合并更新，保留已有的 selectedActivity 中的 UI 状态（如果有的话）
          return { ...prev, ...updatedActivity };
        }
        return prev;
      });
      
      logger.log(`Micro-refresh successful for activity: ${activityId}`);
    } catch (err) {
      logger.error(`Micro-refresh failed for activity: ${activityId}`, err);
    }
  }, [setLoadedItems, setSelectedActivity]);
  const [hasMore, setHasMore] = useState(true) // 是否还有更多数据
  const [showDetailPanel, setShowDetailPanel] = useState(false)
  const [detailTab, setDetailTab] = useState('general')
  // 详情面板高度（可拖动调整）
  const [detailPanelHeight, setDetailPanelHeight] = useState(() => {
    try {
      const saved = localStorage.getItem('activity_detail_panel_height')
      if (saved) {
        const height = parseInt(saved, 10)
        if (height >= 200 && height <= 800) {
          return height
        }
      }
    } catch (e) {
      logger.error('Failed to load detail panel height:', e)
    }
    return 300 // 默认高度
  })
  const [isResizing, setIsResizing] = useState(false)
  
  // 从localStorage加载本地筛选器状态 (ACT ID, Title)
  const loadLocalFiltersFromStorage = () => {
    try {
      const saved = localStorage.getItem('activities-advanced-localFilters')
      if (saved) return JSON.parse(saved)
    } catch (e) {
      logger.error('Failed to load local filters:', e)
    }
    return { activity_id: '', title: '' }
  }

  const [localFilters, setLocalFilters] = useState(loadLocalFiltersFromStorage())

  // 保存本地筛选器到localStorage
  useEffect(() => {
    try {
      localStorage.setItem('activities-advanced-localFilters', JSON.stringify(localFilters))
    } catch (e) {
      logger.error('Failed to save local filters:', e)
    }
  }, [localFilters])
  // MPDB和VFACTDB相关状态
  const [mpdbModalVisible, setMpdbModalVisible] = useState(false)
  const [vfactdbModalVisible, setVfactdbModalVisible] = useState(false)
  const [editingMpdb, setEditingMpdb] = useState<MPDBResponse | null>(null)
  const [editingVfactdb, setEditingVfactdb] = useState<VFACTDBResponse | null>(null)
  const [editingWorkStepVolume, setEditingWorkStepVolume] = useState<WorkStepVolume | null>(null)
  const [workStepVolumeModalVisible, setWorkStepVolumeModalVisible] = useState(false)
  const [mpdbForm] = Form.useForm()
  const [vfactdbForm] = Form.useForm()
  const [workStepVolumeForm] = Form.useForm()
  // VolumeControl相关状态
  const [volumeControlModalVisible, setVolumeControlModalVisible] = useState(false)
  const [editingVolumeControl, setEditingVolumeControl] = useState<VolumeControl | null>(null)
  const [volumeControlForm] = Form.useForm()
  
  // VolumeControl V2 相关状态（乐观更新用请求序号，仅对最新请求做失败回滚）
  const quantityUpdateRequestIdRef = useRef(0)
  const vfactdbUpdateRequestIdRef = useRef(0)
  const [quantityModalVisible, setQuantityModalVisible] = useState(false)
  const [inspectionModalVisible, setInspectionModalVisible] = useState(false)
  const [asbuiltModalVisible, setAsbuiltModalVisible] = useState(false)
  const [paymentModalVisible, setPaymentModalVisible] = useState(false)
  const [bulkCloseModalVisible, setBulkCloseModalVisible] = useState(false)
  const [quantityForm] = Form.useForm()
  const [inspectionForm] = Form.useForm()
  const [asbuiltForm] = Form.useForm()
  const [paymentForm] = Form.useForm()
  const [timescaleModalVisible, setTimescaleModalVisible] = useState(false)
  const [gridWidth, setGridWidth] = useState(900) // 左侧表格宽度，可拖动调整（默认更紧凑）
  const [timescaleConfig, setTimescaleConfig] = useState<TimescaleConfig>({
    format: 'two', // 两行或三行
    primaryType: 'calendar',
    primaryInterval: 'year', // 第一行显示年
    secondaryInterval: 'month', // 第二行显示月（两行格式时）
    showOrdinal: false,
    ordinalInterval: 'month',
    zoomLevel: 1.0, // 默认缩放级别设为 100%
    // 默认使用固定时间范围（2019-10-11到2028-12-31）
    // 用户可以手动设置，任务条位置将根据任务日期在这个固定范围内的相对位置来计算
    startDate: '2019-10-11',
    endDate: '2028-12-31',
  })
  const [ganttZoom, setGanttZoom] = useState(1.0)
  // 初始化ganttColumns - 使用visibleColumns的初始值来计算初始列配置
  const [ganttColumns, setGanttColumns] = useState<GanttColumn[]>(() => {
    return visibleColumns.map(colKey => {
      const colDef = AVAILABLE_COLUMNS.find(c => c.key === colKey)
      if (!colDef) {
        return {
          key: colKey,
          title: colKey,
          width: 120,
          resizable: true,
          render: renderGanttCell(colKey)
        }
      }
      return {
        key: colDef.key,
        title: colDef.title,
        width: colDef.width,
        align: colDef.align,
        fixed: colDef.fixed,
        resizable: true,
        render: renderGanttCell(colDef.key)
      }
    })
  })
  const [viewModalVisible, setViewModalVisible] = useState(false)
  const [savedViews, setSavedViews] = useState<Array<{
    id: string
    name: string
    groupBy: string[]
    visibleColumns: string[]
    columnWidths: Record<string, number>
    gridWidth: number
    timescaleConfig: TimescaleConfig
    expandedGroups?: Record<string, boolean> // 折叠/展开状态
    expandToLevel?: number | null // 展开到第N层
  }>>([])
  
  // 任务层级颜色配置（从localStorage加载，默认使用P6经典配色）
  const [taskColors, setTaskColors] = useState<TaskLevelColors>(() => {
    try {
      const saved = localStorage.getItem('gantt_task_colors')
      if (saved) {
        const parsed = JSON.parse(saved)
        // 验证所有必需的颜色字段都存在（支持9个层级）
        if (parsed.level0 && parsed.level1 && parsed.level2 && parsed.level3 && parsed.level4 &&
            parsed.level5 && parsed.level6 && parsed.level7 && parsed.level8) {
          return parsed as TaskLevelColors
        }
      }
    } catch (e) {
      logger.error('Failed to load task colors from localStorage:', e)
    }
    return DEFAULT_TASK_COLORS
  })
  
  const [colorSettingsVisible, setColorSettingsVisible] = useState(false)
  
  // 分组折叠/展开状态管理：使用Map存储每个分组的展开状态，key为分组ID
  const [expandedGroups, setExpandedGroups] = useState<Map<string, boolean>>(new Map())

  // 保存 groupBy 到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem('activities-advanced-groupBy', JSON.stringify(groupBy))
    } catch (e) {
      logger.warn('Failed to save groupBy to storage:', e)
    }
  }, [groupBy])

  // 保存 visibleColumns 到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem('activities-advanced-visibleColumns', JSON.stringify(visibleColumns))
    } catch (e) {
      logger.warn('Failed to save visibleColumns to storage:', e)
    }
  }, [visibleColumns])
  
  // 展开到第N层的状态（null表示全部展开）
  const [expandToLevel, setExpandToLevel] = useState<number | null>(null)
  const [isAllCollapsed, setIsAllCollapsed] = useState(false) // 跟踪是否全部折叠

  // 仅让 Activities 内部区域滚动：禁止页面级滚动
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  // 从 URL 参数读取 activity_id 并自动选中
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const activityIdFromUrl = params.get('activity_id')
    
    if (activityIdFromUrl) {
      // 1. 如果跳转过来，且本地筛选器还没更新或有其他冲突筛选，先清空/重置本地筛选
      if (localFilters.activity_id !== activityIdFromUrl || localFilters.title !== '') {
        logger.log('Jumping from URL, setting local filters for:', activityIdFromUrl)
        setLocalFilters({
          activity_id: activityIdFromUrl,
          title: '' // 清空作业描述搜索，避免冲突
        })
        // 注意：这里设置后会触发 useQuery 重新获取数据
      }

      // 2. 如果数据已经加载且包含该作业，则选中它
      if (loadedItems.length > 0) {
        const activity = loadedItems.find(a => a.activity_id === activityIdFromUrl)
        if (activity) {
          logger.log('Activity found in loadedItems, selecting:', activityIdFromUrl)
          setSelectedActivity(activity)
          setShowDetailPanel(true)
          // 选中后清除 URL 参数，避免刷新时重复触发
          navigate(location.pathname, { replace: true })
        }
      }
    }
  }, [location.search, loadedItems, navigate, localFilters.activity_id, localFilters.title])

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
  
  // 确保在筛选器变化时，分页被重置为1
  // 当 filters 变化时，使用 current: 1，否则使用 pagination.current
  // 关键：使用 filtersKey 来判断筛选器是否变化，而不是依赖 ref（因为 ref 更新是异步的）
  const effectivePagination = useMemo(() => {
    if (isFirstMountRef.current) {
      return pagination
    }
    // 如果 filters 变化了（通过比较 filtersKey 和 ref），强制使用 current: 1
    // 注意：这里使用 ref 来跟踪上一次的 filtersKey，确保在筛选器变化时立即返回 current: 1
    const filtersChanged = lastFiltersKeyForPaginationRef.current !== filtersKey
    if (filtersChanged) {
      logger.log('EffectivePagination: filters changed, using current: 1', {
        lastFiltersKey: lastFiltersKeyForPaginationRef.current,
        currentFiltersKey: filtersKey,
        paginationCurrent: pagination.current,
      })
      return { current: 1, pageSize: pagination.pageSize }
    }
    return pagination
  }, [filtersKey, pagination])
  
  useEffect(() => {
    // 跳过首次挂载，只在 filtersKey 真正变化时才重置
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false
      prevFiltersKeyRef.current = filtersKey
      lastFiltersKeyForPaginationRef.current = filtersKey
      return
    }
    
    // 只有当 filtersKey 真正变化时才重置
    if (prevFiltersKeyRef.current !== filtersKey) {
      logger.log('Filters changed, resetting pagination and loaded items. Filters:', filters)
      // 关键：在重置之前，先更新 lastFiltersKeyForPaginationRef，确保 effectivePagination 立即返回正确的值
      // 但是，我们需要在数据加载完成后再更新它，以避免在数据加载期间触发多次查询
      // 所以这里先不更新，让 effectivePagination 检测到变化并返回 current: 1
      setPagination({ current: 1, pageSize: pagination.pageSize })
      setLoadedItems([])
      setHasMore(true)
      prevFiltersKeyRef.current = filtersKey
      // 重置加载标志，防止自动加载更多
      isLoadingMoreRef.current = false
      // 重置滚动位置到顶部
      setTimeout(() => {
        const scrollContainer = verticalScrollRefForLoadMore.current
        if (scrollContainer) {
          scrollContainer.scrollTop = 0
          logger.log('Reset scroll position to top after filter change')
        }
      }, 100)
      // 注意：不在这里更新 lastFiltersKeyForPaginationRef，让它在数据加载完成后再更新
      // 这样 effectivePagination 在数据加载期间会一直返回 current: 1
    }
  }, [filtersKey, filters, pagination.pageSize])

  // 加载用户偏好设置
  const { data: columnPreferences } = useQuery({
    queryKey: ['activity-column-preferences'],
    queryFn: () => activityService.getUserColumnPreferences(),
  })

  const { data: groupingPreferences } = useQuery({
    queryKey: ['activity-grouping-preferences'],
    queryFn: () => activityService.getUserGroupingPreferences(),
  })

  // 拖动调整详情面板高度
  const resizeRef = useRef<{
    startY: number
    startHeight: number
    rafId: number | null
  }>({ startY: 0, startHeight: 0, rafId: null })

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      // 使用 requestAnimationFrame 优化性能
      if (resizeRef.current.rafId) {
        cancelAnimationFrame(resizeRef.current.rafId)
      }

      resizeRef.current.rafId = requestAnimationFrame(() => {
        const deltaY = resizeRef.current.startY - e.clientY // 鼠标向上移动，高度增加
        const newHeight = resizeRef.current.startHeight + deltaY
        // 限制高度范围：200px - 800px
        const clampedHeight = Math.max(200, Math.min(800, newHeight))
        setDetailPanelHeight(clampedHeight)
      })
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      // 保存高度到localStorage
      try {
        const finalHeight = detailPanelHeight
        localStorage.setItem('activity_detail_panel_height', finalHeight.toString())
      } catch (e) {
        logger.error('Failed to save detail panel height:', e)
      }
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      if (resizeRef.current.rafId) {
        cancelAnimationFrame(resizeRef.current.rafId)
        resizeRef.current.rafId = null
      }
    }

    document.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      if (resizeRef.current.rafId) {
        cancelAnimationFrame(resizeRef.current.rafId)
        resizeRef.current.rafId = null
      }
    }
  }, [isResizing, detailPanelHeight])

  // MPDB和VFACTDB查询（详情面板打开时就加载，用于显示汇总信息）
  const { data: mpdbDataResponse, refetch: refetchMpdb, isLoading: isMpdbLoading } = useQuery({
    queryKey: ['mpdb', selectedActivity?.activity_id],
    queryFn: () => reportService.getMPDB({ activity_id: selectedActivity?.activity_id }),
    enabled: !!selectedActivity?.activity_id && showDetailPanel,
  })

  const { data: vfactdbDataResponse, refetch: refetchVfactdb, isLoading: isVfactdbLoading } = useQuery({
    queryKey: ['vfactdb', selectedActivity?.activity_id],
    queryFn: () => reportService.getVFACTDB({ activity_id: selectedActivity?.activity_id }),
    enabled: !!selectedActivity?.activity_id && showDetailPanel,
  })

  // 关键：获取该作业的准确统计信息，不受列表分页 limit 100 的限制
  const { data: vfactdbStats, refetch: refetchVfactdbStats } = useQuery({
    queryKey: ['vfactdb-statistics', selectedActivity?.activity_id],
    queryFn: () => reportService.getVFACTDBStatistics(selectedActivity!.activity_id),
    enabled: !!selectedActivity?.activity_id && showDetailPanel,
  })

  // 从响应中提取数据项
  const mpdbData = useMemo(() => {
    if (!mpdbDataResponse) return []
    if (mpdbDataResponse && typeof mpdbDataResponse === 'object' && 'items' in mpdbDataResponse) {
      return mpdbDataResponse.items || []
    }
    return Array.isArray(mpdbDataResponse) ? mpdbDataResponse : []
  }, [mpdbDataResponse])

  const vfactdbData = useMemo(() => {
    if (!vfactdbDataResponse) return []
    if (vfactdbDataResponse && typeof vfactdbDataResponse === 'object' && 'items' in vfactdbDataResponse) {
      return vfactdbDataResponse.items || []
    }
    return Array.isArray(vfactdbDataResponse) ? vfactdbDataResponse : []
  }, [vfactdbDataResponse])

  // 获取非关键工作步骤定义（用于下拉选择）
  const { data: nonKeyWorkSteps } = useQuery({
    queryKey: ['non-key-worksteps', selectedActivity?.work_package],
    queryFn: () => workstepService.getWorkStepDefines({
      work_package: selectedActivity?.work_package,
      is_key_quantity: false,
      is_active: true,
    }),
    enabled: !!selectedActivity?.work_package && showDetailPanel && detailTab === 'non-key-volumes',
  })

  // 获取工作步骤定义（用于 Physical Volume Report Records 下拉选择，只显示关键工程量）
  const { data: workStepsForVfactdb, isLoading: workStepsLoading } = useQuery({
    queryKey: ['worksteps-for-vfactdb', selectedActivity?.work_package],
    queryFn: () => workstepService.getWorkStepDefines({
      work_package: selectedActivity?.work_package,
      is_key_quantity: true,  // 只获取关键工程量
      is_active: true,
    }),
    enabled: !!selectedActivity?.work_package && vfactdbModalVisible,
  })

  // 获取非关键工程量（预估总量）数据
  const { data: workStepVolumesData, refetch: refetchWorkStepVolumes } = useQuery({
    queryKey: ['workstep-volumes', selectedActivity?.activity_id],
    queryFn: () => workstepVolumeService.getWorkStepVolumes({
      activity_id: selectedActivity?.activity_id,
    }),
    enabled: !!selectedActivity?.activity_id && showDetailPanel && detailTab === 'non-key-volumes',
  })

  // VolumeControl查询（旧版，保留用于兼容）
  const { data: volumeControlData, refetch: refetchVolumeControl } = useQuery({
    queryKey: ['volume-control', selectedActivity?.activity_id],
    queryFn: () => volumeControlService.getVolumeControlByActivityId(selectedActivity!.activity_id),
    enabled: !!selectedActivity?.activity_id && showDetailPanel,
  })

  // VolumeControl V2 查询（新版，4个表）
  const { data: quantityData, error: quantityError, refetch: refetchQuantity } = useQuery({
    queryKey: ['volume-control-v2-quantity', selectedActivity?.activity_id],
    queryFn: () => volumeControlServiceV2.getQuantity(selectedActivity!.activity_id),
    enabled: !!selectedActivity?.activity_id && showDetailPanel,
    retry: false, // 403错误不重试
  })

  const { data: inspectionData, error: inspectionError, refetch: refetchInspection } = useQuery({
    queryKey: ['volume-control-v2-inspection', selectedActivity?.activity_id],
    queryFn: () => volumeControlServiceV2.getInspection(selectedActivity!.activity_id),
    enabled: !!selectedActivity?.activity_id && showDetailPanel,
    retry: false, // 403错误不重试
  })

  const { data: asbuiltData, error: asbuiltError, refetch: refetchAsbuilt } = useQuery({
    queryKey: ['volume-control-v2-asbuilt', selectedActivity?.activity_id],
    queryFn: () => volumeControlServiceV2.getAsbuilt(selectedActivity!.activity_id),
    enabled: !!selectedActivity?.activity_id && showDetailPanel,
    retry: false, // 403错误不重试
  })

  const { data: paymentData, error: paymentError, refetch: refetchPayment } = useQuery({
    queryKey: ['volume-control-v2-payment', selectedActivity?.activity_id],
    queryFn: () => volumeControlServiceV2.getPayment(selectedActivity!.activity_id),
    enabled: !!selectedActivity?.activity_id && showDetailPanel,
    retry: false, // 403错误不重试
  })

  const { data: rfiNames } = useQuery({
    queryKey: ['rfi-names', selectedActivity?.activity_id],
    queryFn: () => volumeControlServiceV2.getRFINames(selectedActivity!.activity_id),
    enabled: !!selectedActivity?.activity_id && showDetailPanel,
    retry: false, // 403错误不重试
  })

  // 检查是否是权限错误（403）
  const isPermissionError = (error: any): boolean => {
    return error?.response?.status === 403 || error?.response?.statusCode === 403
  }

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

  // 计算完成量（用于联动更新和详情显示）
  const calculatedCompleted = useMemo(() => {
    // 优先使用后端统计出的准确值（数据库全量 SUM 结果）
    if (vfactdbStats && typeof vfactdbStats.total_achieved === 'number') {
      return vfactdbStats.total_achieved
    }
    // 降级使用前端列表求和（仅作为 fallback）
    return vfactdbData?.reduce((sum: number, entry: VFACTDBResponse) => {
      const achieved = typeof entry.achieved === 'number' ? entry.achieved : (typeof entry.achieved === 'string' ? parseFloat(entry.achieved) || 0 : 0)
      return sum + achieved
    }, 0) || 0
  }, [vfactdbData, vfactdbStats])

  // 计算汇总信息
  const summaryInfo = useMemo(() => {
    const totalManpowerDays = mpdbData?.reduce((sum: number, entry: MPDBResponse) => {
      const manpower = typeof entry.manpower === 'number' ? entry.manpower : (typeof entry.manpower === 'string' ? parseFloat(entry.manpower) || 0 : 0)
      return sum + manpower
    }, 0) || 0
    
    // 使用准确的累计完成量
    const totalAchieved = calculatedCompleted;
    
    return {
      totalManpowerDays,
      totalAchieved,
    }
  }, [mpdbData, calculatedCompleted])

  // MPDB增删改查mutations
  const createMpdbMutation = useMutation({
    mutationFn: (entry: MPDBEntry) => reportService.createMPDB(entry),
    onSuccess: (_response) => {
      messageApi.success('MPDB记录创建成功')
      setMpdbModalVisible(false)
      mpdbForm.resetFields()
      refetchMpdb()
      
      // 关键：微刷新甘特图列表数据
      if (selectedActivity) {
        refreshSingleActivity(selectedActivity.activity_id);
      }

      // 刷新甘特图列表数据（后台静默获取）
      queryClient.invalidateQueries({ queryKey: ['activities'] })
    },
    onError: (error: any) => {
      messageApi.error(error?.response?.data?.detail || '创建失败')
    },
  })

  const updateMpdbMutation = useMutation({
    mutationFn: ({ id, entry }: { id: number; entry: MPDBEntry }) => reportService.updateMPDB(id, entry),
    onSuccess: (_response) => {
      messageApi.success('MPDB记录更新成功')
      setMpdbModalVisible(false)
      setEditingMpdb(null)
      mpdbForm.resetFields()
      refetchMpdb()
      
      // 关键：微刷新甘特图列表数据
      if (selectedActivity) {
        refreshSingleActivity(selectedActivity.activity_id);
      }

      // 刷新甘特图列表数据（后台静默获取）
      queryClient.invalidateQueries({ queryKey: ['activities'] })
    },
    onError: (error: any) => {
      messageApi.error(error?.response?.data?.detail || '更新失败')
    },
  })

  const deleteMpdbMutation = useMutation({
    mutationFn: (id: number) => reportService.deleteMPDB(id),
    onSuccess: () => {
      messageApi.success('MPDB记录删除成功')
      refetchMpdb()
      
      // 关键：触发甘特图刷新
      if (selectedActivity) {
        refreshSingleActivity(selectedActivity.activity_id);
      }
      queryClient.invalidateQueries({ queryKey: ['activities'] })
    },
    onError: (error: any) => {
      messageApi.error(error?.response?.data?.detail || '删除失败')
    },
  })

  // 从 vfactdb 缓存中取出 items 数组（兼容 { items, total } 与 直接数组）
  const getVfactdbItemsFromCache = useCallback((cache: unknown): VFACTDBResponse[] => {
    if (!cache) return []
    if (typeof cache === 'object' && cache !== null && 'items' in cache && Array.isArray((cache as { items: unknown }).items)) {
      return (cache as { items: VFACTDBResponse[] }).items
    }
    return Array.isArray(cache) ? (cache as VFACTDBResponse[]) : []
  }, [])
  const sumAchieved = useCallback((items: { achieved?: string | number }[]): number => {
    return items.reduce((sum, e) => {
      const v = e.achieved
      const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) || 0 : 0
      return sum + n
    }, 0)
  }, [])

  // VFACTDB 增删改 mutations：乐观更新列表 + 完成量后门（construction_completed / Activity.completed 由 VFACTDB 汇总，不直接写接口）
  const createVfactdbMutation = useMutation({
    mutationFn: (entry: VFACTDBEntry) => reportService.createVFACTDB(entry),
    onMutate: async (entry) => {
      const activity_id = entry.activity_id
      const requestId = ++vfactdbUpdateRequestIdRef.current
      const vfactdbCache = queryClient.getQueryData(['vfactdb', activity_id])
      const prevItems = getVfactdbItemsFromCache(vfactdbCache)
      const quantityCache = queryClient.getQueryData<VolumeControlQuantity>(['volume-control-v2-quantity', activity_id])
      const prevConstructionCompleted = quantityCache?.construction_completed
      const act = loadedItems.find((a) => a.activity_id === activity_id) ?? (selectedActivity?.activity_id === activity_id ? selectedActivity : null)
      const prevCompleted = act?.completed

      const optimisticRecord: VFACTDBResponse = { ...entry, id: -Date.now() } as VFACTDBResponse
      const newItems = [...prevItems, optimisticRecord]
      const newTotalAchieved = sumAchieved(newItems)

      const nextVfactdbCache = typeof vfactdbCache === 'object' && vfactdbCache !== null && 'items' in vfactdbCache
        ? { ...(vfactdbCache as object), items: newItems, total: newItems.length }
        : newItems
      queryClient.setQueryData(['vfactdb', activity_id], nextVfactdbCache)

      if (quantityCache) {
        queryClient.setQueryData<VolumeControlQuantity>(['volume-control-v2-quantity', activity_id], {
          ...quantityCache,
          construction_completed: String(newTotalAchieved),
        })
      }
      setLoadedItems((prev) => prev.map((item) => (item.activity_id === activity_id ? { ...item, completed: newTotalAchieved } : item)))
      setSelectedActivity((prev) => (prev?.activity_id === activity_id ? { ...prev, completed: newTotalAchieved } : prev))

      return { activity_id, prevVfactdbCache: vfactdbCache, prevConstructionCompleted, prevCompleted, requestId }
    },
    onSuccess: (_response) => {
      messageApi.success('VFACTDB记录创建成功')
      setVfactdbModalVisible(false)
      vfactdbForm.resetFields()
      try {
        refetchVfactdb()
        refetchVfactdbStats()
        refetchVolumeControl().catch((err) => logger.error('刷新VolumeControl失败:', err))
        refetchQuantity().catch((err) => logger.error('刷新Quantity失败:', err))
        if (selectedActivity) refreshSingleActivity(selectedActivity.activity_id)
        queryClient.invalidateQueries({ queryKey: ['vfactdb'] })
        queryClient.invalidateQueries({ queryKey: ['activities'] })
        queryClient.invalidateQueries({ queryKey: ['daily-report-management'] })
      } catch (error) {
        logger.error('刷新数据失败:', error)
      }
    },
    onError: (error: any, _variables, context) => {
      if (!context) return
      const { activity_id, prevVfactdbCache, prevConstructionCompleted, prevCompleted, requestId } = context as {
        activity_id: string
        prevVfactdbCache: unknown
        prevConstructionCompleted: string | null | undefined
        prevCompleted: number | undefined
        requestId: number
      }
      if (requestId !== vfactdbUpdateRequestIdRef.current) return
      queryClient.setQueryData(['vfactdb', activity_id], prevVfactdbCache)
      queryClient.setQueryData<VolumeControlQuantity>(['volume-control-v2-quantity', activity_id], (old) =>
        old ? { ...old, construction_completed: prevConstructionCompleted ?? old.construction_completed } : old
      )
      setLoadedItems((prev) => prev.map((item) => (item.activity_id === activity_id ? { ...item, completed: prevCompleted } : item)))
      setSelectedActivity((prev) => (prev?.activity_id === activity_id ? { ...prev, completed: prevCompleted } : prev))
      messageApi.error(error?.response?.data?.detail || error?.message || '创建失败')
    },
  })

  const updateVfactdbMutation = useMutation({
    mutationFn: ({ id, entry }: { id: number; entry: VFACTDBEntry }) => reportService.updateVFACTDB(id, entry),
    onMutate: async ({ id, entry }) => {
      const activity_id = entry.activity_id
      const requestId = ++vfactdbUpdateRequestIdRef.current
      const vfactdbCache = queryClient.getQueryData(['vfactdb', activity_id])
      const prevItems = getVfactdbItemsFromCache(vfactdbCache)
      const quantityCache = queryClient.getQueryData<VolumeControlQuantity>(['volume-control-v2-quantity', activity_id])
      const prevConstructionCompleted = quantityCache?.construction_completed
      const act = loadedItems.find((a) => a.activity_id === activity_id) ?? (selectedActivity?.activity_id === activity_id ? selectedActivity : null)
      const prevCompleted = act?.completed

      const newItems = prevItems.map((r) => (r.id === id ? ({ ...r, ...entry, id } as VFACTDBResponse) : r))
      const newTotalAchieved = sumAchieved(newItems)

      const nextVfactdbCache = typeof vfactdbCache === 'object' && vfactdbCache !== null && 'items' in vfactdbCache
        ? { ...(vfactdbCache as object), items: newItems, total: newItems.length }
        : newItems
      queryClient.setQueryData(['vfactdb', activity_id], nextVfactdbCache)

      if (quantityCache) {
        queryClient.setQueryData<VolumeControlQuantity>(['volume-control-v2-quantity', activity_id], {
          ...quantityCache,
          construction_completed: String(newTotalAchieved),
        })
      }
      setLoadedItems((prev) => prev.map((item) => (item.activity_id === activity_id ? { ...item, completed: newTotalAchieved } : item)))
      setSelectedActivity((prev) => (prev?.activity_id === activity_id ? { ...prev, completed: newTotalAchieved } : prev))

      return { activity_id, prevVfactdbCache: vfactdbCache, prevConstructionCompleted, prevCompleted, requestId }
    },
    onSuccess: (_response) => {
      messageApi.success('VFACTDB记录更新成功')
      setVfactdbModalVisible(false)
      setEditingVfactdb(null)
      vfactdbForm.resetFields()
      try {
        refetchVfactdb()
        refetchVfactdbStats()
        refetchVolumeControl().catch((err) => logger.error('刷新VolumeControl失败:', err))
        refetchQuantity().catch((err) => logger.error('刷新Quantity失败:', err))
        if (selectedActivity) refreshSingleActivity(selectedActivity.activity_id)
        queryClient.invalidateQueries({ queryKey: ['vfactdb'] })
        queryClient.invalidateQueries({ queryKey: ['activities'] })
        queryClient.invalidateQueries({ queryKey: ['daily-report-management'] })
      } catch (error) {
        logger.error('刷新数据失败:', error)
      }
    },
    onError: (error: any, _variables, context) => {
      if (!context) return
      const { activity_id, prevVfactdbCache, prevConstructionCompleted, prevCompleted, requestId } = context as {
        activity_id: string
        prevVfactdbCache: unknown
        prevConstructionCompleted: string | null | undefined
        prevCompleted: number | undefined
        requestId: number
      }
      if (requestId !== vfactdbUpdateRequestIdRef.current) return
      queryClient.setQueryData(['vfactdb', activity_id], prevVfactdbCache)
      queryClient.setQueryData<VolumeControlQuantity>(['volume-control-v2-quantity', activity_id], (old) =>
        old ? { ...old, construction_completed: prevConstructionCompleted ?? old.construction_completed } : old
      )
      setLoadedItems((prev) => prev.map((item) => (item.activity_id === activity_id ? { ...item, completed: prevCompleted } : item)))
      setSelectedActivity((prev) => (prev?.activity_id === activity_id ? { ...prev, completed: prevCompleted } : prev))
      messageApi.error(error?.response?.data?.detail || error?.message || '更新失败')
    },
  })

  const deleteVfactdbMutation = useMutation({
    mutationFn: (vars: { id: number; activity_id: string }) => reportService.deleteVFACTDB(vars.id),
    onMutate: async ({ id, activity_id }) => {
      const requestId = ++vfactdbUpdateRequestIdRef.current
      const vfactdbCache = queryClient.getQueryData(['vfactdb', activity_id])
      const prevItems = getVfactdbItemsFromCache(vfactdbCache)
      const quantityCache = queryClient.getQueryData<VolumeControlQuantity>(['volume-control-v2-quantity', activity_id])
      const prevConstructionCompleted = quantityCache?.construction_completed
      const act = loadedItems.find((a) => a.activity_id === activity_id) ?? (selectedActivity?.activity_id === activity_id ? selectedActivity : null)
      const prevCompleted = act?.completed

      const newItems = prevItems.filter((r) => r.id !== id)
      const newTotalAchieved = sumAchieved(newItems)

      const nextVfactdbCache = typeof vfactdbCache === 'object' && vfactdbCache !== null && 'items' in vfactdbCache
        ? { ...(vfactdbCache as object), items: newItems, total: newItems.length }
        : newItems
      queryClient.setQueryData(['vfactdb', activity_id], nextVfactdbCache)

      if (quantityCache) {
        queryClient.setQueryData<VolumeControlQuantity>(['volume-control-v2-quantity', activity_id], {
          ...quantityCache,
          construction_completed: String(newTotalAchieved),
        })
      }
      setLoadedItems((prev) => prev.map((item) => (item.activity_id === activity_id ? { ...item, completed: newTotalAchieved } : item)))
      setSelectedActivity((prev) => (prev?.activity_id === activity_id ? { ...prev, completed: newTotalAchieved } : prev))

      return { activity_id, prevVfactdbCache: vfactdbCache, prevConstructionCompleted, prevCompleted, requestId }
    },
    onSuccess: (_response) => {
      messageApi.success('VFACTDB记录删除成功')
      try {
        refetchVfactdb()
        refetchVfactdbStats()
        refetchVolumeControl().catch((err) => logger.error('刷新VolumeControl失败:', err))
        refetchQuantity().catch((err) => logger.error('刷新Quantity失败:', err))
        if (selectedActivity) refreshSingleActivity(selectedActivity.activity_id)
        queryClient.invalidateQueries({ queryKey: ['vfactdb'] })
        queryClient.invalidateQueries({ queryKey: ['activities'] })
        queryClient.invalidateQueries({ queryKey: ['daily-report-management'] })
      } catch (error) {
        logger.error('刷新数据失败:', error)
      }
    },
    onError: (error: any, _variables, context) => {
      if (!context) return
      const { activity_id, prevVfactdbCache, prevConstructionCompleted, prevCompleted, requestId } = context as {
        activity_id: string
        prevVfactdbCache: unknown
        prevConstructionCompleted: string | null | undefined
        prevCompleted: number | undefined
        requestId: number
      }
      if (requestId !== vfactdbUpdateRequestIdRef.current) return
      queryClient.setQueryData(['vfactdb', activity_id], prevVfactdbCache)
      queryClient.setQueryData<VolumeControlQuantity>(['volume-control-v2-quantity', activity_id], (old) =>
        old ? { ...old, construction_completed: prevConstructionCompleted ?? old.construction_completed } : old
      )
      setLoadedItems((prev) => prev.map((item) => (item.activity_id === activity_id ? { ...item, completed: prevCompleted } : item)))
      setSelectedActivity((prev) => (prev?.activity_id === activity_id ? { ...prev, completed: prevCompleted } : prev))
      messageApi.error(error?.response?.data?.detail || error?.message || '删除失败')
    },
  })

  // 非关键工程量（预估总量）增删改查mutations
  const createOrUpdateWorkStepVolumeMutation = useMutation({
    mutationFn: (entry: WorkStepVolumeCreate) => workstepVolumeService.createOrUpdateWorkStepVolume(entry),
    onSuccess: () => {
      messageApi.success('非关键工程量保存成功')
      setWorkStepVolumeModalVisible(false)
      setEditingWorkStepVolume(null)
      workStepVolumeForm.resetFields()
      refetchWorkStepVolumes()
      
      // 关键：微刷新甘特图列表数据
      if (selectedActivity) {
        refreshSingleActivity(selectedActivity.activity_id);
      }
      
      // 刷新甘特图列表数据（后台静默获取）
      queryClient.invalidateQueries({ queryKey: ['activities'] })
    },
    onError: (error: any) => {
      messageApi.error(error?.response?.data?.detail || '保存失败')
    },
  })

  const deleteWorkStepVolumeMutation = useMutation({
    mutationFn: (id: number) => workstepVolumeService.deleteWorkStepVolume(id),
    onSuccess: () => {
      messageApi.success('非关键工程量删除成功')
      refetchWorkStepVolumes()
      
      // 关键：微刷新甘特图列表数据
      if (selectedActivity) {
        refreshSingleActivity(selectedActivity.activity_id);
      }
      
      // 刷新甘特图列表数据（后台静默获取）
      queryClient.invalidateQueries({ queryKey: ['activities'] })
    },
    onError: (error: any) => {
      messageApi.error(error?.response?.data?.detail || '删除失败')
    },
  })

  // VolumeControl更新mutation（旧版，保留用于兼容）
  const updateVolumeControlMutation = useMutation({
    mutationFn: ({ id, entry }: { id: number; entry: Partial<VolumeControlCreate> }) => 
      volumeControlService.updateVolumeControl(id, entry),
    onSuccess: () => {
      messageApi.success('VolumeControl记录更新成功')
      setVolumeControlModalVisible(false)
      setEditingVolumeControl(null)
      volumeControlForm.resetFields()
      refetchVolumeControl()
      
      // 微刷新
      if (selectedActivity) {
        refreshSingleActivity(selectedActivity.activity_id);
      }
    },
    onError: (error: any) => {
      messageApi.error(error?.response?.data?.detail || '更新失败')
    },
  })

  // VolumeControl V2 更新 mutations：工程量乐观更新 + key_qty 后门（不涉及 construction_completed，该字段仅由 VFACTDB 汇总）
  const updateQuantityMutation = useMutation({
    mutationFn: ({ activity_id, data }: { activity_id: string; data: VolumeControlQuantityUpdate }) =>
      volumeControlServiceV2.updateQuantity(activity_id, data),
    onMutate: async ({ activity_id, data }) => {
      const requestId = ++quantityUpdateRequestIdRef.current
      const prevQuantityData = queryClient.getQueryData<VolumeControlQuantity>(['volume-control-v2-quantity', activity_id])
      const act = loadedItems.find((a) => a.activity_id === activity_id) ?? (selectedActivity?.activity_id === activity_id ? selectedActivity : null)
      const prevKeyQty = act?.key_qty

      // 乐观更新：Quantity 缓存（仅用户可编辑字段，不含 construction_completed）
      queryClient.setQueryData<VolumeControlQuantity>(['volume-control-v2-quantity', activity_id], (old) => {
        if (!old) return old
        const next: VolumeControlQuantity = { ...old }
        if (data.estimated_total !== undefined) next.estimated_total = data.estimated_total == null ? null : String(data.estimated_total)
        if (data.drawing_approved_afc !== undefined) next.drawing_approved_afc = data.drawing_approved_afc == null ? null : String(data.drawing_approved_afc)
        if (data.material_arrived !== undefined) next.material_arrived = data.material_arrived == null ? null : String(data.material_arrived)
        if (data.available_workface !== undefined) next.available_workface = data.available_workface == null ? null : String(data.available_workface)
        if (data.workface_restricted_material !== undefined) next.workface_restricted_material = data.workface_restricted_material == null ? null : String(data.workface_restricted_material)
        if (data.workface_restricted_site !== undefined) next.workface_restricted_site = data.workface_restricted_site == null ? null : String(data.workface_restricted_site)
        if (data.responsible_user_id !== undefined) next.responsible_user_id = data.responsible_user_id ?? null
        return next
      })

      // key_qty 后门：业务上 key_qty = estimated_total，列表/甘特即时显示预估总量
      if (data.estimated_total !== undefined) {
        const newKeyQty = data.estimated_total
        setLoadedItems((prev) => prev.map((item) => (item.activity_id === activity_id ? { ...item, key_qty: newKeyQty } : item)))
        setSelectedActivity((prev) => (prev?.activity_id === activity_id ? { ...prev, key_qty: newKeyQty } : prev))
      }

      return { activity_id, prevQuantityData, prevKeyQty, requestId }
    },
    onSuccess: (_response) => {
      messageApi.success('工程量及完工信息更新成功')
      refetchQuantity()
      refetchVfactdb()
      refetchVfactdbStats()
      if (selectedActivity) {
        refreshSingleActivity(selectedActivity.activity_id)
      }
      queryClient.invalidateQueries({ queryKey: ['activities'] })
    },
    onError: (error: any, _variables, context) => {
      if (!context) return
      const { activity_id, prevQuantityData, prevKeyQty, requestId } = context as {
        activity_id: string
        prevQuantityData: VolumeControlQuantity | undefined
        prevKeyQty: number | undefined
        requestId: number
      }
      if (requestId !== quantityUpdateRequestIdRef.current) return
      if (prevQuantityData !== undefined) {
        queryClient.setQueryData(['volume-control-v2-quantity', activity_id], prevQuantityData)
      }
      setLoadedItems((prev) => prev.map((item) => (item.activity_id === activity_id ? { ...item, key_qty: prevKeyQty } : item)))
      setSelectedActivity((prev) => (prev?.activity_id === activity_id ? { ...prev, key_qty: prevKeyQty } : prev))
      messageApi.error(error?.response?.data?.detail || '更新失败')
    },
  })

  const updateInspectionMutation = useMutation({
    mutationFn: ({ activity_id, data }: { activity_id: string; data: VolumeControlInspectionUpdate }) =>
      volumeControlServiceV2.updateInspection(activity_id, data),
    onSuccess: () => {
      messageApi.success('验收相关信息更新成功')
      refetchInspection()
      // 微刷新
      if (selectedActivity) {
        refreshSingleActivity(selectedActivity.activity_id);
      }
    },
    onError: (error: any) => {
      messageApi.error(error?.response?.data?.detail || '更新失败')
    },
  })

  const updateAsbuiltMutation = useMutation({
    mutationFn: ({ activity_id, data }: { activity_id: string; data: VolumeControlAsbuiltUpdate }) =>
      volumeControlServiceV2.updateAsbuilt(activity_id, data),
    onSuccess: () => {
      messageApi.success('竣工资料相关信息更新成功')
      refetchAsbuilt()
      // 微刷新
      if (selectedActivity) {
        refreshSingleActivity(selectedActivity.activity_id);
      }
    },
    onError: (error: any) => {
      messageApi.error(error?.response?.data?.detail || '更新失败')
    },
  })

  const updatePaymentMutation = useMutation({
    mutationFn: ({ activity_id, data }: { activity_id: string; data: VolumeControlPaymentUpdate }) =>
      volumeControlServiceV2.updatePayment(activity_id, data),
    onSuccess: () => {
      messageApi.success('收款相关信息更新成功')
      refetchPayment()
      // 微刷新
      if (selectedActivity) {
        refreshSingleActivity(selectedActivity.activity_id);
      }
    },
    onError: (error: any) => {
      messageApi.error(error?.response?.data?.detail || '更新失败')
    },
  })

  // 作业状态控制 Mutations
  const completeActivityMutation = useMutation({
    mutationFn: ({ activityId, remarks, patchTo100 }: { activityId: string; remarks?: string; patchTo100?: boolean }) =>
      activityService.completeActivity(activityId, remarks, patchTo100),
    onSuccess: (data) => {
      messageApi.success(`作业已确认完成，实际完成日期: ${data.actual_finish_date}`)
      
      // 关键：微刷新甘特图
      if (selectedActivity) {
        refreshSingleActivity(selectedActivity.activity_id);
      }
      
      // 刷新列表和详情数据
      queryClient.invalidateQueries({ queryKey: ['activities'] })
      // 还需要刷新汇总信息，因为补齐逻辑可能改变了累计完成量
      queryClient.invalidateQueries({ queryKey: ['vfactdb-statistics', selectedActivity?.activity_id] })
    },
    onError: (error: any) => {
      messageApi.error(`确认完成失败: ${error.response?.data?.detail || error.message}`)
    }
  })

  const reopenActivityMutation = useMutation({
    mutationFn: (activityId: string) => activityService.reopenActivity(activityId),
    onSuccess: (data) => {
      messageApi.success(`作业已重新打开，当前状态: ${data.status}`)
      
      // 关键：微刷新甘特图
      if (selectedActivity) {
        refreshSingleActivity(selectedActivity.activity_id);
      }
      
      // 刷新列表和详情数据
      queryClient.invalidateQueries({ queryKey: ['activities'] })
    },
    onError: (error: any) => {
      messageApi.error(`重新打开失败: ${error.response?.data?.detail || error.message}`)
    }
  })

  // 处理确认完成点击
  const handleCompleteActivity = () => {
    if (!selectedActivity) return;
    
    // 完工比例计算（使用原始数据，避免浮点数精度干扰展示）
    const totalAchieved = summaryInfo.totalAchieved || 0;
    const estimatedTotal = Number(selectedActivity.key_qty || 0);
    const completionRatio = estimatedTotal > 0 ? (totalAchieved / estimatedTotal) : 1;
    
    const executeComplete = (patchTo100: boolean = false, remarks?: string) => {
      completeActivityMutation.mutate({ activityId: selectedActivity.activity_id, remarks, patchTo100 });
    };

    if (estimatedTotal > 0) {
      if (completionRatio < 0.995) {
        Modal.error({
          title: '无法关闭作业',
          content: (
            <div>
              <p>该作业的当前完工比例为 <b>{(completionRatio * 100).toFixed(2)}%</b>，未达到 <b>99.5%</b> 的关闭阈值。</p>
              <p style={{ color: '#ff4d4f' }}>由于量差过大，为了保证数据严谨性，请继续填报剩余工程量，或者修正“预估总量”。</p>
            </div>
          ),
          okText: '知道了',
        });
      } else if (completionRatio < 1.0) {
        const modal = Modal.confirm({
          title: '作业接近完成',
          icon: <CheckCircleOutlined style={{ color: '#1890ff' }} />,
          content: (
            <div>
              <p>当前完工比例为 <b>{(completionRatio * 100).toFixed(2)}%</b>。</p>
              <p>您可以选择补齐量差至 100% 再关闭，或者直接按当前进度关闭：</p>
              <p style={{ color: '#8c8c8c', fontSize: '12px' }}>剩余量差: <b>{(estimatedTotal - totalAchieved).toFixed(3)}</b></p>
            </div>
          ),
          footer: (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <Button onClick={() => modal.destroy()}>取消</Button>
              <Button 
                onClick={() => {
                  modal.destroy();
                  executeComplete(false);
                }}
              >
                仅确认关闭 (保持当前量)
              </Button>
              <Button 
                type="primary"
                onClick={() => {
                  modal.destroy();
                  executeComplete(true);
                }}
              >
                补齐 100% 并关闭
              </Button>
            </div>
          )
        });
      } else {
        // 完成率 >= 100% (包括爆量情况)
        Modal.confirm({
          title: '确认作业完成',
          content: (
            <div>
              <p>当前完工比例已达到 <b>{(completionRatio * 100).toFixed(2)}%</b>。</p>
              <p>确认后作业将被锁定，禁止进一步填报数据。</p>
            </div>
          ),
          okText: '确认完成',
          cancelText: '取消',
          onOk: () => executeComplete(false),
        });
      }
    } else {
      // 预估总量为 0 的情况
      if (totalAchieved > 0) {
        Modal.confirm({
          title: '确认作业完成',
          content: (
            <div>
              <p>该作业的预估总量为 <b>0</b>，但已有实际完成量 <b>{totalAchieved.toFixed(3)}</b>。</p>
              <p>是否确认按当前进度关闭并锁定该作业？</p>
            </div>
          ),
          okText: '确认完成',
          cancelText: '取消',
          onOk: () => executeComplete(false),
        });
      } else {
        // 纯人力作业
        Modal.confirm({
          title: '确认作业完成',
          content: '该作业为纯人力作业（无预估总量且无完成量）。确认后将锁定作业。',
          okText: '确认完成',
          cancelText: '取消',
          onOk: () => executeComplete(false),
        });
      }
    }
  };

  const handleReopenActivity = () => {
    if (!selectedActivity) return;
    Modal.confirm({
      title: '重新打开作业',
      content: '确定要重新打开该作业吗？重新打开后将解除锁定，允许继续填报数据。',
      okText: '确定',
      cancelText: '取消',
      onOk: () => reopenActivityMutation.mutate(selectedActivity.activity_id),
    });
  };

  // 当VFACTDB数据变化时，自动更新VolumeControl的完成量
  useEffect(() => {
    if (volumeControlData && calculatedCompleted !== undefined && 
        Math.abs((calculatedCompleted || 0) - (volumeControlData.construction_completed || 0)) > 0.01) {
      // 如果完成量有变化，提示用户可以更新
      // 实际更新需要用户手动触发或通过后端自动同步
    }
  }, [calculatedCompleted, volumeControlData])

  // 应用用户偏好设置
  useEffect(() => {
    // 如果已经加载了视图，就不应用用户偏好设置
    if (hasLastViewRef.current) {
      return
    }
    if (columnPreferences && Array.isArray(columnPreferences)) {
      setVisibleColumns(columnPreferences)
    }
  }, [columnPreferences])

  // 检查是否有最后使用的视图，如果有，就不应用用户偏好设置
  const hasLastViewRef = useRef(false)
  
  useEffect(() => {
    // 如果已经加载了视图，就不应用用户偏好设置
    if (hasLastViewRef.current) {
      return
    }
    if (groupingPreferences && Array.isArray(groupingPreferences)) {
      setGroupBy(groupingPreferences)
    }
  }, [groupingPreferences])

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
  
  // 处理列配置变化（列宽调整）
  const handleColumnsChange = useCallback((columns: GanttColumn[]) => {
    setGanttColumns(columns)
  }, [])
  
  // 保存视图到localStorage
  const saveView = useCallback((viewName: string) => {
    const LEGACY_VIEWS_KEY = 'gantt-views'
    const VIEWS_KEY = 'activities-advanced-views'

    const parseViews = (key: string): any[] => {
      try {
        const raw = localStorage.getItem(key)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
      } catch (e) {
        logger.warn(`[ActivityListAdvanced] Failed to parse views from ${key}`, e)
        return []
      }
    }

    const getViews = (): any[] => {
      const current = parseViews(VIEWS_KEY)
      if (current.length > 0) return current

      const legacy = parseViews(LEGACY_VIEWS_KEY)
      // 兼容：只迁移“看起来属于 activities-advanced”的旧视图，避免被其他页面写入的结构污染
      const filtered = legacy.filter((v: any) => {
        if (!v || typeof v !== 'object') return false
        if (v.scope === 'activities-advanced') return true
        return (
          Array.isArray(v.visibleColumns) &&
          typeof v.gridWidth === 'number' &&
          v.timescaleConfig &&
          typeof v.timescaleConfig === 'object'
        )
      })
      if (filtered.length > 0) {
        try {
          localStorage.setItem(VIEWS_KEY, JSON.stringify(filtered))
        } catch (e) {
          logger.warn('[ActivityListAdvanced] Failed to migrate legacy views', e)
        }
      }
      return filtered
    }

    // 收集所有可见列的宽度
    const columnWidths = ganttColumns.reduce((acc, col) => {
      acc[col.key] = col.width
      return acc
    }, {} as Record<string, number>)
    
    logger.log('Saving view with column widths:', columnWidths)
    logger.log('Current ganttColumns:', ganttColumns.map(c => ({ key: c.key, width: c.width })))
    
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
      columnWidths, // 保存每个栏位的宽度
      gridWidth, // 保存分隔条位置（左侧表格总宽度）
      timescaleConfig,
      expandedGroups: expandedGroupsObj, // 保存折叠/展开状态
      expandToLevel, // 保存展开到第N层
      scope: 'activities-advanced',
      version: 1,
    }
    
    const views = getViews()
    views.push(view)
    localStorage.setItem(VIEWS_KEY, JSON.stringify(views))
    setSavedViews(views)
    
    // 注意：保存视图时不自动设置为最后使用的视图
    // 只有用户通过"加载"按钮选择视图时，才会更新 LAST_VIEW_ID_KEY
    // 这样刷新页面时会加载用户选择的视图，而不是最后保存的视图
    
    messageApi.success('视图已保存（包含栏位宽度）')
  }, [groupBy, visibleColumns, ganttColumns, gridWidth, timescaleConfig, expandedGroups, expandToLevel, messageApi])
  
  // 加载视图
  const loadView = useCallback((view: typeof savedViews[0], silent: boolean = false) => {
    const LAST_VIEW_ID_KEY = 'activities-advanced-last-view-id'
    const LEGACY_LAST_VIEW_ID_KEY = 'gantt-last-view-id'

    // 标记已加载视图，防止用户偏好设置覆盖视图设置
    hasLastViewRef.current = true

    setGroupBy(view.groupBy)
    setVisibleColumns(view.visibleColumns)
    if (typeof view.gridWidth === 'number') {
      setGridWidth(view.gridWidth)
    }
    // 关键：视图来源可能被其他页面污染，避免 timescaleConfig 被写成 undefined 导致白屏
    if (view.timescaleConfig && typeof view.timescaleConfig === 'object') {
      setTimescaleConfig(view.timescaleConfig)
    }
    
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
    
    // 恢复列宽：使用保存的列宽，如果不存在则使用默认宽度
    const updatedColumns = (Array.isArray(view.visibleColumns) ? view.visibleColumns : []).map(colKey => {
      const colDef = AVAILABLE_COLUMNS.find(c => c.key === colKey)
      const savedWidth = view.columnWidths?.[colKey] // 使用可选链，避免undefined错误
      const finalWidth = savedWidth && savedWidth > 0 ? savedWidth : (colDef?.width || 120)
      
      logger.log(`Loading column ${colKey}: savedWidth=${savedWidth}, finalWidth=${finalWidth}`)
      
      return {
        key: colKey,
        title: colDef?.title || colKey,
        width: finalWidth,
        align: colDef?.align,
        fixed: colDef?.fixed,
        resizable: true,
        render: renderGanttCell(colKey)
      }
    })
    
    logger.log('Loading view columns:', updatedColumns.map(c => ({ key: c.key, width: c.width })))
    setGanttColumns(updatedColumns)
    
    // 保存为最后使用的视图
    localStorage.setItem(LAST_VIEW_ID_KEY, view.id)
    localStorage.setItem(LEGACY_LAST_VIEW_ID_KEY, view.id)
    
    if (!silent) {
      messageApi.success(`已加载视图: ${view.name}`)
    }
  }, [messageApi])
  
  // 删除视图
  const deleteView = useCallback((viewId: string) => {
    const LEGACY_VIEWS_KEY = 'gantt-views'
    const VIEWS_KEY = 'activities-advanced-views'

    let views: any[] = []
    try {
      const parsed = JSON.parse(localStorage.getItem(VIEWS_KEY) || '[]')
      views = Array.isArray(parsed) ? parsed : []
    } catch {
      views = []
    }
    // 如果新 key 为空，则兼容读一次旧 key（不回写，避免把其他页面的数据再写回来）
    if (views.length === 0) {
      try {
        const parsedLegacy = JSON.parse(localStorage.getItem(LEGACY_VIEWS_KEY) || '[]')
        views = Array.isArray(parsedLegacy) ? parsedLegacy : []
      } catch {
        views = []
      }
    }
    const filtered = views.filter((v: any) => v.id !== viewId)
    localStorage.setItem(VIEWS_KEY, JSON.stringify(filtered))
    setSavedViews(filtered)
    messageApi.success('视图已删除')
  }, [messageApi])
  
  // 加载保存的视图列表，并自动加载最后一次使用的视图
  useEffect(() => {
    const LEGACY_VIEWS_KEY = 'gantt-views'
    const LEGACY_LAST_VIEW_ID_KEY = 'gantt-last-view-id'
    const VIEWS_KEY = 'activities-advanced-views'
    const LAST_VIEW_ID_KEY = 'activities-advanced-last-view-id'

    const parseViews = (key: string): any[] => {
      try {
        const raw = localStorage.getItem(key)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
      } catch (e) {
        logger.warn(`[ActivityListAdvanced] Failed to parse views from ${key}`, e)
        return []
      }
    }

    const viewsFromNew = parseViews(VIEWS_KEY)
    const viewsFromLegacy = viewsFromNew.length > 0 ? [] : parseViews(LEGACY_VIEWS_KEY)
    const views = (viewsFromNew.length > 0 ? viewsFromNew : viewsFromLegacy).filter((v: any) => {
      if (!v || typeof v !== 'object') return false
      if (v.scope === 'activities-advanced') return true
      return (
        Array.isArray(v.visibleColumns) &&
        typeof v.gridWidth === 'number' &&
        v.timescaleConfig &&
        typeof v.timescaleConfig === 'object'
      )
    })

    // 如果来源于 legacy 且过滤后仍有数据，则迁移到新 key（避免以后再被其他页面污染）
    if (viewsFromNew.length === 0 && views.length > 0) {
      try {
        localStorage.setItem(VIEWS_KEY, JSON.stringify(views))
      } catch (e) {
        logger.warn('[ActivityListAdvanced] Failed to migrate legacy views', e)
      }
    }
    setSavedViews(views)
    
    // 自动加载最后一次使用的视图（仅在用户没有调整过分组/栏位时）
    // 如果用户调整了分组/栏位，LAST_VIEW_ID_KEY 会被清除，这里就不会加载视图
    const lastViewId = localStorage.getItem(LAST_VIEW_ID_KEY) || localStorage.getItem(LEGACY_LAST_VIEW_ID_KEY)
    if (lastViewId && views.length > 0) {
      const lastView = views.find((v: any) => v.id === lastViewId)
      if (lastView) {
        logger.log('Auto-loading last view:', lastView.name)
        // 标记已加载视图，防止用户偏好设置覆盖视图设置
        hasLastViewRef.current = true
        // 延迟加载，确保组件已完全初始化
        setTimeout(() => {
          // 直接在这里实现加载逻辑，避免依赖问题
          setGroupBy(lastView.groupBy)
          setVisibleColumns(lastView.visibleColumns)
          if (typeof lastView.gridWidth === 'number') {
            setGridWidth(lastView.gridWidth)
          }
          // 防御：避免 lastView.timescaleConfig 不存在导致 timescaleConfig 变 undefined 进而白屏
          if (lastView.timescaleConfig && typeof lastView.timescaleConfig === 'object') {
            setTimescaleConfig(lastView.timescaleConfig)
          }
          
          // 恢复列宽
          const updatedColumns = (Array.isArray(lastView.visibleColumns) ? lastView.visibleColumns : []).map((colKey: string) => {
            const colDef = AVAILABLE_COLUMNS.find(c => c.key === colKey)
            const savedWidth = lastView.columnWidths?.[colKey]
            const finalWidth = savedWidth && savedWidth > 0 ? savedWidth : (colDef?.width || 120)
            
            return {
              key: colKey,
              title: colDef?.title || colKey,
              width: finalWidth,
              align: colDef?.align,
              fixed: colDef?.fixed,
              resizable: true,
              render: renderGanttCell(colKey)
            }
          })
          setGanttColumns(updatedColumns)
        }, 100)
      }
    }
  }, []) // 只在组件挂载时执行一次

  // 查询作业数据（不使用后端GROUP BY，改为前端分组）
  // 使用 filtersKey 和 effectivePagination 确保在筛选器变化时使用正确的分页参数
  // 注意：queryKey 使用 filtersKey（字符串）而不是 filters（对象），避免对象引用变化导致不必要的查询
  const { data, isLoading } = useQuery({
    queryKey: ['activities-advanced', filtersKey, effectivePagination.current, effectivePagination.pageSize],
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

  // 跟踪上一次的 filtersKey，用于判断筛选器是否变化
  // 关键：初始值应该是一个特殊值，确保首次切换筛选器时能正确检测到变化
  const prevFiltersKeyForDataRef = useRef<string | null>(null)
  
  // 当数据加载完成时，更新累积的数据
  useEffect(() => {
    logger.log('Data loaded:', { 
      hasData: !!data, 
      itemsLength: data?.items?.length, 
      total: data?.total, 
      currentPage: effectivePagination.current,
      pageSize: effectivePagination.pageSize,
      filtersKey,
      prevFiltersKey: prevFiltersKeyForDataRef.current,
      lastFiltersKeyForPagination: lastFiltersKeyForPaginationRef.current,
    })
    
    // 检查筛选器是否变化（首次加载时，prevFiltersKeyForDataRef.current 为 null，应该视为变化）
    const filtersChanged = prevFiltersKeyForDataRef.current === null || prevFiltersKeyForDataRef.current !== filtersKey
    
    if (data?.items) {
      // 场景 1: 筛选器变化或刷新计数器变化，且是第一页
      // 需要更新数据，但如果是刷新计数器变化，我们可能想要保留已经追加的后续页
      const isInitialLoad = effectivePagination.current === 1
      
      if (isInitialLoad || filtersChanged) {
        // 关键逻辑：如果是第一页，我们总是根据最新数据同步 loadedItems 的前半部分
        // 如果是筛选器变化，则完全替换
        if (filtersChanged) {
          logger.log('Setting loadedItems (filter changed):', data.items.length, 'items')
          setLoadedItems(data.items)
        } else {
          // 如果不是筛选器变化（通常是 invalidation 触发的数据刷新），
          // 我们需要合并更新第一页的数据，同时保留后续已经加载的页面数据
          logger.log('Merging loadedItems (page 1 data refreshed):', data.items.length, 'items')
          setLoadedItems((prev: Activity[]) => {
            if (prev.length === 0) return data.items;
            const newItemsMap = new Map<string, Activity>(data.items.map((item: Activity) => [item.activity_id, item]));
            return prev.map(item => newItemsMap.has(item.activity_id) ? newItemsMap.get(item.activity_id)! : item);
          })
        }
        
        const hasMoreData = (data.items.length === effectivePagination.pageSize) && (data.items.length < (data.total || 0))
        setHasMore(hasMoreData)
        // 更新 refs - 延迟更新，确保滚动位置已经重置
        if (filtersChanged) {
          // 延迟更新，避免滚动监听器在滚动位置重置之前就触发
          setTimeout(() => {
            prevFiltersKeyForDataRef.current = filtersKey
            lastFiltersKeyForPaginationRef.current = filtersKey
            logger.log('Updated prevFiltersKeyForDataRef after filter change, filtersKey:', filtersKey)
          }, 1000) // 延迟1秒，确保滚动位置已经重置
        }
      } else {
        // 后续页，追加到已有数据（避免重复）
        // 保存当前滚动位置（在更新前）
        const scrollContainer = verticalScrollRefForLoadMore.current
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
      if (filtersChanged) {
        // 延迟更新，避免滚动监听器在滚动位置重置之前就触发
        setTimeout(() => {
          prevFiltersKeyForDataRef.current = filtersKey
          lastFiltersKeyForPaginationRef.current = filtersKey
          logger.log('Updated prevFiltersKeyForDataRef after filter change (no items), filtersKey:', filtersKey)
        }, 1000) // 延迟1秒，确保滚动位置已经重置
      }
    }
  }, [data, effectivePagination.current, effectivePagination.pageSize, filtersKey])

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
    
    // 批量获取描述（限制并发，避免过多请求）
    if (descriptionsToFetch.size > 0) {
      // 获取所有需要查询的描述，不限制数量（因为已经去重了）
      const descriptionsArray = Array.from(descriptionsToFetch.entries())
      const fetchPromises = descriptionsArray.map(async ([cacheKey, { activityId, codeTypeName, codeValue }]) => {
        try {
          // 优先使用codeValue查询（更准确），activityId可以为空
          const result = await activityService.getActivityCodeDescription(activityId || '', codeTypeName, codeValue)
          if (result && result.description) {
            // 使用函数式更新，确保状态正确更新
            setActivityCodeDescriptions(prev => {
              const newMap = new Map(prev)
              newMap.set(cacheKey, result.description)
              return newMap
            })
          }
        } catch (error: any) {
          // 所有错误都静默处理，404已经在api.ts中处理了
        }
      })
      
      Promise.all(fetchPromises).catch(() => {
        // 静默处理错误
      })
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

    // 聚合分组下的数值字段
    const aggregateNumericFields = (node: TreeNode) => {
      const result = {
        key_qty: 0,
        completed: 0,
        calculated_mhrs: 0,
        actual_manhour: 0,
        weight_factor: 0,
        actual_weight_factor: 0,
      }
      
      // 收集该节点下所有的 activities（包括子节点的）
      const allActivities: Activity[] = []
      const collect = (n: TreeNode) => {
        allActivities.push(...n.activities)
        n.children.forEach(child => collect(child))
      }
      collect(node)
      
      allActivities.forEach(act => {
        result.key_qty += Number(act.key_qty || 0)
        result.completed += Number(act.completed || 0)
        result.calculated_mhrs += Number(act.calculated_mhrs || 0)
        result.actual_manhour += Number(act.actual_manhour || 0)
        result.weight_factor += Number(act.weight_factor || 0)
        result.actual_weight_factor += Number(act.actual_weight_factor || 0)
      })
      
      return result
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
        
        // 聚合数值
        const aggregates = aggregateNumericFields(node)
        
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
          ...aggregates, // 添加聚合后的数值字段
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

  // 构建甘特图列配置
  const ganttColumnsMemo = useMemo<GanttColumn[]>(() => {
    return visibleColumns.map(colKey => {
      const colDef = AVAILABLE_COLUMNS.find(c => c.key === colKey)
      if (!colDef) {
        return {
          key: colKey,
          title: colKey,
          width: 120,
          resizable: true,
          render: renderGanttCell(colKey)
        }
      }
      return {
        key: colDef.key,
        title: colDef.title,
        width: colDef.width,
        align: colDef.align,
        fixed: colDef.fixed,
        resizable: true,
        render: renderGanttCell(colDef.key)
      }
    })
  }, [visibleColumns])
  
  // 初始化ganttColumns状态 - 只在visibleColumns变化时更新，保留用户调整的列宽
  const visibleColumnsKey = useMemo(() => [...visibleColumns].sort().join(','), [visibleColumns])
  const prevVisibleColumnsKeyRef = useRef<string>('')
  
  useEffect(() => {
    // 始终确保 render 函数是最新的
    const hasMissingRender = ganttColumns.some(c => !c.render && (c.key === 'status' || c.key === 'completed'))
    
    if (hasMissingRender) {
      const updatedWithRender = ganttColumns.map(col => ({
        ...col,
        render: renderGanttCell(col.key)
      }))
      setGanttColumns(updatedWithRender)
      return // 等待下一次运行
    }
    
    // 如果列集合发生了变化
    if (visibleColumnsKey !== prevVisibleColumnsKeyRef.current) {
      const currentKeys = ganttColumns.map(c => c.key).sort().join(',')
      const memoKeys = ganttColumnsMemo.map(c => c.key).sort().join(',')
      
      if (currentKeys !== memoKeys) {
        const widthMap = new Map(ganttColumns.map(c => [c.key, c.width]))
        const updated = ganttColumnsMemo.map(col => ({
          ...col,
          width: widthMap.get(col.key) || col.width,
        }))
        setGanttColumns(updated)
      }
      prevVisibleColumnsKeyRef.current = visibleColumnsKey
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleColumnsKey, ganttColumns])
  
  // 构建甘特图任务数据 - 按照P6的层级模式：层级分组，每个层级都有汇总条
  const ganttTasks = useMemo<GanttTask[]>(() => {
    if (!loadedItems.length) {
      logger.log('ganttTasks: loadedItems is empty', loadedItems)
      return []
    }
    
    if (!groupedData.items.length) {
      logger.log('ganttTasks: groupedData.items is empty', groupedData)
      return []
    }
    
    logger.log('ganttTasks: building from', groupedData.items.length, 'groupedData.items, groupBy:', groupBy)
    
    const tasks: GanttTask[] = []
    const groupTaskMap = new Map<string, GanttTask>() // 存储分组任务，key为完整的groupPath（确保唯一性）

    // 日期兜底：
    // - 开始日期：如果是 In Progress/Completed，优先用 actual_start_date
    const getActivityStart = (activity: Activity): Dayjs | null => {
      const systemStatus = activity.system_status || (activity.actual_finish_date ? 'Completed' : (activity.actual_start_date ? 'In Progress' : 'Not Started'))
      const raw = (systemStatus !== 'Not Started' && activity.actual_start_date) 
        || activity.start_date 
        || activity.baseline1_start_date 
        || activity.planned_start_date 
        || (activity as any).planned_start
      return raw ? dayjs(raw) : null
    }
    // - 结束日期：如果是 Completed，优先用 actual_finish_date
    const getActivityEnd = (activity: Activity): Dayjs | null => {
      const systemStatus = activity.system_status || (activity.actual_finish_date ? 'Completed' : (activity.actual_start_date ? 'In Progress' : 'Not Started'))
      const raw = (systemStatus === 'Completed' && activity.actual_finish_date)
        || activity.finish_date 
        || activity.baseline1_finish_date 
        || activity.planned_finish_date 
        || (activity as any).planned_finish
      return raw ? dayjs(raw) : null
    }
    
    // 预先建立活动索引：按分组路径索引活动，避免重复遍历
    // key: 分组路径（如 "level0_value0|level1_value1"），value: Activity[]
    const activitiesByGroupPath = new Map<string, Activity[]>()
    
    // 只遍历一次所有活动，建立索引
      loadedItems.forEach((item: any) => {
        if (item.isGroupHeader) return
        
        const activity = item as Activity
        // 构建activity的完整分组路径
        const activityGroupPath = groupBy.map(field => {
          const value = (activity as any)[field]
          return value || '(空)'
        })
        
      // 为每个层级建立索引（从 level 0 到当前层级）
      for (let level = 0; level < groupBy.length; level++) {
        const pathKey = activityGroupPath.slice(0, level + 1).join('|')
        if (!activitiesByGroupPath.has(pathKey)) {
          activitiesByGroupPath.set(pathKey, [])
        }
        activitiesByGroupPath.get(pathKey)!.push(activity)
          }
    })
    
    // 收集每个分组下的所有activities（使用预建立的索引）
    const collectGroupActivities = (groupValues: string[]): Activity[] => {
      const pathKey = groupValues.join('|')
      return activitiesByGroupPath.get(pathKey) || []
    }
    
    // 按照 groupedData.items 的顺序构建任务列表
    groupedData.items.forEach((item: any, index: number) => {
      // 检查是否是分组标题（有isGroupHeader属性）
      if (item.isGroupHeader) {
        // 这是分组标题行
        const groupDisplayText = item.groupKey // 包含code+描述的显示文本
        const groupValue = item.groupValue || item.groupKey.split(' - ')[0] // 原始值（code部分）
        const level = item.level || 0
        // 使用原始ID（不带group_前缀），以便与groupedData中的ID匹配
        // const groupId = String(item.id) // 未使用，已移除
        
        // 收集该分组下的所有activities（包括子分组下的）
        // 使用分组路径进行匹配
        const groupActivities = collectGroupActivities(item.groupValues || [groupValue])
        
        // 计算该分组下所有任务的时间范围（用于汇总条）
        let groupStartDate: Dayjs | null = null
        let groupEndDate: Dayjs | null = null
        
        if (groupActivities.length > 0) {
          groupActivities.forEach((activity: Activity) => {
            const start = getActivityStart(activity)
            if (start) {
              if (!groupStartDate || start.isBefore(groupStartDate)) {
                groupStartDate = start
              }
            }
            const end = getActivityEnd(activity)
            if (end) {
              if (!groupEndDate || end.isAfter(groupEndDate)) {
                groupEndDate = end
              }
            }
          })
        }
        
        // 查找父分组（如果存在）
        let parentId: string | undefined = undefined
        if (level > 0 && item.groupValues && item.groupValues.length > 1) {
          // 构建父分组的路径（去掉最后一个元素）
          const parentGroupPath = item.groupValues.slice(0, -1).join('|')
          const parentTask = groupTaskMap.get(parentGroupPath)
          if (parentTask) {
            parentId = typeof parentTask.id === 'string' ? parentTask.id : String(parentTask.id)
          }
        }
        
        // 检查分组是否展开
        const isExpanded = item.isExpanded !== false
        
        // 直接使用 item.id 作为 task.id，因为 item.id 已经是 __group__xxx 格式
        // GanttChart 中会识别 type === 'project' 的任务为分组
        const ganttTaskId = item.id
        
        const groupTask: GanttTask = {
          id: ganttTaskId,
          text: groupDisplayText, // 使用包含code+描述的显示文本
          start_date: groupStartDate,
          end_date: groupEndDate,
          type: 'project',
          parent: parentId,
          open: isExpanded, // 使用分组的展开状态
          // 将聚合后的数值字段也存入 task，以便在 grid 中显示
          ...item,
        }
        tasks.push(groupTask)
        // 使用完整的groupPath作为key，确保唯一性（不同层级可以有相同的groupValue）
        const groupPathKey = item.groupValues ? item.groupValues.join('|') : `${item.level}_${groupValue}`
        groupTaskMap.set(groupPathKey, groupTask)
      } else {
        // 这是普通任务
        const activity = item as Activity
        const activityGroupKey = groupBy.map(field => {
          const value = (activity as any)[field]
          return value || '(空)'
        }).join(' | ')
        
        // 查找最直接的父分组（最后一个匹配的分组）
        let parentId: string | undefined = undefined
        const activityKeyParts = activityGroupKey.split(' | ')
        
        // 从最深层级开始查找父分组
        for (let level = groupBy.length - 1; level >= 0; level--) {
          // 构建当前层级的完整路径（从level 0到当前level）
          const parentGroupPath = activityKeyParts.slice(0, level + 1).join('|')
          const parentTask = groupTaskMap.get(parentGroupPath)
          if (parentTask) {
            // 验证这个分组确实是当前层级的
            const parentTaskIdStr = typeof parentTask.id === 'string' ? parentTask.id : String(parentTask.id)
            // parentTask.id 已经是 __group__xxx 格式，直接使用
            const parentItem = groupedData.items.find((it: any) => 
              it.isGroupHeader && it.id === parentTaskIdStr
            )
            if (parentItem && parentItem.level === level) {
              parentId = parentTaskIdStr
              break
            }
          }
        }
        
        // 判断是否为里程碑：P6中里程碑的type通常是'Milestone'或包含'Milestone'
        const isMilestone = activity.type && (
          activity.type.toLowerCase() === 'milestone' || 
          activity.type.toLowerCase().includes('milestone')
        )
        
        const task: GanttTask = {
          id: activity.id || `task_${index}`,
          text: activity.activity_id || '',
          start_date: getActivityStart(activity),
          end_date: getActivityEnd(activity),
          duration: activity.planned_duration || 1,
          progress: activity.completed ? (activity.completed / 100) : 0,
          type: isMilestone ? 'milestone' : 'task',
          parent: parentId,
          activity: activity,
        }
        tasks.push(task)
      }
    })
    
    // 移除详细日志以减少性能开销
    // 如需调试，可以取消注释下面的日志
    // if (tasks.length > 0) {
    //   logger.log('ganttTasks built:', tasks.length, 'tasks')
    // }
    return tasks
  }, [loadedItems, groupBy, groupedData])
  
  // 构建分组子项数量Map（用于显示在分组标题中）
  const groupItemCountsMap = useMemo(() => {
    const countsMap = new Map<string, number>()
    groupedData.items.forEach((item: any) => {
      if (item.isGroupHeader && item.itemCount !== undefined) {
        // 使用完整的ID（包括__group__前缀）作为key
        countsMap.set(String(item.id), item.itemCount)
      }
    })
    return countsMap
  }, [groupedData])
  
  // 处理任务点击
  const handleTaskClick = (task: GanttTask) => {
    if (task.activity) {
      setSelectedActivity(task.activity)
      setShowDetailPanel(true)
    }
  }
  
  // 处理任务双击
  const handleTaskDblClick = (task: GanttTask) => {
    if (task.activity) {
      setSelectedActivity(task.activity)
      setShowDetailPanel(true)
    }
  }
  
  // 处理分组折叠/展开
  const handleGroupToggle = useCallback((groupId: string, currentExpanded: boolean) => {
    // 保存当前滚动位置
    const scrollContainer = verticalScrollRefForLoadMore.current
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
            // 检查是否是子分组（通过ID路径判断）
            const itemId = String(item.id)
            if (itemId.startsWith(normalizedGroupId) && itemId !== normalizedGroupId) {
              // 是子分组，也设置为折叠
              newMap.set(itemId, false)
            }
          }
        })
      } else {
        // 展开时：只展开当前分组本身，不自动展开子分组
        // 子分组保持它们之前的状态（如果之前没有状态，则保持默认展开）
        // 不在这里设置子分组的状态，让它们保持原样
      }
      
      // 检查是否全部折叠：如果所有分组都是false，则标记为全部折叠
      const allCollapsed = Array.from(newMap.values()).every(v => v === false) && newMap.size > 0
      setIsAllCollapsed(allCollapsed)
      // 注意：不在这里清除拒绝标志，只有用户明确点击"全部展开"时才清除
      // 这样可以避免用户展开单个分组时自动加载更多数据
      
      return newMap
    })
    // 不清除expandToLevel，保持"展开到第N层"的设置
    // 用户手动展开/折叠分组时，只更新该分组的状态，不影响其他分组
    // setExpandToLevel(null) // 移除：不清除展开到第N层的设置
    
    // 在下一帧恢复滚动位置（等待DOM更新）
    setTimeout(() => {
      if (scrollContainer) {
        scrollContainer.scrollTop = savedScrollTop
      }
    }, 0)
  }, [groupedData])
  
  // 全部展开
  const handleExpandAll = useCallback(() => {
    // 保存当前滚动位置
    const scrollContainer = verticalScrollRefForLoadMore.current
    const savedScrollTop = scrollContainer?.scrollTop || 0
    
    setExpandedGroups(new Map())
    setExpandToLevel(null)
    setIsAllCollapsed(false) // 全部展开时，取消全部折叠标记
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
    const scrollContainer = verticalScrollRefForLoadMore.current
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
    setIsAllCollapsed(true) // 标记为全部折叠
    
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
    const scrollContainer = verticalScrollRefForLoadMore.current
    const savedScrollTop = scrollContainer?.scrollTop || 0
    
    setExpandToLevel(level)
    // 清除所有手动设置的展开状态，让expandToLevel生效
    setExpandedGroups(new Map())
    // 如果展开到第0层或更高，则不是全部折叠
    setIsAllCollapsed(level === 0)
    
    // 在下一帧恢复滚动位置
    setTimeout(() => {
      if (scrollContainer) {
        scrollContainer.scrollTop = savedScrollTop
      }
    }, 0)
  }, [])

  // buildColumns不再使用，因为使用集成视图（已注释掉，保留以备将来使用）

  // 处理栏位配置
  const handleColumnSettings = () => {
    setColumnSettingsVisible(true)
  }

  const handleColumnSettingsOk = () => {
    saveColumnPreferencesMutation.mutate(visibleColumns)
    // 用户调整栏位后，清除视图标记，这样刷新后会应用最后调整的栏位，而不是视图
    hasLastViewRef.current = false
    localStorage.removeItem('activities-advanced-last-view-id')
    localStorage.removeItem('gantt-last-view-id')
    setColumnSettingsVisible(false)
  }

  // 处理分组
  const handleGroupByChange = (values: string[]) => {
    setGroupBy(values)
    saveGroupingPreferencesMutation.mutate(values)
    // 用户调整分组后，清除视图标记，这样刷新后会应用最后调整的分组，而不是视图
    hasLastViewRef.current = false
    localStorage.removeItem('activities-advanced-last-view-id')
    localStorage.removeItem('gantt-last-view-id')
    // 注意：分组是在前端进行的，不需要重新查询数据，所以不清空 loadedItems
    // 只需要更新分组状态，前端会自动重新分组显示
  }

  // 处理作业详情 - 在甘特图事件中使用（暂时未使用，保留以备将来使用）
  // const handleViewDetail = (activity: Activity) => {
  //   setSelectedActivity(activity)
  //   setShowDetailPanel(true)
  // }

  // 滚动加载更多的ref（将在GanttChart中设置）
  const verticalScrollRefForLoadMore = useRef<HTMLDivElement | null>(null)
  const isLoadingMoreRef = useRef(false) // 防止重复加载
  const isConfirmModalOpenRef = useRef(false) // 防止重复弹出确认对话框
  const savedScrollTopRef = useRef<number>(0) // 保存滚动位置
  const userRejectedLoadMoreRef = useRef(false) // 用户是否拒绝过加载更多（点击取消后设置）

  // 处理GanttChart传递的滚动容器ref（用于滚动加载更多）
  const handleScrollRefsReady = useCallback((gridScrollRef: React.RefObject<HTMLDivElement>, _timelineScrollRef: React.RefObject<HTMLDivElement>) => {
    // 实际上两个ref都指向同一个verticalScrollRef，使用第一个即可
    if (gridScrollRef.current) {
      logger.log('Scroll ref ready, setting verticalScrollRefForLoadMore', {
        element: gridScrollRef.current,
        scrollHeight: gridScrollRef.current.scrollHeight,
        clientHeight: gridScrollRef.current.clientHeight,
        scrollTop: gridScrollRef.current.scrollTop,
      })
      verticalScrollRefForLoadMore.current = gridScrollRef.current
      
      // 立即测试一次滚动监听
      setTimeout(() => {
        if (verticalScrollRefForLoadMore.current) {
          const testScroll = () => {
            const container = verticalScrollRefForLoadMore.current
            if (container) {
              const { scrollTop, scrollHeight, clientHeight } = container
              logger.log('Test scroll event:', {
                scrollTop,
                scrollHeight,
                clientHeight,
                distanceFromBottom: scrollHeight - scrollTop - clientHeight,
              })
            }
          }
          verticalScrollRefForLoadMore.current.addEventListener('scroll', testScroll, { passive: true })
          // 触发一次测试
          testScroll()
        }
      }, 500)
    } else {
      logger.log('Scroll ref not ready yet')
    }
  }, [])

  // 加载更多数据的函数
  const loadMoreData = useCallback(() => {
    if (isLoadingMoreRef.current || !hasMore || isLoading) {
      logger.log('Load more blocked:', {
        isLoadingMore: isLoadingMoreRef.current,
        hasMore,
        isLoading,
      })
      return
    }
    
    logger.log('Loading more data, current page:', pagination.current, '-> next page:', pagination.current + 1)
    isLoadingMoreRef.current = true
    setPagination(prev => ({
      current: prev.current + 1,
      pageSize: prev.pageSize,
    }))
  }, [hasMore, isLoading, pagination.current])

  // 监听滚动事件，当滚动到底部时加载更多
  useEffect(() => {
    const handleScroll = () => {
      const scrollContainer = verticalScrollRefForLoadMore.current
      if (!scrollContainer) {
        return
      }
      
      // 如果筛选器刚变化，不触发自动加载（等待数据稳定）
      // 关键：使用 prevFiltersKeyForDataRef 来判断，因为它会在数据加载完成后延迟更新
      // 如果 prevFiltersKeyForDataRef.current 为 null，说明是首次加载，也应该跳过
      const filtersJustChanged = prevFiltersKeyForDataRef.current === null || prevFiltersKeyForDataRef.current !== filtersKey
      if (filtersJustChanged) {
        logger.log('Filters just changed, skipping auto load more', {
          prevFiltersKey: prevFiltersKeyForDataRef.current,
          currentFiltersKey: filtersKey,
        })
        return
      }
      
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer
      // 当滚动到距离底部100px以内时，触发加载更多
      const threshold = 100
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight
      const isNearBottom = distanceFromBottom <= threshold
      
      // 只在接近底部时打印日志，避免日志过多
      if (isNearBottom || distanceFromBottom < 200) {
        logger.log('Scroll event (near bottom):', {
          scrollTop: Math.round(scrollTop),
          scrollHeight: Math.round(scrollHeight),
          clientHeight: Math.round(clientHeight),
          distanceFromBottom: Math.round(distanceFromBottom),
          isNearBottom,
          hasMore,
          isLoading,
          isLoadingMore: isLoadingMoreRef.current,
          currentPage: pagination.current,
          loadedItemsCount: loadedItems.length,
          filtersJustChanged,
        })
      }
      
      if (isNearBottom && hasMore && !isLoading && !isLoadingMoreRef.current && !isConfirmModalOpenRef.current) {
        // 如果用户之前拒绝过加载更多，不再自动加载（无论是否全部折叠）
        if (userRejectedLoadMoreRef.current) {
          return
        }
        
        // 如果全部折叠，需要用户确认是否加载更多
        if (isAllCollapsed) {
          // 设置标志，防止重复弹出确认对话框
          isConfirmModalOpenRef.current = true
          Modal.confirm({
            title: '确认加载更多数据',
            content: '当前所有分组已折叠，滚动高度已大幅减少。是否要继续加载更多作业数据？',
            okText: '加载',
            cancelText: '取消',
            onOk: () => {
              isConfirmModalOpenRef.current = false
              userRejectedLoadMoreRef.current = false // 用户确认加载，清除拒绝标志
              loadMoreData()
            },
            onCancel: () => {
              // 用户取消时，设置拒绝标志，不再弹出确认对话框
              isConfirmModalOpenRef.current = false
              userRejectedLoadMoreRef.current = true
            },
            afterClose: () => {
              // 对话框关闭后，确保清除标志（防止异常情况）
              isConfirmModalOpenRef.current = false
            },
          })
        } else {
          // 如果有分组展开且用户没有拒绝过，允许自动加载
          logger.log('✅ Scrolled near bottom, loading more data...', {
            currentPage: pagination.current,
            willLoadPage: pagination.current + 1,
          })
          loadMoreData()
        }
      }
    }

    const scrollContainer = verticalScrollRefForLoadMore.current
    if (scrollContainer) {
      logger.log('✅ Setting up scroll listener on container:', {
        element: scrollContainer,
        scrollHeight: scrollContainer.scrollHeight,
        clientHeight: scrollContainer.clientHeight,
        className: scrollContainer.className,
      })
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
      
      // 延迟检查，避免在筛选器变化时立即触发
      const timeoutId = setTimeout(() => {
        handleScroll()
      }, 500)
      
      return () => {
        clearTimeout(timeoutId)
        logger.log('Removing scroll listener')
        scrollContainer.removeEventListener('scroll', handleScroll)
      }
    } else {
      logger.log('⚠️ Scroll container not found, will retry when ref is ready')
    }
  }, [hasMore, isLoading, loadMoreData, pagination.current, loadedItems.length, filtersKey])

  // 当数据加载完成时，重置加载标志并恢复滚动位置
  useEffect(() => {
    if (!isLoading) {
      isLoadingMoreRef.current = false
      
      // 恢复滚动位置（在数据加载完成后，确保 DOM 已更新）
      if (savedScrollTopRef.current > 0 && pagination.current > 1) {
        // 使用双重 requestAnimationFrame 确保 DOM 已完全更新
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const scrollContainer = verticalScrollRefForLoadMore.current
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

  // 定期检查滚动位置（备用机制，防止滚动事件未触发）
  useEffect(() => {
    const checkScrollPosition = () => {
      const scrollContainer = verticalScrollRefForLoadMore.current
      if (!scrollContainer || isLoading || !hasMore || isLoadingMoreRef.current || isConfirmModalOpenRef.current) {
        return
      }
      
      // 如果筛选器刚变化，不触发自动加载（等待数据稳定）
      // 关键：使用 prevFiltersKeyForDataRef 来判断，因为它会在数据加载完成后延迟更新
      // 如果 prevFiltersKeyForDataRef.current 为 null，说明是首次加载，也应该跳过
      const filtersJustChanged = prevFiltersKeyForDataRef.current === null || prevFiltersKeyForDataRef.current !== filtersKey
      if (filtersJustChanged) {
        return
      }
      
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight
      const threshold = 100
      
      if (distanceFromBottom <= threshold) {
        // 如果用户之前拒绝过加载更多，不再自动加载（无论是否全部折叠）
        if (userRejectedLoadMoreRef.current) {
          return
        }
        
        // 如果全部折叠，需要用户确认是否加载更多
        if (isAllCollapsed) {
          // 设置标志，防止重复弹出确认对话框
          isConfirmModalOpenRef.current = true
          Modal.confirm({
            title: '确认加载更多数据',
            content: '当前所有分组已折叠，滚动高度已大幅减少。是否要继续加载更多作业数据？',
            okText: '加载',
            cancelText: '取消',
            onOk: () => {
              isConfirmModalOpenRef.current = false
              userRejectedLoadMoreRef.current = false // 用户确认加载，清除拒绝标志
              loadMoreData()
            },
            onCancel: () => {
              // 用户取消时，设置拒绝标志，不再弹出确认对话框
              isConfirmModalOpenRef.current = false
              userRejectedLoadMoreRef.current = true
            },
            afterClose: () => {
              // 对话框关闭后，确保清除标志（防止异常情况）
              isConfirmModalOpenRef.current = false
            },
          })
        } else {
          // 如果有分组展开且用户没有拒绝过，允许自动加载
          logger.log('🔄 Periodic check: Near bottom, triggering load more', {
            distanceFromBottom: Math.round(distanceFromBottom),
            scrollTop: Math.round(scrollTop),
            scrollHeight: Math.round(scrollHeight),
            clientHeight: Math.round(clientHeight),
          })
          loadMoreData()
        }
      }
    }
    
    // 每500ms检查一次滚动位置
    const interval = setInterval(checkScrollPosition, 500)
    return () => clearInterval(interval)
  }, [hasMore, isLoading, loadMoreData, isAllCollapsed, filtersKey])
  
  // 时间刻度表单
  const [timescaleForm] = Form.useForm()

  // 辅助函数：从 AVAILABLE_COLUMNS 获取翻译好的列名
  const getColTitle = useCallback((key: string, fallback: string) => {
    const col = AVAILABLE_COLUMNS.find(c => c.key === key)
    return col ? col.title : fallback
  }, [])

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
        title="遗留总排程 / Activities"
        description="该页面沿用工程建设计划管理的 Activity、WBS、分组甘特、工程量与日报联动逻辑，适合历史工程项目排程查询。"
        note="机械制造项目更适合按制造订单、工单、工艺路线、设备产能与工位执行来组织计划，而不是继续以 EPC Activity 体系承载主业务。"
        actions={[
          { label: '进入制造订单', path: '/manufacturing/orders', type: 'primary' },
          { label: '查看工艺模板', path: '/process-template-config' },
        ]}
      />

      <style>{`
        /* Engineering Status 简约风格 */
        .engineering-status-table .ant-table { background: transparent !important; }
        .engineering-status-table .ant-table-thead > tr > th { 
          background: #ffffff !important;
          padding: 6px 4px !important; 
          height: 28px !important;
          font-size: 11px !important;
          border-bottom: 1px solid #e2e8f0 !important;
          border-radius: 0 !important;
          color: #64748b !important;
          font-weight: 600 !important;
        }
        .engineering-status-table .ant-table-tbody > tr > td { 
          padding: 6px 4px !important; 
          border-bottom: 1px solid #f1f5f9 !important;
          font-size: 11px !important;
          vertical-align: top !important;
        }
        .engineering-status-table .ant-table-container { border-radius: 0 !important; }
        
        .engineering-status-container {
          border: 1px solid #e2e8f0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          background: #ffffff !important;
        }

        .engineering-status-tooltip {
          border-radius: 0 !important;
          border: 1px solid #e2e8f0 !important;
          box-shadow: none !important;
        }

        .minimal-descriptions .ant-descriptions-item-label {
          width: 110px;
          font-weight: 500 !important;
          font-size: 10px !important;
          padding: 4px 8px !important;
          background: transparent !important;
          color: #64748b !important;
          vertical-align: top !important;
          border-inline-end: 1px solid #f1f5f9 !important;
        }
        .minimal-descriptions .ant-descriptions-item-content {
          font-size: 10px !important;
          padding: 4px 8px !important;
          vertical-align: top !important;
          border-inline-end: 1px solid #f1f5f9 !important;
          color: #334155 !important;
        }
        .minimal-descriptions .ant-descriptions-item-content:last-child {
          border-inline-end: none !important;
        }
        .minimal-descriptions .ant-descriptions-view {
          border-radius: 0 !important;
          border: none !important;
        }
        .minimal-descriptions .ant-descriptions-row > th,
        .minimal-descriptions .ant-descriptions-row > td {
          border-bottom: 1px solid #f1f5f9 !important;
          padding: 4px 8px !important;
          border-inline-end: none !important;
        }
        .minimal-descriptions .ant-descriptions-row:last-child > th,
        .minimal-descriptions .ant-descriptions-row:last-child > td {
          border-bottom: none !important;
        }

        /* 简约滚动条 */
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
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
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#333' }}>Activities</h2>
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
            <Button
              icon={<CalendarOutlined />}
              onClick={() => setTimescaleModalVisible(true)}
              size="small"
            >
              时间刻度
            </Button>
            <Space size="small" style={{ marginLeft: 6 }}>
              <Button
                size="small"
                onClick={() => {
                  const newZoom = Math.max(0.01, ganttZoom - 0.05)
                  setGanttZoom(newZoom)
                  setTimescaleConfig({ ...timescaleConfig, zoomLevel: newZoom })
                }}
              >
                -
              </Button>
              <span style={{ fontSize: '11px', minWidth: '46px', textAlign: 'center', display: 'inline-block' }}>
                {Math.round(ganttZoom * 100)}%
              </span>
              <Button
                size="small"
                onClick={() => {
                  const newZoom = Math.min(5.0, ganttZoom + 0.05)
                  setGanttZoom(newZoom)
                  setTimescaleConfig({ ...timescaleConfig, zoomLevel: newZoom })
                }}
              >
                +
              </Button>
            </Space>
            <Button
              icon={showDetailPanel ? <CloseOutlined /> : <EyeOutlined />}
              onClick={() => setShowDetailPanel(!showDetailPanel)}
              type={showDetailPanel ? 'primary' : 'default'}
              size="small"
            >
              {showDetailPanel ? '隐藏详情' : '显示详情'}
            </Button>
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
                {groupBy.map((_, index) => (
                  <Select.Option key={index} value={index}>
                    展开到第{index + 1}层
                  </Select.Option>
                ))}
              </Select>
            )}
            <Button
              icon={<BgColorsOutlined />}
              onClick={() => setColorSettingsVisible(true)}
              size="small"
            >
              颜色设置
            </Button>
            <Button
              icon={<CheckCircleOutlined />}
              onClick={() => setBulkCloseModalVisible(true)}
              size="small"
              type="primary"
              ghost
              style={{ color: '#ffffff' }}
            >
              批量关闭
            </Button>
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

      {/* 主要内容区域：集成视图（表格+甘特图） */}
      <div style={{ 
        flex: 1, 
        overflow: 'hidden',
        minHeight: 0,
        background: '#ffffff',
        position: 'relative'
      }}>
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
          <>
            <GanttChart
            tasks={ganttTasks}
            columns={ganttColumns}
            gridWidth={gridWidth}
            onGridWidthChange={setGridWidth}
            timescaleConfig={timescaleConfig}
            rowHeight={22}
            density="compact"
            onTaskClick={handleTaskClick}
            onTaskDblClick={handleTaskDblClick}
            selectedTaskId={selectedActivity?.id || null}
            onZoomChange={(zoom) => {
              setGanttZoom(zoom)
              setTimescaleConfig({ ...timescaleConfig, zoomLevel: zoom })
            }}
            onColumnsChange={handleColumnsChange}
            onScrollRefsReady={handleScrollRefsReady}
            taskColors={taskColors}
            onGroupToggle={handleGroupToggle}
            groupItemCounts={groupItemCountsMap}
          />
            {/* 加载更多时的底部提示 */}
            {isLoading && pagination.current > 1 && (
              <div style={{
                position: 'absolute',
                bottom: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(0, 0, 0, 0.7)',
                color: '#fff',
                padding: '8px 16px',
                borderRadius: '4px',
                fontSize: '12px',
                zIndex: 1000,
              }}>
                正在加载更多数据...
              </div>
            )}
          </>
        )}
      </div>

      {/* 底部详情面板 */}
      {showDetailPanel && selectedActivity && (
        <>
          {/* 可拖动的分隔条 */}
          <div
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              // 记录初始鼠标位置和初始高度
              resizeRef.current.startY = e.clientY
              resizeRef.current.startHeight = detailPanelHeight
              setIsResizing(true)
            }}
            style={{
              height: '6px',
              background: 'linear-gradient(to bottom, #f0f0f0 0%, #e8e8e8 50%, #f0f0f0 100%)',
              cursor: 'ns-resize',
              position: 'relative',
              flexShrink: 0,
              userSelect: 'none',
              zIndex: 10,
              borderTop: '1px solid #d9d9d9',
              borderBottom: '1px solid #d9d9d9',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '60px',
                height: '3px',
                background: '#bfbfbf',
                borderRadius: '2px',
                pointerEvents: 'none',
              }}
            />
          </div>
        <div style={{
            height: `${detailPanelHeight}px`,
          background: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
            flexShrink: 0,
            overflow: 'hidden'
        }}>
          <div style={{
            padding: '6px 10px',
            borderBottom: '1px solid #e2e8f0',
            background: '#ffffff',
            flexShrink: 0
          }}>
            <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
              marginBottom: '4px'
          }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <InfoCircleOutlined style={{ fontSize: '12px', color: '#1890ff' }} />
                <span style={{ fontWeight: 500, fontSize: '12px', color: '#262626' }}>
                  {selectedActivity.activity_id}
                </span>
                <span style={{ fontSize: '11px', color: '#8c8c8c', marginLeft: '4px' }}>
                  {selectedActivity.title || ''}
                </span>
                {/* 状态标签 */}
                <span style={{ 
                  fontSize: '10px', 
                  padding: '2px 8px', 
                  borderRadius: '10px',
                  marginLeft: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: selectedActivity.status === 'Completed' ? '#f6ffed' : (selectedActivity.status === 'In Progress' ? '#e6f7ff' : '#f5f5f5'),
                  color: selectedActivity.status === 'Completed' ? '#52c41a' : (selectedActivity.status === 'In Progress' ? '#1890ff' : '#8c8c8c'),
                  border: `1px solid ${selectedActivity.status === 'Completed' ? '#b7eb8f' : (selectedActivity.status === 'In Progress' ? '#91d5ff' : '#d9d9d9')}`
                }}>
                  {(() => {
                    const roundedRectStyle: React.CSSProperties = {
                      width: '12px',
                      height: '8px',
                      borderRadius: '2px',
                      border: '1px solid rgba(0,0,0,0.2)',
                    }
                    const status = selectedActivity.system_status || selectedActivity.status || 'Not Started'
                    if (status === 'Completed') return <span style={{ ...roundedRectStyle, backgroundColor: '#0000FF' }} title="Completed" />
                    if (status === 'In Progress') return <span style={{ ...roundedRectStyle, background: 'linear-gradient(to right, #0000FF 50%, #00FF00 50%)' }} title="In Progress" />
                    return <span style={{ ...roundedRectStyle, backgroundColor: '#00FF00' }} title="Not Started" />
                  })()}
                </span>
              </div>
              <Space size={8}>
                {/* 状态控制按钮 */}
                {selectedActivity.status === 'Completed' ? (
                  <Button
                    size="small"
                    type="primary"
                    ghost
                    icon={<ExpandOutlined style={{ fontSize: '11px' }} />}
                    onClick={handleReopenActivity}
                    loading={reopenActivityMutation.isPending}
                    style={{ height: '22px', fontSize: '11px', padding: '0 8px', color: '#fff' }}
                  >
                    重新打开
                  </Button>
                ) : (
                  <Button
                    size="small"
                    type="primary"
                    icon={<CheckCircleOutlined style={{ fontSize: '11px' }} />}
                    onClick={handleCompleteActivity}
                    loading={completeActivityMutation.isPending}
                    style={{ height: '22px', fontSize: '11px', padding: '0 8px', color: '#fff' }}
                  >
                    确认完成
                  </Button>
                )}
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={() => setShowDetailPanel(false)}
                  style={{ padding: '0 4px', height: '20px', fontSize: '11px', color: '#8c8c8c' }}
                />
              </Space>
            </div>
            {/* 汇总信息条 */}
            <div style={{
              display: 'flex',
              gap: '16px',
              fontSize: '11px',
              color: '#595959',
              flexWrap: 'wrap',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <TeamOutlined style={{ fontSize: '11px', color: '#1890ff' }} />
                <span style={{ fontWeight: 500, color: '#262626' }}>总人工天:</span>
                <span style={{ color: '#1890ff', fontWeight: 500 }}>{formatQuantity(summaryInfo.totalManpowerDays, 3, '0', true)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <BarChartOutlined style={{ fontSize: '11px', color: '#1890ff' }} />
                <span style={{ fontWeight: 500, color: '#262626' }}>累计完成量:</span>
                <span style={{ color: '#1890ff', fontWeight: 500 }}>{formatQuantity(summaryInfo.totalAchieved, 3)}</span>
              </div>
              {selectedActivity.key_qty && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <PercentageOutlined style={{ fontSize: '11px', color: '#52c41a' }} />
                  <span style={{ fontWeight: 500, color: '#262626' }}>完成率:</span>
                  <span style={{ color: '#52c41a', fontWeight: 500 }}>{((summaryInfo.totalAchieved / selectedActivity.key_qty) * 100).toFixed(1)}%</span>
                </div>
              )}
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
            <Tabs
              activeKey={detailTab}
              onChange={setDetailTab}
              size="small"
              style={{ marginTop: 0, fontSize: '11px' }}
              tabBarStyle={{ marginBottom: '8px', fontSize: '11px' }}
              items={[
                {
                  key: 'general',
                  label: (
                    <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FileTextOutlined style={{ fontSize: '11px' }} />
                      General
                    </span>
                  ),
                  children: (
                    <div style={{ width: '66%' }}>
                      <Descriptions 
                        column={2} 
                        size="small" 
                        bordered
                        className="minimal-descriptions"
                        style={{ marginTop: 8 }}
                      >
                        <Descriptions.Item label={getColTitle('activity_id', '作业代码')}>{selectedActivity.activity_id}</Descriptions.Item>
                        <Descriptions.Item label={getColTitle('title', '作业描述')}>{selectedActivity.title || '-'}</Descriptions.Item>
                        <Descriptions.Item label={getColTitle('wbs_code', 'WBS代码')}>{selectedActivity.wbs_code || '-'}</Descriptions.Item>
                        <Descriptions.Item label={getColTitle('block', '子项')}>{selectedActivity.block || '-'}</Descriptions.Item>
                        <Descriptions.Item label={getColTitle('discipline', '专业')}>{selectedActivity.discipline || '-'}</Descriptions.Item>
                        <Descriptions.Item label={getColTitle('work_package', '工作包')}>{selectedActivity.work_package || '-'}</Descriptions.Item>
                        <Descriptions.Item label={getColTitle('scope', '分包商')}>{selectedActivity.scope || '-'}</Descriptions.Item>
                        <Descriptions.Item label={getColTitle('implement_phase', '执行阶段')}>{selectedActivity.implement_phase || '-'}</Descriptions.Item>
                        <Descriptions.Item label={getColTitle('project', '项目')}>{selectedActivity.project || '-'}</Descriptions.Item>
                        <Descriptions.Item label={getColTitle('subproject', '子项目')}>{selectedActivity.subproject || '-'}</Descriptions.Item>
                        <Descriptions.Item label={getColTitle('train', '开车阶段')}>{selectedActivity.train || '-'}</Descriptions.Item>
                        <Descriptions.Item label={getColTitle('unit', '装置')}>{selectedActivity.unit || '-'}</Descriptions.Item>
                      </Descriptions>
                    </div>
                  ),
                },
                {
                  key: 'design',
                  label: (
                    <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <LineChartOutlined style={{ fontSize: '11px' }} />
                      Engineering Status
                    </span>
                  ),
                  children: (
                    <ActivityDesignInfo activityId={selectedActivity.activity_id} />
                  ),
                },
                {
                  key: 'codes',
                  label: (
                    <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FileTextOutlined style={{ fontSize: '11px' }} />
                      Codes
                    </span>
                  ),
                  children: (
                    <div style={{ width: '50%' }}>
                      <Descriptions 
                        column={2} 
                        size="small" 
                        bordered
                        className="minimal-descriptions"
                        style={{ marginTop: 8 }}
                      >
                        <Descriptions.Item label={getColTitle('project', '项目')}>{selectedActivity.project || '-'}</Descriptions.Item>
                        <Descriptions.Item label={getColTitle('subproject', '子项目')}>{selectedActivity.subproject || '-'}</Descriptions.Item>
                        <Descriptions.Item label={getColTitle('implement_phase', '执行阶段')}>{selectedActivity.implement_phase || '-'}</Descriptions.Item>
                        <Descriptions.Item label={getColTitle('train', '开车阶段')}>{selectedActivity.train || '-'}</Descriptions.Item>
                        <Descriptions.Item label={getColTitle('unit', '装置')}>{selectedActivity.unit || '-'}</Descriptions.Item>
                        <Descriptions.Item label={getColTitle('block', '子项')}>{selectedActivity.block || '-'}</Descriptions.Item>
                        <Descriptions.Item label={getColTitle('discipline', '专业')}>{selectedActivity.discipline || '-'}</Descriptions.Item>
                        <Descriptions.Item label={getColTitle('work_package', '工作包')}>{selectedActivity.work_package || '-'}</Descriptions.Item>
                        <Descriptions.Item label={getColTitle('scope', '分包商')}>{selectedActivity.scope || '-'}</Descriptions.Item>
                        <Descriptions.Item label={getColTitle('quarter', '区块')}>{selectedActivity.quarter || '-'}</Descriptions.Item>
                      </Descriptions>
                    </div>
                  ),
                },
                {
                  key: 'status',
                  label: (
                    <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircleOutlined style={{ fontSize: '11px' }} />
                      Status
                    </span>
                  ),
                  children: (
                    <div style={{ width: '50%' }}>
                      <Descriptions 
                        column={2} 
                        size="small" 
                        bordered
                        className="minimal-descriptions"
                        style={{ marginTop: 8 }}
                      >
                        <Descriptions.Item label={getColTitle('baseline1_start_date', '计划开始')}>
                          {selectedActivity.baseline1_start_date ? dayjs(selectedActivity.baseline1_start_date).format('YYYY-MM-DD') : '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label={getColTitle('baseline1_finish_date', '计划完成')}>
                          {selectedActivity.baseline1_finish_date ? dayjs(selectedActivity.baseline1_finish_date).format('YYYY-MM-DD') : '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label={getColTitle('actual_start_date', '实际开始')}>
                          {selectedActivity.actual_start_date ? dayjs(selectedActivity.actual_start_date).format('YYYY-MM-DD') : '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label={getColTitle('actual_finish_date', '实际完成')}>
                          {selectedActivity.actual_finish_date ? dayjs(selectedActivity.actual_finish_date).format('YYYY-MM-DD') : '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label={getColTitle('planned_duration', '计划工期')}>{selectedActivity.planned_duration || '-'}</Descriptions.Item>
                        <Descriptions.Item label={getColTitle('actual_duration', '实际工期')}>{selectedActivity.actual_duration || '-'}</Descriptions.Item>
                        <Descriptions.Item label={getColTitle('completed', '完成量')}>
                          {formatQuantity(selectedActivity.completed, 3, '-')}
                        </Descriptions.Item>
                        <Descriptions.Item label={getColTitle('weight_factor', '权重') || '权重因子'}>
                          {selectedActivity.weight_factor ? selectedActivity.weight_factor.toFixed(2) : '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label={getColTitle('actual_weight_factor', '赢得权重') || '实际权重因子'}>
                          {selectedActivity.actual_weight_factor ? selectedActivity.actual_weight_factor.toFixed(2) : '-'}
                        </Descriptions.Item>
                      </Descriptions>
                    </div>
                  ),
                },
                {
                  key: 'mpdb',
                  label: (
                    <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <TeamOutlined style={{ fontSize: '11px' }} />
                      Manpower Report Records
                    </span>
                  ),
                  children: (
                    <div style={{ padding: '0 4px' }}>
                      <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                        <Button 
                          type="primary" 
                          size="small" 
                          icon={<PlusOutlined style={{ fontSize: '11px' }} />} 
                          onClick={() => {
                            setEditingMpdb(null)
                            mpdbForm.resetFields()
                            mpdbForm.setFieldsValue({
                              date: dayjs(),
                              manpower: 0,
                              machinery: 0,
                            })
                            setMpdbModalVisible(true)
                          }}
                          style={{ fontSize: '11px', height: '24px', padding: '0 8px', borderRadius: 0 }}
                        >
                          新增记录
                        </Button>
                      </div>
                      {isMpdbLoading ? (
                        <div style={{ height: '250px', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0' }}>
                          <Spin tip="加载中..." size="small" />
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px', height: '250px' }}>
                          <div style={{ flex: '0 0 auto', width: 'calc(100% - 900px)' }}>
                            <Table
                              columns={[
                                { 
                                  title: '日期', 
                                  dataIndex: 'date', 
                                  key: 'date', 
                                  align: 'center',
                                  render: (date: string) => <span style={{ fontSize: '11px' }}>{dayjs(date).format('YYYY-MM-DD')}</span>
                                },
                                { 
                                  title: '类型', 
                                  dataIndex: 'typeof_mp', 
                                  key: 'typeof_mp', 
                                  align: 'center',
                                  render: (text: string) => <span style={{ fontSize: '11px' }}>{text}</span>
                                },
                                { 
                                  title: '人力', 
                                  dataIndex: 'manpower', 
                                  key: 'manpower', 
                                  align: 'center',
                                  render: (val: string | number | null | undefined) => (
                                    <span style={{ fontSize: '11px' }}>{formatHighPrecisionValue(val)}</span>
                                  )
                                },
                                { 
                                  title: '机械', 
                                  dataIndex: 'machinery', 
                                  key: 'machinery', 
                                  align: 'center',
                                  render: (val: string | number | null | undefined) => (
                                    <span style={{ fontSize: '11px' }}>{formatHighPrecisionValue(val)}</span>
                                  )
                                },
                                {
                                  title: '操作',
                                  key: 'action',
                                  align: 'left',
                                  fixed: 'right' as const,
                                  render: (_: any, record: MPDBResponse) => (
                                    <Space size={4} style={{ fontSize: '11px' }}>
                                      <Button
                                        type="link"
                                        size="small"
                                        icon={<EditOutlined style={{ fontSize: '11px' }} />}
                                        onClick={() => {
                                          setEditingMpdb(record)
                                          mpdbForm.setFieldsValue({
                                            date: dayjs(record.date),
                                            typeof_mp: record.typeof_mp,
                                            manpower: safeStringToNumber(record.manpower),
                                            machinery: safeStringToNumber(record.machinery),
                                            remarks: record.remarks,
                                          })
                                          setMpdbModalVisible(true)
                                        }}
                                        style={{ padding: '0 4px', height: '22px', fontSize: '11px' }}
                                      >
                                        编辑
                                      </Button>
                                      <Popconfirm
                                        title="确定要删除这条记录吗？"
                                        onConfirm={() => deleteMpdbMutation.mutate(record.id)}
                                        okText="确定"
                                        cancelText="取消"
                                      >
                                        <Button 
                                          type="link" 
                                          size="small" 
                                          danger 
                                          icon={<DeleteOutlined style={{ fontSize: '11px' }} />} 
                                          style={{ padding: '0 4px', height: '22px', fontSize: '11px' }}
                                        >
                                          删除
                                        </Button>
                                      </Popconfirm>
                                    </Space>
                                  ),
                                },
                              ]}
                              dataSource={mpdbData || []}
                              rowKey="id"
                              size="small"
                              pagination={{ pageSize: 10, size: 'small', showSizeChanger: false, showTotal: (total) => `共 ${total} 条` }}
                              scroll={{ y: 200 }}
                              style={{ fontSize: '11px' }}
                              className="engineering-status-table"
                            />
                          </div>
                          <div className="engineering-status-container" style={{ flex: '0 0 auto', width: '890px', padding: '8px', border: '1px solid #e2e8f0' }}>
                            {mpdbData && mpdbData.length > 0 ? (
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart 
                                  data={[...mpdbData].reverse().map(item => ({
                                    日期: dayjs(item.date).format('YYYY-MM-DD'),
                                    人力: formatManpowerForChart(item.manpower),
                                    机械: formatManpowerForChart(item.machinery),
                                  }))}
                                  margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                  <XAxis 
                                    dataKey="日期" 
                                    tick={{ fontSize: '10px', fill: '#94a3b8' }}
                                    angle={-45}
                                    textAnchor="end"
                                    height={50}
                                    axisLine={{ stroke: '#e2e8f0' }}
                                  />
                                  <YAxis 
                                    tick={{ fontSize: '10px', fill: '#94a3b8' }}
                                    width={40}
                                    axisLine={{ stroke: '#e2e8f0' }}
                                  />
                                  <Tooltip 
                                    contentStyle={{ 
                                      borderRadius: '0', 
                                      border: '1px solid #e2e8f0',
                                      fontSize: '11px',
                                      padding: '4px 8px',
                                      boxShadow: 'none',
                                      background: '#fff'
                                    }}
                                    formatter={(value: any, name: string) => {
                                      // 格式化显示值，去除尾随0
                                      const formatted = formatHighPrecisionValue(value)
                                      return [formatted, name]
                                    }}
                                  />
                                  <Legend 
                                    wrapperStyle={{ fontSize: '10px', paddingTop: '5px' }}
                                    iconSize={10}
                                    iconType="rect"
                                  />
                                  <Bar dataKey="人力" fill="#3b82f6" radius={0} />
                                  <Bar dataKey="机械" fill="#10b981" radius={0} />
                                </BarChart>
                              </ResponsiveContainer>
                            ) : (
                              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#94a3b8', fontSize: '11px' }}>
                                暂无数据
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'vfactdb',
                  label: (
                    <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <BarChartOutlined style={{ fontSize: '11px' }} />
                      Physical Volume Report Records
                    </span>
                  ),
                  children: (
                    <div style={{ padding: '0 4px' }}>
                      <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                        <Button 
                          type="primary" 
                          size="small" 
                          icon={<PlusOutlined style={{ fontSize: '11px' }} />} 
                          onClick={() => {
                            setEditingVfactdb(null)
                            vfactdbForm.resetFields()
                            vfactdbForm.setFieldsValue({
                              date: dayjs(),
                              achieved: 0,
                            })
                            setVfactdbModalVisible(true)
                          }}
                          style={{ fontSize: '11px', height: '24px', padding: '0 8px', borderRadius: 0 }}
                        >
                          新增记录
                        </Button>
                      </div>
                      {isVfactdbLoading ? (
                        <div style={{ height: '250px', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0' }}>
                          <Spin tip="加载中..." size="small" />
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px', height: '250px' }}>
                          <div style={{ flex: '0 0 auto', width: 'calc(100% - 900px)' }}>
                            <Table
                              columns={[
                                { 
                                  title: '日期', 
                                  dataIndex: 'date', 
                                  key: 'date', 
                                  align: 'center',
                                  render: (date: string) => <span style={{ fontSize: '11px' }}>{dayjs(date).format('YYYY-MM-DD')}</span>
                                },
                                { 
                                  title: '工作步骤', 
                                  dataIndex: 'work_step_description', 
                                  key: 'work_step_description', 
                                  align: 'center',
                                  ellipsis: { showTitle: true },
                                  render: (text: string) => <span style={{ fontSize: '11px' }}>{text || '-'}</span>
                                },
                                { 
                                  title: '完成量', 
                                  dataIndex: 'achieved', 
                                  key: 'achieved', 
                                  align: 'center', 
                                  render: (val: number | string) => {
                                    return <span style={{ fontSize: '11px' }}>{formatQuantity(val, 3)}</span>
                                  } 
                                },
                                {
                                  title: '操作',
                                  key: 'action',
                                  align: 'left',
                                  fixed: 'right' as const,
                                  render: (_: any, record: VFACTDBResponse) => (
                                    <Space size={4} style={{ fontSize: '11px' }}>
                                      <Button
                                        type="link"
                                        size="small"
                                        icon={<EditOutlined style={{ fontSize: '11px' }} />}
                                        onClick={() => {
                                          setEditingVfactdb(record)
                                          vfactdbForm.setFieldsValue({
                                            date: dayjs(record.date),
                                            work_step_description: record.work_step_description,
                                            achieved: safeStringToNumber(record.achieved),
                                          })
                                          setVfactdbModalVisible(true)
                                        }}
                                        style={{ padding: '0 4px', height: '22px', fontSize: '11px' }}
                                      >
                                        编辑
                                      </Button>
                                      <Popconfirm
                                        title="确定要删除这条记录吗？"
                                        onConfirm={() => deleteVfactdbMutation.mutate({ id: record.id, activity_id: record.activity_id })}
                                        okText="确定"
                                        cancelText="取消"
                                      >
                                        <Button 
                                          type="link" 
                                          size="small" 
                                          danger 
                                          icon={<DeleteOutlined style={{ fontSize: '11px' }} />} 
                                          style={{ padding: '0 4px', height: '22px', fontSize: '11px' }}
                                        >
                                          删除
                                        </Button>
                                      </Popconfirm>
                                    </Space>
                                  ),
                                },
                              ]}
                              dataSource={vfactdbData || []}
                              rowKey="id"
                              size="small"
                              pagination={{ pageSize: 10, size: 'small', showSizeChanger: false, showTotal: (total) => `共 ${total} 条` }}
                              scroll={{ y: 200 }}
                              style={{ fontSize: '11px' }}
                              className="engineering-status-table"
                            />
                          </div>
                          <div className="engineering-status-container" style={{ flex: '0 0 auto', width: '890px', padding: '8px', border: '1px solid #e2e8f0' }}>
                            {vfactdbData && vfactdbData.length > 0 ? (
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart 
                                  data={[...vfactdbData].reverse().map(item => ({
                                    日期: dayjs(item.date).format('YYYY-MM-DD'),
                                    完成量: typeof item.achieved === 'string' ? parseFloat(item.achieved) || 0 : (item.achieved || 0),
                                  }))}
                                  margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                  <XAxis 
                                    dataKey="日期" 
                                    tick={{ fontSize: '10px', fill: '#94a3b8' }}
                                    angle={-45}
                                    textAnchor="end"
                                    height={50}
                                    axisLine={{ stroke: '#e2e8f0' }}
                                  />
                                  <YAxis 
                                    tick={{ fontSize: '10px', fill: '#94a3b8' }}
                                    width={40}
                                    axisLine={{ stroke: '#e2e8f0' }}
                                  />
                                  <Tooltip 
                                    contentStyle={{ 
                                      borderRadius: '0', 
                                      border: '1px solid #e2e8f0',
                                      fontSize: '11px',
                                      padding: '4px 8px',
                                      boxShadow: 'none',
                                      background: '#fff'
                                    }}
                                    formatter={(value: any) => [formatQuantity(value, 3), '完成量']}
                                  />
                                  <Bar dataKey="完成量" fill="#3b82f6" radius={0} />
                                </BarChart>
                              </ResponsiveContainer>
                            ) : (
                              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#94a3b8', fontSize: '11px' }}>
                                暂无数据
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'non-key-volumes',
                  label: (
                    <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <ToolOutlined style={{ fontSize: '11px' }} />
                      非关键工程量
                    </span>
                  ),
                  children: (
                    <div style={{ padding: '0 4px' }}>
                      <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                        <Button 
                          type="primary" 
                          size="small" 
                          icon={<PlusOutlined style={{ fontSize: '11px' }} />} 
                          onClick={() => {
                            setEditingWorkStepVolume(null)
                            workStepVolumeForm.resetFields()
                            workStepVolumeForm.setFieldsValue({
                              work_step_description: undefined,
                              estimated_total: undefined,
                            })
                            setWorkStepVolumeModalVisible(true)
                          }}
                          style={{ fontSize: '11px', height: '24px', padding: '0 8px', borderRadius: 0 }}
                        >
                          新增预估总量
                        </Button>
                      </div>
                      <Table
                        columns={[
                          { 
                            title: '工作步骤描述', 
                            dataIndex: 'work_step_description', 
                            key: 'work_step_description', 
                            width: 150,
                            render: (text: string) => <span style={{ fontSize: '11px' }}>{text || '-'}</span>
                          },
                          { 
                            title: '预估总量', 
                            dataIndex: 'estimated_total', 
                            key: 'estimated_total', 
                            width: 150, 
                            align: 'right' as const,
                            render: (val: number) => <span style={{ fontSize: '11px' }}>{formatQuantity(val, 3, '-', true)}</span>,
                          },
                          {
                            title: '操作',
                            key: 'action',
                            width: 150,
                            fixed: 'right' as const,
                            render: (_: any, record: WorkStepVolume) => (
                              <Space size={4} style={{ fontSize: '11px' }}>
                                <Button
                                  type="link"
                                  size="small"
                                  icon={<EditOutlined style={{ fontSize: '11px' }} />}
                                  onClick={() => {
                                    setEditingWorkStepVolume(record)
                                    workStepVolumeForm.setFieldsValue({
                                      work_step_description: record.work_step_description,
                                      estimated_total: safeStringToNumber(record.estimated_total),
                                    })
                                    setWorkStepVolumeModalVisible(true)
                                  }}
                                  style={{ padding: '0 4px', height: '22px', fontSize: '11px' }}
                                >
                                  编辑
                                </Button>
                                <Popconfirm
                                  title="确定要删除这条记录吗？"
                                  onConfirm={() => deleteWorkStepVolumeMutation.mutate(record.id)}
                                  okText="确定"
                                  cancelText="取消"
                                >
                                  <Button 
                                    type="link" 
                                    size="small" 
                                    danger 
                                    icon={<DeleteOutlined style={{ fontSize: '11px' }} />} 
                                    style={{ padding: '0 4px', height: '22px', fontSize: '11px' }}
                                  >
                                    删除
                                  </Button>
                                </Popconfirm>
                              </Space>
                            ),
                          },
                        ]}
                        dataSource={workStepVolumesData || []}
                        rowKey="id"
                        size="small"
                        pagination={{ pageSize: 10, size: 'small', showSizeChanger: false, showTotal: (total) => `共 ${total} 条` }}
                        scroll={{ x: 'max-content', y: 350 }}
                        style={{ fontSize: '11px' }}
                        className="engineering-status-table"
                        locale={{ emptyText: '暂无数据，请点击"新增预估总量"添加' }}
                      />
                    </div>
                  ),
                },
                {
                  key: 'volume-control-quantity',
                  label: (
                    <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <BarChartOutlined style={{ fontSize: '11px' }} />
                      工程量及完工信息
                    </span>
                  ),
                  children: (
                    <div style={{ padding: '0 4px' }}>
                      {quantityData ? (
                        <div>
                          <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Button 
                              type="primary" 
                              size="small"
                              icon={<EditOutlined style={{ fontSize: '11px' }} />} 
                              onClick={() => {
                                quantityForm.setFieldsValue({
                                  estimated_total: safeStringToNumber(quantityData.estimated_total),
                                  drawing_approved_afc: safeStringToNumber(quantityData.drawing_approved_afc),
                                  material_arrived: safeStringToNumber(quantityData.material_arrived),
                                  available_workface: safeStringToNumber(quantityData.available_workface),
                                  workface_restricted_material: safeStringToNumber(quantityData.workface_restricted_material),
                                  workface_restricted_site: safeStringToNumber(quantityData.workface_restricted_site),
                                  construction_completed: calculatedCompleted || safeStringToNumber(quantityData.construction_completed),
                                  responsible_user_id: quantityData.responsible_user_id,
                                })
                                setQuantityModalVisible(true)
                              }}
                              style={{ fontSize: '11px', height: '24px', padding: '0 8px' }}
                            >
                              编辑
                            </Button>
                          </div>
                          <div style={{ width: '50%' }}>
                            <Descriptions 
                              column={2} 
                              size="small" 
                              bordered
                              className="minimal-descriptions"
                            >
                              <Descriptions.Item label="预估总量">
                                <div style={{ fontSize: '11px' }}>
                                  {formatQuantity(quantityData.estimated_total, 3, '-')}
                                  {quantityData.estimated_total_updated_at && (
                                    <div style={{ fontSize: '10px', color: '#999', marginTop: 2 }}>
                                      最后修改: {dayjs(quantityData.estimated_total_updated_at).format('YYYY-MM-DD HH:mm')}
                                      {quantityData.estimated_total_updated_by && ` (用户ID: ${quantityData.estimated_total_updated_by})`}
                                    </div>
                                  )}
                                </div>
                              </Descriptions.Item>
                              <Descriptions.Item label="图纸批准量AFC">
                                {formatQuantity(quantityData.drawing_approved_afc, 3, '-')}
                                {quantityData.drawing_approved_afc_updated_at && (
                                  <div style={{ fontSize: '11px', color: '#999', marginTop: 4 }}>
                                    最后修改: {dayjs(quantityData.drawing_approved_afc_updated_at).format('YYYY-MM-DD HH:mm')}
                                    {quantityData.drawing_approved_afc_updated_by && ` (用户ID: ${quantityData.drawing_approved_afc_updated_by})`}
                                  </div>
                                )}
                              </Descriptions.Item>
                              <Descriptions.Item label="材料到货量">
                                {formatQuantity(quantityData.material_arrived, 3, '-')}
                                {quantityData.material_arrived_updated_at && (
                                  <div style={{ fontSize: '11px', color: '#999', marginTop: 4 }}>
                                    最后修改: {dayjs(quantityData.material_arrived_updated_at).format('YYYY-MM-DD HH:mm')}
                                    {quantityData.material_arrived_updated_by && ` (用户ID: ${quantityData.material_arrived_updated_by})`}
                                  </div>
                                )}
                              </Descriptions.Item>
                              <Descriptions.Item label="现有可施工工作面">
                                {formatQuantity(quantityData.available_workface, 3, '-')}
                                {quantityData.available_workface_updated_at && (
                                  <div style={{ fontSize: '11px', color: '#999', marginTop: 4 }}>
                                    最后修改: {dayjs(quantityData.available_workface_updated_at).format('YYYY-MM-DD HH:mm')}
                                    {quantityData.available_workface_updated_by && ` (用户ID: ${quantityData.available_workface_updated_by})`}
                                  </div>
                                )}
                              </Descriptions.Item>
                              <Descriptions.Item label="工作面受限（材料）">
                                {formatQuantity(quantityData.workface_restricted_material, 3, '-')}
                                {quantityData.workface_restricted_material_updated_at && (
                                  <div style={{ fontSize: '11px', color: '#999', marginTop: 4 }}>
                                    最后修改: {dayjs(quantityData.workface_restricted_material_updated_at).format('YYYY-MM-DD HH:mm')}
                                    {quantityData.workface_restricted_material_updated_by && ` (用户ID: ${quantityData.workface_restricted_material_updated_by})`}
                                  </div>
                                )}
                              </Descriptions.Item>
                              <Descriptions.Item label="工作面受限（现场）">
                                {formatQuantity(quantityData.workface_restricted_site, 3, '-')}
                                {quantityData.workface_restricted_site_updated_at && (
                                  <div style={{ fontSize: '11px', color: '#999', marginTop: 4 }}>
                                    最后修改: {dayjs(quantityData.workface_restricted_site_updated_at).format('YYYY-MM-DD HH:mm')}
                                    {quantityData.workface_restricted_site_updated_by && ` (用户ID: ${quantityData.workface_restricted_site_updated_by})`}
                                  </div>
                                )}
                              </Descriptions.Item>
                              <Descriptions.Item label="施工完成" span={2}>
                                {(() => {
                                  const currentCompleted = quantityData.construction_completed 
                                    ? (typeof quantityData.construction_completed === 'string' 
                                        ? parseFloat(quantityData.construction_completed) 
                                        : quantityData.construction_completed) || 0
                                    : 0
                                  const diff = Math.abs(calculatedCompleted - currentCompleted)
                                  return (
                                    <span style={{ color: diff > 0.01 ? '#ff4d4f' : undefined }}>
                                      {formatQuantity(calculatedCompleted, 3)} (从日报汇总)
                                      {diff > 0.01 && (
                                        <span style={{ marginLeft: 8, fontSize: '11px', color: '#999' }}>
                                          (当前值: {formatQuantity(quantityData.construction_completed, 3, '-')})
                                        </span>
                                      )}
                                    </span>
                                  )
                                })()}
                                {quantityData.construction_completed_updated_at && (
                                  <div style={{ fontSize: '11px', color: '#999', marginTop: 4 }}>
                                    最后修改: {dayjs(quantityData.construction_completed_updated_at).format('YYYY-MM-DD HH:mm')}
                                    {quantityData.construction_completed_updated_by && ` (用户ID: ${quantityData.construction_completed_updated_by})`}
                                  </div>
                                )}
                              </Descriptions.Item>
                              <Descriptions.Item label="责任人" span={2}>
                                {quantityData.responsible_user_id ? `用户ID: ${quantityData.responsible_user_id}` : '-'}
                                {quantityData.responsible_updated_at && (
                                  <div style={{ fontSize: '11px', color: '#999', marginTop: 4 }}>
                                    最后修改: {dayjs(quantityData.responsible_updated_at).format('YYYY-MM-DD HH:mm')}
                                    {quantityData.responsible_updated_by && ` (用户ID: ${quantityData.responsible_updated_by})`}
                                  </div>
                                )}
                              </Descriptions.Item>
                            </Descriptions>
                          </div>
                        </div>
                      ) : isPermissionError(quantityError) ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#ff4d4f' }}>
                          您无权访问此模块
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                          暂无数据
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'volume-control-inspection',
                  label: (
                    <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircleOutlined style={{ fontSize: '11px' }} />
                      验收相关信息
                    </span>
                  ),
                  children: (
                    <div style={{ padding: '0 4px' }}>
                      {inspectionData ? (
                        <div>
                          <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Button 
                              type="primary" 
                              size="small"
                              icon={<EditOutlined style={{ fontSize: '11px' }} />} 
                              onClick={() => {
                                inspectionForm.setFieldsValue({
                                  rfi_completed_a: inspectionData.rfi_completed_a,
                                  rfi_completed_b: inspectionData.rfi_completed_b,
                                  rfi_completed_c: inspectionData.rfi_completed_c,
                                  responsible_user_id: inspectionData.responsible_user_id,
                                })
                                setInspectionModalVisible(true)
                              }}
                              style={{ fontSize: '11px', height: '24px', padding: '0 8px' }}
                            >
                              编辑
                            </Button>
                          </div>
                          <div style={{ width: '50%' }}>
                            <Descriptions 
                              column={2} 
                              size="small" 
                              bordered
                              className="minimal-descriptions"
                            >
                              <Descriptions.Item label={rfiNames?.rfi_a_name || 'RFI验收完成量（A）'}>
                                {formatQuantity(inspectionData.rfi_completed_a, 3, '-')}
                                {inspectionData.rfi_completed_a_updated_at && (
                                  <div style={{ fontSize: '11px', color: '#999', marginTop: 4 }}>
                                    最后修改: {dayjs(inspectionData.rfi_completed_a_updated_at).format('YYYY-MM-DD HH:mm')}
                                    {inspectionData.rfi_completed_a_updated_by && ` (用户ID: ${inspectionData.rfi_completed_a_updated_by})`}
                                  </div>
                                )}
                              </Descriptions.Item>
                              <Descriptions.Item label={rfiNames?.rfi_b_name || 'RFI验收完成量（B）'}>
                                {formatQuantity(inspectionData.rfi_completed_b, 3, '-')}
                                {inspectionData.rfi_completed_b_updated_at && (
                                  <div style={{ fontSize: '11px', color: '#999', marginTop: 4 }}>
                                    最后修改: {dayjs(inspectionData.rfi_completed_b_updated_at).format('YYYY-MM-DD HH:mm')}
                                    {inspectionData.rfi_completed_b_updated_by && ` (用户ID: ${inspectionData.rfi_completed_b_updated_by})`}
                                  </div>
                                )}
                              </Descriptions.Item>
                              <Descriptions.Item label={rfiNames?.rfi_c_name || 'RFI验收完成量（C）'}>
                                {formatQuantity(inspectionData.rfi_completed_c, 3, '-')}
                                {inspectionData.rfi_completed_c_updated_at && (
                                  <div style={{ fontSize: '11px', color: '#999', marginTop: 4 }}>
                                    最后修改: {dayjs(inspectionData.rfi_completed_c_updated_at).format('YYYY-MM-DD HH:mm')}
                                    {inspectionData.rfi_completed_c_updated_by && ` (用户ID: ${inspectionData.rfi_completed_c_updated_by})`}
                                  </div>
                                )}
                              </Descriptions.Item>
                              <Descriptions.Item label="责任人" span={2}>
                                {inspectionData.responsible_user_id ? `用户ID: ${inspectionData.responsible_user_id}` : '-'}
                                {inspectionData.responsible_updated_at && (
                                  <div style={{ fontSize: '11px', color: '#999', marginTop: 4 }}>
                                    最后修改: {dayjs(inspectionData.responsible_updated_at).format('YYYY-MM-DD HH:mm')}
                                    {inspectionData.responsible_updated_by && ` (用户ID: ${inspectionData.responsible_updated_by})`}
                                  </div>
                                )}
                              </Descriptions.Item>
                            </Descriptions>
                          </div>
                        </div>
                      ) : isPermissionError(inspectionError) ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#ff4d4f' }}>
                          您无权访问此模块
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                          暂无数据
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'volume-control-asbuilt',
                  label: (
                    <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FileTextOutlined style={{ fontSize: '11px' }} />
                      竣工资料相关信息
                    </span>
                  ),
                  children: (
                    <div style={{ padding: '0 4px' }}>
                      {asbuiltData ? (
                        <div>
                          <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Button 
                              type="primary" 
                              size="small"
                              icon={<EditOutlined style={{ fontSize: '11px' }} />} 
                              onClick={() => {
                                asbuiltForm.setFieldsValue({
                                  asbuilt_signed_r0: safeStringToNumber(asbuiltData.asbuilt_signed_r0),
                                  asbuilt_signed_r1: safeStringToNumber(asbuiltData.asbuilt_signed_r1),
                                  responsible_user_id: asbuiltData.responsible_user_id,
                                })
                                setAsbuiltModalVisible(true)
                              }}
                              style={{ fontSize: '11px', height: '24px', padding: '0 8px' }}
                            >
                              编辑
                            </Button>
                          </div>
                          <div style={{ width: '50%' }}>
                            <Descriptions 
                              column={1} 
                              size="small" 
                              bordered
                              className="minimal-descriptions"
                            >
                              <Descriptions.Item label="竣工资料签署量（R0）">
                                {formatQuantity(asbuiltData.asbuilt_signed_r0, 3, '-')}
                                {asbuiltData.asbuilt_signed_r0_updated_at && (
                                  <div style={{ fontSize: '11px', color: '#999', marginTop: 4 }}>
                                    最后修改: {dayjs(asbuiltData.asbuilt_signed_r0_updated_at).format('YYYY-MM-DD HH:mm')}
                                    {asbuiltData.asbuilt_signed_r0_updated_by && ` (用户ID: ${asbuiltData.asbuilt_signed_r0_updated_by})`}
                                  </div>
                                )}
                              </Descriptions.Item>
                              <Descriptions.Item label="竣工资料签署量（R1）">
                                {formatQuantity(asbuiltData.asbuilt_signed_r1, 3, '-')}
                                {asbuiltData.asbuilt_signed_r1_updated_at && (
                                  <div style={{ fontSize: '11px', color: '#999', marginTop: 4 }}>
                                    最后修改: {dayjs(asbuiltData.asbuilt_signed_r1_updated_at).format('YYYY-MM-DD HH:mm')}
                                    {asbuiltData.asbuilt_signed_r1_updated_by && ` (用户ID: ${asbuiltData.asbuilt_signed_r1_updated_by})`}
                                  </div>
                                )}
                              </Descriptions.Item>
                              <Descriptions.Item label="责任人" span={1}>
                                {asbuiltData.responsible_user_id ? `用户ID: ${asbuiltData.responsible_user_id}` : '-'}
                                {asbuiltData.responsible_updated_at && (
                                  <div style={{ fontSize: '11px', color: '#999', marginTop: 4 }}>
                                    最后修改: {dayjs(asbuiltData.responsible_updated_at).format('YYYY-MM-DD HH:mm')}
                                    {asbuiltData.responsible_updated_by && ` (用户ID: ${asbuiltData.responsible_updated_by})`}
                                  </div>
                                )}
                              </Descriptions.Item>
                            </Descriptions>
                          </div>
                        </div>
                      ) : isPermissionError(asbuiltError) ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#ff4d4f' }}>
                          您无权访问此模块
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                          暂无数据
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'volume-control-payment',
                  label: (
                    <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <BarChartOutlined style={{ fontSize: '11px' }} />
                      收款相关信息
                    </span>
                  ),
                  children: (
                    <div style={{ padding: '0 4px' }}>
                      {paymentData ? (
                        <div>
                          <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Button 
                              type="primary" 
                              size="small"
                              icon={<EditOutlined style={{ fontSize: '11px' }} />} 
                              onClick={() => {
                                paymentForm.setFieldsValue({
                                  obp_signed: safeStringToNumber(paymentData.obp_signed),
                                  responsible_user_id: paymentData.responsible_user_id,
                                })
                                setPaymentModalVisible(true)
                              }}
                              style={{ fontSize: '11px', height: '24px', padding: '0 8px' }}
                            >
                              编辑
                            </Button>
                          </div>
                          <div style={{ width: '50%' }}>
                            <Descriptions 
                              column={1} 
                              size="small" 
                              bordered
                              className="minimal-descriptions"
                            >
                              <Descriptions.Item label="OBP签署量" span={1}>
                                {formatQuantity(paymentData.obp_signed, 3, '-')}
                                {paymentData.obp_signed_updated_at && (
                                  <div style={{ fontSize: '11px', color: '#999', marginTop: 4 }}>
                                    最后修改: {dayjs(paymentData.obp_signed_updated_at).format('YYYY-MM-DD HH:mm')}
                                    {paymentData.obp_signed_updated_by && ` (用户ID: ${paymentData.obp_signed_updated_by})`}
                                  </div>
                                )}
                              </Descriptions.Item>
                              <Descriptions.Item label="责任人" span={1}>
                                {paymentData.responsible_user_id ? `用户ID: ${paymentData.responsible_user_id}` : '-'}
                                {paymentData.responsible_updated_at && (
                                  <div style={{ fontSize: '11px', color: '#999', marginTop: 4 }}>
                                    最后修改: {dayjs(paymentData.responsible_updated_at).format('YYYY-MM-DD HH:mm')}
                                    {paymentData.responsible_updated_by && ` (用户ID: ${paymentData.responsible_updated_by})`}
                                  </div>
                                )}
                              </Descriptions.Item>
                            </Descriptions>
                          </div>
                        </div>
                      ) : isPermissionError(paymentError) ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#ff4d4f' }}>
                          您无权访问此模块
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                          暂无数据
                        </div>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </div>
        </>
      )}

      {/* MPDB编辑Modal */}
      <Modal
        title={editingMpdb ? '编辑MPDB记录' : '新增MPDB记录'}
        open={mpdbModalVisible}
        onOk={async () => {
          try {
            const values = await mpdbForm.validateFields()
            const entry: MPDBEntry = {
              ...values,
              date: values.date.format('YYYY-MM-DD'),
              activity_id: selectedActivity!.activity_id,
              scope: selectedActivity!.scope,
              project: selectedActivity!.project,
              subproject: selectedActivity!.subproject,
              implement_phase: selectedActivity!.implement_phase,
              train: selectedActivity!.train,
              unit: selectedActivity!.unit,
              block: selectedActivity!.block,
              quarter: selectedActivity!.quarter,
              main_block: selectedActivity!.main_block,
              title: selectedActivity!.title,
              discipline: selectedActivity!.discipline,
              work_package: selectedActivity!.work_package,
            }
            if (editingMpdb) {
              updateMpdbMutation.mutate({ id: editingMpdb.id, entry })
            } else {
              createMpdbMutation.mutate(entry)
            }
          } catch (error) {
            // 表单验证失败（错误已通过message显示，不需要额外日志）
          }
        }}
        onCancel={() => {
          setMpdbModalVisible(false)
          setEditingMpdb(null)
          mpdbForm.resetFields()
        }}
        confirmLoading={createMpdbMutation.isPending || updateMpdbMutation.isPending}
        okText="确定"
        cancelText="取消"
        width={600}
      >
        <Form form={mpdbForm} layout="vertical" style={{ marginTop: 8 }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="date"
                label="日期"
                rules={[{ required: true, message: '请选择日期' }]}
                style={{ marginBottom: 16 }}
              >
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="typeof_mp"
                label="人力类型"
                style={{ marginBottom: 16 }}
              >
                <Select placeholder="选择人力类型">
                  <Option value="Direct">Direct</Option>
                  <Option value="Indirect">Indirect</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="manpower"
                label="人力"
                rules={[{ required: true, message: '请输入人力数量' }]}
                style={{ marginBottom: 16 }}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="machinery"
                label="机械"
                style={{ marginBottom: 16 }}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="remarks"
                label="备注"
                style={{ marginBottom: 0 }}
              >
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* VFACTDB编辑Modal */}
      <Modal
        title={editingVfactdb ? '编辑VFACTDB记录' : '新增VFACTDB记录'}
        open={vfactdbModalVisible}
        onOk={async () => {
          try {
            // 检查 selectedActivity 是否存在
            if (!selectedActivity) {
              messageApi.error('未选择作业，无法保存记录')
              return
            }

            const values = await vfactdbForm.validateFields()
            
            // 确保 date 是 dayjs 对象
            let dateValue: string
            if (dayjs.isDayjs(values.date)) {
              dateValue = values.date.format('YYYY-MM-DD')
            } else if (typeof values.date === 'string') {
              dateValue = values.date
            } else {
              dateValue = dayjs(values.date).format('YYYY-MM-DD')
            }

            // 确保 achieved 是字符串（后端要求）
            const achievedValue = values.achieved !== null && values.achieved !== undefined 
              ? String(values.achieved) 
              : '0'

            const entry: VFACTDBEntry = {
              date: dateValue,
              activity_id: selectedActivity.activity_id,
              achieved: achievedValue,
              work_step_description: values.work_step_description || undefined,
              scope: selectedActivity.scope || undefined,
              project: selectedActivity.project || undefined,
              subproject: selectedActivity.subproject || undefined,
              implement_phase: selectedActivity.implement_phase || undefined,
              train: selectedActivity.train || undefined,
              unit: selectedActivity.unit || undefined,
              block: selectedActivity.block || undefined,
              quarter: selectedActivity.quarter || undefined,
              main_block: selectedActivity.main_block || undefined,
              title: selectedActivity.title || undefined,
              discipline: selectedActivity.discipline || undefined,
              work_package: selectedActivity.work_package || undefined,
            }
            if (editingVfactdb) {
              updateVfactdbMutation.mutate({ id: editingVfactdb.id, entry })
            } else {
              createVfactdbMutation.mutate(entry)
            }
          } catch (error: any) {
            // 表单验证失败（错误已通过message显示，不需要额外日志）
            // 如果是表单验证错误，Antd 会自动显示，这里只处理其他错误
            if (error?.errorFields) {
              // 表单验证错误，Antd 会自动显示
              return
            }
            messageApi.error(error?.message || '保存失败，请检查输入')
          }
        }}
        onCancel={() => {
          setVfactdbModalVisible(false)
          setEditingVfactdb(null)
          vfactdbForm.resetFields()
        }}
        confirmLoading={createVfactdbMutation.isPending || updateVfactdbMutation.isPending}
        okText="确定"
        cancelText="取消"
        width={500}
      >
        <Form form={vfactdbForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item
            name="date"
            label="日期"
            rules={[{ required: true, message: '请选择日期' }]}
            style={{ marginBottom: 16 }}
          >
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item
            name="work_step_description"
            label="工作类型"
            style={{ marginBottom: 16 }}
          >
            <Select
              placeholder={
                !selectedActivity?.work_package 
                  ? "请先选择作业（需要工作包）" 
                  : workStepsLoading 
                    ? "加载中..." 
                    : "请选择工作类型"
              }
              showSearch
              allowClear
              loading={workStepsLoading}
              disabled={!selectedActivity?.work_package || workStepsLoading}
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={workStepsForVfactdb?.map((ws: WorkStepDefine) => ({
                value: ws.work_step_description,
                label: ws.work_step_description,
              })) || []}
              notFoundContent={
                workStepsLoading 
                  ? "加载中..." 
                  : !selectedActivity?.work_package 
                    ? "请先选择作业" 
                    : "暂无工作类型"
              }
            />
          </Form.Item>
          <Form.Item
            name="achieved"
            label="完成量"
            rules={[{ required: true, message: '请输入完成量' }]}
            style={{ marginBottom: 0 }}
          >
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          </Form>
        </Modal>

      {/* 非关键工程量编辑Modal */}
      <Modal
        title={editingWorkStepVolume ? '编辑非关键工程量' : '新增非关键工程量'}
        open={workStepVolumeModalVisible}
        onOk={async () => {
          try {
            const values = await workStepVolumeForm.validateFields()
            const entry: WorkStepVolumeCreate = {
              activity_id: selectedActivity!.activity_id,
              work_package: selectedActivity!.work_package,
              work_step_description: values.work_step_description,
              estimated_total: values.estimated_total,
            }
            createOrUpdateWorkStepVolumeMutation.mutate(entry)
          } catch (error) {
            // 表单验证失败（错误已通过message显示，不需要额外日志）
          }
        }}
        onCancel={() => {
          setWorkStepVolumeModalVisible(false)
          setEditingWorkStepVolume(null)
          workStepVolumeForm.resetFields()
        }}
        confirmLoading={createOrUpdateWorkStepVolumeMutation.isPending}
        okText="确定"
        cancelText="取消"
        width={500}
      >
        <Form form={workStepVolumeForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item
            name="work_step_description"
            label="工作步骤描述"
            rules={[{ required: true, message: '请选择工作步骤描述' }]}
            style={{ marginBottom: 16 }}
          >
            <Select 
              placeholder="选择工作步骤描述"
              showSearch
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={(nonKeyWorkSteps || []).map((ws: WorkStepDefine) => ({
                label: ws.work_step_description,
                value: ws.work_step_description,
              }))}
              disabled={!!editingWorkStepVolume} // 编辑时不允许修改工作步骤描述
            />
          </Form.Item>
          <Form.Item
            name="estimated_total"
            label="预估总量"
            style={{ marginBottom: 0 }}
          >
            <InputNumber 
              min={0} 
              precision={2} 
              style={{ width: '100%' }} 
              placeholder="请输入预估总量"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* VolumeControl编辑Modal */}
      <Modal
        title="编辑VolumeControl记录"
        open={volumeControlModalVisible}
        onOk={async () => {
          try {
            const values = await volumeControlForm.validateFields()
            const entry: Partial<VolumeControlCreate> = {
              ...values,
              estimated_total: values.estimated_total ?? undefined,
              drawing_approved_afc: values.drawing_approved_afc ?? undefined,
              material_arrived: values.material_arrived ?? undefined,
              available_workface: values.available_workface ?? undefined,
              workface_restricted_material: values.workface_restricted_material ?? undefined,
              workface_restricted_site: values.workface_restricted_site ?? undefined,
              rfi_completed_a: values.rfi_completed_a ?? undefined,
              rfi_completed_b: values.rfi_completed_b ?? undefined,
              rfi_completed_c: values.rfi_completed_c ?? undefined,
              asbuilt_signed_r0: values.asbuilt_signed_r0 ?? undefined,
              asbuilt_signed_r1: values.asbuilt_signed_r1 ?? undefined,
              obp_signed: values.obp_signed ?? undefined,
              earliest_start_date: values.earliest_start_date ? values.earliest_start_date.format('YYYY-MM-DD') : undefined,
              latest_update_date: values.latest_update_date ? values.latest_update_date.format('YYYY-MM-DD') : undefined,
              scope: values.scope || undefined,
              construction_responsible: values.construction_responsible || undefined,
              remarks: values.remarks || undefined,
              // 完成量使用从VFACTDB汇总的值
              construction_completed: calculatedCompleted,
            }
            if (editingVolumeControl) {
              updateVolumeControlMutation.mutate({ id: editingVolumeControl.id, entry })
            }
          } catch (error) {
            // 表单验证失败（错误已通过message显示，不需要额外日志）
          }
        }}
        onCancel={() => {
          setVolumeControlModalVisible(false)
          setEditingVolumeControl(null)
          volumeControlForm.resetFields()
        }}
        confirmLoading={updateVolumeControlMutation.isPending}
        okText="确定"
        cancelText="取消"
        width={800}
      >
        <Form form={volumeControlForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="estimated_total" label="预估总量">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="drawing_approved_afc" label="图纸批准量AFC">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="material_arrived" label="材料到货量">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="available_workface" label="现有可施工工作面">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="workface_restricted_material" label="工作面受限（材料）">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="workface_restricted_site" label="工作面受限（现场）">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item 
                name="construction_completed" 
                label="施工完成"
                tooltip="从VFACTDB日报自动汇总，保存时会自动更新"
              >
                <InputNumber 
                  min={0} 
                  step={0.01} 
                  style={{ width: '100%' }} 
                  disabled
                  addonAfter={`(从日报汇总: ${calculatedCompleted.toFixed(2)})`}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="rfi_completed_a" label="RFI验收完成量（A）">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="rfi_completed_b" label="RFI验收完成量（B）">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="rfi_completed_c" label="RFI验收完成量（C）">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="asbuilt_signed_r0" label="竣工资料签署量（R0）">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="asbuilt_signed_r1" label="竣工资料签署量（R1）">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="obp_signed" label="OBP签署量">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="earliest_start_date" label="最早开始日期">
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="latest_update_date" label="最晚更新日期">
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="scope" label="SCOPE">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="construction_responsible" label="施工部责任人">
                <Input />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="remarks" label="备注">
                <Input.TextArea rows={3} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* VolumeControl V2 编辑Modals */}
      
      {/* 工程量及完工信息编辑Modal */}
      <Modal
        title="编辑工程量及完工信息"
        open={quantityModalVisible}
        onOk={async () => {
          try {
            const values = await quantityForm.validateFields()
            const data: VolumeControlQuantityUpdate = {
              estimated_total: values.estimated_total ?? undefined,
              drawing_approved_afc: values.drawing_approved_afc ?? undefined,
              material_arrived: values.material_arrived ?? undefined,
              available_workface: values.available_workface ?? undefined,
              workface_restricted_material: values.workface_restricted_material ?? undefined,
              workface_restricted_site: values.workface_restricted_site ?? undefined,
              construction_completed: calculatedCompleted ?? undefined,
              responsible_user_id: values.responsible_user_id ?? undefined,
            }
            updateQuantityMutation.mutate({ activity_id: selectedActivity!.activity_id, data })
            setQuantityModalVisible(false)
            quantityForm.resetFields()
          } catch (error) {
            // 表单验证失败（错误已通过message显示，不需要额外日志）
          }
        }}
        onCancel={() => {
          setQuantityModalVisible(false)
          quantityForm.resetFields()
        }}
        confirmLoading={updateQuantityMutation.isPending}
        okText="确定"
        cancelText="取消"
        width={600}
      >
        <Form form={quantityForm} layout="vertical">
          <Form.Item name="estimated_total" label="预估总量">
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="drawing_approved_afc" label="图纸批准量AFC">
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="material_arrived" label="材料到货量">
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="available_workface" label="现有可施工工作面">
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="workface_restricted_material" label="工作面受限（材料）">
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="workface_restricted_site" label="工作面受限（现场）">
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="construction_completed" label="施工完成（从日报汇总）">
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} value={calculatedCompleted} disabled />
          </Form.Item>
          <Form.Item name="responsible_user_id" label="责任人（用户ID）">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 验收相关信息编辑Modal */}
      <Modal
        title="编辑验收相关信息"
        open={inspectionModalVisible}
        onOk={async () => {
          try {
            const values = await inspectionForm.validateFields()
            const data: VolumeControlInspectionUpdate = {
              rfi_completed_a: values.rfi_completed_a ?? undefined,
              rfi_completed_b: values.rfi_completed_b ?? undefined,
              rfi_completed_c: values.rfi_completed_c ?? undefined,
              responsible_user_id: values.responsible_user_id ?? undefined,
            }
            updateInspectionMutation.mutate({ activity_id: selectedActivity!.activity_id, data })
            setInspectionModalVisible(false)
            inspectionForm.resetFields()
          } catch (error) {
            // 表单验证失败（错误已通过message显示，不需要额外日志）
          }
        }}
        onCancel={() => {
          setInspectionModalVisible(false)
          inspectionForm.resetFields()
        }}
        confirmLoading={updateInspectionMutation.isPending}
        okText="确定"
        cancelText="取消"
        width={600}
      >
        <Form form={inspectionForm} layout="vertical">
          <Form.Item name="rfi_completed_a" label={rfiNames?.rfi_a_name || 'RFI验收完成量（A）'}>
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="rfi_completed_b" label={rfiNames?.rfi_b_name || 'RFI验收完成量（B）'}>
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="rfi_completed_c" label={rfiNames?.rfi_c_name || 'RFI验收完成量（C）'}>
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="responsible_user_id" label="责任人（用户ID）">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 竣工资料相关信息编辑Modal */}
      <Modal
        title="编辑竣工资料相关信息"
        open={asbuiltModalVisible}
        onOk={async () => {
          try {
            const values = await asbuiltForm.validateFields()
            const data: VolumeControlAsbuiltUpdate = {
              asbuilt_signed_r0: values.asbuilt_signed_r0 ?? undefined,
              asbuilt_signed_r1: values.asbuilt_signed_r1 ?? undefined,
              responsible_user_id: values.responsible_user_id ?? undefined,
            }
            updateAsbuiltMutation.mutate({ activity_id: selectedActivity!.activity_id, data })
            setAsbuiltModalVisible(false)
            asbuiltForm.resetFields()
          } catch (error) {
            // 表单验证失败（错误已通过message显示，不需要额外日志）
          }
        }}
        onCancel={() => {
          setAsbuiltModalVisible(false)
          asbuiltForm.resetFields()
        }}
        confirmLoading={updateAsbuiltMutation.isPending}
        okText="确定"
        cancelText="取消"
        width={600}
      >
        <Form form={asbuiltForm} layout="vertical">
          <Form.Item name="asbuilt_signed_r0" label="竣工资料签署量（R0）">
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="asbuilt_signed_r1" label="竣工资料签署量（R1）">
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="responsible_user_id" label="责任人（用户ID）">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 收款相关信息编辑Modal */}
      <Modal
        title="编辑收款相关信息"
        open={paymentModalVisible}
        onOk={async () => {
          try {
            const values = await paymentForm.validateFields()
            const data: VolumeControlPaymentUpdate = {
              obp_signed: values.obp_signed ?? undefined,
              responsible_user_id: values.responsible_user_id ?? undefined,
            }
            updatePaymentMutation.mutate({ activity_id: selectedActivity!.activity_id, data })
            setPaymentModalVisible(false)
            paymentForm.resetFields()
          } catch (error) {
            // 表单验证失败（错误已通过message显示，不需要额外日志）
          }
        }}
        onCancel={() => {
          setPaymentModalVisible(false)
          paymentForm.resetFields()
        }}
        confirmLoading={updatePaymentMutation.isPending}
        okText="确定"
        cancelText="取消"
        width={600}
      >
        <Form form={paymentForm} layout="vertical">
          <Form.Item name="obp_signed" label="OBP签署量">
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="responsible_user_id" label="责任人（用户ID）">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

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
            {AVAILABLE_COLUMNS.map(col => (
              <Col span={8} key={col.key} style={{ marginBottom: 8 }}>
                <Checkbox value={col.key}>{col.title}</Checkbox>
              </Col>
            ))}
          </Row>
        </Checkbox.Group>
      </Modal>

      {/* 颜色设置弹窗 */}
      <Modal
        title="任务层级颜色设置"
        open={colorSettingsVisible}
        onOk={() => {
          try {
            localStorage.setItem('gantt_task_colors', JSON.stringify(taskColors))
            messageApi.success('颜色配置已保存')
            setColorSettingsVisible(false)
          } catch (e) {
            logger.error('Failed to save task colors:', e)
            messageApi.error('保存颜色配置失败')
          }
        }}
        onCancel={() => setColorSettingsVisible(false)}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>P6经典配色方案</div>
            <Button 
              size="small" 
              onClick={() => {
                setTaskColors(DEFAULT_TASK_COLORS)
                messageApi.info('已恢复为P6经典配色')
              }}
            >
              恢复默认
            </Button>
          </div>
          <div>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>自定义颜色（P6官方9层级配色）</div>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>LEVEL 1（浅绿色）</div>
                <Input
                  type="color"
                  value={taskColors.level0}
                  onChange={(e) => setTaskColors({ ...taskColors, level0: e.target.value })}
                  style={{ width: '100%', height: 40 }}
                />
                <Input
                  value={taskColors.level0}
                  onChange={(e) => setTaskColors({ ...taskColors, level0: e.target.value })}
                  style={{ marginTop: 8 }}
                  placeholder="#80FF80"
                />
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>LEVEL 2（黄色）</div>
                <Input
                  type="color"
                  value={taskColors.level1}
                  onChange={(e) => setTaskColors({ ...taskColors, level1: e.target.value })}
                  style={{ width: '100%', height: 40 }}
                />
                <Input
                  value={taskColors.level1}
                  onChange={(e) => setTaskColors({ ...taskColors, level1: e.target.value })}
                  style={{ marginTop: 8 }}
                  placeholder="#FFFF00"
                />
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>LEVEL 3（蓝色）</div>
                <Input
                  type="color"
                  value={taskColors.level2}
                  onChange={(e) => setTaskColors({ ...taskColors, level2: e.target.value })}
                  style={{ width: '100%', height: 40 }}
                />
                <Input
                  value={taskColors.level2}
                  onChange={(e) => setTaskColors({ ...taskColors, level2: e.target.value })}
                  style={{ marginTop: 8 }}
                  placeholder="#0000FF"
                />
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>LEVEL 4（红色）</div>
                <Input
                  type="color"
                  value={taskColors.level3}
                  onChange={(e) => setTaskColors({ ...taskColors, level3: e.target.value })}
                  style={{ width: '100%', height: 40 }}
                />
                <Input
                  value={taskColors.level3}
                  onChange={(e) => setTaskColors({ ...taskColors, level3: e.target.value })}
                  style={{ marginTop: 8 }}
                  placeholder="#FF0000"
                />
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>LEVEL 5（青色）</div>
                <Input
                  type="color"
                  value={taskColors.level4}
                  onChange={(e) => setTaskColors({ ...taskColors, level4: e.target.value })}
                  style={{ width: '100%', height: 40 }}
                />
                <Input
                  value={taskColors.level4}
                  onChange={(e) => setTaskColors({ ...taskColors, level4: e.target.value })}
                  style={{ marginTop: 8 }}
                  placeholder="#80FFFF"
                />
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>LEVEL 6（洋红色）</div>
                <Input
                  type="color"
                  value={taskColors.level5}
                  onChange={(e) => setTaskColors({ ...taskColors, level5: e.target.value })}
                  style={{ width: '100%', height: 40 }}
                />
                <Input
                  value={taskColors.level5}
                  onChange={(e) => setTaskColors({ ...taskColors, level5: e.target.value })}
                  style={{ marginTop: 8 }}
                  placeholder="#FF80FF"
                />
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>LEVEL 7（浅黄色）</div>
                <Input
                  type="color"
                  value={taskColors.level6}
                  onChange={(e) => setTaskColors({ ...taskColors, level6: e.target.value })}
                  style={{ width: '100%', height: 40 }}
                />
                <Input
                  value={taskColors.level6}
                  onChange={(e) => setTaskColors({ ...taskColors, level6: e.target.value })}
                  style={{ marginTop: 8 }}
                  placeholder="#FFFF80"
                />
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>LEVEL 8（白色）</div>
                <Input
                  type="color"
                  value={taskColors.level7}
                  onChange={(e) => setTaskColors({ ...taskColors, level7: e.target.value })}
                  style={{ width: '100%', height: 40 }}
                />
                <Input
                  value={taskColors.level7}
                  onChange={(e) => setTaskColors({ ...taskColors, level7: e.target.value })}
                  style={{ marginTop: 8 }}
                  placeholder="#FFFFFF"
                />
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>LEVEL 9（浅灰色）</div>
                <Input
                  type="color"
                  value={taskColors.level8}
                  onChange={(e) => setTaskColors({ ...taskColors, level8: e.target.value })}
                  style={{ width: '100%', height: 40 }}
                />
                <Input
                  value={taskColors.level8}
                  onChange={(e) => setTaskColors({ ...taskColors, level8: e.target.value })}
                  style={{ marginTop: 8 }}
                  placeholder="#F0F0F0"
                />
              </Col>
            </Row>
          </div>
        </Space>
      </Modal>

      {/* 时间刻度配置弹窗 */}
      <Modal
        title="时间刻度"
        open={timescaleModalVisible}
        onOk={async () => {
          try {
            // 获取表单值
            const values = await timescaleForm.validateFields()
            // 确保所有必需的字段都有值
            const newConfig: TimescaleConfig = {
              format: values.format || timescaleConfig.format,
              primaryType: values.primaryType || timescaleConfig.primaryType,
              primaryInterval: values.primaryInterval || timescaleConfig.primaryInterval,
              secondaryInterval: values.secondaryInterval || timescaleConfig.secondaryInterval,
              showOrdinal: values.showOrdinal !== undefined ? values.showOrdinal : timescaleConfig.showOrdinal,
              ordinalInterval: values.ordinalInterval || timescaleConfig.ordinalInterval,
              zoomLevel: values.zoomLevel !== undefined ? values.zoomLevel : timescaleConfig.zoomLevel || 1.0,
              // 如果用户设置了日期，使用用户设置的；否则不设置，让系统自动计算
              startDate: values.startDate ? (typeof values.startDate === 'string' ? values.startDate : dayjs(values.startDate).format('YYYY-MM-DD')) : undefined,
              endDate: values.endDate ? (typeof values.endDate === 'string' ? values.endDate : dayjs(values.endDate).format('YYYY-MM-DD')) : undefined,
            }
            setTimescaleConfig(newConfig)
            setTimescaleModalVisible(false)
            messageApi.success('时间刻度配置已应用')
          } catch (error: any) {
            if (error.errorFields) {
              // 表单验证错误
              messageApi.error('请检查时间刻度配置')
            } else {
              logger.error('应用时间刻度配置错误:', error)
              messageApi.error('应用时间刻度配置失败')
            }
          }
        }}
        onCancel={() => setTimescaleModalVisible(false)}
        okText="确定"
        cancelText="取消"
        width={600}
      >
        <Form 
          form={timescaleForm} 
          layout="vertical" 
          initialValues={{
            ...timescaleConfig,
            startDate: timescaleConfig.startDate ? dayjs(timescaleConfig.startDate) : undefined,
            endDate: timescaleConfig.endDate ? dayjs(timescaleConfig.endDate) : undefined,
          }}
        >
          <Form.Item label="时间刻度格式">
            <Select
              value={timescaleConfig.format}
              onChange={(value) => {
                const newConfig = { ...timescaleConfig, format: value }
                // 如果是三行格式，设置默认的第二行间隔
                if (value === 'three' && !newConfig.secondaryInterval) {
                  if (newConfig.primaryInterval === 'year') {
                    newConfig.secondaryInterval = 'quarter'
                  } else if (newConfig.primaryInterval === 'quarter') {
                    newConfig.secondaryInterval = 'month'
                  } else if (newConfig.primaryInterval === 'month') {
                    newConfig.secondaryInterval = 'day'
                  } else {
                    newConfig.secondaryInterval = 'day'
                  }
                }
                setTimescaleConfig(newConfig)
              }}
            >
              <Option value="two">两行</Option>
              <Option value="three">三行</Option>
            </Select>
          </Form.Item>
          
          {timescaleConfig.format === 'three' && (
            <Form.Item label="第二行间隔">
              <Select
                value={timescaleConfig.secondaryInterval || 'day'}
                onChange={(value) => setTimescaleConfig({ ...timescaleConfig, secondaryInterval: value })}
              >
                <Option value="day">日</Option>
                <Option value="week">周</Option>
                <Option value="month">月</Option>
                <Option value="quarter">季度</Option>
                <Option value="year">年</Option>
              </Select>
            </Form.Item>
          )}

          <Divider />

          <Form.Item label="时间范围">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Form.Item 
                label="开始日期" 
                name="startDate"
                tooltip="留空则根据任务日期自动计算"
              >
                <DatePicker
                  style={{ width: '100%' }}
                  format="YYYY-MM-DD"
                  placeholder="自动计算（根据任务日期）"
                />
              </Form.Item>
              <Form.Item 
                label="结束日期" 
                name="endDate"
                tooltip="留空则根据任务日期自动计算"
              >
                <DatePicker
                  style={{ width: '100%' }}
                  format="YYYY-MM-DD"
                  placeholder="自动计算（根据任务日期）"
                />
              </Form.Item>
              <div style={{ fontSize: 12, color: '#666', marginTop: -8 }}>
                提示：如果留空开始日期和结束日期，系统将根据所有任务的日期范围自动计算
              </div>
            </Space>
          </Form.Item>

          <Divider />

          <Form.Item label="显示主要日期">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <span style={{ marginRight: 8 }}>类型：</span>
                <Select
                  value={timescaleConfig.primaryType}
                  onChange={(value) => setTimescaleConfig({ ...timescaleConfig, primaryType: value })}
                  style={{ width: 150 }}
                >
                  <Option value="calendar">日历</Option>
                  <Option value="ordinal">序数</Option>
                </Select>
              </div>
              <div>
                <span style={{ marginRight: 8 }}>日期间隔：</span>
                <Select
                  value={timescaleConfig.primaryInterval}
                  onChange={(value) => setTimescaleConfig({ ...timescaleConfig, primaryInterval: value })}
                  style={{ width: 150 }}
                >
                  <Option value="day">日</Option>
                  <Option value="week">周</Option>
                  <Option value="month">月</Option>
                  <Option value="quarter">季度</Option>
                  <Option value="year">年</Option>
                </Select>
              </div>
            </Space>
          </Form.Item>

          <Divider />

          <Form.Item label="显示序数日期">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Checkbox
                checked={timescaleConfig.showOrdinal}
                onChange={(e) => setTimescaleConfig({ ...timescaleConfig, showOrdinal: e.target.checked })}
              >
                显示序数日期
              </Checkbox>
              {timescaleConfig.showOrdinal && (
                <div style={{ marginLeft: 24 }}>
                  <span style={{ marginRight: 8 }}>序数日期间隔：</span>
                  <Select
                    value={timescaleConfig.ordinalInterval}
                    onChange={(value) => setTimescaleConfig({ ...timescaleConfig, ordinalInterval: value })}
                    style={{ width: 150 }}
                  >
                    <Option value="day">日</Option>
                    <Option value="week">周</Option>
                    <Option value="month">月</Option>
                    <Option value="quarter">季度</Option>
                    <Option value="year">年</Option>
                  </Select>
                </div>
              )}
            </Space>
          </Form.Item>
          </Form>
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
            renderItem={(view) => (
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

      <BulkCloseModal
        visible={bulkCloseModalVisible}
        onCancel={() => setBulkCloseModalVisible(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['activities-advanced'] })
          queryClient.invalidateQueries({ queryKey: ['activities'] })
        }}
        filters={filters}
      />
    </div>
  )
}

export default ActivityListAdvanced

