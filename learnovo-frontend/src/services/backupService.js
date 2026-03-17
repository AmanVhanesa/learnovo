import api from './authService'

export const backupService = {
  // Download backup to browser (also uploads to Drive in background)
  downloadBackup: async () => {
    const response = await api.post('/admin/backup', {}, {
      responseType: 'blob',
      timeout: 120000
    })
    return response
  },

  // Backup directly to Google Drive (no download)
  backupToCloud: async () => {
    const response = await api.post('/admin/backup/cloud', {}, { timeout: 120000 })
    return response.data
  },

  // Get Google Drive backup status
  getCloudStatus: async () => {
    const response = await api.get('/admin/backup/cloud/status')
    return response.data
  },

  // Restore from Google Drive
  restoreFromCloud: async (confirmation) => {
    const response = await api.post('/admin/backup/cloud/restore', { confirmation }, { timeout: 120000 })
    return response.data
  },

  // Restore from uploaded file
  restore: async (backupData, confirmation) => {
    const response = await api.post('/admin/restore', { backupData, confirmation }, { timeout: 120000 })
    return response.data
  },

  // Get backup history
  getHistory: async () => {
    const response = await api.get('/admin/backup/history')
    return response.data
  },

  // Get last backup info
  getLastBackup: async () => {
    const response = await api.get('/admin/backup/last')
    return response.data
  }
}
