const mongoose = require('mongoose');

const incomeSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'IncomeCategory',
    required: [true, 'Category is required']
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be greater than 0']
  },
  incomeDate: {
    type: Date,
    required: [true, 'Income date is required']
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card'],
    required: [true, 'Payment method is required']
  },
  paymentReference: {
    type: String,
    trim: true
  },
  receivedBy: {
    type: String,
    trim: true
  },
  receiptUrl: {
    type: String,
    trim: true
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  academicYear: {
    type: String,
    trim: true
  },
  academicSessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicSession',
    index: true
  },
  // Cross-module reference for auto-created records (fee payments, etc.)
  referenceType: {
    type: String,
    enum: ['fee_payment', 'library_fine', 'manual'],
    default: 'manual'
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId
  },
  referenceModel: {
    type: String,
    enum: ['Payment', 'PaymentAttempt', 'FeePaymentOrder', 'LibraryFine'],
    default: null
  },
  // System-generated records (from fee payments) cannot be edited/deleted by users
  isSystemGenerated: {
    type: Boolean,
    default: false
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

incomeSchema.index({ tenantId: 1, category: 1 });
incomeSchema.index({ tenantId: 1, incomeDate: -1 });
incomeSchema.index({ tenantId: 1, isDeleted: 1 });
incomeSchema.index({ tenantId: 1, academicYear: 1 });
incomeSchema.index({ tenantId: 1, academicSessionId: 1 });
incomeSchema.index({ tenantId: 1, referenceType: 1, referenceId: 1 }, { sparse: true });
incomeSchema.index({ tenantId: 1, isSystemGenerated: 1 });

module.exports = mongoose.model('Income', incomeSchema);
