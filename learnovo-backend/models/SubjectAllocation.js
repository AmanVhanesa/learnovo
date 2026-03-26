const mongoose = require('mongoose');

const subjectAllocationSchema = new mongoose.Schema({
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
  periodsPerWeek: {
    type: Number,
    required: [true, 'Periods per week is required'],
    min: 1,
    max: 15
  },
  preferConsecutive: {
    type: Boolean,
    default: false
  },
  consecutiveCount: {
    type: Number,
    default: 1,
    min: 1,
    max: 3
  },
  preferredRoomType: {
    type: String,
    enum: ['classroom', 'lab', 'auditorium', 'library', 'sports', 'other']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
subjectAllocationSchema.index(
  { tenantId: 1, templateId: 1, classId: 1, sectionId: 1, subjectId: 1 },
  { unique: true }
);
subjectAllocationSchema.index({ tenantId: 1, templateId: 1, teacherId: 1 });

module.exports = mongoose.model('SubjectAllocation', subjectAllocationSchema);
