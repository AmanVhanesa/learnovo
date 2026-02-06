import api from './authService'

export const settingsService = {
  // Get system settings
  getSettings: async () => {
    const response = await api.get('/settings')
    return response.data
  },

  // Upload school logo
  uploadLogo: async (formData) => {
    const response = await api.post('/settings/upload-logo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data
  },

  // Upload principal signature
  uploadSignature: async (formData) => {
    const response = await api.post('/settings/upload-signature', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data
  },

  // Update system settings
  updateSettings: async (settingsData) => {
    const response = await api.put('/settings', settingsData)
    return response.data
  },

  // Update admission settings
  updateAdmissionSettings: async (admissionData) => {
    const response = await api.put('/settings/admission', admissionData)
    return response.data
  },

  // Update currency settings
  updateCurrency: async (currencyData) => {
    const response = await api.put('/settings/currency', currencyData)
    return response.data
  },

  // Get supported currencies
  getCurrencies: async () => {
    const response = await api.get('/settings/currencies')
    return response.data
  },

  // Add new class
  addClass: async (classData) => {
    const response = await api.post('/settings/classes', classData)
    return response.data
  },

  // Add new subject
  addSubject: async (subjectData) => {
    const response = await api.post('/settings/subjects', subjectData)
    return response.data
  },

  // Add fee structure
  addFeeStructure: async (feeStructureData) => {
    const response = await api.post('/settings/fee-structure', feeStructureData)
    return response.data
  },

  // Update notification settings
  updateNotifications: async (notificationData) => {
    const response = await api.put('/settings/notifications', notificationData)
    return response.data
  },

  // Update system settings
  updateSystem: async (systemData) => {
    const response = await api.put('/settings/system', systemData)
    return response.data
  },

  // Update theme settings
  updateTheme: async (themeData) => {
    const response = await api.put('/settings/theme', themeData)
    return response.data
  }
}
