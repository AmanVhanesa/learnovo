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
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: [true, 'Class is required']
  },

  // Section (optional - null means applies to all sections)
  sectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section',
    default: null
  },

  // Academic session
  academicSessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicSession',
    required: [true, 'Academic session is required']
  },

  // Fee heads with amounts and payment schedules
  feeHeads: [{
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
    frequency: {
      type: String,
      enum: ['monthly', 'quarterly', 'annually', 'one-time'],
      default: 'monthly'
    },
    isCompulsory: {
      type: Boolean,
      default: true
    },
    dueDay: {
      type: Number,
      min: 1,
      max: 31,
      default: 5
    },
    description: {
      type: String,
      trim: true
    }
  }],

  // Late fee configuration
  lateFeeConfig: {
    enabled: {
      type: Boolean,
      default: false
    },
    type: {
      type: String,
      enum: ['fixed', 'percentage'],
      default: 'fixed'
    },
    amount: {
      type: Number,
      default: 0,
      min: 0
    },
    gracePeriodDays: {
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
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Virtual field to calculate total amount
feeStructureSchema.virtual('totalAmount').get(function () {
  if (!this.feeHeads || this.feeHeads.length === 0) return 0
  return this.feeHeads.reduce((total, head) => total + (head.amount || 0), 0)
})

// Indexes for efficient queries
feeStructureSchema.index({ tenantId: 1, classId: 1, academicSessionId: 1 })
feeStructureSchema.index({ tenantId: 1, isActive: 1 })
feeStructureSchema.index({ tenantId: 1, classId: 1, sectionId: 1, academicSessionId: 1 })

module.exports = mongoose.model('FeeStructure', feeStructureSchema)

