const mongoose = require('mongoose');

const feeAuditLogSchema = new mongoose.Schema({
    // Multi-tenant support
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },

    // Action Details
    action: {
        type: String,
        required: true,
        enum: [
            'FEE_STRUCTURE_CREATED',
            'FEE_STRUCTURE_UPDATED',
            'FEE_STRUCTURE_DEACTIVATED',
            'INVOICE_GENERATED',
            'INVOICE_BULK_GENERATED',
            'INVOICE_CANCELLED',
            'LATE_FEE_APPLIED',
            'PAYMENT_COLLECTED',
            'PAYMENT_CONFIRMED',
            'PAYMENT_REVERSED',
            'BALANCE_UPDATED',
            'BALANCE_CARRY_FORWARD'
        ],
        index: true
    },

    // Entity Reference
    entityType: {
        type: String,
        required: true,
        enum: ['FeeStructure', 'FeeInvoice', 'Payment', 'StudentBalance'],
        index: true
    },

    entityId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },

    // User Details
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    userName: {
        type: String,
        required: true
    },

    userRole: {
        type: String,
        required: true
    },

    // Additional Context
    details: {
        type: mongoose.Schema.Types.Mixed // Flexible JSON for before/after states, amounts, etc.
    },

    // Request Info
    ipAddress: {
        type: String
    },

    userAgent: {
        type: String
    },

    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: false // We use custom timestamp field
});

// Indexes
feeAuditLogSchema.index({ tenantId: 1, timestamp: -1 });
feeAuditLogSchema.index({ tenantId: 1, entityType: 1, entityId: 1 });
feeAuditLogSchema.index({ tenantId: 1, userId: 1, timestamp: -1 });
feeAuditLogSchema.index({ tenantId: 1, action: 1, timestamp: -1 });

// Static method to log action
feeAuditLogSchema.statics.logAction = async function (data) {
    const log = new this({
        tenantId: data.tenantId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        userId: data.userId,
        userName: data.userName,
        userRole: data.userRole,
        details: data.details,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        timestamp: new Date()
    });

    return log.save();
};

// Static method to get audit trail for an entity
feeAuditLogSchema.statics.getEntityAuditTrail = async function (tenantId, entityType, entityId) {
    return this.find({
        tenantId,
        entityType,
        entityId
    })
        .sort({ timestamp: -1 })
        .limit(100);
};

// Static method to get user activity
feeAuditLogSchema.statics.getUserActivity = async function (tenantId, userId, options = {}) {
    const query = { tenantId, userId };

    if (options.startDate) {
        query.timestamp = { $gte: options.startDate };
    }

    if (options.endDate) {
        query.timestamp = query.timestamp || {};
        query.timestamp.$lte = options.endDate;
    }

    if (options.action) {
        query.action = options.action;
    }

    return this.find(query)
        .sort({ timestamp: -1 })
        .limit(options.limit || 100);
};

module.exports = mongoose.model('FeeAuditLog', feeAuditLogSchema);
