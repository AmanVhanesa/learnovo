import api from './authService'

// Fee Structures
export const feeStructuresService = {
  list: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.academicSessionId) params.append('academicSessionId', filters.academicSessionId)
    if (filters.classId) params.append('classId', filters.classId)
    if (filters.isActive !== undefined) params.append('isActive', filters.isActive)

    const url = `/fee-structures${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url)
    return res.data
  },

  get: async (id) => {
    const res = await api.get(`/fee-structures/${id}`)
    return res.data
  },

  create: async (data) => {
    const res = await api.post('/fee-structures', data)
    return res.data
  },

  update: async (id, data) => {
    const res = await api.put(`/fee-structures/${id}`, data)
    return res.data
  },

  delete: async (id) => {
    const res = await api.delete(`/fee-structures/${id}`)
    return res.data
  }
}

// Invoices
export const invoicesService = {
  list: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.studentId) params.append('studentId', filters.studentId)
    if (filters.classId) params.append('classId', filters.classId)
    if (filters.status) params.append('status', filters.status)
    if (filters.academicSessionId) params.append('academicSessionId', filters.academicSessionId)
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)

    const url = `/invoices${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url)
    return res.data
  },

  getStudentInvoices: async (studentId) => {
    const res = await api.get(`/invoices/student/${studentId}`)
    return res.data
  },

  generate: async (data) => {
    const res = await api.post('/invoices/generate', data)
    return res.data
  },

  generateBulk: async (data) => {
    const res = await api.post('/invoices/generate-bulk', data)
    return res.data
  },

  applyLateFee: async (id, amount) => {
    const res = await api.put(`/invoices/${id}/apply-late-fee`, { amount })
    return res.data
  }
}

// Payments
export const paymentsService = {
  list: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.studentId) params.append('studentId', filters.studentId)
    if (filters.invoiceId) params.append('invoiceId', filters.invoiceId)
    if (filters.paymentMethod) params.append('paymentMethod', filters.paymentMethod)
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    if (filters.isConfirmed !== undefined) params.append('isConfirmed', filters.isConfirmed)

    const url = `/payments${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url)
    return res.data
  },

  getStudentPayments: async (studentId) => {
    const res = await api.get(`/payments/student/${studentId}`)
    return res.data
  },

  collect: async (data) => {
    const res = await api.post('/payments', data)
    return res.data
  },

  confirm: async (id) => {
    const res = await api.post(`/payments/${id}/confirm`)
    return res.data
  },

  reverse: async (id, reason) => {
    const res = await api.post(`/payments/${id}/reverse`, { reason })
    return res.data
  },

  getReceipt: async (id) => {
    const res = await api.get(`/payments/receipt/${id}`)
    return res.data
  }
}

// Fees Dashboard & Reports
export const feesReportsService = {
  getDashboard: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.academicSessionId) params.append('academicSessionId', filters.academicSessionId)
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)

    const url = `/fees/dashboard${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url)
    return res.data
  },

  getDefaulters: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.academicSessionId) params.append('academicSessionId', filters.academicSessionId)
    if (filters.classId) params.append('classId', filters.classId)
    if (filters.minBalance) params.append('minBalance', filters.minBalance)

    const url = `/fees/defaulters${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url)
    return res.data
  },

  getCollectionReport: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    if (filters.classId) params.append('classId', filters.classId)
    if (filters.paymentMethod) params.append('paymentMethod', filters.paymentMethod)

    const url = `/fees/collection-report${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url)
    return res.data
  },

  getPendingReport: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.academicSessionId) params.append('academicSessionId', filters.academicSessionId)
    if (filters.classId) params.append('classId', filters.classId)

    const url = `/fees/pending-report${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url)
    return res.data
  },

  getClassWiseReport: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.academicSessionId) params.append('academicSessionId', filters.academicSessionId)

    const url = `/fees/class-wise-report${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url)
    return res.data
  }
}

// Legacy fees service (keep for compatibility)
export const feesService = {
  list: async ({ page = 1, limit = 50, status = '', className = '' } = {}) => {
    const params = new URLSearchParams()
    if (page) params.append('page', page)
    if (limit) params.append('limit', limit)
    if (status) params.append('status', status)
    if (className) params.append('class', className)
    const res = await api.get(`/fees?${params.toString()}`)
    return res.data
  },
  create: async (payload) => {
    const res = await api.post('/fees', payload)
    return res.data
  },
  update: async (id, payload) => {
    const res = await api.put(`/fees/${id}`, payload)
    return res.data
  },
  pay: async (id, payload) => {
    const res = await api.put(`/fees/${id}/pay`, payload)
    return res.data
  },
  remove: async (id) => {
    const res = await api.delete(`/fees/${id}`)
    return res.data
  }
}

export default {
  feeStructures: feeStructuresService,
  invoices: invoicesService,
  payments: paymentsService,
  reports: feesReportsService,
  fees: feesService
}
