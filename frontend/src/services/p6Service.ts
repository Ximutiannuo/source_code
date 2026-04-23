import api from './api'

export const p6Service = {
  async syncActivities(request: { project_id?: string; project_ids?: string[]; eps_object_id?: number }) {
    const response = await api.post('/p6/sync', {
      sync_type: 'activities',
      ...request,
    })
    return response.data
  },

  async syncWBS(request: { project_id?: string; project_ids?: string[]; eps_object_id?: number }) {
    const response = await api.post('/p6/sync', {
      sync_type: 'wbs',
      ...request,
    })
    return response.data
  },

  async syncResources(request: { project_id?: string; project_ids?: string[]; eps_object_id?: number }) {
    const response = await api.post('/p6/sync', {
      sync_type: 'resources',
      ...request,
    })
    return response.data
  },

  async getSyncLogs(params?: { skip?: number; limit?: number }) {
    const response = await api.get('/p6/sync/logs', { params })
    return response.data
  },

  async getSyncLogById(logId: number) {
    const response = await api.get(`/p6/sync/logs/${logId}`)
    return response.data
  },

  async getP6Status() {
    const response = await api.get('/p6/status')
    return response.data
  },

  async getProjects(epsObjectId?: number) {
    const params = epsObjectId ? { eps_object_id: epsObjectId } : {}
    const response = await api.get('/p6/projects', { params })
    return response.data
  },

  async getEPS() {
    const response = await api.get('/p6/eps')
    return response.data
  },

  async getEPSTree() {
    const response = await api.get('/p6/eps/tree')
    return response.data
  },

  async getOBS() {
    const response = await api.get('/p6/obs')
    return response.data
  },

  async getOBSTree() {
    const response = await api.get('/p6/obs/tree')
    return response.data
  },

  async getEPSActivities(epsName: string) {
    const response = await api.get(`/p6/eps/${encodeURIComponent(epsName)}/activities`)
    return response.data
  },

  async getProjectsActivities(projectIds: string[]) {
    const response = await api.post('/p6/projects/activities', projectIds)
    return response.data
  },

  // 配置相关API
  async getSyncConfig() {
    const response = await api.get('/p6/config')
    return response.data
  },

  async saveSyncConfig(config: {
    default_project_ids: string[]
    global_entities: string[]
    project_entities: string[]
    auto_sync_enabled: boolean
    sync_interval_minutes: number
    delete_detection_enabled: boolean
    delete_detection_time: string
  }) {
    const response = await api.post('/p6/config', config)
    return response.data
  },

  async immediateSync(request?: {
    project_ids?: string[]
    global_entities?: string[]
    project_entities?: string[]
  }) {
    const response = await api.post('/p6/sync/immediate', request || {})
    return response.data
  },

  async resetSync() {
    const response = await api.post('/p6/sync/reset')
    return response.data
  },

  // 调度器相关API
  async getSchedulerStatus() {
    const response = await api.get('/p6/scheduler/status')
    return response.data
  },

  async startScheduler(projectIds?: string[]) {
    // FastAPI 的 List[str] 参数需要作为 query 参数传递，格式为 ?project_ids=value1&project_ids=value2
    const params = new URLSearchParams()
    if (projectIds && projectIds.length > 0) {
      projectIds.forEach(id => params.append('project_ids', id))
    }
    const url = `/p6/scheduler/start${params.toString() ? '?' + params.toString() : ''}`
    const response = await api.post(url)
    return response.data
  },

  async stopScheduler() {
    const response = await api.post('/p6/scheduler/stop')
    return response.data
  },

  // 删除检测相关API
  async triggerDeleteDetection(request?: {
    project_ids?: string[]
    entity_types?: string[]
    wait?: boolean
  }) {
    const response = await api.post('/p6/delete-detection', request || {})
    return response.data
  },

  // 手动触发同步脚本API
  async manualIncrementalSync() {
    const response = await api.post('/p6/sync/manual/incremental')
    return response.data
  },

  async manualDeleteDetection() {
    const response = await api.post('/p6/sync/manual/detect')
    return response.data
  },

  async manualResetSync() {
    const response = await api.post('/p6/sync/manual/reset')
    return response.data
  },
}

