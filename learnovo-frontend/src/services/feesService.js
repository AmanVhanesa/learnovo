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
  },

  export: async (params = {}) => {
    const res = await api.get('/fee-structures/export', { params, responseType: 'blob' })
    return res
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
    if (filters.page) params.append('page', filters.page)
    if (filters.limit) params.append('limit', filters.limit)
    if (filters.search) params.append('search', filters.search)

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
    const res = await api.post('/invoices/generate-bulk', data, { timeout: 120000 })
    return res.data
  },

  deleteBulk: async (data) => {
    const res = await api.delete('/invoices/bulk', { data })
    return res.data
  },

  deleteBatch: async (invoiceIds) => {
    const res = await api.delete('/invoices/batch', { data: { invoiceIds } })
    return res.data
  },

  update: async (id, data) => {
    const res = await api.put(`/invoices/${id}`, data)
    return res.data
  },

  applyLateFee: async (id, amount) => {
    const res = await api.put(`/invoices/${id}/apply-late-fee`, { amount })
    return res.data
  },

  delete: async (id) => {
    const res = await api.delete(`/invoices/${id}`)
    return res.data
  },

  // NEW: Cancel invoice with reason
  cancel: async (id, reason) => {
    const res = await api.post(`/invoices/${id}/cancel`, { reason })
    return res.data
  }
}

// Discounts & Waivers
export const discountsService = {
  applyDiscount: async (invoiceId, data) => {
    const res = await api.post(`/invoices/${invoiceId}/discount`, data)
    return res.data
  },

  removeDiscount: async (invoiceId) => {
    const res = await api.delete(`/invoices/${invoiceId}/discount`)
    return res.data
  },

  listDiscounts: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.studentId) params.append('studentId', filters.studentId)
    if (filters.classId) params.append('classId', filters.classId)

    const url = `/fees/discounts${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url)
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
    if (filters.academicSessionId) params.append('academicSessionId', filters.academicSessionId)

    const url = `/invoices/payments${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url)
    return res.data
  },

  getStudentPayments: async (studentId) => {
    const res = await api.get(`/payments/student/${studentId}`)
    return res.data
  },

  collect: async (data) => {
    const res = await api.post('/invoices/collect-payment', data)
    return res.data
  },

  confirm: async (id) => {
    const res = await api.post(`/payments/${id}/confirm`)
    return res.data
  },

  reverse: async (id, reason) => {
    const res = await api.post(`/invoices/payments/${id}/reverse`, { reason })
    return res.data
  },

  update: async (id, data) => {
    const res = await api.put(`/invoices/payments/${id}`, data)
    return res.data
  },

  getReceipt: async (id) => {
    const res = await api.get(`/invoices/payments/${id}/receipt`)
    return res.data
  }
}

// Refunds
export const refundsService = {
  initiate: async (data) => {
    const res = await api.post('/refunds', data)
    return res.data
  },

  list: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.studentId) params.append('studentId', filters.studentId)
    if (filters.status) params.append('status', filters.status)
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)

    const url = `/refunds${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url)
    return res.data
  },

  get: async (id) => {
    const res = await api.get(`/refunds/${id}`)
    return res.data
  },

  approve: async (id) => {
    const res = await api.post(`/refunds/${id}/approve`)
    return res.data
  },

  reject: async (id, reason) => {
    const res = await api.post(`/refunds/${id}/reject`, { reason })
    return res.data
  },

  process: async (id, data) => {
    const res = await api.post(`/refunds/${id}/process`, data)
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
  },

  exportDefaulters: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.academicSessionId) params.append('academicSessionId', filters.academicSessionId)
    if (filters.classId) params.append('classId', filters.classId)
    if (filters.minBalance) params.append('minBalance', filters.minBalance)
    params.append('format', filters.format || 'excel')

    const url = `/fees/defaulters/export?${params.toString()}`
    const res = await api.get(url, { responseType: 'blob' })
    return res.data
  },

  exportReceipts: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    if (filters.paymentMethod) params.append('paymentMethod', filters.paymentMethod)
    params.append('format', filters.format || 'excel')

    const url = `/fees/receipts/export${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url, { responseType: 'blob' })
    return res.data
  },

  exportCollectionReport: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    if (filters.paymentMethod) params.append('paymentMethod', filters.paymentMethod)
    if (filters.classId) params.append('classId', filters.classId)
    params.append('format', filters.format || 'excel')

    const url = `/fees/collection-report/export${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url, { responseType: 'blob' })
    return res.data
  },

  getCollectionSummary: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.period) params.append('period', filters.period)
    if (filters.paymentMethod) params.append('paymentMethod', filters.paymentMethod)
    if (filters.academicSessionId) params.append('academicSessionId', filters.academicSessionId)
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)

    const url = `/fees/collection-summary${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url)
    return res.data
  },

  exportCollectionSummary: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.period) params.append('period', filters.period)
    if (filters.paymentMethod) params.append('paymentMethod', filters.paymentMethod)
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    params.append('format', filters.format || 'excel')

    const url = `/fees/collection-summary/export${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url, { responseType: 'blob' })
    return res.data
  },

  exportReceipts: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.period) params.append('period', filters.period)
    if (filters.paymentMethod) params.append('paymentMethod', filters.paymentMethod)
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    params.append('format', filters.format || 'excel')

    const url = `/fees/receipts/export${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url, { responseType: 'blob' })
    return res.data
  }
}

// Annual Fee Allocations
export const allocationsService = {
  list: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.studentId) params.append('studentId', filters.studentId)
    if (filters.classId) params.append('classId', filters.classId)
    if (filters.academicSessionId) params.append('academicSessionId', filters.academicSessionId)
    if (filters.status) params.append('status', filters.status)
    if (filters.page) params.append('page', filters.page)
    if (filters.limit) params.append('limit', filters.limit)

    const url = `/fees/allocations${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url)
    return res.data
  },

  get: async (id) => {
    const res = await api.get(`/fees/allocations/${id}`)
    return res.data
  },

  generate: async (data) => {
    const res = await api.post('/fees/allocations/generate', data, { timeout: 120000 })
    return res.data
  },

  generateInvoices: async (data) => {
    const res = await api.post('/fees/allocations/generate-invoices', data, { timeout: 120000 })
    return res.data
  },

  // NEW: Generate allocations + invoices in one step
  generateAll: async (data) => {
    const res = await api.post('/fees/allocations/generate-all', data, { timeout: 120000 })
    return res.data
  },

  // NEW: Generate for a single student (auto-detects fee structure)
  generateSingle: async (data) => {
    const res = await api.post('/fees/allocations/generate-single', data)
    return res.data
  },

  // NEW: Preview invoice generation (dry run)
  preview: async (data) => {
    const res = await api.post('/fees/allocations/preview', data)
    return res.data
  },

  changePaymentPlan: async (id, paymentPlan) => {
    const res = await api.put(`/fees/allocations/${id}/payment-plan`, { paymentPlan })
    return res.data
  },

  cancel: async (id, reason, terminateType) => {
    const res = await api.put(`/fees/allocations/${id}/cancel`, { reason, terminateType })
    return res.data
  },

  applyDiscount: async (id, data) => {
    const res = await api.put(`/fees/allocations/${id}/discount`, data)
    return res.data
  },

  getDashboardSummary: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.academicSessionId) params.append('academicSessionId', filters.academicSessionId)

    const url = `/fees/allocations/dashboard/summary${params.toString() ? `?${params.toString()}` : ''}`
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
  discounts: discountsService,
  payments: paymentsService,
  refunds: refundsService,
  reports: feesReportsService,
  allocations: allocationsService,
  fees: feesService
}
