import api from './authService';

export const adminDisputesService = {
    // Get all active disputes and stuck payments
    getDisputes: () => api.get('/admin-disputes'),

    // Resolve or reject a dispute
    resolveDispute: (id, resolutionAction, adminNote) =>
        api.post(`/admin-disputes/${id}/resolve`, { resolutionAction, adminNote })
};
