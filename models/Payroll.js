const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
    // Multi-tenant support
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },

    // Employee reference
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Period
    month: {
        type: Number,
        required: true,
        min: 1,
        max: 12
    },
    year: {
        type: Number,
        required: true,
        min: 2000,
        max: 2100
    },

    // Salary components
    baseSalary: {
        type: Number,
        required: true,
        min: 0
    },
    bonuses: {
        type: Number,
        default: 0,
        min: 0
    },
    otherDeductions: {
        type: Number,
        default: 0,
        min: 0
    },

    // Advance salary deductions
    advanceDeductions: [{
        advanceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'AdvanceSalary'
        },
        amount: {
            type: Number,
            required: true,
            min: 0
        },
        deductedAt: {
            type: Date,
            default: Date.now
        }
    }],
    totalAdvanceDeduction: {
        type: Number,
        default: 0,
        min: 0
    },

    // Leave deductions
    leaveDays: {
        type: Number,
        default: 0,
        min: 0
    },
    leaveDeduction: {
        type: Number,
        default: 0,
        min: 0
    },

    // Net salary calculation
    netSalary: {
        type: Number,
        required: true,
        min: 0
    },

    // Payment details
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'cancelled'],
        default: 'pending'
    },
    paymentDate: {
        type: Date
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'bank_transfer', 'cheque', 'online', ''],
        default: ''
    },
    paymentReference: {
        type: String,
        trim: true
    },

    // Notes
    notes: {
        type: String,
        trim: true
    },

    // Audit
    generatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    generatedAt: {
        type: Date,
        default: Date.now
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    // Soft delete
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    },
    deletedAt: {
        type: Date
    },
    deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Unique index: one payroll record per employee per month per year per tenant
payrollSchema.index(
    { employeeId: 1, month: 1, year: 1, tenantId: 1 },
    { unique: true }
);

// Index for querying by period
payrollSchema.index({ year: 1, month: 1, tenantId: 1 });

// Pre-save hook to calculate net salary
payrollSchema.pre('save', function (next) {
    // Calculate total advance deduction
    if (this.advanceDeductions && this.advanceDeductions.length > 0) {
        this.totalAdvanceDeduction = this.advanceDeductions.reduce((sum, adv) => sum + adv.amount, 0);
    } else {
        this.totalAdvanceDeduction = 0;
    }

    // Calculate net salary: base + bonuses - deductions - advances - leave deductions
    this.netSalary = this.baseSalary + this.bonuses - this.otherDeductions - this.totalAdvanceDeduction - this.leaveDeduction;

    // Ensure net salary is not negative
    if (this.netSalary < 0) {
        this.netSalary = 0;
    }

    next();
});

module.exports = mongoose.model('Payroll', payrollSchema);
