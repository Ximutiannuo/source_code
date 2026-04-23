import api from './api'

export interface Activity {
  id: number
  activity_id: string
  wbs_code?: string
  block?: string
  title?: string
  discipline?: string
  work_package?: string
  scope?: string
  implement_phase?: string  // Implement Phase: MI, EN, CT, PR, CM等
  project?: string
  subproject?: string
  train?: string
  unit?: string
  main_block?: string
  quarter?: string
  simple_block?: string
  start_up_sequence?: string
  contract_phase?: string
  resource_id?: string
  uom?: string
  spe_mhrs?: number
  key_qty?: number
  calculated_mhrs?: number
  weight_factor?: number
  actual_weight_factor?: number
  actual_start_date?: string
  actual_finish_date?: string
  actual_duration?: number
  completed?: number
  actual_manhour?: number
  baseline1_start_date?: string
  baseline1_finish_date?: string
  planned_duration?: number
  start_date?: string
  finish_date?: string
  planned_start_date?: string
  planned_finish_date?: string
  at_completion_duration?: number
  type?: string  // Activity Type (从P6获取，用于标识里程碑等)
  
  // 兼容旧字段名
  wbs?: string  // 兼容 wbs_code
  description?: string  // 兼容 title
  man_hours?: number  // 兼容 calculated_mhrs
  total_manhour?: number  // 兼容 actual_manhour
  planned_start?: string  // 兼容 bl_start
  planned_finish?: string  // 兼容 bl_finish
  status?: string  // 需要根据实际数据计算
  is_active?: boolean  // activity_summary 总是激活的
  iscritical?: boolean  // 是否关键路径
  islongestpath?: boolean  // 是否最长路径
  data_date?: string       // Data Date (P6 数据日期)
  system_status?: 'Not Started' | 'In Progress' | 'Completed' // 本系统内的确认状态
}

export const activityService = {
  async completeActivity(activityId: string, remarks?: string, patchTo100: boolean = false) {
    const response = await api.post(`/activities/${activityId}/complete`, { remarks, patch_to_100: patchTo100 })
    return response.data
  },

  async reopenActivity(activityId: string) {
    const response = await api.post(`/activities/${activityId}/reopen`)
    return response.data
  },

  async getActivities(params?: {
    discipline?: string
    work_package?: string
    block?: string
    search?: string
    skip?: number
    limit?: number
  }) {
    const response = await api.get('/activities/', { params })
    // 处理新的响应格式（包含 items 和 total）
    const responseData = response.data
    const items = responseData.items || (Array.isArray(responseData) ? responseData : [])
    const total = responseData.total || items.length
    
    // 转换后端字段名到前端期望的字段名（兼容旧字段名）
    const data = items.map((item: any) => ({
      ...item,
      // 兼容旧字段名（只添加不重复的字段）
      wbs: item.wbs_code,
      description: item.title,
      contract_phase: item.implement_phase,  // implement_phase 是实施阶段
      man_hours: item.calculated_mhrs,
      total_manhour: item.actual_manhour,
      planned_start: item.baseline1_start_date,
      planned_finish: item.baseline1_finish_date,
      // 计算状态（优先使用系统确认状态）
      status: item.system_status || (item.actual_finish_date ? 'Completed' : (item.actual_start_date ? 'In Progress' : 'Not Started')),
      is_active: true,  // activity_summary 总是激活的
    }))
    
    // 返回数据，包含总数（用于分页）
    return {
      items: data,
      total: total,
    }
  },

  async getActivityById(activityId: string) {
    const response = await api.get(`/activities/${activityId}`)
    const item = response.data
    // 转换字段名（兼容旧字段名）
    return {
      ...item,
      // 兼容旧字段名（只添加不重复的字段）
      wbs: item.wbs_code,
      description: item.title,
      contract_phase: item.implement_phase,
      man_hours: item.calculated_mhrs,
      total_manhour: item.actual_manhour,
      planned_start: item.bl_start,
      planned_finish: item.bl_finish,
      status: item.system_status || (item.actual_finish ? 'Completed' : (item.actual_start ? 'In Progress' : 'Not Started')),
      is_active: true,
    }
  },

  async getActivitiesAdvanced(params: {
    filters?: Record<string, any>
    group_by?: string[]
    order_by?: Array<{ field: string; order: 'asc' | 'desc' }>
    skip?: number
    limit?: number
  }) {
    const response = await api.post('/activities/advanced', params)
    const responseData = response.data
    const items = responseData.items || []
    const total = responseData.total || items.length
    
    // 转换字段名（兼容旧字段名）
    const data = items.map((item: any) => ({
      ...item,
      // 兼容旧字段名（只添加不重复的字段）
      wbs: item.wbs_code,
      description: item.title,
      contract_phase: item.implement_phase,
      man_hours: item.calculated_mhrs,
      total_manhour: item.actual_manhour,
      planned_start: item.bl_start,
      planned_finish: item.bl_finish,
      status: item.system_status || (item.actual_finish_date ? 'Completed' : (item.actual_start_date ? 'In Progress' : 'Not Started')),
      is_active: true,
    }))
    
    return {
      items: data,
      total: total,
    }
  },

  async getUserColumnPreferences() {
    const response = await api.get('/activities/preferences/columns')
    return response.data
  },

  async saveUserColumnPreferences(columns: any) {
    const response = await api.post('/activities/preferences/columns', columns)
    return response.data
  },

  async getUserGroupingPreferences() {
    const response = await api.get('/activities/preferences/grouping')
    return response.data
  },

  async saveUserGroupingPreferences(grouping: any) {
    const response = await api.post('/activities/preferences/grouping', grouping)
    return response.data
  },

  async exportActivitiesForDailyReport(params: {
    filters?: Record<string, any>
    group_by?: string[]
    report_date: string
    report_type: 'MP' | 'VFACT'
  }) {
    const response = await api.post('/activities/export', {
      filters: params.filters,
      group_by: params.group_by,
      skip: 0,
      limit: 10000, // 导出时使用大limit
      order_by: [{ field: 'activity_id', order: 'asc' }],
      report_date: params.report_date,
      report_type: params.report_type,
    })
    return response.data
  },

  async getActivityCodeDescription(activityId: string, codeTypeName: string, codeValue?: string) {
    const response = await api.get('/activities/activity-code-description', {
      params: {
        activity_id: activityId,
        code_type_name: codeTypeName,
        code_value: codeValue, // 优先使用code_value查询
      },
    })
    return response.data
  },

  async exportBulkCloseActivities(params: {
    filters?: Record<string, any>
    group_by?: string[]
    order_by?: Array<{ field: string; order: 'asc' | 'desc' }>
  }) {
    const response = await api.post('/activities/bulk-close-export', params)
    return response.data // 返回 { task_id: '...' }
  },

  async getBulkCloseExportStatus(taskId: string) {
    const response = await api.get(`/activities/bulk-close-export/status/${taskId}`)
    return response.data
  },

  async downloadBulkCloseExportFile(taskId: string) {
    const response = await api.get(`/activities/bulk-close-export/download/${taskId}`, {
      responseType: 'blob'
    })
    return response.data
  },

  async importBulkCloseActivities(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post('/activities/bulk-close-import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data
  }
}

