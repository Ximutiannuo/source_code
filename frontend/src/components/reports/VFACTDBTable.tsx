import { Table, Button, Space, Popconfirm, Input, Checkbox, Modal, App } from 'antd'
import { EditOutlined, DeleteOutlined, SettingOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reportService } from '../../services/reportService'
import type { VFACTDBResponse } from '../../types/report'
import dayjs from 'dayjs'
import { useState, useContext, useMemo, useEffect, useRef } from 'react'
import { GlobalFilterContext } from '../layout/MainLayout'
import { useResizableColumns, ResizableHeaderCell } from '../../hooks/useResizableColumns'
import type { ColumnsType } from 'antd/es/table'
import { logger } from '../../utils/logger'
import { formatHighPrecisionValue } from '../../utils/formatNumber'


interface VFACTDBTableProps {
  onEdit: (record: VFACTDBResponse) => void
}

// 可用的栏位定义
const AVAILABLE_COLUMNS = [
  { key: 'date', title: '日期', width: 100 },
  { key: 'activity_id', title: '作业ID', width: 150 },
  { key: 'title', title: '描述', width: 200 },
  { key: 'achieved', title: '完成工程量', width: 100, align: 'right' as const },
  { key: 'block', title: 'Block', width: 100 },
  { key: 'discipline', title: '专业', width: 80 },
  { key: 'work_package', title: '工作包', width: 100 },
  { key: 'scope', title: 'Scope', width: 80 },
  { key: 'work_step_description', title: '工作步骤描述', width: 150 },
  { key: 'project', title: 'Project', width: 100 },
  { key: 'subproject', title: '子项目', width: 100 },
  { key: 'implement_phase', title: 'Phase', width: 80 },
  { key: 'train', title: 'Train', width: 80 },
  { key: 'unit', title: 'Unit', width: 80 },
  { key: 'quarter', title: 'BCC季度', width: 100 },
  { key: 'main_block', title: '主Block', width: 100 },
]

const VFACTDBTable = ({ onEdit }: VFACTDBTableProps) => {
  const { message: messageApi } = App.useApp()
  const queryClient = useQueryClient()
  const globalFilter = useContext(GlobalFilterContext)
  const containerRef = useRef<HTMLDivElement>(null)
  const [tableHeight, setTableHeight] = useState(0)
  
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
    return ['date', 'activity_id', 'title', 'achieved', 'block', 'discipline', 'work_package']
  })
  const [columnSettingsVisible, setColumnSettingsVisible] = useState(false)
  const [localFilters, setLocalFilters] = useState({
    activity_id: '',
  })

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

    // 额外筛选器 (Discipline, Work Package, etc.)
    if (globalFilter.discipline && globalFilter.discipline.length > 0) {
      filterObj.discipline = globalFilter.discipline
    }
    if (globalFilter.work_package && globalFilter.work_package.length > 0) {
      filterObj.work_package = globalFilter.work_package
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
      filterObj.start_date = globalFilter.date_range[0].format('YYYY-MM-DD')
      filterObj.end_date = globalFilter.date_range[1].format('YYYY-MM-DD')
    }
    
    // 本地筛选
    if (localFilters.activity_id) {
      filterObj.activity_id = localFilters.activity_id
    }
    
    return filterObj
  }, [globalFilter, localFilters])

  const { data, isLoading } = useQuery({
    queryKey: ['vfactdb', filters, pagination.current, pagination.pageSize],
    queryFn: () =>
      reportService.getVFACTDB({
        ...filters,
        skip: (pagination.current - 1) * pagination.pageSize,
        limit: pagination.pageSize,
      }),
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
    if (!data) return 0
    if (data && typeof data === 'object' && 'total' in data) {
      return data.total || 0
    }
    return 0
  }, [data])

  const deleteMutation = useMutation({
    mutationFn: reportService.deleteVFACTDB,
    onSuccess: () => {
      messageApi.success('删除成功')
      queryClient.invalidateQueries({ queryKey: ['vfactdb'] })
      queryClient.invalidateQueries({ queryKey: ['daily-report-management'] })
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail
      if (error.response?.status === 403 && detail) {
        Modal.error({
          title: '删除失败 - 作业已锁定',
          content: (
            <div style={{ marginTop: '10px' }}>
              <p>{detail}</p>
              <p style={{ fontSize: '12px', color: '#8c8c8c', marginTop: '15px' }}>
                提示：已确认完成的作业处于锁定状态，禁止删除或修改数据。如需操作，请先前往“计划管理”重新打开该作业。
              </p>
            </div>
          ),
          okText: '知道了',
          width: 450,
        })
      } else {
        messageApi.error(`删除失败: ${detail || error.message || '未知错误'}`)
      }
    },
  })

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id)
  }

  // 计算表格高度
  useEffect(() => {
    const updateTableHeight = () => {
      if (containerRef.current) {
        const container = containerRef.current
        const headerHeight = container.querySelector('.table-header')?.getBoundingClientRect().height || 0
        const filterHeight = container.querySelector('.table-filter')?.getBoundingClientRect().height || 0
        const paginationHeight = 64 // 分页器高度
        const availableHeight = container.clientHeight - headerHeight - filterHeight - paginationHeight
        setTableHeight(Math.max(200, availableHeight))
      }
    }

    updateTableHeight()
    window.addEventListener('resize', updateTableHeight)
    return () => window.removeEventListener('resize', updateTableHeight)
  }, [])

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
        render: (value: any) => {
          if (colDef.key === 'date') {
            return dayjs(value).format('YYYY-MM-DD')
          }
          if (colDef.key === 'achieved') {
            return formatHighPrecisionValue(value)
          }
          return value
        },
      }
    }).filter(Boolean) as any[]
    
    // 添加操作列
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
            onClick={() => onEdit(record)}
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
  }, [visibleColumns, onEdit, handleDelete])

  // 使用可调整列宽 hook
  const { columns, tableWidth, tableRef: resizableTableRef, resetColumns } = useResizableColumns({
    persistKey: 'vfactdb-comp-v2',
    columns: defaultColumns,
  })

  // 当筛选条件变化时，重置分页
  useEffect(() => {
    setPagination({ current: 1, pageSize: 100 })
  }, [filters])

  return (
    <div 
      ref={containerRef}
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%',
        overflow: 'hidden',
        background: '#f5f5f5'
      }}
    >
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
      `}</style>
      {/* 顶部工具栏 */}
      <div 
        className="table-header"
        style={{ 
          background: '#ffffff', 
          borderBottom: '1px solid #d9d9d9',
          padding: '6px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0
        }}
      >
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#333' }}>VFACTDB 工程量日报</h2>
        <Space size="small">
          <Button
            icon={<ReloadOutlined />}
            onClick={resetColumns}
            size="small"
            title="重置列宽"
          >
            重置列宽
          </Button>
          <Button
            icon={<SettingOutlined />}
            onClick={() => setColumnSettingsVisible(true)}
            size="small"
          >
            列设置
          </Button>
        </Space>
      </div>

      {/* 筛选器区域 */}
      <div 
        className="table-filter"
        style={{ 
          background: '#fafafa', 
          borderBottom: '1px solid #d9d9d9',
          padding: '8px 16px',
          flexShrink: 0
        }}
      >
        <Space wrap>
          <Input
            placeholder="作业ID"
            style={{ width: 200 }}
            allowClear
            size="small"
            value={localFilters.activity_id}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
              setLocalFilters({ ...localFilters, activity_id: e.target.value })
            }
          />
          <Button 
            onClick={() => setLocalFilters({ activity_id: '' })}
            size="small"
          >
            重置
          </Button>
        </Space>
      </div>

      {/* 表格区域 */}
      <div 
        ref={resizableTableRef}
        style={{ 
          flex: 1, 
          overflow: 'hidden',
          minHeight: 0,
          background: '#ffffff',
          padding: 0
        }}
      >
        <Table
          className="vfactdb-table"
          columns={columns}
          dataSource={items}
          loading={isLoading}
          rowKey="id"
          scroll={{ 
            x: tableWidth,
            y: tableHeight > 0 ? tableHeight : undefined
          }}
          components={{
            header: {
              cell: ResizableHeaderCell,
            },
          }}
          size="small"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: total,
            showSizeChanger: true,
            showTotal: (total: number) => `共 ${total} 条记录`,
            onChange: (page: number, pageSize: number) => {
              setPagination({ current: page, pageSize })
            },
            pageSizeOptions: ['50', '100', '200', '500'],
            style: { 
              margin: '8px 16px',
              fontSize: '12px'
            }
          }}
          style={{ 
            fontSize: '12px'
          }}
        />
      </div>

      {/* 列设置Modal */}
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

export default VFACTDBTable
