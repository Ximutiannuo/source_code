import React from 'react'
import { Navigate } from 'react-router-dom'
import {
  Card,
  Form,
  Input,
  Button,
  Select,
  Space,
  message,
  Divider,
  Alert,
} from 'antd'
import {
  UserOutlined,
  LockOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authService, UserUpdate } from '../services/authService'
import { departmentService } from '../services/departmentService'
import { useAuth } from '../contexts/AuthContext'

const Profile: React.FC = () => {
  const { user, refreshUser, loading } = useAuth()
  const [form] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const queryClient = useQueryClient()

  if (loading) {
    return <div>加载中...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentService.listDepartments(),
  })
  const departmentOptions = departments.map((d) => ({ value: d.id, label: d.name }))

  // 更新用户信息
  const updateUserMutation = useMutation({
    mutationFn: (data: UserUpdate) => authService.updateCurrentUser(data),
    onSuccess: () => {
      message.success('个人信息更新成功')
      refreshUser()
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '更新失败')
    },
  })

  // 修改密码
  const changePasswordMutation = useMutation({
    mutationFn: (data: { old_password: string; new_password: string }) => {
      // 先验证旧密码
      return authService.login({ username: user.username, password: data.old_password })
        .then(() => {
          // 旧密码正确，更新密码
          return authService.updateCurrentUser({ password: data.new_password })
        })
    },
    onSuccess: () => {
      message.success('密码修改成功，请重新登录')
      passwordForm.resetFields()
      setTimeout(() => {
        authService.logout()
        window.location.href = '/login'
      }, 1500)
    },
    onError: (error: any) => {
      if (error.response?.status === 401) {
        message.error('原密码错误')
      } else {
        message.error(error.response?.data?.detail || '密码修改失败')
      }
    },
  })

  const handleUpdateProfile = async () => {
    try {
      const values = await form.validateFields()
      updateUserMutation.mutate(values)
    } catch (error) {
      // 表单验证失败
    }
  }

  const handleChangePassword = async () => {
    try {
      const values = await passwordForm.validateFields()
      if (values.new_password !== values.confirm_password) {
        message.error('两次输入的密码不一致')
        return
      }
      changePasswordMutation.mutate({
        old_password: values.old_password,
        new_password: values.new_password,
      })
    } catch (error) {
      // 表单验证失败
    }
  }

  return (
    <div style={{ 
      padding: '24px', 
      background: '#f0f2f5', 
      height: '100%',
      overflowY: 'auto',
      boxSizing: 'border-box'
    }}>
      <Card
        title={
          <Space>
            <UserOutlined />
            <span>个人设置</span>
          </Space>
        }
        style={{ maxWidth: 800, margin: '0 auto' }}
      >
        {/* 基本信息 */}
        <Card
          type="inner"
          title="基本信息"
          style={{ marginBottom: 24 }}
        >
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              email: user.email,
              full_name: user.full_name,
              department_id: user.department_id ?? undefined,
              responsible_for: user.responsible_for ?? '',
            }}
          >
            <Form.Item
              name="email"
              label="邮箱"
              rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
            >
              <Input placeholder="请输入邮箱" />
            </Form.Item>

            <Form.Item
              name="full_name"
              label="全名"
            >
              <Input placeholder="请输入全名" />
            </Form.Item>

            <Form.Item name="department_id" label="部门">
              <Select allowClear placeholder="请选择部门" options={departmentOptions} />
            </Form.Item>

            <Form.Item
              name="responsible_for"
              label="主要工作职责"
            >
              <Input.TextArea rows={3} placeholder="如：采购对接、设计审批、施工协调等" />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleUpdateProfile}
                loading={updateUserMutation.isPending}
              >
                保存
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <Divider />

        {/* 修改密码 */}
        <Card
          type="inner"
          title={
            <Space>
              <LockOutlined />
              <span>修改密码</span>
            </Space>
          }
        >
          <Alert
            message="安全提示"
            description="修改密码后需要重新登录"
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />
          <Form
            form={passwordForm}
            layout="vertical"
          >
            <Form.Item
              name="old_password"
              label="原密码"
              rules={[{ required: true, message: '请输入原密码' }]}
            >
              <Input.Password placeholder="请输入原密码" />
            </Form.Item>

            <Form.Item
              name="new_password"
              label="新密码"
              rules={[
                { required: true, message: '请输入新密码' },
                { min: 6, message: '密码长度至少6位' },
              ]}
            >
              <Input.Password placeholder="请输入新密码" />
            </Form.Item>

            <Form.Item
              name="confirm_password"
              label="确认新密码"
              dependencies={['new_password']}
              rules={[
                { required: true, message: '请确认新密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('new_password') === value) {
                      return Promise.resolve()
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'))
                  },
                }),
              ]}
            >
              <Input.Password placeholder="请再次输入新密码" />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                icon={<LockOutlined />}
                onClick={handleChangePassword}
                loading={changePasswordMutation.isPending}
              >
                修改密码
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </Card>
    </div>
  )
}

export default Profile

