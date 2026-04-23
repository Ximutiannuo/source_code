import api from './api'

export const activitySyncService = {
  async updateActivity(activityId: string) {
    const response = await api.post(`/activity-sync/update/${activityId}`)
    return response.data
  },

  async batchUpdate(activityIds?: string[]) {
    const response = await api.post('/activity-sync/batch-update', {
      activity_ids: activityIds,
    })
    return response.data
  },
}

