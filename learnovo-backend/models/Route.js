const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema({
    // Multi-tenant support
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },

    // Route Identification
    routeId: {
        type: String,
        required: true,
        trim: true,
        index: true
    },

    routeName: {
        type: String,
        required: [true, 'Route name is required'],
        trim: true
    },

    routeCode: {
        type: String,
        trim: true,
        uppercase: true
    },

    // Route Stops
    stops: [{
        stopName: {
            type: String,
            required: true,
            trim: true
        },
        stopOrder: {
            type: Number,
            required: true,
            min: 1
        },
        pickupTime: {
            type: String, // Format: "07:30 AM"
            trim: true
        },
        dropTime: {
            type: String, // Format: "03:00 PM"
            trim: true
        },
        landmark: {
            type: String,
            trim: true
        },
        latitude: {
            type: Number,
            min: -90,
            max: 90
        },
        longitude: {
            type: Number,
            min: -180,
            max: 180
        }
    }],

    // Vehicle and Driver Assignment
    assignedVehicle: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vehicle',
        default: null,
        index: true
    },

    assignedDriver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Driver',
        default: null,
        index: true
    },

    // Route Details
    distance: {
        type: Number, // in kilometers
        min: 0
    },

    estimatedDuration: {
        type: Number, // in minutes
        min: 0
    },

    monthlyFee: {
        type: Number,
        required: [true, 'Monthly transport fee is required'],
        min: 0
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

// Compound Indexes
routeSchema.index({ tenantId: 1, routeId: 1 }, { unique: true });
routeSchema.index({ tenantId: 1, routeName: 1 }, { unique: true });
routeSchema.index({ tenantId: 1, isActive: 1 });
routeSchema.index({ tenantId: 1, assignedVehicle: 1 });
routeSchema.index({ tenantId: 1, assignedDriver: 1 });

// Index for route code (optional field, so sparse)
routeSchema.index(
    { tenantId: 1, routeCode: 1 },
    { unique: true, sparse: true, partialFilterExpression: { routeCode: { $exists: true, $ne: '' } } }
);

// Virtual for total stops count
routeSchema.virtual('stopsCount').get(function () {
    return this.stops ? this.stops.length : 0;
});

// Method to get stop by name
routeSchema.methods.getStopByName = function (stopName) {
    return this.stops.find(stop =>
        stop.stopName.toLowerCase() === stopName.toLowerCase()
    );
};

// Method to get ordered stops
routeSchema.methods.getOrderedStops = function () {
    return this.stops.sort((a, b) => a.stopOrder - b.stopOrder);
};

// Method to validate stop order uniqueness
routeSchema.methods.validateStopOrders = function () {
    const orders = this.stops.map(stop => stop.stopOrder);
    const uniqueOrders = new Set(orders);
    return orders.length === uniqueOrders.size;
};

// Pre-save validation for stops
routeSchema.pre('save', function (next) {
    // Ensure at least 2 stops
    if (this.stops && this.stops.length < 2) {
        return next(new Error('Route must have at least 2 stops'));
    }

    // Validate stop order uniqueness
    if (this.stops && !this.validateStopOrders()) {
        return next(new Error('Stop orders must be unique'));
    }

    // Set inactivatedAt when deactivating
    if (this.isModified('isActive') && !this.isActive && !this.inactivatedAt) {
        this.inactivatedAt = new Date();
    }

    next();
});

// Ensure virtuals are included in JSON
routeSchema.set('toJSON', { virtuals: true });
routeSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Route', routeSchema);
