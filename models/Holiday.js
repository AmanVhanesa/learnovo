const mongoose = require('mongoose')

/**
 * Holiday Model
 * Tracks holidays, breaks, and non-working days for a school
 */
const holidaySchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: [true, 'Holiday title is required'],
    trim: true
  },
  date: {
    type: Date,
    required: [true, 'Date is required']
  },
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  type: {
    type: String,
    enum: ['public_holiday', 'school_holiday', 'exam_break', 'vacation'],
    default: 'school_holiday'
  },
  appliesTo: {
    type: String,
    enum: ['all', 'students', 'employees'],
    default: 'all'
  }
}, {
  timestamps: true
})

holidaySchema.index({ tenantId: 1, date: 1 })

module.exports = mongoose.model('Holiday', holidaySchema)
