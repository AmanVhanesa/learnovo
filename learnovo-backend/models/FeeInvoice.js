const mongoose = require('mongoose');
const Counter = require('./Counter');

const feeInvoiceSchema = new mongoose.Schema({
    // Multi-tenant support
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },

    // Invoice Number (Auto-generated)
    invoiceNumber: {
        type: String,
        required: true,
        unique: true
    },

    // Student Details
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true
    },

    sectionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Section'
    },

    academicSessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AcademicSession',
        required: true,
        index: true
    },

    // Fee Structure Reference
    feeStructureId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FeeStructure'
    },

    // Invoice Items (Locked at generation)
    items: [{
        feeHeadName: {
            type: String,
            required: true
        },
        amount: {
            type: Number,
            required: true,
            min: 0
        },
        frequency: {
            type: String,
            enum: ['Monthly', 'Quarterly', 'One-time', 'Annual']
        }
    }],

    // Financial Details
    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },

    paidAmount: {
        type: Number,
        default: 0,
        min: 0
    },

    balanceAmount: {
        type: Number,
        required: true,
        min: 0
    },

    // Status
    status: {
        type: String,
        enum: ['Pending', 'Partial', 'Paid', 'Overdue', 'Cancelled'],
        default: 'Pending',
        index: true
    },

    // Dates
    dueDate: {
        type: Date,
        required: true,
        index: true
    },

    issuedDate: {
        type: Date,
        default: Date.now
    },

    // Late Fee Tracking
    lateFeeApplied: {
        type: Number,
        default: 0,
        min: 0
    },

    lateFeeAppliedDate: {
        type: Date
    },

    // Billing Period (for receipt display)
    billingPeriod: {
        month: {
            type: Number,
            min: 1,
            max: 12
        },
        quarter: {
            type: Number,
            min: 1,
            max: 4
        },
        year: {
            type: Number
        },
        displayText: {
            type: String,
            trim: true
        }
    },

    // Metadata
    remarks: {
        type: String,
        trim: true
    },

    generatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Indexes
feeInvoiceSchema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true });
feeInvoiceSchema.index({ tenantId: 1, studentId: 1, status: 1 });
feeInvoiceSchema.index({ tenantId: 1, academicSessionId: 1, status: 1 });
feeInvoiceSchema.index({ tenantId: 1, dueDate: 1, status: 1 });

// Pre-save: Calculate balance amount
feeInvoiceSchema.pre('save', function (next) {
    this.balanceAmount = this.totalAmount + this.lateFeeApplied - this.paidAmount;

    // Update status based on payment
    if (this.balanceAmount === 0) {
        this.status = 'Paid';
    } else if (this.paidAmount > 0 && this.balanceAmount > 0) {
        this.status = 'Partial';
    } else if (this.dueDate < new Date() && this.balanceAmount > 0) {
        this.status = 'Overdue';
    } else if (this.balanceAmount > 0) {
        this.status = 'Pending';
    }

    next();
});

// Static method to generate invoice number
feeInvoiceSchema.statics.generateInvoiceNumber = async function (tenantId) {
    const year = new Date().getFullYear();
    const counter = await Counter.getNextSequence(`invoice_${tenantId}_${year}`);
    return `INV-${year}-${String(counter).padStart(5, '0')}`;
};

// Static helper: Get month name
feeInvoiceSchema.statics.getMonthName = function (month) {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    return monthNames[month - 1];
};

// Static helper: Calculate billing period
feeInvoiceSchema.statics.calculateBillingPeriod = function (date, frequency) {
    const d = new Date(date);
    const month = d.getMonth() + 1; // 1-12
    const year = d.getFullYear();

    if (frequency === 'Monthly') {
        return {
            month,
            year,
            displayText: `${this.getMonthName(month)} ${year}`
        };
    } else if (frequency === 'Quarterly') {
        const quarter = Math.ceil(month / 3);
        const quarterMonths = {
            1: 'Jan-Mar',
            2: 'Apr-Jun',
            3: 'Jul-Sep',
            4: 'Oct-Dec'
        };
        return {
            quarter,
            year,
            displayText: `Q${quarter} ${year} (${quarterMonths[quarter]})`
        };
    } else if (frequency === 'Annual') {
        return {
            year,
            displayText: `Academic Year ${year}-${year + 1}`
        };
    }

    // One-time fees don't need a specific period
    return {
        displayText: 'One-time Payment'
    };
};

// Method to apply late fee
feeInvoiceSchema.methods.applyLateFee = function (amount) {
    this.lateFeeApplied += amount;
    this.lateFeeAppliedDate = new Date();
    return this.save();
};

// Method to record payment
feeInvoiceSchema.methods.recordPayment = function (amount) {
    this.paidAmount += amount;
    return this.save();
};

module.exports = mongoose.model('FeeInvoice', feeInvoiceSchema);
