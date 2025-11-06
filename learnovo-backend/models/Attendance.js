const mongoose = require('mongoose')

/**
 * Attendance Model
 * Tracks daily attendance for students by class, subject, and teacher
 */
const attendanceSchema = new mongoose.Schema({
  // Multi-tenant support
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  
  // Class reference
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: [true, 'Class is required']
  },
  
  // Teacher who marked attendance
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Teacher is required']
  },
  
  // Subject for which attendance is marked
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true
  },
  
  // Date of attendance
  date: {
    type: Date,
    required: [true, 'Date is required']
  },
  
  // Academic year
  academicYear: {
    type: String,
    default: '2025-2026'
  },
  
  // Individual student attendance records
  attendanceRecords: [{
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    admissionNumber: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'late'],
      default: 'present'
    },
    markedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Summary counts
  totalPresent: {
    type: Number,
    default: 0
  },
  totalAbsent: {
    type: Number,
    default: 0
  },
  totalLate: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
})

// Calculate totals before saving
attendanceSchema.pre('save', function(next) {
  this.totalPresent = this.attendanceRecords.filter(r => r.status === 'present').length
  this.totalAbsent = this.attendanceRecords.filter(r => r.status === 'absent').length
  this.totalLate = this.attendanceRecords.filter(r => r.status === 'late').length
  next()
})

// Compound index for faster queries and uniqueness
attendanceSchema.index({ tenantId: 1, classId: 1, date: 1, subject: 1 }, { unique: true })
attendanceSchema.index({ teacherId: 1 })
attendanceSchema.index({ date: 1 })

/**
 * Static method to get attendance for a class on a specific date
 */
attendanceSchema.statics.getAttendanceByDate = function(classId, date, subject) {
  return this.findOne({ classId, date, subject }).populate('attendanceRecords.studentId', 'name email admissionNumber')
}

/**
 * Static method to get attendance statistics for a student
 */
attendanceSchema.statics.getStudentAttendanceStats = function(studentId, academicYear) {
  return this.aggregate([
    { $unwind: '$attendanceRecords' },
    { $match: { 'attendanceRecords.studentId': studentId, academicYear } },
    {
      $group: {
        _id: '$attendanceRecords.status',
        count: { $sum: 1 }
      }
    }
  ])
}

module.exports = mongoose.model('Attendance', attendanceSchema)

