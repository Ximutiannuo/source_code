import api from './api'

export interface P6WBSNode {
  id: number | null
  object_id: number | null
  name: string | null
  code: string | null
  project_object_id: number
  project_id: string | null
  parent_object_id: number | null
  level: number | null
  sequence_number: number | null
  is_active: boolean
  created_at: string | null
  updated_at: string | null
  last_sync_at: string | null
  children: P6WBSNode[]
  is_project_node?: boolean  // 标记是否为项目节点
}

export const p6WbsService = {
  async getWbsTree(params?: { project_object_id?: number; project_id?: string }) {
    const response = await api.get('/p6-wbs/tree', { params })
    return response.data as P6WBSNode[]
  },

  async getWbsList(params?: {
    project_object_id?: number
    project_id?: string
    parent_object_id?: number
    skip?: number
    limit?: number
  }) {
    const response = await api.get('/p6-wbs/list', { params })
    return response.data
  },
}

