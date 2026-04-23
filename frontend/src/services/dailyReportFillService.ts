import api from './api'

export interface DailyReportTemplate {
  id: number
  name: string
  report_type: 'MP' | 'VFACT'
  scope: string
  description?: string
  config?: any
  is_active: boolean
  is_default: boolean
  created_at: string
}

export interface ActivityGroupItem {
  activity_id: string
  title: string
  block?: string
  discipline?: string
  work_package?: string
  scope?: string
  project?: string
  subproject?: string
  implement_phase?: string
  train?: string
  unit?: string
  main_block?: string
  quarter?: string
}

export interface DailyReportTemplateData {
  template_id?: number
  report_type: 'MP' | 'VFACT'
  date: string
  scope: string
  activities: ActivityGroupItem[]
  group_structure?: any
}

export interface DailyReportFillEntry {
  activity_id?: string
  typeof_mp?: 'Direct' | 'Indirect'
  manpower?: number
  machinery?: number
  achieved?: number | string
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
  work_step_description?: string
  remarks?: string
}

export interface DailyReportFillRequest {
  date: string
  report_type: 'MP' | 'VFACT'
  scope: string
  entries: DailyReportFillEntry[]
  status?: 'draft' | 'submitted'
  replace_all?: boolean
}

export interface DailyReportSubmission {
  id: number
  date: string
  report_type: 'MP' | 'VFACT'
  scope: string
  status: 'pending' | 'submitted' | 'late'
  submitted_at?: string
  first_submitted_at?: string
  updated_at?: string
  total_activities: number
  filled_activities: number
  total_manpower?: number
  total_machinery?: number
  total_volume?: number
  details?: {
    direct?: number
    support?: number
    indirect_work?: number
    indirect_leave?: number
    direct_leave?: number
    work_content?: Record<string, number>
  }
}

export interface SubmissionStatus {
  date: string
  report_type: 'MP' | 'VFACT'
  total_scopes: number
  submitted_count: number
  pending_count: number
  submitted_scopes: string[]
  pending_scopes: string[]
}

export interface DailyReportFillRow {
  activity_id: string
  title: string
  project?: string
  subproject?: string
  implement_phase?: string
  train?: string
  unit?: string
  block?: string
  discipline?: string
  work_package?: string
  work_step_description?: string
  manpower?: number | null
  machinery?: number | null
  achieved?: number | null
}

export interface DailyReportFillContextResponse {
  report_type: 'MP' | 'VFACT'
  date: string
  scope: string
  based_on_mp_date?: string
  rows: DailyReportFillRow[]
}

export interface DailyReportExportRequest {
  report_date: string
  scope: string
  report_type: 'MP' | 'VFACT'
}

export interface DailyReportImportResponse {
  success: boolean
  message: string
  imported_count: number
  errors: string[]
}

export const dailyReportFillService = {
  // 获取可用scope（复用日报模板接口）
  async getAvailableScopes() {
    const response = await api.get('/daily-reports/scopes')
    return response.data as string[]
  },

  // 获取模板列表
  async getTemplates(params?: {
    report_type?: 'MP' | 'VFACT'
    scope?: string
  }) {
    const response = await api.get('/daily-report-fill/templates', { params })
    return response.data
  },

  // 获取模板数据
  async getTemplateData(templateId: number, date: string) {
    const response = await api.get(`/daily-report-fill/templates/${templateId}/data`, {
      params: { date }
    })
    return response.data
  },

  // 提交日报填报
  async submitDailyReport(request: DailyReportFillRequest) {
    const response = await api.post('/daily-report-fill/fill', request)
    return response.data
  },

  // 获取网页填报上下文（行清单+回填）
  async getFillContext(params: {
    report_type: 'MP' | 'VFACT'
    date: string
    scope: string
    template_id?: number
    based_on_mp_date?: string
  }) {
    const response = await api.get('/daily-report-fill/context', { params })
    return response.data as DailyReportFillContextResponse
  },

  // 导出Excel模板（用于线下填写）
  async exportTemplate(request: DailyReportExportRequest) {
    const response = await api.post('/daily-report-fill/export', request, {
      responseType: 'blob',
    })
    return response.data as Blob
  },

  // 导入已填写的Excel（写回数据库）
  async importFilledReport(params: {
    report_type: 'MP' | 'VFACT'
    report_date: string
    scope: string
    file: File
  }) {
    const form = new FormData()
    form.append('file', params.file)
    const response = await api.post(`/daily-report-fill/import/${params.report_type}`, form, {
      params: { report_date: params.report_date, scope: params.scope },
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data as DailyReportImportResponse
  },

  // 获取填报记录列表
  async getSubmissions(params?: {
    start_date?: string
    end_date?: string
    report_type?: 'MP' | 'VFACT'
    scope?: string
    status?: 'pending' | 'submitted' | 'late'
  }) {
    const response = await api.get('/daily-report-fill/submissions', { params })
    return response.data
  },

  // 获取填报状态
  async getSubmissionStatus(date: string, reportType: 'MP' | 'VFACT') {
    const response = await api.get('/daily-report-fill/submissions/status', {
      params: { date, report_type: reportType }
    })
    return response.data
  },

  // 获取必填scope配置
  async getRequiredScopes(reportType: 'MP' | 'VFACT') {
    const response = await api.get('/daily-report-fill/required-scopes', {
      params: { report_type: reportType }
    })
    return response.data as {
      report_type: string
      required_scopes: string[]
      total_available_scopes: number
      available_scopes: string[]
    }
  },

  // 设置必填scope配置
  async setRequiredScopes(reportType: 'MP' | 'VFACT', scopes: string[]) {
    const response = await api.post('/daily-report-fill/required-scopes', {
      report_type: reportType,
      scopes
    })
    return response.data as {
      report_type: string
      required_scopes: string[]
      total_available_scopes: number
      available_scopes: string[]
    }
  }
}

