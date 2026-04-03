const mongoose = require('mongoose');
const Counter = require('./Counter');

const receiptSchema = new mongoose.Schema({
  // Multi-tenant support
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },

  // Link to the exact attempt that was successful
  paymentAttemptId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentAttempt',
    required: true
  },

  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeeInvoice',
    required: true,
    index: true
  },

  // Auto-generated receipt number via Counter model (unique per tenant)
  receiptNumber: {
    type: String,
    required: true
  },

  // Optional reference if PDF is generated/stored later
  pdfPath: {
    type: String
  },

  // Who initiated the payment: 'student' or 'admin'
  initiatedBy: {
    type: String,
    enum: ['student', 'admin'],
    default: 'student'
  },

  // Admin who verified or recorded the payment
  verifiedByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  verifiedByName: {
    type: String,
    default: null
  },

  // Payment details for the receipt
  amount: { type: Number, default: 0 },
  paymentMode: { type: String, default: null },
  transactionRefId: { type: String, default: null },
  paymentDate: { type: Date, default: null },

  issuedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Static method to generate receipt number (with collision recovery)
receiptSchema.statics.generateReceiptNumber = async function(tenantId) {
  const year = new Date().getFullYear();
  const maxAttempts = 5;
  for (let i = 0; i < maxAttempts; i++) {
    const counter = await Counter.getNextSequence('student_receipt', String(year), tenantId);
    const receiptNumber = `RCP-STU-${year}-${String(counter).padStart(5, '0')}`;
    const exists = await this.findOne({ receiptNumber }).select('_id').lean();
    if (!exists) return receiptNumber;
  }
  // Fallback: sync counter with actual max, then generate
  const last = await this.findOne({ tenantId, receiptNumber: new RegExp(`^RCP-STU-${year}-`) })
    .sort({ receiptNumber: -1 }).select('receiptNumber').lean();
  const maxSeq = last ? parseInt(last.receiptNumber.replace(`RCP-STU-${year}-`, ''), 10) : 0;
  await Counter.findOneAndUpdate(
    { name: 'student_receipt', year: String(year), tenantId },
    { $set: { sequence: maxSeq } },
    { upsert: true }
  );
  const counter = await Counter.getNextSequence('student_receipt', String(year), tenantId);
  return `RCP-STU-${year}-${String(counter).padStart(5, '0')}`;
};

module.exports = mongoose.model('Receipt', receiptSchema);
