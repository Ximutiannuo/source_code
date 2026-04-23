import api from './api'

export interface EquipmentOption {
  id: number
  code: string
  name: string
  model_number?: string | null
  workstation?: string | null
  status: string
}

export interface WorkReport {
  id: number
  operator_id?: number | null
  operator_name?: string | null
  quantity: number
  scrap_qty: number
  work_hours: number
  downtime_minutes: number
  report_type: string
  remarks?: string | null
  report_time?: string | null
  created_at?: string | null
}

export interface QualityCheck {
  id: number
  inspector_id?: number | null
  inspector_name?: string | null
  check_type: string
  result: string
  checked_qty: number
  defect_qty: number
  rework_qty: number
  remarks?: string | null
  checked_at?: string | null
  created_at?: string | null
}

export interface ManufacturingOrderStep {
  id: number
  step_code: string
  name: string
  sort_order: number
  target_qty?: number | null
  completed_qty?: number | null
  planned_work_hours?: number | null
  setup_hours?: number | null
  workstation_id?: number | null
  workstation_name?: string | null
  status: string
  equipment?: EquipmentOption | null
  reports?: WorkReport[]
  quality_checks?: QualityCheck[]
}

export interface ManufacturingOrder {
  id: number
  order_number: string
  customer_name?: string | null
  product_name?: string | null
  quantity: number
  due_date?: string | null
  priority: number
  status: string
  notes?: string | null
  created_at?: string | null
  bom?: {
    id: number
    product_code: string
    version: string
    bom_type?: string | null
  } | null
  process_template?: {
    id: number
    name: string
  } | null
  steps: ManufacturingOrderStep[]
}

export interface ManufacturingOrderCreate {
  order_number: string
  customer_name?: string
  product_name?: string
  bom_id?: number
  process_template_id?: number
  quantity: number
  due_date?: string | null
  priority?: number
  status?: string
  notes?: string
  auto_generate_steps?: boolean
}

export interface ManufacturingOrderUpdate {
  order_number?: string
  customer_name?: string | null
  product_name?: string | null
  bom_id?: number | null
  process_template_id?: number | null
  quantity?: number
  due_date?: string | null
  priority?: number
  status?: string
  notes?: string | null
}

export interface ProductionStepStatusUpdate {
  status: string
  completed_qty?: number | null
}

export interface ProductionStepPlanningUpdate {
  workstation_id?: number | null
  planned_work_hours?: number | null
  setup_hours?: number | null
}

export interface WorkReportCreate {
  quantity: number
  scrap_qty?: number
  work_hours?: number | null
  downtime_minutes?: number
  report_type?: string
  remarks?: string
}

export interface QualityCheckCreate {
  check_type?: string
  result: string
  checked_qty?: number
  defect_qty?: number
  rework_qty?: number
  remarks?: string
}

export interface WipSummary {
  orders_total: number
  orders_planned: number
  orders_released: number
  orders_in_progress: number
  orders_qc: number
  orders_completed: number
  orders_cancelled: number
  steps_total: number
  steps_planned: number
  steps_ready: number
  steps_in_progress: number
  steps_qc: number
  steps_completed: number
  steps_blocked: number
  quality_pass_count: number
  quality_fail_count: number
  quality_rework_count: number
  quality_hold_count: number
  rework_qty_total: number
  defect_qty_total: number
  planned_hours_total: number
  reported_hours_total: number
  downtime_minutes_total: number
  equipment_total: number
  equipment_active: number
  equipment_maintenance: number
  equipment_offline: number
  equipment_assigned: number
  overall_oee_rate: number
  reports_total: number
  reports_today: number
}

export interface EquipmentOeeItem {
  id: number
  code: string
  name: string
  model_number?: string | null
  workstation?: string | null
  status: string
  assigned_steps: number
  orders_count: number
  planned_hours_total: number
  actual_hours_total: number
  runtime_hours_total: number
  theoretical_hours_total: number
  downtime_minutes_total: number
  good_qty_total: number
  scrap_qty_total: number
  availability_rate: number
  performance_rate: number
  quality_rate: number
  utilization_rate: number
  oee_rate: number
}

export interface EquipmentOeeSummary {
  equipment_total: number
  equipment_active: number
  equipment_maintenance: number
  equipment_offline: number
  equipment_assigned: number
  planned_hours_total: number
  actual_hours_total: number
  runtime_hours_total: number
  downtime_minutes_total: number
  overall_availability_rate: number
  overall_performance_rate: number
  overall_quality_rate: number
  overall_oee_rate: number
  items: EquipmentOeeItem[]
}

export interface MaterialReadinessItem {
  material_code: string
  material_name: string
  unit: string
  material_type?: string | null
  material_category?: string | null
  lead_time_days: number
  required_qty: number
  current_stock: number
  reserved_stock: number
  incoming_stock: number
  available_qty: number
  net_available_qty: number
  safety_stock: number
  shortage_qty: number
  shortage_with_safety_qty: number
  readiness_status: string
  shortage_reason: string
  impacted_order_count: number
  impacted_orders: string[]
}

export interface OrderMaterialReadiness {
  order_id: number
  order_number: string
  bom_id?: number | null
  bom_version?: string | null
  kit_status: string
  required_items_total: number
  ready_items: number
  risk_items: number
  short_items: number
  shortage_qty_total: number
  kit_rate: number
  items: MaterialReadinessItem[]
}

export interface MaterialPlanningSummary {
  orders_considered: number
  orders_without_bom: number
  materials_total: number
  ready_materials: number
  risk_materials: number
  short_materials: number
  shortage_qty_total: number
  impacted_orders: number
  items: MaterialReadinessItem[]
}

export interface ProcurementSuggestionItem {
  material_code: string
  material_name: string
  unit: string
  material_type?: string | null
  material_category?: string | null
  readiness_status: string
  shortage_reason: string
  procurement_mode: string
  suggested_action: string
  suggested_purchase_qty: number
  shortage_qty: number
  shortage_with_safety_qty: number
  current_stock: number
  reserved_stock: number
  incoming_stock: number
  net_available_qty: number
  safety_stock: number
  lead_time_days: number
  earliest_due_date?: string | null
  suggested_order_date?: string | null
  urgency_level: string
  planning_note: string
  impacted_order_count: number
  impacted_orders: string[]
}

export interface ProcurementSuggestionSummary {
  orders_considered: number
  orders_without_bom: number
  items_total: number
  urgent_items: number
  high_items: number
  to_purchase_items: number
  to_expedite_items: number
  master_data_gap_items: number
  replenish_items: number
  suggested_purchase_qty_total: number
  impacted_orders: number
  items: ProcurementSuggestionItem[]
}

export interface OrderProcurementSuggestion {
  order_id: number
  order_number: string
  kit_status: string
  items_total: number
  urgent_items: number
  high_items: number
  to_purchase_items: number
  to_expedite_items: number
  master_data_gap_items: number
  replenish_items: number
  suggested_purchase_qty_total: number
  impacted_orders: number
  items: ProcurementSuggestionItem[]
}

export interface ProcurementRequestItem {
  id: number
  material_code: string
  material_name: string
  unit?: string | null
  material_type?: string | null
  material_category?: string | null
  readiness_status?: string | null
  shortage_reason?: string | null
  procurement_mode?: string | null
  suggested_action?: string | null
  urgency_level?: string | null
  requested_qty: number
  shortage_qty: number
  shortage_with_safety_qty: number
  current_stock: number
  reserved_stock: number
  incoming_stock: number
  net_available_qty: number
  safety_stock: number
  lead_time_days: number
  earliest_due_date?: string | null
  suggested_order_date?: string | null
  impacted_order_count: number
  impacted_orders: string[]
  planning_note?: string | null
}

export interface ProcurementRequest {
  id: number
  request_no: string
  title: string
  source_scope: string
  source_order_id?: number | null
  source_order_number?: string | null
  status: string
  urgency_level: string
  total_items: number
  suggested_purchase_qty_total: number
  requester_id?: number | null
  requester_name?: string | null
  notes?: string | null
  submitted_at?: string | null
  completed_at?: string | null
  created_at?: string | null
  updated_at?: string | null
  items: ProcurementRequestItem[]
}

export interface ProcurementRequestGenerateBody {
  source_scope: string
  order_id?: number | null
  material_codes?: string[]
  title?: string
  notes?: string
}

export interface ProcurementRequestStatusUpdateBody {
  status: string
}

export interface ProcurementRequestUpdateBody {
  title?: string
  source_scope?: string
  status?: string
  urgency_level?: string
  requester_name?: string | null
  notes?: string | null
}

const ORDER_BASE = '/manufacturing/orders'

export const manufacturingOrderService = {
  list(params?: { status?: string; keyword?: string }) {
    return api.get<ManufacturingOrder[]>(ORDER_BASE, { params })
  },

  get(orderId: number) {
    return api.get<ManufacturingOrder>(`${ORDER_BASE}/${orderId}`)
  },

  create(body: ManufacturingOrderCreate) {
    return api.post<ManufacturingOrder>(ORDER_BASE, body)
  },

  update(orderId: number, body: ManufacturingOrderUpdate) {
    return api.patch<ManufacturingOrder>(`${ORDER_BASE}/${orderId}`, body)
  },

  updateStepStatus(orderId: number, stepId: number, body: ProductionStepStatusUpdate) {
    return api.patch<ManufacturingOrderStep>(`${ORDER_BASE}/${orderId}/steps/${stepId}/status`, body)
  },

  updateStepPlanning(orderId: number, stepId: number, body: ProductionStepPlanningUpdate) {
    return api.patch<ManufacturingOrderStep>(`${ORDER_BASE}/${orderId}/steps/${stepId}/planning`, body)
  },

  reportWork(orderId: number, stepId: number, body: WorkReportCreate) {
    return api.post<WorkReport>(`${ORDER_BASE}/${orderId}/steps/${stepId}/reports`, body)
  },

  createQualityCheck(orderId: number, stepId: number, body: QualityCheckCreate) {
    return api.post<QualityCheck>(`${ORDER_BASE}/${orderId}/steps/${stepId}/quality-checks`, body)
  },

  getWipSummary() {
    return api.get<WipSummary>('/manufacturing/wip-summary')
  },

  getEquipmentOeeSummary() {
    return api.get<EquipmentOeeSummary>('/manufacturing/equipment-oee')
  },

  getMaterialPlanningSummary() {
    return api.get<MaterialPlanningSummary>('/manufacturing/material-planning-summary')
  },

  getProcurementSuggestions() {
    return api.get<ProcurementSuggestionSummary>('/manufacturing/procurement-suggestions')
  },

  getOrderMaterialReadiness(orderId: number) {
    return api.get<OrderMaterialReadiness>(`${ORDER_BASE}/${orderId}/material-readiness`)
  },

  getOrderProcurementSuggestions(orderId: number) {
    return api.get<OrderProcurementSuggestion>(`${ORDER_BASE}/${orderId}/procurement-suggestions`)
  },

  listProcurementRequests(params?: { status?: string; order_id?: number }) {
    return api.get<ProcurementRequest[]>('/manufacturing/procurement-requests', { params })
  },

  generateProcurementRequest(body: ProcurementRequestGenerateBody) {
    return api.post<ProcurementRequest>('/manufacturing/procurement-requests/generate', body)
  },

  updateProcurementRequestStatus(requestId: number, body: ProcurementRequestStatusUpdateBody) {
    return api.patch<ProcurementRequest>(`/manufacturing/procurement-requests/${requestId}/status`, body)
  },

  updateProcurementRequest(requestId: number, body: ProcurementRequestUpdateBody) {
    return api.patch<ProcurementRequest>(`/manufacturing/procurement-requests/${requestId}`, body)
  },

  listEquipment() {
    return api.get<EquipmentOption[]>('/facility/equipment')
  },

  exportOrders(params?: { status?: string }) {
    return api.get('/manufacturing/orders-export', {
      params,
      responseType: 'blob',
    })
  },

  importOrders(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<{
      imported: number
      errors: number
      updated?: { row: number; order_number: string; id: number }[]
      created: { row: number; order_number: string; id: number }[]
      error_details: { row: number; error: string }[]
    }>('/manufacturing/orders-import-upsert', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  exportProcurementRequests(params?: { status?: string; order_id?: number }) {
    return api.get('/manufacturing/procurement-requests-export', {
      params,
      responseType: 'blob',
    })
  },

  importProcurementRequests(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<{
      imported: number
      errors: number
      updated?: { row: number; request_no: string; id: number }[]
      created: { row: number; request_no: string; id: number }[]
      error_details: { row: number; error: string }[]
    }>('/manufacturing/procurement-requests-import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}
