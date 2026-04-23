import api from './api'

export interface RSCDefine {
  id: number
  work_package: string
  wpkg_description?: string | null
  resource_id?: string | null
  resource_id_name?: string | null
  uom?: string | null
  norms?: number | null
  norms_mp?: number | null
  norms_mp_20251103?: number | null
  bcc_kq_code?: string | null
  kq?: string | null
  cn_wk_report?: string | null
  rfi_a?: string | null
  rfi_b?: string | null
  rfi_c?: string | null
  remarks?: string | null
}

/** 创建/更新工作包资源定义（与后端 RSCDefineCreate 一致） */
export interface RSCDefineCreate {
  work_package: string
  wpkg_description?: string | null
  resource_id?: string | null
  resource_id_name?: string | null
  uom?: string | null
  norms?: number | null
  norms_mp?: number | null
  norms_mp_20251103?: number | null
  bcc_kq_code?: string | null
  kq?: string | null
  cn_wk_report?: string | null
  rfi_a?: string | null
  rfi_b?: string | null
  rfi_c?: string | null
  remarks?: string | null
}

export interface RSCDefineListResponse {
  items: RSCDefine[]
  total: number
  skip: number
  limit: number
}

export const rscService = {
  async getRSCDefines(params?: {
    work_package?: string
    resource_id?: string
    skip?: number
    limit?: number
  }): Promise<RSCDefine[]> {
    const response = await api.get('/rsc/', { params })
    return response.data
  },

  async getRSCDefinesWithPagination(params?: {
    work_package?: string
    resource_id?: string
    skip?: number
    limit?: number
  }): Promise<RSCDefineListResponse> {
    const response = await api.get('/rsc/list', { params })
    return response.data
  },

  async getRSCDefine(id: number): Promise<RSCDefine> {
    const response = await api.get(`/rsc/${id}`)
    return response.data
  },

  async createRSCDefine(data: RSCDefineCreate): Promise<RSCDefine> {
    const response = await api.post<RSCDefine>('/rsc/', data)
    return response.data
  },

  async updateRSCDefine(id: number, data: RSCDefineCreate): Promise<RSCDefine> {
    const response = await api.put<RSCDefine>(`/rsc/${id}`, data)
    return response.data
  },

  async deleteRSCDefine(id: number): Promise<void> {
    await api.delete(`/rsc/${id}`)
  },
}

