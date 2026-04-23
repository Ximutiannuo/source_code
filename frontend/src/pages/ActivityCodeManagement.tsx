import { useEffect, useRef, useState } from 'react'
import { Table, Input, Select, Button, Space, App, Dropdown, Pagination } from 'antd'
import { ExportOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { activityCodeService, type ActivityCode } from '../services/activityCodeService'
import dayjs from 'dayjs'
import ExcelJS from 'exceljs'

const { Option } = Select

const ActivityCodeManagement = () => {
  const { message } = App.useApp()
  const [filters, setFilters] = useState({
    code_type_name: '',
    code_type_scope: '',
    code_value: '',
    search: '',
    is_active: undefined as boolean | undefined,
  })
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50 })
  const tableAreaRef = useRef<HTMLDivElement | null>(null)
  const paginationBarRef = useRef<HTMLDivElement | null>(null)
  const [bodyHeight, setBodyHeight] = useState<number>(360)

  // 获取代码类型列表
  const { data: codeTypes } = useQuery({
    queryKey: ['activity-code-types'],
    queryFn: () => activityCodeService.getCodeTypes(),
  })

  // 获取代码作用域列表
  const { data: codeScopes } = useQuery({
    queryKey: ['activity-code-scopes'],
    queryFn: () => activityCodeService.getCodeScopes(),
  })

  // 获取作业分类码列表
  const { data, isLoading } = useQuery({
    queryKey: ['activity-codes', filters, pagination.current, pagination.pageSize],
    queryFn: async () => {
      const result = await activityCodeService.getActivityCodes({
        code_type_name: filters.code_type_name || undefined,
        code_type_scope: filters.code_type_scope || undefined,
        code_value: filters.code_value || undefined,
        search: filters.search || undefined,
        is_active: filters.is_active,
        skip: (pagination.current - 1) * pagination.pageSize,
        limit: pagination.pageSize,
      })
      return {
        items: Array.isArray(result.items) ? result.items : [],
        total: result.total || 0,
      }
    },
  })

  // 获取所有数据（用于导出）
  const fetchAllData = async (): Promise<ActivityCode[]> => {
    const allItems: ActivityCode[] = []
    const pageSize = 10000
    let skip = 0
    let hasMore = true
    
    while (hasMore) {
      const result = await activityCodeService.getActivityCodes({
        code_type_name: filters.code_type_name || undefined,
        code_type_scope: filters.code_type_scope || undefined,
        code_value: filters.code_value || undefined,
        search: filters.search || undefined,
        is_active: filters.is_active,
        skip,
        limit: pageSize,
      })
      
      if (result.items && result.items.length > 0) {
        allItems.push(...result.items)
        skip += pageSize
        hasMore = result.items.length === pageSize && allItems.length < result.total
      } else {
        hasMore = false
      }
    }
    
    return allItems
  }

  const handleExportCSV = async () => {
    try {
      message.loading({ content: '正在导出CSV...', key: 'export', duration: 0 })
      
      const items = await fetchAllData()
      const headers = ['代码类型名称', '代码类型作用域', '代码值', '序号', '描述', '是否激活', '创建时间', '更新时间', '最后同步时间']
      
      const csvRows = [
        headers.join(','),
        ...items.map((item: ActivityCode) => [
          `"${item.code_type_name || ''}"`,
          `"${item.code_type_scope || ''}"`,
          `"${item.code_value || ''}"`,
          item.sequence_number ?? '',
          `"${(item.description || '').replace(/"/g, '""')}"`,
          item.is_active ? '是' : '否',
          item.created_at ? dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss') : '',
          item.updated_at ? dayjs(item.updated_at).format('YYYY-MM-DD HH:mm:ss') : '',
          item.last_sync_at ? dayjs(item.last_sync_at).format('YYYY-MM-DD HH:mm:ss') : '',
        ].join(','))
      ]
      
      const csvContent = csvRows.join('\n')
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `作业分类码_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.csv`
      link.click()
      URL.revokeObjectURL(url)
      message.success({ content: `已导出 ${items.length} 条记录`, key: 'export' })
    } catch (error: any) {
      message.error({ content: error?.response?.data?.detail || '导出失败', key: 'export' })
    }
  }

  const handleExportXLSX = async () => {
    try {
      message.loading({ content: '正在导出Excel...', key: 'export', duration: 0 })
      
      const items = await fetchAllData()
      // const headers = ['代码类型名称', '代码类型作用域', '代码值', '序号', '描述', '是否激活', '创建时间', '更新时间', '最后同步时间']
      
      // 创建工作簿
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('作业分类码')
      
      // 设置表头
      worksheet.columns = [
        { header: '代码类型名称', key: 'code_type_name', width: 20 },
        { header: '代码类型作用域', key: 'code_type_scope', width: 15 },
        { header: '代码值', key: 'code_value', width: 20 },
        { header: '序号', key: 'sequence_number', width: 10 },
        { header: '描述', key: 'description', width: 40 },
        { header: '是否激活', key: 'is_active', width: 12 },
        { header: '创建时间', key: 'created_at', width: 20 },
        { header: '更新时间', key: 'updated_at', width: 20 },
        { header: '最后同步时间', key: 'last_sync_at', width: 20 },
      ]
      
      // 添加数据
      items.forEach((item: ActivityCode) => {
        worksheet.addRow({
          code_type_name: item.code_type_name || '',
          code_type_scope: item.code_type_scope || '',
          code_value: item.code_value || '',
          sequence_number: item.sequence_number ?? '',
          description: item.description || '',
          is_active: item.is_active ? '是' : '否',
          created_at: item.created_at ? dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss') : '',
          updated_at: item.updated_at ? dayjs(item.updated_at).format('YYYY-MM-DD HH:mm:ss') : '',
          last_sync_at: item.last_sync_at ? dayjs(item.last_sync_at).format('YYYY-MM-DD HH:mm:ss') : '',
        })
      })
      
      // 设置表头样式
      worksheet.getRow(1).font = { bold: true }
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      }
      
      // 导出文件
      const fileName = `作业分类码_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      link.click()
      window.URL.revokeObjectURL(url)
      
      message.success({ content: `已导出 ${items.length} 条记录`, key: 'export' })
    } catch (error: any) {
      message.error({ content: error?.message || '导出失败', key: 'export' })
    }
  }

  const exportMenuItems: MenuProps['items'] = [
    { key: 'csv', label: '导出为 CSV', onClick: handleExportCSV },
    { key: 'xlsx', label: '导出为 Excel (XLSX)', onClick: handleExportXLSX },
  ]

  const columns = [
    {
      title: '代码类型名称',
      dataIndex: 'code_type_name',
      key: 'code_type_name',
      width: 180,
      fixed: 'left' as const,
    },
    {
      title: '代码类型作用域',
      dataIndex: 'code_type_scope',
      key: 'code_type_scope',
      width: 120,
    },
    {
      title: '代码值',
      dataIndex: 'code_value',
      key: 'code_value',
      width: 150,
    },
    {
      title: '序号',
      dataIndex: 'sequence_number',
      key: 'sequence_number',
      width: 80,
      align: 'right' as const,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 300,
      ellipsis: true,
    },
    {
      title: '是否激活',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (value: boolean) => (value ? '是' : '否'),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 160,
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '最后同步时间',
      dataIndex: 'last_sync_at',
      key: 'last_sync_at',
      width: 160,
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
  ]

  useEffect(() => {
    const el = tableAreaRef.current
    if (!el) return

    const ro = new ResizeObserver(() => {
      const h = el.getBoundingClientRect().height
      const footerH = paginationBarRef.current?.getBoundingClientRect().height ?? 56
      const headerH =
        (el.querySelector('.activity-code-table .ant-table-header') as HTMLElement | null)?.getBoundingClientRect().height ??
        0
      const next = Math.max(160, Math.floor(h - footerH - headerH - 16))
      setBodyHeight(next)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <style>{`
        /* 横向滚动条兜底 */
        .activity-code-table .ant-table-body { overflow-x: auto !important; overflow-y: auto !important; }
        .activity-code-table .ant-table-content { overflow-x: auto !important; }
        .activity-code-table .ant-table-container { overflow: hidden; }

        /* 工具栏样式 */
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
        <h2 className="page-title">作业分类码</h2>
        <Space>
          <Input.Search
            placeholder="搜索代码值或描述"
            allowClear
            size="small"
            style={{ width: 220 }}
            onSearch={(v) => setFilters({ ...filters, search: v })}
          />
          <Select
            placeholder="代码类型"
            allowClear
            size="small"
            style={{ width: 150 }}
            showSearch
            filterOption={(input, option) =>
              (typeof option?.label === 'string' ? option.label : '').toLowerCase().includes(input.toLowerCase())
            }
            onChange={(v) => setFilters({ ...filters, code_type_name: v || '' })}
          >
            {codeTypes?.map((type) => (
              <Option key={type} value={type}>
                {type}
              </Option>
            ))}
          </Select>
          <Select
            placeholder="作用域"
            allowClear
            size="small"
            style={{ width: 120 }}
            onChange={(v) => setFilters({ ...filters, code_type_scope: v || '' })}
          >
            {codeScopes?.map((scope) => (
              <Option key={scope} value={scope}>
                {scope}
              </Option>
            ))}
          </Select>
          <Select
            placeholder="激活状态"
            allowClear
            size="small"
            style={{ width: 100 }}
            onChange={(v) => setFilters({ ...filters, is_active: v })}
          >
            <Option value={true}>激活</Option>
            <Option value={false}>未激活</Option>
          </Select>
          <Dropdown menu={{ items: exportMenuItems }} trigger={['click']}>
            <Button icon={<ExportOutlined />} size="small">
              导出
            </Button>
          </Dropdown>
        </Space>
      </div>

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
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <Table
            className="activity-code-table"
            columns={columns}
            dataSource={data?.items || []}
            loading={isLoading}
            rowKey="id"
            size="small"
            scroll={{
              x: 'max-content',
              y: bodyHeight,
            }}
            pagination={false}
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
            total={data?.total || 0}
            showSizeChanger
            showTotal={(total) => `共 ${total} 条记录`}
            onChange={(page, pageSize) => setPagination({ current: page, pageSize })}
          />
        </div>
      </div>
    </div>
  )
}

export default ActivityCodeManagement
