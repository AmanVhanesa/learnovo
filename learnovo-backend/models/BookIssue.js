const mongoose = require('mongoose');

const bookIssueSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },

  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
  copyId: { type: mongoose.Schema.Types.ObjectId, ref: 'BookCopy', required: true, index: true },
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'LibraryMember', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  issueDate: { type: Date, required: true, default: Date.now },
  dueDate: { type: Date, required: true },
  returnDate: { type: Date },

  renewalCount: { type: Number, default: 0, min: 0 },
  lastRenewedAt: { type: Date },

  status: {
    type: String,
    enum: ['issued', 'returned', 'overdue', 'lost'],
    default: 'issued',
    index: true
  },

  fineAmount: { type: Number, default: 0, min: 0 },
  finePaid: { type: Boolean, default: false },

  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  returnedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  remarks: { type: String, trim: true, default: '' }
}, { timestamps: true });

bookIssueSchema.index({ tenantId: 1, status: 1, dueDate: 1 });
bookIssueSchema.index({ tenantId: 1, memberId: 1, status: 1 });

module.exports = mongoose.model('BookIssue', bookIssueSchema);
