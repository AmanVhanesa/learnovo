const mongoose = require('mongoose');

const bankReconRowSchema = new mongoose.Schema({
  rowNumber: { type: Number, required: true },
  raw: { type: mongoose.Schema.Types.Mixed },

  utr: { type: String, trim: true },
  gatewayOrderId: { type: String, trim: true },
  gatewayPaymentId: { type: String, trim: true },
  amount: { type: Number, required: true },
  txnDate: { type: Date },
  bankStatus: { type: String, trim: true },

  classification: {
    type: String,
    enum: ['MATCHED_CONFIRMED', 'BANK_ONLY', 'AMBIGUOUS', 'LEARNOVO_ONLY', 'IGNORED', 'ACTIONED'],
    required: true,
    index: true
  },

  candidateOrderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FeePaymentOrder' }],
  candidateAttemptIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PaymentAttempt' }],
  candidateInvoiceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FeeInvoice' }],

  matchedPaymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  matchedInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeInvoice' },
  matchedStudentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  actionedAt: { type: Date },
  actionedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  actionNote: { type: String, trim: true }
}, { _id: true });

const bankReconciliationBatchSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },

  source: {
    type: String,
    enum: ['RAZORPAY', 'ICICI', 'GENERIC'],
    default: 'GENERIC'
  },

  originalFilename: { type: String, trim: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  periodStart: { type: Date },
  periodEnd: { type: Date },

  summary: {
    total: { type: Number, default: 0 },
    matchedConfirmed: { type: Number, default: 0 },
    bankOnly: { type: Number, default: 0 },
    ambiguous: { type: Number, default: 0 },
    learnovoOnly: { type: Number, default: 0 },
    ignored: { type: Number, default: 0 },
    actioned: { type: Number, default: 0 }
  },

  rows: { type: [bankReconRowSchema], default: [] },

  status: {
    type: String,
    enum: ['PROCESSING', 'READY', 'CLOSED'],
    default: 'PROCESSING',
    index: true
  },

  closedAt: { type: Date },
  closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

bankReconciliationBatchSchema.index({ tenantId: 1, createdAt: -1 });

module.exports = mongoose.model('BankReconciliationBatch', bankReconciliationBatchSchema);
