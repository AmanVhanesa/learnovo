const mongoose = require('mongoose');

const studentAttendanceRecordSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  academicSessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicSession',
    required: true,
    index: true
  },
  term1WorkingDays: { type: Number, default: null },
  term1PresentDays: { type: Number, default: null },
  term2WorkingDays: { type: Number, default: null },
  term2PresentDays: { type: Number, default: null }
}, { timestamps: true });

studentAttendanceRecordSchema.index(
  { tenantId: 1, studentId: 1, academicSessionId: 1 },
  { unique: true }
);

module.exports = mongoose.model('StudentAttendanceRecord', studentAttendanceRecordSchema);
