const mongoose = require('mongoose');

const timetableEntrySchema = new mongoose.Schema({
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
  dayOfWeek: {
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    required: [true, 'Day of week is required']
  },
  timingSlotId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SchoolTiming',
    required: [true, 'Timing slot ID is required']
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: [true, 'Class ID is required']
  },
  sectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section',
    default: null
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: [true, 'Subject ID is required']
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Teacher ID is required']
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    default: null
  },
  isManual: {
    type: Boolean,
    default: false
  },
  lockedByUser: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Conflict detection indexes (unique constraints)
timetableEntrySchema.index(
  { tenantId: 1, templateId: 1, dayOfWeek: 1, timingSlotId: 1, classId: 1, sectionId: 1 },
  { unique: true }
);
timetableEntrySchema.index(
  { tenantId: 1, templateId: 1, dayOfWeek: 1, timingSlotId: 1, teacherId: 1 },
  { unique: true }
);

// Query indexes
timetableEntrySchema.index({ tenantId: 1, templateId: 1, classId: 1, sectionId: 1 });
timetableEntrySchema.index({ tenantId: 1, templateId: 1, teacherId: 1 });

module.exports = mongoose.model('TimetableEntry', timetableEntrySchema);
