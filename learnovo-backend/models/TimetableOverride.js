const mongoose = require('mongoose');

const timetableOverrideSchema = new mongoose.Schema({
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
  date: {
    type: Date,
    required: [true, 'Override date is required']
  },
  type: {
    type: String,
    enum: ['holiday', 'half_day', 'exam_day', 'special_schedule', 'cancelled'],
    required: [true, 'Override type is required']
  },
  title: {
    type: String,
    required: [true, 'Override title is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  activeSlots: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SchoolTiming'
  }],
  overrideEntries: [{
    timingSlotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SchoolTiming'
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class'
    },
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section'
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject'
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room'
    },
    label: {
      type: String,
      trim: true
    }
  }],
  appliesTo: {
    type: String,
    enum: ['all', 'specific_classes'],
    default: 'all'
  },
  specificClasses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
timetableOverrideSchema.index(
  { tenantId: 1, templateId: 1, date: 1 },
  { unique: true }
);
timetableOverrideSchema.index({ tenantId: 1, date: 1 });

module.exports = mongoose.model('TimetableOverride', timetableOverrideSchema);
