import api from './api'

/** 验收程序明细行（与 export_itp_to_excel 结构一致） */
export interface AcceptanceProcedureGroundFieldRow {
  id: number
  level?: number
  itp_id?: string | null
  section_name?: string | null
  workdescription_eng?: string | null
  workdescription_rus?: string | null
  workdescription_chn?: string | null
  applicable_documents_eng?: string[] | null
  applicable_documents_rus?: string[] | null
  acceptance_criteria_eng?: string[] | null
  acceptance_criteria_rus?: string[] | null
  quality_control_form_eng?: string | null
  quality_control_form_rus?: string | null
  quality_control_form_chn?: string | null
  involvement_subcon?: string | null
  involvement_contractor?: string | null
  involvement_customer?: string | null
  involvement_aqc?: string | null
  is_active: boolean
}

/** 验收程序：ITP 及其 groundfields 列表 */
export interface AcceptanceProcedureITPItem {
  document_number: string
  itp_name?: string | null
  version?: string | null
  status?: string | null
  remarks?: string | null
  groundfields: AcceptanceProcedureGroundFieldRow[]
}

export const acceptanceProcedureService = {
  async getList(params?: {
    status?: string
    document_number?: string
  }): Promise<AcceptanceProcedureITPItem[]> {
    const response = await api.get<AcceptanceProcedureITPItem[]>('/reports/acceptance-procedure', {
      params: params || {},
    })
    return response.data
  },

  /** 导出验收程序为 Excel（与 export_itp_to_excel 脚本一致），返回 blob 用于下载 */
  async exportExcel(params?: { status?: string; document_number?: string }): Promise<Blob> {
    const response = await api.get('/reports/acceptance-procedure/export', {
      params: params || {},
      responseType: 'blob',
    })
    return response.data as Blob
  },
}
