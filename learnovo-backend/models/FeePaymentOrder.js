const mongoose = require('mongoose');

/**
 * FeePaymentOrder — Tracks every online fee payment attempt via Razorpay.
 *
 * Lifecycle:
 *   1. Parent clicks "Pay Now" → order created (status: "created")
 *   2. Payment succeeds → status: "paid", invoice updated
 *   3. Payment fails → status: "failed"
 *   4. If refunded later → status: "refunded"
 *
 * This is separate from the existing Payment model (which tracks admin-collected
 * cash/cheque/UPI payments). This model is specifically for Razorpay online payments.
 */
const feePaymentOrderSchema = new mongoose.Schema({
  // Multi-tenant isolation (every query must filter by this)
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },

  // Which invoice is being paid
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeeInvoice',
    required: true,
    index: true
  },

  // Which student the payment is for
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  academicSessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicSession',
    index: true
  },

  // Who initiated the payment (could be a parent user)
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // ─── Razorpay Fields ─────────────────────────────────────────

  // The order ID returned by razorpay.orders.create()
  razorpayOrderId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Filled after successful payment
  razorpayPaymentId: {
    type: String,
    sparse: true,
    index: true
  },

  // The signature Razorpay sends for verification
  razorpaySignature: {
    type: String
  },

  // ─── Payment Details ─────────────────────────────────────────

  // Amount in rupees (NOT paise — we convert when talking to Razorpay)
  amount: {
    type: Number,
    required: true,
    min: [0.01, 'Amount must be greater than zero']
  },

  currency: {
    type: String,
    default: 'INR'
  },

  // Payment status lifecycle
  status: {
    type: String,
    enum: ['created', 'paid', 'failed', 'refunded'],
    default: 'created',
    index: true
  },

  // How the parent paid (filled after payment)
  paymentMethod: {
    type: String,
    enum: ['card', 'upi', 'netbanking', 'wallet', 'emi', 'other']
  },

  // ─── Webhook Tracking ────────────────────────────────────────

  // Did we get confirmation from the frontend callback?
  verifiedViaCallback: {
    type: Boolean,
    default: false
  },

  // Did we get confirmation from the Razorpay webhook?
  verifiedViaWebhook: {
    type: Boolean,
    default: false
  },

  // Raw webhook payload (useful for debugging disputes)
  webhookPayload: {
    type: mongoose.Schema.Types.Mixed
  },

  // ─── Timestamps ──────────────────────────────────────────────

  paidAt: {
    type: Date
  },

  failedAt: {
    type: Date
  },

  refundedAt: {
    type: Date
  }
}, {
  timestamps: true // adds createdAt, updatedAt automatically
});

// Compound indexes for common queries
feePaymentOrderSchema.index({ tenantId: 1, status: 1 });
feePaymentOrderSchema.index({ tenantId: 1, studentId: 1, createdAt: -1 });
feePaymentOrderSchema.index({ tenantId: 1, invoiceId: 1, status: 1 });

module.exports = mongoose.model('FeePaymentOrder', feePaymentOrderSchema);
