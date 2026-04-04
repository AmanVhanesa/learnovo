import api from './authService';

/** Build query string with optional childId for parent access */
const childParam = (childId) => childId ? `?childId=${childId}` : '';
const childParamAnd = (childId) => childId ? `&childId=${childId}` : '';

export const studentFeesService = {
    // Check if online payment gateway is enabled for this tenant
    getGatewayStatus: () => api.get('/student-fees/gateway-status'),

    // Get all assigned invoices
    getInvoices: (childId) => api.get(`/student-fees${childParam(childId)}`),

    // Get full history of attempts
    getHistory: (childId) => api.get(`/student-fees/history${childParam(childId)}`),

    // Get single invoice detail with attempts
    getInvoiceDetails: (id, childId) => api.get(`/student-fees/${id}${childParam(childId)}`),

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
    checkPaymentStatus: (attemptId, childId) => api.get(`/student-fees/payment/${attemptId}/status${childParam(childId)}`),

    // File a dispute
    raiseDispute: (data) => api.post('/student-fees/dispute', data),

    // Get dispute status
    getDispute: (id, childId) => api.get(`/student-fees/dispute/${id}${childParam(childId)}`),

    // Get receipt data (by receipt ID or paymentAttemptId)
    getReceipt: (id, childId) => api.get(`/student-fees/receipt/${id}${childParam(childId)}`),

    // Get all receipts for the logged-in student
    getReceipts: (childId) => api.get(`/student-fees/receipts${childParam(childId)}`),

    // Request a refund (student-initiated)
    requestRefund: (data) => api.post('/student-fees/refund-request', data),

    // Get refund status
    getRefunds: () => api.get('/student-fees/refunds')
};
