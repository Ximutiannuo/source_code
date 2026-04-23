import api from './api'

export interface VolumeControl {
  id: number
  activity_id: string
  estimated_total?: number | null
  drawing_approved_afc?: number | null
  material_arrived?: number | null
  available_workface?: number | null
  workface_restricted_material?: number | null
  workface_restricted_site?: number | null
  construction_completed?: number | null
  rfi_completed_a?: number | null
  rfi_completed_b?: number | null
  rfi_completed_c?: number | null
  asbuilt_signed_r0?: number | null
  asbuilt_signed_r1?: number | null
  obp_signed?: number | null
  earliest_start_date?: string | null
  latest_update_date?: string | null
  scope?: string | null
  construction_responsible?: string | null
  remarks?: string | null
}

export interface VolumeControlCreate {
  activity_id: string
  estimated_total?: number
  drawing_approved_afc?: number
  material_arrived?: number
  available_workface?: number
  workface_restricted_material?: number
  workface_restricted_site?: number
  construction_completed?: number
  rfi_completed_a?: number
  rfi_completed_b?: number
  rfi_completed_c?: number
  asbuilt_signed_r0?: number
  asbuilt_signed_r1?: number
  obp_signed?: number
  earliest_start_date?: string
  latest_update_date?: string
  scope?: string
  construction_responsible?: string
  remarks?: string
}

export const volumeControlService = {
  // 获取VolumeControl列表
  async getVolumeControls(params?: {
    activity_id?: string
    scope?: string
    skip?: number
    limit?: number
  }) {
    const response = await api.get('/volume-control/', { params })
    return response.data
  },

  // 获取单个VolumeControl
  async getVolumeControlById(id: number) {
    const response = await api.get(`/volume-control/${id}`)
    return response.data
  },

  // 根据activity_id获取VolumeControl
  async getVolumeControlByActivityId(activity_id: string) {
    const response = await api.get('/volume-control/', { params: { activity_id } })
    return response.data?.[0] || null
  },

  // 更新VolumeControl
  async updateVolumeControl(id: number, entry: Partial<VolumeControlCreate>) {
    const response = await api.put(`/volume-control/${id}`, entry)
    return response.data
  },
}

