const mongoose = require('mongoose');

const libraryFineSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },

  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'LibraryMember', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  issueId: { type: mongoose.Schema.Types.ObjectId, ref: 'BookIssue' },
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },

  amount: { type: Number, required: true, min: 0 },
  reason: {
    type: String,
    enum: ['overdue', 'damage', 'lost', 'other'],
    default: 'overdue'
  },
  description: { type: String, trim: true, default: '' },

  status: {
    type: String,
    enum: ['pending', 'paid', 'waived'],
    default: 'pending',
    index: true
  },

  paidAt: { type: Date },
  paidAmount: { type: Number, default: 0, min: 0 },
  collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  waivedAt: { type: Date },
  waivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  waiveReason: { type: String, trim: true, default: '' },

  // For idempotent finance auto-sync
  incomeRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'Income' }
}, { timestamps: true });

libraryFineSchema.index({ tenantId: 1, status: 1 });
libraryFineSchema.index({ tenantId: 1, memberId: 1, status: 1 });

module.exports = mongoose.model('LibraryFine', libraryFineSchema);
