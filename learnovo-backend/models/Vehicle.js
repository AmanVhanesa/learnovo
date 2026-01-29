const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
    // Multi-tenant support
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },

    // Vehicle Identification
    vehicleId: {
        type: String,
        required: true,
        trim: true,
        index: true
    },

    vehicleNumber: {
        type: String,
        required: [true, 'Vehicle number is required'],
        trim: true,
        uppercase: true
    },

    // Vehicle Details
    vehicleType: {
        type: String,
        enum: ['Bus', 'Van', 'Car', 'Auto', 'Tempo', 'Other'],
        required: [true, 'Vehicle type is required']
    },

    model: {
        type: String,
        trim: true
    },

    manufacturingYear: {
        type: Number,
        min: 1980,
        max: new Date().getFullYear() + 1,
        validate: {
            validator: function (v) {
                if (!v) return true;
                return v <= new Date().getFullYear() + 1;
            },
            message: 'Manufacturing year cannot be in the future'
        }
    },

    color: {
        type: String,
        trim: true
    },

    capacity: {
        type: Number,
        required: [true, 'Seating capacity is required'],
        min: [1, 'Capacity must be at least 1']
    },

    fuelType: {
        type: String,
        enum: ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid', 'Other'],
        default: 'Diesel'
    },

    // Legal Documents
    insuranceNumber: {
        type: String,
        trim: true
    },

    insuranceExpiry: {
        type: Date,
        required: [true, 'Insurance expiry date is required'],
        validate: {
            validator: function (v) {
                return v > new Date();
            },
            message: 'Insurance expiry date must be in the future'
        }
    },

    fitnessExpiry: {
        type: Date,
        required: [true, 'Fitness certificate expiry date is required'],
        validate: {
            validator: function (v) {
                return v > new Date();
            },
            message: 'Fitness certificate expiry date must be in the future'
        }
    },

    pollutionExpiry: {
        type: Date,
        required: [true, 'Pollution certificate expiry date is required'],
        validate: {
            validator: function (v) {
                return v > new Date();
            },
            message: 'Pollution certificate expiry date must be in the future'
        }
    },

    // Driver Assignment
    assignedDriver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Driver',
        default: null,
        index: true
    },

    // Documents and Media
    photo: {
        type: String, // URL to photo
        default: null
    },

    documents: [{
        type: {
            type: String,
            enum: ['RC', 'Insurance', 'Fitness Certificate', 'Pollution Certificate', 'Permit', 'Other'],
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

    // Maintenance (for future enhancement)
    lastMaintenanceDate: {
        type: Date
    },

    nextMaintenanceDate: {
        type: Date
    },

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
vehicleSchema.index({ tenantId: 1, vehicleId: 1 }, { unique: true });
vehicleSchema.index({ tenantId: 1, vehicleNumber: 1 }, { unique: true });
vehicleSchema.index({ tenantId: 1, isActive: 1 });
vehicleSchema.index({ tenantId: 1, assignedDriver: 1 });
vehicleSchema.index({ tenantId: 1, vehicleType: 1 });

// Method to check if any document is expiring soon
vehicleSchema.methods.hasExpiringDocuments = function (days = 30) {
    const now = new Date();
    const checkDate = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000));

    return (
        this.insuranceExpiry <= checkDate ||
        this.fitnessExpiry <= checkDate ||
        this.pollutionExpiry <= checkDate
    );
};

// Method to check if any document is expired
vehicleSchema.methods.hasExpiredDocuments = function () {
    const now = new Date();

    return (
        this.insuranceExpiry < now ||
        this.fitnessExpiry < now ||
        this.pollutionExpiry < now
    );
};

// Method to get expiring documents list
vehicleSchema.methods.getExpiringDocuments = function (days = 30) {
    const now = new Date();
    const checkDate = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000));
    const expiring = [];

    if (this.insuranceExpiry <= checkDate && this.insuranceExpiry > now) {
        expiring.push({
            type: 'Insurance',
            expiryDate: this.insuranceExpiry,
            daysRemaining: Math.floor((this.insuranceExpiry - now) / (24 * 60 * 60 * 1000))
        });
    }

    if (this.fitnessExpiry <= checkDate && this.fitnessExpiry > now) {
        expiring.push({
            type: 'Fitness Certificate',
            expiryDate: this.fitnessExpiry,
            daysRemaining: Math.floor((this.fitnessExpiry - now) / (24 * 60 * 60 * 1000))
        });
    }

    if (this.pollutionExpiry <= checkDate && this.pollutionExpiry > now) {
        expiring.push({
            type: 'Pollution Certificate',
            expiryDate: this.pollutionExpiry,
            daysRemaining: Math.floor((this.pollutionExpiry - now) / (24 * 60 * 60 * 1000))
        });
    }

    return expiring;
};

// Pre-save middleware to set inactivatedAt
vehicleSchema.pre('save', function (next) {
    if (this.isModified('isActive') && !this.isActive && !this.inactivatedAt) {
        this.inactivatedAt = new Date();
    }
    next();
});

module.exports = mongoose.model('Vehicle', vehicleSchema);
