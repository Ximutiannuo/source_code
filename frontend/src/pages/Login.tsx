import React, { useEffect, useState } from 'react'
import { Button, Card, Form, Input } from 'antd'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'
import './Login.css'


const Login: React.FC = () => {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/manufacturing')
    }
  }, [isAuthenticated, navigate])

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      await login(values.username, values.password)
      navigate('/manufacturing')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <Card className="login-card" variant="outlined">
        <div className="login-header">
          <h1>机械制造数字化平台</h1>
          <p>登录后进入订单、BOM、工艺、采购与生产执行主线</p>
        </div>

        <Form
          name="login"
          onFinish={onFinish}
          autoComplete="off"
          size="large"
          layout="vertical"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{ height: 48, fontSize: 16 }}
            >
              登录平台
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}


export default Login
