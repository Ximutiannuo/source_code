import api from './api'
import type { GlobalFilterState } from '../components/common/GlobalFilter'

export interface ProductivityItem {
  dim_val: string
  achieved: number
  manpower: number
  productivity: number
  productivity_wp: number
  weighted_norms: number
  cum_achieved?: number
  cum_manpower?: number
  cum_productivity?: number
  cum_productivity_wp?: number
}

export interface ProductivitySummary {
  achieved: number
  manpower: number
  productivity: number
  productivity_wp: number
  weighted_norms: number
  cum_achieved?: number
  cum_manpower?: number
  cum_productivity?: number
  cum_productivity_wp?: number
  cum_weighted_norms?: number
}

export interface ProductivityAnalysisResponse {
  group_by: string | null
  start_date: string
  end_date: string
  summary: ProductivitySummary
  items: ProductivityItem[]
  /** 数据来源：cache=预聚合，realtime=实时查询 */
  data_source?: 'cache' | 'realtime'
}

export interface WpTreeNode {
  discipline: string
  children: { resource_id_name: string; work_packages: { work_package: string; norms: number }[] }[]
}

export interface ProductivityWpTreeResponse {
  tree: WpTreeNode[]
}

export type ProductivityGroupBy = 'scope' | 'unit' | 'subproject' | 'main_block'

export interface ProductivityParams {
  workPackages?: string[]
  resourceIdNames?: string[]
  includeIndirect?: boolean
  startDate?: string
  endDate?: string
  groupBy?: ProductivityGroupBy
  globalFilter?: GlobalFilterState
}

export interface ProductivityTrendResponse {
  weeks: string[]
  achieved?: number[]
  manpower?: number[]
  productivity?: number[]
  productivity_wp?: number[]
  cum_productivity?: number[]
  cum_productivity_wp?: number[]
  series?: { name: string; data: number[] }[]
  cum_series?: { name: string; data: number[] }[]
  group_by?: string
  /** 数据来源：cache=预聚合，realtime=实时查询 */
  data_source?: 'cache' | 'realtime'
}

function buildFilterParams(f?: GlobalFilterState): Record<string, string | string[]> {
  const p: Record<string, string | string[]> = {}
  if (!f) return p
  if (f.scope?.length) p.scope = f.scope
  if (f.subproject?.length) p.subproject = f.subproject
  if (f.train?.length) p.train = f.train
  if (f.unit?.length) p.unit = f.unit
  if (f.block?.length) p.block = f.block
  if (f.quarter?.length) p.quarter = f.quarter
  if (f.main_block?.length) p.main_block = f.main_block
  if (f.discipline?.length) p.discipline = f.discipline
  if (f.simple_block?.length) p.simple_block = f.simple_block
  if (f.implement_phase?.length) p.implement_phase = f.implement_phase
  if (f.contract_phase?.length) p.contract_phase = f.contract_phase
  if (f.type?.length) p.type = f.type
  if (f.work_package?.length) p.work_package = f.work_package
  if (f.resource_id_name?.length) p.resource_id_name = f.resource_id_name
  if (f.bcc_kq_code?.length) p.bcc_kq_code = f.bcc_kq_code
  if (f.kq?.length) p.kq = f.kq
  if (f.cn_wk_report?.length) p.cn_wk_report = f.cn_wk_report
  return p
}

export const productivityService = {
  async getWorkPackageTree(): Promise<ProductivityWpTreeResponse> {
    const res = await api.get('/dashboard/productivity-work-package-tree')
    return res.data
  },

  async getAnalysis(params: ProductivityParams): Promise<ProductivityAnalysisResponse> {
    const { workPackages, resourceIdNames, includeIndirect, startDate, endDate, groupBy, globalFilter } = params
    const searchParams = new URLSearchParams()
    if (resourceIdNames?.length) {
      resourceIdNames.forEach((r) => searchParams.append('resource_id_name', r))
    }
    if (workPackages?.length) {
      workPackages.forEach((wp) => searchParams.append('work_package', wp))
    }
    if (includeIndirect) searchParams.append('include_indirect', '1')
    if (startDate) searchParams.append('start_date', startDate)
    if (endDate) searchParams.append('end_date', endDate)
    if (groupBy) searchParams.append('group_by', groupBy)
    Object.entries(buildFilterParams(globalFilter)).forEach(([k, v]) => {
      if (Array.isArray(v)) v.forEach((x) => searchParams.append(k, x))
      else searchParams.append(k, v)
    })
    const res = await api.get(`/dashboard/productivity-analysis?${searchParams.toString()}`, {
      timeout: 300000, // 5 分钟，工效分析聚合查询数据量大，避免 504
    })
    return res.data
  },

  async getTrend(params: ProductivityParams): Promise<ProductivityTrendResponse> {
    const { workPackages, resourceIdNames, includeIndirect, startDate, endDate, groupBy, globalFilter } = params
    const searchParams = new URLSearchParams()
    if (resourceIdNames?.length) {
      resourceIdNames.forEach((r) => searchParams.append('resource_id_name', r))
    }
    if (workPackages?.length) {
      workPackages.forEach((wp) => searchParams.append('work_package', wp))
    }
    if (includeIndirect) searchParams.append('include_indirect', '1')
    if (startDate) searchParams.append('start_date', startDate)
    if (endDate) searchParams.append('end_date', endDate)
    if (groupBy) searchParams.append('group_by', groupBy)
    Object.entries(buildFilterParams(globalFilter)).forEach(([k, v]) => {
      if (Array.isArray(v)) v.forEach((x) => searchParams.append(k, x))
      else searchParams.append(k, v)
    })
    const res = await api.get(`/dashboard/productivity-trend?${searchParams.toString()}`, {
      timeout: 300000, // 5 分钟，工效趋势聚合查询数据量大，避免 504
    })
    return res.data
  },
}
