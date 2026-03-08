const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
    // Multi-tenant support
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },

    // Driver Identification
    driverId: {
        type: String,
        required: true,
        trim: true,
        index: true
    },

    // Basic Information
    name: {
        type: String,
        required: [true, 'Driver name is required'],
        trim: true
    },

    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        trim: true,
        validate: {
            validator: function (v) {
                return /^[\+]?[1-9][\d]{5,15}$/.test(v);
            },
            message: 'Please enter a valid phone number'
        }
    },

    email: {
        type: String,
        trim: true,
        lowercase: true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },

    // License Information
    licenseNumber: {
        type: String,
        required: [true, 'License number is required'],
        trim: true,
        uppercase: true
    },

    licenseExpiry: {
        type: Date,
        required: [true, 'License expiry date is required'],
        validate: {
            validator: function (v) {
                return v > new Date();
            },
            message: 'License expiry date must be in the future'
        }
    },

    licenseType: {
        type: String,
        enum: ['LMV', 'HMV', 'MCWG', 'MCWOG', 'Other'],
        default: 'LMV',
        trim: true
    },

    // Personal Details
    dateOfBirth: {
        type: Date,
        validate: {
            validator: function (v) {
                if (!v) return true;
                const age = Math.floor((new Date() - v) / (365.25 * 24 * 60 * 60 * 1000));
                return age >= 21;
            },
            message: 'Driver must be at least 21 years old'
        }
    },

    gender: {
        type: String,
        enum: ['male', 'female', 'other', ''],
        default: ''
    },

    bloodGroup: {
        type: String,
        enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', ''],
        default: ''
    },

    address: {
        type: String,
        trim: true
    },

    nationalId: {
        type: String,
        trim: true
    },

    // Employment Details
    dateOfJoining: {
        type: Date,
        default: Date.now
    },

    salary: {
        type: Number,
        min: 0
    },

    experience: {
        type: Number, // years
        min: 0
    },

    // Emergency Contact
    emergencyContact: {
        name: {
            type: String,
            trim: true
        },
        phone: {
            type: String,
            trim: true
        },
        relation: {
            type: String,
            trim: true
        }
    },

    // Documents and Media
    photo: {
        type: String, // URL to photo
        default: null
    },

    documents: [{
        type: {
            type: String,
            enum: ['License', 'Aadhaar', 'PAN', 'Police Verification', 'Medical Certificate', 'Other'],
            required: true
        },
        url: {
            type: String,
            required: true
        },
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],

    // Status Management
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },

    inactiveReason: {
        type: String,
        trim: true
    },

    inactivatedAt: {
        type: Date
    },

    // Additional Information
    notes: {
        type: String,
        trim: true
    },

    // Audit Fields
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Compound Indexes for uniqueness per tenant
driverSchema.index({ tenantId: 1, driverId: 1 }, { unique: true });
driverSchema.index({ tenantId: 1, phone: 1 }, { unique: true });
driverSchema.index({ tenantId: 1, licenseNumber: 1 }, { unique: true });
driverSchema.index({ tenantId: 1, isActive: 1 });

// Index for email (optional field, so sparse)
driverSchema.index(
    { tenantId: 1, email: 1 },
    { unique: true, sparse: true, partialFilterExpression: { email: { $exists: true, $ne: '' } } }
);

// Virtual for age calculation
driverSchema.virtual('age').get(function () {
    if (!this.dateOfBirth) return null;
    return Math.floor((new Date() - this.dateOfBirth) / (365.25 * 24 * 60 * 60 * 1000));
});

// Method to check if license is expiring soon
driverSchema.methods.isLicenseExpiringSoon = function (days = 30) {
    const daysUntilExpiry = Math.floor((this.licenseExpiry - new Date()) / (24 * 60 * 60 * 1000));
    return daysUntilExpiry <= days && daysUntilExpiry > 0;
};

// Method to check if license is expired
driverSchema.methods.isLicenseExpired = function () {
    return this.licenseExpiry < new Date();
};

// Pre-save middleware to set inactivatedAt
driverSchema.pre('save', function (next) {
    if (this.isModified('isActive') && !this.isActive && !this.inactivatedAt) {
        this.inactivatedAt = new Date();
    }
    next();
});

module.exports = mongoose.model('Driver', driverSchema);
