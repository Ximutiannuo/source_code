import React, { useState, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Button,
  Card,
  Space,
  App,
  Tag,
  Popconfirm,
  Spin,
  Row,
  Col,
  Typography,
  Select,
  Divider,
  Badge,
  Tooltip,
  Empty,
  Drawer,
  Input,
  Alert,
} from 'antd'
import {
  UserOutlined,
  SafetyOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  ApartmentOutlined,
  FolderOutlined,
  BlockOutlined,
  BuildOutlined,
  FileTextOutlined,
  SearchOutlined,
  FilterOutlined,
  PlusOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  TeamOutlined,
  UnlockOutlined,
  LockOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  permissionService,
  Permission,
  PermissionScope,
  UserPermissionCreate,
} from '../services/permissionService'
import { userService } from '../services/userService'
import type { User } from '../services/authService'
import { useAuth } from '../contexts/AuthContext'


const { Title, Text } = Typography

// 权限资源类型图标映射
const resourceTypeIcons: Record<string, React.ReactNode> = {
  // 计划管理相关
  planning: <FileTextOutlined />,
  activity: <FileTextOutlined />,
  
  // 日报相关（已移除daily_report，使用planning和volume权限）
  report: <FileTextOutlined />,
  
  // 工程量相关
  volume: <BuildOutlined />,
  construction_volume: <BuildOutlined />,
  acceptance_volume: <BuildOutlined />,
  abd_volume: <BuildOutlined />,
  ovr_volume: <BuildOutlined />,

  // 验收相关
  inspection_db: <FileTextOutlined />,
  acceptance_procedure: <FileTextOutlined />,

  // P6相关
  p6_sync: <ThunderboltOutlined />,
  p6_resource: <ThunderboltOutlined />,
  p6_database: <ThunderboltOutlined />,
  
  // 展报
  exhibition_report: <FileTextOutlined />,
  
  // 系统相关
  project: <FolderOutlined />,
  user: <UserOutlined />,
  permission: <SafetyOutlined />,
  facility: <FolderOutlined />,
}

// 权限操作颜色映射
const actionColors: Record<string, string> = {
  read: 'blue',
  create: 'green',
  update: 'orange',
  delete: 'red',
  sync: 'purple',
  assign: 'cyan',
  revoke: 'magenta',
}

const PermissionManagement: React.FC = () => {
  const { message } = App.useApp()
  const { user: currentUser, loading } = useAuth()
  const queryClient = useQueryClient()
  
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null)
  const [scopeDrawerVisible, setScopeDrawerVisible] = useState(false)
  const [scopeMode, setScopeMode] = useState<'full' | 'limited'>('full')
  const [selectedScope, setSelectedScope] = useState<PermissionScope>({})
  const [userSearchText, setUserSearchText] = useState('')
  const [permissionFilter, setPermissionFilter] = useState<string>('all')

  // 获取权限列表
  const { data: permissions = [] } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => permissionService.getPermissions(),
  })

  // 获取用户列表
  const { data: usersResponse } = useQuery({
    queryKey: ['users'],
    queryFn: () => userService.getUsers(),
  })
  const users: User[] = usersResponse?.items ?? []

  // 获取用户权限
  const { data: userPermissions, refetch: refetchUserPermissions } = useQuery({
    queryKey: ['userPermissions', selectedUserId],
    queryFn: () => permissionService.getUserPermissions(selectedUserId!),
    enabled: !!selectedUserId,
  })

  // 获取Facility筛选选项 (已移除)
  const facilityOptions: any = { projects: [], subproject_codes: [] }

  // 获取工作包列表 (已移除)
  const workPackages: string[] = []

  // 获取Scope列表 (已移除)
  const scopes: string[] = []

  // 分配权限
  const assignMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: number; data: UserPermissionCreate }) =>
      permissionService.assignUserPermission(userId, data),
    onSuccess: () => {
      message.success('权限分配成功')
      queryClient.invalidateQueries({ queryKey: ['userPermissions'] })
      refetchUserPermissions()
      setScopeDrawerVisible(false)
      setSelectedPermission(null)
      setSelectedScope({})
      setScopeMode('full')
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '权限分配失败')
    },
  })

  // 撤销权限
  const revokeMutation = useMutation({
    mutationFn: ({
      userId,
      permissionId,
      scope,
    }: {
      userId: number
      permissionId: number
      scope?: PermissionScope
    }) => permissionService.revokeUserPermission(userId, permissionId, scope),
    onSuccess: () => {
      message.success('权限撤销成功')
      queryClient.invalidateQueries({ queryKey: ['userPermissions'] })
      refetchUserPermissions()
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '权限撤销失败')
    },
  })

  // 过滤用户
  const filteredUsers = useMemo(() => {
    if (!userSearchText) return users
    const lowerSearch = userSearchText.toLowerCase()
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(lowerSearch) ||
        u.email?.toLowerCase().includes(lowerSearch) ||
        u.full_name?.toLowerCase().includes(lowerSearch)
    )
  }, [users, userSearchText])

  // 按资源类型分组权限
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, Permission[]> = {}
    permissions.forEach((perm) => {
      if (!groups[perm.resource_type]) {
        groups[perm.resource_type] = []
      }
      groups[perm.resource_type].push(perm)
    })
    return groups
  }, [permissions])


  // 检查用户是否拥有某个权限
  const hasPermission = (userId: number, permissionCode: string, scope?: PermissionScope) => {
    if (!userPermissions || userPermissions.user_id !== userId) return false
    return userPermissions.permissions.some((p) => {
      if (p.permission_code !== permissionCode) return false
      if (!scope) return true
      // 简单的范围匹配检查
      const pScope = p.scope || {}
      return Object.keys(scope).every((key) => {
        const scopeValue = scope[key as keyof PermissionScope]
        if (!scopeValue) return true
        return pScope[key as keyof PermissionScope] === scopeValue
      })
    })
  }

  const handleAssignPermission = (permission: Permission) => {
    if (!selectedUserId) {
      message.warning('请先选择用户')
      return
    }
    setSelectedPermission(permission)
    setSelectedScope({})
    setScopeMode('full')
    setScopeDrawerVisible(true)
  }

  const handleSubmitPermission = () => {
    if (!selectedUserId || !selectedPermission) return

    const scope: PermissionScope | undefined =
      scopeMode === 'limited' && Object.keys(selectedScope).length > 0
        ? selectedScope
        : undefined

    assignMutation.mutate({
      userId: selectedUserId,
      data: {
        permission_id: selectedPermission.id,
        scope,
      },
    })
  }

  const handleRevokePermission = (permissionId: number, scope?: PermissionScope) => {
    if (!selectedUserId) return
    revokeMutation.mutate({
      userId: selectedUserId,
      permissionId,
      scope,
    })
  }

  const renderScopeTags = (scope: PermissionScope) => {
    const hasScope = Object.values(scope).some((v) => v !== null && v !== undefined && v !== '')
    if (!hasScope) {
      return (
        <Tag icon={<CheckCircleOutlined />} color="success">
          全范围
        </Tag>
      )
    }

    const tags = []
    if (scope.scope) {
      tags.push(
        <Tag key="scope" icon={<FileTextOutlined />} color="purple">
          Scope: {scope.scope}
        </Tag>
      )
    }
    if (scope.subproject) {
      tags.push(
        <Tag key="subproject" icon={<ApartmentOutlined />} color="blue">
          子项目: {scope.subproject}
        </Tag>
      )
    }
    if (scope.project) {
      tags.push(
        <Tag key="project" icon={<FolderOutlined />} color="cyan">
          项目: {scope.project}
        </Tag>
      )
    }
    if (scope.block) {
      tags.push(
        <Tag key="block" icon={<BlockOutlined />} color="orange">
          区块: {scope.block}
        </Tag>
      )
    }
    if (scope.discipline) {
      tags.push(
        <Tag key="discipline" icon={<BuildOutlined />} color="green">
          专业: {scope.discipline}
        </Tag>
      )
    }
    if (scope.work_package) {
      tags.push(
        <Tag key="work_package" icon={<SettingOutlined />} color="geekblue">
          工作包: {scope.work_package}
        </Tag>
      )
    }

    return <Space size={[4, 4]} wrap>{tags}</Space>
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

  if (!currentUser.is_superuser) {
    return <Navigate to="/" replace />
  }

  const selectedUser = users?.find((u) => u.id === selectedUserId)

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      <Card
        style={{
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          marginBottom: '24px',
        }}
        bodyStyle={{ padding: '24px' }}
      >
        <div style={{ marginBottom: '24px' }}>
          <Title level={3} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            <SafetyOutlined style={{ color: '#1890ff', fontSize: 28 }} />
            权限管理系统
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            可视化权限分配与管理
          </Text>
        </div>

        <Row gutter={24}>
          {/* 左侧：用户列表 */}
          <Col span={6}>
            <Card
              title={
                <Space>
                  <TeamOutlined />
                  <span>用户列表</span>
                </Space>
              }
              size="small"
              style={{ height: 'calc(100vh - 200px)' }}
              bodyStyle={{ padding: '12px' }}
            >
              <Input
                placeholder="搜索用户"
                prefix={<SearchOutlined />}
                value={userSearchText}
                onChange={(e) => setUserSearchText(e.target.value)}
                style={{ marginBottom: 12 }}
                allowClear
              />
              <div style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
                {filteredUsers?.map((user) => (
                  <Card
                    key={user.id}
                    size="small"
                    hoverable
                    onClick={() => setSelectedUserId(user.id)}
                    style={{
                      marginBottom: 8,
                      cursor: 'pointer',
                      border:
                        selectedUserId === user.id
                          ? '2px solid #1890ff'
                          : '1px solid #e8e8e8',
                      background: selectedUserId === user.id ? '#e6f7ff' : 'white',
                    }}
                    bodyStyle={{ padding: '12px' }}
                  >
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text strong>{user.username}</Text>
                        <Badge
                          status={user.is_active ? 'success' : 'default'}
                          text={user.is_superuser ? '超级' : ''}
                        />
                      </div>
                      {user.full_name && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {user.full_name}
                        </Text>
                      )}
                      {selectedUserId === user.id && userPermissions && (
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          拥有 {userPermissions.permissions.length} 项权限
                        </Text>
                      )}
                    </Space>
                  </Card>
                ))}
              </div>
            </Card>
          </Col>

          {/* 中间：权限矩阵 */}
          <Col span={18}>
            {selectedUserId ? (
              <Card
                title={
                  <Space>
                    <UserOutlined />
                    <span>{selectedUser?.username} 的权限管理</span>
                    <Badge count={userPermissions?.permissions.length || 0} showZero />
                  </Space>
                }
                extra={
                  <Select
                    value={permissionFilter}
                    onChange={setPermissionFilter}
                    style={{ width: 150 }}
                    options={[
                      { value: 'all', label: '全部类型' },
                      ...Object.keys(groupedPermissions).map((type) => ({
                        value: type,
                        label: type,
                      })),
                    ]}
                  />
                }
                style={{ height: 'calc(100vh - 200px)' }}
                bodyStyle={{ padding: '16px', height: '100%', overflow: 'auto' }}
              >
                {Object.entries(groupedPermissions).map(([resourceType, perms]) => {
                  if (permissionFilter !== 'all' && permissionFilter !== resourceType) return null
                  
                  return (
                    <div key={resourceType} style={{ marginBottom: 24 }}>
                      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Tag
                          icon={resourceTypeIcons[resourceType]}
                          color="processing"
                          style={{ fontSize: 14, padding: '4px 12px' }}
                        >
                          {resourceType}
                        </Tag>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {perms.length} 个权限
                        </Text>
                      </div>
                      <Row gutter={[12, 12]}>
                        {perms.map((perm) => {
                          const hasPerm = hasPermission(selectedUserId, perm.code)
                          const userPerm = userPermissions?.permissions.find(
                            (p) => p.permission_code === perm.code
                          )

                          return (
                            <Col key={perm.id} xs={24} sm={12} md={8} lg={6}>
                              <Card
                                size="small"
                                hoverable
                                style={{
                                  border: hasPerm ? '2px solid #52c41a' : '1px solid #e8e8e8',
                                  background: hasPerm ? '#f6ffed' : 'white',
                                }}
                                bodyStyle={{ padding: '12px' }}
                                actions={[
                                  hasPerm ? (
                                    <Popconfirm
                                      key="revoke"
                                      title="确定要撤销这个权限吗？"
                                      onConfirm={() =>
                                        handleRevokePermission(
                                          perm.id,
                                          userPerm?.scope
                                        )
                                      }
                                    >
                                      <Button
                                        type="text"
                                        danger
                                        icon={<DeleteOutlined />}
                                        size="small"
                                      >
                                        撤销
                                      </Button>
                                    </Popconfirm>
                                  ) : (
                                    <Button
                                      key="assign"
                                      type="text"
                                      icon={<PlusOutlined />}
                                      size="small"
                                      onClick={() => handleAssignPermission(perm)}
                                    >
                                      分配
                                    </Button>
                                  ),
                                ]}
                              >
                                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                                  <div>
                                    <Text strong style={{ fontSize: 13 }}>
                                      {perm.name}
                                    </Text>
                                  </div>
                                  <Text code style={{ fontSize: 11 }}>
                                    {perm.code}
                                  </Text>
                                  <Tag color={actionColors[perm.action] || 'default'}>
                                    {perm.action}
                                  </Tag>
                                  {hasPerm && userPerm?.scope && (
                                    <div style={{ marginTop: 4 }}>
                                      {renderScopeTags(userPerm.scope)}
                                    </div>
                                  )}
                                </Space>
                              </Card>
                            </Col>
                          )
                        })}
                      </Row>
                    </div>
                  )
                })}
              </Card>
            ) : (
              <Card
                style={{ height: 'calc(100vh - 200px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Empty
                  description={
                    <div>
                      <UserOutlined style={{ fontSize: 64, color: '#d9d9d9', marginBottom: 16 }} />
                      <div>请从左侧选择一个用户开始权限管理</div>
                    </div>
                  }
                />
              </Card>
            )}
          </Col>
        </Row>
      </Card>

      {/* 权限范围设置抽屉 */}
      <Drawer
        title={
          <Space>
            <SettingOutlined />
            <span>设置权限范围</span>
            {selectedPermission && (
              <Tag color="blue">{selectedPermission.name}</Tag>
            )}
          </Space>
        }
        open={scopeDrawerVisible}
        onClose={() => {
          setScopeDrawerVisible(false)
          setSelectedPermission(null)
          setSelectedScope({})
          setScopeMode('full')
        }}
        width={600}
        extra={
          <Space>
            <Button onClick={() => setScopeDrawerVisible(false)}>取消</Button>
            <Button type="primary" onClick={handleSubmitPermission} loading={assignMutation.isPending}>
              确认分配
            </Button>
          </Space>
        }
      >
        <Alert
          message="权限范围设置"
          description="选择全范围将授予该权限的所有数据访问权限，选择限制范围可以精确控制访问范围"
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <div style={{ marginBottom: 24 }}>
          <Text strong style={{ marginBottom: 12, display: 'block' }}>
            范围模式：
          </Text>
          <Space>
            <Button
              type={scopeMode === 'full' ? 'primary' : 'default'}
              icon={<UnlockOutlined />}
              onClick={() => {
                setScopeMode('full')
                setSelectedScope({})
              }}
            >
              全范围（无限制）
            </Button>
            <Button
              type={scopeMode === 'limited' ? 'primary' : 'default'}
              icon={<LockOutlined />}
              onClick={() => setScopeMode('limited')}
            >
              限制范围
            </Button>
          </Space>
        </div>

        {scopeMode === 'limited' && (
          <div>
            <Divider orientation="left">
              <Space>
                <FilterOutlined />
                <span>权限范围选择</span>
              </Space>
            </Divider>

            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              {/* Scope选择 */}
              <div>
                <Text strong style={{ marginBottom: 8, display: 'block' }}>
                  <FileTextOutlined style={{ marginRight: 8, color: '#722ed1' }} />
                  Scope（重要）
                  <Tooltip title="来自activitycode的scope字段，是重要的权限控制维度">
                    <InfoCircleOutlined style={{ marginLeft: 4, color: '#999' }} />
                  </Tooltip>
                </Text>
                <Select
                  mode="multiple"
                  style={{ width: '100%' }}
                  placeholder="选择Scope"
                  value={selectedScope.scope ? [selectedScope.scope] : []}
                  onChange={(values) =>
                    setSelectedScope({ ...selectedScope, scope: values[0] || undefined })
                  }
                  options={scopes.map((s) => ({ value: s, label: s }))}
                  allowClear
                  showSearch
                />
              </div>

              {/* Subproject选择 */}
              <div>
                <Text strong style={{ marginBottom: 8, display: 'block' }}>
                  <ApartmentOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                  子项目
                  <Tooltip title="分配子项目权限将包含该子项目下的所有facilities和block">
                    <InfoCircleOutlined style={{ marginLeft: 4, color: '#999' }} />
                  </Tooltip>
                </Text>
                <Select
                  mode="multiple"
                  style={{ width: '100%' }}
                  placeholder="选择子项目"
                  value={selectedScope.subproject ? [selectedScope.subproject] : []}
                  onChange={(values) =>
                    setSelectedScope({ ...selectedScope, subproject: values[0] || undefined })
                  }
                  options={facilityOptions?.subproject_codes?.map((sp: string) => ({
                    value: sp,
                    label: sp,
                  }))}
                  allowClear
                  showSearch
                />
              </div>

              {/* Project选择 */}
              <div>
                <Text strong style={{ marginBottom: 8, display: 'block' }}>
                  <FolderOutlined style={{ marginRight: 8, color: '#13c2c2' }} />
                  项目
                </Text>
                <Select
                  mode="multiple"
                  style={{ width: '100%' }}
                  placeholder="选择项目"
                  value={selectedScope.project ? [selectedScope.project] : []}
                  onChange={(values) =>
                    setSelectedScope({ ...selectedScope, project: values[0] || undefined })
                  }
                  options={facilityOptions?.projects?.map((p: string) => ({
                    value: p,
                    label: p,
                  }))}
                  allowClear
                  showSearch
                />
              </div>

              {/* Block选择 */}
              <div>
                <Text strong style={{ marginBottom: 8, display: 'block' }}>
                  <BlockOutlined style={{ marginRight: 8, color: '#fa8c16' }} />
                  区块（最小单位）
                </Text>
                <Select
                  mode="tags"
                  style={{ width: '100%' }}
                  placeholder="输入或选择区块"
                  value={selectedScope.block ? [selectedScope.block] : []}
                  onChange={(values) =>
                    setSelectedScope({ ...selectedScope, block: values[0] || undefined })
                  }
                  tokenSeparators={[',']}
                  allowClear
                />
              </div>

              {/* Discipline选择 */}
              <div>
                <Text strong style={{ marginBottom: 8, display: 'block' }}>
                  <BuildOutlined style={{ marginRight: 8, color: '#52c41a' }} />
                  专业
                </Text>
                <Select
                  mode="tags"
                  style={{ width: '100%' }}
                  placeholder="输入或选择专业"
                  value={selectedScope.discipline ? [selectedScope.discipline] : []}
                  onChange={(values) =>
                    setSelectedScope({ ...selectedScope, discipline: values[0] || undefined })
                  }
                  tokenSeparators={[',']}
                  allowClear
                />
              </div>

              {/* Work Package选择 */}
              <div>
                <Text strong style={{ marginBottom: 8, display: 'block' }}>
                  <SettingOutlined style={{ marginRight: 8, color: '#2f54eb' }} />
                  工作包
                  <Tooltip title="来自rsc_defines.work_package，颗粒度比resource_id更细">
                    <InfoCircleOutlined style={{ marginLeft: 4, color: '#999' }} />
                  </Tooltip>
                </Text>
                <Select
                  mode="multiple"
                  style={{ width: '100%' }}
                  placeholder="选择工作包"
                  value={selectedScope.work_package ? [selectedScope.work_package] : []}
                  onChange={(values) =>
                    setSelectedScope({ ...selectedScope, work_package: values[0] || undefined })
                  }
                  options={workPackages.map((wp) => ({
                    value: wp,
                    label: wp,
                  }))}
                  allowClear
                  showSearch
                />
              </div>
            </Space>

            <Alert
              message="提示"
              description="留空的字段表示不限制该维度。Scope是独立维度，必须精确匹配。"
              type="info"
              showIcon
              style={{ marginTop: 24 }}
            />
          </div>
        )}
      </Drawer>
    </div>
  )
}

export default PermissionManagement
