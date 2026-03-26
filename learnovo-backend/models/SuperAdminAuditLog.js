const mongoose = require('mongoose');

const superAdminAuditLogSchema = new mongoose.Schema({
    superAdminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SuperAdmin',
        required: true,
        index: true
    },
    action: {
        type: String,
        required: true,
        trim: true
        // e.g. 'SUSPEND_TENANT', 'CHANGE_PLAN', 'OVERRIDE_FEATURES', 'EXTEND_TRIAL',
        //      'ACTIVATE_TENANT', 'DELETE_TENANT', 'RESET_USER_PASSWORD', 'DEACTIVATE_USER'
    },
    targetType: {
        type: String,
        required: true,
        enum: ['Tenant', 'User', 'SuperAdmin'],
        trim: true
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },
    changes: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    ip: {
        type: String,
        trim: true
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
});

// TTL index — auto-delete audit logs after 2 years (optional, can be removed)
superAdminAuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 63072000 });

module.exports = mongoose.model('SuperAdminAuditLog', superAdminAuditLogSchema);
