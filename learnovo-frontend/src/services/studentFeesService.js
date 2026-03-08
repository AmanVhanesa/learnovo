import api from './authService';

export const studentFeesService = {
    // Get all assigned invoices
    getInvoices: () => api.get('/student-fees'),

    // Get full history of attempts
    getHistory: () => api.get('/student-fees/history'),

    // Get single invoice detail with attempts
    getInvoiceDetails: (id) => api.get(`/student-fees/${id}`),

    // Initiate payment flow
    initiatePayment: (invoiceId) => api.post(`/student-fees/${invoiceId}/pay`),

    // Check attempt status directly
    checkPaymentStatus: (attemptId) => api.get(`/student-fees/payment/${attemptId}/status`),

    // File a dispute
    raiseDispute: (data) => api.post('/student-fees/dispute', data),

    // Get dispute status
    getDispute: (id) => api.get(`/student-fees/dispute/${id}`),

    // Get receipt data
    getReceipt: (id) => api.get(`/student-fees/receipt/${id}`)
};
