const mongoose = require('mongoose');

const teacherConstraintSchema = new mongoose.Schema({
  // Multi-tenant support
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },

  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TimetableTemplate',
    required: [true, 'Template ID is required']
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Teacher ID is required']
  },
  type: {
    type: String,
    enum: ['unavailable', 'preferred', 'maxPeriodsPerDay', 'maxConsecutive', 'noFirstPeriod', 'noLastPeriod'],
    required: [true, 'Constraint type is required']
  },
  dayOfWeek: {
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    default: null
  },
  timingSlotId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SchoolTiming',
    default: null
  },
  value: {
    type: Number,
    min: 1
  },
  reason: {
    type: String,
    trim: true
  },
  priority: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
teacherConstraintSchema.index({ tenantId: 1, templateId: 1, teacherId: 1 });

module.exports = mongoose.model('TeacherConstraint', teacherConstraintSchema);
