import api from './api'

export interface VolumeSummaryItem {
  discipline?: string
  work_package?: string
  discipline_code?: string
  total_design: number
  cumulative_completed: number
  completion_rate: number
  last_week_completed: number
  this_week_planned: number
  this_week_completed: number
  weekly_plan_rate: number
  next_week_planned: number
  this_month_planned: number
  this_month_completed: number
}

export interface ManpowerSummaryItem {
  discipline?: string
  work_package?: string
  discipline_code?: string
  manpower_type?: string
  total_manpower: number
  last_week_manpower: number
  this_week_planned: number
  this_week_actual: number
  weekly_plan_rate: number
  next_week_planned: number
  this_month_planned: number
  this_month_actual: number
}

export const summaryService = {
  async getVolumeSummary(params?: {
    start_date?: string
    end_date?: string
    discipline?: string
    work_package?: string
  }) {
    const response = await api.get('/summary/volume', { params })
    return response.data as VolumeSummaryItem[]
  },

  async getManpowerSummary(params?: {
    start_date?: string
    end_date?: string
    discipline?: string
    work_package?: string
  }) {
    const response = await api.get('/summary/manpower', { params })
    return response.data as ManpowerSummaryItem[]
  },
}

