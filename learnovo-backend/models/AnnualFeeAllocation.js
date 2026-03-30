const mongoose = require('mongoose');
const { toNumber, sumMoney, roundToRupee } = require('../utils/money');

/**
 * AnnualFeeAllocation Model
 * Tracks each student's annual fee allocation for an academic session.
 * Created from FeeStructure; drives invoice generation per payment plan.
 */
const allocatedFeeHeadSchema = new mongoose.Schema({
  feeHeadName: {
    type: String,
    required: true,
    trim: true
  },
  // NEW: Annual amount — always full year cost
  annualAmount: {
    type: Number,
    min: 0,
    default: 0
  },
  // NEW: Type — 'recurring' or 'one_time'
  type: {
    type: String,
    enum: ['recurring', 'one_time'],
    default: 'recurring'
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
    enum: ['monthly', 'quarterly', 'half-yearly', 'yearly', 'one-time']
  },
  // Reference to the original FeeHead (for tracking admission fee charges)
  feeHeadId: {
    type: String
  },
  isCompulsory: {
    type: Boolean,
    default: true
  },
  isAdmissionFee: {
    type: Boolean,
    default: false
  },
  isIncluded: {
    type: Boolean,
    default: true
  },
  exclusionReason: {
    type: String,
    trim: true
  }
}, { _id: false });

const annualFeeAllocationSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },

  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  feeStructureId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeeStructure',
    required: true
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

  // Snapshot of which fee heads apply to THIS student
  allocatedFeeHeads: [allocatedFeeHeadSchema],

  // Financial summary
  totalAnnualAmount: {
    type: Number,
    required: true,
    min: 0
  },

  totalPaid: {
    type: Number,
    default: 0,
    min: 0
  },

  totalWaived: {
    type: Number,
    default: 0,
    min: 0
  },

  totalDiscount: {
    type: Number,
    default: 0,
    min: 0
  },

  balance: {
    type: Number,
    required: true,
    min: 0
  },

  // Payment plan determines how invoices are generated
  paymentPlan: {
    type: String,
    enum: ['monthly', 'quarterly', 'half-yearly', 'annual'],
    default: 'quarterly'
  },

  // Status
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled', 'terminated'],
    default: 'active',
    index: true
  },

  // Cancellation / termination metadata
  cancelledAt: { type: Date },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cancellationReason: { type: String, trim: true },

  // Discount / scholarship details
  discountPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },

  discountFixed: {
    type: Number,
    default: 0,
    min: 0
  },

  discountReason: {
    type: String,
    trim: true
  },

  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
annualFeeAllocationSchema.index({ tenantId: 1, studentId: 1, academicSessionId: 1 }, { unique: true });
annualFeeAllocationSchema.index({ tenantId: 1, classId: 1, academicSessionId: 1 });
annualFeeAllocationSchema.index({ tenantId: 1, status: 1 });

// Pre-save: Recalculate balance
annualFeeAllocationSchema.pre('save', function(next) {
  if (this.status === 'cancelled' || this.status === 'terminated') return next();

  const includedHeads = this.allocatedFeeHeads.filter(h => h.isIncluded);
  // Use annualAmount (new) with fallback to amount (legacy)
  this.totalAnnualAmount = roundToRupee(sumMoney(includedHeads.map(h => h.annualAmount || h.amount)));

  // Apply discounts
  let discountAmount = toNumber(this.discountFixed);
  if (this.discountPercentage > 0) {
    discountAmount += roundToRupee(this.totalAnnualAmount * this.discountPercentage / 100);
  }
  this.totalDiscount = roundToRupee(discountAmount);

  this.balance = roundToRupee(
    toNumber(this.totalAnnualAmount) - toNumber(this.totalPaid) - toNumber(this.totalWaived) - toNumber(this.totalDiscount)
  );

  if (this.balance <= 0) {
    this.balance = 0;
    if (toNumber(this.totalPaid) + toNumber(this.totalWaived) + toNumber(this.totalDiscount) >= toNumber(this.totalAnnualAmount)) {
      this.status = 'completed';
    }
  }

  next();
});

// Static: Update allocation financials from invoices
annualFeeAllocationSchema.statics.recalculateFromInvoices = async function(allocationId) {
  const FeeInvoice = require('./FeeInvoice');
  const allocation = await this.findById(allocationId);
  if (!allocation) return;

  const invoices = await FeeInvoice.find({
    tenantId: allocation.tenantId,
    studentId: allocation.studentId,
    academicSessionId: allocation.academicSessionId,
    annualAllocationId: allocationId,
    status: { $ne: 'Cancelled' }
  });

  allocation.totalPaid = roundToRupee(sumMoney(invoices.map(inv => toNumber(inv.paidAmount))));
  allocation.totalWaived = roundToRupee(sumMoney(invoices.map(inv => toNumber(inv.discountAmount))));

  await allocation.save();
};

module.exports = mongoose.model('AnnualFeeAllocation', annualFeeAllocationSchema);
