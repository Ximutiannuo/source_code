import { useEffect, useRef, useState } from 'react'
import { Table, Input, Select, Button, Space, Tag, Pagination } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { p6ResourceService, type P6Resource } from '../services/p6ResourceService'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'

const { Option } = Select

const ResourceManagement = () => {
  const [filters, setFilters] = useState({
    resource_id: '',
    resource_type: '',
    search: '',
    is_active: undefined as boolean | undefined,
  })
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50 })
  const tableAreaRef = useRef<HTMLDivElement | null>(null)
  const paginationBarRef = useRef<HTMLDivElement | null>(null)
  const [bodyHeight, setBodyHeight] = useState<number>(360)

  // 获取资源类型列表
  const { data: resourceTypes } = useQuery({
    queryKey: ['p6-resource-types'],
    queryFn: () => p6ResourceService.getResourceTypes(),
  })

  // 获取资源列表
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['p6-resources', filters, pagination.current, pagination.pageSize],
    queryFn: async () => {
      const result = await p6ResourceService.getP6Resources({
        resource_id: filters.resource_id || undefined,
        resource_type: filters.resource_type || undefined,
        search: filters.search || undefined,
        is_active: filters.is_active,
        skip: (pagination.current - 1) * pagination.pageSize,
        limit: pagination.pageSize,
      })
      return result
    },
  })

  const columns: ColumnsType<P6Resource> = [
    {
      title: 'Resource ID',
      dataIndex: 'resource_id',
      key: 'resource_id',
      width: 150,
      fixed: 'left',
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 250,
      ellipsis: true,
    },
    {
      title: '资源类型',
      dataIndex: 'resource_type',
      key: 'resource_type',
      width: 120,
      render: (type: string | null) => (
        <Tag color={type === 'Labor' ? 'blue' : type === 'Material' ? 'green' : 'orange'}>
          {type || '-'}
        </Tag>
      ),
    },
    {
      title: '单位',
      dataIndex: 'unit_of_measure',
      key: 'unit_of_measure',
      width: 100,
    },
    {
      title: '单价',
      dataIndex: 'price_per_unit',
      key: 'price_per_unit',
      width: 120,
      align: 'right',
      render: (price: number | null) => price?.toFixed(2) || '-',
    },
    {
      title: 'Object ID',
      dataIndex: 'object_id',
      key: 'object_id',
      width: 120,
    },
    {
      title: 'Calendar Object ID',
      dataIndex: 'calendar_object_id',
      key: 'calendar_object_id',
      width: 150,
      render: (id: number | null) => id ?? '-',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 300,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      align: 'center',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>{isActive ? '激活' : '未激活'}</Tag>
      ),
    },
    {
      title: '最后同步时间',
      dataIndex: 'last_sync_at',
      key: 'last_sync_at',
      width: 180,
      render: (date: string | null) => {
        if (!date) return '-'
        return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
      },
    },
  ]

  useEffect(() => {
    const el = tableAreaRef.current
    if (!el) return

    const ro = new ResizeObserver(() => {
      const h = el.getBoundingClientRect().height
      const footerH = paginationBarRef.current?.getBoundingClientRect().height ?? 56
      const headerH =
        (el.querySelector('.resource-table .ant-table-header') as HTMLElement | null)?.getBoundingClientRect().height ??
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
        .resource-table .ant-table-body { overflow-x: auto !important; overflow-y: auto !important; }
        .resource-table .ant-table-content { overflow-x: auto !important; }
        .resource-table .ant-table-container { overflow: hidden; }
      `}</style>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        flexShrink: 0
      }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1e293b' }}>资源管理</h2>
        <Space size="small">
          <Input.Search
            placeholder="搜索Resource ID、名称或描述"
            allowClear
            size="small"
            style={{ width: 250 }}
            onSearch={(v) => setFilters({ ...filters, search: v })}
          />
          <Input
            placeholder="Resource ID"
            allowClear
            size="small"
            style={{ width: 150 }}
            value={filters.resource_id}
            onChange={(e) => setFilters({ ...filters, resource_id: e.target.value })}
          />
          <Select
            placeholder="资源类型"
            allowClear
            size="small"
            style={{ width: 120 }}
            value={filters.resource_type}
            onChange={(v) => setFilters({ ...filters, resource_type: v || '' })}
          >
            {resourceTypes?.map((type) => (
              <Option key={type} value={type}>
                {type}
              </Option>
            ))}
          </Select>
          <Select
            placeholder="激活状态"
            allowClear
            size="small"
            style={{ width: 100 }}
            value={filters.is_active}
            onChange={(v) => setFilters({ ...filters, is_active: v })}
          >
            <Option value={true}>激活</Option>
            <Option value={false}>未激活</Option>
          </Select>
          <Button
            size="small"
            onClick={() => {
              setFilters({
                resource_id: '',
                resource_type: '',
                search: '',
                is_active: undefined,
              })
            }}
          >
            清除筛选
          </Button>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
            loading={isLoading}
          >
            刷新
          </Button>
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
            className="resource-table"
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

export default ResourceManagement

