const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  // Multi-tenant support
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },

  name: {
    type: String,
    required: [true, 'Subject name is required'],
    trim: true
  },
  subjectCode: {
    type: String,
    trim: true,
    uppercase: true,
    sparse: true // Optional, but unique if provided
  },
  type: {
    type: String,
    enum: ['Theory', 'Practical', 'Both'],
    default: 'Theory'
  },
  maxMarks: {
    type: Number,
    min: 0,
    default: 100
  },
  passingMarks: {
    type: Number,
    min: 0,
    default: 33
  },
  description: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for better query performance
subjectSchema.index({ tenantId: 1, subjectCode: 1 }, { unique: true }); // Subject code unique per tenant
subjectSchema.index({ tenantId: 1, isActive: 1 });
subjectSchema.index({ tenantId: 1 });

module.exports = mongoose.model('Subject', subjectSchema);
