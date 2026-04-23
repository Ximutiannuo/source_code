import api from './api'

export interface DailyReportMgmtValuesRequest {
  mp_date: string
  vfact_date: string
  activity_ids: string[]
}

export interface DailyReportMgmtWorkStepValue {
  work_step_description: string
  achieved?: number | null  // 指定日期的完成量（用于 vfact_achieved 列）
  cumulative_achieved?: number | null  // 累计完成量（所有日期的总和，用于 completed 列）
  is_key_quantity: boolean
  estimated_total?: number | null  // 预估总量：关键工程量从 VolumeControl，非关键从 WorkStepVolume
}

export interface DailyReportMgmtValuesItem {
  manpower?: number | null
  machinery?: number | null
  achieved?: number | null  // 向后兼容：单个完成量（用于非工作步骤模式）
  remarks?: string | null
  work_steps?: DailyReportMgmtWorkStepValue[]  // 新增：工作步骤完成量列表
  key_qty?: number | null  // Activity级别的预估总量（从 VolumeControlQuantity.estimated_total 获取，用于MP模式）
  completed?: number | null  // Activity级别的完成量（从 VFACTDB 中所有关键工作步骤的累计完成量求和，用于MP模式）
  system_status?: string  // 作业系统状态
}

export interface DailyReportMgmtValuesResponse {
  mp_date: string
  vfact_date: string
  values: Record<string, DailyReportMgmtValuesItem>
}

export interface DailyReportMgmtSaveEntry {
  activity_id: string
  manpower?: number | null
  machinery?: number | null
  achieved?: number | null  // 向后兼容：单个完成量（用于非工作步骤模式）
  remarks?: string | null
  work_steps?: DailyReportMgmtWorkStepValue[]  // 新增：工作步骤完成量列表
}

export interface DailyReportMgmtSaveRequest {
  mp_date: string
  vfact_date: string
  entries: DailyReportMgmtSaveEntry[]
}

export interface SkippedEntryDetail {
  activity_id: string
  manpower?: number | string | null
  machinery?: number | string | null
}

export interface DailyReportMgmtSaveResponse {
  success: boolean
  message: string
  mp_saved: number
  vfact_saved: number
  skipped_details?: SkippedEntryDetail[]  // 已跳过的锁定作业列表，便于前端分行展示
}

export interface DailyReportMgmtExportColumn {
  key: string
  title: string
}

export interface DailyReportMgmtExportRow {
  row_type: 'group' | 'item'
  level: number
  background?: string
  values: Record<string, any>
}

export interface DailyReportMgmtExportRequest {
  mp_date: string
  vfact_date: string
  columns: DailyReportMgmtExportColumn[]
  rows?: DailyReportMgmtExportRow[]
  filters?: Record<string, any>
  group_by?: string[]
  mp_extras?: Record<string, number>
  scope?: string
  mode?: string
  show_all_work_steps?: boolean  // 是否显示所有工作步骤（包括非关键工作步骤），默认false（只显示关键工作步骤）
}

export const dailyReportManagementService = {
  async getValues(request: DailyReportMgmtValuesRequest) {
    const response = await api.post('/daily-report-management/values', request)
    return response.data as DailyReportMgmtValuesResponse
  },

  async save(request: DailyReportMgmtSaveRequest) {
    const response = await api.post('/daily-report-management/save', request)
    return response.data as DailyReportMgmtSaveResponse
  },

  async exportExcel(request: DailyReportMgmtExportRequest) {
    const response = await api.post('/daily-report-management/export', request, { responseType: 'blob' })
    return response.data as Blob
  },

  async importExcel(params: { mp_date: string; vfact_date: string; file: File; ignore_mp?: boolean }) {
    const form = new FormData()
    form.append('file', params.file)
    const response = await api.post('/daily-report-management/import', form, {
      params: { mp_date: params.mp_date, vfact_date: params.vfact_date, ignore_mp: params.ignore_mp ? 1 : 0 },
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000, // 5 分钟，大 Excel 解析+保存可能超过 2 分钟，避免 504 时后端实际已成功
    })
    return response.data as DailyReportMgmtSaveResponse
  },

  async getMpExtras(params: { date: string; scope: string }) {
    const response = await api.get('/daily-report-management/mp-extras', { params })
    return response.data as { date: string; scope: string; manpower: Record<string, number> }
  },

  async saveMpExtras(request: { date: string; scope: string; manpower: Record<string, number> }) {
    const response = await api.post('/daily-report-management/mp-extras', request)
    return response.data as DailyReportMgmtSaveResponse
  },
}


