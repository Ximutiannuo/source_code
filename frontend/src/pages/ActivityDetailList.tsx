import { useState, useEffect, useRef, useMemo } from 'react'
import { 
  Table, 
  Card, 
  Row, 
  Col, 
  Select, 
  DatePicker, 
  Space, 
  Button, 
  Input,
  App,
  Drawer,
  Descriptions,
  Tag,
  Divider,
  Modal,
  Checkbox,
  Tabs,
  Form,
  InputNumber,
  Popconfirm
} from 'antd'
import { formatQuantity, formatHighPrecisionValue } from '../utils/formatNumber'
import { SearchOutlined, ReloadOutlined, SettingOutlined, EyeOutlined, UpOutlined, DownOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useLocation } from 'react-router-dom'

const CheckboxGroup = Checkbox.Group
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import dayjs, { Dayjs } from 'dayjs'
import { 
  activityDetailService, 
  type ActivityDetail,
  type ActivityDetailFilters,
} from '../services/activityDetailService'
import { useFacilityFilter } from '../hooks/useFacilityFilter'
import { reportService } from '../services/reportService'
import type { MPDBEntry, VFACTDBEntry, MPDBResponse, VFACTDBResponse } from '../types/report'
import { 
  workstepService, 
  workstepVolumeService, 
  type WorkStepDefine,
  type WorkStepVolume,
  type WorkStepVolumeCreate,
} from '../services/workstepService'

const { RangePicker } = DatePicker
const { Option } = Select

const ActivityDetailList = () => {
  const { message } = App.useApp()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<ActivityDetailFilters>({
    skip: 0,
    limit: 10000, // 每次从数据库获取10000条
  })
  const [pagination, setPagination] = useState({ current: 1, pageSize: 100 })
  const [searchText, setSearchText] = useState('')
  const [allData, setAllData] = useState<ActivityDetail[]>([]) // 存储所有已加载的数据
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true) // 是否还有更多数据
  const [selectedRow, setSelectedRow] = useState<ActivityDetail | null>(null) // 选中的行（用于详情抽屉）
  const [drawerVisible, setDrawerVisible] = useState(false) // 详情抽屉是否显示
  const [columnModalVisible, setColumnModalVisible] = useState(false) // 列设置弹窗是否显示
  const [detailTab, setDetailTab] = useState('general') // 详情Tab
  const [mpdbModalVisible, setMpdbModalVisible] = useState(false) // MPDB编辑Modal
  const [vfactdbModalVisible, setVfactdbModalVisible] = useState(false) // VFACTDB编辑Modal
  const [editingMpdb, setEditingMpdb] = useState<MPDBResponse | null>(null) // 正在编辑的MPDB
  const [editingVfactdb, setEditingVfactdb] = useState<VFACTDBResponse | null>(null) // 正在编辑的VFACTDB
  const [editingWorkStepVolume, setEditingWorkStepVolume] = useState<WorkStepVolume | null>(null) // 正在编辑的非关键工程量
  const [workStepVolumeModalVisible, setWorkStepVolumeModalVisible] = useState(false) // 非关键工程量编辑Modal
  const [mpdbForm] = Form.useForm()
  const [vfactdbForm] = Form.useForm()
  const [workStepVolumeForm] = Form.useForm()
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set([
    'wbs_code', 'activity_id', 'project', 'subproject', 'implement_phase', 'train', 'unit', 'block',
    'title', 'discipline', 'work_package', 'scope', 'key_qty', 'calculated_mhrs',
    'actual_start_date', 'actual_finish_date', 'completed', 'actual_manhour', 'weight_factor', 'actual_weight_factor'
  ])) // 默认显示的列
  const [tempVisibleColumns, setTempVisibleColumns] = useState<string[]>([]) // 临时选择的列（用于弹窗）
  const [filterCollapsed, setFilterCollapsed] = useState(true) // 筛选器是否折叠
  const [tableHeight, setTableHeight] = useState<number>(500) // 表格高度（初始值）
  const tableContainerRef = useRef<HTMLDivElement>(null) // 表格容器引用

  // 使用级联筛选器
  // 注意：facilities选项现在从filterOptions获取（根据scope动态过滤）
  const { filterState, updateFilter, resetFilter } = useFacilityFilter()

  // 获取scope选项和facilities选项（根据scope动态获取）
  const { data: filterOptions } = useQuery({
    queryKey: ['activity-detail-filters', filters.scope],
    queryFn: () => activityDetailService.getFilterOptions(filters.scope),
    retry: 1,
  })
  
  // 使用filterOptions中的facilities数据（根据scope动态更新）
  const facilitiesOptions = filterOptions ? {
    projects: filterOptions.projects || [],
    subproject_codes: filterOptions.subproject_codes || [],
    trains: filterOptions.trains || [],
    units: filterOptions.units || [],
    blocks: filterOptions.blocks || [],
    main_blocks: filterOptions.main_blocks || [],
    simple_blocks: filterOptions.simple_blocks || [],
    quarters: filterOptions.quarters || [],
  } : {
    projects: [],
    subproject_codes: [],
    trains: [],
    units: [],
    blocks: [],
    main_blocks: [],
    simple_blocks: [],
    quarters: [],
  }

  // 同步级联筛选器状态到查询过滤器（将数组转换为字符串，多个值用逗号分隔）
  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      project: Array.isArray(filterState.project) 
        ? filterState.project.length > 0 ? filterState.project.join(',') : undefined
        : filterState.project,
      subproject: Array.isArray(filterState.subproject) 
        ? filterState.subproject.length > 0 ? filterState.subproject.join(',') : undefined
        : filterState.subproject,
      train: Array.isArray(filterState.train) 
        ? filterState.train.length > 0 ? filterState.train.join(',') : undefined
        : filterState.train,
      unit: Array.isArray(filterState.unit) 
        ? filterState.unit.length > 0 ? filterState.unit.join(',') : undefined
        : filterState.unit,
      block: Array.isArray(filterState.block) 
        ? filterState.block.length > 0 ? filterState.block.join(',') : undefined
        : filterState.block,
      main_block: Array.isArray(filterState.main_block) 
        ? filterState.main_block.length > 0 ? filterState.main_block.join(',') : undefined
        : filterState.main_block,
    }))
    setPagination(prev => ({ ...prev, current: 1 }))
  }, [filterState])
  
  // 从filterOptions中提取scope选项（用于scope筛选器）
  const scopeOptions = filterOptions ? { scopes: filterOptions.scopes } : undefined

  // 使用 useMemo 序列化 filters，确保 queryKey 正确变化
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters])

  // 获取作业清单数据（使用数据库分页）
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['activity-details', filtersKey],
    queryFn: () => activityDetailService.getActivityDetails(filters),
    retry: 1,
    enabled: true, // 确保查询始终启用
    refetchOnMount: 'always', // 组件挂载时总是重新获取数据
    refetchOnWindowFocus: false, // 窗口聚焦时不重新获取（避免不必要的请求）
    staleTime: 0, // 数据立即过期，确保总是重新获取
    gcTime: 0, // 立即垃圾回收，不使用缓存
  })

  // 当路由变化时（从仪表盘导航过来），重置状态并触发数据加载
  useEffect(() => {
    if (location.pathname === '/activity-details') {
      // 重置数据状态
      setAllData([])
      setHasMore(true)
      setIsLoadingMore(false)
      setPagination({ current: 1, pageSize: 100 })
      // 重置filters，确保skip为0
      const resetFilters: ActivityDetailFilters = {
        skip: 0,
        limit: 10000,
      }
      setFilters(resetFilters)
      // 清除所有相关查询的缓存
      queryClient.removeQueries({ queryKey: ['activity-details'] })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, queryClient])

  // 当新数据加载完成时，合并到allData
  useEffect(() => {
    if (data && data.length > 0) {
      setAllData(prev => {
        // 如果skip为0，说明是新查询，重置数据
        if (filters.skip === 0) {
          return data
        }
        // 否则追加数据（去重，基于act_id）
        const existingIds = new Set(prev.map(item => item.activity_id))
        const newItems = data.filter(item => !existingIds.has(item.activity_id))
        return [...prev, ...newItems]
      })
      // 如果返回的数据少于limit，说明没有更多数据了
      if (data.length < (filters.limit || 10000)) {
        setHasMore(false)
      } else {
        setHasMore(true)
      }
      setIsLoadingMore(false)
    } else if (data && data.length === 0 && filters.skip === 0) {
      // 如果第一次查询返回空，清空数据
      setAllData([])
      setHasMore(false)
    }
  }, [data, filters.skip, filters.limit])

  // 当筛选条件改变时，重置数据
  useEffect(() => {
    setAllData([])
    setHasMore(true)
    setFilters(prev => ({ ...prev, skip: 0 }))
  }, [
    filterState.project,
    filterState.subproject,
    filterState.train,
    filterState.unit,
    filterState.block,
    filterState.main_block,
    filters.scope,
    filters.start_date,
    filters.end_date,
  ])

  // 错误处理
  useEffect(() => {
    if (error) {
      message.error('获取数据失败，请检查后端服务')
    }
  }, [error, message])

  // 获取MPDB数据
  const { data: mpdbDataResponse, refetch: refetchMpdb } = useQuery({
    queryKey: ['mpdb', selectedRow?.activity_id],
    queryFn: () => reportService.getMPDB({ activity_id: selectedRow?.activity_id }),
    enabled: !!selectedRow?.activity_id && drawerVisible && detailTab === 'mpdb',
  })

  // 获取VFACTDB数据
  const { data: vfactdbDataResponse, refetch: refetchVfactdb } = useQuery({
    queryKey: ['vfactdb', selectedRow?.activity_id],
    queryFn: () => reportService.getVFACTDB({ activity_id: selectedRow?.activity_id }),
    enabled: !!selectedRow?.activity_id && drawerVisible && detailTab === 'vfactdb',
  })

  // 获取非关键工作步骤定义（用于下拉选择）
  const { data: nonKeyWorkSteps } = useQuery({
    queryKey: ['non-key-worksteps', selectedRow?.work_package],
    queryFn: () => workstepService.getWorkStepDefines({
      work_package: selectedRow?.work_package,
      is_key_quantity: false,
      is_active: true,
    }),
    enabled: !!selectedRow?.work_package && drawerVisible && detailTab === 'non-key-volumes',
  })

  // 获取非关键工程量（预估总量）数据
  const { data: workStepVolumesData, refetch: refetchWorkStepVolumes } = useQuery({
    queryKey: ['workstep-volumes', selectedRow?.activity_id],
    queryFn: () => workstepVolumeService.getWorkStepVolumes({
      activity_id: selectedRow?.activity_id,
    }),
    enabled: !!selectedRow?.activity_id && drawerVisible && detailTab === 'non-key-volumes',
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

  // MPDB增删改查mutations
  const createMpdbMutation = useMutation({
    mutationFn: (entry: MPDBEntry) => reportService.createMPDB(entry),
    onSuccess: () => {
      message.success('MPDB记录创建成功')
      setMpdbModalVisible(false)
      mpdbForm.resetFields()
      refetchMpdb()
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.detail || '创建失败')
    },
  })

  const updateMpdbMutation = useMutation({
    mutationFn: ({ id, entry }: { id: number; entry: MPDBEntry }) => reportService.updateMPDB(id, entry),
    onSuccess: () => {
      message.success('MPDB记录更新成功')
      setMpdbModalVisible(false)
      setEditingMpdb(null)
      mpdbForm.resetFields()
      refetchMpdb()
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.detail || '更新失败')
    },
  })

  const deleteMpdbMutation = useMutation({
    mutationFn: (id: number) => reportService.deleteMPDB(id),
    onSuccess: () => {
      message.success('MPDB记录删除成功')
      refetchMpdb()
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.detail || '删除失败')
    },
  })

  // VFACTDB增删改查mutations
  const createVfactdbMutation = useMutation({
    mutationFn: (entry: VFACTDBEntry) => reportService.createVFACTDB(entry),
    onSuccess: () => {
      message.success('VFACTDB记录创建成功')
      setVfactdbModalVisible(false)
      vfactdbForm.resetFields()
      refetchVfactdb()
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.detail || '创建失败')
    },
  })

  const updateVfactdbMutation = useMutation({
    mutationFn: ({ id, entry }: { id: number; entry: VFACTDBEntry }) => reportService.updateVFACTDB(id, entry),
    onSuccess: () => {
      message.success('VFACTDB记录更新成功')
      setVfactdbModalVisible(false)
      setEditingVfactdb(null)
      vfactdbForm.resetFields()
      refetchVfactdb()
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.detail || '更新失败')
    },
  })

  const deleteVfactdbMutation = useMutation({
    mutationFn: (id: number) => reportService.deleteVFACTDB(id),
    onSuccess: () => {
      message.success('VFACTDB记录删除成功')
      refetchVfactdb()
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.detail || '删除失败')
    },
  })

  // WorkStepVolume增删改查mutations
  const createOrUpdateWorkStepVolumeMutation = useMutation({
    mutationFn: (entry: WorkStepVolumeCreate) => {
      if (editingWorkStepVolume && editingWorkStepVolume.id) {
        return workstepVolumeService.updateWorkStepVolume(editingWorkStepVolume.id, entry)
      } else {
        return workstepVolumeService.createOrUpdateWorkStepVolume(entry)
      }
    },
    onSuccess: () => {
      message.success(editingWorkStepVolume ? '非关键工程量更新成功' : '非关键工程量创建成功')
      setWorkStepVolumeModalVisible(false)
      setEditingWorkStepVolume(null)
      workStepVolumeForm.resetFields()
      refetchWorkStepVolumes()
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.detail || '操作失败')
    },
  })

  const deleteWorkStepVolumeMutation = useMutation({
    mutationFn: (id: number) => workstepVolumeService.deleteWorkStepVolume(id),
    onSuccess: () => {
      message.success('非关键工程量删除成功')
      refetchWorkStepVolumes()
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.detail || '删除失败')
    },
  })

  // 处理MPDB表单提交
  const handleMpdbSubmit = async () => {
    try {
      const values = await mpdbForm.validateFields()
      const entry: MPDBEntry = {
        ...values,
        date: values.date.format('YYYY-MM-DD'),
        activity_id: selectedRow!.activity_id,
        scope: selectedRow!.scope,
        project: selectedRow!.project,
        subproject: selectedRow!.subproject,
        implement_phase: selectedRow!.implement_phase,
        train: selectedRow!.train,
        unit: selectedRow!.unit,
        block: selectedRow!.block,
        quarter: selectedRow!.quarter,
        main_block: selectedRow!.main_block,
        title: selectedRow!.title,
        discipline: selectedRow!.discipline,
        work_package: selectedRow!.work_package,
      }
      if (editingMpdb) {
        updateMpdbMutation.mutate({ id: editingMpdb.id, entry })
      } else {
        createMpdbMutation.mutate(entry)
      }
    } catch (error) {
      // 表单验证失败（错误已通过message显示，不需要额外日志）
    }
  }

  // 处理VFACTDB表单提交
  const handleVfactdbSubmit = async () => {
    try {
      const values = await vfactdbForm.validateFields()
      const entry: VFACTDBEntry = {
        ...values,
        date: values.date.format('YYYY-MM-DD'),
        activity_id: selectedRow!.activity_id,
        scope: selectedRow!.scope,
        project: selectedRow!.project,
        subproject: selectedRow!.subproject,
        implement_phase: selectedRow!.implement_phase,
        train: selectedRow!.train,
        unit: selectedRow!.unit,
        block: selectedRow!.block,
        quarter: selectedRow!.quarter,
        main_block: selectedRow!.main_block,
        title: selectedRow!.title,
        discipline: selectedRow!.discipline,
        work_package: selectedRow!.work_package,
      }
      if (editingVfactdb) {
        updateVfactdbMutation.mutate({ id: editingVfactdb.id, entry })
      } else {
        createVfactdbMutation.mutate(entry)
      }
    } catch (error) {
      // 表单验证失败（错误已通过message显示，不需要额外日志）
    }
  }

  // 打开MPDB编辑Modal
  const handleEditMpdb = (record: MPDBResponse) => {
    setEditingMpdb(record)
    mpdbForm.setFieldsValue({
      date: dayjs(record.date),
      typeof_mp: record.typeof_mp,
      manpower: record.manpower,
      machinery: record.machinery || 0,
      remarks: record.remarks,
    })
    setMpdbModalVisible(true)
  }

  // 打开VFACTDB编辑Modal
  const handleEditVfactdb = (record: VFACTDBResponse) => {
    setEditingVfactdb(record)
    vfactdbForm.setFieldsValue({
      date: dayjs(record.date),
      work_step_description: record.work_step_description,
      achieved: formatHighPrecisionValue(record.achieved),
    })
    setVfactdbModalVisible(true)
  }

  // 打开新增MPDB Modal
  const handleAddMpdb = () => {
    setEditingMpdb(null)
    mpdbForm.resetFields()
    mpdbForm.setFieldsValue({
      date: dayjs(),
      manpower: 0,
      machinery: 0,
    })
    setMpdbModalVisible(true)
  }

  // 打开新增VFACTDB Modal
  const handleAddVfactdb = () => {
    setEditingVfactdb(null)
    vfactdbForm.resetFields()
    vfactdbForm.setFieldsValue({
      date: dayjs(),
      achieved: 0,
    })
    setVfactdbModalVisible(true)
  }

  // 打开新增/编辑非关键工程量 Modal
  const handleAddWorkStepVolume = () => {
    setEditingWorkStepVolume(null)
    workStepVolumeForm.resetFields()
    workStepVolumeForm.setFieldsValue({
      work_step_description: undefined,
      estimated_total: undefined,
    })
    setWorkStepVolumeModalVisible(true)
  }

  const handleEditWorkStepVolume = (record: WorkStepVolume) => {
    setEditingWorkStepVolume(record)
    workStepVolumeForm.setFieldsValue({
      work_step_description: record.work_step_description,
      estimated_total: record.estimated_total,
    })
    setWorkStepVolumeModalVisible(true)
  }

  // 处理非关键工程量表单提交
  const handleWorkStepVolumeSubmit = async () => {
    try {
      const values = await workStepVolumeForm.validateFields()
      const entry: WorkStepVolumeCreate = {
        activity_id: selectedRow!.activity_id,
        work_package: selectedRow!.work_package,
        work_step_description: values.work_step_description,
        estimated_total: values.estimated_total,
      }
      createOrUpdateWorkStepVolumeMutation.mutate(entry)
    } catch (error) {
      // 表单验证失败（错误已通过message显示，不需要额外日志）
    }
  }

  // 处理筛选器变化
  const handleFilterChange = (key: keyof ActivityDetailFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
    }))
    setPagination(prev => ({ ...prev, current: 1 }))
  }

  // 处理时间范围筛选
  const handleDateRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      handleFilterChange('start_date', dates[0].format('YYYY-MM-DD'))
      handleFilterChange('end_date', dates[1].format('YYYY-MM-DD'))
    } else {
      handleFilterChange('start_date', undefined)
      handleFilterChange('end_date', undefined)
    }
  }

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchText(value)
  }

  // 加载更多数据
  const loadMoreData = async () => {
    if (isLoadingMore || !hasMore) return
    
    setIsLoadingMore(true)
    const nextSkip = allData.length
    setFilters(prev => ({
      ...prev,
      skip: nextSkip,
    }))
  }

  // 应用搜索过滤（对所有已加载的数据进行过滤）
  const filteredData = allData.filter(item => {
    if (!searchText) return true
    const searchLower = searchText.toLowerCase()
    return (
      item.activity_id?.toLowerCase().includes(searchLower) ||
      item.title?.toLowerCase().includes(searchLower) ||
      item.wbs_code?.toLowerCase().includes(searchLower)
    )
  })
  
  // 前端分页处理（对所有已加载的数据进行分页）
  const paginatedData = filteredData.slice(
    (pagination.current - 1) * pagination.pageSize,
    pagination.current * pagination.pageSize
  )

  // 使用 CSS calc 直接计算表格高度，展开/收起筛选器时底部空白保持不变
  useEffect(() => {
    const calculateHeight = () => {
      // 基于视口高度直接计算，立即生效，不等待渲染
      const viewportHeight = window.innerHeight
      
      // 固定元素高度（精确计算）
      const headerHeight = 64
      const contentPadding = 48
      const titleCardHeight = 26 // 标题区域
      const filterCollapsedHeight = 24 // 筛选器折叠时的高度
      const filterExpandedHeight = 180 // 筛选器展开时的高度
      const tableCardPadding = 4 // 表格 Card 的 padding (2px * 2)
      const tableHeaderHeight = 39
      const paginationHeight = 44 // 分页器高度（确保可见）
      const extraCompensation = 20 // 补偿值，消除几十px的差异（减少补偿，确保分页器可见）
      
      // 计算基准固定高度（使用筛选器折叠高度，确保底部空白不变）
      const baseFixedHeight = headerHeight + contentPadding + titleCardHeight + filterCollapsedHeight + tableCardPadding + tableHeaderHeight + paginationHeight - extraCompensation
      
      // 计算表格内容区域高度
      // 当筛选器展开时，表格高度减少（筛选器展开高度 - 筛选器折叠高度）
      // 这样底部空白保持不变
      const filterHeightDiff = filterCollapsed ? 0 : (filterExpandedHeight - filterCollapsedHeight)
      const calculatedHeight = viewportHeight - baseFixedHeight - filterHeightDiff
      
      // 确保分页器可见：表格高度不能太大，必须为分页器留出空间
      const finalHeight = Math.max(150, Math.min(calculatedHeight, viewportHeight - baseFixedHeight - filterHeightDiff - 10))
      setTableHeight(finalHeight)
    }
    
    // 立即计算
    calculateHeight()
    
    // 只监听窗口大小变化
    window.addEventListener('resize', calculateHeight)

    return () => {
      window.removeEventListener('resize', calculateHeight)
    }
  }, [filterCollapsed]) // 只在筛选器状态改变时重新计算

  // 检测是否需要自动加载更多数据（当翻页到接近末尾时）
  useEffect(() => {
    const currentPageEnd = pagination.current * pagination.pageSize
    const loadedCount = filteredData.length
    // 如果当前页接近已加载数据的末尾（80%），且还有更多数据，自动加载
    if (currentPageEnd >= loadedCount * 0.8 && hasMore && !isLoadingMore && !isLoading && loadedCount > 0) {
      loadMoreData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.current, pagination.pageSize, filteredData.length, hasMore, isLoadingMore, isLoading])

  // 所有列定义（完整列表）
  const allColumns: ColumnsType<ActivityDetail> = [
    {
      title: 'WBS Code',
      dataIndex: 'wbs_code',
      key: 'wbs_code',
      width: 120,
      fixed: 'left' as const,
    },
    {
      title: 'ACT ID',
      dataIndex: 'activity_id',
      key: 'activity_id',
      width: 150,
      fixed: 'left' as const,
    },
    {
      title: 'Project',
      dataIndex: 'project',
      key: 'project',
      width: 120,
    },
    {
      title: 'Sub-Project CODE',
      dataIndex: 'subproject',
      key: 'subproject',
      width: 150,
    },
    {
      title: 'Phase',
      dataIndex: 'implement_phase',
      key: 'implement_phase',
      width: 100,
    },
    {
      title: 'Train',
      dataIndex: 'train',
      key: 'train',
      width: 100,
    },
    {
      title: 'Unit',
      dataIndex: 'unit',
      key: 'unit',
      width: 100,
    },
    {
      title: 'Block',
      dataIndex: 'block',
      key: 'block',
      width: 120,
    },
    {
      title: 'Quarter',
      dataIndex: 'quarter',
      key: 'quarter',
      width: 120,
    },
    {
      title: 'Main_Block',
      dataIndex: 'main_block',
      key: 'main_block',
      width: 120,
    },
    {
      title: 'TITLE',
      dataIndex: 'title',
      key: 'title',
      width: 250,
      ellipsis: true,
    },
    {
      title: 'Disp.',
      dataIndex: 'discipline',
      key: 'discipline',
      width: 100,
    },
    {
      title: 'Work Package',
      dataIndex: 'work_package',
      key: 'work_package',
      width: 120,
    },
    {
      title: 'SCOPE',
      dataIndex: 'scope',
      key: 'scope',
      width: 100,
    },
    {
      title: 'Simple Block',
      dataIndex: 'simple_block',
      key: 'simple_block',
      width: 120,
    },
    {
      title: '!BCC_START-UP SEQUENCE',
      dataIndex: 'start_up_sequence',
      key: 'start_up_sequence',
      width: 180,
    },
    {
      title: 'UoM',
      dataIndex: 'uom',
      key: 'uom',
      width: 80,
    },
    {
      title: '!BCC_DISCIPLINE',
      dataIndex: 'discipline',
      key: 'bcc_discipline',
      width: 120,
    },
    {
      title: '!BCC_WORK PACKAGE',
      dataIndex: 'contract_phase',
      key: 'contract_phase',
      width: 150,
    },
    {
      title: 'KEY QTY',
      dataIndex: 'key_qty',
      key: 'key_qty',
      width: 120,
      align: 'right' as const,
      render: (value: number) => formatQuantity(value, 3, '-'),
    },
    {
      title: 'Calculated MHrs',
      dataIndex: 'calculated_mhrs',
      key: 'calculated_mhrs',
      width: 150,
      align: 'right' as const,
      render: (value: number) => formatQuantity(value, 3, '-'),
    },
    {
      title: 'Resource ID',
      dataIndex: 'resource_id',
      key: 'resource_id',
      width: 120,
    },
    {
      title: 'SPE MHrs',
      dataIndex: 'spe_mhrs',
      key: 'spe_mhrs',
      width: 120,
      align: 'right' as const,
      render: (value: number) => formatQuantity(value, 3, '-'),
    },
    {
      title: '%',
      key: 'percentage',
      width: 80,
      align: 'right' as const,
      render: (_: any, record: ActivityDetail) => {
        if (record.key_qty && record.completed) {
          return ((record.completed / record.key_qty) * 100).toFixed(2) + '%'
        }
        return '-'
      },
    },
    {
      title: 'W.F',
      dataIndex: 'weight_factor',
      key: 'weight_factor',
      width: 100,
      align: 'right' as const,
      render: (value: number) => formatQuantity(value, 3, '-'),
    },
    {
      title: 'Actual W.F',
      dataIndex: 'actual_weight_factor',
      key: 'actual_weight_factor',
      width: 100,
      align: 'right' as const,
      render: (value: number) => formatQuantity(value, 3, '-'),
    },
    {
      title: 'Baseline1 Start Date',
      dataIndex: 'baseline1_start_date',
      key: 'baseline1_start_date',
      width: 120,
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
    {
      title: 'Baseline1 Finish Date',
      dataIndex: 'baseline1_finish_date',
      key: 'baseline1_finish_date',
      width: 120,
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
    {
      title: 'Planned Duration',
      dataIndex: 'planned_duration',
      key: 'planned_duration',
      width: 100,
      align: 'right' as const,
      render: (value: number) => value || '-',
    },
    {
      title: 'Forecast_Start',
      dataIndex: 'forecast_start',
      key: 'forecast_start',
      width: 120,
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
    {
      title: 'Forecast_Finish',
      dataIndex: 'forecast_finish',
      key: 'forecast_finish',
      width: 120,
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
    {
      title: 'At Completion Duration',
      dataIndex: 'at_completion_duration',
      key: 'at_completion_duration',
      width: 180,
      align: 'right' as const,
      render: (value: number) => value || '-',
    },
    {
      title: 'Actual Start Date',
      dataIndex: 'actual_start_date',
      key: 'actual_start_date',
      width: 120,
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
    {
      title: 'Actual Finish Date',
      dataIndex: 'actual_finish_date',
      key: 'actual_finish_date',
      width: 120,
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
    {
      title: 'Actual Duration',
      dataIndex: 'actual_duration',
      key: 'actual_duration',
      width: 130,
      align: 'right' as const,
      render: (value: number) => value || '-',
    },
    {
      title: 'Completed',
      dataIndex: 'completed',
      key: 'completed',
      width: 120,
      align: 'right' as const,
      render: (value: number) => formatQuantity(value, 3, '-'),
    },
    {
      title: 'Actual Manhour',
      dataIndex: 'actual_manhour',
      key: 'actual_manhour',
      width: 140,
      align: 'right' as const,
      render: (value: number) => formatQuantity(value, 3, '-'),
    },
    {
      title: 'Actual Weight',
      dataIndex: 'actual_weight',
      key: 'actual_weight',
      width: 130,
      align: 'right' as const,
      render: (value: number) => formatQuantity(value, 3, '-'),
    },
    {
      title: 'Act Status',
      dataIndex: 'act_status',
      key: 'act_status',
      width: 120,
    },
    {
      title: 'Current Budgeted WF.',
      dataIndex: 'current_budgeted_wf',
      key: 'current_budgeted_wf',
      width: 180,
      align: 'right' as const,
      render: (value: number) => formatQuantity(value, 3, '-'),
    },
    {
      title: 'Current Budgeted MH.',
      dataIndex: 'current_budgeted_mh',
      key: 'current_budgeted_mh',
      width: 180,
      align: 'right' as const,
      render: (value: number) => formatQuantity(value, 3, '-'),
    },
    {
      title: 'Current Budgeted Vol.',
      dataIndex: 'current_budgeted_vol',
      key: 'current_budgeted_vol',
      width: 180,
      align: 'right' as const,
      render: (value: number) => formatQuantity(value, 3, '-'),
    },
    {
      title: 'Current Forecast WF.',
      dataIndex: 'current_forecast_wf',
      key: 'current_forecast_wf',
      width: 180,
      align: 'right' as const,
      render: (value: number) => formatQuantity(value, 3, '-'),
    },
    {
      title: 'Current Forecast MH.',
      dataIndex: 'current_forecast_mh',
      key: 'current_forecast_mh',
      width: 180,
      align: 'right' as const,
      render: (value: number) => formatQuantity(value, 3, '-'),
    },
    {
      title: 'Current Forecast Vol.',
      dataIndex: 'current_forecast_vol',
      key: 'current_forecast_vol',
      width: 180,
      align: 'right' as const,
      render: (value: number) => formatQuantity(value, 3, '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right' as const,
      render: (_: any, record: ActivityDetail) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={(e) => {
            e.stopPropagation()
            setSelectedRow(record)
            setDrawerVisible(true)
          }}
        >
          详情
        </Button>
      ),
    },
  ]

  // 根据visibleColumns过滤显示的列（默认只显示核心列）
  const displayColumns = allColumns.filter(col => {
    if (col.key === 'action') return true // 操作列始终显示
    return visibleColumns.has(col.key as string)
  })

  // 如果数据加载失败，显示错误信息
  if (error && !isLoading) {
    return (
      <Card
        style={{
          background: '#ffffff',
          borderRadius: 4,
          border: '1px solid #e0e0e0',
        }}
        styles={{ body: { padding: '16px' } }}
      >
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: '#ff4d4f', marginBottom: 16 }}>
            数据加载失败，请检查后端服务是否正常运行
          </p>
          <p style={{ fontSize: 12, color: '#999', marginBottom: 16 }}>
            {error instanceof Error ? error.message : '未知错误'}
          </p>
          <Button type="primary" onClick={() => refetch()}>
            重试
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div style={{ 
      height: 'calc(100vh - 64px - 48px)', // 减去 Header(64px) 和 Content padding(24px * 2)
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden',
      background: '#f0f2f5',
      margin: '-24px', // 抵消 MainLayout Content 的 padding
      padding: 0,
      boxSizing: 'border-box'
    }}>
    <Card
      style={{
        background: '#ffffff',
        borderRadius: 4,
        border: '1px solid #e0e0e0',
        flexShrink: 0,
      }}
      styles={{ body: { padding: '2px 6px' } }}
    >
      <div style={{ marginBottom: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#333', lineHeight: '1.2' }}>
          作业清单详情
        </h2>
        <Space>
          <Button
            icon={<SettingOutlined />}
            size="small"
            onClick={() => {
              // 打开列设置弹窗
              setTempVisibleColumns(Array.from(visibleColumns))
              setColumnModalVisible(true)
            }}
          >
            列设置
          </Button>
        </Space>
      </div>

      {/* 筛选器区域 - 可折叠，折叠时只显示标题栏 */}
      <div style={{ marginBottom: 0, background: '#fafafa', borderRadius: 4, border: '1px solid #e0e0e0', flexShrink: 0 }}>
        <div style={{ 
          padding: '2px 6px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          fontSize: 12,
          borderBottom: filterCollapsed ? 'none' : '1px solid #e0e0e0'
        }}>
          <span>筛选条件</span>
          <Button
            type="text"
            size="small"
            icon={filterCollapsed ? <DownOutlined /> : <UpOutlined />}
            onClick={() => setFilterCollapsed(!filterCollapsed)}
            style={{ fontSize: 12, padding: 0, height: 'auto' }}
          >
            {filterCollapsed ? '展开' : '收起'}
          </Button>
        </div>
        {!filterCollapsed && (
        <div style={{ padding: '4px 8px' }}>
        <Row gutter={[8, 8]}>
          {/* Facilities级联筛选器 */}
          <Col xs={12} sm={8} md={6} lg={4} xl={3}>
            <div style={{ marginBottom: 2, fontWeight: 500, fontSize: 11 }}>Project</div>
            <Select
              placeholder="选择Project"
              allowClear
              style={{ width: '100%', fontSize: 12 }}
              size="small"
              value={filterState.project}
              onChange={(value) => updateFilter('project', value)}
            >
              {facilitiesOptions.projects.map(item => (
                <Option key={item} value={item}>{item}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} sm={8} md={6} lg={4} xl={3}>
            <div style={{ marginBottom: 2, fontWeight: 500, fontSize: 11 }}>Sub-Project</div>
            <Select
              placeholder="选择Sub-Project"
              allowClear
              style={{ width: '100%', fontSize: 12 }}
              size="small"
              value={Array.isArray(filterState.subproject) ? filterState.subproject[0] : filterState.subproject}
              onChange={(value) => updateFilter('subproject', value ? [value] : undefined)}
            >
              {facilitiesOptions.subproject_codes.map(item => (
                <Option key={item} value={item}>{item}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} sm={8} md={6} lg={4} xl={3}>
            <div style={{ marginBottom: 2, fontWeight: 500, fontSize: 11 }}>Train</div>
            <Select
              placeholder="选择Train"
              allowClear
              style={{ width: '100%', fontSize: 12 }}
              size="small"
              value={Array.isArray(filterState.train) ? filterState.train[0] : filterState.train}
              onChange={(value) => updateFilter('train', value ? [value] : undefined)}
            >
              {facilitiesOptions.trains.map(item => (
                <Option key={item} value={item}>{item}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} sm={8} md={6} lg={4} xl={3}>
            <div style={{ marginBottom: 2, fontWeight: 500, fontSize: 11 }}>Unit</div>
            <Select
              placeholder="选择Unit"
              allowClear
              style={{ width: '100%', fontSize: 12 }}
              size="small"
              value={Array.isArray(filterState.unit) ? filterState.unit[0] : filterState.unit}
              onChange={(value) => updateFilter('unit', value ? [value] : undefined)}
            >
              {facilitiesOptions.units.map(item => (
                <Option key={item} value={item}>{item}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} sm={8} md={6} lg={4} xl={3}>
            <div style={{ marginBottom: 2, fontWeight: 500, fontSize: 11 }}>Simple Block</div>
            <Select
              placeholder="选择SimpleBLK"
              allowClear
              style={{ width: '100%', fontSize: 12 }}
              size="small"
              value={Array.isArray(filterState.simple_block) ? filterState.simple_block[0] : filterState.simple_block}
              onChange={(value) => updateFilter('simple_block', value ? [value] : undefined)}
            >
              {facilitiesOptions.simple_blocks.map((item: string) => (
                <Option key={item} value={item}>{item}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} sm={8} md={6} lg={4} xl={3}>
            <div style={{ marginBottom: 2, fontWeight: 500, fontSize: 11 }}>Main_Block</div>
            <Select
              placeholder="选择Main_Block"
              allowClear
              style={{ width: '100%', fontSize: 12 }}
              size="small"
              value={Array.isArray(filterState.main_block) ? filterState.main_block[0] : filterState.main_block}
              onChange={(value) => updateFilter('main_block', value ? [value] : undefined)}
            >
              {(Array.isArray(facilitiesOptions.main_blocks) ? facilitiesOptions.main_blocks : []).map((item: string) => (
                    <Option key={item} value={item}>{item}</Option>
                  ))
              }
            </Select>
          </Col>
          <Col xs={12} sm={8} md={6} lg={4} xl={3}>
            <div style={{ marginBottom: 2, fontWeight: 500, fontSize: 11 }}>Block</div>
            <Select
              placeholder="选择Block"
              allowClear
              style={{ width: '100%', fontSize: 12 }}
              size="small"
              value={Array.isArray(filterState.block) ? filterState.block[0] : filterState.block}
              onChange={(value) => updateFilter('block', value ? [value] : undefined)}
            >
              {facilitiesOptions.blocks.map(item => (
                <Option key={item} value={item}>{item}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} sm={8} md={6} lg={4} xl={3}>
            <div style={{ marginBottom: 2, fontWeight: 500, fontSize: 11 }}>Quarter</div>
            <Select
              placeholder="选择Quarter"
              allowClear
              style={{ width: '100%', fontSize: 12 }}
              size="small"
              value={Array.isArray(filterState.quarter) ? filterState.quarter[0] : filterState.quarter}
              onChange={(value) => updateFilter('quarter', value ? [value] : undefined)}
            >
              {facilitiesOptions.quarters.map((item: string) => (
                <Option key={item} value={item}>{item}</Option>
              ))}
            </Select>
          </Col>
          
          {/* Scope筛选器 */}
          <Col xs={12} sm={8} md={6} lg={4} xl={3}>
            <div style={{ marginBottom: 2, fontWeight: 500, fontSize: 11 }}>SCOPE</div>
            <Select
              placeholder="选择SCOPE"
              allowClear
              style={{ width: '100%', fontSize: 12 }}
              size="small"
              value={filters.scope}
              onChange={(value) => handleFilterChange('scope', value)}
            >
              {scopeOptions?.scopes?.map(item => (
                <Option key={item} value={item}>{item}</Option>
              ))}
            </Select>
          </Col>

          {/* 时间筛选器 */}
          <Col xs={12} sm={8} md={6} lg={4} xl={3}>
            <div style={{ marginBottom: 2, fontWeight: 500, fontSize: 11 }}>时间范围</div>
            <RangePicker
              style={{ width: '100%', fontSize: 12 }}
              size="small"
              format="YYYY-MM-DD"
              onChange={handleDateRangeChange}
              value={
                filters.start_date && filters.end_date
                  ? [dayjs(filters.start_date), dayjs(filters.end_date)]
                  : null
              }
            />
          </Col>

          {/* 搜索 */}
          <Col xs={12} sm={8} md={6} lg={4} xl={3}>
            <div style={{ marginBottom: 2, fontWeight: 500, fontSize: 11 }}>搜索</div>
            <Input
              placeholder="搜索ACT ID或描述"
              prefix={<SearchOutlined style={{ fontSize: 12 }} />}
              allowClear
              size="small"
              value={searchText}
              onChange={(e) => handleSearch(e.target.value)}
              style={{ fontSize: 12 }}
            />
          </Col>

          {/* 操作按钮 */}
          <Col xs={24} sm={24} md={24} lg={24} xl={24}>
            <Space style={{ marginTop: 8 }}>
              <Button
                icon={<ReloadOutlined style={{ fontSize: 12 }} />}
                onClick={() => {
                  resetFilter()
                  refetch()
                }}
                size="small"
                style={{ fontSize: 12 }}
              >
                重置
              </Button>
              <Button
                icon={<ReloadOutlined style={{ fontSize: 12 }} />}
                onClick={() => refetch()}
                size="small"
                style={{ fontSize: 12 }}
              >
                刷新
              </Button>
            </Space>
          </Col>
        </Row>
        </div>
        )}
      </div>

      {/* 数据表格 */}
      <Card
        style={{
          background: '#ffffff',
          borderRadius: 4,
          border: '1px solid #e0e0e0',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: 0,
          maxHeight: '100%', // 确保不超过父容器
        }}
        styles={{
          body: {
            padding: '2px',
            height: '100%',
            maxHeight: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }
        }}
      >
      <style>{`
        /* 修复表头圆角与容器不一致的问题 */
        .ant-table-thead > tr:first-child > th:first-child {
          border-top-left-radius: 4px !important;
        }
        .ant-table-thead > tr:first-child > th:last-child {
          border-top-right-radius: 4px !important;
        }
      `}</style>
      <div 
        ref={tableContainerRef}
        style={{ 
          flex: 1, 
          overflow: 'hidden', 
          display: 'flex', 
          flexDirection: 'column', 
          minHeight: 0,
          maxHeight: '100%',
          height: '100%',
          position: 'relative'
        }}
      >
      <Table
        columns={displayColumns}
        dataSource={paginatedData}
        loading={isLoading}
        rowKey="id"
        scroll={{ x: 'max-content', y: tableHeight || 500 }}
        size="small"
        style={{ 
          background: '#ffffff', 
          fontSize: 12,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: filteredData.length, // 所有已加载的数据总数
          showSizeChanger: true,
          showTotal: (total) => {
            if (hasMore) {
              return (
                <span style={{ fontSize: 12 }}>
                  已加载 {total} 条记录（自动加载中...）
                  <Button
                    type="link"
                    size="small"
                    loading={isLoadingMore || isLoading}
                    onClick={(e) => {
                      e.stopPropagation()
                      loadMoreData()
                    }}
                    disabled={isLoadingMore || !hasMore}
                    style={{ marginLeft: 8, padding: 0, height: 'auto', fontSize: 12 }}
                  >
                    {isLoadingMore || isLoading ? '加载中...' : '手动加载更多'}
                  </Button>
                </span>
              )
            }
            return `共 ${total} 条记录（已全部加载）`
          },
          onChange: (page, pageSize) => {
            setPagination({ current: page, pageSize })
          },
          onShowSizeChange: (_current, size) => {
            setPagination({ current: 1, pageSize: size })
          },
          size: 'small',
          style: { 
            marginTop: 4, 
            marginBottom: 4,
            position: 'relative',
            zIndex: 1,
            background: '#ffffff'
          }
        }}
        onRow={(record) => ({
          onClick: () => {
            setSelectedRow(record)
            setDrawerVisible(true)
          },
          style: { cursor: 'pointer' },
        })}
      />
      </div>
      </Card>

      {/* 详情抽屉 */}
      <Drawer
        title={`作业详情 - ${selectedRow?.activity_id || ''}`}
        placement="right"
        width={900}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false)
          setDetailTab('general')
        }}
      >
        {selectedRow && (
          <Tabs
            activeKey={detailTab}
            onChange={setDetailTab}
            items={[
              {
                key: 'general',
                label: '基本信息',
                children: (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="WBS Code" span={2}>{selectedRow.wbs_code || '-'}</Descriptions.Item>
            <Descriptions.Item label="ACT ID" span={2}><Tag color="blue">{selectedRow.activity_id}</Tag></Descriptions.Item>
            <Descriptions.Item label="TITLE" span={2}>{selectedRow.title || '-'}</Descriptions.Item>
            
            <Divider orientation="left">基础信息</Divider>
            <Descriptions.Item label="Project">{selectedRow.project || '-'}</Descriptions.Item>
            <Descriptions.Item label="Sub-Project CODE">{selectedRow.subproject || '-'}</Descriptions.Item>
            <Descriptions.Item label="Phase">{selectedRow.implement_phase || '-'}</Descriptions.Item>
            <Descriptions.Item label="Train">{selectedRow.train || '-'}</Descriptions.Item>
            <Descriptions.Item label="Unit">{selectedRow.unit || '-'}</Descriptions.Item>
            <Descriptions.Item label="Block">{selectedRow.block || '-'}</Descriptions.Item>
            <Descriptions.Item label="Main_Block">{selectedRow.main_block || '-'}</Descriptions.Item>
            <Descriptions.Item label="Quarter">{selectedRow.quarter || '-'}</Descriptions.Item>
            <Descriptions.Item label="Discipline">{selectedRow.discipline || '-'}</Descriptions.Item>
            <Descriptions.Item label="Work Package">{selectedRow.work_package || '-'}</Descriptions.Item>
            <Descriptions.Item label="SCOPE">{selectedRow.scope || '-'}</Descriptions.Item>
            <Descriptions.Item label="Simple Block">{selectedRow.simple_block || '-'}</Descriptions.Item>
            <Descriptions.Item label="!BCC_START-UP SEQUENCE">{selectedRow.start_up_sequence || '-'}</Descriptions.Item>
            <Descriptions.Item label="UoM">{selectedRow.uom || '-'}</Descriptions.Item>
            <Descriptions.Item label="!BCC_WORK PACKAGE">{selectedRow.contract_phase || '-'}</Descriptions.Item>
            
            <Divider orientation="left">工程量信息</Divider>
            <Descriptions.Item label="KEY QTY">{formatQuantity(selectedRow.key_qty, 3, '-')}</Descriptions.Item>
            <Descriptions.Item label="Calculated MHrs">{formatQuantity(selectedRow.calculated_mhrs, 3, '-')}</Descriptions.Item>
            <Descriptions.Item label="Resource ID">{selectedRow.resource_id || '-'}</Descriptions.Item>
            <Descriptions.Item label="SPE MHrs">{formatQuantity(selectedRow.spe_mhrs, 3, '-')}</Descriptions.Item>
            <Descriptions.Item label="Weight Factor">{formatQuantity(selectedRow.weight_factor, 3, '-')}</Descriptions.Item>
            <Descriptions.Item label="Actual Weight Factor">{formatQuantity(selectedRow.actual_weight_factor, 3, '-')}</Descriptions.Item>
            <Descriptions.Item label="完成百分比">
              {selectedRow.key_qty && selectedRow.completed 
                ? ((selectedRow.completed / selectedRow.key_qty) * 100).toFixed(2) + '%'
                : '-'}
            </Descriptions.Item>
            
            <Divider orientation="left">计划信息</Divider>
            <Descriptions.Item label="BL_START">
              {selectedRow.baseline1_start_date ? dayjs(selectedRow.baseline1_start_date).format('YYYY-MM-DD') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="BL_FINISH">
              {selectedRow.baseline1_finish_date ? dayjs(selectedRow.baseline1_finish_date).format('YYYY-MM-DD') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Planned Duration">{selectedRow.planned_duration || '-'} 天</Descriptions.Item>
            <Descriptions.Item label="Forecast_Start">
              {selectedRow.forecast_start ? dayjs(selectedRow.forecast_start).format('YYYY-MM-DD') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Forecast_Finish">
              {selectedRow.forecast_finish ? dayjs(selectedRow.forecast_finish).format('YYYY-MM-DD') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="At Completion Duration">{selectedRow.at_completion_duration || '-'} 天</Descriptions.Item>
            
            <Divider orientation="left">实际信息</Divider>
            <Descriptions.Item label="Actual Start">
              {selectedRow.actual_start_date ? dayjs(selectedRow.actual_start_date).format('YYYY-MM-DD') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Actual Finish">
              {selectedRow.actual_finish_date ? dayjs(selectedRow.actual_finish_date).format('YYYY-MM-DD') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Actual Duration">{selectedRow.actual_duration || '-'} 天</Descriptions.Item>
            <Descriptions.Item label="Completed">{formatQuantity(selectedRow.completed, 3, '-')}</Descriptions.Item>
            <Descriptions.Item label="Actual Manhour">{formatQuantity(selectedRow.actual_manhour, 3, '-')}</Descriptions.Item>
            <Descriptions.Item label="Actual Weight">{formatQuantity(selectedRow.actual_weight, 3, '-')}</Descriptions.Item>
            <Descriptions.Item label="Act Status">{selectedRow.act_status || '-'}</Descriptions.Item>
            
            <Divider orientation="left">预算和预测</Divider>
            <Descriptions.Item label="Current Budgeted WF.">{formatQuantity(selectedRow.current_budgeted_wf, 3, '-')}</Descriptions.Item>
            <Descriptions.Item label="Current Budgeted MH.">{formatQuantity(selectedRow.current_budgeted_mh, 3, '-')}</Descriptions.Item>
            <Descriptions.Item label="Current Budgeted Vol.">{formatQuantity(selectedRow.current_budgeted_vol, 3, '-')}</Descriptions.Item>
            <Descriptions.Item label="Current Forecast WF.">{formatQuantity(selectedRow.current_forecast_wf, 3, '-')}</Descriptions.Item>
            <Descriptions.Item label="Current Forecast MH.">{formatQuantity(selectedRow.current_forecast_mh, 3, '-')}</Descriptions.Item>
            <Descriptions.Item label="Current Forecast Vol.">{formatQuantity(selectedRow.current_forecast_vol, 3, '-')}</Descriptions.Item>
          </Descriptions>
                ),
              },
              {
                key: 'mpdb',
                label: 'Manpower Report Records',
                children: (
                  <div>
                    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                      <Button type="primary" icon={<PlusOutlined />} onClick={handleAddMpdb}>
                        新增记录
                      </Button>
                    </div>
                    <Table
                      columns={[
                        { title: '日期', dataIndex: 'date', key: 'date', width: 120, render: (date: string) => dayjs(date).format('YYYY-MM-DD') },
                        { title: '人力类型', dataIndex: 'typeof_mp', key: 'typeof_mp', width: 100 },
                        { 
                          title: '人力', 
                          dataIndex: 'manpower', 
                          key: 'manpower', 
                          width: 100, 
                          align: 'right',
                          render: (value: string | number | null | undefined) => formatHighPrecisionValue(value)
                        },
                        { 
                          title: '机械', 
                          dataIndex: 'machinery', 
                          key: 'machinery', 
                          width: 100, 
                          align: 'right',
                          render: (value: string | number | null | undefined) => formatHighPrecisionValue(value)
                        },
                        { title: '备注', dataIndex: 'remarks', key: 'remarks', ellipsis: true },
                        {
                          title: '操作',
                          key: 'action',
                          width: 120,
                          render: (_: any, record: MPDBResponse) => (
                            <Space>
                              <Button
                                type="link"
                                size="small"
                                icon={<EditOutlined />}
                                onClick={() => handleEditMpdb(record)}
                              >
                                编辑
                              </Button>
                              <Popconfirm
                                title="确定要删除这条记录吗？"
                                onConfirm={() => deleteMpdbMutation.mutate(record.id)}
                                okText="确定"
                                cancelText="取消"
                              >
                                <Button type="link" size="small" danger icon={<DeleteOutlined />}>
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
                      pagination={{ pageSize: 10 }}
                    />
                  </div>
                ),
              },
              {
                key: 'vfactdb',
                label: 'Physical Volume Report Records',
                children: (
                  <div>
                    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                      <Button type="primary" icon={<PlusOutlined />} onClick={handleAddVfactdb}>
                        新增记录
                      </Button>
                    </div>
                    <Table
                      columns={[
                        { title: '日期', dataIndex: 'date', key: 'date', width: 120, render: (date: string) => dayjs(date).format('YYYY-MM-DD') },
                        { title: '工作步骤描述', dataIndex: 'work_step_description', key: 'work_step_description', width: 150 },
                        { title: '完成量', dataIndex: 'achieved', key: 'achieved', width: 120, align: 'right', render: (val: any) => formatHighPrecisionValue(val) },
                        {
                          title: '操作',
                          key: 'action',
                          width: 120,
                          render: (_: any, record: VFACTDBResponse) => (
                            <Space>
                              <Button
                                type="link"
                                size="small"
                                icon={<EditOutlined />}
                                onClick={() => handleEditVfactdb(record)}
                              >
                                编辑
                              </Button>
                              <Popconfirm
                                title="确定要删除这条记录吗？"
                                onConfirm={() => deleteVfactdbMutation.mutate(record.id)}
                                okText="确定"
                                cancelText="取消"
                              >
                                <Button type="link" size="small" danger icon={<DeleteOutlined />}>
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
                      pagination={{ pageSize: 10 }}
                    />
                  </div>
                ),
              },
              {
                key: 'non-key-volumes',
                label: '非关键工程量',
                children: (
                  <div>
                    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                      <Button type="primary" icon={<PlusOutlined />} onClick={handleAddWorkStepVolume}>
                        新增预估总量
                      </Button>
                    </div>
                    <Table
                      columns={[
                        { 
                          title: '工作步骤描述', 
                          dataIndex: 'work_step_description', 
                          key: 'work_step_description', 
                          width: 250,
                        },
                        { 
                          title: '预估总量', 
                          dataIndex: 'estimated_total', 
                          key: 'estimated_total', 
                          width: 150, 
                          align: 'right' as const,
                          render: (val: number) => formatQuantity(val, 3, '-', true),
                        },
                        {
                          title: '操作',
                          key: 'action',
                          width: 150,
                          render: (_: any, record: WorkStepVolume) => (
                            <Space>
                              <Button
                                type="link"
                                size="small"
                                icon={<EditOutlined />}
                                onClick={() => handleEditWorkStepVolume(record)}
                              >
                                编辑
                              </Button>
                              <Popconfirm
                                title="确定要删除这条记录吗？"
                                onConfirm={() => deleteWorkStepVolumeMutation.mutate(record.id)}
                                okText="确定"
                                cancelText="取消"
                              >
                                <Button type="link" size="small" danger icon={<DeleteOutlined />}>
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
                      pagination={{ pageSize: 10 }}
                      locale={{ emptyText: '暂无数据，请点击"新增预估总量"添加' }}
                    />
                  </div>
                ),
              },
            ]}
          />
        )}

        {/* MPDB编辑Modal */}
        <Modal
          title={editingMpdb ? '编辑MPDB记录' : '新增MPDB记录'}
          open={mpdbModalVisible}
          onOk={handleMpdbSubmit}
          onCancel={() => {
            setMpdbModalVisible(false)
            setEditingMpdb(null)
            mpdbForm.resetFields()
          }}
          confirmLoading={createMpdbMutation.isPending || updateMpdbMutation.isPending}
          okText="确定"
          cancelText="取消"
        >
          <Form form={mpdbForm} layout="vertical">
            <Form.Item
              name="date"
              label="日期"
              rules={[{ required: true, message: '请选择日期' }]}
            >
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item
              name="typeof_mp"
              label="人力类型"
            >
              <Select placeholder="选择人力类型">
                <Option value="Direct">Direct</Option>
                <Option value="Indirect">Indirect</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="manpower"
              label="人力"
              rules={[{ required: true, message: '请输入人力数量' }]}
            >
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="machinery"
              label="机械"
            >
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="remarks"
              label="备注"
            >
              <Input.TextArea rows={3} />
            </Form.Item>
          </Form>
        </Modal>

        {/* VFACTDB编辑Modal */}
        <Modal
          title={editingVfactdb ? '编辑VFACTDB记录' : '新增VFACTDB记录'}
          open={vfactdbModalVisible}
          onOk={handleVfactdbSubmit}
          onCancel={() => {
            setVfactdbModalVisible(false)
            setEditingVfactdb(null)
            vfactdbForm.resetFields()
          }}
          confirmLoading={createVfactdbMutation.isPending || updateVfactdbMutation.isPending}
          okText="确定"
          cancelText="取消"
        >
          <Form form={vfactdbForm} layout="vertical">
            <Form.Item
              name="date"
              label="日期"
              rules={[{ required: true, message: '请选择日期' }]}
            >
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item
              name="work_step_description"
              label="工作类型"
            >
              <Input placeholder="工作类型" />
            </Form.Item>
            <Form.Item
              name="achieved"
              label="完成量"
              rules={[{ required: true, message: '请输入完成量' }]}
            >
              <Input
              placeholder="请输入完成量"
              onChange={(e) => {
                const value = e.target.value.trim()
                if (value === '' || /^-?\d*\.?\d*(?:[eE][-+]?\d*)?$/.test(value)) {
                  vfactdbForm.setFieldValue('achieved', value === '' ? undefined : value)
                }
              }}
            />
            </Form.Item>
          </Form>
        </Modal>

        {/* 非关键工程量编辑Modal */}
        <Modal
          title={editingWorkStepVolume ? '编辑非关键工程量' : '新增非关键工程量'}
          open={workStepVolumeModalVisible}
          onOk={handleWorkStepVolumeSubmit}
          onCancel={() => {
            setWorkStepVolumeModalVisible(false)
            setEditingWorkStepVolume(null)
            workStepVolumeForm.resetFields()
          }}
          confirmLoading={createOrUpdateWorkStepVolumeMutation.isPending}
          okText="确定"
          cancelText="取消"
        >
          <Form form={workStepVolumeForm} layout="vertical">
            <Form.Item
              name="work_step_description"
              label="工作步骤描述"
              rules={[{ required: true, message: '请选择工作步骤描述' }]}
            >
              <Select 
                placeholder="选择工作步骤描述"
                showSearch
                filterOption={(input, option) =>
                  (typeof option?.label === 'string' ? option.label : '').toLowerCase().includes(input.toLowerCase())
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
      </Drawer>

      {/* 列设置弹窗 */}
      <Modal
        title="列设置 - 选择要显示的列"
        open={columnModalVisible}
        onOk={() => {
          setVisibleColumns(new Set(tempVisibleColumns))
          setColumnModalVisible(false)
          message.success('列设置已保存')
        }}
        onCancel={() => {
          setColumnModalVisible(false)
        }}
        width={600}
        okText="确定"
        cancelText="取消"
      >
        <div style={{ maxHeight: 500, overflowY: 'auto', marginTop: 16 }}>
          <CheckboxGroup
            value={tempVisibleColumns}
            onChange={(checkedValues: string[]) => {
              setTempVisibleColumns(checkedValues)
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            {allColumns
              .filter(col => col.key !== 'action')
              .map(col => (
                <Checkbox key={col.key as string} value={col.key as string}>
                  {col.title as string}
                </Checkbox>
              ))}
          </CheckboxGroup>
        </div>
      </Modal>
    </Card>
    </div>
  )
}

export default ActivityDetailList
