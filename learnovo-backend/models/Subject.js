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
  description: {
    type: String,
    trim: true
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
