import api from './api'

export interface Facility {
  id: number
  facility_type_id?: number | null
  block?: string
  project?: string
  subproject?: string
  train?: string
  unit?: string
  main_block?: string
  descriptions?: string
  simple_block?: string
  quarter?: string
  start_up_sequence?: string
  title_type?: string
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface FacilityCreate {
  block?: string
  project?: string
  subproject?: string
  train?: string
  unit?: string
  main_block?: string
  descriptions?: string
  simple_block?: string
  quarter?: string
  start_up_sequence?: string
  title_type?: string
  is_active?: boolean
}

export interface FacilityUpdate {
  facility_type_id?: number | null
  block?: string
  project?: string
  subproject?: string
  train?: string
  unit?: string
  main_block?: string
  descriptions?: string
  simple_block?: string
  quarter?: string
  start_up_sequence?: string
  title_type?: string
  is_active?: boolean
}

export interface FacilityListResponse {
  items: Facility[]
  total: number
  skip: number
  limit: number
}

export interface FacilityListParams {
  project?: string
  subproject?: string
  train?: string
  unit?: string
  main_block?: string
  block?: string
  search?: string
  skip?: number
  limit?: number
}

export const facilityService = {
  // 获取主项清单列表
  getFacilities: async (params?: FacilityListParams): Promise<FacilityListResponse> => {
    const response = await api.get<FacilityListResponse>('/facility/', { params })
    return response.data
  },

  // 获取单个主项清单
  getFacility: async (id: number): Promise<Facility> => {
    const response = await api.get<Facility>(`/facility/${id}`)
    return response.data
  },

  // 创建主项清单
  createFacility: async (data: FacilityCreate): Promise<Facility> => {
    const response = await api.post<Facility>('/facility/', data)
    return response.data
  },

  // 更新主项清单
  updateFacility: async (id: number, data: FacilityUpdate): Promise<Facility> => {
    const response = await api.put<Facility>(`/facility/${id}`, data)
    return response.data
  },

  // 删除主项清单
  deleteFacility: async (id: number): Promise<void> => {
    await api.delete(`/facility/${id}`)
  },
}

