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
  product_family?: string | null
  business_unit?: string | null
  project_code?: string | null
  plant_code?: string | null
  discipline?: string | null
  source_system?: string | null
  source_file?: string | null
  sync_status?: string | null
  cad_document_no?: string | null
  released_by?: string | null
  last_synced_at?: string | null
  material?: Material | null
}

export interface BOMItem {
  id?: number
  parent_item_code?: string | null
  child_item_code: string
  quantity: number
  component_type?: string | null
  routing_link?: string | null
  find_number?: string | null
  item_level: number
  item_category?: string | null
  procurement_type?: string | null
  loss_rate: number
  unit_price: number
  total_price: number
  source_reference?: string | null
  material?: Material | null
}

export interface BOMDetail extends BOMHeader {
  items: BOMItem[]
  statistics: {
    item_count: number
    leaf_count: number
    estimated_total_cost: number
  }
}

export interface BOMNode {
  id: number
  material_code: string
  material_name: string
  quantity: number
  unit: string
  level: number
  find_number?: string | null
  component_type?: string | null
  routing_link?: string | null
  item_category?: string | null
  procurement_type?: string | null
  loss_rate: number
  unit_price: number
  total_price: number
  source_reference?: string | null
  children: BOMNode[]
}

export interface BOMSavePayload {
  id?: number
  product_code: string
  product_name?: string
  version: string
  bom_type: string
  status: string
  description?: string
  is_active: boolean
  product_family?: string
  business_unit?: string
  project_code?: string
  plant_code?: string
  discipline?: string
  source_system?: string
  source_file?: string
  sync_status?: string
  cad_document_no?: string
  items: Array<{
    parent_item_code?: string | null
    child_item_code: string
    quantity: number
    component_type?: string
    routing_link?: string
    find_number?: string
    item_level?: number | null
    item_category?: string
    procurement_type?: string
    loss_rate?: number
    unit_price?: number
    total_price?: number | null
    source_reference?: string
    material_name?: string
    specification?: string
    unit?: string
    drawing_no?: string
    revision?: string
  }>
}

export interface BOMImportResult {
  imported: number
  errors: number
  items_total: number
  boms: Array<{
    id: number
    product_code: string
    version: string
    bom_type: string
  }>
  error_details: Array<{
    row: number | string
    error: string
  }>
}

export const plmService = {
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

  getBOMs: async (params?: { bom_type?: string; source_system?: string; project_code?: string }) => {
    const response = await api.get<BOMHeader[]>('/plm/boms', { params })
    return response.data
  },

  getBOMDetail: async (bomId: number) => {
    const response = await api.get<BOMDetail>(`/plm/boms/${bomId}/detail`)
    return response.data
  },

  saveBOM: async (data: BOMSavePayload) => {
    const response = await api.post<BOMDetail>('/plm/boms', data)
    return response.data
  },

  updateBOM: async (bomId: number, data: BOMSavePayload) => {
    const response = await api.patch<BOMDetail>(`/plm/boms/${bomId}`, data)
    return response.data
  },

  expandBOM: async (bomId: number) => {
    const response = await api.get<BOMNode>(`/plm/boms/${bomId}/expand`)
    return response.data
  },

  exportBOMs: async (params?: { bom_type?: string; source_system?: string; project_code?: string }) => {
    return api.get('/plm/boms-export', {
      params,
      responseType: 'blob',
    })
  },

  importBOMs: async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post<BOMImportResult>('/plm/boms-import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  syncBOMFromCAD: async (data: BOMSavePayload) => {
    const response = await api.post<BOMDetail>('/plm/boms/cad-sync', data)
    return response.data
  },
}
