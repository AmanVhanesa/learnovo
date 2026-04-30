import api from './authService';

const libraryService = {
  // Settings
  getSettings: () => api.get('/library/settings').then(r => r.data),
  updateSettings: (data) => api.put('/library/settings', data).then(r => r.data),

  // Dashboard
  getDashboard: () => api.get('/library/dashboard').then(r => r.data),

  // Categories
  listCategories: () => api.get('/library/categories').then(r => r.data),
  createCategory: (data) => api.post('/library/categories', data).then(r => r.data),
  updateCategory: (id, data) => api.put(`/library/categories/${id}`, data).then(r => r.data),
  deleteCategory: (id) => api.delete(`/library/categories/${id}`).then(r => r.data),

  // Books
  listBooks: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api.get(`/library/books${q ? `?${q}` : ''}`).then(r => r.data);
  },
  getBook: (id) => api.get(`/library/books/${id}`).then(r => r.data),
  createBook: (data) => api.post('/library/books', data).then(r => r.data),
  updateBook: (id, data) => api.put(`/library/books/${id}`, data).then(r => r.data),
  deleteBook: (id) => api.delete(`/library/books/${id}`).then(r => r.data),

  // Copies
  addCopies: (bookId, data) => api.post(`/library/books/${bookId}/copies`, data).then(r => r.data),
  updateCopy: (copyId, data) => api.put(`/library/copies/${copyId}`, data).then(r => r.data),
  retireCopy: (copyId) => api.delete(`/library/copies/${copyId}`).then(r => r.data),

  // Members
  listMembers: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api.get(`/library/members${q ? `?${q}` : ''}`).then(r => r.data);
  },
  enrollMember: (userId) => api.post('/library/members/enroll', { userId }).then(r => r.data),
  updateMember: (id, data) => api.put(`/library/members/${id}`, data).then(r => r.data),
  myLibrary: () => api.get('/library/members/me').then(r => r.data),

  // Issues
  listIssues: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api.get(`/library/issues${q ? `?${q}` : ''}`).then(r => r.data);
  },
  issueBook: (data) => api.post('/library/issues', data).then(r => r.data),
  returnBook: (issueId, data) => api.post(`/library/issues/${issueId}/return`, data).then(r => r.data),
  renewIssue: (issueId) => api.post(`/library/issues/${issueId}/renew`).then(r => r.data),
  sweepOverdue: () => api.post('/library/issues/sweep-overdue').then(r => r.data),

  // Reservations
  listReservations: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api.get(`/library/reservations${q ? `?${q}` : ''}`).then(r => r.data);
  },
  createReservation: (data) => api.post('/library/reservations', data).then(r => r.data),
  cancelReservation: (id) => api.delete(`/library/reservations/${id}`).then(r => r.data),

  // Fines
  listFines: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api.get(`/library/fines${q ? `?${q}` : ''}`).then(r => r.data);
  },
  payFine: (id, data) => api.post(`/library/fines/${id}/pay`, data).then(r => r.data),
  waiveFine: (id, reason) => api.post(`/library/fines/${id}/waive`, { reason }).then(r => r.data),

  // Reports
  mostIssued: (limit = 10) => api.get(`/library/reports/most-issued?limit=${limit}`).then(r => r.data),
  defaulters: () => api.get('/library/reports/defaulters').then(r => r.data),
  inventoryValue: () => api.get('/library/reports/inventory-value').then(r => r.data)
};

export default libraryService;
