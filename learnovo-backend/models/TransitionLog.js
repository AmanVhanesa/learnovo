const mongoose = require('mongoose');

const transitionLogSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['promotion', 'demotion', 'section_shift', 'section_merge', 'section_split', 'year_rollover', 'graduation'],
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // null for bulk operations like merge/rollover summary
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fromClass: {
    type: String,
    trim: true
  },
  fromSection: {
    type: String,
    trim: true
  },
  toClass: {
    type: String,
    trim: true
  },
  toSection: {
    type: String,
    trim: true
  },
  fromAcademicYear: {
    type: String,
    trim: true
  },
  toAcademicYear: {
    type: String,
    trim: true
  },
  reason: {
    type: String,
    trim: true,
    default: ''
  },
  batchId: {
    type: String,
    trim: true,
    index: true // groups bulk operations together
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {} // extra data like merge distribution, rollover summary, etc.
  },
  reversedAt: {
    type: Date,
    default: null
  },
  reversedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
transitionLogSchema.index({ tenantId: 1, type: 1, createdAt: -1 });
transitionLogSchema.index({ tenantId: 1, studentId: 1, createdAt: -1 });
transitionLogSchema.index({ tenantId: 1, batchId: 1 });
transitionLogSchema.index({ tenantId: 1, createdAt: -1 });

module.exports = mongoose.model('TransitionLog', transitionLogSchema);
