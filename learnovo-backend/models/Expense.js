const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExpenseCategory',
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
  expenseDate: {
    type: Date,
    required: [true, 'Expense date is required']
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
  receiptUrl: {
    type: String,
    trim: true
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  rejectionReason: {
    type: String,
    trim: true
  },
  academicYear: {
    type: String,
    trim: true
  },
  // Cross-module reference for auto-created records (payroll, etc.)
  referenceType: {
    type: String,
    enum: ['payroll', 'manual'],
    default: 'manual'
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId
  },
  referenceModel: {
    type: String,
    enum: ['Payroll'],
    default: null
  },
  // System-generated records (from payroll) cannot be edited/deleted by users
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

expenseSchema.index({ tenantId: 1, status: 1 });
expenseSchema.index({ tenantId: 1, category: 1 });
expenseSchema.index({ tenantId: 1, expenseDate: -1 });
expenseSchema.index({ tenantId: 1, isDeleted: 1 });
expenseSchema.index({ tenantId: 1, academicYear: 1 });
expenseSchema.index({ tenantId: 1, referenceType: 1, referenceId: 1 }, { sparse: true });
expenseSchema.index({ tenantId: 1, isSystemGenerated: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
