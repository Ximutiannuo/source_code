import api from './api'

export const importService = {
  async importMPDB(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post('/import/mpdb/excel', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  async importVFACTDB(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post('/import/vfactdb/excel', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  async downloadMPDBTemplate() {
    const response = await api.get('/import/template/mpdb', {
      responseType: 'blob',
    })
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'mpdb_template.xlsx')
    document.body.appendChild(link)
    link.click()
    link.remove()
  },

  async downloadVFACTDBTemplate() {
    const response = await api.get('/import/template/vfactdb', {
      responseType: 'blob',
    })
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'vfactdb_template.xlsx')
    document.body.appendChild(link)
    link.click()
    link.remove()
  },

  async downloadVFACTDBWeeklyDistributeTemplate() {
    const response = await api.get('/import/template/vfactdb/weekly-distribute', {
      responseType: 'blob',
    })
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'vfactdb_weekly_distribute_template.xlsx')
    document.body.appendChild(link)
    link.click()
    link.remove()
  },

  async importVFACTDBWeeklyDistribute(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post('/import/vfactdb/weekly-distribute/excel', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  async downloadVFACTDBBatchAdjustTemplate() {
    const response = await api.get('/import/template/vfactdb/batch-adjust', {
      responseType: 'blob',
    })
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'vfactdb_batch_adjust_template.xlsx')
    document.body.appendChild(link)
    link.click()
    link.remove()
  },

  async importVFACTDBBatchAdjust(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post('/import/vfactdb/batch-adjust/excel', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },
}

