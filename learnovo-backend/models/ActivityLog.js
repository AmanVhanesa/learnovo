const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['certificate', 'student', 'fee', 'attendance', 'exam', 'general'],
    default: 'certificate'
  },
  action: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  studentName: String,
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Auto-expire after 90 days
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
