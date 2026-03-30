import api from './authService';

export const studentFeesService = {
    // Check if online payment gateway is enabled for this tenant
    getGatewayStatus: () => api.get('/student-fees/gateway-status'),

    // Get all assigned invoices
    getInvoices: () => api.get('/student-fees'),

    // Get full history of attempts
    getHistory: () => api.get('/student-fees/history'),

    // Get single invoice detail with attempts
    getInvoiceDetails: (id) => api.get(`/student-fees/${id}`),

    // Initiate payment flow (gateway mode)
    initiatePayment: (invoiceId) => api.post(`/student-fees/${invoiceId}/pay`),

    // Pay multiple invoices in one transaction (gateway mode)
    initiateCombinedPayment: (invoiceIds) => api.post('/student-fees/pay-combined', { invoiceIds }),

    // Verify Razorpay payment (popup callback)
    verifyRazorpayPayment: (data) => api.post('/student-fees/payment/razorpay-verify', data),

    // Submit manual payment proof (manual mode — when gateway is not enabled)
    submitManualPayment: (invoiceId, data) => api.post(`/student-fees/${invoiceId}/submit-payment`, data),

    // Submit manual payment proof for multiple invoices
    submitCombinedManualPayment: (invoiceIds, data) => api.post('/student-fees/submit-payment-combined', { invoiceIds, ...data }),

    // Check attempt status directly
    checkPaymentStatus: (attemptId) => api.get(`/student-fees/payment/${attemptId}/status`),

    // File a dispute
    raiseDispute: (data) => api.post('/student-fees/dispute', data),

    // Get dispute status
    getDispute: (id) => api.get(`/student-fees/dispute/${id}`),

    // Get receipt data (by receipt ID or paymentAttemptId)
    getReceipt: (id) => api.get(`/student-fees/receipt/${id}`),

    // Get all receipts for the logged-in student
    getReceipts: () => api.get('/student-fees/receipts'),

    // Request a refund (student-initiated)
    requestRefund: (data) => api.post('/student-fees/refund-request', data),

    // Get refund status
    getRefunds: () => api.get('/student-fees/refunds')
};
