import api from './api'
import type { MPDBEntry, VFACTDBEntry, InspectionDBEntry } from '../types/report'

export const reportService = {
  // MPDB (人力日报)
  async createMPDB(entry: MPDBEntry) {
    const response = await api.post('/reports/mpdb', entry)
    return response.data
  },

  async getMPDB(params?: {
    start_date?: string
    end_date?: string
    activity_id?: string
    title?: string
    block?: string[]
    discipline?: string[]  // 改为支持多选
    subproject?: string[]
    train?: string[]
    unit?: string[]
    main_block?: string[]
    quarter?: string[]
    scope?: string[]
    // activity_summary 相关字段
    implement_phase?: string[]
    contract_phase?: string[]
    type?: string[]
    work_package?: string[]
    // rsc_defines 相关字段
    resource_id_name?: string[]
    bcc_kq_code?: string[]
    kq?: string[]
    cn_wk_report?: string[]
    skip?: number
    limit?: number
    count_total?: boolean
  }) {
    const response = await api.get('/reports/mpdb', {
      params,
      paramsSerializer: {
        indexes: null, // 使用 ?param=value1&param=value2 格式
      },
    })
    // 处理新的响应格式（包含 items 和 total）
    const responseData = response.data
    if (responseData && typeof responseData === 'object' && 'items' in responseData) {
      return responseData
    }
    // 兼容旧格式（直接返回数组）
    return {
      items: Array.isArray(responseData) ? responseData : [],
      total: Array.isArray(responseData) ? responseData.length : 0
    }
  },

  async getMPDBById(id: number) {
    const response = await api.get(`/reports/mpdb/${id}`)
    return response.data
  },

  async updateMPDB(id: number, entry: MPDBEntry) {
    const response = await api.put(`/reports/mpdb/${id}`, entry)
    return response.data
  },

  async deleteMPDB(id: number) {
    const response = await api.delete(`/reports/mpdb/${id}`)
    return response.data
  },

  async getMPDBInvalidActivities(limit = 100) {
    const response = await api.get('/reports/mpdb/invalid-activities', {
      params: { limit },
    })
    return response.data
  },

  async exportMPDB(body: {
    columns?: Array<{ key: string; title: string; width?: number }>;
    filters?: any;
    template_type?: string;
  }) {
    const response = await api.post('/reports/mpdb/export', body)
    return response.data // 返回 { task_id: string }
  },

  async getExportStatus(taskId: string) {
    const response = await api.get(`/reports/export/status/${taskId}`)
    return response.data
  },

  async downloadExportFile(taskId: string) {
    const response = await api.get(`/reports/export/download/${taskId}`, {
      responseType: 'blob'
    })
    return response.data
  },

  // VFACTDB (工程量日报)
  async createVFACTDB(entry: VFACTDBEntry) {
    const response = await api.post('/reports/vfactdb', entry)
    return response.data
  },

  async getVFACTDB(params?: {
    start_date?: string
    end_date?: string
    activity_id?: string
    title?: string
    block?: string[]
    discipline?: string[]  // 改为支持多选
    subproject?: string[]
    train?: string[]
    unit?: string[]
    main_block?: string[]
    quarter?: string[]
    scope?: string[]
    // activity_summary 相关字段
    implement_phase?: string[]
    contract_phase?: string[]
    type?: string[]
    work_package?: string[]
    // rsc_defines 相关字段
    resource_id_name?: string[]
    bcc_kq_code?: string[]
    kq?: string[]
    cn_wk_report?: string[]
    skip?: number
    limit?: number
    count_total?: boolean
  }) {
    const response = await api.get('/reports/vfactdb', {
      params,
      paramsSerializer: {
        indexes: null, // 使用 ?param=value1&param=value2 格式
      },
    })
    // 处理新的响应格式（包含 items 和 total）
    const responseData = response.data
    if (responseData && typeof responseData === 'object' && 'items' in responseData) {
      return responseData
    }
    // 兼容旧格式（直接返回数组）
    return {
      items: Array.isArray(responseData) ? responseData : [],
      total: Array.isArray(responseData) ? responseData.length : 0
    }
  },

  async getVFACTDBById(id: number) {
    const response = await api.get(`/reports/vfactdb/${id}`)
    return response.data
  },

  async updateVFACTDB(id: number, entry: VFACTDBEntry) {
    const response = await api.put(`/reports/vfactdb/${id}`, entry)
    return response.data
  },

  async deleteVFACTDB(id: number) {
    const response = await api.delete(`/reports/vfactdb/${id}`)
    return response.data
  },

  async getVFACTDBInvalidActivities(limit = 100) {
    const response = await api.get('/reports/vfactdb/invalid-activities', {
      params: { limit },
    })
    return response.data
  },

  async exportVFACTDB(body: {
    columns?: Array<{ key: string; title: string; width?: number }>;
    filters?: any;
    template_type?: string;
  }) {
    const response = await api.post('/reports/vfactdb/export', body)
    return response.data // 返回 { task_id: string }
  },

  // VFACTDB 批量按比例调整
  async batchAdjustVFACTDB(request: {
    adjustments: Array<{
      activity_id: string
      new_total: number
      start_date?: string
      end_date?: string
    }>
  }) {
    const response = await api.post('/reports/vfactdb/batch-adjust', request)
    return response.data
  },

  // 获取VFACTDB统计信息
  async getVFACTDBStatistics(activity_id: string) {
    const response = await api.get(`/reports/vfactdb/statistics/${activity_id}`)
    return response.data
  },

  // VFACTDB 按周分配数量
  async weeklyDistributeVFACTDB(request: {
    activity_id: string
    start_date: string
    finish_date: string
    total_quantity: number
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
    work_step_description?: string
    discipline?: string
    work_package?: string
  }) {
    const response = await api.post('/reports/vfactdb/weekly-distribute', request)
    return response.data
  },

  // 从WeldingList同步PI04/PI05数据
  async syncWeldingPi04Pi05(options?: {
    targetDate?: string
    startDate?: string
    endDate?: string
  }) {
    const params: any = {}
    if (options?.targetDate) {
      params.target_date = options.targetDate
    }
    if (options?.startDate) {
      params.start_date = options.startDate
    }
    if (options?.endDate) {
      params.end_date = options.endDate
    }
    // 后台任务立即返回，不需要长超时
    const response = await api.post('/reports/vfactdb/sync-welding', null, { 
      params,
      timeout: 10000 // 10秒足够（只是启动任务）
    })
    return response.data
  },

  // 获取最近的焊接数据同步结果
  async getLatestWeldingSyncResult() {
    const response = await api.get('/reports/vfactdb/sync-welding/latest')
    return response.data
  },

  // InspectionDB (验收日报)
  async getItpDefinitions(params?: { status?: string }) {
    const response = await api.get('/reports/itp-definitions', { params })
    return response.data
  },
  async getInspectionDBGroundOfWorks(document_number?: string | null) {
    const response = await api.get('/reports/inspectiondb/ground-of-works', {
      params: document_number != null && document_number !== '' ? { document_number } : undefined,
    })
    return response.data
  },

  async getInspectionDB(params?: {
    start_date?: string
    end_date?: string
    rfi_id?: string
    activity_id?: string
    activity_ids?: string[]
    title?: string
    block?: string[]
    discipline?: string[]
    subproject?: string[]
    train?: string[]
    unit?: string[]
    main_block?: string[]
    quarter?: string[]
    scope?: string[]
    implement_phase?: string[]
    work_package?: string[]
    ground_of_works?: string[]
    skip?: number
    limit?: number
    count_total?: boolean
    include_attachment_status?: boolean
  }) {
    const response = await api.get('/reports/inspectiondb', {
      params,
      paramsSerializer: (p: Record<string, unknown>) => {
        const search = new URLSearchParams()
        Object.entries(p || {}).forEach(([k, v]) => {
          if (v === undefined || v === null) return
          if (Array.isArray(v)) v.forEach((one) => search.append(k, String(one)))
          else search.append(k, String(v))
        })
        return search.toString()
      },
    })
    const data = response.data
    if (data && typeof data === 'object' && 'items' in data) return data
    return { items: Array.isArray(data) ? data : [], total: Array.isArray(data) ? data.length : 0 }
  },

  async getInspectionDBSummary(params?: {
    start_date?: string
    end_date?: string
    rfi_id?: string
    activity_id?: string
    activity_ids?: string[]
    title?: string
    block?: string[]
    discipline?: string[]
    subproject?: string[]
    train?: string[]
    unit?: string[]
    main_block?: string[]
    quarter?: string[]
    scope?: string[]
    implement_phase?: string[]
    work_package?: string[]
    ground_of_works?: string[]
  }) {
    const response = await api.get<{ total_count: number; key_rfi_count: number; key_rfi_quantity_sum: number }>(
      '/reports/inspectiondb/summary',
      {
        params,
        paramsSerializer: (p: Record<string, unknown>) => {
          const search = new URLSearchParams()
          Object.entries(p || {}).forEach(([k, v]) => {
            if (v === undefined || v === null) return
            if (Array.isArray(v)) v.forEach((one) => search.append(k, String(one)))
            else search.append(k, String(v))
          })
          return search.toString()
        },
      }
    )
    return response.data
  },

  async batchFetchInspectionDB(body: {
    activity_ids: string[]
    limit?: number
    count_total?: boolean
  }) {
    const response = await api.post('/reports/inspectiondb/batch-fetch', body)
    return response.data
  },

  async getInspectionDBById(id: number) {
    const response = await api.get(`/reports/inspectiondb/${id}`)
    return response.data
  },

  async createInspectionDB(entry: InspectionDBEntry) {
    const response = await api.post('/reports/inspectiondb', entry)
    return response.data
  },

  async updateInspectionDB(id: number, entry: InspectionDBEntry) {
    const response = await api.put(`/reports/inspectiondb/${id}`, entry)
    return response.data
  },

  async deleteInspectionDB(id: number) {
    const response = await api.delete(`/reports/inspectiondb/${id}`)
    return response.data
  },

  // 检验申请单 RFI 文件（浏览、上传、下载）
  async getRfiFilesList(path?: string) {
    const response = await api.get<{ path: string; dirs: { name: string; path: string }[]; files: { name: string; path: string; size?: number }[]; root_configured: boolean }>('/reports/rfi-files/list', { params: { path: path || '' } })
    return response.data
  },

  async downloadRfiFile(path: string) {
    const response = await api.get('/reports/rfi-files/download', { params: { path }, responseType: 'blob' })
    return response.data as Blob
  },

  async uploadRfiFile(path: string, file: File) {
    const form = new FormData()
    form.append('path', path || '')
    form.append('file', file)
    const response = await api.post<{ path: string; name: string; size: number }>('/reports/rfi-files/upload', form)
    return response.data
  },

  /** 规范上传：根目录/{scope}/INPUT|OUTPUT/{rfi_id}_{version}.{ext} */
  async uploadRfiFileStandard(params: { scope: string; folder: 'INPUT' | 'OUTPUT'; rfi_id: string; file: File; version?: number }) {
    const form = new FormData()
    form.append('scope', params.scope)
    form.append('folder', params.folder)
    form.append('rfi_id', params.rfi_id)
    form.append('file', params.file)
    if (params.version !== undefined) form.append('version', String(params.version))
    const response = await api.post<{ path: string; name: string; scope: string; folder: string; rfi_id: string; version: number; size: number }>(
      '/reports/rfi-files/upload-standard',
      form
    )
    return response.data
  },

  /** 下次上传 INPUT 使用的版本号（首次 0，质检拒绝后 1、2…） */
  async getNextInputVersion(scope: string, rfi_id: string) {
    const response = await api.get<{ scope: string; rfi_id: string; next_input_version: number }>(
      '/reports/rfi-files/next-input-version',
      { params: { scope, rfi_id } }
    )
    return response.data
  },

  /** 质检拒绝时调用：该 RFI 升版（后端在保存验收结论为拒绝时也会自动调用，前端一般无需单独调） */
  async bumpRfiInputVersion(scope: string, rfi_id: string) {
    const response = await api.post<{ scope: string; rfi_id: string; next_input_version: number }>(
      '/reports/rfi-files/bump-input-version',
      new URLSearchParams({ scope, rfi_id }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )
    return response.data
  },

  /** 按 RFI 列出 INPUT/OUTPUT 下的所有版本 */
  async getRfiFilesByRfi(scope: string, rfi_id: string) {
    const response = await api.get<{ scope: string; rfi_id: string; input: { name: string; path: string; version: number; size?: number }[]; output: { name: string; path: string; version: number; size?: number }[] }>(
      '/reports/rfi-files/list-by-rfi',
      { params: { scope, rfi_id } }
    )
    return response.data
  },

  /** 获取作业详情（由 activity_summary 提供数据） */
  async getActivity(activity_id: string) {
    const response = await api.get(`/activities/${activity_id}`)
    return response.data
  },
}

