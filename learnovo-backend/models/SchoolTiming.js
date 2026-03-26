const mongoose = require('mongoose');

const schoolTimingSchema = new mongoose.Schema({
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
  slotNumber: {
    type: Number,
    required: [true, 'Slot number is required'],
    min: 1
  },
  label: {
    type: String,
    required: [true, 'Slot label is required'],
    trim: true
  },
  startTime: {
    type: String,
    required: [true, 'Start time is required']
  },
  endTime: {
    type: String,
    required: [true, 'End time is required']
  },
  type: {
    type: String,
    enum: ['period', 'break', 'lunch', 'assembly', 'activity'],
    default: 'period'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Pre-validate: endTime must be after startTime
schoolTimingSchema.pre('validate', function (next) {
  if (this.startTime && this.endTime && this.endTime <= this.startTime) {
    this.invalidate('endTime', 'End time must be after start time');
  }
  next();
});

// Indexes
schoolTimingSchema.index({ tenantId: 1, templateId: 1, slotNumber: 1 }, { unique: true });
schoolTimingSchema.index({ tenantId: 1, templateId: 1, type: 1 });

module.exports = mongoose.model('SchoolTiming', schoolTimingSchema);
