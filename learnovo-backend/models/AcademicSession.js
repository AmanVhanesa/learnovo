const mongoose = require('mongoose');

const academicSessionSchema = new mongoose.Schema({
    // Multi-tenant support
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },

    // Session Details
    name: {
        type: String,
        required: true,
        trim: true // e.g., "2024-2025"
    },

    startDate: {
        type: Date,
        required: true
    },

    endDate: {
        type: Date,
        required: true
    },

    // Status
    isActive: {
        type: Boolean,
        default: false
    },

    isLocked: {
        type: Boolean,
        default: false // Locked sessions cannot be modified
    },

    // Metadata
    description: {
        type: String,
        trim: true
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Indexes
academicSessionSchema.index({ tenantId: 1, name: 1 }, { unique: true });
academicSessionSchema.index({ tenantId: 1, isActive: 1 });

// Validation: Start date must be before end date
academicSessionSchema.pre('validate', function (next) {
    if (this.startDate && this.endDate && this.startDate >= this.endDate) {
        next(new Error('Start date must be before end date'));
    } else {
        next();
    }
});

// Validation: Only one active session per tenant
academicSessionSchema.pre('save', async function (next) {
    if (this.isActive && (this.isNew || this.isModified('isActive'))) {
        const existingActive = await this.constructor.findOne({
            tenantId: this.tenantId,
            isActive: true,
            _id: { $ne: this._id }
        });

        if (existingActive) {
            next(new Error('Another academic session is already active. Please deactivate it first.'));
        } else {
            next();
        }
    } else {
        next();
    }
});

// Method to activate session
academicSessionSchema.methods.activate = async function () {
    // Deactivate all other sessions for this tenant
    await this.constructor.updateMany(
        { tenantId: this.tenantId, _id: { $ne: this._id } },
        { $set: { isActive: false } }
    );

    this.isActive = true;
    return this.save();
};

// Method to lock session
academicSessionSchema.methods.lock = function () {
    this.isLocked = true;
    return this.save();
};

// Method to unlock session
academicSessionSchema.methods.unlock = function () {
    this.isLocked = false;
    return this.save();
};

module.exports = mongoose.model('AcademicSession', academicSessionSchema);
