import api from './api'

export interface WorkStepDefine {
  id: number
  work_package: string
  work_step_description: string
  work_step_weight?: number
  is_key_quantity: boolean
  estimated_total?: number
  sort_order: number
  is_active: boolean
}

export interface WorkStepDefineCreate {
  work_package: string
  work_step_description: string
  work_step_weight?: number
  is_key_quantity: boolean
  estimated_total?: number
  sort_order?: number
  is_active?: boolean
}

export interface WorkStepDefineUpdate {
  work_package?: string
  work_step_description?: string
  work_step_weight?: number
  is_key_quantity?: boolean
  estimated_total?: number
  sort_order?: number
  is_active?: boolean
}

export const workstepService = {
  // 获取工作步骤定义列表
  async getWorkStepDefines(params?: {
    work_package?: string
    is_key_quantity?: boolean
    is_active?: boolean
  }) {
    const response = await api.get('/workstep/', { params })
    return response.data
  },

  // 根据工作包获取工作步骤
  async getWorkStepsByWorkPackage(work_package: string, is_active?: boolean) {
    const response = await api.get(`/workstep/by-work-package/${work_package}`, {
      params: is_active !== undefined ? { is_active } : {}
    })
    return response.data
  },

  // 获取单个工作步骤定义
  async getWorkStepDefine(id: number) {
    const response = await api.get(`/workstep/${id}`)
    return response.data
  },

  // 创建工作步骤定义
  async createWorkStepDefine(data: WorkStepDefineCreate) {
    const response = await api.post('/workstep/', data)
    return response.data
  },

  // 更新工作步骤定义
  async updateWorkStepDefine(id: number, data: WorkStepDefineUpdate) {
    const response = await api.put(`/workstep/${id}`, data)
    return response.data
  },

  // 删除工作步骤定义
  async deleteWorkStepDefine(id: number) {
    const response = await api.delete(`/workstep/${id}`)
    return response.data
  },

  // 批量更新工作步骤
  async batchUpdateWorkSteps(work_package: string, items: any[]) {
    const response = await api.put(`/workstep/batch/${work_package}`, { items })
    return response.data
  },
}

// ========== 非关键工程量（预估总量） ==========

export interface WorkStepVolume {
  id: number
  activity_id?: string
  work_package?: string
  work_step_description: string
  estimated_total?: number
}

export interface WorkStepVolumeCreate {
  activity_id?: string
  work_package?: string
  work_step_description: string
  estimated_total?: number
}

export const workstepVolumeService = {
  // 获取非关键工作步骤的预估总量列表
  async getWorkStepVolumes(params?: {
    activity_id?: string
    work_package?: string
    work_step_description?: string
  }) {
    const response = await api.get('/workstep-volumes/estimated', { params })
    return response.data
  },

  // 获取单个非关键工作步骤的预估总量
  async getWorkStepVolume(volume_id: number) {
    const response = await api.get(`/workstep-volumes/estimated/${volume_id}`)
    return response.data
  },

  // 创建或更新非关键工作步骤的预估总量
  async createOrUpdateWorkStepVolume(data: WorkStepVolumeCreate) {
    const response = await api.post('/workstep-volumes/estimated', data)
    return response.data
  },

  // 更新非关键工作步骤的预估总量
  async updateWorkStepVolume(volume_id: number, data: WorkStepVolumeCreate) {
    const response = await api.put(`/workstep-volumes/estimated/${volume_id}`, data)
    return response.data
  },

  // 删除非关键工作步骤的预估总量
  async deleteWorkStepVolume(volume_id: number) {
    const response = await api.delete(`/workstep-volumes/estimated/${volume_id}`)
    return response.data
  },
}

// ========== 非关键工程量（日报完成量） ==========

export interface WorkStepVolumeDaily {
  id: number
  date: string
  activity_id?: string
  work_package?: string
  work_step_description: string
  scope?: string
  project?: string
  subproject?: string
  implement_phase?: string
  train?: string
  unit?: string
  block?: string
  quarter?: string
  main_block?: string
  title?: string
  discipline?: string
  achieved: string
}

export interface WorkStepVolumeDailyCreate {
  date: string
  activity_id?: string
  work_package?: string
  work_step_description: string
  scope?: string
  project?: string
  subproject?: string
  implement_phase?: string
  train?: string
  unit?: string
  block?: string
  quarter?: string
  main_block?: string
  title?: string
  discipline?: string
  achieved: string
}

export interface WorkStepVolumeDailyListResponse {
  items: WorkStepVolumeDaily[]
  total: number
}

export const workstepVolumeDailyService = {
  // 获取非关键工作步骤的日报完成量列表
  async getWorkStepVolumeDaily(params?: {
    date?: string
    activity_id?: string
    work_package?: string
    work_step_description?: string
    discipline?: string
    block?: string
    scope?: string
    skip?: number
    limit?: number
  }) {
    const response = await api.get('/workstep-volumes/daily', { params })
    return response.data
  },

  // 获取单个非关键工作步骤的日报完成量
  async getWorkStepVolumeDailyById(daily_id: number) {
    const response = await api.get(`/workstep-volumes/daily/${daily_id}`)
    return response.data
  },

  // 创建或更新非关键工作步骤的日报完成量
  async createOrUpdateWorkStepVolumeDaily(data: WorkStepVolumeDailyCreate) {
    const response = await api.post('/workstep-volumes/daily', data)
    return response.data
  },

  // 更新非关键工作步骤的日报完成量
  async updateWorkStepVolumeDaily(daily_id: number, data: WorkStepVolumeDailyCreate) {
    const response = await api.put(`/workstep-volumes/daily/${daily_id}`, data)
    return response.data
  },

  // 删除非关键工作步骤的日报完成量
  async deleteWorkStepVolumeDaily(daily_id: number) {
    const response = await api.delete(`/workstep-volumes/daily/${daily_id}`)
    return response.data
  },
}

