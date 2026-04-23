import api from './api'

export interface ActivityCode {
  id: number
  object_id: number
  code_type_object_id: number
  code_type_name?: string
  code_type_scope?: string
  code_value: string
  sequence_number?: number
  description?: string
  is_active: boolean
  created_at?: string
  updated_at?: string
  last_sync_at?: string
}

export interface ActivityCodeListResponse {
  items: ActivityCode[]
  total: number
  skip: number
  limit: number
}

export const activityCodeService = {
  async getActivityCodes(params?: {
    code_type_name?: string
    code_type_scope?: string
    code_value?: string
    search?: string
    is_active?: boolean
    skip?: number
    limit?: number
  }): Promise<ActivityCodeListResponse> {
    const response = await api.get('/activity-codes/', { params })
    return response.data
  },

  async getCodeTypes(): Promise<string[]> {
    const response = await api.get('/activity-codes/code-types')
    return response.data
  },

  async getCodeScopes(): Promise<string[]> {
    const response = await api.get('/activity-codes/code-scopes')
    return response.data
  },
}

