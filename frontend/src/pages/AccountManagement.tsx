import React, { useState, useEffect, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Card,
  Table,
  Button,
  Drawer,
  Form,
  Input,
  Select,
  Switch,
  Space,
  App,
  Popconfirm,
  Tag,
  Spin,
  Tabs,
  Badge,
  Divider,
  Row,
  Col,
  Statistic,
  Empty,
  Descriptions,
  Tooltip,
  Modal,
  Checkbox,
  Alert,
} from 'antd'
import { logger } from '../utils/logger'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  SafetyOutlined,
  TeamOutlined,
  LockOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SearchOutlined,
  ReloadOutlined,
  UserAddOutlined,
  EyeOutlined,
  KeyOutlined,
  DownloadOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userService } from '../services/userService'
import { departmentService } from '../services/departmentService'
import { User, UserCreate, UserUpdate } from '../services/authService'
import {
  permissionService,
  PermissionScope,
  Role,
  RoleCreate,
  RoleUpdate,
} from '../services/permissionService'
import { useAuth } from '../contexts/AuthContext'
import {
  findRoleTemplate,
  getPermissionScopeEntries,
  getResourceTypeConfig,
  MANUFACTURING_DEPARTMENT_GUIDE,
  MANUFACTURING_ROLE_TEMPLATES,
  RESOURCE_CATEGORY_ORDER,
  RESOURCE_TYPE_CONFIG as MANUFACTURING_RESOURCE_TYPE_CONFIG,
  type ManufacturingRoleTemplate,
} from './accountManagementMeta'

/** 将 FastAPI 返回的 detail（可能是字符串或 422 校验对象数组）转为可显示的字符串，避免把对象当 React 子节点导致报错 */
function formatApiDetail(detail: unknown, fallback: string): string {
  if (detail == null) return fallback
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map((e: { msg?: string }) => (e && typeof e === 'object' && 'msg' in e ? e.msg : String(e))).filter(Boolean).join('；') || fallback
  }
  if (typeof detail === 'object' && detail !== null && 'msg' in detail) {
    return (detail as { msg: string }).msg
  }
  return fallback
}

const AccountManagement: React.FC = () => {
  const { message } = App.useApp()
  const { user: currentUser, loading } = useAuth()

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

  const queryClient = useQueryClient()

  // 账号管理访问权限：以后端 /auth/me 返回的 can_access_account_management 为准（含「系统管理员」角色）
  const canAccessAccountManagement = currentUser?.can_access_account_management || currentUser?.is_superuser || currentUser?.username === 'role_system_admin'
  if (!canAccessAccountManagement) {
    return <Navigate to="/" replace />
  }

  // ========== 用户管理状态 ==========
  const [userForm] = Form.useForm()
  const [userDrawerVisible, setUserDrawerVisible] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [userSearchText, setUserSearchText] = useState('')
  const [userDepartmentFilter, setUserDepartmentFilter] = useState<number | undefined>(undefined)
  const [userPage, setUserPage] = useState(1)
  const [userPageSize, setUserPageSize] = useState(20)

  // 搜索/筛选条件变化时重置到第一页
  useEffect(() => {
    setUserPage(1)
  }, [userSearchText, userDepartmentFilter])

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [userDetailDrawerVisible, setUserDetailDrawerVisible] = useState(false)

  // ========== 角色管理状态 ==========
  const [roleForm] = Form.useForm()
  const [roleDrawerVisible, setRoleDrawerVisible] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null)
  const [roleDetailDrawerVisible, setRoleDetailDrawerVisible] = useState(false)

  // ========== 权限管理状态 ==========
  const [permissionDrawerVisible, setPermissionDrawerVisible] = useState(false)
  const [batchImportModalVisible, setBatchImportModalVisible] = useState(false)
  const [batchImportFile, setBatchImportFile] = useState<File | null>(null)
  const [assignRoleDrawerVisible, setAssignRoleDrawerVisible] = useState(false)
  const [rolePermissionDrawerVisible, setRolePermissionDrawerVisible] = useState(false)

  
  // 角色权限分配状态（新设计：分离模块权限和数据范围）
  // 模块权限：{ [resourceType:action]: true } - 记录哪些模块权限被选中
  const [modulePermissions, setModulePermissions] = useState<Record<string, boolean>>({})
  
  // 模块数据范围：{ [resourceType]: { scope, project, subproject, block, work_package } } - 按模块统一配置数据范围
  const [moduleScopes, setModuleScopes] = useState<Record<string, {
    scope?: string[]
    project?: string[]
    subproject?: string[]
    block?: string[]
    work_package?: string[]
  }>>({})
  
  // 当前正在配置数据范围的模块
  const [currentConfigModule, setCurrentConfigModule] = useState<string | null>(null)
  const [scopeConfigDrawerVisible, setScopeConfigDrawerVisible] = useState(false)
  
  // 数据范围选择器状态（用于配置单个模块的数据范围）
  const [tempScopeConfig, setTempScopeConfig] = useState<{
    scope?: string[]
    project?: string[]
    subproject?: string[]
    block?: string[]
    work_package?: string[]
  }>({})

  // ========== 数据查询 ==========
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentService.listDepartments(),
  })
  const departmentOptions = departments.map((d) => ({ value: d.id, label: d.name }))

  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ['users', userSearchText, userDepartmentFilter, userPage, userPageSize],
    queryFn: () => userService.getUsers({
      search: userSearchText || undefined,
      department_id: userDepartmentFilter,
      skip: (userPage - 1) * userPageSize,
      limit: userPageSize,
    }),
  })
  const users = usersData?.items ?? []
  const totalUserCount = usersData?.total ?? 0
  const activeUsersCount = usersData?.active_count ?? 0
  const inactiveUsersCount = usersData?.inactive_count ?? 0

  const { data: userPermissions, refetch: refetchUserPermissions } = useQuery({
    queryKey: ['userPermissions', selectedUserId],
    queryFn: () => permissionService.getUserPermissions(selectedUserId!),
    enabled: !!selectedUserId,
  })

  const { data: userRolesData, refetch: refetchUserRoles } = useQuery({
    queryKey: ['userRoles', selectedUserId],
    queryFn: () => userService.getUserRoles(selectedUserId!),
    enabled: !!selectedUserId,
  })

  const { data: roles = [], refetch: refetchRoles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => permissionService.getRoles(),
  })

  const { data: rolePermissions, refetch: refetchRolePermissions } = useQuery({
    queryKey: ['rolePermissions', selectedRoleId],
    queryFn: () => permissionService.getRolePermissions(selectedRoleId!),
    enabled: !!selectedRoleId,
  })

  // 获取权限范围选择器数据（仅在用户已登录且是超级管理员时查询）
  const { data: gccScopeOptions } = useQuery({
    queryKey: ['gccScopeOptions'],
    queryFn: () => permissionService.getGCCScopeOptions(),
    enabled: !!currentUser && currentUser.is_superuser,
  })

  // 用于权限范围配置Drawer的facilities查询（使用tempScopeConfig的值）
  const facilitiesOptionsQueryKey = useMemo(() => [
    'facilitiesScopeOptions',
    tempScopeConfig.project?.sort().join(',') || '',
    tempScopeConfig.subproject?.sort().join(',') || '',
  ], [tempScopeConfig.project, tempScopeConfig.subproject])
  
  const { data: facilitiesOptions, refetch: refetchFacilitiesOptions } = useQuery({
    queryKey: facilitiesOptionsQueryKey,
    queryFn: () => permissionService.getFacilitiesScopeOptions({
      project: (tempScopeConfig.project?.length || 0) > 0 ? tempScopeConfig.project : undefined,
      subproject: (tempScopeConfig.subproject?.length || 0) > 0 ? tempScopeConfig.subproject : undefined,
    }),
    enabled: !!currentUser && currentUser.is_superuser && scopeConfigDrawerVisible,
  })

  const { data: workPackageOptions } = useQuery({
    queryKey: ['workPackageOptions'],
    queryFn: () => permissionService.getWorkPackageOptions(),
    enabled: !!currentUser && currentUser.is_superuser,
  })

  // 注意：已移除旧的级联逻辑，因为现在使用tempScopeConfig来管理权限范围配置

  // ========== Mutations ==========
  const createUserMutation = useMutation({
    mutationFn: (data: UserCreate) => userService.createUser(data),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setUserDrawerVisible(false)
      userForm.resetFields()
      if (data.temporary_password) {
        Modal.success({
          title: '用户创建成功',
          content: (
            <div>
              <p>用户 <strong>{data.username}</strong> 已成功创建！</p>
              <div style={{ marginTop: 16, padding: 16, background: '#f0f2f5', borderRadius: 8 }}>
                <div style={{ marginBottom: 8, fontSize: 14, color: '#666' }}>
                  <strong>初始密码：</strong>
                </div>
                <div style={{ fontSize: 18, fontWeight: 'bold', color: '#1890ff', padding: '12px', background: 'white', borderRadius: 4, textAlign: 'center', letterSpacing: '2px', fontFamily: 'monospace' }}>
                  {data.temporary_password}
                </div>
              </div>
              <p style={{ marginTop: 12, color: '#999', fontSize: 12 }}>
                ⚠️ 请妥善保管此密码，建议用户首次登录后立即修改。
              </p>
            </div>
          ),
          width: 500,
        })
      } else {
        message.success('用户创建成功')
      }
    },
    onError: (error: any) => {
      message.error(formatApiDetail(error?.response?.data?.detail, '创建用户失败'))
    },
  })

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UserUpdate }) => userService.updateUser(id, data),
    onSuccess: () => {
      message.success('用户更新成功')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setUserDrawerVisible(false)
      userForm.resetFields()
      setEditingUser(null)
    },
    onError: (error: any) => {
      message.error(formatApiDetail(error?.response?.data?.detail, '更新用户失败'))
    },
  })

  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => userService.deleteUser(id),
    onSuccess: () => {
      message.success('用户删除成功')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: any) => {
      message.error(formatApiDetail(error?.response?.data?.detail, '删除用户失败'))
    },
  })

  const downloadTemplateMutation = useMutation({
    mutationFn: async () => {
      const blob = await userService.downloadImportTemplate()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'users_import_template.xlsx'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    },
    onSuccess: () => {
      message.success('模板已下载')
    },
    onError: (error: any) => {
      message.error(formatApiDetail(error?.response?.data?.detail, '下载模板失败'))
    },
  })

  const exportUsersMutation = useMutation({
    mutationFn: async () => {
      const blob = await userService.exportUsers({
        search: userSearchText || undefined,
        department_id: userDepartmentFilter,
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `users_export_${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    },
    onSuccess: () => {
      message.success('导出成功')
    },
    onError: (error: any) => {
      message.error(formatApiDetail(error?.response?.data?.detail, '导出失败'))
    },
  })

  const batchImportMutation = useMutation({
    mutationFn: (file: File) => userService.batchImportUsers(file),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setBatchImportModalVisible(false)
      setBatchImportFile(null)
      const successMsg = `导入完成：新建 ${data.created} 个，更新 ${data.updated} 个，分配角色 ${data.role_assigned} 次`
      if (data.errors?.length) {
        message.warning(`${successMsg}；${data.errors.length} 条错误`)
        Modal.warning({
          title: '导入完成（含部分错误）',
          content: (
            <div>
              <p>{successMsg}</p>
              <p style={{ marginTop: 8 }}>错误详情：</p>
              <ul style={{ maxHeight: 200, overflow: 'auto' }}>
                {data.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          ),
          width: 500,
        })
      } else {
        message.success(successMsg)
      }
    },
    onError: (error: any) => {
      message.error(formatApiDetail(error?.response?.data?.detail, '导入失败'))
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: (id: number) => userService.resetUserPassword(id),
    onSuccess: (data) => {
      Modal.success({
        title: '密码重置成功',
        content: (
          <div>
            <p>用户 <strong>{data.username}</strong> 的密码已重置！</p>
            <div style={{ marginTop: 16, padding: 16, background: '#f0f2f5', borderRadius: 8 }}>
              <div style={{ marginBottom: 8, fontSize: 14, color: '#666' }}>
                <strong>新密码：</strong>
              </div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#1890ff', padding: '12px', background: 'white', borderRadius: 4, textAlign: 'center', letterSpacing: '2px', fontFamily: 'monospace' }}>
                {data.new_password}
              </div>
            </div>
            <p style={{ marginTop: 12, color: '#999', fontSize: 12 }}>
              ⚠️ 请妥善保管此密码，建议用户首次登录后立即修改。
            </p>
          </div>
        ),
        width: 500,
      })
    },
    onError: (error: any) => {
      message.error(formatApiDetail(error?.response?.data?.detail, '重置密码失败'))
    },
  })

  const createRoleMutation = useMutation({
    mutationFn: (data: RoleCreate) => permissionService.createRole(data),
    onSuccess: () => {
      message.success('角色创建成功')
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setRoleDrawerVisible(false)
      roleForm.resetFields()
      setEditingRole(null)
    },
    onError: (error: any) => {
      message.error(formatApiDetail(error?.response?.data?.detail, '创建角色失败'))
    },
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: RoleUpdate }) => permissionService.updateRole(id, data),
    onSuccess: () => {
      message.success('角色更新成功')
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setRoleDrawerVisible(false)
      roleForm.resetFields()
      setEditingRole(null)
    },
    onError: (error: any) => {
      message.error(formatApiDetail(error?.response?.data?.detail, '更新角色失败'))
    },
  })

  const deleteRoleMutation = useMutation({
    mutationFn: (id: number) => permissionService.deleteRole(id),
    onSuccess: (_data, id) => {
      message.success('角色删除成功')
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      if (selectedRoleId === id) {
        setSelectedRoleId(null)
      }
    },
    onError: (error: any) => {
      message.error(formatApiDetail(error?.response?.data?.detail, '删除角色失败'))
    },
  })

  const assignUserRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: number; roleId: number }) => permissionService.assignUserRole(userId, roleId),
    onSuccess: () => {
      message.success('角色分配成功')
      queryClient.invalidateQueries({ queryKey: ['userRoles'] })
      queryClient.invalidateQueries({ queryKey: ['userPermissions'] })
      setAssignRoleDrawerVisible(false)
      refetchUserRoles()
      refetchUserPermissions()
    },
    onError: (error: any) => {
      message.error(formatApiDetail(error?.response?.data?.detail, '角色分配失败'))
    },
  })

  const revokeUserRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: number; roleId: number }) => permissionService.revokeUserRole(userId, roleId),
    onSuccess: () => {
      message.success('角色撤销成功')
      queryClient.invalidateQueries({ queryKey: ['userRoles'] })
      queryClient.invalidateQueries({ queryKey: ['userPermissions'] })
      refetchUserRoles()
      refetchUserPermissions()
    },
    onError: (error: any) => {
      message.error(formatApiDetail(error?.response?.data?.detail, '角色撤销失败'))
    },
  })


  const revokeRolePermissionMutation = useMutation({
    mutationFn: ({ roleId, permissionId, scope }: { roleId: number; permissionId: number; scope?: PermissionScope }) =>
      permissionService.revokeRolePermission(roleId, permissionId, scope),
    onSuccess: () => {
      message.success('权限撤销成功')
      queryClient.invalidateQueries({ queryKey: ['rolePermissions'] })
      refetchRolePermissions()
    },
    onError: (error: any) => {
      message.error(formatApiDetail(error?.response?.data?.detail, '权限撤销失败'))
    },
  })


  // createPermissionMutation 在 batchAssignPermissionsMutationV2 中使用


  // ========== Handlers ==========
  const handleAddUser = () => {
    setEditingUser(null)
    userForm.resetFields()
    setUserDrawerVisible(true)
  }

  const handleEditUser = (record: any) => {
    setEditingUser(record)
    userForm.setFieldsValue({
      ...record,
      role_ids: record.roles?.map((r: any) => r.id) || []
    })
    setUserDrawerVisible(true)
  }

  const handleViewUser = (record: User) => {
    setSelectedUserId(record.id)
    setUserDetailDrawerVisible(true)
  }

  const handleUserSubmit = async () => {
    try {
      const values = await userForm.validateFields()
      if (editingUser) {
        updateUserMutation.mutate({ id: editingUser.id, data: values })
      } else {
        const { password, ...createData } = values
        createUserMutation.mutate(createData as UserCreate)
      }
    } catch (error) {
      // 表单验证失败
    }
  }

  const getDepartmentName = (departmentId?: number) => {
    if (!departmentId) return '-'
    return departments.find((department) => department.id === departmentId)?.name || String(departmentId)
  }

  const renderScopeTags = (scope?: PermissionScope) => {
    const scopeEntries = getPermissionScopeEntries(scope)
    if (!scopeEntries.length) {
      return <Tag color="green">全范围</Tag>
    }

    return (
      <Space wrap>
        {scopeEntries.map((item) => (
          <Tag key={`${item.label}-${item.value}`} color={item.color}>
            {item.label}: {item.value}
          </Tag>
        ))}
      </Space>
    )
  }

  const applyRoleTemplate = (template: ManufacturingRoleTemplate) => {
    setEditingRole(null)
    roleForm.setFieldsValue({
      name: template.name,
      description: template.presetDescription,
      is_active: true,
    })
    setRoleDrawerVisible(true)
  }

  const handleAddRole = () => {
    setEditingRole(null)
    roleForm.resetFields()
    setRoleDrawerVisible(true)
  }

  const handleEditRole = (record: Role) => {
    setEditingRole(record)
    roleForm.setFieldsValue({
      name: record.name,
      description: record.description,
      is_active: record.is_active,
    })
    setRoleDrawerVisible(true)
  }

  const handleViewRole = (record: Role) => {
    setSelectedRoleId(record.id)
    setRoleDetailDrawerVisible(true)
  }

  const handleRoleSubmit = async () => {
    try {
      const values = await roleForm.validateFields()
      if (editingRole) {
        updateRoleMutation.mutate({ id: editingRole.id, data: values })
      } else {
        createRoleMutation.mutate(values as RoleCreate)
      }
    } catch (error) {
      // 表单验证失败
    }
  }

  const handleManageUserPermissions = (userId: number) => {
    setSelectedUserId(userId)
    setPermissionDrawerVisible(true)
  }

  const handleAssignRoleToUser = (roleId: number) => {
    if (!selectedUserId) return
    assignUserRoleMutation.mutate({
      userId: selectedUserId,
      roleId,
    })
  }

  const handleAssignRolePermission = (roleId: number) => {
    setSelectedRoleId(roleId)
    setRolePermissionDrawerVisible(true)
  }

  const handleRevokeRolePermission = (permissionId: number, scope?: PermissionScope) => {
    if (!selectedRoleId) return
    revokeRolePermissionMutation.mutate({
      roleId: selectedRoleId,
      permissionId,
      scope,
    })
  }


  // 初始化角色权限配置（从已有的权限加载到新的数据结构）
  useEffect(() => {
    if (selectedRoleId && rolePermissions) {
      const permissions: Record<string, boolean> = {}
      
      // 收集所有模块权限和按模块分组的数据范围
      const moduleScopeMap: Record<string, {
        scope?: string[]
        project?: string[]
        subproject?: string[]
        block?: string[]
        work_package?: string[]
      }> = {}
      
      rolePermissions.permissions.forEach(rp => {
        const key = `${rp.permission.resource_type}:${rp.permission.action}`
        permissions[key] = true
        
        // 收集该模块的数据范围（如果同一个模块有多个权限，取第一个非空的范围，因为它们应该一致）
        const resourceType = rp.permission.resource_type
        if (!moduleScopeMap[resourceType] && rp.scope) {
          const hasScope = rp.scope.scope || rp.scope.project || rp.scope.subproject || rp.scope.block || rp.scope.work_package
          if (hasScope) {
            moduleScopeMap[resourceType] = {
              scope: rp.scope.scope ? rp.scope.scope.split(',').filter(Boolean) : undefined,
              project: rp.scope.project ? rp.scope.project.split(',').filter(Boolean) : undefined,
              subproject: rp.scope.subproject ? rp.scope.subproject.split(',').filter(Boolean) : undefined,
              block: rp.scope.block ? rp.scope.block.split(',').filter(Boolean) : undefined,
              work_package: rp.scope.work_package ? rp.scope.work_package.split(',').filter(Boolean) : undefined,
            }
          }
        }
      })
      
      setModulePermissions(permissions)
      setModuleScopes(moduleScopeMap)
    } else {
      setModulePermissions({})
      setModuleScopes({})
    }
  }, [selectedRoleId, rolePermissions])

  // 获取已选择的权限数量（用于计算总数）
  const selectedPermissionsCount = useMemo(() => {
    return Object.keys(modulePermissions).length
  }, [modulePermissions])

  // 打开模块数据范围配置Drawer
  const handleOpenScopeConfig = (resourceType: string) => {
    setCurrentConfigModule(resourceType)
    setTempScopeConfig(moduleScopes[resourceType] || {})
    setScopeConfigDrawerVisible(true)
  }

  // 保存模块数据范围配置
  const handleSaveScopeConfig = () => {
    if (!currentConfigModule) return
    setModuleScopes({
      ...moduleScopes,
      [currentConfigModule]: { ...tempScopeConfig },
    })
    setScopeConfigDrawerVisible(false)
    setCurrentConfigModule(null)
    setTempScopeConfig({})
  }

  // 切换权限选择（资源类型+操作类型）
  const handleTogglePermission = (resourceType: string, action: string) => {
    const key = `${resourceType}:${action}`
    const newPermissions = { ...modulePermissions }
    if (newPermissions[key]) {
      delete newPermissions[key]
    } else {
      newPermissions[key] = true
    }
    setModulePermissions(newPermissions)
  }


  // 批量分配权限处理（新设计：分离模块权限和数据范围）
  const handleBatchAssignPermissions = async () => {
    if (!selectedRoleId) return
    
    batchAssignPermissionsMutationV2.mutate({
      roleId: selectedRoleId,
      modulePermissions,
      moduleScopes,
    })
  }

  const batchAssignPermissionsMutationV2 = useMutation({
    mutationFn: async ({ 
      roleId, 
      modulePermissions,
      moduleScopes
    }: { 
      roleId: number
      modulePermissions: Record<string, boolean>
      moduleScopes: Record<string, {
        scope?: string[]
        project?: string[]
        subproject?: string[]
        block?: string[]
        work_package?: string[]
      }>
    }) => {
      // 获取当前已分配的权限
      const currentPermissions = await permissionService.getRolePermissions(roleId)
      const currentKeys = new Set(
        currentPermissions.permissions.map(p => `${p.permission.resource_type}:${p.permission.action}`)
      )
      
      const newKeys = new Set(Object.keys(modulePermissions))
      
      // 需要删除的权限
      const toRemove = Array.from(currentKeys).filter(key => !newKeys.has(key))
      
      // 需要添加或更新的权限
      const toAddOrUpdate = Object.keys(modulePermissions)
      
      // 获取所有权限定义
      const allPermissions = await permissionService.getPermissions()
      
      // 删除权限
      for (const key of toRemove) {
        const colonIndex = key.indexOf(':')
        if (colonIndex === -1) continue
        const resourceType = key.substring(0, colonIndex)
        const action = key.substring(colonIndex + 1)
        const permission = allPermissions.find(p => p.resource_type === resourceType && p.action === action)
        if (permission) {
          await permissionService.revokeRolePermission(roleId, permission.id)
        }
      }
      
      // 添加或更新权限（使用模块统一的数据范围）
      for (const key of toAddOrUpdate) {
        const colonIndex = key.indexOf(':')
        if (colonIndex === -1) continue
        const resourceType = key.substring(0, colonIndex)
        const action = key.substring(colonIndex + 1)
        // 查找或创建权限定义
        let permission = allPermissions.find(p => p.resource_type === resourceType && p.action === action)
        
        if (!permission) {
          // 如果权限定义不存在，创建它
          const config = getResourceTypeConfig(resourceType)
          const actionConfig = config?.actions.find(a => a.value === action)
          if (!config || !actionConfig) continue
          
          try {
            permission = await permissionService.createPermission({
              code: `${resourceType}:${action}`,
              name: `${config.label} - ${actionConfig.label}`,
              description: `${config.description}的${actionConfig.label}权限`,
              resource_type: resourceType,
              action: action,
            })
          } catch (error: any) {
            // 如果创建失败（可能已存在），重新获取权限列表
            const updatedPermissions = await permissionService.getPermissions()
            permission = updatedPermissions.find(p => p.resource_type === resourceType && p.action === action)
            if (!permission) continue
          }
        }
        
        // 使用该模块的统一数据范围配置
        const moduleScope = moduleScopes[resourceType]
        const scopeParams: PermissionScope = {}
        if (moduleScope) {
          if (moduleScope.scope && moduleScope.scope.length > 0) {
            scopeParams.scope = moduleScope.scope.join(',')
          }
          if (moduleScope.project && moduleScope.project.length > 0) {
            scopeParams.project = moduleScope.project.join(',')
          }
          if (moduleScope.subproject && moduleScope.subproject.length > 0) {
            scopeParams.subproject = moduleScope.subproject.join(',')
          }
          if (moduleScope.block && moduleScope.block.length > 0) {
            scopeParams.block = moduleScope.block.join(',')
          }
          if (moduleScope.work_package && moduleScope.work_package.length > 0) {
            scopeParams.work_package = moduleScope.work_package.join(',')
          }
        }
        
        // 检查是否已存在，如果存在先删除
        if (currentKeys.has(key)) {
          // 删除该权限的记录（根据我们的设计，每个权限应该只有一条记录）
          // 但是如果有多条（历史遗留），需要删除所有
          const currentRolePerms = currentPermissions.permissions.filter(
            p => `${p.permission.resource_type}:${p.permission.action}` === key
          )
          
          // 删除所有匹配的记录
          for (const rp of currentRolePerms) {
            try {
              // 如果有scope信息，使用scope精确删除
              if (rp.scope && (rp.scope.scope || rp.scope.project || rp.scope.subproject || rp.scope.block || rp.scope.work_package)) {
                await permissionService.revokeRolePermission(roleId, permission.id, {
                  scope: rp.scope.scope || undefined,
                  project: rp.scope.project || undefined,
                  subproject: rp.scope.subproject || undefined,
                  block: rp.scope.block || undefined,
                  facility_id: rp.scope.facility_id || undefined,
                  discipline: rp.scope.discipline || undefined,
                  work_package: rp.scope.work_package || undefined,
                })
              } else {
                // 没有scope信息，删除第一条匹配的记录（后端API限制）
                await permissionService.revokeRolePermission(roleId, permission.id)
              }
            } catch (error: any) {
              // 如果删除失败（可能已经不存在），继续处理
              // 404错误可以忽略，说明记录已经不存在了
              if (error?.response?.status !== 404) {
                // 404错误可以忽略，其他错误已通过message.error显示
              }
            }
          }
        }
        
        // 添加权限
        try {
          await permissionService.assignRolePermission(roleId, {
            permission_id: permission.id,
            scope: Object.keys(scopeParams).length > 0 ? scopeParams : undefined,
          })
        } catch (error: any) {
          // 如果提示"角色已拥有该权限"，可能是删除操作还没完全生效，尝试再次删除后重试
          const detailStr = formatApiDetail(error?.response?.data?.detail, '')
          if (detailStr.includes('已拥有该权限') || error?.response?.status === 400) {
            // 权限已存在，尝试强制删除后重试（静默处理，不记录日志）
            try {
              // 再次尝试删除（可能删除操作还没完全生效）
              await permissionService.revokeRolePermission(roleId, permission.id)
              // 等待一小段时间确保删除完成
              await new Promise(resolve => setTimeout(resolve, 100))
              // 重试添加
              await permissionService.assignRolePermission(roleId, {
                permission_id: permission.id,
                scope: Object.keys(scopeParams).length > 0 ? scopeParams : undefined,
              })
            } catch (retryError: any) {
              // 重试失败，抛出原始错误
              throw new Error(`分配权限失败 (${key}): ${formatApiDetail(retryError?.response?.data?.detail, retryError?.message || '未知错误')}`)
            }
          } else {
            // 其他错误直接抛出
            throw new Error(`分配权限失败 (${key}): ${formatApiDetail(error?.response?.data?.detail, error?.message || '未知错误')}`)
          }
        }
      }
      
      return { 
        added: toAddOrUpdate.filter(key => !currentKeys.has(key)).length,
        removed: toRemove.length,
        updated: toAddOrUpdate.filter(key => currentKeys.has(key)).length,
      }
    },
    onSuccess: (result) => {
      message.success(`权限更新成功：新增 ${result.added} 个，更新 ${result.updated} 个，移除 ${result.removed} 个`)
      queryClient.invalidateQueries({ queryKey: ['rolePermissions'] })
      queryClient.invalidateQueries({ queryKey: ['permissions'] })
      setRolePermissionDrawerVisible(false)
      setModulePermissions({})
      setModuleScopes({})
      refetchRolePermissions()
    },
    onError: (error: any) => {
      logger.error('权限更新失败:', error)
      const errorMessage = error?.message || formatApiDetail(error?.response?.data?.detail, error?.response?.data?.message || '权限更新失败')
      message.error(errorMessage)
    },
  })

  // ========== 统计数据 ==========
  const activeRolesCount = roles.filter(r => r.is_active).length
  const coveredRoleTemplateKeys = new Set(
    roles
      .map((role) => findRoleTemplate(role)?.key)
      .filter((key): key is string => Boolean(key))
  )
  const uncoveredRoleTemplates = MANUFACTURING_ROLE_TEMPLATES.filter(
    (template) => !coveredRoleTemplateKeys.has(template.key)
  )

  // ========== 表格列定义 ==========
  const userColumns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (text: string, record: User) => (
        <Space>
          <UserOutlined style={{ color: '#1890ff' }} />
          <Button
            type="link"
            style={{ padding: 0, height: 'auto', fontWeight: 500 }}
            onClick={() => handleViewUser(record)}
          >
            {text}
          </Button>
          {record.is_superuser && <Tag color="red" icon={<SafetyOutlined />}>超级管理员</Tag>}
        </Space>
      ),
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
    },
    {
      title: '全名',
      dataIndex: 'full_name',
      key: 'full_name',
      ellipsis: true,
    },
    {
      title: '所属部门',
      dataIndex: 'department_id',
      key: 'department_id',
      width: 160,
      render: (departmentId?: number) => getDepartmentName(departmentId),
    },
    {
      title: '主要工作职责',
      dataIndex: 'responsible_for',
      key: 'responsible_for',
      ellipsis: true,
      render: (v: string | undefined) => v || '-',
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (isActive: boolean) => (
        <Badge
          status={isActive ? 'success' : 'default'}
          text={isActive ? '激活' : '禁用'}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: User) => (
        <Space>
          <Tooltip title="查看详情">
          <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewUser(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
            icon={<EditOutlined />}
            onClick={() => handleEditUser(record)}
            disabled={!currentUser?.is_superuser}
            />
          </Tooltip>
          <Tooltip title="权限管理">
            <Button
              type="text"
              icon={<LockOutlined />}
              onClick={() => handleManageUserPermissions(record.id)}
            />
          </Tooltip>
          <Popconfirm
            title="确定要重置该用户的密码吗？"
            description="重置后将生成新密码，请妥善保管"
            onConfirm={() => resetPasswordMutation.mutate(record.id)}
            disabled={!currentUser?.is_superuser}
          >
            <Tooltip title="重置密码">
              <Button
                type="text"
                icon={<KeyOutlined />}
                disabled={!currentUser?.is_superuser}
              />
            </Tooltip>
          </Popconfirm>
          <Popconfirm
            title="确定要删除这个用户吗？"
            description="此操作不可恢复"
            onConfirm={() => deleteUserMutation.mutate(record.id)}
            disabled={record.id === currentUser?.id || !currentUser?.is_superuser}
          >
            <Tooltip title="删除">
            <Button
                type="text"
              danger
              icon={<DeleteOutlined />}
              disabled={record.id === currentUser?.id || !currentUser?.is_superuser}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const roleColumns = [
    {
      title: '角色名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Role) => (
          <Space>
          <SafetyOutlined style={{ color: '#722ed1' }} />
          <Button
            type="link"
            style={{ padding: 0, height: 'auto', fontWeight: 500 }}
            onClick={() => handleViewRole(record)}
          >
            {text}
            </Button>
        </Space>
      ),
    },
    {
      title: '岗位画像',
      key: 'template',
      width: 240,
      render: (_: unknown, record: Role) => {
        const template = findRoleTemplate(record)
        if (!template) {
          return <Tag>自定义角色</Tag>
        }

        return (
          <Space wrap size={[4, 4]}>
            <Tag color={template.color}>{template.department}</Tag>
            {template.responsibilities.slice(0, 2).map((item) => (
              <Tag key={item}>{item}</Tag>
            ))}
          </Space>
        )
      },
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (isActive: boolean) => (
        <Badge
          status={isActive ? 'success' : 'default'}
          text={isActive ? '激活' : '禁用'}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      fixed: 'right' as const,
      render: (_: any, record: Role) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewRole(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEditRole(record)}
            />
          </Tooltip>
          <Tooltip title="分配权限">
            <Button
              type="text"
              icon={<LockOutlined />}
              onClick={() => handleAssignRolePermission(record.id)}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个角色吗？"
            description="此操作不可恢复"
            onConfirm={() => deleteRoleMutation.mutate(record.id)}
          >
            <Tooltip title="删除">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]


  return (
    <div style={{ 
      padding: '24px',
      background: '#f0f2f5',
      minHeight: 'calc(100vh - 64px)',
    }}>
      <Card
        style={{ marginBottom: 24, borderRadius: 16 }}
        bodyStyle={{ padding: 24 }}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#1f2937', marginBottom: 8 }}>
              制造企业账号与权限中心
            </div>
            <div style={{ color: '#4b5563', lineHeight: 1.8 }}>
              围绕“订单-设计-工艺-计划-采购-制造-质量-设备-成本”主线定义岗位权限，旧工程项目维度保留为遗留兼容能力，避免继续把制造组织结构绑在施工语义上。
            </div>
          </div>

          <Alert
            type="info"
            showIcon
            message="当前阶段策略"
            description="制造岗位优先、遗留工程模块降级展示。账号职责尽量按部门与岗位拆分，权限范围若涉及 Scope/项目/子项目/区块/工作包，均视为旧工程兼容字段。"
          />

          <Space wrap size={[8, 8]}>
            {MANUFACTURING_ROLE_TEMPLATES.map((template) => (
              <Tag key={template.key} color={template.color} style={{ padding: '4px 10px' }}>
                {template.name}
              </Tag>
            ))}
          </Space>
        </Space>
      </Card>

      <Tabs
        defaultActiveKey="users"
        items={[
    {
      key: 'users',
      label: (
              <Space>
          <TeamOutlined />
                <span>用户管理</span>
                <Badge count={totalUserCount} showZero style={{ backgroundColor: '#52c41a' }} overflowCount={99} />
              </Space>
      ),
      children: (
              <Card
                title={
                  <Space>
                    <UserOutlined />
                    <span>用户列表</span>
                  </Space>
                }
                extra={
                  <Space wrap>
            <Select
              allowClear
              placeholder="按部门筛选"
              style={{ width: 180 }}
              value={userDepartmentFilter}
              onChange={(v: number | undefined) => setUserDepartmentFilter(v ?? undefined)}
              options={departmentOptions}
            />
            <Input.Search
              placeholder="搜索用户名或邮箱"
              style={{ width: 260 }}
                      value={userSearchText}
                      onChange={(e) => setUserSearchText(e.target.value)}
              allowClear
                      prefix={<SearchOutlined />}
                    />
                    <Button
                      type="default"
                      icon={<ReloadOutlined />}
                      onClick={() => refetchUsers()}
                    >
                      刷新
                    </Button>
                    <Button
                      icon={<DownloadOutlined />}
                      onClick={() => exportUsersMutation.mutate()}
                      loading={exportUsersMutation.isPending}
                    >
                      批量导出
                    </Button>
                    <Button
                      icon={<UploadOutlined />}
                      onClick={() => setBatchImportModalVisible(true)}
                    >
                      批量导入
                    </Button>
                    <Button
                      type="primary"
                      icon={<UserAddOutlined />}
                      onClick={handleAddUser}
                    >
              新建用户
                    </Button>
                  </Space>
                }
              >
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                  <Col span={16}>
                    <Alert
                      type="success"
                      showIcon
                      message="制造组织建议"
                      description="建议账号创建时优先落到制造部门和岗位职责，例如工艺工程、生产计划、采购跟催、车间执行、质量放行、设备保全、成本核算等，减少“一个账号覆盖全流程”的粗放授权。"
                    />
                  </Col>
                  <Col span={8}>
                    <Card
                      size="small"
                      title="推荐部门分工"
                      bodyStyle={{ padding: 12, maxHeight: 132, overflowY: 'auto' }}
                    >
                      <Space direction="vertical" size={10} style={{ width: '100%' }}>
                        {MANUFACTURING_DEPARTMENT_GUIDE.slice(0, 4).map((item) => (
                          <div key={item.name}>
                            <div style={{ fontWeight: 600, color: '#1f2937', marginBottom: 4 }}>{item.name}</div>
                            <div style={{ fontSize: 12, color: '#6b7280' }}>{item.mission}</div>
                          </div>
                        ))}
                      </Space>
                    </Card>
                  </Col>
                </Row>

                <Row gutter={16} style={{ marginBottom: 24 }}>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="总用户数"
                        value={totalUserCount}
                        prefix={<TeamOutlined />}
                        valueStyle={{ color: '#1890ff' }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="激活用户"
                        value={activeUsersCount}
                        prefix={<CheckCircleOutlined />}
                        valueStyle={{ color: '#52c41a' }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="禁用用户"
                        value={inactiveUsersCount}
                        prefix={<CloseCircleOutlined />}
                        valueStyle={{ color: '#ff4d4f' }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="角色总数"
                        value={roles.length}
                        prefix={<SafetyOutlined />}
                        valueStyle={{ color: '#722ed1' }}
                      />
                    </Card>
                  </Col>
                </Row>
            <Table
              columns={userColumns}
              dataSource={users}
              loading={usersLoading}
              rowKey="id"
              pagination={{
                current: userPage,
                pageSize: userPageSize,
                total: totalUserCount,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条`,
                pageSizeOptions: ['10', '20', '50', '100'],
                onChange: (page, size) => {
                  setUserPage(page)
                  setUserPageSize(size || 20)
                },
              }}
                  scroll={{ x: 1000, y: 400 }}
            />
              </Card>
      ),
    },
    {
            key: 'roles',
      label: (
              <Space>
                <SafetyOutlined />
                <span>角色管理</span>
                <Badge count={roles.length} showZero style={{ backgroundColor: '#722ed1' }} />
              </Space>
      ),
      children: (
              <Card
                title={
            <Space>
                    <SafetyOutlined />
                    <span>角色列表</span>
                  </Space>
                }
                extra={
                  <Space>
                    <Button
                      type="default"
                      icon={<ReloadOutlined />}
                      onClick={() => refetchRoles()}
                    >
                      刷新
                    </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                      onClick={handleAddRole}
                >
                      新建角色
                </Button>
            </Space>
                }
              >
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 24 }}
                  message="角色模型重构方向"
                  description="推荐按制造岗位拆角色、按业务边界配权限、按组织责任定职责说明。遗留工程权限仍可分配，但默认应视为兼容能力而不是新平台主线。"
                />

                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="角色总数"
                        value={roles.length}
                        prefix={<SafetyOutlined />}
                        valueStyle={{ color: '#722ed1' }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="激活角色"
                        value={activeRolesCount}
                        prefix={<CheckCircleOutlined />}
                        valueStyle={{ color: '#52c41a' }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="推荐岗位覆盖"
                        value={coveredRoleTemplateKeys.size}
                        suffix={`/ ${MANUFACTURING_ROLE_TEMPLATES.length}`}
                        prefix={<TeamOutlined />}
                        valueStyle={{ color: '#0f766e' }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="待补齐岗位"
                        value={uncoveredRoleTemplates.length}
                        prefix={<CloseCircleOutlined />}
                        valueStyle={{ color: '#d97706' }}
                      />
                    </Card>
                  </Col>
                </Row>

                <Card
                  size="small"
                  title="推荐岗位模板"
                  style={{ marginBottom: 24 }}
                  extra={
                    uncoveredRoleTemplates.length ? (
                      <Space wrap size={[4, 4]}>
                        {uncoveredRoleTemplates.slice(0, 4).map((template) => (
                          <Tag key={template.key} color="warning">
                            待补齐：{template.name}
                          </Tag>
                        ))}
                      </Space>
                    ) : (
                      <Tag color="success">推荐岗位已全部覆盖</Tag>
                    )
                  }
                >
                  <Row gutter={[16, 16]}>
                    {MANUFACTURING_ROLE_TEMPLATES.map((template) => {
                      const exists = roles.some((role) => findRoleTemplate(role)?.key === template.key)
                      return (
                        <Col key={template.key} span={8}>
                          <Card
                            size="small"
                            bordered
                            style={{
                              height: '100%',
                              borderColor: exists ? '#b7eb8f' : '#d9d9d9',
                              background: exists ? '#f6ffed' : '#fff',
                            }}
                          >
                            <Space direction="vertical" size={10} style={{ width: '100%' }}>
                              <Space wrap>
                                <Tag color={template.color}>{template.department}</Tag>
                                {exists ? <Tag color="success">已覆盖</Tag> : <Tag>推荐</Tag>}
                              </Space>
                              <div style={{ fontSize: 16, fontWeight: 600, color: '#1f2937' }}>{template.name}</div>
                              <div style={{ minHeight: 44, fontSize: 12, color: '#6b7280', lineHeight: 1.7 }}>
                                {template.summary}
                              </div>
                              <Space wrap size={[4, 4]}>
                                {template.responsibilities.map((item) => (
                                  <Tag key={item}>{item}</Tag>
                                ))}
                              </Space>
                              <Space wrap size={[4, 4]}>
                                {template.suggestedModules.map((item) => (
                                  <Tag key={item} color="blue">
                                    {item}
                                  </Tag>
                                ))}
                              </Space>
                              <Button onClick={() => applyRoleTemplate(template)}>
                                套用模板
                              </Button>
                            </Space>
                          </Card>
                        </Col>
                      )
                    })}
                  </Row>
                </Card>

              <Table
                  columns={roleColumns}
                  dataSource={roles}
                  rowKey="id"
                  pagination={{
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 条`,
                    pageSizeOptions: ['10', '20', '50', '100'],
                    defaultPageSize: 20,
                  }}
                  scroll={{ y: 400 }}
                />
              </Card>
      ),
    },
        ]}
      />

      {/* 用户编辑Drawer */}
      <Drawer
        title={editingUser ? '编辑用户' : '新建用户'}
        open={userDrawerVisible}
        onClose={() => {
          setUserDrawerVisible(false)
          userForm.resetFields()
          setEditingUser(null)
        }}
        width={600}
        destroyOnClose
      >
        <Form
          form={userForm}
          layout="vertical"
          onFinish={handleUserSubmit}
        >
          {!editingUser && (
            <Form.Item
              name="username"
              label="用户名"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input placeholder="请输入用户名" />
            </Form.Item>
          )}

          <Form.Item
            name="email"
            label="邮箱"
            rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>

          <Form.Item name="full_name" label="全名">
            <Input placeholder="请输入姓名或岗位显示名" />
          </Form.Item>

          <Form.Item name="department_id" label="部门">
            <Select allowClear placeholder="请选择制造组织部门" options={departmentOptions} />
          </Form.Item>

          <Form.Item name="role_ids" label="分配职位角色">
            <Select
              mode="multiple"
              placeholder="请选择岗位职位（可多选）"
              allowClear
              options={roles.filter(r => r.is_active).map(r => ({
                label: (
                  <Space>
                    <span>{r.name}</span>
                    <small style={{ color: '#999' }}>({findRoleTemplate(r)?.department || '自定义'})</small>
                  </Space>
                ),
                value: r.id
              }))}
            />
          </Form.Item>

          <Form.Item name="responsible_for" label="主要工作职责">
            <Input.TextArea rows={2} placeholder="如：订单评审、工艺审核、APS 排产、供应跟催、工位报工审核、质量放行等" />
          </Form.Item>

          <Form.Item name="is_active" label="状态" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="激活" unCheckedChildren="禁用" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={createUserMutation.isPending || updateUserMutation.isPending}>
                保存
              </Button>
              <Button onClick={() => setUserDrawerVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Drawer>

      {/* 用户详情Drawer */}
      <Drawer
        title={
          <Space>
            <UserOutlined />
            <span>用户详情</span>
          </Space>
        }
        open={userDetailDrawerVisible}
        onClose={() => {
          setUserDetailDrawerVisible(false)
          setSelectedUserId(null)
        }}
        width={800}
        extra={
          selectedUserId && (
            <Space>
              <Button
                icon={<EditOutlined />}
                onClick={() => {
                  const user = users.find(u => u.id === selectedUserId)
                  if (user) {
                    setUserDetailDrawerVisible(false)
                    handleEditUser(user)
                  }
                }}
              >
                编辑
              </Button>
              <Popconfirm
                title="确定要重置该用户的密码吗？"
                description="重置后将生成新密码，请妥善保管"
                onConfirm={() => {
                  if (selectedUserId) {
                    resetPasswordMutation.mutate(selectedUserId)
                  }
                }}
              >
                <Button
                  icon={<KeyOutlined />}
                  style={{ marginRight: 8 }}
                >
                  重置密码
                </Button>
              </Popconfirm>
              <Button
                type="primary"
                icon={<LockOutlined />}
                onClick={() => {
                  setUserDetailDrawerVisible(false)
                  handleManageUserPermissions(selectedUserId)
                }}
              >
                权限管理
              </Button>
            </Space>
          )
        }
      >
        {selectedUserId && users.find(u => u.id === selectedUserId) && (
          <div>
            <Descriptions
              title="基本信息"
              bordered
              column={2}
              items={[
                {
                  label: '用户名',
                  children: users.find(u => u.id === selectedUserId)?.username,
                },
                {
                  label: '邮箱',
                  children: users.find(u => u.id === selectedUserId)?.email || '-',
                },
                {
                  label: '全名',
                  children: users.find(u => u.id === selectedUserId)?.full_name || '-',
                },
                {
                  label: '部门',
                  children: getDepartmentName(users.find(u => u.id === selectedUserId)?.department_id),
                },
                {
                  label: '主要工作职责',
                  children: users.find(u => u.id === selectedUserId)?.responsible_for || '-',
                },
                {
                  label: '状态',
                  children: (
                    <Badge
                      status={users.find(u => u.id === selectedUserId)?.is_active ? 'success' : 'default'}
                      text={users.find(u => u.id === selectedUserId)?.is_active ? '激活' : '禁用'}
                    />
                  ),
                },
                {
                  label: '超级管理员',
                  children: users.find(u => u.id === selectedUserId)?.is_superuser ? <Tag color="red">是</Tag> : <Tag>否</Tag>,
                },
              ]}
            />

            <Divider />

            <div style={{ marginBottom: 16 }}>
              <Space>
                <strong>用户角色：</strong>
                {userRolesData?.roles.length ? (
                  userRolesData.roles.map((role) => (
                    <Tag key={role.id} color="purple" style={{ fontSize: 14, padding: '4px 12px' }}>
                      {role.name}
                    </Tag>
                  ))
                ) : (
                  <Tag>暂无角色</Tag>
                )}
              </Space>
            </div>

            <div>
              <strong>用户权限：</strong>
              <div style={{ marginTop: 12 }}>
                {userPermissions ? (
                  <div>
                    <div style={{ marginBottom: 16 }}>
                      <Alert 
                        type="info" 
                        message="权限视角：已按制造模块对员工拥有的分散权限进行了矩阵聚合。" 
                        showIcon 
                      />
                    </div>
                    <Table
                      columns={[
                        {
                          title: '业务模块',
                          dataIndex: 'label',
                          key: 'label',
                          fixed: 'left',
                          width: 180,
                          render: (text, record) => (
                            <Space direction="vertical" size={0}>
                              <span style={{ fontWeight: 600 }}>{text}</span>
                              <small style={{ color: '#999' }}>{record.category}</small>
                            </Space>
                          )
                        },
                        ...['read', 'create', 'update', 'delete', 'report', 'release', 'assign', 'sync'].map(actionKey => ({
                          title: actionKey === 'read' ? '查看' : 
                                 actionKey === 'create' ? '新增/发布' : 
                                 actionKey === 'update' ? '修改/维护' : 
                                 actionKey === 'delete' ? '删除/撤回' :
                                 actionKey === 'report' ? '报工' :
                                 actionKey === 'release' ? '质量放行' :
                                 actionKey === 'assign' ? '授权' : '同步',
                          key: actionKey,
                          align: 'center' as const,
                          width: 100,
                          render: (_: any, record: any) => {
                            const hasAct = record.actions.find((a: any) => a.action === actionKey);
                            if (!hasAct) return <span style={{ color: '#f0f0f0' }}>-</span>;
                            return (
                              <Tooltip title={
                                <div>
                                  <div>来源: {hasAct.source}</div>
                                  {hasAct.scope && <div>范围限制: {JSON.stringify(hasAct.scope)}</div>}
                                </div>
                              }>
                                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />
                              </Tooltip>
                            );
                          }
                        }))
                      ]}
                      dataSource={(() => {
                        const matrix = {};
                        userPermissions.permissions.forEach((p) => {
                          const config = getResourceTypeConfig(p.resource_type);
                          if (!matrix[p.resource_type]) {
                            matrix[p.resource_type] = {
                              key: p.resource_type,
                              label: config.label,
                              category: config.category,
                              actions: []
                            };
                          }
                          matrix[p.resource_type].actions.push({
                            action: p.action,
                            source: p.source,
                            scope: p.scope
                          });
                        });
                        return Object.values(matrix).sort((a, b) => {
                          const order = { '制造协同': 0, '平台治理': 1, '遗留工程': 2 };
                          return (order[a.category] ?? 9) - (order[b.category] ?? 9);
                        });
                      })()}
                      rowKey="key"
                      pagination={false}
                      size="small"
                      scroll={{ x: 1000 }}
                      bordered
                    />
                    
                    <Divider orientation="left" style={{ marginTop: 32 }}>原始权限明细</Divider>
                    <Table
                      columns={[
                        {
                          title: '权限代码',
                          dataIndex: 'permission_code',
                          key: 'permission_code',
                          width: 200,
                          render: (code) => <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 3 }}>{code}</code>,
                        },
                        {
                          title: '权限名称',
                          dataIndex: 'permission_name',
                          key: 'permission_name',
                        },
                        {
                          title: '业务模块',
                          dataIndex: 'resource_type',
                          key: 'resource_type',
                          width: 200,
                          render: (resourceType) => {
                            const config = getResourceTypeConfig(resourceType)
                            return <Tag color={config.legacy ? 'gold' : 'blue'}>{config.label}</Tag>
                          },
                        },
                        {
                          title: '来源',
                          dataIndex: 'source',
                          key: 'source',
                          render: (source) => {
                            if (source?.startsWith('role:')) {
                              return <Tag color="purple">角色: {source.replace('role:', '')}</Tag>
                            }
                            return <Tag color="blue">直接分配</Tag>
                          },
                        },
                      ]}
                      dataSource={userPermissions.permissions}
                      rowKey="permission_code"
                      pagination={false}
                      size="small"
                    />
                  </div>
                ) : (
                  <Empty description="加载中..." />
                )}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* 角色编辑Drawer */}
      <Drawer
        title={editingRole ? '编辑角色' : '新建角色'}
        open={roleDrawerVisible}
        onClose={() => {
          setRoleDrawerVisible(false)
          roleForm.resetFields()
          setEditingRole(null)
        }}
        width={600}
        destroyOnClose
      >
        <Form
          form={roleForm}
          layout="vertical"
          onFinish={handleRoleSubmit}
        >
          {!editingRole && (
            <Card
              size="small"
              title="快速套用制造岗位模板"
              style={{ marginBottom: 16 }}
              bodyStyle={{ padding: 12 }}
            >
              <Space wrap size={[8, 8]}>
                {MANUFACTURING_ROLE_TEMPLATES.map((template) => (
                  <Button key={template.key} onClick={() => applyRoleTemplate(template)}>
                    {template.name}
                  </Button>
                ))}
              </Space>
            </Card>
          )}

            <Form.Item
            name="name"
            label="角色名称"
            rules={[{ required: true, message: '请输入角色名称' }]}
            >
            <Input placeholder="如：生产计划员、工艺工程师、质量工程师" />
            </Form.Item>

          <Form.Item name="description" label="描述">
            <Input.TextArea rows={4} placeholder="建议写清负责环节、核心职责、协同对象和数据边界" />
          </Form.Item>

          <Form.Item name="is_active" label="状态" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="激活" unCheckedChildren="禁用" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={createRoleMutation.isPending || updateRoleMutation.isPending}>
                保存
              </Button>
              <Button onClick={() => setRoleDrawerVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Drawer>

      {/* 角色详情Drawer */}
      <Drawer
        title={
          <Space>
            <SafetyOutlined />
            <span>角色详情</span>
          </Space>
        }
        open={roleDetailDrawerVisible}
        onClose={() => {
          setRoleDetailDrawerVisible(false)
          setSelectedRoleId(null)
        }}
        width={800}
        extra={
          selectedRoleId && (
            <Space>
              <Button
                icon={<LockOutlined />}
                onClick={() => {
                  if (selectedRoleId) {
                    setRoleDetailDrawerVisible(false)
                    handleAssignRolePermission(selectedRoleId)
                  }
                }}
              >
                分配权限
              </Button>
              <Button
                icon={<EditOutlined />}
                onClick={() => {
                  const role = roles.find(r => r.id === selectedRoleId)
                  if (role) {
                    setRoleDetailDrawerVisible(false)
                    handleEditRole(role)
                  }
                }}
              >
                编辑
              </Button>
            </Space>
          )
        }
      >
        {selectedRoleId && roles.find(r => r.id === selectedRoleId) && (
          <div>
            <Descriptions
              title="基本信息"
              bordered
              column={2}
              items={[
                {
                  label: '角色名称',
                  children: roles.find(r => r.id === selectedRoleId)?.name,
                },
                {
                  label: '描述',
                  children: roles.find(r => r.id === selectedRoleId)?.description || '-',
                },
                {
                  label: '岗位画像',
                  children: (() => {
                    const role = roles.find(r => r.id === selectedRoleId)
                    const template = role ? findRoleTemplate(role) : undefined
                    if (!template) {
                      return <Tag>自定义角色</Tag>
                    }

                    return (
                      <Space wrap size={[4, 4]}>
                        <Tag color={template.color}>{template.name}</Tag>
                        <Tag>{template.department}</Tag>
                      </Space>
                    )
                  })(),
                },
                {
                  label: '状态',
                  children: (
                    <Badge
                      status={roles.find(r => r.id === selectedRoleId)?.is_active ? 'success' : 'default'}
                      text={roles.find(r => r.id === selectedRoleId)?.is_active ? '激活' : '禁用'}
                    />
                  ),
                },
              ]}
            />

            <Divider />

            <div>
              <strong>角色权限：</strong>
              <div style={{ marginTop: 12 }}>
                {rolePermissions ? (
                  <div>
                    <div style={{ marginBottom: 8, color: '#999', fontSize: 12 }}>
                      共 {rolePermissions.permissions.length} 个权限
                    </div>
                    <Table
                      columns={[
                        {
                          title: '权限代码',
                          dataIndex: ['permission', 'code'],
                          key: 'code',
                          width: 200,
                          render: (code: string) => <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 3 }}>{code}</code>,
                        },
                        {
                          title: '权限名称',
                          dataIndex: ['permission', 'name'],
                          key: 'name',
                        },
                        {
                          title: '业务模块',
                          dataIndex: ['permission', 'resource_type'],
                          key: 'resource_type',
                          width: 240,
                          render: (resourceType: string) => {
                            const config = getResourceTypeConfig(resourceType)
                            return (
                              <Space wrap size={[4, 4]}>
                                <Tag color={config.legacy ? 'gold' : 'blue'}>{config.label}</Tag>
                                <Tag>{config.category}</Tag>
                              </Space>
                            )
                          },
                        },
                        {
                          title: '范围',
                          key: 'scope',
                          render: (_: any, record: any) => renderScopeTags(record.scope),
                        },
                        {
                          title: '操作',
                          key: 'action',
                          width: 100,
                          render: (_: any, record: any) => (
                            <Popconfirm
                              title="确定要撤销这个权限吗？"
                              onConfirm={() => handleRevokeRolePermission(record.permission.id, record.scope)}
                            >
                              <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                                撤销
                              </Button>
                            </Popconfirm>
                          ),
                        },
                      ]}
                      dataSource={rolePermissions.permissions.map((p) => ({
                        key: p.id,
                        permission: p.permission,
                        scope: p.scope,
                      }))}
                      rowKey="key"
                      pagination={false}
                      size="small"
                    />
                  </div>
                ) : (
                  <Empty description="加载中..." />
                )}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* 用户权限管理Drawer */}
      <Drawer
        title={
          <Space>
            <LockOutlined />
            <span>用户权限管理</span>
          </Space>
        }
        open={permissionDrawerVisible}
        onClose={() => {
          setPermissionDrawerVisible(false)
          setSelectedUserId(null)
        }}
        width={900}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setAssignRoleDrawerVisible(true)}
          >
            分配角色
          </Button>
        }
      >
        {selectedUserId && users.find(u => u.id === selectedUserId) && (
          <div>
            <Descriptions
              title="用户信息"
              column={3}
              items={[
                {
                  label: '用户名',
                  children: users.find(u => u.id === selectedUserId)?.username,
                },
                {
                  label: '邮箱',
                  children: users.find(u => u.id === selectedUserId)?.email || '-',
                },
                {
                  label: '全名',
                  children: users.find(u => u.id === selectedUserId)?.full_name || '-',
                },
                {
                  label: '部门',
                  children: getDepartmentName(users.find(u => u.id === selectedUserId)?.department_id),
                },
                {
                  label: '主要工作职责',
                  children: users.find(u => u.id === selectedUserId)?.responsible_for || '-',
                },
              ]}
              style={{ marginBottom: 24 }}
            />

            <Card
              title="用户角色"
              size="small"
              style={{ marginBottom: 24 }}
              extra={
                <Button
                  type="link"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => setAssignRoleDrawerVisible(true)}
                >
                  分配角色
                </Button>
              }
            >
              {userRolesData?.roles.length ? (
                <Space wrap>
                  {userRolesData.roles.map((role) => {
                    const template = findRoleTemplate(role)
                    return (
                      <Space key={role.id} size={[4, 4]}>
                        <Tag
                          color="purple"
                          closable
                          onClose={() => revokeUserRoleMutation.mutate({
                            userId: selectedUserId,
                            roleId: role.id,
                          })}
                          style={{ fontSize: 14, padding: '4px 12px' }}
                        >
                          {role.name}
                        </Tag>
                        {template && <Tag color={template.color}>{template.department}</Tag>}
                      </Space>
                    )
                  })}
                </Space>
              ) : (
                <Empty description="暂无角色" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>

            <Card title="用户权限" size="small">
              {userPermissions ? (
                <Table
                  columns={[
                    {
                      title: '权限代码',
                      dataIndex: 'permission_code',
                      key: 'permission_code',
                      width: 200,
                      render: (code: string) => <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 3 }}>{code}</code>,
                    },
                    {
                      title: '权限名称',
                      dataIndex: 'permission_name',
                      key: 'permission_name',
                    },
                    {
                      title: '业务模块',
                      dataIndex: 'resource_type',
                      key: 'resource_type',
                      width: 240,
                      render: (resourceType: string) => {
                        const config = getResourceTypeConfig(resourceType)
                        return (
                          <Space wrap size={[4, 4]}>
                            <Tag color={config.legacy ? 'gold' : 'blue'}>{config.label}</Tag>
                            <Tag>{config.category}</Tag>
                          </Space>
                        )
                      },
                    },
                    {
                      title: '操作类型',
                      dataIndex: 'action',
                      key: 'action',
                      width: 100,
                      render: (action: string) => (
                        <Tag color={action === 'read' ? 'blue' : action === 'update' ? 'orange' : action === 'delete' ? 'red' : 'default'}>
                          {action}
                        </Tag>
                      ),
                    },
                    {
                      title: '数据范围',
                      dataIndex: 'scope',
                      key: 'scope',
                      width: 260,
                      render: (scope: PermissionScope) => renderScopeTags(scope),
                    },
                    {
                      title: '来源',
                      dataIndex: 'source',
                      key: 'source',
                      width: 150,
                      render: (source: string) => {
                        if (source?.startsWith('role:')) {
                          return <Tag color="purple">角色: {source.replace('role:', '')}</Tag>
                        }
                        return <Tag color="blue">直接分配</Tag>
                      },
                    },
                  ]}
                  dataSource={userPermissions.permissions}
                  rowKey="permission_code"
                  pagination={false}
                  size="small"
                />
              ) : (
                <Empty description="加载中..." />
              )}
            </Card>
          </div>
        )}
      </Drawer>

      {/* 分配角色Drawer */}
      <Drawer
        title="分配角色"
        open={assignRoleDrawerVisible}
        onClose={() => setAssignRoleDrawerVisible(false)}
        width={500}
      >
        <div>
          <div style={{ marginBottom: 16, color: '#999', fontSize: 14 }}>
            选择要分配给用户的角色
          </div>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {roles.filter(r => r.is_active).map((role) => {
              const isAssigned = userRolesData?.roles.some(ur => ur.id === role.id)
              const template = findRoleTemplate(role)
              return (
                <Card
                  key={role.id}
                  size="small"
                  style={{
                    cursor: isAssigned ? 'not-allowed' : 'pointer',
                    opacity: isAssigned ? 0.6 : 1,
                  }}
                  onClick={() => {
                    if (!isAssigned && selectedUserId) {
                      handleAssignRoleToUser(role.id)
                    }
                  }}
                >
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 500, marginBottom: 4 }}>{role.name}</div>
                      {template && (
                        <Space wrap size={[4, 4]} style={{ marginBottom: 4 }}>
                          <Tag color={template.color}>{template.department}</Tag>
                          {template.responsibilities.slice(0, 2).map((item) => (
                            <Tag key={item}>{item}</Tag>
                          ))}
                        </Space>
                      )}
                      {role.description && (
                        <div style={{ fontSize: 12, color: '#999' }}>{role.description}</div>
                      )}
                    </div>
                    {isAssigned ? (
                      <Tag color="success" icon={<CheckCircleOutlined />}>已分配</Tag>
                    ) : (
                      <Button type="primary" size="small">
                        分配
                      </Button>
                    )}
                  </Space>
                </Card>
              )
            })}
          </Space>
        </div>
      </Drawer>

      {/* 角色权限分配Drawer - 新设计：资源类型卡片 + 操作类型选择 */}
      <Drawer
        title={
          <Space>
            <LockOutlined />
            <span>为角色分配权限</span>
            {selectedRoleId && roles.find(r => r.id === selectedRoleId) && (
              <Tag color="purple">{roles.find(r => r.id === selectedRoleId)?.name}</Tag>
            )}
          </Space>
        }
        open={rolePermissionDrawerVisible}
        onClose={() => {
          setRolePermissionDrawerVisible(false)
          setModulePermissions({})
          setModuleScopes({})
        }}
        width={1000}
        extra={
          <Space>
            <Button onClick={() => setRolePermissionDrawerVisible(false)}>
              取消
            </Button>
            <Button
              type="primary"
              onClick={handleBatchAssignPermissions}
              loading={batchAssignPermissionsMutationV2.isPending}
            >
              保存 ({selectedPermissionsCount} 个权限)
            </Button>
          </Space>
        }
      >
        <div style={{ padding: '8px 0' }}>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="权限分层说明"
            description="制造协同模块优先服务设备、工装、工艺接口等制造主线；平台治理模块用于账号与角色分权；遗留工程模块仅在历史系统兼容时启用，避免继续作为默认授权范围。"
          />

          <div style={{ marginBottom: 16, color: '#666', fontSize: 14 }}>
            第一步：按业务模块勾选权限动作。第二步：如需限制旧工程数据边界，再配置 Scope/项目/子项目/区块/工作包等遗留范围字段。
          </div>

          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {RESOURCE_CATEGORY_ORDER.map((category) => {
              const resourceEntries = Object.entries(MANUFACTURING_RESOURCE_TYPE_CONFIG).filter(
                ([, config]) => config.category === category
              )

              if (!resourceEntries.length) {
                return null
              }

              return (
                <div key={category}>
                  <Space style={{ marginBottom: 12 }}>
                    <Tag color={category === '遗留工程' ? 'gold' : category === '平台治理' ? 'cyan' : 'blue'}>
                      {category}
                    </Tag>
                    <span style={{ color: '#6b7280', fontSize: 12 }}>
                      {category === '制造协同'
                        ? '建议用于设备、工艺、现场执行等制造主线授权。'
                        : category === '平台治理'
                          ? '建议用于组织、岗位、账号治理授权。'
                          : '仅用于历史工程模块兼容，谨慎赋权。'}
                    </span>
                  </Space>

                  <Row gutter={[16, 16]}>
                    {resourceEntries.map(([resourceType, config]) => {
                      const selectedActions = config.actions.filter(action => {
                        const key = `${resourceType}:${action.value}`
                        return modulePermissions[key]
                      })

                      const moduleScope = moduleScopes[resourceType]
                      const hasScope = moduleScope && (
                        (moduleScope.scope && moduleScope.scope.length > 0) ||
                        (moduleScope.project && moduleScope.project.length > 0) ||
                        (moduleScope.subproject && moduleScope.subproject.length > 0) ||
                        (moduleScope.block && moduleScope.block.length > 0) ||
                        (moduleScope.work_package && moduleScope.work_package.length > 0)
                      )

                      return (
                        <Col key={resourceType} span={12}>
                          <Card
                            size="small"
                            title={
                              <Space wrap size={[4, 4]}>
                                <Tag color={config.legacy ? 'gold' : 'blue'} style={{ fontSize: 13, padding: '2px 8px' }}>
                                  {config.label}
                                </Tag>
                                <Tag>{config.category}</Tag>
                                {config.legacy && <Tag color="warning">遗留</Tag>}
                                {selectedActions.length > 0 && (
                                  <Tag color="green" style={{ fontSize: 12 }}>
                                    已选 {selectedActions.length}/{config.actions.length}
                                  </Tag>
                                )}
                                {hasScope && (
                                  <Tag color="orange" icon={<LockOutlined />} style={{ fontSize: 12 }}>
                                    已配置范围
                                  </Tag>
                                )}
                              </Space>
                            }
                            extra={
                              <Space>
                                {selectedActions.length > 0 && (
                                  <Button
                                    type="link"
                                    size="small"
                                    icon={<LockOutlined />}
                                    onClick={() => handleOpenScopeConfig(resourceType)}
                                  >
                                    配置范围
                                  </Button>
                                )}
                                <Button
                                  type="link"
                                  size="small"
                                  onClick={() => {
                                    const allSelected = config.actions.every(action => {
                                      const key = `${resourceType}:${action.value}`
                                      return modulePermissions[key]
                                    })
                                    const newPermissions = { ...modulePermissions }
                                    config.actions.forEach(action => {
                                      const key = `${resourceType}:${action.value}`
                                      if (allSelected) {
                                        delete newPermissions[key]
                                      } else {
                                        newPermissions[key] = true
                                      }
                                    })
                                    setModulePermissions(newPermissions)
                                  }}
                                >
                                  {config.actions.every(action => modulePermissions[`${resourceType}:${action.value}`]) ? '全不选' : '全选'}
                                </Button>
                              </Space>
                            }
                          >
                            <div style={{ fontSize: 12, color: '#999', marginBottom: 12, lineHeight: 1.7 }}>
                              {config.description}
                            </div>
                            <Space direction="vertical" style={{ width: '100%' }} size={8}>
                              {config.actions.map((action) => {
                                const key = `${resourceType}:${action.value}`
                                const isSelected = !!modulePermissions[key]

                                return (
                                  <div
                                    key={action.value}
                                    style={{
                                      padding: '8px 12px',
                                      border: isSelected ? '1px solid #1890ff' : '1px solid #e8e8e8',
                                      borderRadius: 4,
                                      background: isSelected ? '#f0f7ff' : '#fafafa',
                                      cursor: 'pointer',
                                    }}
                                    onClick={() => handleTogglePermission(resourceType, action.value)}
                                  >
                                    <Space>
                                      <Checkbox
                                        checked={isSelected}
                                        onChange={(e) => {
                                          e.stopPropagation()
                                          handleTogglePermission(resourceType, action.value)
                                        }}
                                      >
                                        <Tag color={action.color || 'default'} style={{ marginLeft: 8 }}>
                                          {action.label}
                                        </Tag>
                                      </Checkbox>
                                    </Space>
                                  </div>
                                )
                              })}
                            </Space>
                          </Card>
                        </Col>
                      )
                    })}
                  </Row>
                </div>
              )
            })}
          </Space>
        </div>
      </Drawer>

      {/* 模块数据范围配置Drawer - 分组、排序、美观 */}
      <Drawer
        title={
          <Space>
            <LockOutlined />
            <span>配置模块数据访问范围</span>
            {currentConfigModule && MANUFACTURING_RESOURCE_TYPE_CONFIG[currentConfigModule] && (
              <Tag color="blue">{MANUFACTURING_RESOURCE_TYPE_CONFIG[currentConfigModule].label}</Tag>
            )}
          </Space>
        }
        open={scopeConfigDrawerVisible}
        onClose={() => {
          setScopeConfigDrawerVisible(false)
          setCurrentConfigModule(null)
          setTempScopeConfig({})
        }}
        width={900}
        extra={
          <Space>
            <Button onClick={() => {
              setScopeConfigDrawerVisible(false)
              setCurrentConfigModule(null)
              setTempScopeConfig({})
            }}>
              取消
            </Button>
            <Button type="primary" onClick={handleSaveScopeConfig}>
              保存
            </Button>
          </Space>
        }
      >
        <div style={{ padding: '8px 0' }}>
            <Alert
            message="配置遗留数据访问范围"
            description="这里的 Scope、项目、子项目、区块、工作包均为旧工程系统兼容字段。若留空表示全范围访问；若配置，则只允许访问指定遗留范围数据。制造主线后续建议升级为工厂/车间/产线/工位/工序等维度。"
              type="info"
              showIcon
            style={{ marginBottom: 24 }}
          />
          
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* GCC_Scope 分组 */}
            <Card
              title={
                <Space>
                  <Tag color="blue">遗留 Scope 维度</Tag>
                  <span style={{ fontSize: 12, color: '#999' }}>
                    原作业清单范围 ({tempScopeConfig.scope?.length || 0} 个已选)
                  </span>
                </Space>
              }
              size="small"
              extra={
                <Space>
                  <Button
                    size="small"
                    onClick={() => {
                      const allScopes = gccScopeOptions?.scopes || []
                      setTempScopeConfig({
                        ...tempScopeConfig,
                        scope: (tempScopeConfig.scope?.length || 0) === allScopes.length ? [] : allScopes,
                      })
                    }}
                  >
                    {(tempScopeConfig.scope?.length || 0) === (gccScopeOptions?.scopes?.length || 0) ? '清空' : '全选'}
                  </Button>
                </Space>
              }
            >
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: 8, 
                maxHeight: 200, 
                overflowY: 'auto',
                padding: '8px 0',
              }}>
                {gccScopeOptions?.scopes?.sort().map((scope) => (
                  <Button
                    key={scope}
                    size="small"
                    type={tempScopeConfig.scope?.includes(scope) ? 'primary' : 'default'}
                    onClick={() => {
                      const currentScopes = tempScopeConfig.scope || []
                      setTempScopeConfig({
                        ...tempScopeConfig,
                        scope: currentScopes.includes(scope)
                          ? currentScopes.filter(s => s !== scope)
                          : [...currentScopes, scope].sort(),
                      })
                    }}
                  >
                    {scope}
                  </Button>
                ))}
              </div>
            </Card>

            {/* Facilities 级联分组 */}
            <Card
              title={
                <Space>
                  <Tag color="green">遗留项目层级</Tag>
                  <span style={{ fontSize: 12, color: '#999' }}>
                    项目/子项目/区块 ({[tempScopeConfig.project, tempScopeConfig.subproject, tempScopeConfig.block].filter(arr => arr && arr.length > 0).length} 个层级已配置)
                  </span>
                </Space>
              }
              size="small"
            >
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                {/* 项目 */}
                <div>
                  <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 13 }}>遗留项目：</strong>
                    <Space>
                      <Button
                        size="small"
                        onClick={() => {
                          const allProjects = facilitiesOptions?.projects || []
                          const currentProjects = tempScopeConfig.project || []
                          const willBeEmpty = currentProjects.length === allProjects.length
                          setTempScopeConfig({
                            ...tempScopeConfig,
                            project: willBeEmpty ? [] : allProjects,
                            subproject: willBeEmpty ? [] : (tempScopeConfig.subproject || []),
                            block: willBeEmpty ? [] : (tempScopeConfig.block || []),
                          })
                          setTimeout(() => refetchFacilitiesOptions(), 100)
                        }}
                      >
                        {(tempScopeConfig.project?.length || 0) === (facilitiesOptions?.projects?.length || 0) ? '清空' : '全选'}
                      </Button>
                      <span style={{ fontSize: 12, color: '#999' }}>
                        已选 {(tempScopeConfig.project?.length || 0)} / {facilitiesOptions?.projects?.length || 0}
                      </span>
                    </Space>
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: 8, 
                    maxHeight: 120, 
                    overflowY: 'auto',
                    padding: '8px',
                    background: '#fafafa',
                    borderRadius: 4,
                  }}>
                    {facilitiesOptions?.projects?.sort().map((project) => (
                      <Button
                        key={project}
                        size="small"
                        type={tempScopeConfig.project?.includes(project) ? 'primary' : 'default'}
                        onClick={() => {
                          const currentProjects = tempScopeConfig.project || []
                          const willAdd = !currentProjects.includes(project)
                          setTempScopeConfig({
                            ...tempScopeConfig,
                            project: willAdd 
                              ? [...currentProjects, project].sort()
                              : currentProjects.filter(p => p !== project),
                            subproject: willAdd ? [] : (tempScopeConfig.subproject || []),
                            block: willAdd ? [] : (tempScopeConfig.block || []),
                          })
                          setTimeout(() => refetchFacilitiesOptions(), 100)
                        }}
                      >
                        {project}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* 子项目（仅在选择项目后显示） */}
                {(tempScopeConfig.project?.length || 0) > 0 && (
                  <div>
                    <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: 13 }}>遗留子项目：</strong>
                      <Space>
                        <Button
                          size="small"
                          onClick={() => {
                            const allSubprojects = facilitiesOptions?.subprojects || []
                            const currentSubprojects = tempScopeConfig.subproject || []
                            const willBeEmpty = currentSubprojects.length === allSubprojects.length
                            setTempScopeConfig({
                              ...tempScopeConfig,
                              subproject: willBeEmpty ? [] : allSubprojects,
                              block: willBeEmpty ? [] : (tempScopeConfig.block || []),
                            })
                            setTimeout(() => refetchFacilitiesOptions(), 100)
                          }}
                        >
                          {(tempScopeConfig.subproject?.length || 0) === (facilitiesOptions?.subprojects?.length || 0) ? '清空' : '全选'}
                        </Button>
                        <span style={{ fontSize: 12, color: '#999' }}>
                          已选 {(tempScopeConfig.subproject?.length || 0)} / {facilitiesOptions?.subprojects?.length || 0}
                        </span>
                      </Space>
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      flexWrap: 'wrap', 
                      gap: 8, 
                      maxHeight: 120, 
                      overflowY: 'auto',
                      padding: '8px',
                      background: '#fafafa',
                      borderRadius: 4,
                    }}>
                      {facilitiesOptions?.subprojects?.sort().map((subproject) => (
                        <Button
                          key={subproject}
                          size="small"
                          type={tempScopeConfig.subproject?.includes(subproject) ? 'primary' : 'default'}
                          onClick={() => {
                            const currentSubprojects = tempScopeConfig.subproject || []
                            const willAdd = !currentSubprojects.includes(subproject)
                            setTempScopeConfig({
                              ...tempScopeConfig,
                              subproject: willAdd
                                ? [...currentSubprojects, subproject].sort()
                                : currentSubprojects.filter(sp => sp !== subproject),
                              block: willAdd ? [] : (tempScopeConfig.block || []),
                            })
                            setTimeout(() => refetchFacilitiesOptions(), 100)
                          }}
                        >
                          {subproject}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 区块（仅在选择子项目后显示） */}
                {(tempScopeConfig.subproject?.length || 0) > 0 && (
                  <div>
                    <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: 13 }}>遗留区块：</strong>
                      <Space>
                        <Button
                          size="small"
                          onClick={() => {
                            const allBlocks = facilitiesOptions?.blocks || []
                            setTempScopeConfig({
                              ...tempScopeConfig,
                              block: (tempScopeConfig.block?.length || 0) === allBlocks.length ? [] : allBlocks,
                            })
                          }}
                        >
                          {(tempScopeConfig.block?.length || 0) === (facilitiesOptions?.blocks?.length || 0) ? '清空' : '全选'}
                        </Button>
                        <span style={{ fontSize: 12, color: '#999' }}>
                          已选 {(tempScopeConfig.block?.length || 0)} / {facilitiesOptions?.blocks?.length || 0}
                        </span>
                      </Space>
        </div>
                    <div style={{ 
                      display: 'flex', 
                      flexWrap: 'wrap', 
                      gap: 8, 
                      maxHeight: 120, 
                      overflowY: 'auto',
                      padding: '8px',
                      background: '#fafafa',
                      borderRadius: 4,
                    }}>
                      {facilitiesOptions?.blocks?.sort().map((block) => (
                        <Button
                          key={block}
                          size="small"
                          type={tempScopeConfig.block?.includes(block) ? 'primary' : 'default'}
                          onClick={() => {
                            const currentBlocks = tempScopeConfig.block || []
                            setTempScopeConfig({
                              ...tempScopeConfig,
                              block: currentBlocks.includes(block)
                                ? currentBlocks.filter(b => b !== block).sort()
                                : [...currentBlocks, block].sort(),
                            })
                          }}
                        >
                          {block}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </Space>
            </Card>

            {/* 工作包分组 */}
            <Card
              title={
                <Space>
                  <Tag color="purple">遗留工作包（Work Package）</Tag>
                  <span style={{ fontSize: 12, color: '#999' }}>
                    ({tempScopeConfig.work_package?.length || 0} 个已选)
                  </span>
                </Space>
              }
              size="small"
              extra={
                <Space>
                  <Button
                    size="small"
                    onClick={() => {
                      const allWPs = workPackageOptions?.work_packages || []
                      setTempScopeConfig({
                        ...tempScopeConfig,
                        work_package: (tempScopeConfig.work_package?.length || 0) === allWPs.length ? [] : allWPs,
                      })
                    }}
                  >
                    {(tempScopeConfig.work_package?.length || 0) === (workPackageOptions?.work_packages?.length || 0) ? '清空' : '全选'}
                  </Button>
                </Space>
              }
            >
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: 8, 
                maxHeight: 200, 
                overflowY: 'auto',
                padding: '8px 0',
              }}>
                {workPackageOptions?.work_packages?.sort().map((wp) => (
                  <Button
                    key={wp}
                    size="small"
                    type={tempScopeConfig.work_package?.includes(wp) ? 'primary' : 'default'}
                    onClick={() => {
                      const currentWPs = tempScopeConfig.work_package || []
                      setTempScopeConfig({
                        ...tempScopeConfig,
                        work_package: currentWPs.includes(wp)
                          ? currentWPs.filter(w => w !== wp).sort()
                          : [...currentWPs, wp].sort(),
                      })
                    }}
                  >
                    {wp}
                  </Button>
                ))}
              </div>
            </Card>
          </Space>
        </div>
      </Drawer>

      {/* 批量导入 Modal */}
      <Modal
        title={
          <Space>
            <UploadOutlined />
            <span>批量导入制造组织用户</span>
          </Space>
        }
        open={batchImportModalVisible}
        onCancel={() => {
          setBatchImportModalVisible(false)
          setBatchImportFile(null)
        }}
        onOk={() => {
          if (batchImportFile) {
            batchImportMutation.mutate(batchImportFile)
          } else {
            message.warning('请先选择 Excel 文件')
          }
        }}
        okText="开始导入"
        confirmLoading={batchImportMutation.isPending}
        width={640}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Button
              type="primary"
              ghost
              icon={<DownloadOutlined />}
              onClick={() => downloadTemplateMutation.mutate()}
              loading={downloadTemplateMutation.isPending}
            >
              下载导入模板
            </Button>
            <span style={{ marginLeft: 12, color: '#666', fontSize: 12 }}>
              模板含表头、示例行、部门清单、角色清单
            </span>
          </div>

          <Alert
            message="导入说明：创建账号 + 分配岗位角色一次性完成"
            description={
              <div>
                <p style={{ marginBottom: 8 }}>请在 Excel 第一张表 <strong>user_data</strong> 中填写，建议按制造组织部门与岗位角色准备数据：</p>
                <ul style={{ marginBottom: 8, paddingLeft: 20 }}>
                  <li><strong>username</strong>、<strong>password_default</strong>（必填）</li>
                  <li><strong>email</strong>、<strong>full_name</strong></li>
                  <li><strong>department</strong>（填入下方制造部门名称或代码）</li>
                  <li><strong>role.name</strong>（填入下方岗位角色名称，可分配多个角色）</li>
                  <li><strong>responsible_for</strong>、<strong>is_active</strong>、<strong>is_superuser</strong></li>
                </ul>
                <p>模板中 departments、roles 表供参考，请从其中选择填写，避免组织命名不一致。</p>
              </div>
            }
            type="info"
            showIcon
          />

          <Row gutter={16}>
            <Col span={12}>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>部门清单（department 列可填制造部门名称或代码）：</div>
              <div style={{ maxHeight: 120, overflowY: 'auto', background: '#fafafa', padding: 8, borderRadius: 4, fontSize: 12 }}>
                {departments.length ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #eee' }}>
                        <th style={{ textAlign: 'left', padding: '4px 8px' }}>code</th>
                        <th style={{ textAlign: 'left', padding: '4px 8px' }}>name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {departments.map((d) => (
                        <tr key={d.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '4px 8px' }}>{d.code}</td>
                          <td style={{ padding: '4px 8px' }}>{d.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <span style={{ color: '#999' }}>暂无部门</span>
                )}
              </div>
            </Col>
            <Col span={12}>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>岗位角色清单（role.name 列可填以下名称）：</div>
              <div style={{ maxHeight: 120, overflowY: 'auto', background: '#fafafa', padding: 8, borderRadius: 4, fontSize: 12 }}>
                {roles.filter((r) => r.is_active).length ? (
                  <Space wrap>
                    {roles.filter((r) => r.is_active).map((r) => (
                      <Tag key={r.id} color="purple">
                        {r.name}
                      </Tag>
                    ))}
                  </Space>
                ) : (
                  <span style={{ color: '#999' }}>暂无角色</span>
                )}
              </div>
            </Col>
          </Row>

          <div>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>选择 Excel 文件：</div>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                const f = e.target.files?.[0]
                setBatchImportFile(f || null)
              }}
            />
            {batchImportFile && (
              <div style={{ marginTop: 8, color: '#52c41a' }}>
                已选择：{batchImportFile.name}
              </div>
            )}
          </div>
        </Space>
      </Modal>
    </div>
  )
}

export default AccountManagement
