import api from './api'
import { User, UserCreate, UserUpdate } from './authService'

export interface UserListResponse {
  items: User[]
  total: number
  active_count: number
  inactive_count: number
}

// 用户管理服务
export const userService = {
  // 获取用户列表（分页，返回总数与激活/禁用统计）
  getUsers: async (params?: {
    skip?: number
    limit?: number
    search?: string
    department_id?: number
  }): Promise<UserListResponse> => {
    const response = await api.get<UserListResponse>('/users/', { params })
    return response.data
  },

  // 获取单个用户
  getUser: async (userId: number): Promise<User> => {
    const response = await api.get<User>(`/users/${userId}`)
    return response.data
  },

  // 创建用户
  createUser: async (data: UserCreate): Promise<User & { temporary_password?: string }> => {
    const response = await api.post<User & { temporary_password?: string }>('/users/', data)
    return response.data
  },

  // 更新用户
  updateUser: async (userId: number, data: UserUpdate): Promise<User> => {
    const response = await api.put<User>(`/users/${userId}`, data)
    return response.data
  },

  // 删除用户
  deleteUser: async (userId: number): Promise<void> => {
    await api.delete(`/users/${userId}`)
  },

  // 获取用户角色
  getUserRoles: async (userId: number): Promise<{ user_id: number; roles: Array<{ id: number; name: string; description?: string; is_active: boolean; created_at: string; updated_at: string }> }> => {
    const response = await api.get(`/users/${userId}/roles`)
    return response.data
  },

  // 重置用户密码
  resetUserPassword: async (userId: number): Promise<{ message: string; new_password: string; username: string }> => {
    const response = await api.post(`/users/${userId}/reset-password`)
    return response.data
  },

  // 下载批量导入模板（含部门、角色清单）
  downloadImportTemplate: async (): Promise<Blob> => {
    const response = await api.get<Blob>('/users/import-template', {
      responseType: 'blob',
    })
    return response.data
  },

  // 批量导出用户（根据筛选条件）
  exportUsers: async (params?: {
    search?: string
    department_id?: number
  }): Promise<Blob> => {
    const response = await api.get<Blob>('/users/export', {
      params,
      responseType: 'blob',
    })
    return response.data
  },

  // 批量导入用户
  batchImportUsers: async (file: File): Promise<{
    created: number
    updated: number
    role_assigned: number
    errors: string[]
  }> => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post<{
      created: number
      updated: number
      role_assigned: number
      errors: string[]
    }>('/users/batch-import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },
}
