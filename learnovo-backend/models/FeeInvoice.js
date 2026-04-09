const mongoose = require('mongoose');
const Counter = require('./Counter');
const { toNumber, calcBalance, isFullyPaid, roundToRupee } = require('../utils/money');

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

  // Annual Allocation Reference (Phase 2 — links invoice to annual allocation)
  annualAllocationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AnnualFeeAllocation',
    index: true
  },

  // Invoice Items / Line Items (Locked at generation)
  items: [{
    feeHeadName: {
      type: String,
      required: true
    },
    // NEW: Full annual amount (for reference/display)
    fullAnnualAmount: {
      type: Number,
      min: 0,
      default: 0
    },
    // NEW: Period amount (the split amount for this period)
    periodAmount: {
      type: Number,
      min: 0,
      default: 0
    },
    // NEW: Discount applied to this line item
    discount: {
      type: Number,
      min: 0,
      default: 0
    },
    // NEW: Net amount (periodAmount - discount)
    netAmount: {
      type: Number,
      min: 0,
      default: 0
    },
    // NEW: Fee head type (recurring or one_time)
    type: {
      type: String,
      enum: ['recurring', 'one_time']
    },
    // DEPRECATED: Keep for backward compat
    amount: {
      type: Number,
      min: 0,
      default: 0
    },
    // DEPRECATED: Keep for backward compat
    frequency: {
      type: String,
      enum: ['Monthly', 'Quarterly', 'One-time', 'Annual', 'Half-yearly']
    },
    // Reference to original fee head ID (for tracking)
    feeHeadId: {
      type: String
    }
  }],

  // NEW: Period boundaries for this invoice
  periodLabel: {
    type: String,
    trim: true
  },

  periodStart: {
    type: Date
  },

  periodEnd: {
    type: Date
  },

  // Financial Details
  totalAmount: {
    type: Number,
    required: true,
    min: [0.01, 'Invoice total must be greater than zero']
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

  // Discount / Waiver
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
  },

  discountType: {
    type: String,
    trim: true
  },

  discountReason: {
    type: String,
    trim: true
  },

  discountAppliedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  discountAppliedAt: {
    type: Date
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

  // Cancellation metadata
  cancelledAt: {
    type: Date
  },

  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  cancellationReason: {
    type: String,
    trim: true
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
// Prevent duplicate active invoices for same student + billing period + academic session
feeInvoiceSchema.index(
  { tenantId: 1, studentId: 1, academicSessionId: 1, 'billingPeriod.displayText': 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $ne: 'Cancelled' } },
    name: 'unique_active_invoice_per_student_period'
  }
);
// NEW: Period-based unique constraint (for new invoice generation flow)
feeInvoiceSchema.index(
  { tenantId: 1, studentId: 1, academicSessionId: 1, periodStart: 1, periodEnd: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $ne: 'Cancelled' }, periodStart: { $exists: true } },
    name: 'unique_active_invoice_per_student_period_dates',
    sparse: true
  }
);
feeInvoiceSchema.index({ tenantId: 1, annualAllocationId: 1, status: 1 });

// Pre-save: Calculate balance amount with safe rounding
feeInvoiceSchema.pre('save', function(next) {
  // Skip status recalculation for cancelled invoices
  if (this.status === 'Cancelled') return next();

  this.balanceAmount = calcBalance(this.totalAmount, this.lateFeeApplied, this.paidAmount, this.discountAmount);

  // Update status based on payment (use tolerance-based comparison)
  const effectiveTotal = toNumber(this.totalAmount) + toNumber(this.lateFeeApplied) - toNumber(this.discountAmount);
  if (isFullyPaid(this.paidAmount, effectiveTotal)) {
    this.status = 'Paid';
    this.balanceAmount = 0; // Clamp to exactly 0
  } else if (toNumber(this.paidAmount) > 0 && this.balanceAmount > 0) {
    this.status = 'Partial';
  } else if (this.dueDate < new Date() && this.balanceAmount > 0) {
    this.status = 'Overdue';
  } else if (this.balanceAmount > 0) {
    this.status = 'Pending';
  }

  next();
});

// Static method to generate invoice number (with collision recovery)
feeInvoiceSchema.statics.generateInvoiceNumber = async function(tenantId) {
  const year = new Date().getFullYear();
  const maxAttempts = 5;
  for (let i = 0; i < maxAttempts; i++) {
    const counter = await Counter.getNextSequence('invoice', String(year), tenantId);
    const invoiceNumber = `INV-${year}-${String(counter).padStart(5, '0')}`;
    const exists = await this.findOne({ invoiceNumber }).select('_id').lean();
    if (!exists) return invoiceNumber;
  }
  // Fallback: sync counter with actual max, then generate
  const last = await this.findOne({ tenantId, invoiceNumber: new RegExp(`^INV-${year}-`) })
    .sort({ invoiceNumber: -1 }).select('invoiceNumber').lean();
  const maxSeq = last ? parseInt(last.invoiceNumber.replace(`INV-${year}-`, ''), 10) : 0;
  await Counter.findOneAndUpdate(
    { name: 'invoice', year: String(year), tenantId },
    { $set: { sequence: maxSeq } },
    { upsert: true }
  );
  const counter = await Counter.getNextSequence('invoice', String(year), tenantId);
  return `INV-${year}-${String(counter).padStart(5, '0')}`;
};

// Static helper: Get month name
feeInvoiceSchema.statics.getMonthName = function(month) {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return monthNames[month - 1];
};

// Static helper: Calculate billing period
feeInvoiceSchema.statics.calculateBillingPeriod = function(date, frequency) {
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
    // Academic-year quarters: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
    const academicQuarterMap = {
      1: { quarter: 4, months: 'Jan-Mar' },  // Jan-Mar = Q4 of previous academic year
      2: { quarter: 4, months: 'Jan-Mar' },
      3: { quarter: 4, months: 'Jan-Mar' },
      4: { quarter: 1, months: 'Apr-Jun' },
      5: { quarter: 1, months: 'Apr-Jun' },
      6: { quarter: 1, months: 'Apr-Jun' },
      7: { quarter: 2, months: 'Jul-Sep' },
      8: { quarter: 2, months: 'Jul-Sep' },
      9: { quarter: 2, months: 'Jul-Sep' },
      10: { quarter: 3, months: 'Oct-Dec' },
      11: { quarter: 3, months: 'Oct-Dec' },
      12: { quarter: 3, months: 'Oct-Dec' }
    };
    const { quarter, months } = academicQuarterMap[month];
    return {
      quarter,
      year,
      displayText: `Q${quarter} ${year} (${months})`
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
feeInvoiceSchema.methods.applyLateFee = function(amount) {
  this.lateFeeApplied = roundToRupee(toNumber(this.lateFeeApplied) + toNumber(amount));
  this.lateFeeAppliedDate = new Date();
  return this.save();
};

// Method to record payment
feeInvoiceSchema.methods.recordPayment = function(amount) {
  this.paidAmount = roundToRupee(toNumber(this.paidAmount) + toNumber(amount));
  return this.save();
};

module.exports = mongoose.model('FeeInvoice', feeInvoiceSchema);
