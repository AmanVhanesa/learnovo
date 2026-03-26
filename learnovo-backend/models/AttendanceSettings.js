const mongoose = require('mongoose')

/**
 * Attendance Settings Model
 * Stores school-level attendance configuration
 */
const attendanceSettingsSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    unique: true
  },
  workingDays: {
    type: [String],
    default: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  },
  schoolStartTime: {
    type: String,
    default: '08:00'
  },
  lateThresholdTime: {
    type: String,
    default: '08:15'
  },
  halfDayThreshold: {
    type: String,
    default: '11:00'
  },
  autoAbsentTime: {
    type: String,
    default: null
  },
  allowPastEditing: {
    type: Boolean,
    default: true
  },
  pastEditDays: {
    type: Number,
    default: 7
  },
  smsNotifyAbsent: {
    type: Boolean,
    default: false
  },
  notifyParents: {
    type: Boolean,
    default: true
  },
  dailySummaryToAdmin: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
})

module.exports = mongoose.model('AttendanceSettings', attendanceSettingsSchema)
