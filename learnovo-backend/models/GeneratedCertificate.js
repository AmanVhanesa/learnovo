const mongoose = require('mongoose');

const generatedCertificateSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['TC', 'BONAFIDE'],
        required: true
    },
    certificateNumber: {
        type: String,
        required: true,
        trim: true
    },
    academicYear: {
        type: String,
        required: true,
        trim: true
    },
    issueDate: {
        type: Date,
        default: Date.now,
        required: true
    },
    issuedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'CANCELLED'],
        default: 'ACTIVE'
    },
    // Snapshot of data at the time of generation for audit purposes
    contentSnapshot: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    remarks: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Indexes
generatedCertificateSchema.index({ tenantId: 1, certificateNumber: 1 }, { unique: true });
generatedCertificateSchema.index({ tenantId: 1, type: 1, student: 1 });

module.exports = mongoose.model('GeneratedCertificate', generatedCertificateSchema);
