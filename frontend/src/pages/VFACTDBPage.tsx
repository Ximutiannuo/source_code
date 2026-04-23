import { useState, useContext, useMemo, useRef, useEffect } from 'react'
import { Table, Input, Button, Space, App, Popconfirm, Checkbox, Modal, Tooltip, Badge } from 'antd'
import { EditOutlined, DeleteOutlined, SettingOutlined, PlusOutlined, UploadOutlined, SwapOutlined, CalendarOutlined, DownloadOutlined, HistoryOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { handleUnifiedExport } from '../utils/exportUtils'
import { reportService } from '../services/reportService'
import type { VFACTDBResponse } from '../types/report'
import { GlobalFilterContext } from '../components/layout/MainLayout'
import { useResizableColumns, ResizableHeaderCell } from '../hooks/useResizableColumns'
import dayjs from 'dayjs'
import { logger } from '../utils/logger'
import { formatHighPrecisionValue } from '../utils/formatNumber'
import VFACTDBModal from '../components/reports/VFACTDBModal'
import ImportModal from '../components/reports/ImportModal'
import VFACTDBBatchAdjustModal from '../components/reports/VFACTDBBatchAdjustModal'
import VFACTDBWeeklyDistributeModal from '../components/reports/VFACTDBWeeklyDistributeModal'
import VFACTDBImportExportModal from '../components/reports/VFACTDBImportExportModal'
import Pagination from 'antd/es/pagination'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
 
type VFACTDBInvalidActivity = {
  activity_id: string
  count: number
  achieved_total: string
  invalid_reason: 'not_in_p6' | 'scope_mismatch'  // P6不存在 | Scope不匹配
}

const invalidReasonLabel = (reason: string) =>
  reason === 'not_in_p6' ? 'P6不存在' : reason === 'scope_mismatch' ? 'Scope不匹配' : reason

/** 允许使用 vfactdb 四个特殊修改接口的角色 ID（删除/新增/分配/调整完成量） */
const VFACTDB_SPECIAL_ROLE_IDS = [2, 3, 5]

const canUseVfactdbSpecialActions = (user: { is_superuser?: boolean; role_ids?: number[] } | null) =>
  !!user && (user.is_superuser === true || (Array.isArray(user.role_ids) && user.role_ids.some((id) => VFACTDB_SPECIAL_ROLE_IDS.includes(id))))


// VFACTDB表的所有字段（重新排序）
const AVAILABLE_COLUMNS = [
  { key: 'date', title: 'Date', width: 90, fixed: 'left' as const },
  { key: 'activity_id', title: 'Activity ID', width: 130, fixed: 'left' as const },
  { key: 'scope', title: 'Scope', width: 80 },
  { key: 'work_step_description', title: '工作步骤描述', width: 150 },
  { key: 'achieved', title: 'Achieved', width: 100, align: 'right' as const },
  { key: 'project', title: 'Project', width: 80 },
  { key: 'subproject', title: 'Sub Project', width: 100 },
  { key: 'implement_phase', title: 'Phase', width: 80 },
  { key: 'train', title: 'Train', width: 70 },
  { key: 'unit', title: 'Unit', width: 70 },
  { key: 'main_block', title: 'Main Block', width: 110 },
  { key: 'block', title: 'Block', width: 110 },
  { key: 'quarter', title: 'Quarter', width: 80 },
  { key: 'title', title: 'Description', width: 250 },
  { key: 'discipline', title: 'Discipline', width: 85 },
  { key: 'work_package', title: 'Work Package', width: 100 },
]

const VFACTDBPage = () => {
  const { message: messageApi } = App.useApp()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { user } = useAuth()
  const location = useLocation()
  const globalFilter = useContext(GlobalFilterContext)
  const tableAreaRef = useRef<HTMLDivElement | null>(null)
  const paginationBarRef = useRef<HTMLDivElement | null>(null)
  const [bodyHeight, setBodyHeight] = useState<number>(360)
  
  const [pagination, setPagination] = useState({ current: 1, pageSize: 100 })
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('vfactdb-visible-columns')
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (e) {
      logger.error('Failed to load column preferences:', e)
    }
    // 默认加载所有栏位
    return AVAILABLE_COLUMNS.map(col => col.key)
  })
  const [columnSettingsVisible, setColumnSettingsVisible] = useState(false)
  const [localFilters, setLocalFilters] = useState({
    activity_id: '',
    title: '',
  })
  const [vfactdbModalVisible, setVfactdbModalVisible] = useState(false)
  const [importModalVisible, setImportModalVisible] = useState(false)
  const [batchAdjustModalVisible, setBatchAdjustModalVisible] = useState(false)
  const [weeklyDistributeModalVisible, setWeeklyDistributeModalVisible] = useState(false)
  const [importExportModalVisible, setImportExportModalVisible] = useState(false)
  const [editingRecord, setEditingRecord] = useState<VFACTDBResponse | null>(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [invalidModalVisible, setInvalidModalVisible] = useState(false)
  const [lastKnownTotal, setLastKnownTotal] = useState<number>(0)
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    const exportColumns = visibleColumns.map(key => {
      const col = AVAILABLE_COLUMNS.find(c => c.key === key)
      return {
        key,
        title: col?.title || key,
        width: col?.width
      }
    })

    handleUnifiedExport(
      'vfactdb',
      { columns: exportColumns, filters: filters, template_type: 'user_view' },
      messageApi,
      setExporting,
      'VFACTDB_Export'
    )
  }

  // 将GlobalFilter的筛选条件转换为后端API需要的格式
  const filters = useMemo(() => {
    const filterObj: Record<string, any> = {}
    
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
    if (globalFilter.date_range && globalFilter.date_range[0] && globalFilter.date_range[1]) {
      filterObj.start_date = globalFilter.date_range[0].format('YYYY-MM-DD')
      filterObj.end_date = globalFilter.date_range[1].format('YYYY-MM-DD')
    }
    if (localFilters.activity_id) {
      filterObj.activity_id = localFilters.activity_id
    }
    if (localFilters.title) {
      filterObj.title = localFilters.title
    }
    
    return filterObj
  }, [globalFilter, localFilters])

  const { data, isLoading } = useQuery({
    queryKey: ['vfactdb', filters, pagination.current, pagination.pageSize],
    queryFn: () =>
      reportService.getVFACTDB({
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined,
        activity_id: filters.activity_id || undefined,
        title: filters.title || undefined,
        block: filters.block || undefined,
        discipline: filters.discipline || undefined,
        subproject: filters.subproject || undefined,
        train: filters.train || undefined,
        unit: filters.unit || undefined,
        main_block: filters.main_block || undefined,
        quarter: filters.quarter || undefined,
        scope: filters.scope || undefined,
        implement_phase: filters.implement_phase || undefined,
        contract_phase: filters.contract_phase || undefined,
        type: filters.type || undefined,
        work_package: filters.work_package || undefined,
        resource_id_name: filters.resource_id_name || undefined,
        bcc_kq_code: filters.bcc_kq_code || undefined,
        kq: filters.kq || undefined,
        cn_wk_report: filters.cn_wk_report || undefined,
        skip: (pagination.current - 1) * pagination.pageSize,
        limit: pagination.pageSize,
        count_total: pagination.current === 1, // 仅第一页请求总数，翻页不请求以提速
      }),
    refetchOnMount: 'always', // 组件挂载时总是重新获取数据
    refetchOnWindowFocus: false, // 窗口聚焦时不重新获取（避免不必要的请求）
    enabled: location.pathname === '/vfactdb', // 只在 /vfactdb 页面时启用查询
  })

  const { data: invalidActivities = [], isLoading: invalidLoading } = useQuery({
    queryKey: ['vfactdb-invalid-activities'],
    queryFn: () => reportService.getVFACTDBInvalidActivities(100),
    enabled: location.pathname === '/vfactdb',
    refetchOnWindowFocus: false,
  })

  // 从响应中获取总记录数和数据项
  const items = useMemo(() => {
    if (!data) return []
    if (data && typeof data === 'object' && 'items' in data) {
      return data.items || []
    }
    return Array.isArray(data) ? data : []
  }, [data])

  const total = useMemo(() => {
    if (!data) return lastKnownTotal
    if (data && typeof data === 'object' && 'total' in data) {
      const t = data.total
      if (typeof t === 'number') return t
      return lastKnownTotal
    }
    return lastKnownTotal
  }, [data, lastKnownTotal])

  useEffect(() => {
    if (data && typeof data === 'object' && 'total' in data && typeof data.total === 'number') {
      setLastKnownTotal(data.total)
    }
  }, [data])

  const deleteMutation = useMutation({
    mutationFn: (id: number) => reportService.deleteVFACTDB(id),
    onSuccess: (_, deletedId) => {
      messageApi.success('删除成功')
      // 使用乐观更新立即更新UI，而不是等待查询完成
      queryClient.setQueryData(['vfactdb', filters, pagination.current, pagination.pageSize], (old: any) => {
        if (!old) return old
        const oldItems = old.items || (Array.isArray(old) ? old : [])
        return {
          ...old,
          items: oldItems.filter((item: VFACTDBResponse) => item.id !== deletedId),
          total: (old.total || oldItems.length) - 1,
        }
      })
      // 异步刷新以确保数据一致性
      queryClient.invalidateQueries({ queryKey: ['vfactdb'] })
      queryClient.invalidateQueries({ queryKey: ['daily-report-management'] })
    },
    onError: () => {
      messageApi.error('删除失败')
    },
  })

  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      // 批量删除：循环调用单个删除API
      const results = await Promise.allSettled(
        ids.map(id => reportService.deleteVFACTDB(id))
      )
      const failed = results.filter(r => r.status === 'rejected').length
      const successIds = ids.filter((_, index) => results[index].status === 'fulfilled')
      return { success: results.length - failed, failed, total: ids.length, successIds }
    },
    onSuccess: (result) => {
      if (result.failed === 0) {
        messageApi.success(`成功删除 ${result.success} 条记录`)
      } else {
        messageApi.warning(`成功删除 ${result.success} 条，失败 ${result.failed} 条`)
      }
      // 使用乐观更新立即更新UI
      queryClient.setQueryData(['vfactdb', filters, pagination.current, pagination.pageSize], (old: any) => {
        if (!old) return old
        const oldItems = old.items || (Array.isArray(old) ? old : [])
        return {
          ...old,
          items: oldItems.filter((item: VFACTDBResponse) => !result.successIds.includes(item.id)),
          total: (old.total || oldItems.length) - result.success,
        }
      })
      // 异步刷新以确保数据一致性
      queryClient.invalidateQueries({ queryKey: ['vfactdb'] })
      queryClient.invalidateQueries({ queryKey: ['daily-report-management'] })
    },
    onError: () => {
      messageApi.error('批量删除失败')
    },
  })

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id)
  }

  const handleBatchDelete = (ids: number[]) => {
    if (ids.length === 0) {
      messageApi.warning('请至少选择一条记录')
      return
    }
    batchDeleteMutation.mutate(ids)
  }

  const handleEdit = (record: VFACTDBResponse) => {
    setEditingRecord(record)
    setVfactdbModalVisible(true)
  }

  const handleAdd = () => {
    setEditingRecord(null)
    setVfactdbModalVisible(true)
  }

  const handleModalClose = () => {
    setVfactdbModalVisible(false)
    setImportModalVisible(false)
    setBatchAdjustModalVisible(false)
    setWeeklyDistributeModalVisible(false)
    setImportExportModalVisible(false)
    setEditingRecord(null)
    queryClient.invalidateQueries({ queryKey: ['vfactdb'] })
  }

  // 计算表格高度 - 完全对齐ActivityList的计算方式
  useEffect(() => {
    const el = tableAreaRef.current
    if (!el) return

    const ro = new ResizeObserver(() => {
      // 检查组件是否仍然挂载
      if (!tableAreaRef.current) return
      
      const h = el.getBoundingClientRect().height
      const footerH = paginationBarRef.current?.getBoundingClientRect().height ?? 56
      const headerH =
        (el.querySelector('.vfactdb-table .ant-table-header') as HTMLElement | null)?.getBoundingClientRect().height ?? 0
      // 完全对齐ActivityList的计算方式
      const next = Math.max(160, Math.floor(h - footerH - headerH - 16))
      setBodyHeight(next)
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      // 确保清理所有可能的状态
    }
  }, [])

  // 当路由变化时，确保组件正确更新和清理
  useEffect(() => {
    const isVfactdbPage = location.pathname === '/vfactdb'
    
    if (isVfactdbPage) {
      // 当进入 /vfactdb 页面时，强制刷新数据
      queryClient.invalidateQueries({ queryKey: ['vfactdb'] })
    } else {
      // 离开 /vfactdb 页面时，立即取消所有相关查询
      queryClient.cancelQueries({ queryKey: ['vfactdb'] })
    }
  }, [location.pathname, queryClient])
  
  // 组件卸载时的清理
  useEffect(() => {
    return () => {
      // 组件卸载时，确保清理所有可能阻止导航的状态
      queryClient.cancelQueries({ queryKey: ['vfactdb'] })
      // 确保没有残留的样式
      if (document.body.style.pointerEvents === 'none') {
        document.body.style.pointerEvents = ''
      }
      if (document.body.style.cursor === 'col-resize') {
        document.body.style.cursor = ''
      }
      if (document.body.style.userSelect === 'none') {
        document.body.style.userSelect = ''
      }
    }
  }, [queryClient])

  // 当筛选条件变化时，重置分页
  useEffect(() => {
    setPagination({ current: 1, pageSize: 100 })
  }, [filters])

  // 构建默认表格列
  const defaultColumns: ColumnsType<VFACTDBResponse> = useMemo(() => {
    const baseColumns = visibleColumns.map(colKey => {
      const colDef = AVAILABLE_COLUMNS.find(c => c.key === colKey)
      if (!colDef) return null
      
      return {
        title: colDef.title,
        dataIndex: colDef.key,
        key: colDef.key,
        width: colDef.width,
        align: colDef.align,
        fixed: colDef.fixed,
        ellipsis: colDef.key === 'title' || colDef.key === 'work_step_description' || colDef.key === 'block' ? true : undefined,
        render: (value: any, record: any) => {
          if (colDef.key === 'date') {
            return dayjs(value).format('YYYY-MM-DD')
          }
          if (colDef.key === 'achieved') {
            // achieved是高精度Decimal，保持高精度显示，避免精度丢失
            return formatHighPrecisionValue(value)
          }
          // main_block是字符串，确保保留前导零（如00011显示为00011而不是11）
          if (colDef.key === 'main_block') {
            if (value == null || value === undefined || value === '') {
              return ''
            }
            // 确保作为字符串处理，保留前导零
            return String(value)
          }
          // work_step_description 字段：确保正确显示
          if (colDef.key === 'work_step_description') {
            // 确保正确获取值，优先使用 value，如果为空则从 record 中获取
            // 如果 record 中也没有，尝试从 type_of_work 字段获取（向后兼容）
            let workStepDesc = value !== null && value !== undefined ? value : (record?.work_step_description ?? '')
            // 如果还是空，尝试从 type_of_work 字段获取（向后兼容，如果数据库中还保留了这个字段）
            if (!workStepDesc && record?.type_of_work) {
              workStepDesc = record.type_of_work
            }
            return workStepDesc || ''
          }
          // 其他字段：如果值为 null 或 undefined，返回空字符串（除了某些特殊字段）
          if (value === null || value === undefined) {
            return ''
          }
          return value
        },
      }
    }).filter(Boolean) as any[]
    
    baseColumns.push({
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right' as const,
      render: (_: any, record: VFACTDBResponse) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
            style={{ padding: 0, fontSize: '12px' }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这条记录吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button 
              type="link" 
              danger 
              icon={<DeleteOutlined />}
              size="small"
              style={{ padding: 0, fontSize: '12px' }}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    })
    
    return baseColumns
  }, [visibleColumns, handleEdit, handleDelete])

  const {
    columns,
    tableWidth,
    tableRef: resizableTableRef,
    resetColumns,
  } = useResizableColumns({
    persistKey: 'vfactdb_v2',
    columns: defaultColumns,
    extraWidth: 50,
  })

  const invalidColumns: ColumnsType<VFACTDBInvalidActivity> = useMemo(() => ([
    {
      title: 'Activity ID',
      dataIndex: 'activity_id',
      key: 'activity_id',
      width: 180,
    },
    {
      title: '无效原因',
      dataIndex: 'invalid_reason',
      key: 'invalid_reason',
      width: 100,
      render: (v: string) => invalidReasonLabel(v),
    },
    {
      title: '记录数',
      dataIndex: 'count',
      key: 'count',
      width: 80,
      align: 'right',
    },
    {
      title: 'Achieved 合计',
      dataIndex: 'achieved_total',
      key: 'achieved_total',
      align: 'right',
      render: (value: string) => formatHighPrecisionValue(value),
    },
  ]), [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <style>{`
        /* 极致截断：锁定表格布局 */
        .vfactdb-table .ant-table table {
          table-layout: fixed !important;
          width: 100% !important;
        }
        
        .vfactdb-table .ant-table-cell {
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          max-width: 0 !important;
          padding: 4px 8px !important;
        }

        .vfactdb-table .ant-table-cell > div,
        .vfactdb-table .ant-table-cell .ant-table-cell-content {
          display: block !important;
          width: 100% !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }

        .vfactdb-table .ant-table-body,
        .vfactdb-table .ant-table-content { 
          overflow: auto !important; 
        }

        .vfactdb-table { font-size: 12px; }
        .vfactdb-table .ant-table-tbody > tr > td {
          padding: 4px 8px !important;
        }
        .vfactdb-table .ant-table-thead > tr > th {
          padding: 6px 8px !important;
        }
        .toolbar-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          flex-shrink: 0;
        }
        .page-title { margin: 0; font-size: 16px; font-weight: 600; color: #1e293b; }
      `}</style>

      <div className="toolbar-row">
        <h2 className="page-title">VFACTDB 工程量日报</h2>
        <Space>
          <Input
            placeholder="作业ID"
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
          <Tooltip
            title={
              invalidActivities.length > 0
                ? `发现 ${invalidActivities.length} 个无效作业 ID（P6不存在 或 Scope不匹配）`
                : '未发现无效 Activity ID（P6不存在 / Scope不匹配）'
            }
          >
            <Button
              type="text"
              size="small"
              onClick={() => setInvalidModalVisible(true)}
              style={{
                padding: '0 4px',
                color: invalidActivities.length > 0 ? '#ef4444' : '#3b82f6',
              }}
              aria-label="查看 VFACTDB 无效 Activity ID"
              loading={invalidLoading}
            >
              <Badge
                count={invalidActivities.length > 0 ? invalidActivities.length : 0}
                size="small"
                overflowCount={999}
                color={invalidActivities.length > 0 ? '#ef4444' : '#3b82f6'}
                showZero
              >
                <InfoCircleOutlined />
              </Badge>
            </Button>
          </Tooltip>
          {selectedRowKeys.length > 0 && (
            <Popconfirm
              title={`确定要删除选中的 ${selectedRowKeys.length} 条记录吗？`}
              onConfirm={() => {
                handleBatchDelete(selectedRowKeys as number[])
                setSelectedRowKeys([])
              }}
              okText="确定"
              cancelText="取消"
            >
              <Button
                danger
                icon={<DeleteOutlined />}
                size="small"
                loading={batchDeleteMutation.isPending}
              >
                批量删除 ({selectedRowKeys.length})
              </Button>
            </Popconfirm>
          )}
          {canUseVfactdbSpecialActions(user) && (
            <>
              <Button
                icon={<DownloadOutlined />}
                onClick={() => setImportExportModalVisible(true)}
                size="small"
              >
                删除完成量（准确）
              </Button>
              <Button
                icon={<UploadOutlined />}
                onClick={() => setImportModalVisible(true)}
                size="small"
              >
                新增完成量（准确）
              </Button>
              <Button
                icon={<CalendarOutlined />}
                onClick={() => setWeeklyDistributeModalVisible(true)}
                size="small"
              >
                新增完成量（分配）
              </Button>
              <Button
                icon={<SwapOutlined />}
                onClick={() => setBatchAdjustModalVisible(true)}
                size="small"
              >
                调整完成量（覆写）
              </Button>
            </>
          )}
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExport}
            loading={exporting}
            size="small"
          >
            批量导出
          </Button>
          <Button
            icon={<SettingOutlined />}
            onClick={() => setColumnSettingsVisible(true)}
            size="small"
          >
            列设置
          </Button>
          <Button
            onClick={resetColumns}
            size="small"
          >
            重置列宽
          </Button>
          {(user?.is_superuser || user?.username === 'role_system_admin') && (
            <Button
              icon={<HistoryOutlined />}
              onClick={() => navigate('/system-admin')}
              size="small"
              type="dashed"
            >
              回滚数据
            </Button>
          )}
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} size="small">
            新增
          </Button>
        </Space>
      </div>

      <style>{`
        /* 修复表头圆角与容器不一致的问题 */
        .vfactdb-table .ant-table-thead > tr:first-child > th:first-child {
          border-top-left-radius: 4px !important;
        }
        .vfactdb-table .ant-table-thead > tr:first-child > th:last-child {
          border-top-right-radius: 4px !important;
        }
      `}</style>
      <div
        ref={tableAreaRef}
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: '#ffffff',
          borderRadius: '4px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div 
          ref={resizableTableRef as React.RefObject<HTMLDivElement>}
          style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
        >
          <Table
            className="vfactdb-table"
            columns={columns}
            dataSource={items}
            loading={isLoading || deleteMutation.isPending}
            rowKey="id"
            size="small"
            scroll={{
              x: tableWidth,
              y: bodyHeight,
            }}
            components={{
              header: {
                cell: ResizableHeaderCell,
              },
            }}
            pagination={false}
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
              getCheckboxProps: () => ({
                name: 'row-selection',
              }),
            }}
          />
        </div>

        <div
          ref={paginationBarRef}
          style={{
            flexShrink: 0,
            padding: '8px 12px',
            borderTop: '1px solid #e2e8f0',
            background: '#ffffff',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <Pagination
            size="small"
            current={pagination.current}
            pageSize={pagination.pageSize}
            total={total}
            showSizeChanger
            showTotal={(total) => `共 ${total} 条记录`}
            onChange={(page, pageSize) => setPagination({ current: page, pageSize })}
          />
        </div>
      </div>

      <VFACTDBModal
        visible={vfactdbModalVisible}
        record={editingRecord}
        onCancel={handleModalClose}
        onSuccess={handleModalClose}
      />

      <ImportModal
        visible={importModalVisible}
        type="vfactdb"
        onCancel={() => setImportModalVisible(false)}
        onSuccess={handleModalClose}
      />

      <VFACTDBBatchAdjustModal
        visible={batchAdjustModalVisible}
        onCancel={() => setBatchAdjustModalVisible(false)}
        onSuccess={handleModalClose}
      />

      <VFACTDBWeeklyDistributeModal
        visible={weeklyDistributeModalVisible}
        onCancel={() => setWeeklyDistributeModalVisible(false)}
        onSuccess={handleModalClose}
      />

      <VFACTDBImportExportModal
        visible={importExportModalVisible}
        filters={filters}
        onCancel={() => setImportExportModalVisible(false)}
        onSuccess={handleModalClose}
      />

      <Modal
        title="VFACTDB 无效作业 ID（P6不存在 / Scope不匹配）"
        open={invalidModalVisible}
        onCancel={() => setInvalidModalVisible(false)}
        footer={null}
        width={720}
      >
        <Table
          columns={invalidColumns}
          dataSource={invalidActivities}
          rowKey="activity_id"
          size="small"
          pagination={false}
          loading={invalidLoading}
        />
      </Modal>

      <Modal
        title="列设置"
        open={columnSettingsVisible}
        onOk={() => {
          setColumnSettingsVisible(false)
          localStorage.setItem('vfactdb-visible-columns', JSON.stringify(visibleColumns))
        }}
        onCancel={() => setColumnSettingsVisible(false)}
        okText="确定"
        cancelText="取消"
      >
        <Checkbox.Group
          value={visibleColumns}
          onChange={(values) => setVisibleColumns(values as string[])}
          style={{ width: '100%' }}
        >
          {AVAILABLE_COLUMNS.map(col => (
            <div key={col.key} style={{ marginBottom: 8 }}>
              <Checkbox value={col.key}>{col.title}</Checkbox>
            </div>
          ))}
        </Checkbox.Group>
      </Modal>
    </div>
  )
}

export default VFACTDBPage
