const mongoose = require('mongoose');

const timetableTemplateSchema = new mongoose.Schema({
  // Multi-tenant support
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },

  name: {
    type: String,
    required: [true, 'Template name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  academicSessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicSession'
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  effectiveFrom: {
    type: Date
  },
  effectiveTo: {
    type: Date
  },
  workingDays: {
    type: [String],
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    default: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  publishedAt: {
    type: Date
  },
  publishedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  version: {
    type: Number,
    default: 1
  },
  duplicatedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TimetableTemplate'
  }
}, {
  timestamps: true
});

// Indexes
timetableTemplateSchema.index({ tenantId: 1, status: 1 });
timetableTemplateSchema.index({ tenantId: 1, academicSessionId: 1 });

module.exports = mongoose.model('TimetableTemplate', timetableTemplateSchema);
