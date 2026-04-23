import { useEffect, useRef, useState } from 'react'
import {
  Table,
  Input,
  Button,
  Space,
  App,
  Tag,
  Pagination,
  Drawer,
  Form,
  Switch,
  Popconfirm,
  Row,
  Col,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { facilityService, type Facility, type FacilityCreate, type FacilityUpdate } from '../services/facilityService'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'

const { TextArea } = Input

const FacilityManagement = () => {
  const { message: messageApi } = App.useApp()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState({
    project: '',
    subproject: '',
    train: '',
    unit: '',
    main_block: '',
    block: '',
    search: '',
  })
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50 })
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null)
  const [form] = Form.useForm()
  const tableAreaRef = useRef<HTMLDivElement | null>(null)
  const paginationBarRef = useRef<HTMLDivElement | null>(null)
  const [bodyHeight, setBodyHeight] = useState<number>(360)

  // 获取主项清单列表
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['facilities', filters, pagination.current, pagination.pageSize],
    queryFn: async () => {
      const result = await facilityService.getFacilities({
        project: filters.project || undefined,
        subproject: filters.subproject || undefined,
        train: filters.train || undefined,
        unit: filters.unit || undefined,
        main_block: filters.main_block || undefined,
        block: filters.block || undefined,
        search: filters.search || undefined,
        skip: (pagination.current - 1) * pagination.pageSize,
        limit: pagination.pageSize,
      })
      return result
    },
  })

  // 创建主项清单
  const createMutation = useMutation({
    mutationFn: (data: FacilityCreate) => facilityService.createFacility(data),
    onSuccess: () => {
      messageApi.success('创建成功')
      setDrawerVisible(false)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['facilities'] })
    },
    onError: (error: any) => {
      messageApi.error(error?.response?.data?.detail || '创建失败')
    },
  })

  // 更新主项清单
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FacilityUpdate }) =>
      facilityService.updateFacility(id, data),
    onSuccess: () => {
      messageApi.success('更新成功')
      setDrawerVisible(false)
      setEditingFacility(null)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['facilities'] })
    },
    onError: (error: any) => {
      messageApi.error(error?.response?.data?.detail || '更新失败')
    },
  })

  // 删除主项清单
  const deleteMutation = useMutation({
    mutationFn: (id: number) => facilityService.deleteFacility(id),
    onSuccess: () => {
      messageApi.success('删除成功')
      queryClient.invalidateQueries({ queryKey: ['facilities'] })
    },
    onError: (error: any) => {
      messageApi.error(error?.response?.data?.detail || '删除失败')
    },
  })

  // 打开创建/编辑抽屉
  const handleOpenDrawer = (facility?: Facility) => {
    if (facility) {
      setEditingFacility(facility)
      form.setFieldsValue({
        ...facility,
      })
    } else {
      setEditingFacility(null)
      form.resetFields()
    }
    setDrawerVisible(true)
  }

  // 关闭抽屉
  const handleCloseDrawer = () => {
    setDrawerVisible(false)
    setEditingFacility(null)
    form.resetFields()
  }

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingFacility) {
        updateMutation.mutate({ id: editingFacility.id, data: values })
      } else {
        createMutation.mutate(values)
      }
    } catch (error) {
      // 表单验证失败（错误已通过message显示，不需要额外日志）
    }
  }

  // 删除确认
  const handleDelete = (id: number) => {
    deleteMutation.mutate(id)
  }

  const columns: ColumnsType<Facility> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      fixed: 'left',
    },
    {
      title: 'Block',
      dataIndex: 'block',
      key: 'block',
      width: 120,
    },
    {
      title: 'Project',
      dataIndex: 'project',
      key: 'project',
      width: 120,
    },
    {
      title: 'Sub-project',
      dataIndex: 'subproject',
      key: 'subproject',
      width: 120,
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
      title: 'Main Block',
      dataIndex: 'main_block',
      key: 'main_block',
      width: 120,
    },
    {
      title: 'Descriptions',
      dataIndex: 'descriptions',
      key: 'descriptions',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'Simple Block',
      dataIndex: 'simple_block',
      key: 'simple_block',
      width: 120,
    },
    {
      title: 'Quarter',
      dataIndex: 'quarter',
      key: 'quarter',
      width: 100,
    },
    {
      title: '启动序列',
      dataIndex: 'start_up_sequence',
      key: 'start_up_sequence',
      width: 120,
    },
    {
      title: 'Title Type',
      dataIndex: 'title_type',
      key: 'title_type',
      width: 120,
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
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string | null) => {
        if (!date) return '-'
        return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 180,
      render: (date: string | null) => {
        if (!date) return '-'
        return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenDrawer(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这条记录吗？"
            onConfirm={() => handleDelete(record.id)}
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
  ]

  useEffect(() => {
    const el = tableAreaRef.current
    if (!el) return

    const ro = new ResizeObserver(() => {
      const h = el.getBoundingClientRect().height
      const footerH = paginationBarRef.current?.getBoundingClientRect().height ?? 56
      const headerH =
        (el.querySelector('.facility-table .ant-table-header') as HTMLElement | null)?.getBoundingClientRect().height ??
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
        .facility-table .ant-table-body { overflow-x: auto !important; overflow-y: auto !important; }
        .facility-table .ant-table-content { overflow-x: auto !important; }
        .facility-table .ant-table-container { overflow: hidden; }
      `}</style>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          flexShrink: 0,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1e293b' }}>主项清单管理</h2>
        <Space size="small">
          <Input.Search
            placeholder="搜索Block、Project、Unit等"
            allowClear
            size="small"
            style={{ width: 250 }}
            onSearch={(v) => setFilters({ ...filters, search: v })}
          />
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => {
              refetch()
              setFilters({
                project: '',
                subproject: '',
                train: '',
                unit: '',
                main_block: '',
                block: '',
                search: '',
              })
              setPagination({ current: 1, pageSize: 50 })
            }}
          >
            重置
          </Button>
          <Button type="primary" icon={<PlusOutlined />} size="small" onClick={() => handleOpenDrawer()}>
            新增
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
            className="facility-table"
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

      {/* 创建/编辑抽屉 */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>
              {editingFacility ? '编辑主项清单' : '新增主项清单'}
            </span>
          </div>
        }
        open={drawerVisible}
        onClose={handleCloseDrawer}
        width={720}
        styles={{
          body: {
            padding: '20px 24px',
            background: '#f8fafc',
          },
          header: {
            padding: '16px 24px',
            borderBottom: '1px solid #e2e8f0',
            background: '#ffffff',
          },
        }}
        extra={
          <Space>
            <Button onClick={handleCloseDrawer}>取消</Button>
            <Button 
              type="primary" 
              onClick={handleSubmit} 
              loading={createMutation.isPending || updateMutation.isPending}
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                border: 'none',
                boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)',
              }}
            >
              确定
            </Button>
          </Space>
        }
      >
        <div style={{ 
          background: '#ffffff', 
          borderRadius: '8px', 
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        }}>
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              is_active: true,
            }}
            style={{ margin: 0 }}
          >
            {/* 基础信息区域 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ 
                fontSize: 13, 
                fontWeight: 600, 
                color: '#475569', 
                marginBottom: 12,
                paddingBottom: 8,
                borderBottom: '2px solid #e2e8f0',
              }}>
                基础信息
              </div>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="block" label={<span style={{ fontSize: 12, fontWeight: 500 }}>Block</span>}>
                    <Input 
                      placeholder="请输入Block" 
                      size="middle"
                      style={{ borderRadius: '6px' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="project" label={<span style={{ fontSize: 12, fontWeight: 500 }}>Project</span>}>
                    <Input 
                      placeholder="请输入Project" 
                      size="middle"
                      style={{ borderRadius: '6px' }}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="subproject" label={<span style={{ fontSize: 12, fontWeight: 500 }}>Sub-project</span>}>
                    <Input 
                      placeholder="请输入Sub-project" 
                      size="middle"
                      style={{ borderRadius: '6px' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="train" label={<span style={{ fontSize: 12, fontWeight: 500 }}>Train</span>}>
                    <Input 
                      placeholder="请输入Train" 
                      size="middle"
                      style={{ borderRadius: '6px' }}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="unit" label={<span style={{ fontSize: 12, fontWeight: 500 }}>Unit</span>}>
                    <Input 
                      placeholder="请输入Unit" 
                      size="middle"
                      style={{ borderRadius: '6px' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="main_block" label={<span style={{ fontSize: 12, fontWeight: 500 }}>Main Block</span>}>
                    <Input 
                      placeholder="请输入Main Block" 
                      size="middle"
                      style={{ borderRadius: '6px' }}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            {/* 详细信息区域 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ 
                fontSize: 13, 
                fontWeight: 600, 
                color: '#475569', 
                marginBottom: 12,
                paddingBottom: 8,
                borderBottom: '2px solid #e2e8f0',
              }}>
                详细信息
              </div>
              <Form.Item name="descriptions" label={<span style={{ fontSize: 12, fontWeight: 500 }}>Descriptions</span>}>
                <TextArea 
                  rows={3} 
                  placeholder="请输入Descriptions" 
                  style={{ borderRadius: '6px' }}
                />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="simple_block" label={<span style={{ fontSize: 12, fontWeight: 500 }}>Simple Block</span>}>
                    <Input 
                      placeholder="请输入Simple Block" 
                      size="middle"
                      style={{ borderRadius: '6px' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="quarter" label={<span style={{ fontSize: 12, fontWeight: 500 }}>Quarter</span>}>
                    <Input 
                      placeholder="请输入Quarter" 
                      size="middle"
                      style={{ borderRadius: '6px' }}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="start_up_sequence" label={<span style={{ fontSize: 12, fontWeight: 500 }}>启动序列</span>}>
                    <Input 
                      placeholder="请输入启动序列" 
                      size="middle"
                      style={{ borderRadius: '6px' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="title_type" label={<span style={{ fontSize: 12, fontWeight: 500 }}>Title Type</span>}>
                    <Input 
                      placeholder="请输入Title Type" 
                      size="middle"
                      style={{ borderRadius: '6px' }}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            {/* 状态设置 */}
            <div style={{ 
              padding: '16px',
              background: '#f1f5f9',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
            }}>
              <Form.Item 
                name="is_active" 
                label={<span style={{ fontSize: 12, fontWeight: 500, color: '#475569' }}>状态</span>}
                valuePropName="checked"
                style={{ marginBottom: 0 }}
              >
                <Switch 
                  checkedChildren="激活" 
                  unCheckedChildren="未激活"
                  style={{
                    background: form.getFieldValue('is_active') ? '#10b981' : '#94a3b8',
                  }}
                />
              </Form.Item>
            </div>
          </Form>
        </div>
      </Drawer>
    </div>
  )
}

export default FacilityManagement

