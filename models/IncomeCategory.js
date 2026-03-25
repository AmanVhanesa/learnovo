const mongoose = require('mongoose');

const incomeCategorySchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true
  },
  icon: {
    type: String,
    trim: true,
    default: 'CircleDollarSign'
  },
  color: {
    type: String,
    trim: true,
    default: '#3B82F6'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

incomeCategorySchema.index({ tenantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('IncomeCategory', incomeCategorySchema);
