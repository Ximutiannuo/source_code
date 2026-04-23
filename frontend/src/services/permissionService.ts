import api from './api'

export interface Permission {
  id: number
  code: string
  name: string
  description?: string
  resource_type: string
  action: string
  scope?: string
  project?: string
  subproject?: string
  block?: string
  facility_id?: number
  work_package?: string
}

export interface PermissionScope {
  scope?: string
  project?: string
  subproject?: string
  block?: string
  train?: string
  unit?: string
  main_block?: string
  quarter?: string
  simple_block?: string
  facility_id?: number
  discipline?: string
  work_package?: string
  resource_id?: string
}

export interface UserPermissionCreate {
  permission_id: number
  scope?: PermissionScope
}

export interface UserPermission {
  id: number
  user_id: number
  permission: Permission
  scope: PermissionScope
}

export interface RolePermissionCreate {
  permission_id: number
  scope?: PermissionScope
}

export interface RolePermission {
  id: number
  role_id: number
  permission: Permission
  scope: PermissionScope
}

export interface UserPermissionsResponse {
  user_id: number
  username: string
  permissions: Array<{
    permission_code: string
    permission_name: string
    resource_type: string
    action: string
    scope: PermissionScope
    source: string
  }>
}

export interface Role {
  id: number
  name: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface RoleCreate {
  name: string
  description?: string
  is_active?: boolean
}

export interface RoleUpdate {
  name?: string
  description?: string
  is_active?: boolean
}

export interface RolePermissionsResponse {
  role_id: number
  role_name: string
  permissions: Array<{
    id: number
    permission: Permission
    scope: PermissionScope
    source: string
  }>
}

// 权限管理服务
export const permissionService = {
  // 获取所有权限定义
  getPermissions: async (resourceType?: string): Promise<Permission[]> => {
    const response = await api.get<Permission[]>('/permissions/', {
      params: resourceType ? { resource_type: resourceType } : {},
    })
    return response.data
  },

  // 创建权限定义
  createPermission: async (data: { 
    code: string
    name: string
    description?: string
    resource_type: string
    action: string
    scope?: string
    project?: string
    subproject?: string
    block?: string
    facility_id?: number
    work_package?: string
  }): Promise<Permission> => {
    const response = await api.post<Permission>('/permissions/', data)
    return response.data
  },

  // 更新权限定义
  updatePermission: async (permissionId: number, data: { 
    code: string
    name: string
    description?: string
    resource_type: string
    action: string
    scope?: string
    project?: string
    subproject?: string
    block?: string
    facility_id?: number
    work_package?: string
  }): Promise<Permission> => {
    const response = await api.put<Permission>(`/permissions/${permissionId}`, data)
    return response.data
  },

  // 删除权限定义
  deletePermission: async (permissionId: number): Promise<void> => {
    await api.delete(`/permissions/${permissionId}`)
  },

  // 获取用户权限
  getUserPermissions: async (userId: number): Promise<UserPermissionsResponse> => {
    const response = await api.get<UserPermissionsResponse>(`/permissions/user/${userId}`)
    return response.data
  },

  // 为用户分配权限
  assignUserPermission: async (
    userId: number,
    data: UserPermissionCreate
  ): Promise<UserPermission> => {
    const response = await api.post<UserPermission>(`/permissions/user/${userId}`, data)
    return response.data
  },

  // 撤销用户权限
  revokeUserPermission: async (
    userId: number,
    permissionId: number,
    scope?: PermissionScope
  ): Promise<void> => {
    await api.delete(`/permissions/user/${userId}/permission/${permissionId}`, {
      data: scope,
    })
  },

  // 为角色分配权限
  assignRolePermission: async (
    roleId: number,
    data: RolePermissionCreate
  ): Promise<RolePermission> => {
    const response = await api.post<RolePermission>(`/permissions/role/${roleId}`, data)
    return response.data
  },

  // ========== 角色管理 ==========
  
  // 获取所有角色
  getRoles: async (): Promise<Role[]> => {
    const response = await api.get<Role[]>('/permissions/roles')
    return response.data
  },

  // 创建角色
  createRole: async (data: RoleCreate): Promise<Role> => {
    const response = await api.post<Role>('/permissions/roles', data)
    return response.data
  },

  // 更新角色
  updateRole: async (roleId: number, data: RoleUpdate): Promise<Role> => {
    const response = await api.put<Role>(`/permissions/roles/${roleId}`, data)
    return response.data
  },

  // 删除角色
  deleteRole: async (roleId: number): Promise<void> => {
    await api.delete(`/permissions/roles/${roleId}`)
  },

  // 获取角色权限
  getRolePermissions: async (roleId: number): Promise<RolePermissionsResponse> => {
    const response = await api.get<RolePermissionsResponse>(`/permissions/roles/${roleId}/permissions`)
    return response.data
  },

  // 撤销角色权限
  revokeRolePermission: async (
    roleId: number,
    permissionId: number,
    scope?: PermissionScope
  ): Promise<void> => {
    await api.delete(`/permissions/roles/${roleId}/permission/${permissionId}`, {
      data: scope,
    })
  },

  // 为用户分配角色
  assignUserRole: async (userId: number, roleId: number): Promise<void> => {
    await api.post(`/permissions/user/${userId}/roles/${roleId}`)
  },

  // 撤销用户角色
  revokeUserRole: async (userId: number, roleId: number): Promise<void> => {
    await api.delete(`/permissions/user/${userId}/roles/${roleId}`)
  },

  // ========== 权限范围选择器数据 ==========
  
  // 获取GCC_Scope选项
  getGCCScopeOptions: async (): Promise<{ scopes: string[] }> => {
    const response = await api.get<{ scopes: string[] }>('/permissions/scope-options/gcc-scope')
    return response.data
  },

  // 获取Facilities级联选项
  getFacilitiesScopeOptions: async (params?: {
    project?: string[]
    subproject?: string[]
  }): Promise<{ projects: string[], subprojects: string[], blocks: string[] }> => {
    const response = await api.get<{ projects: string[], subprojects: string[], blocks: string[] }>('/permissions/scope-options/facilities', {
      params,
    })
    return response.data
  },

  // 获取工作包选项
  getWorkPackageOptions: async (): Promise<{ work_packages: string[] }> => {
    const response = await api.get<{ work_packages: string[] }>('/permissions/scope-options/work-packages')
    return response.data
  },
}
