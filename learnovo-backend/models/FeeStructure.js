const mongoose = require('mongoose');

/**
 * Fee Structure Model
 * Defines fee heads, amounts, and late-fee config for classes/sections
 */
const feeStructureSchema = new mongoose.Schema({
  // Multi-tenant support
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },

  // Class this fee structure applies to
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: [true, 'Class is required']
  },

  // Optional section (null = applies to all sections)
  sectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section',
    default: null
  },

  // Academic session
  academicSessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicSession',
    required: [true, 'Academic session is required']
  },

  // Fee heads (line items)
  feeHeads: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    // NEW: Annual amount — always the FULL YEAR cost (e.g., Tuition = 18000, Admission = 1000)
    annualAmount: {
      type: Number,
      min: 0,
      default: 0
    },
    // NEW: Type — 'recurring' splits across invoices, 'one_time' goes in first invoice only
    type: {
      type: String,
      enum: ['recurring', 'one_time'],
      default: 'recurring'
    },
    // DEPRECATED: Keep for backward compat with existing data
    amount: {
      type: Number,
      min: 0,
      default: 0
    },
    // DEPRECATED: Frequency no longer drives invoice splitting — payment plan does
    frequency: {
      type: String,
      enum: ['monthly', 'quarterly', 'half-yearly', 'yearly', 'one-time'],
      default: 'yearly'
    },
    description: {
      type: String,
      trim: true
    },
    isOptional: {
      type: Boolean,
      default: false
    },
    isAdmissionFee: {
      type: Boolean,
      default: false
    },
    // Due day of month for due date calculation
    dueDay: {
      type: Number,
      min: 1,
      max: 28,
      default: 10
    }
  }],

  // Late fee configuration
  lateFeeConfig: {
    enabled: {
      type: Boolean,
      default: false
    },
    type: {
      type: String,
      enum: ['fixed', 'percentage'],
      default: 'fixed'
    },
    amount: {
      type: Number,
      default: 0,
      min: 0
    },
    gracePeriodDays: {
      type: Number,
      default: 7,
      min: 0
    }
  },

  // Status
  isActive: {
    type: Boolean,
    default: true
  },

  // Created by
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual: total annual amount across all fee heads (uses annualAmount, falls back to computed from old amount+frequency)
feeStructureSchema.virtual('totalAmount').get(function() {
  if (!this.feeHeads || this.feeHeads.length === 0) return 0;
  return this.feeHeads.reduce((sum, head) => sum + (head.annualAmount || head.amount || 0), 0);
});

// Virtual: total annual amount with clear naming
feeStructureSchema.virtual('totalAnnualAmount').get(function() {
  if (!this.feeHeads || this.feeHeads.length === 0) return 0;
  return this.feeHeads.reduce((sum, head) => sum + (head.annualAmount || head.amount || 0), 0);
});

// Virtual: recurring total (splits across invoices)
feeStructureSchema.virtual('recurringTotal').get(function() {
  if (!this.feeHeads || this.feeHeads.length === 0) return 0;
  return this.feeHeads
    .filter(h => (h.type || 'recurring') === 'recurring')
    .reduce((sum, head) => sum + (head.annualAmount || head.amount || 0), 0);
});

// Virtual: one-time total (first invoice only, new students)
feeStructureSchema.virtual('oneTimeTotal').get(function() {
  if (!this.feeHeads || this.feeHeads.length === 0) return 0;
  return this.feeHeads
    .filter(h => h.type === 'one_time')
    .reduce((sum, head) => sum + (head.annualAmount || head.amount || 0), 0);
});

// Indexes for efficient queries
feeStructureSchema.index({ tenantId: 1, classId: 1, academicSessionId: 1 });
feeStructureSchema.index({ tenantId: 1, isActive: 1 });

module.exports = mongoose.model('FeeStructure', feeStructureSchema);
