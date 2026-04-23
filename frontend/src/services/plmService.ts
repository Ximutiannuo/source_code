import api from './api'

export interface Material {
  id: number
  code: string
  name: string
  specification?: string
  unit?: string
  category?: string
  material_type?: string
  drawing_no?: string
  revision?: string
  safety_stock?: number
  current_stock?: number
  reserved_stock?: number
  incoming_stock?: number
  lead_time_days?: number
  description?: string
}

export interface BOMHeader {
  id: number
  product_code: string
  version: string
  bom_type?: string
  status?: string
  description?: string
  is_active: boolean
  material?: Material
}

export interface BOMNode {
  id: number
  material_code: string
  material_name: string
  quantity: number
  unit: string
  level: number
  children: BOMNode[]
}

export const plmService = {
  // 物料管理
  getMaterials: async () => {
    const response = await api.get<Material[]>('/plm/materials')
    return response.data
  },
  
  createMaterial: async (data: Partial<Material>) => {
    const response = await api.post<Material>('/plm/materials', data)
    return response.data
  },

  updateMaterial: async (materialId: number, data: Partial<Material>) => {
    const response = await api.patch<Material>(`/plm/materials/${materialId}`, data)
    return response.data
  },

  // BOM 管理
  getBOMs: async () => {
    const response = await api.get<BOMHeader[]>('/plm/boms')
    return response.data
  },

  expandBOM: async (bomId: number) => {
    const response = await api.get<BOMNode>(`/plm/boms/${bomId}/expand`)
    return response.data
  }
}
