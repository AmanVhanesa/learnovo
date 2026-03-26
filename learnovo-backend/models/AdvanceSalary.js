const mongoose = require('mongoose');

const advanceSalarySchema = new mongoose.Schema({
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

    // Advance details
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    requestDate: {
        type: Date,
        default: Date.now,
        required: true
    },
    reason: {
        type: String,
        trim: true,
        required: true
    },

    // Approval workflow
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
        index: true
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedAt: {
        type: Date
    },
    rejectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    rejectedAt: {
        type: Date
    },
    rejectionReason: {
        type: String,
        trim: true
    },

    // Deduction tracking
    deductionStatus: {
        type: String,
        enum: ['pending', 'partial', 'deducted'],
        default: 'pending',
        index: true
    },
    amountDeducted: {
        type: Number,
        default: 0,
        min: 0
    },
    remainingAmount: {
        type: Number,
        min: 0
    },

    // Deduction history
    deductions: [{
        payrollId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Payroll'
        },
        amount: {
            type: Number,
            required: true,
            min: 0
        },
        deductedAt: {
            type: Date,
            default: Date.now
        },
        month: Number,
        year: Number
    }],

    // Notes
    notes: {
        type: String,
        trim: true
    },

    // Audit
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Indexes
advanceSalarySchema.index({ employeeId: 1, tenantId: 1, status: 1 });
advanceSalarySchema.index({ tenantId: 1, status: 1, deductionStatus: 1 });

// Pre-save hook to calculate remaining amount
advanceSalarySchema.pre('save', function (next) {
    // Calculate remaining amount
    this.remainingAmount = this.amount - this.amountDeducted;

    // Update deduction status based on amounts
    if (this.amountDeducted === 0) {
        this.deductionStatus = 'pending';
    } else if (this.amountDeducted >= this.amount) {
        this.deductionStatus = 'deducted';
        this.remainingAmount = 0;
    } else {
        this.deductionStatus = 'partial';
    }

    next();
});

// Method to add a deduction
advanceSalarySchema.methods.addDeduction = function (payrollId, amount, month, year) {
    this.deductions.push({
        payrollId,
        amount,
        month,
        year,
        deductedAt: new Date()
    });
    this.amountDeducted += amount;
    return this.save();
};

module.exports = mongoose.model('AdvanceSalary', advanceSalarySchema);
