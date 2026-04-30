const mongoose = require('mongoose');

const bookCopySchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true, index: true },

  accessionNumber: { type: String, required: true, trim: true, uppercase: true },

  condition: {
    type: String,
    enum: ['new', 'good', 'fair', 'damaged', 'lost'],
    default: 'new'
  },

  status: {
    type: String,
    enum: ['available', 'issued', 'reserved', 'lost', 'damaged', 'retired'],
    default: 'available',
    index: true
  },

  acquiredDate: { type: Date, default: Date.now },
  price: { type: Number, default: 0, min: 0 },
  remarks: { type: String, trim: true, default: '' }
}, { timestamps: true });

bookCopySchema.index({ tenantId: 1, accessionNumber: 1 }, { unique: true });
bookCopySchema.index({ tenantId: 1, bookId: 1, status: 1 });

module.exports = mongoose.model('BookCopy', bookCopySchema);
