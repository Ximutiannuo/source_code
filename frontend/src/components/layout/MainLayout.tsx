import { Avatar, Dropdown, Layout, Menu, Space } from 'antd'
import type { MenuProps } from 'antd'
import {
  CodeSandboxOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  FileTextOutlined,
  LogoutOutlined,
  QuestionCircleOutlined,
  SafetyCertificateOutlined,
  ScheduleOutlined,
  SettingOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  ToolOutlined,
  UserOutlined,
} from '@ant-design/icons'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { useAuth } from '../../contexts/AuthContext'
import { permissionService } from '../../services/permissionService'


const { Header, Content } = Layout

interface MainLayoutProps {
  children: ReactNode
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()

  const { data: userPermissions } = useQuery({
    queryKey: ['userPermissions', user?.id],
    queryFn: () => permissionService.getUserPermissions(user!.id),
    enabled: !!user?.id,
    retry: false,
  })

  const hasPermission = (resourceType: string, action: string): boolean => {
    if (user?.is_superuser) {
      return true
    }
    if (!userPermissions) {
      return false
    }
    return userPermissions.permissions.some(
      (permission: any) => permission.resource_type === resourceType && permission.action === action
    )
  }

  const handleNavigate = (path: string) => {
    navigate(path)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const getSelectedKey = () => {
    if (location.pathname === '/manufacturing') return '/manufacturing'
    if (location.pathname.startsWith('/manufacturing/orders')) return '/manufacturing/orders'
    if (location.pathname.startsWith('/manufacturing/materials')) return '/manufacturing/materials'
    if (location.pathname.startsWith('/manufacturing/bom')) return '/manufacturing/bom'
    if (location.pathname.startsWith('/manufacturing/procurement')) return '/manufacturing/procurement'
    if (location.pathname.startsWith('/manufacturing/quality')) return '/manufacturing/quality'
    if (location.pathname.startsWith('/manufacturing/equipment')) return '/manufacturing/equipment'
    if (location.pathname.startsWith('/manufacturing/drawings')) return '/manufacturing/drawings'
    if (location.pathname.startsWith('/external-data')) return '/manufacturing/drawings'
    if (location.pathname.startsWith('/tools/ocr')) return '/manufacturing/drawings'
    if (location.pathname.startsWith('/account-management')) return '/account-management'
    if (location.pathname.startsWith('/department-management')) return '/department-management'
    if (location.pathname.startsWith('/system-admin')) return '/system-admin'
    if (location.pathname.startsWith('/profile')) return '/profile'
    if (location.pathname.startsWith('/help')) return '/help'
    return location.pathname
  }

  const getOpenKeys = () => {
    if (
      location.pathname === '/manufacturing' ||
      location.pathname.startsWith('/manufacturing/orders') ||
      location.pathname.startsWith('/manufacturing/materials') ||
      location.pathname.startsWith('/manufacturing/bom') ||
      location.pathname.startsWith('/manufacturing/procurement')
    ) {
      return ['manufacturing-hub']
    }

    if (
      location.pathname.startsWith('/manufacturing/quality') ||
      location.pathname.startsWith('/manufacturing/equipment') ||
      location.pathname.startsWith('/manufacturing/drawings') ||
      location.pathname.startsWith('/external-data') ||
      location.pathname.startsWith('/tools/ocr')
    ) {
      return ['manufacturing-collaboration']
    }

    if (
      location.pathname.startsWith('/account-management') ||
      location.pathname.startsWith('/department-management') ||
      location.pathname.startsWith('/system-admin')
    ) {
      return ['system']
    }

    return []
  }

  const selectedKey = getSelectedKey()
  const [openKeys, setOpenKeys] = useState<string[]>(getOpenKeys())

  useEffect(() => {
    setOpenKeys(getOpenKeys())
  }, [location.pathname])

  const canAccessAccountManagement =
    user?.can_access_account_management ||
    user?.is_superuser ||
    user?.username === 'role_system_admin' ||
    hasPermission('system', 'admin')

  const systemMenuItems: NonNullable<MenuProps['items']> = []
  if (canAccessAccountManagement) {
    systemMenuItems.push(
      {
        key: '/account-management',
        icon: <UserOutlined />,
        label: '账户与角色',
        onClick: () => handleNavigate('/account-management'),
      },
      {
        key: '/department-management',
        icon: <TeamOutlined />,
        label: '部门组织',
        onClick: () => handleNavigate('/department-management'),
      }
    )
  }

  if (user?.is_superuser || user?.username === 'role_system_admin') {
    systemMenuItems.push({
      key: '/system-admin',
      icon: <SettingOutlined />,
      label: '系统维护',
      onClick: () => handleNavigate('/system-admin'),
    })
  }

  const menuItems = useMemo<NonNullable<MenuProps['items']>>(
    () => [
      {
        key: 'manufacturing-hub',
        icon: <CodeSandboxOutlined />,
        label: '制造主线',
        children: [
          {
            key: '/manufacturing',
            icon: <DashboardOutlined />,
            label: '制造驾驶舱',
            onClick: () => handleNavigate('/manufacturing'),
          },
          {
            key: '/manufacturing/orders',
            icon: <ScheduleOutlined />,
            label: '制造订单与工单',
            onClick: () => handleNavigate('/manufacturing/orders'),
          },
          {
            key: '/manufacturing/materials',
            icon: <DatabaseOutlined />,
            label: '物料主数据',
            onClick: () => handleNavigate('/manufacturing/materials'),
          },
          {
            key: '/manufacturing/bom',
            icon: <DeploymentUnitOutlined />,
            label: 'BOM 与产品结构',
            onClick: () => handleNavigate('/manufacturing/bom'),
          },

          {
            key: '/manufacturing/procurement',
            icon: <ShoppingCartOutlined />,
            label: '采购与齐套',
            onClick: () => handleNavigate('/manufacturing/procurement'),
          },
        ],
      },
      {
        key: 'manufacturing-collaboration',
        icon: <ToolOutlined />,
        label: '质量与协同',
        children: [
          {
            key: '/manufacturing/quality',
            icon: <SafetyCertificateOutlined />,
            label: '质量管理',
            onClick: () => handleNavigate('/manufacturing/quality'),
          },
          {
            key: '/manufacturing/equipment',
            icon: <SettingOutlined />,
            label: '设备管理',
            onClick: () => handleNavigate('/manufacturing/equipment'),
          },

          {
            key: '/manufacturing/drawings',
            icon: <FileTextOutlined />,
            label: '图纸资料库',
            onClick: () => handleNavigate('/manufacturing/drawings'),
          },
        ],
      },
      ...(systemMenuItems.length > 0
        ? [
            {
              key: 'system',
              icon: <SettingOutlined />,
              label: '平台治理',
              children: systemMenuItems,
            },
          ]
        : []),
      {
        key: '/help',
        icon: <QuestionCircleOutlined />,
        label: '帮助中心',
        onClick: () => handleNavigate('/help'),
      },
    ],
    [systemMenuItems]
  )

  const userMenuItems: NonNullable<MenuProps['items']> = [
    {
      key: 'user-info',
      icon: <UserOutlined />,
      label: user?.full_name || user?.username || '用户信息',
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人设置',
      onClick: () => navigate('/profile'),
    },
    {
      key: 'help',
      icon: <QuestionCircleOutlined />,
      label: '帮助中心',
      onClick: () => navigate('/help'),
    },
    ...(canAccessAccountManagement
      ? [
          { type: 'divider' as const },
          {
            key: 'account-management',
            icon: <SettingOutlined />,
            label: '账户与角色',
            onClick: () => navigate('/account-management'),
          },
          {
            key: 'department-management',
            icon: <TeamOutlined />,
            label: '部门组织',
            onClick: () => navigate('/department-management'),
          },
        ]
      : []),
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ]

  return (
    <Layout style={{ height: '95vh', minHeight: '95vh', background: 'var(--bg-main)' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          background: 'linear-gradient(135deg, #0f172a 0%, #155e75 48%, #0891b2 100%)',
          borderBottom: 'none',
          height: 56,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginRight: 24 }}>
          <span style={{ color: '#ffffff', fontSize: 18, fontWeight: 700, letterSpacing: '0.5px' }}>
            机械制造数字化平台
          </span>
        </div>

        <Menu
          mode="horizontal"
          theme="dark"
          selectedKeys={[selectedKey]}
          openKeys={openKeys}
          onOpenChange={keys => setOpenKeys(keys as string[])}
          items={menuItems}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            borderBottom: 'none',
            color: '#ffffff',
            lineHeight: '56px',
            fontSize: 13,
            fontWeight: 600,
          }}
        />

        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
          <Space
            style={{
              cursor: 'pointer',
              color: '#ffffff',
              padding: '6px 16px',
              height: 40,
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.2s',
            }}
          >
            <Avatar
              size="small"
              icon={<UserOutlined />}
              style={{
                backgroundColor: '#f97316',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
              }}
            />
            <span style={{ marginLeft: 8, fontWeight: 500 }}>{user?.full_name || user?.username || '用户'}</span>
          </Space>
        </Dropdown>
      </Header>

      <Content
        style={{
          padding: 0,
          background: 'var(--bg-main)',
          minHeight: 'calc(95vh - 56px)',
          height: 'calc(95vh - 56px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          key={location.pathname}
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            overflowY: 'auto',
            padding: '16px',
          }}
        >
          {children}
        </div>
      </Content>
    </Layout>
  )
}

export default MainLayout
