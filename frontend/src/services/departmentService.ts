import api from './api'

export interface Department {
  id: number
  code: string
  name: string
  is_active: boolean
  sort_order: number
}

export interface DepartmentCreate {
  code: string
  name: string
  is_active?: boolean
  sort_order?: number
}

export interface DepartmentUpdate {
  code?: string
  name?: string
  is_active?: boolean
  sort_order?: number
}

export const departmentService = {
  /** 列表（仅启用），供下拉等使用 */
  listDepartments: async (): Promise<Department[]> => {
    const { data } = await api.get<Department[]>('/departments/')
    return data
  },
  /** 列表（含已禁用），管理员用 */
  listDepartmentsAdmin: async (): Promise<Department[]> => {
    const { data } = await api.get<Department[]>('/departments/admin/')
    return data
  },
  create: async (body: DepartmentCreate): Promise<Department> => {
    const { data } = await api.post<Department>('/departments/', body)
    return data
  },
  update: async (id: number, body: DepartmentUpdate): Promise<Department> => {
    const { data } = await api.put<Department>(`/departments/${id}`, body)
    return data
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/departments/${id}`)
  },
}
