import api from './api'

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
}

/** 施工主管角色 ID：可审核/批准/撤回专项计划，范围受 subproject 约束 */
export const CONSTRUCTION_SUPERVISOR_ROLE_IDS = [75, 76, 77] as const

export interface User {
  id: number
  username: string
  email?: string
  full_name?: string
  /** 主要工作职责/主要负责工作内容 */
  responsible_for?: string
  /** 所属部门 ID */
  department_id?: number
  is_active: boolean
  is_superuser: boolean
  /** 用户所属角色 ID 列表，用于前端权限控制（如 vfactdb 特殊接口仅对 role_id 2,3,5 开放） */
  role_ids?: number[]
  /** 是否可访问账号管理（后端根据超级管理员、role_system_admin、系统管理员角色或 system:admin 权限计算） */
  can_access_account_management?: boolean
}

export interface UserCreate {
  username: string
  email?: string
  password?: string  // 可选，如果不提供则后端自动生成
  full_name?: string
  responsible_for?: string  // 主要工作职责
  department_id?: number  // 所属部门
  is_active?: boolean
  is_superuser?: boolean
}

export interface UserResponse extends User {
  temporary_password?: string  // 仅在新用户创建时返回，用于显示生成的密码
}

export interface UserUpdate {
  email?: string
  full_name?: string
  responsible_for?: string  // 主要工作职责
  department_id?: number  // 所属部门
  is_active?: boolean
  is_superuser?: boolean
  password?: string
}

// Token管理
const TOKEN_KEY = 'auth_token'

export const tokenService = {
  getToken: (): string | null => {
    return localStorage.getItem(TOKEN_KEY)
  },
  setToken: (token: string): void => {
    localStorage.setItem(TOKEN_KEY, token)
  },
  removeToken: (): void => {
    localStorage.removeItem(TOKEN_KEY)
  },
}

// 认证服务
export const authService = {
  // 登录
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const formData = new URLSearchParams()
    formData.append('username', credentials.username)
    formData.append('password', credentials.password)
    formData.append('grant_type', 'password')

    const response = await api.post<LoginResponse>('/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

    if (response.data.access_token) {
      tokenService.setToken(response.data.access_token)
    } else {
      throw new Error('登录响应中没有access_token')
    }

    return response.data
  },

  // 登出
  logout: (): void => {
    tokenService.removeToken()
  },

  // 获取当前用户信息
  getCurrentUser: async (): Promise<User> => {
    const response = await api.get<User>('/auth/me')
    return response.data
  },

  // 更新当前用户信息
  updateCurrentUser: async (data: UserUpdate): Promise<User> => {
    const response = await api.put<User>('/auth/me', data)
    return response.data
  },
}
