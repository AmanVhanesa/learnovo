const mongoose = require('mongoose');

const paymentAttemptSchema = new mongoose.Schema({
    // Multi-tenant support
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },

    // Idempotency key to prevent double charges
    idempotencyKey: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    invoiceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FeeInvoice',
        required: true,
        index: true
    },

    amount: {
        type: Number,
        required: true,
        min: 0.01
    },

    // Remote reference from the payment gateway (e.g. HDFC/Razorpay order_id or txn_id)
    gatewayRefId: {
        type: String,
        index: true,
        sparse: true
    },

    // Strict State Machine
    status: {
        type: String,
        enum: ['INITIATED', 'PROCESSING', 'SUCCESS', 'FAILED', 'PENDING', 'DISPUTED', 'UNDER_REVIEW', 'VERIFIED'],
        default: 'INITIATED',
        required: true,
        index: true
    },

    // What system interaction caused this attempt to start
    triggerSource: {
        type: String,
        enum: ['STUDENT_PORTAL', 'BACKGROUND_JOB', 'ADMIN_MANUAL', 'API_RETRY'],
        required: true
    },

    // Store full raw responses from the gateway for debugging
    gatewayResponse: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    // Manual payment submission fields (used when gateway is not enabled)
    paymentMode: {
        type: String,
        enum: ['UPI', 'BANK_TRANSFER', 'CASH', 'CHEQUE', 'OTHER', null],
        default: null
    },
    transactionRefId: { type: String, default: null },
    paymentDate: { type: Date, default: null },
    proofScreenshotUrl: { type: String, default: null },

    // Who verified/recorded this payment
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    verifiedAt: { type: Date, default: null }
}, {
    timestamps: true
});

// Indexes to speed up queries for students and cron jobs
paymentAttemptSchema.index({ studentId: 1, invoiceId: 1 });
paymentAttemptSchema.index({ status: 1, createdAt: 1 }); // Great for polling PENDING

module.exports = mongoose.model('PaymentAttempt', paymentAttemptSchema);
