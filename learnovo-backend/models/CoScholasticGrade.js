const mongoose = require('mongoose');

const coScholasticGradeSchema = new mongoose.Schema({
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
  areas: [{
    area: { type: String, required: true, trim: true },
    term1Grade: { type: String, default: '', trim: true },
    term2Grade: { type: String, default: '', trim: true }
  }]
}, { timestamps: true });

coScholasticGradeSchema.index(
  { tenantId: 1, studentId: 1, academicSessionId: 1 },
  { unique: true }
);

module.exports = mongoose.model('CoScholasticGrade', coScholasticGradeSchema);
