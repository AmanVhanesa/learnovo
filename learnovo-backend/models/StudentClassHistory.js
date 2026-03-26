const mongoose = require('mongoose');

const studentClassHistorySchema = new mongoose.Schema({
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
    fromClass: {
        type: String,
        trim: true
    },
    fromSection: {
        type: String,
        trim: true
    },
    toClass: {
        type: String,
        required: true,
        trim: true
    },
    toSection: {
        type: String,
        trim: true
    },
    academicYear: {
        type: String,
        required: true,
        trim: true
    },
    actionType: {
        type: String,
        enum: ['promoted', 'demoted', 'admitted', 'transferred'],
        required: true
    },
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    remarks: {
        type: String,
        trim: true,
        default: ''
    }
}, {
    timestamps: true
});

// Compound index for querying a student's history in a specific tenant quickly
studentClassHistorySchema.index({ tenantId: 1, studentId: 1, createdAt: -1 });

module.exports = mongoose.model('StudentClassHistory', studentClassHistorySchema);
