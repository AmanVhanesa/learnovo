const mongoose = require('mongoose');

const paymentDisputeSchema = new mongoose.Schema({
    // Multi-tenant support
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
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

    // Link to specific stuck/failed attempt (optional if disputing unknown charge)
    paymentAttemptId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PaymentAttempt'
    },

    // Raw inputs from student
    transactionId: {
        type: String,
        trim: true
    },

    bankReferenceNumber: {
        type: String,
        trim: true
    },

    amount: {
        type: Number,
        required: true,
        min: 0.01
    },

    // Evidence
    screenshotPath: {
        type: String
    },

    studentNote: {
        type: String,
        required: true,
        trim: true
    },

    // States
    status: {
        type: String,
        enum: ['RAISED', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'],
        default: 'RAISED',
        index: true
    },

    // Resolution
    adminNote: {
        type: String,
        trim: true
    },

    resolvedAt: {
        type: Date
    },

    resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('PaymentDispute', paymentDisputeSchema);
