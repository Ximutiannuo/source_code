import React, { useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Card,
  Table,
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Switch,
  Space,
  App,
  Popconfirm,
  Badge,
  Spin,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TeamOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { departmentService, Department, DepartmentCreate, DepartmentUpdate } from '../services/departmentService'
import { useAuth } from '../contexts/AuthContext'

function formatApiDetail(detail: unknown, fallback: string): string {
  if (detail == null) return fallback
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map((e: { msg?: string }) => (e?.msg ?? String(e))).filter(Boolean).join('；') || fallback
  }
  if (typeof detail === 'object' && detail !== null && 'msg' in detail) {
    return (detail as { msg: string }).msg
  }
  return fallback
}

const DepartmentManagement: React.FC = () => {
  const { message: messageApi } = App.useApp()
  const { user: currentUser, loading } = useAuth()
  const queryClient = useQueryClient()
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [editing, setEditing] = useState<Department | null>(null)
  const [form] = Form.useForm()

  const { data: departments = [], isLoading, refetch } = useQuery({
    queryKey: ['departmentsAdmin'],
    queryFn: () => departmentService.listDepartmentsAdmin(),
    enabled: !!currentUser?.id,
  })

  const createMutation = useMutation({
    mutationFn: (data: DepartmentCreate) => departmentService.create(data),
    onSuccess: () => {
      messageApi.success('部门已创建')
      queryClient.invalidateQueries({ queryKey: ['departmentsAdmin'] })
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      setDrawerVisible(false)
      form.resetFields()
      setEditing(null)
    },
    onError: (err: any) => {
      messageApi.error(formatApiDetail(err?.response?.data?.detail, '创建失败'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: DepartmentUpdate }) => departmentService.update(id, data),
    onSuccess: () => {
      messageApi.success('部门已更新')
      queryClient.invalidateQueries({ queryKey: ['departmentsAdmin'] })
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      setDrawerVisible(false)
      form.resetFields()
      setEditing(null)
    },
    onError: (err: any) => {
      messageApi.error(formatApiDetail(err?.response?.data?.detail, '更新失败'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => departmentService.delete(id),
    onSuccess: () => {
      messageApi.success('部门已删除')
      queryClient.invalidateQueries({ queryKey: ['departmentsAdmin'] })
      queryClient.invalidateQueries({ queryKey: ['departments'] })
    },
    onError: (err: any) => {
      messageApi.error(formatApiDetail(err?.response?.data?.detail, '删除失败'))
    },
  })

  const handleAdd = () => {
    setEditing(null)
    form.resetFields()
    setDrawerVisible(true)
  }

  const handleEdit = (record: Department) => {
    setEditing(record)
    form.setFieldsValue({
      code: record.code,
      name: record.name,
      is_active: record.is_active,
      sort_order: record.sort_order,
    })
    setDrawerVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editing) {
        updateMutation.mutate({ id: editing.id, data: values })
      } else {
        createMutation.mutate(values as DepartmentCreate)
      }
    } catch {
      // 校验未通过
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    )
  }
  if (!currentUser) {
    return <Navigate to="/login" replace />
  }
  const canAccess = currentUser?.can_access_account_management || currentUser?.is_superuser || currentUser?.username === 'role_system_admin'
  if (!canAccess) {
    return <Navigate to="/" replace />
  }

  const columns = [
    { title: '代码', dataIndex: 'code', key: 'code', width: 160, ellipsis: true },
    { title: '名称', dataIndex: 'name', key: 'name', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (v: boolean) => (
        <Badge status={v ? 'success' : 'default'} text={v ? '启用' : '禁用'} />
      ),
    },
    { title: '排序', dataIndex: 'sort_order', key: 'sort_order', width: 80 },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right' as const,
      render: (_: unknown, record: Department) => (
        <Space size="small">
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定要删除该部门吗？"
            description="若该部门下有关联用户则无法删除，请先在账号管理中调整用户部门。"
            onConfirm={() => deleteMutation.mutate(record.id)}
          >
            <Button type="text" danger size="small" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: 'calc(100vh - 64px)' }}>
      <Card
        title={
          <Space>
            <TeamOutlined />
            <span>部门管理</span>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              新建部门
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={departments}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 560 }}
          pagination={{
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            pageSizeOptions: ['10', '20', '50'],
          }}
        />
      </Card>

      <Drawer
        title={editing ? '编辑部门' : '新建部门'}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false)
          form.resetFields()
          setEditing(null)
        }}
        width={480}
        destroyOnClose
        footer={
          <Space>
            <Button onClick={() => setDrawerVisible(false)}>取消</Button>
            <Button type="primary" onClick={handleSubmit} loading={createMutation.isPending || updateMutation.isPending}>
              保存
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="code"
            label="部门代码"
            rules={[{ required: true, message: '请输入部门代码' }]}
          >
            <Input placeholder="如 design, procurement" />
          </Form.Item>
          <Form.Item
            name="name"
            label="部门名称"
            rules={[{ required: true, message: '请输入部门名称' }]}
          >
            <Input placeholder="如 设计管理部" />
          </Form.Item>
          <Form.Item name="is_active" label="启用" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
          <Form.Item name="sort_order" label="排序" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}

export default DepartmentManagement
