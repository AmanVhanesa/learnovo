const mongoose = require('mongoose');

const subDepartmentSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: [true, 'Sub Department name is required'],
        trim: true,
        uppercase: true
    },
    description: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Unique name per tenant
subDepartmentSchema.index({ tenantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('SubDepartment', subDepartmentSchema);
