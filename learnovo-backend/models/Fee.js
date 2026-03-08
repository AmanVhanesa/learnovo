const mongoose = require('mongoose');

const feeSchema = new mongoose.Schema({
  // Multi-tenant support
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Student is required']
  },
  admissionNumber: {
    type: String,
    trim: true
  },
  feeStructureId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeeStructure'
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  currency: {
    type: String,
    required: [true, 'Currency is required'],
    default: 'INR',
    uppercase: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'partially_paid', 'overdue', 'cancelled'],
    default: 'pending'
  },
  paidDate: {
    type: Date,
    default: null
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'online', 'cheque', 'other', null],
    default: null
  },
  transactionId: {
    type: String,
    unique: true,
    sparse: true
  },
  receiptNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  // For partial payments
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  notes: {
    type: String,
    trim: true
  },
  // For fee structure
  feeType: {
    type: String,
    enum: ['tuition', 'transport', 'library', 'sports', 'exam', 'other'],
    default: 'tuition'
  },
  academicYear: {
    type: String,
    trim: true
  },
  term: {
    type: String,
    enum: ['1st_term', '2nd_term', '3rd_term', 'annual'],
    default: 'annual'
  },
  // Reminder tracking
  remindersSent: [{
    date: {
      type: Date,
      default: Date.now
    },
    method: {
      type: String,
      enum: ['email', 'sms', 'dashboard']
    },
    status: {
      type: String,
      enum: ['sent', 'failed', 'delivered']
    }
  }],
  // Late fee
  lateFeeAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  lateFeeApplied: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for better performance
feeSchema.index({ tenantId: 1 });
feeSchema.index({ student: 1, status: 1 });
feeSchema.index({ tenantId: 1, student: 1, status: 1 });
feeSchema.index({ dueDate: 1 });
feeSchema.index({ status: 1 });
feeSchema.index({ academicYear: 1 });
feeSchema.index({ transactionId: 1 });

// Note: Receipt number generation moved to routes using Counter model
// Generate transaction ID before saving
feeSchema.pre('save', function(next) {
  if (this.isNew && !this.transactionId) {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.transactionId = `TXN${timestamp}${random}`;
  }

  next();
});

// Update status to overdue if due date has passed (only for pending fees, not during initial creation)
feeSchema.pre('save', function(next) {
  // Only auto-update to overdue if:
  // 1. Status is pending
  // 2. Due date has passed
  // 3. This is NOT a new document (already exists in DB) - allows manual status setting during creation
  if (this.status === 'pending' && this.dueDate < new Date() && !this.isNew) {
    this.status = 'overdue';
  }
  next();
});

// Virtual for total amount including late fees
feeSchema.virtual('totalAmount').get(function() {
  return this.amount + this.lateFeeAmount;
});

// Method to mark as paid
feeSchema.methods.markAsPaid = function(paymentMethod = 'cash', notes = '') {
  this.status = 'paid';
  this.paidDate = new Date();
  this.paymentMethod = paymentMethod;
  if (notes) this.notes = notes;
  return this.save();
};

// Method to add reminder
feeSchema.methods.addReminder = function(method, status = 'sent') {
  this.remindersSent.push({
    date: new Date(),
    method,
    status
  });
  return this.save();
};

// Static method to get overdue fees
feeSchema.statics.getOverdueFees = function() {
  return this.find({
    status: 'pending',
    dueDate: { $lt: new Date() }
  }).populate('student', 'name email phone class');
};

// Static method to get fees by student
feeSchema.statics.getFeesByStudent = function(studentId) {
  return this.find({ student: studentId })
    .sort({ dueDate: -1 })
    .populate('student', 'name email phone class');
};

module.exports = mongoose.model('Fee', feeSchema);
