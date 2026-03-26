const mongoose = require('mongoose');

const expenseBudgetSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExpenseCategory',
    required: [true, 'Category is required']
  },
  month: {
    type: Number,
    required: [true, 'Month is required'],
    min: 1,
    max: 12
  },
  year: {
    type: Number,
    required: [true, 'Year is required']
  },
  budgetAmount: {
    type: Number,
    required: [true, 'Budget amount is required'],
    min: [0, 'Budget amount cannot be negative']
  }
}, {
  timestamps: true
});

expenseBudgetSchema.index({ tenantId: 1, category: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('ExpenseBudget', expenseBudgetSchema);
