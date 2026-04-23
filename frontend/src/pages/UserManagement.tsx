import React, { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { logger } from '../utils/logger'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Switch,
  Space,
  App,
  Popconfirm,
  Tag,
  Spin,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userService } from '../services/userService'
import type { User, UserCreate, UserUpdate } from '../services/authService'
import { useAuth } from '../contexts/AuthContext'

const UserManagement: React.FC = () => {
  const { message } = App.useApp()
  const { user: currentUser, loading } = useAuth()
  
  // 调试信息
  React.useEffect(() => {
    logger.log('UserManagement - currentUser:', currentUser)
    logger.log('UserManagement - is_superuser:', currentUser?.is_superuser)
    logger.log('UserManagement - loading:', loading)
  }, [currentUser, loading])
  
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    )
  }
  
  // 检查是否是超级管理员
  if (!currentUser) {
    logger.warn('UserManagement - 用户未登录，重定向到登录页')
    return <Navigate to="/login" replace />
  }
  
  if (!currentUser.is_superuser) {
    logger.warn('UserManagement - 用户不是超级管理员，重定向到首页')
    return <Navigate to="/" replace />
  }
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [modalVisible, setModalVisible] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [searchText, setSearchText] = useState('')

  // 获取用户列表
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users', searchText],
    queryFn: () => userService.getUsers({ search: searchText || undefined }),
  })
  const users = usersData?.items ?? []

  // 创建用户
  const createMutation = useMutation({
    mutationFn: (data: UserCreate) => userService.createUser(data),
    onSuccess: () => {
      message.success('用户创建成功')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setModalVisible(false)
      form.resetFields()
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '创建用户失败')
    },
  })

  // 更新用户
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UserUpdate }) =>
      userService.updateUser(id, data),
    onSuccess: () => {
      message.success('用户更新成功')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setModalVisible(false)
      form.resetFields()
      setEditingUser(null)
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '更新用户失败')
    },
  })

  // 删除用户
  const deleteMutation = useMutation({
    mutationFn: (id: number) => userService.deleteUser(id),
    onSuccess: () => {
      message.success('用户删除成功')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '删除用户失败')
    },
  })

  const handleAdd = () => {
    setEditingUser(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (record: User) => {
    setEditingUser(record)
    form.setFieldsValue({
      ...record,
      password: undefined, // 不显示密码
    })
    setModalVisible(true)
  }

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingUser) {
        updateMutation.mutate({ id: editingUser.id, data: values })
      } else {
        createMutation.mutate(values as UserCreate)
      }
    } catch (error) {
      // 表单验证失败
    }
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (text: string, record: User) => (
        <Space>
          <UserOutlined />
          <span>{text}</span>
          {record.is_superuser && <Tag color="red">超级管理员</Tag>}
        </Space>
      ),
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '全名',
      dataIndex: 'full_name',
      key: 'full_name',
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? '激活' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: User) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            disabled={!currentUser?.is_superuser}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个用户吗？"
            onConfirm={() => handleDelete(record.id)}
            disabled={record.id === currentUser?.id || !currentUser?.is_superuser}
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              disabled={record.id === currentUser?.id || !currentUser?.is_superuser}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Input.Search
          placeholder="搜索用户名或邮箱"
          style={{ width: 300 }}
          onSearch={setSearchText}
          allowClear
          id="user-search"
        />
        {currentUser?.is_superuser && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新建用户
          </Button>
        )}
      </div>

      <Table
        columns={columns}
        dataSource={users}
        loading={isLoading}
        rowKey="id"
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
      />

      <Modal
        title={editingUser ? '编辑用户' : '新建用户'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false)
          form.resetFields()
          setEditingUser(null)
        }}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={600}
      >
        <Form form={form} layout="vertical">
          {!editingUser && (
            <Form.Item
              name="username"
              label="用户名"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input id="user-username" />
            </Form.Item>
          )}

          <Form.Item
            name="email"
            label="邮箱"
            rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
          >
            <Input id="user-email" />
          </Form.Item>

          <Form.Item name="full_name" label="全名">
            <Input id="user-full-name" />
          </Form.Item>

          <Form.Item
            name="password"
            label={editingUser ? '新密码（留空则不修改）' : '密码'}
            rules={
              !editingUser
                ? [{ required: true, message: '请输入密码' }]
                : undefined
            }
          >
            <Input.Password id="user-password" />
          </Form.Item>

          {currentUser?.is_superuser && (
            <>
              <Form.Item
                name="is_active"
                label="状态"
                valuePropName="checked"
                initialValue={true}
              >
                <Switch id="user-is-active" checkedChildren="激活" unCheckedChildren="禁用" />
              </Form.Item>

              <Form.Item
                name="is_superuser"
                label="超级管理员"
                valuePropName="checked"
                initialValue={false}
              >
                <Switch id="user-is-superuser" checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </div>
  )
}

export default UserManagement
