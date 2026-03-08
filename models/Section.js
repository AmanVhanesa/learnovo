const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: [true, 'Section name is required'],
        trim: true,
        uppercase: true
    },
    capacity: {
        type: Number,
        min: 1,
        default: 40
    },
    currentStrength: {
        type: Number,
        default: 0,
        min: 0
    },
    sectionTeacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    description: {
        type: String,
        trim: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Unique section name per class per tenant
sectionSchema.index({ tenantId: 1, classId: 1, name: 1 }, { unique: true });
sectionSchema.index({ sectionTeacher: 1 });

// Validation: Current strength cannot exceed capacity
sectionSchema.pre('validate', function (next) {
    if (this.currentStrength > this.capacity) {
        next(new Error('Current strength cannot exceed capacity'));
    } else {
        next();
    }
});

// Method to increment strength
sectionSchema.methods.incrementStrength = function () {
    if (this.currentStrength < this.capacity) {
        this.currentStrength += 1;
        return this.save();
    } else {
        throw new Error('Section is at full capacity');
    }
};

// Method to decrement strength
sectionSchema.methods.decrementStrength = function () {
    if (this.currentStrength > 0) {
        this.currentStrength -= 1;
        return this.save();
    }
    return this;
};

module.exports = mongoose.model('Section', sectionSchema);
