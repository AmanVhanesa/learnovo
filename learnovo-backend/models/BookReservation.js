const mongoose = require('mongoose');

const bookReservationSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'LibraryMember', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  reservedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  fulfilledAt: { type: Date },
  cancelledAt: { type: Date },

  status: {
    type: String,
    enum: ['active', 'fulfilled', 'cancelled', 'expired'],
    default: 'active',
    index: true
  },

  notes: { type: String, trim: true, default: '' }
}, { timestamps: true });

bookReservationSchema.index({ tenantId: 1, bookId: 1, status: 1 });
bookReservationSchema.index({ tenantId: 1, memberId: 1, status: 1 });

module.exports = mongoose.model('BookReservation', bookReservationSchema);
