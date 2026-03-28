const mongoose = require('mongoose');

/**
 * Employee Attendance Model
 * Tracks daily attendance for employees (teachers, staff, etc.)
 */
const employeeAttendanceSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Employee is required']
  },
  date: {
    type: Date,
    required: [true, 'Date is required']
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'half_day', 'on_leave', 'excused'],
    default: 'present'
  },
  checkInTime: {
    type: String,
    trim: true
  },
  checkOutTime: {
    type: String,
    trim: true
  },
  remarks: {
    type: String,
    trim: true
  },
  markedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  markedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// One record per employee per day per tenant
employeeAttendanceSchema.index({ tenantId: 1, employeeId: 1, date: 1 }, { unique: true });
employeeAttendanceSchema.index({ tenantId: 1, date: 1 });

module.exports = mongoose.model('EmployeeAttendance', employeeAttendanceSchema);
