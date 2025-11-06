const mongoose = require('mongoose')

/**
 * Fee Structure Model
 * Defines fee categories, amounts, and payment schedules for classes
 */
const feeStructureSchema = new mongoose.Schema({
  // Multi-tenant support
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  
  // Class this fee structure applies to
  class: {
    type: String,
    required: [true, 'Class is required'],
    trim: true
  },
  
  // Academic year
  academicYear: {
    type: String,
    required: [true, 'Academic year is required'],
    trim: true,
    match: [/^\d{4}-\d{4}$/, 'Academic year must be in format YYYY-YYYY']
  },
  
  // Fee categories with amounts
  categories: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true
    },
    description: {
      type: String,
      trim: true
    }
  }],
  
  // Payment frequency
  frequency: {
    type: String,
    enum: ['monthly', 'quarterly', 'half-yearly', 'yearly'],
    required: [true, 'Payment frequency is required'],
    default: 'monthly'
  },
  
  // Due dates configuration
  dueDates: [{
    month: {
      type: Number,
      min: 1,
      max: 12
    },
    day: {
      type: Number,
      min: 1,
      max: 31
    },
    description: {
      type: String,
      trim: true
    }
  }],
  
  // Late fee configuration
  lateFee: {
    type: {
      type: String,
      enum: ['fixed', 'percentage'],
      default: 'fixed'
    },
    amount: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Created by
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
})

// Indexes for efficient queries
feeStructureSchema.index({ tenantId: 1, class: 1, academicYear: 1 })
feeStructureSchema.index({ tenantId: 1, isActive: 1 })

module.exports = mongoose.model('FeeStructure', feeStructureSchema)

