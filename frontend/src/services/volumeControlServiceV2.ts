import api from './api'

// ========== 工程量及完工信息 ==========

export interface VolumeControlQuantity {
  id: number
  activity_id: string
  // API返回字符串以保持Decimal精度
  estimated_total?: string | null
  drawing_approved_afc?: string | null
  material_arrived?: string | null
  available_workface?: string | null
  workface_restricted_material?: string | null
  workface_restricted_site?: string | null
  construction_completed?: string | null
  estimated_total_updated_at?: string | null
  estimated_total_updated_by?: number | null
  drawing_approved_afc_updated_at?: string | null
  drawing_approved_afc_updated_by?: number | null
  material_arrived_updated_at?: string | null
  material_arrived_updated_by?: number | null
  available_workface_updated_at?: string | null
  available_workface_updated_by?: number | null
  workface_restricted_material_updated_at?: string | null
  workface_restricted_material_updated_by?: number | null
  workface_restricted_site_updated_at?: string | null
  workface_restricted_site_updated_by?: number | null
  construction_completed_updated_at?: string | null
  construction_completed_updated_by?: number | null
  responsible_user_id?: number | null
  responsible_updated_at?: string | null
  responsible_updated_by?: number | null
  created_at: string
  updated_at: string
}

export interface VolumeControlQuantityUpdate {
  // 前端输入数字，后端处理时转换为字符串
  estimated_total?: number
  drawing_approved_afc?: number
  material_arrived?: number
  available_workface?: number
  workface_restricted_material?: number
  workface_restricted_site?: number
  construction_completed?: number
  responsible_user_id?: number
  remarks?: string
}

// ========== 验收相关信息 ==========

export interface VolumeControlInspection {
  id: number
  activity_id: string
  // API返回字符串以保持Decimal精度
  rfi_completed_a?: string | null
  rfi_completed_b?: string | null
  rfi_completed_c?: string | null
  rfi_completed_a_updated_at?: string | null
  rfi_completed_a_updated_by?: number | null
  rfi_completed_b_updated_at?: string | null
  rfi_completed_b_updated_by?: number | null
  rfi_completed_c_updated_at?: string | null
  rfi_completed_c_updated_by?: number | null
  responsible_user_id?: number | null
  responsible_updated_at?: string | null
  responsible_updated_by?: number | null
  created_at: string
  updated_at: string
}

export interface VolumeControlInspectionUpdate {
  rfi_completed_a?: number
  rfi_completed_b?: number
  rfi_completed_c?: number
  responsible_user_id?: number
  remarks?: string
}

// ========== 竣工资料相关信息 ==========

export interface VolumeControlAsbuilt {
  id: number
  activity_id: string
  // API返回字符串以保持Decimal精度
  asbuilt_signed_r0?: string | null
  asbuilt_signed_r1?: string | null
  asbuilt_signed_r0_updated_at?: string | null
  asbuilt_signed_r0_updated_by?: number | null
  asbuilt_signed_r1_updated_at?: string | null
  asbuilt_signed_r1_updated_by?: number | null
  responsible_user_id?: number | null
  responsible_updated_at?: string | null
  responsible_updated_by?: number | null
  created_at: string
  updated_at: string
}

export interface VolumeControlAsbuiltUpdate {
  asbuilt_signed_r0?: number
  asbuilt_signed_r1?: number
  responsible_user_id?: number
  remarks?: string
}

// ========== 收款相关信息 ==========

export interface VolumeControlPayment {
  id: number
  activity_id: string
  // API返回字符串以保持Decimal精度
  obp_signed?: string | null
  obp_signed_updated_at?: string | null
  obp_signed_updated_by?: number | null
  responsible_user_id?: number | null
  responsible_updated_at?: string | null
  responsible_updated_by?: number | null
  created_at: string
  updated_at: string
}

export interface VolumeControlPaymentUpdate {
  obp_signed?: number
  responsible_user_id?: number
  remarks?: string
}

// ========== RFI名称 ==========

export interface RFINames {
  rfi_a_name: string
  rfi_b_name: string
  rfi_c_name: string
}

// ========== 列表项 ==========

export interface VolumeControlListItem {
  activity_id: string
  activity_title?: string | null
  wbs_code?: string | null
  discipline?: string | null
  work_package?: string | null
  block?: string | null
  scope?: string | null
  quantity_id?: number | null
  // API现在返回字符串以保持Decimal精度，前端在显示时转换为数字
  estimated_total?: string | null
  drawing_approved_afc?: string | null
  material_arrived?: string | null
  available_workface?: string | null
  workface_restricted_material?: string | null
  workface_restricted_site?: string | null
  construction_completed?: string | null
  inspection_id?: number | null
  rfi_completed_a?: string | null
  rfi_completed_b?: string | null
  rfi_completed_c?: string | null
  asbuilt_id?: number | null
  asbuilt_signed_r0?: string | null
  asbuilt_signed_r1?: string | null
  payment_id?: number | null
  obp_signed?: string | null
  // 施工完成量对应的 VFACTDB 最早/最晚日期（后端返回 ISO 字符串）
  vfactdb_earliest_date?: string | null
  vfactdb_latest_date?: string | null
}

export interface VolumeControlListResponse {
  items: VolumeControlListItem[]
  total: number
  skip: number
  limit: number
}

export interface VolumeControlSummaryItem {
  group_name: string
  description?: string | null
  rfi_a_name?: string | null
  rfi_b_name?: string | null
  rfi_c_name?: string | null
  estimated_total: number
  drawing_approved_afc: number
  material_arrived: number
  available_workface: number
  workface_restricted_material: number
  workface_restricted_site: number
  construction_completed: number
  rfi_completed_a: number
  rfi_completed_b: number
  rfi_completed_c: number
  asbuilt_signed_r0: number
  asbuilt_signed_r1: number
  obp_signed: number
  sort_id?: number
}

export const volumeControlServiceV2 = {
  // ========== 工程量及完工信息 ==========
  
  async getQuantity(activity_id: string): Promise<VolumeControlQuantity> {
    const response = await api.get(`/volume-control-v2/quantity/${activity_id}`)
    return response.data
  },

  async updateQuantity(activity_id: string, data: VolumeControlQuantityUpdate): Promise<VolumeControlQuantity> {
    const response = await api.put(`/volume-control-v2/quantity/${activity_id}`, data)
    return response.data
  },

  async getQuantityHistory(activity_id: string, field_name?: string) {
    const response = await api.get(`/volume-control-v2/quantity/${activity_id}/history`, {
      params: field_name ? { field_name } : {}
    })
    return response.data
  },

  // ========== 验收相关信息 ==========
  
  async getInspection(activity_id: string): Promise<VolumeControlInspection> {
    const response = await api.get(`/volume-control-v2/inspection/${activity_id}`)
    return response.data
  },

  async updateInspection(activity_id: string, data: VolumeControlInspectionUpdate): Promise<VolumeControlInspection> {
    const response = await api.put(`/volume-control-v2/inspection/${activity_id}`, data)
    return response.data
  },

  async getInspectionHistory(activity_id: string, field_name?: string) {
    const response = await api.get(`/volume-control-v2/inspection/${activity_id}/history`, {
      params: field_name ? { field_name } : {}
    })
    return response.data
  },

  // ========== 竣工资料相关信息 ==========
  
  async getAsbuilt(activity_id: string): Promise<VolumeControlAsbuilt> {
    const response = await api.get(`/volume-control-v2/asbuilt/${activity_id}`)
    return response.data
  },

  async updateAsbuilt(activity_id: string, data: VolumeControlAsbuiltUpdate): Promise<VolumeControlAsbuilt> {
    const response = await api.put(`/volume-control-v2/asbuilt/${activity_id}`, data)
    return response.data
  },

  async getAsbuiltHistory(activity_id: string, field_name?: string) {
    const response = await api.get(`/volume-control-v2/asbuilt/${activity_id}/history`, {
      params: field_name ? { field_name } : {}
    })
    return response.data
  },

  // ========== 收款相关信息 ==========
  
  async getPayment(activity_id: string): Promise<VolumeControlPayment> {
    const response = await api.get(`/volume-control-v2/payment/${activity_id}`)
    return response.data
  },

  async updatePayment(activity_id: string, data: VolumeControlPaymentUpdate): Promise<VolumeControlPayment> {
    const response = await api.put(`/volume-control-v2/payment/${activity_id}`, data)
    return response.data
  },

  async getPaymentHistory(activity_id: string, field_name?: string) {
    const response = await api.get(`/volume-control-v2/payment/${activity_id}/history`, {
      params: field_name ? { field_name } : {}
    })
    return response.data
  },

  // ========== RFI名称 ==========
  
  async getRFINames(activity_id: string): Promise<RFINames> {
    const response = await api.get(`/volume-control-v2/rfi-names/${activity_id}`)
    return response.data
  },

  // ========== 列表查询 ==========
  
  async getVolumeControlList(params?: {
    discipline?: string
    work_package?: string
    block?: string
    scope?: string
    subproject?: string
    train?: string
    unit?: string
    main_block?: string
    quarter?: string
    implement_phase?: string
    contract_phase?: string
    type?: string
    search?: string
    skip?: number
    limit?: number
  }) {
    const response = await api.get('/volume-control-v2/list', { params })
    return response.data
  },

  async getVolumeControlListAdvanced(params?: {
    filters?: Record<string, any>
    skip?: number
    limit?: number
    is_export?: boolean
  }) {
    const response = await api.post('/volume-control-v2/list-advanced', params)
    return response.data
  },

  async getVolumeControlSummary(params: {
    filters?: Record<string, any>
    group_by: 'work_package' | 'resource_id_name' | 'key_qty'
  }) {
    const response = await api.post('/volume-control-v2/summary', params)
    return response.data
  },

  async batchUpdateFromExcel(data: any[], options?: { timeout?: number }) {
    const timeout = options?.timeout ?? 300_000
    const response = await api.post('/volume-control-v2/batch-update', { items: data }, { timeout })
    return response.data
  },
}

