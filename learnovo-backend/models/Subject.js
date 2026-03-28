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
    required: [true, 'Subject code is required'],
    trim: true,
    uppercase: true
  },
  type: {
    type: String,
    enum: ['Theory', 'Practical', 'Both'],
    default: 'Theory'
  },
  maxMarks: {
    type: Number,
    default: 100,
    min: 0,
    max: [100, 'Max marks cannot exceed 100']
  },
  passingMarks: {
    type: Number,
    default: 33,
    min: 0
  },
  description: {
    type: String,
    trim: true
  },
  // When true, students may opt out of this subject via Subject Preferences.
  // Defaults to false — most subjects are compulsory.
  isOptional: {
    type: Boolean,
    default: false
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
