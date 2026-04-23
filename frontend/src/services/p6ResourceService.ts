import api from './api'

export interface P6Resource {
  id: number
  object_id: number
  resource_id?: string | null
  name?: string | null
  resource_type?: string | null
  unit_of_measure?: string | null
  price_per_unit?: number | null
  calendar_object_id?: number | null
  description?: string | null
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
  last_sync_at?: string | null
}

export interface P6ResourceListResponse {
  items: P6Resource[]
  total: number
  skip: number
  limit: number
}

export const p6ResourceService = {
  async getP6Resources(params?: {
    resource_id?: string
    resource_type?: string
    search?: string
    is_active?: boolean
    skip?: number
    limit?: number
  }): Promise<P6ResourceListResponse> {
    const response = await api.get('/p6-resources/', { params })
    return response.data
  },

  async getResourceTypes(): Promise<string[]> {
    const response = await api.get('/p6-resources/types/list')
    return response.data
  },
}

