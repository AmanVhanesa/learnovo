const mongoose = require('mongoose');

const circularSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  circularNumber: {
    type: String,
    required: true,
    trim: true
  },

  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },

  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
    maxlength: [300, 'Subject cannot exceed 300 characters']
  },

  body: {
    type: String,
    required: [true, 'Body is required'],
    trim: true,
    maxlength: [10000, 'Body cannot exceed 10000 characters']
  },

  category: {
    type: String,
    enum: ['general', 'academic', 'event', 'holiday', 'exam', 'fee', 'urgent', 'other'],
    default: 'general'
  },

  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },

  targetAudience: {
    type: [String],
    enum: ['student', 'teacher', 'parent', 'admin', 'all'],
    required: true,
    default: ['all']
  },

  targetClasses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class'
  }],

  issueDate: {
    type: Date,
    default: Date.now,
    required: true
  },

  signedByName: {
    type: String,
    trim: true,
    default: ''
  },

  signedByDesignation: {
    type: String,
    trim: true,
    default: 'Principal'
  },

  referenceNumber: {
    type: String,
    trim: true,
    default: ''
  },

  isActive: {
    type: Boolean,
    default: true
  },

  notificationsSent: {
    type: Number,
    default: 0
  },

  sentAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

circularSchema.index({ tenantId: 1, isActive: 1, createdAt: -1 });
circularSchema.index({ tenantId: 1, circularNumber: 1 }, { unique: true });

module.exports = mongoose.model('Circular', circularSchema);
