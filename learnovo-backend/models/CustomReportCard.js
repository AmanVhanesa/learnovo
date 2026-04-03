const mongoose = require('mongoose');

const customReportCardSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  studentName: {
    type: String,
    required: true,
    trim: true
  },
  studentClass: {
    type: String,
    trim: true
  },
  studentSection: {
    type: String,
    trim: true
  },
  admissionNumber: {
    type: String,
    trim: true
  },
  reportType: {
    type: String,
    enum: ['single', 'cumulative'],
    required: true
  },
  examInfo: {
    type: String,
    trim: true
  },
  sessionName: {
    type: String,
    trim: true
  },
  overallPercentage: {
    type: Number,
    default: 0
  },
  overallGrade: {
    type: String,
    trim: true
  },
  result: {
    type: String,
    enum: ['PASS', 'FAIL'],
    default: 'FAIL'
  },
  remarks: {
    type: String,
    trim: true
  },
  // S3 storage
  pdfUrl: {
    type: String,
    required: true
  },
  pdfKey: {
    type: String,
    required: true
  },
  // Snapshot of the full payload for re-generation
  payloadSnapshot: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

customReportCardSchema.index({ tenantId: 1, createdAt: -1 });
customReportCardSchema.index({ tenantId: 1, studentName: 1 });

module.exports = mongoose.model('CustomReportCard', customReportCardSchema);
