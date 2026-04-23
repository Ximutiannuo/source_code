import api from './api'

export const weightService = {
  async calculateWeights(project?: string) {
    const response = await api.post('/weight/calculate', null, {
      params: project ? { project } : undefined,
    })
    return response.data
  },

  async calculateProgress(params?: {
    start_date?: string
    end_date?: string
  }) {
    const response = await api.get('/weight/progress', { params })
    return response.data
  },
}

