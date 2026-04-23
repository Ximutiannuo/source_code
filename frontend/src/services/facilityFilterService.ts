import api from './api'

export interface FacilityFilterOptions {
  subproject_codes: string[]
  trains: string[]
  units: string[]
  simple_blocks: string[]
  main_blocks: Record<string, string[]>  // key: simple_block, value: main_block列表
  blocks: Record<string, string[]>  // key: main_block, value: block列表
  quarters: string[]
  scopes: string[]
  projects: string[]
  // activity_summary 相关字段
  disciplines: string[]
  implement_phases: string[]
  contract_phases: string[]
  types: string[]
  work_packages: string[]
  // rsc_defines 相关字段
  resource_id_names: string[]
  bcc_kq_codes: string[]
  kqs: string[]
  cn_wk_reports: string[]
}

export interface FacilityFilterParams {
  project?: string | string[]
  subproject?: string | string[]
  train?: string | string[]
  unit?: string | string[]
  simple_block?: string | string[]
  main_block?: string | string[]
  block?: string | string[]
  quarter?: string | string[]
  // activity_summary 相关筛选参数
  scope?: string | string[]
  discipline?: string | string[]
  implement_phase?: string | string[]
  contract_phase?: string | string[]
  type?: string | string[]
  work_package?: string | string[]
  // rsc_defines 相关筛选参数
  resource_id_name?: string | string[]
  bcc_kq_code?: string | string[]
  kq?: string | string[]
  cn_wk_report?: string | string[]
}

export const facilityFilterService = {
  async getOptions(params?: FacilityFilterParams, signal?: AbortSignal): Promise<FacilityFilterOptions> {
    // 配置 paramsSerializer 确保数组参数正确传递
    // Axios 默认会将数组转换为 ?param=value1&param=value2 格式，FastAPI 可以正确接收
    const response = await api.get('/facility-filter/options', { 
      params,
      paramsSerializer: {
        indexes: null, // 使用 ?param=value1&param=value2 格式
      },
      signal 
    })
    return response.data
  },
}

