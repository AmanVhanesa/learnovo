const mongoose = require('mongoose');

const studentTransportAssignmentSchema = new mongoose.Schema({
    // Multi-tenant support
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },

    // Student Reference
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Student reference is required'],
        index: true
    },

    // Route Reference
    route: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Route',
        required: [true, 'Route reference is required'],
        index: true
    },

    // Stop Information
    stop: {
        type: String,
        required: [true, 'Stop name is required'],
        trim: true
    },

    // Transport Type
    transportType: {
        type: String,
        enum: ['Both', 'Pickup Only', 'Drop Only'],
        default: 'Both',
        required: true
    },

    // Academic Year
    academicYear: {
        type: String,
        required: [true, 'Academic year is required'],
        trim: true,
        index: true
    },

    // Fee Information
    monthlyFee: {
        type: Number,
        required: [true, 'Monthly transport fee is required'],
        min: 0
    },

    // Assignment Period
    startDate: {
        type: Date,
        required: [true, 'Start date is required'],
        default: Date.now
    },

    endDate: {
        type: Date,
        default: null // null means currently active
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
// Ensure one student can have only one active assignment per academic year
studentTransportAssignmentSchema.index(
    { tenantId: 1, student: 1, academicYear: 1, isActive: 1 },
    {
        unique: true,
        partialFilterExpression: { isActive: true }
    }
);

studentTransportAssignmentSchema.index({ tenantId: 1, route: 1, isActive: 1 });
studentTransportAssignmentSchema.index({ tenantId: 1, academicYear: 1, isActive: 1 });
studentTransportAssignmentSchema.index({ tenantId: 1, student: 1 });

// Virtual for assignment duration in days
studentTransportAssignmentSchema.virtual('durationDays').get(function () {
    const end = this.endDate || new Date();
    const start = this.startDate;
    return Math.floor((end - start) / (24 * 60 * 60 * 1000));
});

// Method to check if assignment is currently active
studentTransportAssignmentSchema.methods.isCurrentlyActive = function () {
    if (!this.isActive) return false;

    const now = new Date();
    const hasStarted = this.startDate <= now;
    const notEnded = !this.endDate || this.endDate >= now;

    return hasStarted && notEnded;
};

// Method to deactivate assignment
studentTransportAssignmentSchema.methods.deactivate = function (reason) {
    this.isActive = false;
    this.inactiveReason = reason;
    this.inactivatedAt = new Date();
    this.endDate = new Date();
    return this.save();
};

// Pre-save validation
studentTransportAssignmentSchema.pre('save', async function (next) {
    // Validate that student exists and is active
    if (this.isNew || this.isModified('student')) {
        const User = mongoose.model('User');
        const student = await User.findById(this.student);

        if (!student) {
            return next(new Error('Student not found'));
        }

        if (student.role !== 'student') {
            return next(new Error('Referenced user is not a student'));
        }

        if (!student.isActive) {
            return next(new Error('Student is not active'));
        }
    }

    // Validate that route exists and is active
    if (this.isNew || this.isModified('route')) {
        const Route = mongoose.model('Route');
        const route = await Route.findById(this.route);

        if (!route) {
            return next(new Error('Route not found'));
        }

        if (!route.isActive) {
            return next(new Error('Route is not active'));
        }

        // Validate that stop exists in the route
        const stopExists = route.stops.some(
            s => s.stopName.toLowerCase() === this.stop.toLowerCase()
        );

        if (!stopExists) {
            return next(new Error('Stop does not exist in the selected route'));
        }
    }

    // Validate date logic
    if (this.endDate && this.startDate && this.endDate < this.startDate) {
        return next(new Error('End date cannot be before start date'));
    }

    // Set inactivatedAt when deactivating
    if (this.isModified('isActive') && !this.isActive && !this.inactivatedAt) {
        this.inactivatedAt = new Date();
        if (!this.endDate) {
            this.endDate = new Date();
        }
    }

    next();
});

// Ensure virtuals are included in JSON
studentTransportAssignmentSchema.set('toJSON', { virtuals: true });
studentTransportAssignmentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('StudentTransportAssignment', studentTransportAssignmentSchema);
