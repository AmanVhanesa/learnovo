const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Exam name is required'],
    trim: true
  },
  term: {
    type: String,
    enum: ['Term 1', 'Term 2'],
    default: 'Term 1'
  },
  examSeries: {
    type: String,
    enum: ['FA1', 'FA2', 'FA3', 'FA4', 'SA1', 'SA2', 'Unit Test', 'Midterm', 'Final', 'Custom', 'UT1', 'UT2', 'Assessment', 'HY1', 'HY2', 'CCE1', 'CCE2'],
    default: 'UT1'
  },
  class: {
    type: String,
    required: [true, 'Class is required'],
    trim: true
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class'
  },
  section: {
    type: String,
    trim: true
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true
  },
  date: {
    type: Date,
    required: [true, 'Date is required']
  },
  startTime: {
    type: String,
    trim: true
  },
  endTime: {
    type: String,
    trim: true
  },
  totalMarks: {
    type: Number,
    required: [true, 'Total marks are required'],
    min: 0,
    max: [100, 'Total marks cannot exceed 100']
  },
  passingMarks: {
    type: Number,
    min: 0,
    validate: {
      validator: function(v) {
        return v == null || v < this.totalMarks;
      },
      message: 'Passing marks must be less than total marks'
    }
  },
  examType: {
    type: String,
    enum: ['Written', 'Practical', 'Oral', 'Quiz', 'Assignment', 'Other'],
    default: 'Written'
  },
  examMode: {
    type: String,
    enum: ['Offline', 'Online'],
    default: 'Offline'
  },
  supervisor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  examRoom: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['Scheduled', 'Ongoing', 'Completed', 'Cancelled'],
    default: 'Scheduled'
  }
}, {
  timestamps: true
});

examSchema.index({ tenantId: 1, term: 1, class: 1 });
examSchema.index({ tenantId: 1, class: 1, subject: 1 });
examSchema.index({ tenantId: 1, class: 1, section: 1, date: 1 });
examSchema.index({ tenantId: 1, status: 1, date: 1 });

module.exports = mongoose.model('Exam', examSchema);
