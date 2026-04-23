/** activity_id 为空表示 MP 额外项（无对应 P6 作业） */
export interface MPDBEntry {
  date: string
  activity_id: string | null
  scope?: string
  typeof_mp?: 'Direct' | 'Indirect'
  manpower: string  // 后端存储为decimal(38,20)，返回字符串保持完整精度（前端显示时智能格式化：整数不显示小数）
  machinery?: string  // 后端存储为decimal(38,20)，返回字符串保持完整精度（前端显示时智能格式化：整数不显示小数）
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
  remarks?: string
}

export interface VFACTDBEntry {
  date: string
  activity_id: string
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
  achieved: string | number  // 支持字符串和数字，前端发送时使用字符串保持精度
}

export interface MPDBResponse extends MPDBEntry {
  id: number
}

export interface VFACTDBResponse extends VFACTDBEntry {
  id: number
}

// 验收日报 InspectionDB（关键键 document_number / ground_of_works / rfi_id 排前）
export interface InspectionDBEntry {
  document_number?: string | null
  ground_of_works?: string
  rfi_id: string
  rfi_short_id?: string | null
  rfi_issue_date?: string
  rfi_inspection_date?: string
  activity_id?: string | null
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
  rfi_description?: string
  rfi_inspection_location?: string
  discipline?: string
  work_package?: string
  matched_drawing_number?: string[]
  inspection_type?: string
  inspection_conclusion?: string
  comments?: string
  fixing_problems_details?: string
  verification_date?: string
  qc_inspector?: string
  note?: string
  request_no?: string
  rfi_quantity?: string | number
  is_key_rfi_aggregation?: boolean
}

export interface InspectionDBResponse extends InspectionDBEntry {
  id: number
  created_at?: string
  updated_at?: string
  updated_by?: number
  updated_method?: string
  is_system_sync?: boolean
}

export interface RFIGroundFieldItem {
  id: number
  document_number?: string
  itp_id?: string
  description?: string
  is_active: boolean
}

