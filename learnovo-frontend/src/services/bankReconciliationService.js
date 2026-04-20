import api from './authService';

const bankReconciliationService = {
  uploadFile: async (file, source = 'GENERIC') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('source', source);
    const res = await api.post('/bank-reconciliation/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  listBatches: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    const res = await api.get(`/bank-reconciliation?${query.toString()}`);
    return res.data;
  },

  getBatch: async (batchId) => {
    const res = await api.get(`/bank-reconciliation/${batchId}`);
    return res.data;
  },

  confirmRow: async (batchId, rowId, payload = {}) => {
    const res = await api.post(`/bank-reconciliation/${batchId}/rows/${rowId}/confirm`, payload);
    return res.data;
  },

  ignoreRow: async (batchId, rowId, note = '') => {
    const res = await api.post(`/bank-reconciliation/${batchId}/rows/${rowId}/ignore`, { note });
    return res.data;
  },

  closeBatch: async (batchId) => {
    const res = await api.post(`/bank-reconciliation/${batchId}/close`);
    return res.data;
  },
};

export default bankReconciliationService;
