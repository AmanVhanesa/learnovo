const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },

  title: { type: String, required: [true, 'Title is required'], trim: true },
  author: { type: String, required: [true, 'Author is required'], trim: true },
  isbn: { type: String, trim: true, default: '' },
  publisher: { type: String, trim: true, default: '' },
  edition: { type: String, trim: true, default: '' },
  language: { type: String, trim: true, default: 'English' },

  category: { type: mongoose.Schema.Types.ObjectId, ref: 'BookCategory' },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },

  description: { type: String, trim: true, default: '' },
  coverImage: { type: String, default: '' },

  totalCopies: { type: Number, default: 0, min: 0 },
  availableCopies: { type: Number, default: 0, min: 0 },

  location: {
    rack: { type: String, trim: true, default: '' },
    shelf: { type: String, trim: true, default: '' }
  },

  price: { type: Number, default: 0, min: 0 },
  acquiredDate: { type: Date, default: Date.now },

  isActive: { type: Boolean, default: true }
}, { timestamps: true });

bookSchema.index({ tenantId: 1, title: 1 });
bookSchema.index({ tenantId: 1, author: 1 });
bookSchema.index({ tenantId: 1, isbn: 1 });
bookSchema.index({ tenantId: 1, category: 1 });
bookSchema.index({ tenantId: 1, isActive: 1 });

module.exports = mongoose.model('Book', bookSchema);
