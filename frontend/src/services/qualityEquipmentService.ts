import api from './api'

export interface QualityDashboard {
  period_days: number
  total_checks: number
  pass_count: number
  fail_count: number
  rework_count: number
  hold_count: number
  checked_qty_total: number
  defect_qty_total: number
  rework_qty_total: number
  first_pass_rate: number
  defect_rate: number
}

export interface DefectParetoItem {
  step_code: string
  defect_qty: number
  rework_qty: number
  check_count: number
  cumulative_pct: number
}

export interface QualityTrendItem {
  date: string
  total_checks: number
  pass_count: number
  fail_count: number
  rework_count: number
  hold_count: number
  checked_qty: number
  defect_qty: number
  first_pass_rate: number
}

export interface QualityCheckItem {
  id: number
  step_id: number
  step_code?: string | null
  step_name?: string | null
  order_id?: number | null
  order_number?: string | null
  inspector_id?: number | null
  inspector_name?: string | null
  check_type: string
  result: string
  checked_qty: number
  defect_qty: number
  rework_qty: number
  remarks?: string | null
  checked_at?: string | null
}

export interface EquipmentItem {
  id: number
  code: string
  name: string
  model_number?: string | null
  workstation?: string | null
  status: string
  department?: string | null
  location?: string | null
  purchase_date?: string | null
  last_maintenance_date?: string | null
  next_maintenance_date?: string | null
  maintenance_cycle_days: number
  description?: string | null
  created_at?: string | null
}

export interface EquipmentCreate {
  code: string
  name: string
  model_number?: string
  workstation?: string
  status?: string
  department?: string
  location?: string
  purchase_date?: string | null
  maintenance_cycle_days?: number
  description?: string
}

export interface EquipmentUpdate {
  name?: string
  model_number?: string
  workstation?: string
  status?: string
  department?: string
  location?: string
  purchase_date?: string | null
  maintenance_cycle_days?: number
  description?: string
}

export interface EquipmentDashboard {
  total: number
  active: number
  maintenance: number
  offline: number
  overdue_maintenance: number
  upcoming_maintenance_7d: number
  total_maintenance_records: number
  total_downtime_minutes: number
}

export interface MaintenanceRecord {
  id: number
  equipment_id: number
  maintenance_type: string
  description?: string | null
  operator_name?: string | null
  start_time?: string | null
  end_time?: string | null
  downtime_minutes: number
  cost: number
  status: string
  remarks?: string | null
  created_at?: string | null
}

export interface MaintenanceCreate {
  equipment_id: number
  maintenance_type?: string
  description?: string
  operator_name?: string
  start_time?: string | null
  end_time?: string | null
  downtime_minutes?: number
  cost?: number
  status?: string
  remarks?: string
}

export const qualityService = {
  getDashboard(days = 30) {
    return api.get<QualityDashboard>('/quality/dashboard', { params: { days } })
  },
  getDefectPareto(days = 30) {
    return api.get<DefectParetoItem[]>('/quality/defect-pareto', { params: { days } })
  },
  getTrend(days = 30) {
    return api.get<QualityTrendItem[]>('/quality/trend', { params: { days } })
  },
  listChecks(params?: { result?: string; step_code?: string; days?: number; limit?: number }) {
    return api.get<QualityCheckItem[]>('/quality/checks', { params })
  },
}

export const equipmentService = {
  list(params?: { status?: string; keyword?: string }) {
    return api.get<EquipmentItem[]>('/equipment', { params })
  },
  getDashboard() {
    return api.get<EquipmentDashboard>('/equipment/dashboard')
  },
  get(id: number) {
    return api.get<EquipmentItem>(`/equipment/${id}`)
  },
  create(body: EquipmentCreate) {
    return api.post<EquipmentItem>('/equipment', body)
  },
  update(id: number, body: EquipmentUpdate) {
    return api.patch<EquipmentItem>(`/equipment/${id}`, body)
  },
  delete(id: number) {
    return api.delete(`/equipment/${id}`)
  },
  listMaintenances(equipmentId: number) {
    return api.get<MaintenanceRecord[]>(`/equipment/${equipmentId}/maintenances`)
  },
  listAllMaintenances(params?: { maintenance_type?: string; limit?: number }) {
    return api.get<MaintenanceRecord[]>('/equipment/maintenances/all', { params })
  },
  createMaintenance(body: MaintenanceCreate) {
    return api.post<MaintenanceRecord>('/equipment/maintenances', body)
  },
}
