const mongoose = require('mongoose');

const expenseCategorySchema = new mongoose.Schema({
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
    default: 'Receipt',
    trim: true
  },
  color: {
    type: String,
    default: '#3EC4B1',
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

expenseCategorySchema.index({ tenantId: 1, name: 1 }, { unique: true });
expenseCategorySchema.index({ tenantId: 1, isActive: 1 });

module.exports = mongoose.model('ExpenseCategory', expenseCategorySchema);
