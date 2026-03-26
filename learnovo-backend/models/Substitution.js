const mongoose = require('mongoose');

const substitutionSchema = new mongoose.Schema({
  // Multi-tenant support
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },

  date: {
    type: Date,
    required: [true, 'Substitution date is required']
  },
  originalEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TimetableEntry',
    required: [true, 'Original timetable entry ID is required']
  },
  absentTeacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Absent teacher ID is required']
  },
  substituteTeacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  substituteSubjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    default: null
  },
  reason: {
    type: String,
    enum: ['sick', 'personal', 'official', 'training', 'other'],
    default: 'other'
  },
  reasonNote: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'completed', 'cancelled'],
    default: 'pending'
  },
  notifiedAt: {
    type: Date
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
substitutionSchema.index({ tenantId: 1, date: 1, status: 1 });
substitutionSchema.index({ tenantId: 1, date: 1, absentTeacherId: 1 });
substitutionSchema.index(
  { tenantId: 1, originalEntryId: 1, date: 1 },
  { unique: true }
);

module.exports = mongoose.model('Substitution', substitutionSchema);
