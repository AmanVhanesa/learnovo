const mongoose = require('mongoose');

const bookCategorySchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

bookCategorySchema.index({ tenantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('BookCategory', bookCategorySchema);
