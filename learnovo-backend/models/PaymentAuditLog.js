const mongoose = require('mongoose');

const paymentAuditLogSchema = new mongoose.Schema({
    // Multi-tenant support
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },

    // Core relation
    paymentAttemptId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PaymentAttempt',
        required: true,
        index: true
    },

    // State transitions
    previousStatus: {
        type: String,
        default: null
    },

    newStatus: {
        type: String,
        required: true
    },

    // Traceability
    triggerSource: {
        type: String,
        required: true
    },

    note: {
        type: String,
        trim: true
    },

    createdAt: {
        type: Date,
        default: Date.now,
        index: true,
        immutable: true
    }
}, {
    // Avoid Mongoose updating 'updatedAt' arbitrarily—logs are append-only.
    timestamps: false
});

module.exports = mongoose.model('PaymentAuditLog', paymentAuditLogSchema);
