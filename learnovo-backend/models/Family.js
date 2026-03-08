const mongoose = require('mongoose');

const familySchema = new mongoose.Schema({
    // Multi-tenant support
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },

    // Family Identification
    familyCode: {
        type: String,
        required: true,
        trim: true,
        index: true
    },

    // Primary Guardian
    primaryGuardian: {
        name: {
            type: String,
            required: true,
            trim: true
        },
        phone: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            lowercase: true,
            trim: true
        },
        relation: {
            type: String,
            enum: ['Father', 'Mother', 'Guardian'],
            default: 'Father'
        },
        occupation: {
            type: String,
            trim: true
        },
        income: {
            type: Number,
            min: 0
        }
    },

    // Secondary Guardian (optional)
    secondaryGuardian: {
        name: {
            type: String,
            trim: true
        },
        phone: {
            type: String,
            trim: true
        },
        email: {
            type: String,
            lowercase: true,
            trim: true
        },
        relation: {
            type: String,
            enum: ['Father', 'Mother', 'Guardian', ''],
            default: ''
        },
        occupation: {
            type: String,
            trim: true
        }
    },

    // Address (shared by family)
    address: {
        street: {
            type: String,
            trim: true
        },
        city: {
            type: String,
            trim: true
        },
        state: {
            type: String,
            trim: true
        },
        pincode: {
            type: String,
            trim: true
        },
        country: {
            type: String,
            default: 'India',
            trim: true
        }
    },

    // Students in this family
    students: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],

    // Metadata
    totalSiblings: {
        type: Number,
        default: 0
    },

    isActive: {
        type: Boolean,
        default: true
    },

    notes: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Indexes
familySchema.index({ familyCode: 1, tenantId: 1 }, { unique: true });
familySchema.index({ tenantId: 1 });
familySchema.index({ 'primaryGuardian.phone': 1, tenantId: 1 });

// Auto-generate family code before saving
familySchema.pre('save', function (next) {
    if (this.isNew && !this.familyCode) {
        const year = new Date().getFullYear();
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        this.familyCode = `FAM${year}${random}`;
    }
    next();
});

// Update sibling count when students array changes
familySchema.pre('save', function (next) {
    if (this.isModified('students')) {
        this.totalSiblings = this.students.length;
    }
    next();
});

// Method to add student to family
familySchema.methods.addStudent = function (studentId) {
    if (!this.students.includes(studentId)) {
        this.students.push(studentId);
        this.totalSiblings = this.students.length;
    }
    return this.save();
};

// Method to remove student from family
familySchema.methods.removeStudent = function (studentId) {
    this.students = this.students.filter(id => !id.equals(studentId));
    this.totalSiblings = this.students.length;
    return this.save();
};

module.exports = mongoose.model('Family', familySchema);
