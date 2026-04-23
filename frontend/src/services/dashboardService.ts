import api from './api'

export interface WeightProgressItem {
  code: string
  name: string
  weight: number
  this_week_plan: number
  this_week_rolling: number
  this_week_actual: number
  cum_plan: number
  cum_rolling: number
  cum_actual: number
}

export interface WeightProgressResponse {
  disciplines: WeightProgressItem[]
  total: WeightProgressItem
}

export interface VolumeCompletionResponse {
  categories: string[]
  total: number[]
  completed: number[]
  remaining: number[]
  completion_rate: number[]
}

export interface ManpowerResponse {
  categories: string[]
  planned: number[]
  actual: number[]
}

export interface DailyReportStatusItem {
  report_type: string
  date: string
  total_scopes: number
  submitted_count: number
  pending_count: number
  submitted_scopes: string[]
  pending_scopes: string[]
}

export interface DashboardSummaryResponse {
  daily_report_status: DailyReportStatusItem[]
  manpower_summary: {
    total_manpower: number
    total_machinery: number
  }
  volume_summary: {
    by_work_content: {
      [workContent: string]: {
        [volumeType: string]: {
          name: string
          total: number
        }
      }
    }
  }
  weight_summary: {
    total_weight: number
    total_completed: number
    total_key_qty: number
    progress_rate: number
  }
}

export interface ProgressSummary {
  actual: {
    period_completed_owf: number
    period_individual_manhours: number
    total_manhours: number
    total_weight_factor: number
    period_completed_wf_new: number
  }
  forecast: {
    period_at_completion_wf: number
    total_at_completion_wf: number
    percentage: number
  }
  epc: {
    [key: string]: {
      weight: number
      plan: number
      actual: number
      balance: number
    }
  }
  phases: {
    name: string
    weight: string
    plan: string
    actual: string
    balance: string
  }[]
  safety: {
    total_hours: number
    days: number
  }
  manpower: {
    total: number
    change: number
  }
}

export interface DisciplineDetails {
  E: { ddd: number, mac: number, KITSO: number }
  P: { equipment: number, bulk: number, delivery: number }
  C: { concrete: number, steel: number }
  PreC: { test_packs: number, progress: number }
}

export interface ProgressCurveItem {
  date: string
  cum_plan_wf: number
  cum_actual_wf: number
  cum_forecast_wf: number
}

export interface ProgressCurveSummaryItem {
  filter_key: string
  implement_phase: string | null
  as_of_date: string | null
  plan: number
  forecast: number
  actual: number
  variance: number  // actual - forecast，滞后为负
  weight_pct?: number  // E/P/C 权重占比，仅 EN/PR/CT 有
}

export interface ProgressCurvePhaseItem {
  gcc_name: string
  gcc_display?: string  // 展示：add.1 / add2.1 / add2.2 / add.3（库存 2.1 / Add.1 / Add.3 / C）
  weight_pct: number
  plan: number
  forecast: number
  actual: number
  variance: number  // actual - forecast
}

export interface HomeStatsResponse {
  started_days: number   // 从 2020-4-30 起已开工天数
  cumulative_progress: number  // progress curve 全局累计进度 %
}

export interface DddStatsResponse {
  total: number
  ifr: number
  ifc: number
  ifc_a: number
  mac_total: number    // package 包含 MAC 的 total
  mac_ifc_a: number   // package 包含 MAC 的 IFC-A，展示用 mac_ifc_a / mac_total
  kisto_total: number
  kisto_ifc_a: number // 展示用 kisto_ifc_a / kisto_total
}

export interface KeyMilestoneItem {
  year: string
  month: string
  label: string
  status: string  // done | delayed | future
}

export const dashboardService = {
  async getHomeStats() {
    const response = await api.get('/dashboard/home-stats')
    return response.data as HomeStatsResponse
  },

  async getDddStats() {
    const response = await api.get('/dashboard/ddd-stats')
    return response.data as DddStatsResponse
  },

  async getKeyMilestones() {
    const response = await api.get('/dashboard/key-milestones')
    return response.data as KeyMilestoneItem[]
  },

  async getProgressSummary() {
    const response = await api.get('/dashboard/progress/summary')
    return response.data as ProgressSummary
  },

  async getProgressCurveSummary() {
    const response = await api.get('/dashboard/progress/curve/summary')
    return response.data as ProgressCurveSummaryItem[]
  },

  async getProgressCurvePhases() {
    const response = await api.get('/dashboard/progress/curve/phases')
    return response.data as ProgressCurvePhaseItem[]
  },

  async getProgressCurve() {
    const response = await api.get('/dashboard/progress/curve')
    return response.data as ProgressCurveItem[]
  },

  async getDisciplineDetails() {
    const response = await api.get('/dashboard/discipline/details')
    return response.data as DisciplineDetails
  },

  async getSummary() {
    const response = await api.get('/dashboard/summary')
    return response.data as DashboardSummaryResponse
  },

  async getWeightProgress() {
    const response = await api.get('/dashboard/weight-progress')
    return response.data as WeightProgressResponse
  },

  async getVolumeCompletion(params?: {
    subproject?: string[]
    train?: string[]
    unit?: string[]
    main_block?: string[]
    block?: string[]
    quarter?: string[]
    scope?: string[]
    start_date?: string
    end_date?: string
  }) {
    const response = await api.get('/dashboard/volume-completion', { params })
    return response.data as VolumeCompletionResponse
  },

  async getManpower() {
    const response = await api.get('/dashboard/manpower')
    return response.data as ManpowerResponse
  },
}
