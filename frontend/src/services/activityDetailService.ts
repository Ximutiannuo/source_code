import api from './api'

export interface ActivityDetail {
  // 基础信息
  id: number
  wbs_code?: string
  activity_id: string
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
  work_package?: string
  scope?: string
  simple_block?: string
  start_up_sequence?: string
  uom?: string
  contract_phase?: string
  
  // 工程量相关
  key_qty?: number
  calculated_mhrs?: number
  resource_id?: string
  spe_mhrs?: number
  
  // 权重因子
  weight_factor?: number
  actual_weight_factor?: number
  
  // 实际数据
  actual_start_date?: string
  actual_finish_date?: string
  actual_duration?: number
  completed?: number
  actual_manhour?: number
  actual_weight?: number
  
  // P6日期字段
  start_date?: string
  finish_date?: string
  planned_start_date?: string
  planned_finish_date?: string
  planned_duration?: number
  at_completion_duration?: number
  
  // 基线数据
  baseline1_start_date?: string
  baseline1_finish_date?: string
  
  // 预测数据
  forecast_start?: string
  forecast_finish?: string
  
  // 预算和预测
  act_status?: string
  current_budgeted_wf?: number
  current_budgeted_mh?: number
  current_budgeted_vol?: number
  current_forecast_wf?: number
  current_forecast_mh?: number
  current_forecast_vol?: number
}

export interface ActivityDetailFilters {
  block?: string
  project?: string
  subproject?: string
  train?: string
  unit?: string
  main_block?: string
  scope?: string
  discipline?: string
  work_package?: string
  start_date?: string
  end_date?: string
  skip?: number  // 数据库分页：跳过记录数
  limit?: number  // 数据库分页：返回记录数（最大50000）
}

export interface FilterOptions {
  projects: string[]
  subproject_codes: string[]
  trains: string[]
  units: string[]
  blocks: string[]
  main_blocks: string[]
  scopes: string[]
  simple_blocks?: string[]
  quarters?: string[]
}

export const activityDetailService = {
  async getActivityDetails(filters?: ActivityDetailFilters): Promise<ActivityDetail[]> {
    const response = await api.get('/activity-detail/', { params: filters })
    return response.data
  },

  async getFilterOptions(scope?: string): Promise<FilterOptions> {
    const params = scope ? { scope } : {}
    const response = await api.get('/activity-detail/filters', { params })
    return response.data
  },
}

