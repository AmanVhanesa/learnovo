import api from './authService';

const circularsService = {
    getCirculars: async (params = {}) => {
        const response = await api.get('/circulars', { params });
        return response.data;
    },
    getCircular: async (id) => {
        const response = await api.get(`/circulars/${id}`);
        return response.data;
    },
    createCircular: async (data) => {
        const response = await api.post('/circulars', data);
        return response.data;
    },
    updateCircular: async (id, updates) => {
        const response = await api.put(`/circulars/${id}`, updates);
        return response.data;
    },
    deleteCircular: async (id) => {
        const response = await api.delete(`/circulars/${id}`);
        return response.data;
    },
    downloadCircularPdf: async (id) => {
        const response = await api.get(`/circulars/${id}/pdf`, { responseType: 'blob' });
        return response.data;
    }
};

export default circularsService;
